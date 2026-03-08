// Supabase Edge Function: run-expiry-job
// Called nightly at 00:30 IST (19:00 UTC) via pg_cron + pg_net.
//
// What it does:
//   1. Calls expire_stale_listings() — marks overdue listings as 'expired'
//      and writes owner notification emails into email_queue.
//   2. Calls process-email-queue by delegating to its logic inline so we
//      don't need an extra hop (or just let the separate cron handle it).
//
// IMPORTANT: Deploy with "Verify JWT" DISABLED.
// Protected by x-cron-secret header (same secret as process-email-queue).
//
// Required secrets:
//   CRON_SECRET              — shared with pg_cron via app.settings.cron_secret
//   SUPABASE_SERVICE_ROLE_KEY — auto-available in Edge Functions
//   SITE_URL                 — e.g. https://townhall.vercel.app
//   RESEND_FROM_EMAIL        — e.g. onboarding@resend.dev

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET               = Deno.env.get('CRON_SECRET')        ?? ''
const SITE_URL                  = Deno.env.get('SITE_URL')            ?? 'https://townhall.vercel.app'
const FROM_EMAIL                = Deno.env.get('RESEND_FROM_EMAIL')   ?? 'onboarding@resend.dev'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'x-cron-secret, content-type' },
    })
  }

  if (!CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── 1. Expire stale listings + enqueue notification emails ──
  const { data: expiredCount, error: expireError } = await db.rpc(
    'expire_stale_listings',
    { p_site_url: SITE_URL, p_from_email: FROM_EMAIL },
  )

  if (expireError) {
    return new Response(
      JSON.stringify({ error: 'expire_stale_listings failed', detail: expireError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ ok: true, expired: expiredCount ?? 0 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
