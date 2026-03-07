# Supabase Edge Functions — Dashboard GUI Guide

This guide covers every step to deploy and manage the two TownHall Edge Functions
(`sign-upload` and `increment-view`) using **only the Supabase Dashboard** (no CLI required).

---

## Prerequisites

| Item | Where to get it |
|---|---|
| Supabase project URL & anon key | Dashboard → Project Settings → API |
| Cloudinary API Key, Secret, Cloud Name | cloudinary.com → Settings → API Keys |
| Upstash Redis REST URL & Token | console.upstash.com → Create Database → REST API |

---

## Part A — Deploy an Edge Function from the Dashboard

### Step 1 — Open the Edge Functions panel

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and open your project.
2. In the left sidebar click **Edge Functions**.
3. Click **"Deploy a new function"**.

---

### Step 2 — Create `sign-upload`

1. In the **Function name** field type exactly: `sign-upload`
2. The editor will open with a starter template. **Select all** the boilerplate and **delete it**.
3. Paste the full content of [`supabase/functions/sign-upload/index.ts`](./functions/sign-upload/index.ts) from this repo.
4. Click **Deploy Function**.
5. Wait for the green **"Deployed"** badge — usually under 30 seconds.

---

### Step 3 — Create `increment-view`

Repeat Step 2 using the name `increment-view` and the content of
[`supabase/functions/increment-view/index.ts`](./functions/increment-view/index.ts).

---

## Part B — Add Environment Secrets

Edge Functions read secrets from Supabase's vault — **never** hardcode them.

### Step 1 — Open the Secrets panel

Dashboard → **Edge Functions** → **Manage secrets** button (top-right of the functions list).

> Alternatively: Project Settings → Edge Functions → Secrets.

---

### Step 2 — Add each secret

Click **"Add new secret"** for every row in this table:

| Secret name | Value | Used by |
|---|---|---|
| `CLOUDINARY_API_SECRET` | Your Cloudinary API Secret | `sign-upload` | 
| `CLOUDINARY_API_KEY` | Your Cloudinary API Key | `sign-upload` | 
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name (e.g. `dxxxxxx`) | `sign-upload` |
| `UPSTASH_REDIS_REST_URL` | Full HTTPS URL from Upstash console | `increment-view` |
| `UPSTASH_REDIS_REST_TOKEN` | Bearer token from Upstash console | `increment-view` | 

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **automatically injected** by Supabase —
> you do NOT need to add them manually.

After adding each secret, click **Save**.

---

### Step 3 — Redeploy after adding secrets

Secrets added after initial deployment are picked up on the next deploy.

1. Go back to **Edge Functions**.
2. Click the function name → **Redeploy** (top-right button).
3. Repeat for both functions.

---

## Part C — Test the Functions from the Dashboard

### Test `sign-upload`

1. Click **`sign-upload`** in the functions list.
2. Click the **"Test"** tab.
3. Set **Method** to `POST`.
4. In the **Body** field paste:
   ```json
   { "folder": "townhall/00000000-0000-0000-0000-000000000000" }
   ```
5. Look at **Headers** — add `Authorization: Bearer <YOUR_ANON_KEY>`.
6. Click **Send**.

**Expected response (`200 OK`):**
```json
{
  "data": {
    "signature": "abc123...",
    "timestamp": 1741305600,
    "api_key": "your_api_key",
    "cloud_name": "your_cloud_name",
    "folder": "townhall/00000000-0000-0000-0000-000000000000"
  }
}
```

**If you get `400`:** The folder param format is wrong — it must match `townhall/<uuid>`.  
**If you get `500`:** Check that `CLOUDINARY_API_SECRET` secret is saved and function is redeployed.

---

### Test `increment-view`

1. Click **`increment-view`** in the functions list.
2. Click the **"Test"** tab.
3. Set **Method** to `POST`.
4. Body:
   ```json
   { "property_id": "paste-a-real-property-uuid-here" }
   ```
5. Click **Send**.

**Expected response (`200 OK`) on first call:**
```json
{ "data": { "incremented": true } }
```

**Expected response on repeat call from same IP within 24 h:**
```json
{ "data": { "incremented": false } }
```

---

## Part D — Monitor Logs

1. Dashboard → **Edge Functions** → click a function name.
2. Click the **"Logs"** tab.
3. Live logs stream in real time. Look for `status: 200` on successful calls.

Useful things to watch:
- `status: 400` → bad request body from client (check `folder` / `property_id` params).
- `status: 500` → unhandled error — check that all secrets are set and function is redeployed.
- Redis fetch errors print as `"Internal server error"` — the function falls back gracefully and still increments the view count.

---

## Part E — Update a Function

When you edit the `.ts` source files in this repo and want to push changes:

1. Dashboard → **Edge Functions** → click the function.
2. Click **"Edit code"**.
3. Replace the content with the updated file from the repo.
4. Click **Save & Deploy**.

---

## Part F — CORS & Calling from the Browser

Both functions already include CORS headers:

```ts
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

The Supabase JS client (`supabase.functions.invoke(...)`) sends the `Authorization` header
automatically using the logged-in user's JWT. No extra setup needed.

---

## Part G — Security Notes

| Concern | How it's handled |
|---|---|
| API Secret in browser | `CLOUDINARY_API_SECRET` lives only in Supabase Vault — never in `VITE_*` env vars |
| Folder path traversal | `sign-upload` validates folder with regex `^townhall\/[0-9a-f\-]{36}$` |
| View count inflation | `increment-view` uses Redis `SET NX EX 86400` — one increment per IP per 24 h |
| Phone number exposure | `reveal_owner_phone` RPC (SQL) enforces auth + monthly quota — Edge Functions are not involved |
| Service role key | Used only inside `increment-view` server-side; never exposed to the browser |

---

## Quick Reference — Function URLs

Your function URLs follow this pattern:

```
https://<project-ref>.supabase.co/functions/v1/sign-upload
https://<project-ref>.supabase.co/functions/v1/increment-view
```

Find your `project-ref` in: Dashboard → Project Settings → General → Reference ID.

You should never call these URLs directly in browser code — always use `supabase.functions.invoke()` so the auth header is attached automatically.
