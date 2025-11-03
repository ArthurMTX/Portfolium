-- Add asset_metadata_overrides table for user-specific metadata
-- This allows users to provide custom metadata when Yahoo Finance doesn't have data
-- Overrides are user-specific - each user can set their own classification preferences

-- Create the overrides table
CREATE TABLE IF NOT EXISTS portfolio.asset_metadata_overrides (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES portfolio.users(id) ON DELETE CASCADE,
  asset_id INT NOT NULL REFERENCES portfolio.assets(id) ON DELETE CASCADE,
  sector_override TEXT,
  industry_override TEXT,
  country_override TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, asset_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_overrides_user ON portfolio.asset_metadata_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_overrides_asset ON portfolio.asset_metadata_overrides(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_overrides_user_asset ON portfolio.asset_metadata_overrides(user_id, asset_id);

-- Add comments
COMMENT ON TABLE portfolio.asset_metadata_overrides IS 'User-specific metadata overrides for assets when Yahoo Finance data is unavailable';
COMMENT ON COLUMN portfolio.asset_metadata_overrides.sector_override IS 'User-provided sector when Yahoo Finance sector is NULL';
COMMENT ON COLUMN portfolio.asset_metadata_overrides.industry_override IS 'User-provided industry when Yahoo Finance industry is NULL';
COMMENT ON COLUMN portfolio.asset_metadata_overrides.country_override IS 'User-provided country when Yahoo Finance country is NULL';

-- Trigger for updated_at
CREATE TRIGGER update_asset_overrides_updated_at
  BEFORE UPDATE ON portfolio.asset_metadata_overrides
  FOR EACH ROW
  EXECUTE FUNCTION portfolio.update_updated_at_column();
