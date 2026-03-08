# TownHall — Complete End-to-End Deployment Guide

> This guide covers every external service, environment variable, database migration, and Edge Function needed to run TownHall in production. Follow the sections in order — later sections depend on earlier ones.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites — Accounts to Create](#2-prerequisites--accounts-to-create)
3. [Local Development Setup](#3-local-development-setup)
4. [Supabase Setup](#4-supabase-setup)
   - 4.1 Create Project
   - 4.2 Google OAuth
   - 4.3 Run Database Migrations (in order)
   - 4.4 Deploy Edge Functions
   - 4.5 Configure Edge Function Secrets
   - 4.6 Set Up pg_cron Jobs
5. [Cloudinary Setup](#5-cloudinary-setup)
6. [Resend (Email) Setup](#6-resend-email-setup)
7. [Upstash Redis Setup](#7-upstash-redis-setup)
8. [Razorpay Setup](#8-razorpay-setup)
9. [Vercel Deployment](#9-vercel-deployment)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Post-Deployment Verification Checklist](#11-post-deployment-verification-checklist)
12. [Common Issues & Fixes](#12-common-issues--fixes)

---

## 1. Architecture Overview

```
Browser (React + Vite)
  │
  ├── Supabase Auth (Google OAuth)
  ├── Supabase DB (PostgreSQL + RLS)
  │     └── RPC functions (reveal_owner_phone, apply_credits_purchase, ...)
  │
  ├── Supabase Edge Functions (Deno, deployed to Supabase)
  │     ├── sign-upload          → signs Cloudinary upload requests
  │     ├── increment-view       → rate-limited view counting (Upstash Redis)
  │     ├── send-inquiry-email   → writes to email_queue table
  │     ├── process-email-queue  → cron drain → Resend API
  │     ├── create-razorpay-order→ creates Razorpay order server-side
  │     ├── verify-payment       → HMAC verify + activate listing
  │     ├── verify-credits-payment→ HMAC verify + credit profile
  │     ├── run-expiry-job       → nightly cron → expire_stale_listings()
  │     └── run-warning-job      → daily cron  → warn_expiring_listings()
  │
  ├── Vercel Serverless (api/)
  │     └── razorpay-webhook.ts  → payment.captured fallback handler
  │
  ├── Cloudinary (image storage + CDN)
  └── Razorpay (payments — Indian INR)
```

**Data flow for a payment:**
1. User picks a plan → browser calls `create-razorpay-order` Edge Function
2. Edge Function creates order on Razorpay servers, returns `order_id`
3. Razorpay Checkout JS opens in the browser
4. User pays → browser receives `{payment_id, order_id, signature}`
5. Browser calls `verify-payment` Edge Function with all three values
6. Edge Function verifies HMAC signature, then updates the DB using the service role key
7. As a safety net, Razorpay also fires `payment.captured` webhook → `/api/razorpay-webhook`

---

## 2. Prerequisites — Accounts to Create

| Service | Free Tier | URL |
|---|---|---|
| Supabase | Yes | https://supabase.com |
| Cloudinary | Yes (25 GB) | https://cloudinary.com |
| Resend | Yes (3,000 emails/month) | https://resend.com |
| Upstash | Yes (10,000 req/day) | https://upstash.com |
| Razorpay | Test mode free | https://razorpay.com |
| Vercel | Yes | https://vercel.com |

---

## 3. Local Development Setup

### 3.1 Clone and install

```bash
git clone <your-repo-url>
cd TownHall
npm install
```

### 3.2 Create `.env` file

```bash
cp .env.example .env   # if it exists, otherwise create manually
```

Paste the following into `.env`:

```env
# ── Supabase ──────────────────────────────────────────────────
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# ── Cloudinary (public key only — anon upload URL is signed server-side) ──
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name

# ── Razorpay (only the PUBLIC key goes in the browser bundle) ──
# The secret key NEVER goes here — it lives in Supabase Edge Function secrets only.
```

> **Security rule:** `VITE_*` variables are baked into the browser bundle. Never put any secret here. The Razorpay Key ID is a public identifier — safe. The Key Secret must never appear in `.env`.

### 3.3 Run the dev server

```bash
npm run dev
```

---

## 4. Supabase Setup

### 4.1 Create a New Supabase Project

1. Log in to [app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Choose your organisation, set a project name (e.g., `townhall`), and a strong database password — **save this password**
4. Select the region closest to your users (e.g., `ap-south-1` for India)
5. Wait ~2 minutes for provisioning

### 4.2 Google OAuth

1. Go to **Authentication → Providers → Google** — toggle it **Enabled**
2. You need a Google Cloud project. Go to [console.cloud.google.com](https://console.cloud.google.com)
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorised JavaScript origins:
   ```
   http://localhost:5173
   https://YOUR_VERCEL_DOMAIN.vercel.app
   ```
6. Authorised redirect URIs:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
7. Copy **Client ID** and **Client Secret** back into the Supabase Google provider form
8. Save

### 4.3 Run Database Migrations (in order)

Go to **Supabase Dashboard → SQL Editor → New Query** and run each file below in order. **Do not skip any.**

#### Step 1 — Base schema (if starting fresh)

Run the contents of `supabase-schema.sql`. This creates the `properties` table with its base columns, RLS policies, and indexes.

> **If you already have a `properties` table,** skip this step and go straight to the migrations.

#### Step 2 — Migration 001: Production Foundation

Run `supabase/migrations/001_production_foundation.sql`

This adds:
- `plan_type` column to `properties`
- `profiles` table with auto-creation trigger
- `inquiries`, `contact_reveals`, `saved_properties`, `listing_plans`, `tenant_alerts`, `listing_reports` tables
- `reveal_owner_phone()` RPC (enforces 3-reveal monthly quota)
- Full-text search `location_tsv` column

#### Step 3 — Migration 002: Email Queue

Run `supabase/migrations/002_email_queue.sql`

This adds:
- `email_queue` table (async email pattern — avoids blocking API responses)
- `dequeue_emails()` RPC (atomic SKIP LOCKED drain)

#### Step 4 — Migration 003: Listing Lifecycle

Run `supabase/migrations/003_listing_lifecycle.sql`

This adds:
- `expires_at` and `warned_at` columns to `properties`
- `set_listing_expires_at()` trigger (auto-sets 30-day expiry on INSERT)
- `expire_stale_listings()` function (called by nightly cron)
- `warn_expiring_listings()` function (called by daily cron)

#### Step 5 — Migration 004: Reveal Unlimited

Run `supabase/migrations/004_reveal_unlimited.sql`

This adds:
- `reveal_unlimited` column to `profiles`
- `apply_credits_purchase(user_id, pack)` RPC (atomic credits update)
- Updated `reveal_owner_phone()` that bypasses quota for unlimited users

#### Step 6 — view_count (from supabase-schema.sql)

Run the `MIGRATION: Add view_count` block at the bottom of `supabase-schema.sql`:

```sql
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_properties_view_count ON properties (view_count DESC);

CREATE OR REPLACE FUNCTION increment_property_view(property_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE properties SET view_count = view_count + 1 WHERE id = property_id;
END;
$$;
```

#### Step 7 — Enable pg_cron extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;
```

> If you get a permission error, go to **Database → Extensions** and enable `pg_cron` from the UI first, then re-run the GRANT.

### 4.4 Deploy Edge Functions

Install the Supabase CLI if you haven't:

```bash
npm install -g supabase
```

Log in and link your project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy all nine functions in one command:

```bash
supabase functions deploy sign-upload           --no-verify-jwt
supabase functions deploy increment-view        --no-verify-jwt
supabase functions deploy send-inquiry-email    --no-verify-jwt
supabase functions deploy process-email-queue   --no-verify-jwt
supabase functions deploy create-razorpay-order --no-verify-jwt
supabase functions deploy verify-payment        --no-verify-jwt
supabase functions deploy verify-credits-payment --no-verify-jwt
supabase functions deploy run-expiry-job        --no-verify-jwt
supabase functions deploy run-warning-job       --no-verify-jwt
```

> All functions use `--no-verify-jwt` because Supabase's hosted JWT verifier uses ES256 which the Deno runtime doesn't support cleanly. Each function performs its own manual auth check via `supabase.auth.getUser()`.

### 4.5 Configure Edge Function Secrets

Go to **Supabase Dashboard → Edge Functions → Configuration → Secrets** (or use the CLI).

#### Using the CLI (recommended for bulk entry):

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=eyJhbGci...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # Settings → API → service_role key
supabase secrets set CLOUDINARY_CLOUD_NAME=your_cloud_name
supabase secrets set CLOUDINARY_API_KEY=123456789012345
supabase secrets set CLOUDINARY_API_SECRET=aBcDeFgHiJ...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com
supabase secrets set SITE_URL=https://your-app.vercel.app
supabase secrets set UPSTASH_REDIS_REST_URL=https://...upstash.io
supabase secrets set UPSTASH_REDIS_REST_TOKEN=AXxx...
supabase secrets set RAZORPAY_KEY_ID=rzp_live_...
supabase secrets set RAZORPAY_KEY_SECRET=...
```

> `SUPABASE_URL` and `SUPABASE_ANON_KEY` are also automatically available as built-in env vars in Edge Functions — you do not strictly need to set them manually, but setting them explicitly avoids surprises.

#### Secret ownership per function:

| Secret | Functions that use it |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `verify-payment`, `verify-credits-payment`, `increment-view`, `process-email-queue`, `run-expiry-job`, `run-warning-job` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | `sign-upload` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | `process-email-queue` |
| `SITE_URL` | `run-expiry-job`, `run-warning-job`, `process-email-queue` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | `increment-view` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `create-razorpay-order`, `verify-payment`, `verify-credits-payment` |

### 4.6 Set Up pg_cron Jobs

Go to **SQL Editor** in your Supabase dashboard and run:

```sql
-- ── Job 1: Expire stale listings every night at 00:00 IST (18:30 UTC) ──
SELECT cron.schedule(
  'expire-stale-listings',
  '30 18 * * *',
  $$
  SELECT net.http_post(
    url    := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/run-expiry-job',
    body   := '{}',
    headers:= '{"Content-Type":"application/json"}'::jsonb
  );
  $$
);

-- ── Job 2: Send 7-day expiry warnings every morning at 06:30 UTC ──
SELECT cron.schedule(
  'warn-expiring-listings',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url    := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/run-warning-job',
    body   := '{}',
    headers:= '{"Content-Type":"application/json"}'::jsonb
  );
  $$
);

-- ── Job 3: Process email queue every 2 minutes ──
SELECT cron.schedule(
  'process-email-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url    := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-email-queue',
    body   := '{}',
    headers:= '{"Content-Type":"application/json"}'::jsonb
  );
  $$
);
```

> **Alternative simpler approach:** If `vault.decrypted_secrets` isn't available, hardcode the function URL directly:
> ```sql
> SELECT cron.schedule('expire-stale-listings', '30 18 * * *',
>   $$ SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-expiry-job', body := '{}', headers := '{"Content-Type":"application/json"}'::jsonb); $$
> );
> ```

Verify the jobs were created:

```sql
SELECT jobname, schedule, active FROM cron.job;
```

---

## 5. Cloudinary Setup

1. Sign up / log in at [cloudinary.com](https://cloudinary.com)
2. Dashboard → copy your **Cloud Name** (shown at top, e.g., `dxyz123abc`)
3. **Settings → Access Keys** → copy **API Key** and **API Secret**
4. Add to Supabase secrets:
   ```bash
   supabase secrets set CLOUDINARY_CLOUD_NAME=dxyz123abc
   supabase secrets set CLOUDINARY_API_KEY=123456789012345
   supabase secrets set CLOUDINARY_API_SECRET=aBcDeFgHiJkLmNoPqRsT
   ```
5. Add Cloud Name to your `.env`:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=dxyz123abc
   ```

> The API Secret never touches the browser — it's only used by the `sign-upload` Edge Function.

### Recommended Cloudinary settings

Go to **Settings → Upload → Upload presets** and confirm you do **not** need an unsigned preset anymore — all uploads are now signed server-side via `sign-upload`.

---

## 6. Resend (Email) Setup

1. Sign up / log in at [resend.com](https://resend.com)
2. **API Keys → Create API Key** → name it `townhall-production` → copy the key (starts with `re_`)
3. **Domains → Add Domain** → verify your sending domain (e.g., `mail.townhall.app`)
   - If you don't have a custom domain yet, use `onboarding@resend.dev` as a temporary sender during development
4. Add to Supabase secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com
   ```

---

## 7. Upstash Redis Setup

Used by `increment-view` to rate-limit view counting (one increment per property per IP per 24 hours).

1. Sign up / log in at [console.upstash.com](https://console.upstash.com)
2. **Create Database** → type **Redis** → Region: choose closest to your Supabase region → name it `townhall-rate-limit`
3. After creation, open the database → copy:
   - **REST URL** (looks like `https://us1-xxx.upstash.io`)
   - **REST Token** (long base64 string)
4. Add to Supabase secrets:
   ```bash
   supabase secrets set UPSTASH_REDIS_REST_URL=https://us1-xxx.upstash.io
   supabase secrets set UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxx
   ```

---

## 8. Razorpay Setup

### 8.1 Get API keys

1. Sign up / log in at [razorpay.com](https://razorpay.com)
2. Go to **Settings → API Keys**
3. **Test mode** (for development): Generate test keys — both start with `rzp_test_`
4. **Live mode** (for production): Complete KYC, then generate live keys — both start with `rzp_live_`
5. Add to Supabase secrets:
   ```bash
   supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
   supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 8.2 Register the webhook

The webhook (`api/razorpay-webhook.ts`) is a Vercel serverless function that acts as a **safety net**. If a user pays but then closes the browser before the Razorpay Checkout callback fires, the listing would never get activated. Razorpay calls this webhook directly from their servers, so it always runs regardless of what the browser does.

**How it works:**
1. Razorpay fires a `POST` request to your webhook URL after every captured payment
2. The handler reads the raw request body and verifies the `x-razorpay-signature` header using HMAC-SHA256
3. If the signature is valid, it reads `payment.notes` (which contains `property_id`/`plan_type` or `user_id`/`credits_type`) and updates Supabase accordingly
4. The update is **idempotent** — if the listing was already activated by the browser callback, the webhook is a no-op

---

#### Step 1 — Generate a webhook secret

You need a strong random string. **Do not use a guessable value.**

**On Windows (PowerShell) — recommended:**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This uses Node.js (already installed for your project) and outputs a 64-character hex string like:
```
a3f8e2c1d94b7056e1a23f8d9c7b4e2a1f6d3c8b5e9a2d7f4c1e8b3a6d9f2c5
```

**Copy this value and save it somewhere safe** — you'll use it in both Razorpay Dashboard and Vercel.

Alternative PowerShell one-liner (no Node needed):
```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

---

#### Step 2 — Register the webhook in Razorpay Dashboard

1. Go to [razorpay.com](https://razorpay.com) → log in → **Settings → Webhooks**
2. Click **+ Add New Webhook**
3. Fill in the form:

   | Field | Value |
   |---|---|
   | **Webhook URL** | `https://townhall-five.vercel.app/api/razorpay-webhook` |
   | **Secret** | The 64-char hex string you generated in Step 1 |
   | **Alert Email** | Your email (to receive webhook failure notifications) |

4. Under **Active Events**, expand **Payment** and tick **`payment.captured`** only
   - Do **not** enable other events — the handler only processes `payment.captured` and will return `200 skipped` for everything else
5. Click **Save**

> **Test mode vs Live mode:** Webhooks are environment-specific. If you're testing with `rzp_test_` keys, register the webhook under the **Test** environment in the Razorpay dashboard. Switch to **Live** when you go live.

---

#### Step 3 — Add the secret to Vercel environment variables

The webhook secret must be in Vercel (not Supabase) because `api/razorpay-webhook.ts` runs as a Vercel serverless function, not a Supabase Edge Function.

1. Open your Vercel project → **Settings → Environment Variables**
2. Add these three variables (set scope to **Production**):

   | Variable | Value |
   |---|---|
   | `RAZORPAY_WEBHOOK_SECRET` | The 64-char hex string from Step 1 |
   | `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your `service_role` key (Supabase → Settings → API) |

3. Click **Save** for each variable

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are needed by the webhook handler to call Supabase with admin privileges and activate the listing or credit the user.

---

#### Step 4 — Redeploy Vercel

Environment variables don't apply retroactively. You must redeploy:

1. Vercel project → **Deployments** tab
2. Find the latest deployment → click **⋯** → **Redeploy**
3. Wait for the green "Ready" status

The `api/razorpay-webhook.ts` file is automatically served as a serverless function at `/api/razorpay-webhook` — no extra configuration in `vercel.json` is needed.

---

#### Step 5 — Test the webhook

**Option A — Razorpay Dashboard test ping:**
1. Go to **Settings → Webhooks** → find your webhook → click **Send Test Webhook**
2. Select event type `payment.captured`
3. Razorpay sends a dummy payload to your URL
4. You should see a `200 OK` response in the Razorpay webhook logs within a few seconds

> Note: The test ping uses a dummy signature with a dummy secret. It will fail HMAC verification and return `400 Invalid signature` — this is **expected and correct**. It confirms your endpoint is reachable.

**Option B — Real test payment:**
1. Switch Razorpay to test mode (`rzp_test_` keys) and ensure the test webhook is registered (see the note in Step 2)
2. Make a test payment through your app using one of Razorpay's [test card numbers](https://razorpay.com/docs/payments/payments/test-card-details/)
3. After payment, check the Razorpay webhook logs (Settings → Webhooks → your webhook → Logs tab) — you should see a delivery attempt with `200 OK`

---

#### Step 6 — Verify it worked in Supabase

After a successful test payment via webhook:

1. Go to **Supabase Dashboard → Table Editor → properties**
2. Find the property from the test payment
3. Confirm: `status = active`, `payment_status = paid`, `plan_type = featured` or `premium`, `expires_at` is set ~30 or 60 days out

For credits payments, check **Table Editor → profiles** and confirm `reveal_credits` or `reveal_unlimited` updated correctly.

---

#### How the raw body requirement works (technical note)

The function sets:
```typescript
export const config = { api: { bodyParser: false } };
```

This tells Vercel **not** to pre-parse the request body. If the body were parsed and re-serialised, the byte sequence would change and the HMAC would fail. The handler manually reads the raw bytes, runs HMAC-SHA256 over them, and only then parses the JSON. This is the correct and only way to verify Razorpay webhook signatures.

The webhook secret goes in **Vercel** (not Supabase), configured in the next section.

---

## 9. Vercel Deployment

### 9.1 Connect repository

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub / GitLab repository
3. Framework preset: **Vite** (auto-detected from `vercel.json`)
4. Build command: `vite build` (pre-set in `vercel.json`)
5. Output directory: `dist` (pre-set in `vercel.json`)
6. Click **Deploy** once — it will likely fail due to missing env vars. That's expected.

### 9.2 Add environment variables

In Vercel project → **Settings → Environment Variables**, add these for **Production** (and optionally Preview/Development):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your anon/public key |
| `VITE_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you set in Razorpay webhook config |
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your `service_role` key (from Supabase Settings → API) |

> Note: `VITE_*` variables are embedded in the browser bundle (React code). The non-prefixed variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_WEBHOOK_SECRET`) are only available to the Vercel serverless function in `api/razorpay-webhook.ts`.

### 9.3 Redeploy

After adding all env vars, go to **Deployments → Redeploy** (top deployment → ⋯ → Redeploy) to pick up the new variables.

### 9.4 Update Google OAuth redirect

Now that you have a Vercel domain, go back to:
- Google Cloud Console → OAuth credentials → add `https://your-app.vercel.app` to authorised origins
- Supabase → Authentication → URL Configuration → add `https://your-app.vercel.app` to **Redirect URLs**

---

## 10. Environment Variables Reference

### Browser (`.env` / Vercel `VITE_*`)

| Variable | Where it's used | How to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | All Supabase client calls | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | All Supabase client calls | Supabase Dashboard → Settings → API |
| `VITE_CLOUDINARY_CLOUD_NAME` | `sign-upload` calls from `AddPropertyPage` | Cloudinary Dashboard |

### Supabase Edge Function secrets

| Variable | Used by | How to get it |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `verify-payment`, `verify-credits-payment`, `increment-view`, `process-email-queue`, `run-expiry-job`, `run-warning-job` | Supabase → Settings → API → `service_role` |
| `CLOUDINARY_CLOUD_NAME` | `sign-upload` | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | `sign-upload` | Cloudinary → Settings → Access Keys |
| `CLOUDINARY_API_SECRET` | `sign-upload` | Cloudinary → Settings → Access Keys |
| `RESEND_API_KEY` | `process-email-queue` | Resend → API Keys |
| `RESEND_FROM_EMAIL` | `process-email-queue` | Your verified sender address |
| `SITE_URL` | `process-email-queue`, `run-expiry-job`, `run-warning-job` | Your production Vercel URL |
| `UPSTASH_REDIS_REST_URL` | `increment-view` | Upstash console → DB details |
| `UPSTASH_REDIS_REST_TOKEN` | `increment-view` | Upstash console → DB details |
| `RAZORPAY_KEY_ID` | `create-razorpay-order` | Razorpay → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | `create-razorpay-order`, `verify-payment`, `verify-credits-payment` | Razorpay → Settings → API Keys |

### Vercel serverless (`api/razorpay-webhook.ts`)

| Variable | Value |
|---|---|
| `RAZORPAY_WEBHOOK_SECRET` | The secret string you entered in Razorpay webhook config |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` secret key |

---

## 11. Post-Deployment Verification Checklist

Work through this list on your production URL after deploying.

### Auth
- [ ] Landing page loads with no console errors
- [ ] "Sign in with Google" opens the Google OAuth popup
- [ ] After sign-in, redirected to `/dashboard` or `/welcome` (first time)
- [ ] Onboarding flow completes (role → city → submit) and creates a `profiles` row
- [ ] Supabase: check `profiles` table for the new row

### Listing lifecycle
- [ ] Go to `/add-property` → complete the 6-step form → submit
- [ ] Confirm property appears in Supabase `properties` table with `status = 'pending'`
- [ ] Go to `/payment/{id}` → select **Free** plan → confirm `status` becomes `active`
- [ ] Go to `/payment/{id}` → select **Featured** → Razorpay Checkout window opens (test mode)
- [ ] Complete a test payment using card `4111 1111 1111 1111`, expiry any future date, CVV `123`
- [ ] Confirm `properties.plan_type = 'featured'`, `payment_status = 'paid'`, and a row exists in `listing_plans`
- [ ] Premium plan same test, confirm `expires_at` is ~60 days from now

### Image uploads
- [ ] Add property with at least 2 images — they should upload to Cloudinary
- [ ] Open Cloudinary → Media Library and verify the images appeared

### Phone reveal
- [ ] Browse to a property detail page as a **different** user (not the owner)
- [ ] Click **Show Phone Number** → phone appears (confirm `contact_reveals` row inserted)
- [ ] Repeat 2 more times → 3rd reveal succeeds
- [ ] 4th attempt → buy credits dialog appears (quota reached)
- [ ] Complete a ₹49 test payment for 10 credits → verify `profiles.reveal_credits` increased by 10

### Inquiry system
- [ ] Browse a property → Send Enquiry form → submit message
- [ ] Verify row in `inquiries` table and a row in `email_queue`
- [ ] Wait up to 2 minutes → email should arrive at the owner's address via Resend
- [ ] Owner Dashboard → Inquiries section should show the message with "pending" badge

### Saved properties
- [ ] Click the heart icon on a property card — heart fills
- [ ] Navigate to `/saved` → property appears
- [ ] Click heart again → property removed from saved list

### Expiry cron (can test manually)
- [ ] Run in SQL Editor: `SELECT expire_stale_listings()` — should return 0 if none are expired
- [ ] Manually set `expires_at = now() - interval '1 minute'` on a test property, re-run — should return 1
- [ ] Check `email_queue` for the expiry notification email

### Razorpay webhook
- [ ] In Razorpay Dashboard → Webhooks → click your webhook → **Test** button → send a `payment.captured` test event
- [ ] Should receive HTTP 200 back in the Razorpay test portal

---

## 12. Common Issues & Fixes

### "Cannot find module '@supabase/supabase-js'" in Edge Functions
Edge Functions use Deno and import from `https://esm.sh/`. This is correct and will work when deployed to Supabase. TypeScript errors about `Deno` or `esm.sh` in VS Code are expected — the Vite tsconfig doesn't include Deno types. Ignore these errors for files under `supabase/functions/`.

### 401 Unauthorized on Edge Function calls
The app explicitly passes `Authorization: Bearer ${session.access_token}` in every Edge Function call. If you see 401s, ensure you're calling `supabase.auth.getSession()` first to force a token refresh before the `functions.invoke()` call. Example:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) { navigate('/login'); return; }
const { data } = await supabase.functions.invoke('my-function', {
  body: { ... },
  headers: { Authorization: `Bearer ${session.access_token}` }
});
```

### Razorpay Checkout not opening
- Make sure `loadRazorpayScript()` is awaited before calling `new window.Razorpay(...)`
- Check browser console for Content Security Policy errors — Vercel does not add a CSP by default, but if you've added one, allow `https://checkout.razorpay.com`

### pg_cron jobs not running
- Verify the extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Check job logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;`
- The `net` schema (for `net.http_post`) is available by default in Supabase projects

### Images 400 / upload failing
- Regenerate the Cloudinary API Secret (Settings → Access Keys → Regenerate)
- Re-run `supabase secrets set CLOUDINARY_API_SECRET=...`
- Redeploy `sign-upload`: `supabase functions deploy sign-upload --no-verify-jwt`

### "Invalid payment signature" from `verify-payment`
This means the `RAZORPAY_KEY_SECRET` in Supabase secrets doesn't match the key used to create the order. Ensure both `create-razorpay-order` and `verify-payment` are using the same key pair (test keys in test mode, live keys in live mode).

### Email not arriving
1. Check `email_queue` table: look for rows with `status = 'failed'` and read `last_error`
2. Common cause: `RESEND_API_KEY` expired or domain not verified in Resend
3. During development, use `onboarding@resend.dev` as sender (works without domain verification)

### Webhook returning 400 "Invalid signature"
- Ensure `RAZORPAY_WEBHOOK_SECRET` in Vercel matches exactly what was entered in the Razorpay dashboard webhook config (no trailing spaces)
- The `api/razorpay-webhook.ts` function reads the raw body for HMAC — if any middleware parses the body first, the signature will fail. The function sets `export const config = { api: { bodyParser: false } }` to prevent this.

---

## Quick Reference — Supabase CLI Commands

```bash
# Check CLI version
supabase --version

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# List deployed functions
supabase functions list

# Redeploy a single function after code change
supabase functions deploy verify-payment --no-verify-jwt

# View function logs (useful for debugging)
supabase functions logs verify-payment --tail

# List all secrets
supabase secrets list

# Set or update a secret
supabase secrets set MY_SECRET=value

# Open the local Supabase Studio (if running locally)
supabase studio
```

---

## Plan & Pricing Summary

| Plan | Price | Active For | Features |
|---|---|---|---|
| Free | ₹0 | 30 days | Listed, verified badge, search visibility |
| Featured | ₹199 | 30 days | +30 ranking boost, highlighted in search |
| Premium | ₹499 | 60 days | Top placement, 60 days, priority badge |

| Credits Pack | Price | What it gives |
|---|---|---|
| 10 Reveal Credits | ₹49 | 10 more phone reveals (on top of the 3 free/month) |
| Unlimited Reveals | ₹149 | No limit for the rest of the current calendar month |
