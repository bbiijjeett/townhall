# Upstash Redis Setup Guide

Upstash is used by the `increment-view` Edge Function to rate-limit view counts to
**one increment per IP per property per 24 hours** — preventing artificial inflation.
The free tier (10,000 requests/day) is more than enough for early-stage traffic.

---

## Step 1 — Create an Upstash account

1. Go to [console.upstash.com](https://console.upstash.com).
2. Click **Sign Up** — you can use GitHub, Google, or email.

---

## Step 2 — Create a Redis database

1. After logging in, click **"Create Database"**.
2. Fill in the form:

   | Field | Value |
   |---|---|
   | **Name** | `townhall-rate-limit` (or any name you like) |
   | **Type** | Regional |
   | **Region** | Pick the one closest to your Supabase project region (check: Supabase Dashboard → Project Settings → General → Region) |
   | **TLS** | Enabled (leave on — required) |

3. Click **Create**.

> The database is ready in under 10 seconds.

---

## Step 3 — Get your REST credentials

1. Open the database you just created.
2. Scroll down to the **"REST API"** section.
3. You will see two values — copy both:

   | What to copy | Where it goes |
   |---|---|
   | **UPSTASH_REDIS_REST_URL** | Looks like `https://YOUR-DB.upstash.io` |
   | **UPSTASH_REDIS_REST_TOKEN** | Long bearer token string |

> Use the **REST API** credentials, not the Redis connection string (`redis://...`).
> Supabase Deno Edge Functions cannot open raw TCP sockets to Redis.

---

## Step 4 — Add secrets to Supabase

1. Go to your **Supabase Dashboard**.
2. Left sidebar → **Edge Functions** → **Manage secrets** (top-right button).
3. Click **"Add new secret"** twice:

   | Secret name | Value |
   |---|---|
   | `UPSTASH_REDIS_REST_URL` | The URL from Step 3 |
   | `UPSTASH_REDIS_REST_TOKEN` | The token from Step 3 |

4. Click **Save** after each one.

---

## Step 5 — Redeploy `increment-view`

Secrets added after an initial deployment are only picked up on redeploy.

1. Dashboard → **Edge Functions** → click **`increment-view`**.
2. Click **Redeploy** (top-right).
3. Wait for the green **"Deployed"** badge.

---

## Step 6 — Verify it's working

### Option A — Test tab in Supabase Dashboard

1. Dashboard → Edge Functions → `increment-view` → **Test** tab.
2. Method: `POST`, Body:
   ```json
   { "property_id": "paste-a-real-property-uuid-here" }
   ```
3. Send twice in a row.
   - **First call:** `{ "data": { "incremented": true } }`
   - **Second call:** `{ "data": { "incremented": false } }` ← Redis blocked it ✓

### Option B — Upstash console

1. Open your database in [console.upstash.com](https://console.upstash.com).
2. Click the **"Data Browser"** tab.
3. After a test call you should see a key like:
   ```
   view:<property-uuid>:<ip-address>
   ```
   with a TTL countdown showing ~86,400 seconds remaining.

---

## Free tier limits

| Metric | Free tier limit |
|---|---|
| Commands/day | 10,000 |
| Max database size | 256 MB |
| Max connections | 100 concurrent |
| Bandwidth | 200 MB/day |

Each view attempt = **1 Redis command** (`SET ... NX EX`).
At 10,000 commands/day you can handle up to 10,000 unique page views per day before
the rate-limiter stops blocking (it falls back gracefully — views still get counted,
just without deduplication). Upgrade to the Pay-As-You-Go plan ($0.2 per 100K commands)
when you hit that ceiling.

---

## How the rate-limiting works

```
Browser visits PropertyDetailPage
        │
        ▼
supabase.functions.invoke('increment-view', { property_id })
        │
        ▼
Edge Function extracts client IP from request headers
  (cf-connecting-ip → x-real-ip → x-forwarded-for)
        │
        ▼
Redis: SET view:{property_id}:{ip} 1 NX EX 86400
        │
        ├── Result = "OK"  → first visit → UPDATE view_count in Postgres
        │                    returns { incremented: true }
        │
        └── Result = null  → already visited in past 24h → skip Postgres
                             returns { incremented: false }
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `incremented: true` every time (no deduplication) | Redis secrets missing or wrong | Re-check Step 4, redeploy |
| Edge Function returns `500` | `UPSTASH_REDIS_REST_URL` is wrong format | Must start with `https://`, no trailing slash |
| Upstash Data Browser shows no keys | Using Redis connection string instead of REST API URL | Copy the REST URL, not `redis://` |
| View counts not updating at all | Postgres RPC `increment_property_view` missing | Run `supabase/migrations/001_production_foundation.sql` first |
