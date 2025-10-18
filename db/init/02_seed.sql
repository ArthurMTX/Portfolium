-- Portfolium Seed Data
-- Sample portfolio with assets and transactions

SET search_path TO portfolio, public;

-- Insert sample portfolio
INSERT INTO portfolio.portfolios (name, base_currency, description)
VALUES 
  ('CTO Principal', 'EUR', 'Compte Titre Ordinaire principal'),
  ('PEA Tech', 'EUR', 'PEA orienté technologie')
ON CONFLICT (name) DO NOTHING;

-- Insert sample assets
INSERT INTO portfolio.assets (symbol, name, currency, class)
VALUES
  ('AAPL', 'Apple Inc.', 'USD', 'stock'),
  ('NVDA', 'NVIDIA Corporation', 'USD', 'stock'),
  ('MSFT', 'Microsoft Corporation', 'USD', 'stock'),
  ('BTC-USD', 'Bitcoin USD', 'USD', 'crypto'),
  ('ETH-USD', 'Ethereum USD', 'USD', 'crypto'),
  ('VOO', 'Vanguard S&P 500 ETF', 'USD', 'etf'),
  ('QQQ', 'Invesco QQQ Trust', 'USD', 'etf')
ON CONFLICT (symbol) DO NOTHING;

-- Get portfolio and asset IDs
DO $$
DECLARE
  portfolio_cto_id INT;
  portfolio_pea_id INT;
  asset_aapl_id INT;
  asset_nvda_id INT;
  asset_msft_id INT;
  asset_btc_id INT;
  asset_voo_id INT;
BEGIN
  -- Get IDs
  SELECT id INTO portfolio_cto_id FROM portfolio.portfolios WHERE name = 'CTO Principal';
  SELECT id INTO portfolio_pea_id FROM portfolio.portfolios WHERE name = 'PEA Tech';
  SELECT id INTO asset_aapl_id FROM portfolio.assets WHERE symbol = 'AAPL';
  SELECT id INTO asset_nvda_id FROM portfolio.assets WHERE symbol = 'NVDA';
  SELECT id INTO asset_msft_id FROM portfolio.assets WHERE symbol = 'MSFT';
  SELECT id INTO asset_btc_id FROM portfolio.assets WHERE symbol = 'BTC-USD';
  SELECT id INTO asset_voo_id FROM portfolio.assets WHERE symbol = 'VOO';

  -- Insert sample transactions for CTO
  INSERT INTO portfolio.transactions (portfolio_id, asset_id, tx_date, type, quantity, price, fees, currency)
  VALUES
    -- AAPL purchases
    (portfolio_cto_id, asset_aapl_id, '2024-01-15', 'BUY', 10, 150.25, 9.99, 'USD'),
    (portfolio_cto_id, asset_aapl_id, '2024-03-20', 'BUY', 5, 165.80, 9.99, 'USD'),
    (portfolio_cto_id, asset_aapl_id, '2024-06-10', 'DIVIDEND', 15, 0.24, 0, 'USD'),
    (portfolio_cto_id, asset_aapl_id, '2024-08-05', 'SELL', 5, 180.50, 9.99, 'USD'),
    
    -- NVDA purchases
    (portfolio_cto_id, asset_nvda_id, '2024-02-01', 'BUY', 20, 520.30, 15.99, 'USD'),
    (portfolio_cto_id, asset_nvda_id, '2024-04-15', 'BUY', 10, 780.45, 15.99, 'USD'),
    
    -- MSFT
    (portfolio_cto_id, asset_msft_id, '2024-01-10', 'BUY', 8, 375.20, 9.99, 'USD'),
    (portfolio_cto_id, asset_msft_id, '2024-03-12', 'DIVIDEND', 8, 0.75, 0, 'USD'),
    
    -- BTC
    (portfolio_cto_id, asset_btc_id, '2024-05-01', 'BUY', 0.25, 58000.00, 25.00, 'USD'),
    (portfolio_cto_id, asset_btc_id, '2024-07-20', 'BUY', 0.15, 64000.00, 25.00, 'USD'),
    
    -- VOO (ETF)
    (portfolio_pea_id, asset_voo_id, '2024-02-15', 'BUY', 25, 420.50, 12.99, 'USD'),
    (portfolio_pea_id, asset_voo_id, '2024-05-20', 'BUY', 15, 445.80, 12.99, 'USD'),
    (portfolio_pea_id, asset_voo_id, '2024-06-30', 'DIVIDEND', 40, 1.52, 0, 'USD');

  RAISE NOTICE 'Seed data inserted successfully';
END $$;

-- Insert some recent prices (last 30 days)
INSERT INTO portfolio.prices (asset_id, asof, price, source)
SELECT 
  a.id,
  now() - interval '1 day' * generate_series,
  CASE a.symbol
    WHEN 'AAPL' THEN 175.50 + random() * 10
    WHEN 'NVDA' THEN 850.25 + random() * 50
    WHEN 'MSFT' THEN 410.80 + random() * 15
    WHEN 'BTC-USD' THEN 67000 + random() * 3000
    WHEN 'ETH-USD' THEN 3200 + random() * 200
    WHEN 'VOO' THEN 455.30 + random() * 10
    WHEN 'QQQ' THEN 475.60 + random() * 12
  END,
  'yfinance'
FROM portfolio.assets a
CROSS JOIN generate_series(0, 30)
WHERE a.symbol IN ('AAPL', 'NVDA', 'MSFT', 'BTC-USD', 'ETH-USD', 'VOO', 'QQQ')
ON CONFLICT (asset_id, asof) DO NOTHING;

-- Summary
SELECT 
  'Portfolios' as entity, 
  COUNT(*)::text as count 
FROM portfolio.portfolios
UNION ALL
SELECT 'Assets', COUNT(*)::text FROM portfolio.assets
UNION ALL
SELECT 'Transactions', COUNT(*)::text FROM portfolio.transactions
UNION ALL
SELECT 'Prices', COUNT(*)::text FROM portfolio.prices;
