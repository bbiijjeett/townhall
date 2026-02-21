import type { Property } from '../app/context/AppContext';

/**
 * Weighted listing score (max 100 pts)
 *
 * | Component            | Max pts | Logic                                   |
 * |----------------------|---------|-----------------------------------------|
 * | Freshness            |   40    | Age in days vs post date                |
 * | Paid Boost           |   30    | paymentStatus === 'paid'                |
 * | Engagement           |   20    | view_count / 5 (capped at 20)           |
 * | Profile Completeness |   10    | Optional fields filled                  |
 */
export function computeListingScore(property: Property): number {
  return (
    freshnessScore(property) +
    paidBoostScore(property) +
    engagementScore(property) +
    completenessScore(property)
  );
}

// ─── 1. Freshness (0 – 40 pts) ───────────────────────────────────────────────
// Decays in tiers as the listing ages.
function freshnessScore(property: Property): number {
  const ageDays =
    (Date.now() - property.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= 3)  return 40;
  if (ageDays <= 7)  return 30;
  if (ageDays <= 14) return 20;
  if (ageDays <= 30) return 10;
  return 0;
}

// ─── 2. Paid Boost (0 – 30 pts) ──────────────────────────────────────────────
// Flat bonus for listings whose payment has been confirmed.
function paidBoostScore(property: Property): number {
  return property.paymentStatus === 'paid' ? 30 : 0;
}

// ─── 3. Engagement (0 – 20 pts) ──────────────────────────────────────────────
// 1 pt per 5 views, capped at 20.
// Requires the `view_count` column – see the migration in supabase-schema.sql.
function engagementScore(property: Property): number {
  const views = property.viewCount ?? 0;
  return Math.min(20, Math.floor(views / 5));
}

// ─── 4. Profile Completeness (0 – 10 pts) ────────────────────────────────────
// Awards points for each optional field that has been filled in.
function completenessScore(property: Property): number {
  let pts = 0;

  if (property.images?.length > 0)                  pts += 2; // photos matter most
  if (property.amenities?.length > 0)               pts += 1;
  if (property.area != null)                         pts += 1;
  if (property.furnishing)                           pts += 1;
  if (property.preferredTenants)                     pts += 1;
  if (property.floor != null && property.totalFloors != null) pts += 1;
  if (property.availableFrom)                        pts += 1;
  if (property.isPetFriendly != null)                pts += 1;
  if (property.latitude != null && property.longitude != null) pts += 1;

  return pts; // max 10
}
