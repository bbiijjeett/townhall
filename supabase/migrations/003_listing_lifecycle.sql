-- ============================================================
-- TownHall — Migration 003: Listing Lifecycle
-- Run in Supabase SQL Editor → New Query
-- Safe to re-run: all DDL uses IF NOT EXISTS / OR REPLACE guards
-- ============================================================


-- ─── 1. Add expires_at + warned_at to properties ────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warned_at   TIMESTAMPTZ;   -- set when 7-day warning email is queued

-- Index for the two cron queries
CREATE INDEX IF NOT EXISTS idx_properties_expires_at
  ON properties (expires_at ASC)
  WHERE status IN ('active', 'expired');


-- ─── 2. Trigger: set expires_at on INSERT ────────────────────
-- Free listings get 30 days. Paid plans override this value when
-- the verify-payment Edge Function activates the listing, so the
-- default is only a safety net for listings that skip payment.

CREATE OR REPLACE FUNCTION public.set_listing_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_listing_expires_at ON properties;
CREATE TRIGGER trg_set_listing_expires_at
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_listing_expires_at();


-- ─── 3. Function: expire_stale_listings ──────────────────────
-- Marks overdue active listings as expired + writes one email per
-- owner into email_queue (picked up by process-email-queue cron).
-- Called nightly at 00:00 IST (18:30 UTC) by the run-expiry-job
-- Edge Function.

CREATE OR REPLACE FUNCTION public.expire_stale_listings(
  p_site_url    TEXT DEFAULT 'https://townhall.vercel.app',
  p_from_email  TEXT DEFAULT 'onboarding@resend.dev'
)
RETURNS INTEGER    -- number of listings expired this run
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  INTEGER := 0;
  v_rec    RECORD;
