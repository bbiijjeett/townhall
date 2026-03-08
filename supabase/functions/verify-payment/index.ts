    // supabase/functions/verify-payment/index.ts
    // Verifies Razorpay HMAC signature and activates a property listing.
    // POST { razorpay_payment_id, razorpay_order_id, razorpay_signature, property_id, plan_type }
    // Returns { data: { ok: true } }

    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

    const PLAN_DURATION_DAYS: Record<string, number> = {
    featured: 30,
    premium:  60,
    };

    const PLAN_AMOUNT_INR: Record<string, number> = {
    featured: 199,
    premium:  499,
    };

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
        property_id: string;
        plan_type: string;
        };

        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, property_id, plan_type } = body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !property_id || !plan_type) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        }

        if (!PLAN_DURATION_DAYS[plan_type]) {
        return new Response(JSON.stringify({ error: 'Invalid plan_type' }), {
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

        // ── Activate listing (service role) ───────────────────────────────────────
        const serviceRole = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const durationDays = PLAN_DURATION_DAYS[plan_type];
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        // Verify user owns the property before activating
        const { data: prop, error: propError } = await serviceRole
        .from('properties')
        .select('id, owner_id')
        .eq('id', property_id)
        .single();

        if (propError || !prop || prop.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Property not found or access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        }

        // Update property
        const { error: updateError } = await serviceRole
        .from('properties')
        .update({
            plan_type,
            expires_at: expiresAt,
            payment_status: 'paid',
            status: 'active',
        })
        .eq('id', property_id);

        if (updateError) throw updateError;

        // Record in listing_plans (best-effort, non-fatal if table doesn't exist yet)
        await serviceRole.from('listing_plans').insert({
        property_id,
        owner_id: user.id,
        plan_type,
        amount_inr: PLAN_AMOUNT_INR[plan_type],
        razorpay_payment_id,
        razorpay_order_id,
        status: 'verified',
        duration_days: durationDays,
        expires_at: expiresAt,
        }).then(() => {}, () => {});

        return new Response(
        JSON.stringify({ data: { ok: true } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

    } catch (err) {
        console.error('verify-payment error:', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    });
