# TownHall — Implementation Tracker

> Work through parts in order. Each part is a self-contained unit of work.
> Mark tasks `[x]` when done.

---

## Engineering Guidelines
> These rules apply to every task in every part. No exceptions.

### Role & Mindset
You are a **senior full-stack engineer** — the same bar as a senior IC at Airbnb, Stripe, or Linear. That means:
- You write **production code**, not demo code. Every line ships to real users.
- You own the outcome, not just the task. If something adjacent is broken, fix it or flag it.
- You ask: *"What breaks if this code runs at 10,000 requests/minute?"* before writing it.
- You never leave `TODO`, `console.log`, or `any` in committed code.

---

### Code Style & Structure

**TypeScript**
- Strict mode always. No `any` — use `unknown` and narrow it, or define a proper type.
- All props, function parameters, and return types must be explicitly typed.
- Use `interface` for object shapes, `type` for unions and computed types.
- Co-locate types with the code that owns them. Only promote to a shared `types/` file if used in 3+ places.

**Component Rules**
- One component per file. Filename = component name. Use named exports, not default exports (except pages).
- Components are pure UI. No direct Supabase calls inside a component — all data fetching goes through a custom hook.
- Props interface is always defined immediately above the component. No inline prop types.
- Keep components under 150 lines. If longer, extract sub-components or custom hooks.
- Use existing `shadcn/ui` primitives (`Button`, `Card`, `Dialog`, `Badge`, etc.) before writing new UI. Never reimplement what already exists in `src/app/components/ui/`.

**Custom Hooks**
- All Supabase queries live in `src/app/hooks/use[Resource].ts` (e.g., `useProperties`, `useProfile`).
- Return `{ data, isLoading, error }` shaped objects — consistent with TanStack Query conventions.
- A hook does one thing. `useProperties` fetches properties. It does not also handle auth.

