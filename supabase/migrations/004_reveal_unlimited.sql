-- Migration 004: reveal_unlimited flag + apply_credits_purchase RPC
-- Adds reveal_unlimited column to profiles and replaces reveal_owner_phone
-- to bypass quota for unlimited users.

-- ── 1. New column ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reveal_unlimited BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Atomic credits-purchase helper ─────────────────────────────────────────
-- Called by the verify-credits-payment Edge Function after HMAC verification.
-- Returns the updated { reveal_credits, reveal_unlimited } row.
CREATE OR REPLACE FUNCTION public.apply_credits_purchase(
  p_user_id   UUID,
  p_pack      TEXT   -- '10credits' or 'unlimited'
)
RETURNS TABLE(reveal_credits INTEGER, reveal_unlimited BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_pack = '10credits' THEN
    UPDATE public.profiles
    SET reveal_credits = profiles.reveal_credits + 10
    WHERE id = p_user_id;

  ELSIF p_pack = 'unlimited' THEN
    UPDATE public.profiles
    SET reveal_unlimited = true
    WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid pack: %', p_pack;
  END IF;

  RETURN QUERY
    SELECT p.reveal_credits, p.reveal_unlimited
    FROM public.profiles p
    WHERE p.id = p_user_id;
END;
$$;

-- ── 3. Grant execute to service role (anon / authenticated cannot call directly) ──
REVOKE ALL ON FUNCTION public.apply_credits_purchase(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.apply_credits_purchase(UUID, TEXT) TO service_role;

-- ── 4. Update reveal_owner_phone to respect unlimited flag ────────────────────
--
-- Replaces the version from migration 001. The only change is the additional
-- check: skip the monthly quota when the caller's profile has reveal_unlimited.
--
CREATE OR REPLACE FUNCTION public.reveal_owner_phone(p_property_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id       UUID;
  v_owner_id        UUID;
  v_owner_phone     TEXT;
  v_reveals_this_month BIGINT;
  v_is_unlimited    BOOLEAN;
BEGIN
  -- Caller must be authenticated
  v_tenant_id := auth.uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Fetch property
  SELECT owner_id, owner_phone
  INTO v_owner_id, v_owner_phone
  FROM public.properties
  WHERE id = p_property_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found or not active';
  END IF;

  -- Cannot reveal own listing
  IF v_owner_id = v_tenant_id THEN
    RAISE EXCEPTION 'Cannot reveal your own listing';
  END IF;

  -- Check if already revealed (idempotent — return cached)
  IF EXISTS (
    SELECT 1 FROM public.contact_reveals
    WHERE property_id = p_property_id
      AND tenant_id   = v_tenant_id
  ) THEN
    RETURN v_owner_phone;
  END IF;

  -- Check unlimited flag — skip quota for unlimited users
  SELECT reveal_unlimited INTO v_is_unlimited
  FROM public.profiles
  WHERE id = v_tenant_id;

  IF NOT v_is_unlimited THEN
    -- Enforce monthly reveal quota (3 per calendar month)
    SELECT COUNT(*) INTO v_reveals_this_month
    FROM public.contact_reveals
    WHERE tenant_id  = v_tenant_id
      AND created_at >= date_trunc('month', now());

    IF v_reveals_this_month >= 3 THEN
      RAISE EXCEPTION 'Monthly reveal quota exceeded';
    END IF;
  END IF;

  -- Record the reveal
  INSERT INTO public.contact_reveals (property_id, tenant_id, owner_id)
  VALUES (p_property_id, v_tenant_id, v_owner_id);

  -- Decrement reveal_credits only if not unlimited
  IF NOT v_is_unlimited THEN
    UPDATE public.profiles
    SET reveal_credits = GREATEST(reveal_credits - 1, 0)
    WHERE id = v_tenant_id;
  END IF;

  RETURN v_owner_phone;
END;
$$;
