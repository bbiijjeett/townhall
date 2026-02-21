-- Properties Table
CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  rent INTEGER NOT NULL,
  deposit INTEGER NOT NULL,
  bhk TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  area INTEGER,
  floor INTEGER,
  total_floors INTEGER,
  available_from TIMESTAMPTZ,
  furnishing TEXT CHECK (furnishing IN ('Fully Furnished', 'Semi Furnished', 'Unfurnished')),
  preferred_tenants TEXT CHECK (preferred_tenants IN ('Family', 'Bachelor', 'Any')),
  is_pet_friendly BOOLEAN DEFAULT false,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Policies for properties table
-- Anyone can read active properties
CREATE POLICY "Anyone can view active properties"
  ON properties FOR SELECT
  USING (status = 'active' OR auth.uid() = owner_id);

-- Users can insert their own properties
CREATE POLICY "Users can insert their own properties"
  ON properties FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own properties
CREATE POLICY "Users can update their own properties"
  ON properties FOR UPDATE
  USING (auth.uid() = owner_id);

-- Users can delete their own properties
CREATE POLICY "Users can delete their own properties"
  ON properties FOR DELETE
  USING (auth.uid() = owner_id);

-- Create indexes for better performance
CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX idx_properties_location ON properties USING GIN (to_tsvector('english', location));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row modification
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- MIGRATION: Add new property fields
-- Run this if you already have the table created
-- =============================================
/*
ALTER TABLE properties 
  ADD COLUMN IF NOT EXISTS area INTEGER,
  ADD COLUMN IF NOT EXISTS floor INTEGER,
  ADD COLUMN IF NOT EXISTS total_floors INTEGER,
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS furnishing TEXT CHECK (furnishing IN ('Fully Furnished', 'Semi Furnished', 'Unfurnished')),
  ADD COLUMN IF NOT EXISTS preferred_tenants TEXT CHECK (preferred_tenants IN ('Family', 'Bachelor', 'Any')),
  ADD COLUMN IF NOT EXISTS is_pet_friendly BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add index for location-based searches
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIN (to_tsvector('english', location));

-- Add spatial index for coordinates if needed
CREATE INDEX IF NOT EXISTS idx_properties_coordinates ON properties (latitude, longitude);
*/

-- =============================================
-- MIGRATION: Add view_count for Engagement weight
-- Run this against your live Supabase database.
-- =============================================

-- 1. Add the column (safe to run multiple times)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- 2. Index for fast ordering / analytics
CREATE INDEX IF NOT EXISTS idx_properties_view_count ON properties (view_count DESC);

-- 3. Increment helper – call this from your property detail page via RPC
--    supabase.rpc('increment_property_view', { property_id: '<id>' })
CREATE OR REPLACE FUNCTION increment_property_view(property_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE properties
  SET view_count = view_count + 1
  WHERE id = property_id;
END;
$$;
