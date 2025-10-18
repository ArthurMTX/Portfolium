-- Migration: Add sector, industry, and asset_type to assets table
-- Date: 2025-10-16

-- Add new columns to assets table
ALTER TABLE portfolio.assets 
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS asset_type TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assets_sector ON portfolio.assets(sector);
CREATE INDEX IF NOT EXISTS idx_assets_industry ON portfolio.assets(industry);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON portfolio.assets(asset_type);

-- Add comment explaining the new fields
COMMENT ON COLUMN portfolio.assets.sector IS 'Business sector from yfinance (e.g., Technology, Healthcare)';
COMMENT ON COLUMN portfolio.assets.industry IS 'Specific industry from yfinance (e.g., Software, Biotechnology)';
COMMENT ON COLUMN portfolio.assets.asset_type IS 'Asset type from yfinance (e.g., EQUITY, ETF, CRYPTOCURRENCY)';
