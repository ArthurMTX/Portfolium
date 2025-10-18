-- Portfolium Database Schema
-- PostgreSQL 15+

-- Create schema
CREATE SCHEMA IF NOT EXISTS portfolio;

-- Set search path
SET search_path TO portfolio, public;

-- Asset classes enum
CREATE TYPE portfolio.asset_class AS ENUM ('stock', 'etf', 'crypto', 'cash');

-- Transaction types enum
CREATE TYPE portfolio.tx_type AS ENUM (
  'BUY',
  'SELL',
  'DIVIDEND',
  'FEE',
  'SPLIT',
  'TRANSFER_IN',
  'TRANSFER_OUT'
);

-- Assets table (unique tickers from Yahoo Finance)
CREATE TABLE IF NOT EXISTS portfolio.assets (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT,
  currency TEXT DEFAULT 'USD',
  class portfolio.asset_class DEFAULT 'stock',
  sector TEXT,
  industry TEXT,
  asset_type TEXT, -- 'EQUITY', 'ETF', 'CRYPTO', etc.
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_assets_symbol ON portfolio.assets(symbol);
CREATE INDEX idx_assets_class ON portfolio.assets(class);
CREATE INDEX idx_assets_sector ON portfolio.assets(sector);
CREATE INDEX idx_assets_industry ON portfolio.assets(industry);

-- Portfolios table (multi-account support)
CREATE TABLE IF NOT EXISTS portfolio.portfolios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_currency TEXT DEFAULT 'EUR',
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_portfolios_name ON portfolio.portfolios(name);

-- Transactions table
CREATE TABLE IF NOT EXISTS portfolio.transactions (
  id SERIAL PRIMARY KEY,
  portfolio_id INT NOT NULL REFERENCES portfolio.portfolios(id) ON DELETE CASCADE,
  asset_id INT NOT NULL REFERENCES portfolio.assets(id) ON DELETE RESTRICT,
  tx_date DATE NOT NULL,
  type portfolio.tx_type NOT NULL,
  quantity NUMERIC(20,8) NOT NULL DEFAULT 0,
  price NUMERIC(20,8) NOT NULL DEFAULT 0,
  fees NUMERIC(20,8) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_transactions_portfolio ON portfolio.transactions(portfolio_id);
CREATE INDEX idx_transactions_asset ON portfolio.transactions(asset_id);
CREATE INDEX idx_transactions_date ON portfolio.transactions(tx_date DESC);
CREATE INDEX idx_transactions_type ON portfolio.transactions(type);
CREATE INDEX idx_transactions_composite ON portfolio.transactions(portfolio_id, asset_id, tx_date);

-- Prices cache table
CREATE TABLE IF NOT EXISTS portfolio.prices (
  id SERIAL PRIMARY KEY,
  asset_id INT NOT NULL REFERENCES portfolio.assets(id) ON DELETE CASCADE,
  asof TIMESTAMP NOT NULL,
  price NUMERIC(20,8) NOT NULL,
  volume BIGINT,
  source TEXT DEFAULT 'yfinance',
  created_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX idx_prices_asset_asof ON portfolio.prices(asset_id, asof DESC);
CREATE INDEX idx_prices_asof ON portfolio.prices(asof DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION portfolio.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON portfolio.assets
  FOR EACH ROW
  EXECUTE FUNCTION portfolio.update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON portfolio.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION portfolio.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON portfolio.transactions
  FOR EACH ROW
  EXECUTE FUNCTION portfolio.update_updated_at_column();

-- Comments for documentation
COMMENT ON SCHEMA portfolio IS 'Investment portfolio tracking system';
COMMENT ON TABLE portfolio.assets IS 'Financial assets with Yahoo Finance ticker symbols';
COMMENT ON TABLE portfolio.portfolios IS 'User investment portfolios';
COMMENT ON TABLE portfolio.transactions IS 'Portfolio transactions (buy, sell, dividends, fees, splits)';
COMMENT ON TABLE portfolio.prices IS 'Cached price history from Yahoo Finance';

COMMENT ON COLUMN portfolio.transactions.metadata IS 'Additional data (e.g., split ratio: {"split": "2:1"})';
COMMENT ON COLUMN portfolio.transactions.quantity IS 'Number of shares/units (0 for DIVIDEND/FEE, ratio for SPLIT)';
COMMENT ON COLUMN portfolio.transactions.price IS 'Price per unit in asset currency';
COMMENT ON COLUMN portfolio.transactions.fees IS 'Transaction fees/commissions';