**File Naming**
- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts` prefixed with `use`
- Utilities / helpers: `camelCase.ts`
- Supabase Edge Functions: `kebab-case/index.ts`
- Vercel API routes: `kebab-case.ts` under `api/`

---

### Data & State Management

- **TanStack Query** for all server state (Supabase reads). Use `useQuery` with a stable, descriptive `queryKey` array: `['properties', { city, bhk, page }]`.
- **Zustand** for client-only UI state that needs to be shared (e.g., selected filters, modal open state). Do not put server state in Zustand.
- **`useState` / `useReducer`** for local component state only.
- `AppContext` is being phased out (Part 9). Do not extend it with new state. New features go straight into TanStack Query hooks.
- Never call `supabase` directly from a component. Always go through a hook.

---

### Supabase Conventions

- **Every table has RLS enabled.** Before writing a query, verify the RLS policy covers the current user's role. If it doesn't, write the policy first.
- **Never expose secrets client-side.** API keys for Razorpay, Resend, Cloudinary go in Supabase Edge Function env vars or Vercel env vars — never in `VITE_*` variables unless the service explicitly requires a public key.
- **RPC functions** for any operation that reads then writes (e.g., `reveal_owner_phone` — check quota, then insert, then return data). Atomic operations prevent race conditions.
- **Edge Functions** for all third-party API calls. Structure: validate input → call external API → update DB → return clean response. Always return `{ data, error }` shaped JSON.
- Use **parameterised queries** (Supabase SDK `.eq()`, `.in()`, `.rpc()`) always. Never string-interpolate values into a query.

---

### Error Handling

- Every async operation is wrapped in try/catch or handled via TanStack Query's `error` state.
- User-facing errors show a human-readable message via `sonner` toast (`src/app/components/ui/sonner.tsx`). Never expose raw Supabase error messages to the UI.
- Log the full error to Sentry (Part 10) in the catch block: `Sentry.captureException(error)`.
- Edge Functions return HTTP status codes correctly: `200` success, `400` bad input, `401` unauthenticated, `403` forbidden, `500` server fault. Never return `200` with `{ error: "..." }` in the body.

---

### Security (Non-Negotiable)

- **No sensitive data in client bundle.** Run `grep -r "VITE_" .env` — anything that isn't a public key is wrong.
- **Auth check first.** Every protected operation (Edge Function, RPC, API route) checks `auth.uid()` or session before touching data.
- **Validate inputs server-side.** Client validation (react-hook-form) is UX. Server validation (Edge Function / RLS / CHECK constraints) is security. Both are required.
- **Rate limit write operations.** Any endpoint that sends an email, charges a card, or increments a count must have rate limiting (Upstash Redis).
- **Never trust `property.owner_id` from the client.** Always derive it server-side from `auth.uid()` when writing data.

---

### UI & Design Consistency

- Use `cn()` from `src/app/components/ui/utils.ts` for conditional class merging. Never concatenate Tailwind classes with template literals.
- Spacing scale: use Tailwind's default scale (`p-4`, `gap-6`, `mb-8`, etc.). Do not use arbitrary values (`p-[13px]`) unless absolutely necessary for a pixel-perfect match.
- Color palette: stick to the existing theme in `src/styles/theme.css`. Do not introduce new brand colours ad-hoc.
- Loading states: every data-fetching component renders a `Skeleton` from `src/app/components/ui/skeleton.tsx` while loading. Never show an empty container.
- Empty states: every list renders an explicit empty state component when data is `[]`. Not just "nothing".
- Mobile first. Every new page and component is designed at 375px width first, then scaled up.

---

### Testing Before Marking Done

Before checking off any task:
1. **It works in the browser** — tested manually with a real Supabase dev instance.
2. **It fails gracefully** — tested with no auth, wrong inputs, empty data, network error.
3. **It compiles with zero TypeScript errors** — run `tsc --noEmit`.
4. **No regressions** — the existing flows (browse, add property, login) still work.

---

---

## Part 1 — Database Foundation
> Run all SQL in Supabase SQL editor. Must be done before any other part.

- [x] Extend `properties` table — add `plan_type` (text, default `'free'`), `expires_at` (timestamptz), `status` add `'flagged'` to CHECK, `location_tsv` (tsvector generated column + GIN index)
- [x] Move `owner_phone` out of `properties` — it will live only in `profiles`; drop or nullify the column in `properties`
- [x] Create `profiles` table with columns: `id` (FK → auth.users, PK), `role` (text, `'tenant'|'owner'|'both'`), `phone` (text nullable), `city` (text nullable), `onboarding_complete` (boolean default false), `reveal_credits` (integer default 3), `is_verified_owner` (boolean default false), `created_at`
- [x] Create Supabase trigger `AFTER INSERT ON auth.users` → auto-insert row into `profiles` with default values
- [x] Create `inquiries` table: `id`, `property_id` (FK), `tenant_id` (FK), `message` (text, max 500), `tenant_name`, `tenant_email`, `status` (`'pending'|'seen'|'replied'`), `created_at`
- [x] Create `contact_reveals` table: `id`, `tenant_id` (FK), `property_id` (FK), `created_at` — UNIQUE on `(tenant_id, property_id)`
- [x] Create `saved_properties` table: `tenant_id` (FK), `property_id` (FK), `created_at` — composite PK on `(tenant_id, property_id)`
- [x] Create `listing_plans` table: `id`, `property_id` (FK), `owner_id` (FK), `plan_type`, `amount_inr`, `razorpay_payment_id` (nullable), `status` (`'pending'|'verified'|'failed'`), `duration_days`, `purchased_at`
- [x] Create `tenant_alerts` table: `id`, `tenant_id` (FK), `location_query`, `bhk_filter` (text[]), `max_rent` (integer nullable), `is_active` (boolean default true), `created_at`
- [x] Create `listing_reports` table: `id`, `property_id` (FK), `reporter_id` (FK, nullable), `reason` (CHECK: `'fake'|'duplicate'|'wrong_price'|'offensive'|'other'`), `resolved` (boolean default false), `created_at`
- [x] Enable RLS on all new tables with appropriate policies (owners see their own, tenants see their own, admins see all)

---

## Part 2 — Security Fixes
> Highest priority. Ship these before telling anyone the product exists.

- [x] **Fix phone number exposure** — Remove `owner_phone` from the public-facing `SELECT *` RLS policy on `properties`. Create Supabase RPC `reveal_owner_phone(property_id uuid)` that: (1) checks `auth.uid()` is not null, (2) counts reveals this calendar month from `contact_reveals`, (3) enforces 3-reveal free limit, (4) inserts into `contact_reveals`, (5) returns `profiles.phone` for the property owner
- [x] **Signed Cloudinary uploads** — Create Supabase Edge Function `sign-upload` that accepts `{folder, public_id}` and returns a signed Cloudinary upload URL using CLOUDINARY_API_SECRET (server-side env var). Update `AddPropertyPage` to call this Edge Function instead of using unsigned preset. Remove `VITE_CLOUDINARY_UPLOAD_PRESET` from client `.env`
- [x] **Rate-limit view_count** — Set up Upstash Redis (free tier). Create a Vercel serverless function or Supabase Edge Function `increment-view` that uses a Redis key `view:{listing_id}:{ip}` with 24h TTL. Only call the Supabase `UPDATE view_count` if Redis returns a new key (first visit)

---

## Part 3 — Auth & Onboarding Flow
> Depends on: Part 1 (profiles table)

- [x] Update `ProtectedRoute` (or auth callback handler) — after Google sign-in, check `profiles.onboarding_complete`; if `false`, redirect to `/welcome`
- [x] Create `/welcome` page — 3-step flow:
  - Step 1: Role selection ("Looking for a place" / "I have a place to rent" / "Both")
  - Step 2: Preferred city input
  - Step 3: BHK preference + max budget (tenant) or property type interest (owner)
  - On completion: `UPDATE profiles SET onboarding_complete = true, role = ..., city = ..., phone = ...`
- [x] Collect phone number during onboarding step (store in `profiles.phone`, no OTP for now)
- [x] After onboarding completes: redirect tenants to landing with pre-filtered results, owners to `/add-property`

---

## Part 4 — Inquiry System
> Depends on: Part 1 (inquiries table), Part 2 (security), external: Resend account

- [x] Set up Resend account — get API key, add as `RESEND_API_KEY` in Supabase Edge Function secrets
- [x] Create Supabase Edge Function `send-inquiry-email` — triggered by Supabase Realtime webhook or called directly; sends email to owner via Resend with tenant name, message, and property link
- [x] Add inquiry modal to `PropertyDetailPage` — form with fields: name (pre-filled from profile), message (textarea, 500 char limit). On submit: INSERT into `inquiries`, call `send-inquiry-email` Edge Function
- [x] Update `OwnerDashboard` — show list of inquiries per listing with `status` badge (pending / seen / replied), mark as seen on open

---

## Part 5 — Saved Properties (Wishlist)
> Depends on: Part 1 (saved_properties table)

- [x] Add heart/bookmark icon button to `PropertyCard` — calls `INSERT INTO saved_properties` on click (requires auth, prompt sign-in if not logged in). Toggle state: filled if saved, outline if not
- [x] Create `/saved` page — fetches all `saved_properties` for current user with joined property data. Renders property cards with unsave button
- [x] Add `/saved` to `BottomNav` and `Navbar` (only when logged in)

---

## Part 6 — Listing Lifecycle Automation
> Depends on: Part 1 (plan_type, expires_at on properties), Part 4 (Resend setup)

- [x] **Expiry cron job** — Enable `pg_cron` in Supabase. Create job: runs nightly at 00:00 IST. SQL: `UPDATE properties SET status = 'expired' WHERE expires_at < now() AND status = 'active'`
- [x] **Expiry trigger → email** — On status change to `'expired'`: call Edge Function `send-expiry-email` via Supabase Database Webhook. Resend email to owner with listing title, expiry date, and "Renew Now" CTA link
- [x] **7-day warning cron** — Second pg_cron job: runs daily, finds listings where `expires_at BETWEEN now() AND now() + interval '7 days'` and `status = 'active'`. Calls Edge Function `send-expiry-warning-email` via Resend with "Upgrade to Premium" CTA
- [x] **Free listing expiry** — Free listings: set `expires_at = created_at + interval '30 days'` on insert (can be done via a DB trigger on `properties` insert)

---

## Part 7 — Payments & Plan System
> Depends on: Part 1 (listing_plans table), Part 6 (expires_at logic)
> Razorpay Live API keys are ready.

- [x] **Plan selection UI** — Replace the current `PaymentPage` single button with a 3-column plan selector: Free (₹0, 30 days) / Featured (₹199, 30 days, +30 ranking boost) / Premium (₹499, 60 days, top placement). Show benefits clearly per plan
- [x] **Razorpay Checkout integration** — On plan select (Featured or Premium): open Razorpay Checkout JS with correct `amount` and `order_id`. Pass listing ID in `notes`
- [x] **Edge Function `verify-payment`** — Receives `{razorpay_payment_id, razorpay_order_id, razorpay_signature, property_id, plan_type}`. Verifies HMAC signature server-side using `RAZORPAY_KEY_SECRET`. On success: `INSERT INTO listing_plans` with `status='verified'`, `UPDATE properties SET plan_type=..., expires_at=now()+interval`, `SET status='active'`
- [x] **Razorpay webhook** — Register `/api/razorpay-webhook` in Razorpay dashboard. Vercel serverless function that handles `payment.captured` event as a fallback in case checkout callback fails
- [x] **Renewal flow** — "Renew" button in `OwnerDashboard` and in expiry emails links to plan selection with the existing listing ID pre-selected. Same Razorpay flow, extends `expires_at` from `now()`

---

## Part 8 — Contact Reveal Credits UI
> Depends on: Part 2 (reveal_owner_phone RPC), Part 1 (profiles.reveal_credits), Part 7 (Razorpay)

- [x] Show "X reveals remaining this month" counter on `PropertyDetailPage` for logged-in tenants (count rows in `contact_reveals` for current month)
- [x] "Reveal Phone Number" button calls `reveal_owner_phone(property_id)` RPC — on success shows phone number inline; on quota exceeded shows "Buy more reveals" CTA
- [x] **Buy credits flow** — Razorpay Checkout for credits packs (₹49 / 10 credits or ₹149 / month unlimited). Edge Function `verify-credits-payment` on success updates `profiles.reveal_credits += 10` or sets unlimited flag

---

## Part 9 — SEO & Performance
> Depends on: nothing (can start anytime)

- [ ] Install `react-helmet-async`. Wrap `App.tsx` in `<HelmetProvider>`
- [ ] Add `<Helmet>` to `PropertyDetailPage` with dynamic `<title>`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:image">` using fetched property data
- [ ] Add JSON-LD `RealEstateListing` script tag via `<Helmet>` on `PropertyDetailPage`
- [ ] Add basic `<Helmet>` to `LandingPage` with static site-level title and description
- [ ] Create `api/sitemap.xml.ts` Vercel serverless function — queries Supabase for all `status='active'` property IDs, outputs valid XML sitemap with `<loc>` and `<lastmod>`
- [ ] Add `public/robots.txt` pointing to the sitemap URL
- [ ] **Replace AppContext with TanStack Query** — Wrap app in `QueryClientProvider`. Convert property listing fetch to `useQuery` with pagination (`page`, `limit` params). Convert single property fetch in `PropertyDetailPage` to `useQuery`. Remove the "fetch all on mount" pattern from `AppContext`

