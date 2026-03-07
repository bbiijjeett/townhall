// Supabase Edge Function: process-email-queue
// Drains the email_queue table — sends pending emails via Resend, updates status.
// Called by pg_cron every 2 minutes via pg_net.http_post.
//
// IMPORTANT: Deploy with "Verify JWT" DISABLED.
// Protected by x-cron-secret header (set CRON_SECRET in Edge Function secrets).
//
// Required secrets:
//   CRON_SECRET              — shared with pg_cron via app.settings.cron_secret DB param
//   RESEND_API_KEY           — Resend API key
//   SUPABASE_SERVICE_ROLE_KEY — auto-available in Edge Functions

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY            = Deno.env.get('RESEND_API_KEY')    ?? ''
const CRON_SECRET               = Deno.env.get('CRON_SECRET')       ?? ''

const BATCH_SIZE = 10

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'x-cron-secret, content-type' },
    })
  }

  // ── Auth: x-cron-secret header (set by pg_cron via current_setting) ────────
  if (!CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'CRON_SECRET not configured on this function' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY is not configured' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── Dequeue batch (atomic, SKIP LOCKED — safe for concurrent invocations) ──
  const { data: emails, error: dequeueError } = await db.rpc('dequeue_emails', {
    p_batch_size: BATCH_SIZE,
  })

  if (dequeueError) {
    return new Response(
      JSON.stringify({ error: 'Failed to dequeue', detail: dequeueError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!emails || emails.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let sent     = 0
  let failed   = 0
  let retrying = 0

  for (const email of emails) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    email.from_email,
          to:      [email.to_email],
          subject: email.subject,
          html:    email.html_body,
        }),
      })

      if (res.ok) {
        await db
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', email.id)
        sent++
      } else {
        // email.attempts was already incremented by dequeue_emails
        const errBody  = await res.text().catch(() => `HTTP ${res.status}`)
        const isFinal  = email.attempts >= email.max_attempts
        await db
          .from('email_queue')
          .update({ status: isFinal ? 'failed' : 'pending', last_error: errBody.slice(0, 500) })
          .eq('id', email.id)
        isFinal ? failed++ : retrying++
      }
    } catch (err) {
      const errMsg   = (err instanceof Error ? err.message : String(err)).slice(0, 500)
      const isFinal  = email.attempts >= email.max_attempts
      await db
        .from('email_queue')
        .update({ status: isFinal ? 'failed' : 'pending', last_error: errMsg })
        .eq('id', email.id)
      isFinal ? failed++ : retrying++
    }
  }

  return new Response(
    JSON.stringify({ processed: emails.length, sent, failed, retrying }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
