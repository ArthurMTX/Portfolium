-- Migration for Asset Price History Feature
-- Adds support for tracking asset price history from first transaction date

-- Add first_transaction_date to assets table
-- This helps track when to start fetching historical prices
ALTER TABLE portfolio.assets 
ADD COLUMN IF NOT EXISTS first_transaction_date DATE;

-- Add index for efficient price range queries
CREATE INDEX IF NOT EXISTS idx_prices_asset_date_range 
ON portfolio.prices(asset_id, asof DESC);

-- Add index for source filtering (to distinguish historical vs real-time prices)
CREATE INDEX IF NOT EXISTS idx_prices_source 
ON portfolio.prices(source);

-- Update first_transaction_date for existing assets
UPDATE portfolio.assets a
SET first_transaction_date = (
  SELECT MIN(t.tx_date)
  FROM portfolio.transactions t
  WHERE t.asset_id = a.id
)
WHERE first_transaction_date IS NULL;

-- Comment the new column
COMMENT ON COLUMN portfolio.assets.first_transaction_date IS 
'Date of first transaction for this asset, used to determine when to start fetching historical prices';
