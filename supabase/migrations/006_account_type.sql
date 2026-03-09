-- ─── Migration 006: account_type on profiles ────────────────────────────────
-- Adds account_type ('owner' | 'agent') to profiles.
-- Default 'owner' — all existing profiles are treated as direct owners.
-- Run in Supabase SQL Editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'owner'
  CHECK (account_type IN ('owner', 'agent'));

COMMENT ON COLUMN profiles.account_type IS
  'owner = direct property owner; agent = licensed broker / property agent';
