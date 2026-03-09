// Supabase Edge Function: submit-listing-report
// Validates input, rate-limits per user+property (7-day Redis key), then
// inserts a row into listing_reports.
// POST { property_id: "<uuid>", reason: "<reason>", description?: "<text>" }
// Requires a valid user JWT (Verify JWT: ENABLED in dashboard).

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UPSTASH_REDIS_REST_URL    = Deno.env.get('UPSTASH_REDIS_REST_URL')    ?? ''
const UPSTASH_REDIS_REST_TOKEN  = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')  ?? ''
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const UUID_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_REASONS = new Set(['fake', 'duplicate', 'wrong_price', 'offensive', 'other'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── Auth — require a valid session ──────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return new Response(
      JSON.stringify({ error: 'Unauthenticated' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Use anon-key client to verify the user JWT
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthenticated' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // ── Parse + validate body ────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { property_id, reason, description } = body

  if (typeof property_id !== 'string' || !UUID_RE.test(property_id)) {
    return new Response(
      JSON.stringify({ error: 'property_id must be a valid UUID' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  if (typeof reason !== 'string' || !VALID_REASONS.has(reason)) {
    return new Response(
      JSON.stringify({ error: 'reason must be one of: fake, duplicate, wrong_price, offensive, other' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.length > 300) {
      return new Response(
        JSON.stringify({ error: 'description must be a string ≤ 300 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  // ── Rate-limit via Upstash Redis (7 days per user+property) ──────────────────
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    const redisKey = `report:${property_id}:${user.id}`
    const SEVEN_DAYS = 7 * 24 * 60 * 60

    const redisRes = await fetch(
      `${UPSTASH_REDIS_REST_URL}/SET/${encodeURIComponent(redisKey)}/1/NX/EX/${SEVEN_DAYS}`,
      { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } },
    ).catch(() => null)

    if (redisRes?.ok) {
      const { result } = await redisRes.json().catch(() => ({}))
      if (result !== 'OK') {
        // Key already existed — duplicate report within 7 days
        return new Response(
          JSON.stringify({ error: 'already reported' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }
    // If Redis is unreachable, allow the report through (fail open)
  }

  // ── Insert report ─────────────────────────────────────────────────────────────
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error: insertError } = await adminClient
    .from('listing_reports')
    .insert({
      property_id,
      reporter_id: user.id,
      reason,
      description: description ?? null,
    })

  if (insertError) {
    return new Response(
      JSON.stringify({ error: 'Failed to submit report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ data: { submitted: true } }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
