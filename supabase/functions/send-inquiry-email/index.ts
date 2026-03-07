// Supabase Edge Function: send-inquiry-email
// Saves inquiry to DB and sends an email to the property owner via Resend.
// POST  { property_id: string, message: string }
//
// IMPORTANT: Deploy with "Verify JWT" DISABLED.
// Auth is handled manually below (ES256 JWT support).

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY        = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY           = Deno.env.get('RESEND_API_KEY') ?? ''
// Set this to your production domain in Supabase secrets, e.g. https://townhall.vercel.app
const SITE_URL                 = Deno.env.get('SITE_URL') ?? 'https://townhall.vercel.app'
// Verified Resend sender — must match a domain you have verified in Resend dashboard
const FROM_EMAIL               = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Manual auth check ───────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Validate inputs ─────────────────────────────────────
    const body        = await req.json().catch(() => ({}))
    const property_id = body?.property_id
    const message     = body?.message

    if (!property_id || !UUID_RE.test(property_id)) {
      return new Response(
        JSON.stringify({ error: 'property_id must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'message must be at least 5 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (message.length > 500) {
      return new Response(
        JSON.stringify({ error: 'message must be at most 500 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const tenantName  = user.user_metadata?.full_name ?? user.user_metadata?.name ?? 'A tenant'
    const tenantEmail = user.email ?? ''

    // ── 3. Insert inquiry (service role bypasses RLS cleanly server-side) ──
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: inquiry, error: insertError } = await serviceClient
      .from('inquiries')
      .insert({
        property_id,
        tenant_id:    user.id,
        message:      message.trim(),
        tenant_name:  tenantName,
        tenant_email: tenantEmail,
        status:       'pending',
      })
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save inquiry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 4. Get property + owner details ─────────────────────────
    const { data: property } = await serviceClient
      .from('properties')
      .select('title, location, owner_id, owner_name')
      .eq('id', property_id)
      .single()

    // ── 5. Get owner email (requires service role admin API) ────
    let ownerEmail: string | null = null
    if (property?.owner_id) {
      const { data: ownerData } = await serviceClient.auth.admin.getUserById(property.owner_id)
      ownerEmail = ownerData?.user?.email ?? null
    }

    // ── 6. Send email via Resend (failure must NOT break inquiry save) ──
    if (RESEND_API_KEY && ownerEmail) {
      const propertyUrl = `${SITE_URL}/property/${property_id}`
      const sanitised   = message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      [ownerEmail],
          subject: `New inquiry for "${property?.title ?? 'your property'}"`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111827;">
              <h2 style="color:#4f46e5;margin-bottom:4px;">New Inquiry — TownHall</h2>
              <p style="color:#6b7280;margin-top:4px;">Someone is interested in <strong>${property?.title ?? 'your listing'}</strong> at ${property?.location ?? ''}.</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="margin:0 0 6px;font-size:14px;"><strong>From:</strong> ${tenantName}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">${tenantEmail}</p>
                <p style="margin:0 0 6px;font-size:14px;"><strong>Message:</strong></p>
                <p style="margin:0;font-size:14px;line-height:1.6;">${sanitised}</p>
              </div>
              <a href="${propertyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View Listing →</a>
              <p style="color:#9ca3af;font-size:12px;margin-top:24px;">You received this because you have an active listing on TownHall. Reply directly to the tenant at ${tenantEmail}.</p>
            </div>
          `,
        }),
      }).catch(() => {
        // Email failure must never break the inquiry save — owner can still see it in dashboard
      })
    }

    return new Response(
      JSON.stringify({ data: { id: inquiry.id } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
