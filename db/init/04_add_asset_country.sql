-- Migration: Add country column to assets table
-- Date: 2025-10-16

-- Add country column to assets table
ALTER TABLE portfolio.assets 
  ADD COLUMN IF NOT EXISTS country TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_assets_country ON portfolio.assets(country);

-- Add comment explaining the new field
COMMENT ON COLUMN portfolio.assets.country IS 'Country of asset domicile or listing';