BEGIN
  -- 1. Lock and update expired listings, collect owner info in one pass
  FOR v_rec IN
    UPDATE properties
    SET    status = 'expired'
    WHERE  status = 'active'
      AND  expires_at < now()
    RETURNING id, title, owner_id, expires_at
  LOOP
    v_count := v_count + 1;

    -- 2. Enqueue expiry notification email for each affected owner
    --    owner email is resolved by process-email-queue via auth.admin.getUserById,
    --    so we store owner_id in metadata and look it up at send-time.
    --    Here we write a placeholder to_email that will be replaced by the processor.
    --    However, to avoid a second admin lookup in the processor we use a simpler
    --    approach: look up the email now using the auth schema (accessible via SECURITY DEFINER).
    DECLARE
      v_owner_email TEXT;
    BEGIN
      SELECT email INTO v_owner_email FROM auth.users WHERE id = v_rec.owner_id;
    EXCEPTION WHEN OTHERS THEN
      v_owner_email := NULL;
    END;

    IF v_owner_email IS NOT NULL THEN
      INSERT INTO email_queue (
        to_email, from_email, subject, html_body, metadata
      ) VALUES (
        v_owner_email,
        p_from_email,
        'Your TownHall listing has expired — renew now',
        format(
          '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111827;">'
          '<h2 style="color:#dc2626;margin-bottom:4px;">Your listing has expired</h2>'
          '<p style="color:#6b7280;margin-top:4px;">Your listing <strong>%s</strong> expired on %s and is no longer visible to tenants.</p>'
          '<p style="color:#374151;margin-top:12px;">Renew it now to make it active again and reach thousands of tenants.</p>'
          '<a href="%s/payment/%s" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-top:16px;">Renew Listing →</a>'
          '<p style="color:#9ca3af;font-size:12px;margin-top:24px;">TownHall — No Broker Fees, Direct Owner Contact.</p>'
          '</div>',
          v_rec.title,
          to_char(v_rec.expires_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
          p_site_url,
          v_rec.id::TEXT
        ),
        jsonb_build_object(
          'type',        'listing_expired',
          'property_id', v_rec.id,
          'owner_id',    v_rec.owner_id
        )
      );
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ─── 4. Function: warn_expiring_listings ─────────────────────
-- Queues a 7-day warning email for listings that will expire within
-- 7 days and have NOT already been warned.
-- Called daily at noon IST (06:30 UTC) by the run-warning-job
-- Edge Function.

CREATE OR REPLACE FUNCTION public.warn_expiring_listings(
  p_site_url    TEXT DEFAULT 'https://townhall.vercel.app',
  p_from_email  TEXT DEFAULT 'onboarding@resend.dev'
)
RETURNS INTEGER    -- number of warnings queued this run
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  INTEGER := 0;
  v_rec    RECORD;
BEGIN
  FOR v_rec IN
    UPDATE properties
    SET    warned_at = now()
    WHERE  status     = 'active'
      AND  expires_at BETWEEN now() AND now() + INTERVAL '7 days'
      AND  warned_at  IS NULL   -- only warn once
    RETURNING id, title, owner_id, expires_at
  LOOP
    v_count := v_count + 1;

    DECLARE
      v_owner_email TEXT;
      v_days_left   INTEGER;
    BEGIN
      SELECT email INTO v_owner_email FROM auth.users WHERE id = v_rec.owner_id;
      v_days_left := GREATEST(
        1,
        EXTRACT(DAY FROM (v_rec.expires_at - now()))::INTEGER
      );
    EXCEPTION WHEN OTHERS THEN
      v_owner_email := NULL;
      v_days_left   := 0;
    END;

    IF v_owner_email IS NOT NULL THEN
      INSERT INTO email_queue (
        to_email, from_email, subject, html_body, metadata
      ) VALUES (
        v_owner_email,
        p_from_email,
        format('Your TownHall listing expires in %s day(s) — renew now', v_days_left),
        format(
          '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111827;">'
          '<h2 style="color:#d97706;margin-bottom:4px;">Your listing expires soon</h2>'
          '<p style="color:#6b7280;margin-top:4px;">Your listing <strong>%s</strong> will expire in <strong>%s day(s)</strong> on %s.</p>'
          '<p style="color:#374151;margin-top:12px;">Renew before it expires to avoid any downtime in visibility.</p>'
          '<div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">'
          '<a href="%s/payment/%s" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Renew Now →</a>'
          '<a href="%s/dashboard" style="display:inline-block;background:#f3f4f6;color:#374151;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View Dashboard</a>'
          '</div>'
          '<p style="color:#9ca3af;font-size:12px;margin-top:24px;">TownHall — No Broker Fees, Direct Owner Contact.</p>'
          '</div>',
          v_rec.title,
          v_days_left,
          to_char(v_rec.expires_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
          p_site_url,
          v_rec.id::TEXT,
          p_site_url
        ),
        jsonb_build_object(
          'type',        'listing_expiry_warning',
          'property_id', v_rec.id,
          'owner_id',    v_rec.owner_id,
          'days_left',   v_days_left
        )
      );
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ─── 5. pg_cron setup ─────────────────────────────────────────
-- Prerequisites (run once in Dashboard → Database → Extensions):
--   pg_cron, pg_net
-- 
-- Add these secrets to BOTH run-expiry-job and run-warning-job:
--   CRON_SECRET  (same value as used for process-email-queue)
--   SITE_URL
--   RESEND_FROM_EMAIL
--
-- Store in the database so the SQL jobs can read it:
--   ALTER DATABASE postgres SET "app.settings.cron_secret" = 'paste-secret-here';
--
-- Replace YOUR_PROJECT_REF in all URLs below, then run each block:

-- ── Nightly expiry job (00:30 IST = 19:00 UTC) ──
-- SELECT cron.schedule(
--   'run-expiry-job',
--   '0 19 * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-expiry-job',
--       headers := jsonb_build_object(
--                    'Content-Type', 'application/json',
--                    'x-cron-secret', current_setting('app.settings.cron_secret')
--                  ),
--       body    := '{}' ::jsonb
--     );
--   $$
-- );

-- ── Daily 7-day warning job (noon IST = 06:30 UTC) ──
-- SELECT cron.schedule(
--   'run-warning-job',
--   '30 6 * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-warning-job',
--       headers := jsonb_build_object(
--                    'Content-Type', 'application/json',
--                    'x-cron-secret', current_setting('app.settings.cron_secret')
--                  ),
--       body    := '{}' ::jsonb
--     );
--   $$
-- );

-- ── Useful queries ──
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--   SELECT cron.unschedule('run-expiry-job');
--   SELECT cron.unschedule('run-warning-job');
--   -- Simulate expiry job manually (bypass cron):
--   SELECT expire_stale_listings();
--   SELECT warn_expiring_listings();
--   -- Check queue health:
--   SELECT status, count(*) FROM email_queue GROUP BY status;