---

## Part 10 — Monitoring & Observability
> Depends on: nothing (setup anytime, but ideally before launch)

- [ ] Set up Sentry project (React). Add `VITE_SENTRY_DSN` to `.env`. Init Sentry in `main.tsx` with `dsn`, `environment`, `tracesSampleRate: 0.1`
- [ ] Add `ErrorBoundary` Sentry wrapper around the router
- [ ] Enable Vercel Analytics — add `@vercel/analytics` package, add `<Analytics />` component to `App.tsx`

---

## Part 11 — Listing Reports (Trust & Safety)
> Depends on: Part 1 (listing_reports table)

- [x] Add "Report this listing" link/button to `PropertyDetailPage` (small, below fold)
- [x] Report modal — dropdown for reason (`Fake listing / Duplicate / Wrong price / Offensive / Other`) + optional description. On submit: `INSERT INTO listing_reports`. Rate-limit: use Upstash Redis key `report:{property_id}:{user_id}` with 7-day TTL to prevent spam
- [x] **Admin view** — simple `/admin` protected route (role check: `is_verified_owner` or a separate `is_admin` flag). Table view of unresolved `listing_reports` with "Mark resolved" + "Flag listing" actions

---

## Part 12 — Owner Dashboard Upgrades
> Depends on: Part 4 (inquiries), Part 6 (expiry), Part 7 (plans)

