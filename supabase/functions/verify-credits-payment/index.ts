// supabase/functions/verify-credits-payment/index.ts
// Verifies Razorpay HMAC and credits the user's reveal quota.
// POST { razorpay_payment_id, razorpay_order_id, razorpay_signature, pack: '10credits' | 'unlimited' }
// Returns { data: { ok: true, reveal_credits: number, reveal_unlimited: boolean } }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyHmac(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = encoder.encode(`${orderId}|${paymentId}`);
  const hashBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = await req.json() as {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
      pack: string;
    };

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, pack } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !pack) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pack !== '10credits' && pack !== 'unlimited') {
      return new Response(JSON.stringify({ error: 'Invalid pack' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── HMAC verification ─────────────────────────────────────────────────────
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const valid = await verifyHmac(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid payment signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Update profile (service role) ─────────────────────────────────────────
    const serviceRole = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // increment_reveal_credits is an atomic SQL function defined in migration 004
    // For the unlimited pack it ignores p_amount and sets reveal_unlimited = true instead
    const { data: updatedProfile, error: updateError } = await serviceRole.rpc(
      'apply_credits_purchase',
      { p_user_id: user.id, p_pack: pack },
    );

    if (updateError) throw updateError;

    const profile = updatedProfile as { reveal_credits: number; reveal_unlimited: boolean } | null;

    return new Response(
      JSON.stringify({
        data: {
          ok: true,
          reveal_credits: profile?.reveal_credits ?? 0,
          reveal_unlimited: profile?.reveal_unlimited ?? false,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('verify-credits-payment error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
