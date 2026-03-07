// Supabase Edge Function: increment-view
// Rate-limits view-count increments to once per IP per property per 24 hours
// using Upstash Redis.  Falls back gracefully if Redis is unavailable.
// POST { property_id: "<uuid>" }
//
// IMPORTANT: Deploy with "Verify JWT" DISABLED in the Dashboard.
// This function is intentionally public — unauthenticated visitors should
// also increment view counts.

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UPSTASH_REDIS_REST_URL   = Deno.env.get('UPSTASH_REDIS_REST_URL')   ?? ''
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? ''
const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body        = await req.json().catch(() => ({}))
    const property_id = body?.property_id

    if (!property_id || !UUID_RE.test(property_id)) {
      return new Response(
        JSON.stringify({ error: 'property_id must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Determine client IP (Cloudflare → Nginx → proxy chain → unknown)
    const ip =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-real-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'

    // ── Rate-limit via Upstash Redis ────────────────────────────
    let alreadyCounted = false

    if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
      const redisKey = `view:${property_id}:${ip}`

      // SET key 1 NX EX 86400 — only sets if the key does not exist (24 h TTL)
      const redisRes = await fetch(
        `${UPSTASH_REDIS_REST_URL}/SET/${encodeURIComponent(redisKey)}/1/NX/EX/86400`,
        { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } },
      ).catch(() => null)

      if (redisRes?.ok) {
        const { result } = await redisRes.json().catch(() => ({}))
        if (result !== 'OK') {
          // Key already existed → this IP has viewed this property in past 24 h
          alreadyCounted = true
        }
      }
      // If Redis is unreachable we fall through and still increment — better
      // to over-count slightly than to silently drop real views.
    }

    if (alreadyCounted) {
      return new Response(
        JSON.stringify({ data: { incremented: false } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Increment in Postgres ───────────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await supabase.rpc('increment_property_view', { property_id })
    if (error) throw error

    return new Response(
      JSON.stringify({ data: { incremented: true } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
