-- Migration for Asset Logo Caching Feature
-- Adds support for caching asset logos in the database
-- Date: 2025-10-31

-- Add logo columns to assets table
ALTER TABLE portfolio.assets 
ADD COLUMN IF NOT EXISTS logo_data BYTEA;

ALTER TABLE portfolio.assets 
ADD COLUMN IF NOT EXISTS logo_content_type VARCHAR(100);

ALTER TABLE portfolio.assets 
ADD COLUMN IF NOT EXISTS logo_fetched_at TIMESTAMP;

-- Add comments to document the new columns
COMMENT ON COLUMN portfolio.assets.logo_data IS 
'Binary logo data (WebP or SVG format)';

COMMENT ON COLUMN portfolio.assets.logo_content_type IS 
'MIME type of the logo (e.g., image/webp, image/svg+xml)';

COMMENT ON COLUMN portfolio.assets.logo_fetched_at IS 
'Timestamp when the logo was last fetched/cached';

-- Create index for efficient logo cache queries
CREATE INDEX IF NOT EXISTS idx_assets_logo_fetched 
ON portfolio.assets(logo_fetched_at) 
WHERE logo_fetched_at IS NOT NULL;
