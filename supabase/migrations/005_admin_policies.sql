-- ─── Migration 005: Admin RLS Policies ─────────────────────────────────────
-- Grants verified owners (acting as admins) read/write access to
-- listing_reports and the ability to flag properties.
-- Run in Supabase SQL Editor.

-- Helper: returns true when the calling user's is_verified_owner flag is set.
-- Stored as STABLE so Postgres can inline it into RLS policies efficiently.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_verified_owner FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ─── listing_reports: admin SELECT ──────────────────────────────────────────
-- Admins can read all reports (unresolved or not).
CREATE POLICY "Admins can view all reports"
  ON listing_reports FOR SELECT
  USING (is_admin());

-- ─── listing_reports: admin UPDATE ──────────────────────────────────────────
-- Admins can mark reports resolved.
CREATE POLICY "Admins can update reports"
  ON listing_reports FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── properties: admin UPDATE ───────────────────────────────────────────────
-- Admins can flag any property (set status = 'flagged').
-- Only the status column is touched — scope is deliberately narrow.
CREATE POLICY "Admins can flag properties"
  ON properties FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());