- [x] Add **view count sparkline** per listing (7-day rolling, or total `view_count` if realtime data not collected)
- [x] Add **inquiry count badge** per listing (count from `inquiries` table)
- [x] Add **days remaining badge** — `expires_at - now()` shown as "12 days left" with color: green > 14d, amber 7–14d, red < 7d
- [x] Add **"Upgrade Plan" CTA** on free listings in dashboard — links to plan selection for that listing
- [x] Add **"Renew" CTA** on expired listings — links to plan selection with listing pre-selected

---

## Part 13 — Launch Checklist
> Do last, after all above parts are complete and tested.

- [ ] Attach custom domain in Vercel dashboard — update DNS records
- [ ] Set all production environment variables in Vercel (Supabase URL/key, Razorpay live keys, Resend key, Cloudinary credentials, Upstash Redis URL/token, Sentry DSN)
- [ ] Submit `sitemap.xml` URL to Google Search Console
- [ ] Test full **owner flow** end-to-end in production: sign in → onboarding → add property → upload images → choose plan → pay → listing live → receive inquiry email
- [ ] Test full **tenant flow** end-to-end in production: browse → filter → property detail → save → sign in → reveal phone → send inquiry
- [ ] Verify Razorpay webhook is receiving `payment.captured` events in live mode
- [ ] Confirm pg_cron jobs are registered and running (`SELECT * FROM cron.job` in Supabase SQL editor)
- [ ] Verify Sentry is capturing errors (throw a test error, confirm it appears in Sentry dashboard)

---

## Summary

| Part | Area | Blocking Parts |
|------|------|----------------|
| 1 | Database Foundation | — |
| 2 | Security Fixes | 1 |
| 3 | Auth & Onboarding | 1 |
| 4 | Inquiry System | 1, 2 |
| 5 | Saved Properties | 1 |
| 6 | Listing Lifecycle | 1, 4 |
| 7 | Payments & Plans | 1, 6 |
| 8 | Contact Reveal Credits UI | 2, 7 |
| 9 | SEO & Performance | — |
| 10 | Monitoring | — |
| 11 | Reports & Trust | 1 |
| 12 | Dashboard Upgrades | 4, 6, 7 |
| 13 | Launch Checklist | All above |
