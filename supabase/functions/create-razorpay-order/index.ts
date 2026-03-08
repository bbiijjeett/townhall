// supabase/functions/create-razorpay-order/index.ts
// Creates a Razorpay order server-side so the amount is never trusted from the client.
// POST { type: 'listing', property_id: UUID, plan_type: 'featured' | 'premium' }
//   OR { type: 'credits', pack: '10credits' | 'unlimited' }
// Returns { data: { order_id, amount_paise, key_id, currency } }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Amount table (paise = rupees × 100)
const LISTING_AMOUNTS: Record<string, number> = {
  featured: 19900,  // ₹199
  premium:  49900,  // ₹499
};
const CREDITS_AMOUNTS: Record<string, number> = {
  '10credits': 4900,   // ₹49
  unlimited:   14900,  // ₹149
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      type: 'listing' | 'credits';
      property_id?: string;
      plan_type?: string;
      pack?: string;
    };

    let amount_paise: number;
    let receipt: string;
    const notes: Record<string, string> = { user_id: user.id };

    if (body.type === 'listing') {
      const planType = body.plan_type ?? '';
      if (!LISTING_AMOUNTS[planType]) {
        return new Response(JSON.stringify({ error: 'Invalid plan_type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!body.property_id) {
        return new Response(JSON.stringify({ error: 'property_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the user owns this property
      const { data: prop, error: propError } = await supabaseClient
        .from('properties')
        .select('id, owner_id')
        .eq('id', body.property_id)
        .single();

      if (propError || !prop || prop.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Property not found or access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      amount_paise = LISTING_AMOUNTS[planType];
      receipt = `listing_${body.property_id}_${Date.now()}`;
      notes.property_id = body.property_id;
      notes.plan_type = planType;

    } else if (body.type === 'credits') {
      const pack = body.pack ?? '';
      if (!CREDITS_AMOUNTS[pack]) {
        return new Response(JSON.stringify({ error: 'Invalid pack' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      amount_paise = CREDITS_AMOUNTS[pack];
      receipt = `credits_${user.id}_${Date.now()}`;
      notes.pack = pack;

    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Razorpay order creation ───────────────────────────────────────────────
    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const basicAuth = btoa(`${keyId}:${keySecret}`);

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount_paise,
        currency: 'INR',
        receipt,
        notes,
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      console.error('Razorpay order error:', errBody);
      return new Response(JSON.stringify({ error: 'Payment provider error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order = await rzpRes.json() as { id: string; amount: number; currency: string };

    return new Response(
      JSON.stringify({
        data: {
          order_id: order.id,
          amount_paise: order.amount,
          key_id: keyId,
          currency: order.currency,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('create-razorpay-order error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
