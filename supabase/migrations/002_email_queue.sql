-- Migration 002: Async email queue
-- Run in Supabase SQL Editor → New Query

-- ── Table ─────────────────────────────────────────────────────────────────────
-- Replaces direct Resend calls in Edge Functions.
-- send-inquiry-email INSERTs here; process-email-queue (cron) drains the queue.

CREATE TABLE IF NOT EXISTS email_queue (
  id           uuid        DEFAULT gen_random_uuid()  PRIMARY KEY,
  to_email     text        NOT NULL,
  subject      text        NOT NULL,
  html_body    text        NOT NULL,
  from_email   text        NOT NULL DEFAULT 'onboarding@resend.dev',
  status       text        NOT NULL DEFAULT 'pending'
               CONSTRAINT  email_queue_status_check
               CHECK       (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts     smallint    NOT NULL DEFAULT 0,
  max_attempts smallint    NOT NULL DEFAULT 3,
  last_error   text,
  -- Structured context for debugging (inquiry_id, property_id, tenant_id, etc.)
  metadata     jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);

-- Efficient scan for the processor: only rows that still need work
CREATE INDEX IF NOT EXISTS email_queue_processor_idx
  ON email_queue (created_at ASC)
  WHERE (status = 'pending' OR status = 'failed') AND attempts < 3;

-- Only the service role key can touch this table (no public policies)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;


-- ── Dequeue function ──────────────────────────────────────────────────────────
-- Atomically locks and marks a batch as 'sending', preventing two concurrent
-- cron invocations from processing the same row (FOR UPDATE SKIP LOCKED).
-- Returns the rows with attempts already incremented so callers know which
-- attempt this is without a separate read.

CREATE OR REPLACE FUNCTION dequeue_emails(p_batch_size int DEFAULT 10)
RETURNS SETOF email_queue
LANGUAGE sql
SECURITY DEFINER   -- runs as function owner so RLS is bypassed for service operations
AS $$
  UPDATE email_queue
  SET    status   = 'sending',
         attempts = attempts + 1
  WHERE  id IN (
    SELECT id
    FROM   email_queue
    WHERE  (status = 'pending' OR status = 'failed')
      AND  attempts < max_attempts
    ORDER  BY created_at
    LIMIT  p_batch_size
    FOR    UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;


-- ── pg_cron setup (run manually after deploying process-email-queue) ──────────
--
-- Step 1 — Enable extensions in Supabase Dashboard → Database → Extensions:
--          pg_cron   (schedules background jobs)
--          pg_net    (makes outbound HTTP calls from SQL)
--
-- Step 2 — Deploy process-email-queue with "Verify JWT" DISABLED.
--          Add these secrets in Dashboard → Edge Functions → process-email-queue → Secrets:
--            CRON_SECRET      = <any long random string, e.g. openssl rand -hex 32>
--            RESEND_API_KEY   = <your Resend key>
--
-- Step 3 — Store CRON_SECRET in the database (so pg_cron can read it at runtime):
--          Run in SQL Editor:
--
--   ALTER DATABASE postgres SET "app.settings.cron_secret" = 'paste-your-cron-secret-here';
--
-- Step 4 — Create the cron job (replace YOUR_PROJECT_REF):
--
-- SELECT cron.schedule(
--   'process-email-queue',
--   '*/2 * * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-email-queue',
--       headers := jsonb_build_object(
--                    'Content-Type', 'application/json',
--                    'x-cron-secret', current_setting('app.settings.cron_secret')
--                  ),
--       body    := '{}' ::jsonb
--     );
--   $$
-- );
--
-- Useful queries:
--   SELECT * FROM cron.job;                                     -- list jobs
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20; -- run history
--   SELECT cron.unschedule('process-email-queue');             -- remove job
--   SELECT * FROM email_queue ORDER BY created_at DESC;        -- audit log
--   SELECT status, count(*) FROM email_queue GROUP BY status;  -- queue health
