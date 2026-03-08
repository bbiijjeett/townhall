// api/razorpay-webhook.ts — Vercel Serverless Function
// Fallback webhook handler in case the Razorpay Checkout callback is never fired
// (e.g. user closes the browser mid-payment after Razorpay captures the payment).
//
// Required Vercel environment variables:
//   RAZORPAY_WEBHOOK_SECRET   — set in Razorpay dashboard under Webhooks
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role secret key

import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Disable body parser so we can read the raw bytes for HMAC verification
export const config = {
  api: { bodyParser: false },
};

/** Read the raw request body as a Buffer. */
async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const PLAN_DURATION_DAYS: Record<string, number> = {
  featured: 30,
  premium:  60,
};
const PLAN_AMOUNT_INR: Record<string, number> = {
  featured: 199,
  premium:  499,
};
const CREDITS_AMOUNTS: Record<string, number> = {
  '10credits': 49,
  unlimited:   149,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const rawBody = await readRawBody(req);

  // ── HMAC verification ───────────────────────────────────────────────────────
  const receivedSig = (req.headers['x-razorpay-signature'] as string) ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Webhook secret not configured' }));
    return;
  }

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid signature' }));
    return;
  }

  const event = JSON.parse(rawBody.toString('utf8')) as {
    event: string;
    payload: {
      payment: {
        entity: {
          id: string;
          order_id: string;
          notes: Record<string, string>;
        };
      };
    };
  };

  // Only act on captured payments
  if (event.event !== 'payment.captured') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, skipped: true }));
    return;
  }

  const payment = event.payload.payment.entity;
  const notes   = payment.notes ?? {};

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── Listing plan activation ─────────────────────────────────────────────────
  if (notes.property_id && notes.plan_type && PLAN_DURATION_DAYS[notes.plan_type]) {
    const { property_id, plan_type } = notes;
    const durationDays = PLAN_DURATION_DAYS[plan_type];
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('properties')
      .update({
        plan_type,
        expires_at: expiresAt,
        payment_status: 'paid',
        status: 'active',
      })
      .eq('id', property_id)
      .neq('status', 'active'); // idempotent — skip if already active

    if (updateError) {
      console.error('Webhook property update error:', updateError);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database update failed' }));
      return;
    }

    // Record payment in listing_plans (best-effort)
    await supabase.from('listing_plans').insert({
      property_id,
      owner_id: notes.user_id ?? null,
      plan_type,
      amount_inr: PLAN_AMOUNT_INR[plan_type],
      razorpay_payment_id: payment.id,
      razorpay_order_id: payment.order_id,
      status: 'verified',
      duration_days: durationDays,
      expires_at: expiresAt,
    }).then(() => {}, (err) => console.warn('listing_plans insert skipped:', err));
  }

  // ── Credits purchase activation ─────────────────────────────────────────────
  if (notes.pack && notes.user_id && CREDITS_AMOUNTS[notes.pack]) {
    const { user_id, pack } = notes;

    if (pack === '10credits') {
      // Fetch + update (webhook is single-delivery, so non-atomic is acceptable here)
      const { data: profile } = await supabase
        .from('profiles')
        .select('reveal_credits')
        .eq('id', user_id)
        .single();

      const newCredits = (profile?.reveal_credits ?? 0) + 10;
      await supabase
        .from('profiles')
        .update({ reveal_credits: newCredits })
        .eq('id', user_id);
    } else if (pack === 'unlimited') {
      await supabase
        .from('profiles')
        .update({ reveal_unlimited: true })
        .eq('id', user_id);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}
