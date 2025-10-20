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

-- Users table (authentication & user management)
CREATE TABLE IF NOT EXISTS portfolio.users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  full_name TEXT,
  is_active BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_superuser BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  verification_token TEXT,
  verification_token_expires TIMESTAMP,
  reset_password_token TEXT,
  reset_password_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON portfolio.users(email);
CREATE INDEX idx_users_username ON portfolio.users(username);
CREATE INDEX idx_users_verification_token ON portfolio.users(verification_token);
CREATE INDEX idx_users_reset_token ON portfolio.users(reset_password_token);

-- Assets table (unique tickers from Yahoo Finance)
CREATE TABLE IF NOT EXISTS portfolio.assets (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT,
  currency TEXT DEFAULT 'USD',
  class portfolio.asset_class DEFAULT 'stock',
  country TEXT,
  sector TEXT,
  industry TEXT,
  asset_type TEXT, -- 'EQUITY', 'ETF', 'CRYPTO', etc.
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_assets_symbol ON portfolio.assets(symbol);
CREATE INDEX idx_assets_class ON portfolio.assets(class);
CREATE INDEX idx_assets_country ON portfolio.assets(country);
CREATE INDEX idx_assets_sector ON portfolio.assets(sector);
CREATE INDEX idx_assets_industry ON portfolio.assets(industry);

-- Portfolios table (multi-account support)
CREATE TABLE IF NOT EXISTS portfolio.portfolios (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES portfolio.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_currency TEXT DEFAULT 'EUR',
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_portfolios_user ON portfolio.portfolios(user_id);
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
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON portfolio.users
  FOR EACH ROW
  EXECUTE FUNCTION portfolio.update_updated_at_column();

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

-- Watchlist table (track assets without owning them)
CREATE TABLE IF NOT EXISTS portfolio.watchlist (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES portfolio.users(id) ON DELETE CASCADE,
  asset_id INT NOT NULL REFERENCES portfolio.assets(id) ON DELETE CASCADE,
  notes TEXT,
  alert_target_price NUMERIC(20,8),
  alert_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, asset_id)
);

CREATE INDEX idx_watchlist_user ON portfolio.watchlist(user_id);
CREATE INDEX idx_watchlist_asset ON portfolio.watchlist(asset_id);
CREATE INDEX idx_watchlist_alert_enabled ON portfolio.watchlist(alert_enabled);

-- Trigger for watchlist updated_at
CREATE TRIGGER update_watchlist_updated_at
  BEFORE UPDATE ON portfolio.watchlist
  FOR EACH ROW
  EXECUTE FUNCTION portfolio.update_updated_at_column();

-- Notification types enum
CREATE TYPE portfolio.notification_type AS ENUM (
  'TRANSACTION_CREATED',
  'TRANSACTION_UPDATED',
  'TRANSACTION_DELETED',
  'LOGIN',
  'PRICE_ALERT',
  'SYSTEM'
);

-- Notifications table (user notifications for events)
CREATE TABLE IF NOT EXISTS portfolio.notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES portfolio.users(id) ON DELETE CASCADE,
  type portfolio.notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_notifications_user ON portfolio.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON portfolio.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON portfolio.notifications(created_at DESC);
CREATE INDEX idx_notifications_user_read ON portfolio.notifications(user_id, is_read);

-- Comments for documentation
COMMENT ON SCHEMA portfolio IS 'Investment portfolio tracking system';
COMMENT ON TABLE portfolio.users IS 'Application users with authentication';
COMMENT ON TABLE portfolio.assets IS 'Financial assets with Yahoo Finance ticker symbols';
COMMENT ON TABLE portfolio.portfolios IS 'User investment portfolios';
COMMENT ON TABLE portfolio.transactions IS 'Portfolio transactions (buy, sell, dividends, fees, splits)';
COMMENT ON TABLE portfolio.prices IS 'Cached price history from Yahoo Finance';
COMMENT ON TABLE portfolio.watchlist IS 'User watchlist for tracking assets without owning them';

COMMENT ON COLUMN portfolio.transactions.metadata IS 'Additional data (e.g., split ratio: {"split": "2:1"})';
COMMENT ON COLUMN portfolio.transactions.quantity IS 'Number of shares/units (0 for DIVIDEND/FEE, ratio for SPLIT)';
COMMENT ON COLUMN portfolio.transactions.price IS 'Price per unit in asset currency';
COMMENT ON COLUMN portfolio.transactions.fees IS 'Transaction fees/commissions';
COMMENT ON COLUMN portfolio.watchlist.alert_target_price IS 'Optional price alert threshold';
COMMENT ON COLUMN portfolio.watchlist.alert_enabled IS 'Whether price alerts are enabled for this watchlist item';
COMMENT ON TABLE portfolio.notifications IS 'User notifications for transaction, login, and price alert events';
COMMENT ON COLUMN portfolio.notifications.metadata IS 'Additional notification data (e.g., IP address for login, asset info for transactions)';
