// Supabase Edge Function: sign-upload
// Generates a signed Cloudinary upload signature so the browser
// never needs the API Secret.
// POST  { folder: "townhall/<user_id>" }
// Returns { data: { signature, timestamp, api_key, cloud_name, folder } }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')!
const CLOUDINARY_API_KEY    = Deno.env.get('CLOUDINARY_API_KEY')!
const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')!

// Only folders matching this pattern are allowed (prevents path traversal)
const ALLOWED_FOLDER_RE = /^townhall\/[0-9a-f\-]{36}$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf  = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body   = await req.json().catch(() => ({}))
    const folder = body?.folder

    if (
      !folder ||
      typeof folder !== 'string' ||
      !ALLOWED_FOLDER_RE.test(folder)
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid folder parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const timestamp = Math.round(Date.now() / 1000)

    // Parameters must be sorted alphabetically before signing
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
    const signature    = await sha1Hex(paramsToSign)

    return new Response(
      JSON.stringify({
        data: {
          signature,
          timestamp,
          api_key:    CLOUDINARY_API_KEY,
          cloud_name: CLOUDINARY_CLOUD_NAME,
          folder,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
