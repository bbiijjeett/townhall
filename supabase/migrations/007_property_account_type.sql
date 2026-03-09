-- ─── Migration 007: Denormalize owner_account_type onto properties ────────────
-- Avoids a runtime join from properties → profiles at fetch time.
-- Populated on insert by the client (AppContext.addProperty).
-- Run in Supabase SQL Editor.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS owner_account_type TEXT NOT NULL DEFAULT 'owner'
  CHECK (owner_account_type IN ('owner', 'agent'));
