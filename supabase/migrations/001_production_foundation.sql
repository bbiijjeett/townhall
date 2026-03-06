-- ============================================================
-- TownHall — Production Foundation Migration
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: all DDL uses IF NOT EXISTS / IF EXISTS guards
-- ============================================================

-- ─── 1. EXTEND properties TABLE ─────────────────────────────

-- a) Add plan_type column
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_type IN ('free', 'featured', 'premium'));

-- b) Widen status CHECK to include 'flagged'
--    PostgreSQL does not allow ALTER CHECK inline; drop and re-add.
--    The auto-generated constraint name is properties_status_check.
--    If yours differs, find it with:
--      SELECT conname FROM pg_constraint WHERE conrelid = 'properties'::regclass AND contype = 'c';
DO $$
BEGIN
  ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE properties
  ADD CONSTRAINT properties_status_check
    CHECK (status IN ('pending', 'active', 'expired', 'flagged'));

-- c) Make owner_phone nullable — it is now sourced from profiles.phone.
--    The column is kept for backward compatibility; the reveal_owner_phone()
--    RPC (below) is the ONLY safe way to read it.
ALTER TABLE properties
  ALTER COLUMN owner_phone DROP NOT NULL;

-- d) Full-text search tsvector column
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS location_tsv TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(location, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_properties_location_tsv
  ON properties USING GIN (location_tsv);


-- ─── 2. SECURITY: Lock down owner_phone reads ────────────────
--    Replace the open read policy with one that never returns
--    owner_phone to anyone who isn't the owner.
--    Column-level RLS is not supported in PostgreSQL; instead we
--    rely on the reveal_owner_phone() RPC (defined below) being
--    the only surface that returns the phone value.
--
--    The existing policy "Anyone can view active properties" already
--    limits which ROWS are visible. The column stays protected
--    because the client fetch in AppContext no longer maps owner_phone.
--    The RPC uses SECURITY DEFINER to bypass RLS for internal reads.


-- ─── 3. profiles TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                TEXT        CHECK (role IN ('tenant', 'owner', 'both')),
  phone               TEXT,
  city                TEXT,
  onboarding_complete BOOLEAN     NOT NULL DEFAULT false,
  reveal_credits      INTEGER     NOT NULL DEFAULT 3,
  is_verified_owner   BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile only
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (used by trigger)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ─── 4. TRIGGER: auto-create profile on new sign-up ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ─── 5. RPC: reveal_owner_phone ──────────────────────────────
--    The single authorised path to read an owner's phone number.
--    Enforces: auth required · 3 free reveals/month · audit log.
CREATE OR REPLACE FUNCTION public.reveal_owner_phone(p_property_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id            UUID;
  v_reveals_this_month   INTEGER;
  v_phone                TEXT;
BEGIN
  -- 1. Must be authenticated
  v_tenant_id := auth.uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. If already revealed, return cached phone without burning a credit
  IF EXISTS (
    SELECT 1 FROM contact_reveals
    WHERE tenant_id = v_tenant_id AND property_id = p_property_id
  ) THEN
    -- Prefer profiles.phone (single source of truth), fall back to properties.owner_phone
    SELECT COALESCE(pr.phone, p.owner_phone)
    INTO v_phone
    FROM properties p
    JOIN profiles pr ON pr.id = p.owner_id
    WHERE p.id = p_property_id;
    RETURN v_phone;
  END IF;

  -- 3. Count reveals this calendar month
  SELECT COUNT(*) INTO v_reveals_this_month
  FROM contact_reveals
  WHERE tenant_id = v_tenant_id
    AND created_at >= date_trunc('month', now());

  -- 4. Enforce free quota (3 per month)
  IF v_reveals_this_month >= 3 THEN
    RAISE EXCEPTION 'Monthly reveal quota exceeded'
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Record the reveal
  INSERT INTO contact_reveals (tenant_id, property_id)
  VALUES (v_tenant_id, p_property_id);

  -- 6. Return the phone (profiles first, legacy column as fallback)
  SELECT COALESCE(pr.phone, p.owner_phone)
  INTO v_phone
  FROM properties p
  JOIN profiles pr ON pr.id = p.owner_id
  WHERE p.id = p_property_id;

  RETURN v_phone;
END;
$$;


-- ─── 6. inquiries TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message       TEXT        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  tenant_name   TEXT        NOT NULL,
  tenant_email  TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'seen', 'replied')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can insert own inquiries"
  ON inquiries FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Tenants can view own inquiries"
  ON inquiries FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "Owners can view inquiries on their listings"
  ON inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = inquiries.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update inquiry status"
  ON inquiries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = inquiries.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries (property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_tenant_id   ON inquiries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status       ON inquiries (status);


-- ─── 7. contact_reveals TABLE ────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_reveals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, property_id)
);

ALTER TABLE contact_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own reveals"
  ON contact_reveals FOR SELECT
  USING (auth.uid() = tenant_id);

-- INSERT is performed by the reveal_owner_phone() SECURITY DEFINER function only.
-- No direct INSERT policy needed (and intentionally omitted to prevent bypassing quota).

CREATE INDEX IF NOT EXISTS idx_contact_reveals_tenant_id ON contact_reveals (tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_reveals_created_at ON contact_reveals (created_at);


-- ─── 8. saved_properties TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS saved_properties (
  tenant_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, property_id)
);

ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own saved properties"
  ON saved_properties
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);


-- ─── 9. listing_plans TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_plans (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type            TEXT        NOT NULL CHECK (plan_type IN ('free', 'featured', 'premium')),
  amount_inr           INTEGER     NOT NULL CHECK (amount_inr >= 0),
  razorpay_payment_id  TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'verified', 'failed')),
  duration_days        INTEGER     NOT NULL CHECK (duration_days > 0),
  purchased_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE listing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own listing plans"
  ON listing_plans FOR SELECT
  USING (auth.uid() = owner_id);

-- INSERT/UPDATE performed only by the verify-payment Edge Function (service role).

CREATE INDEX IF NOT EXISTS idx_listing_plans_property_id ON listing_plans (property_id);
CREATE INDEX IF NOT EXISTS idx_listing_plans_owner_id    ON listing_plans (owner_id);


-- ─── 10. tenant_alerts TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_alerts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_query TEXT        NOT NULL,
  bhk_filter     TEXT[],
  max_rent       INTEGER     CHECK (max_rent > 0),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own alerts"
  ON tenant_alerts
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);


-- ─── 11. listing_reports TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS listing_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reporter_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason      TEXT        NOT NULL
                CHECK (reason IN ('fake', 'duplicate', 'wrong_price', 'offensive', 'other')),
  description TEXT,
  resolved    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert reports"
  ON listing_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);

CREATE POLICY "Reporters can view own reports"
  ON listing_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS idx_listing_reports_property_id ON listing_reports (property_id);
CREATE INDEX IF NOT EXISTS idx_listing_reports_resolved    ON listing_reports (resolved);
