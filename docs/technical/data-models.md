# Data Models

Entity reference for Portfolium's PostgreSQL schema (`portfolio` schema), defined via SQLAlchemy in `api/app/models/` and versioned with Alembic (`api/alembic/versions`).

## Core Entities

### User (`users`)

The account record. Holds credentials, notification preferences, and 2FA state.

| Field | Purpose |
|---|---|
| `email`, `username`, `hashed_password` | Login identity |
| `is_verified`, `verification_token(_expires)` | Email verification flow |
| `reset_password_token(_expires)` | Password reset flow |
| `totp_secret`, `totp_enabled`, `totp_backup_codes` | Two-factor authentication (TOTP) — see [Profile & Security](../user-guide/profile-security.md) |
| `daily_change_notifications_enabled`, `transaction_notifications_enabled`, `daily_report_enabled`, `ath_atl_notifications_enabled`, `push_notifications_enabled` | Per-user notification toggles |
| `preferred_language` | UI locale |

### Portfolio (`portfolios`)

A user's container for transactions and metrics. See [Portfolios](../user-guide/portfolios.md).

| Field | Purpose |
|---|---|
| `user_id` | Owner (cascade delete) |
| `base_currency` | Currency used for portfolio-level valuations |
| `is_public`, `share_token` | [Public sharing](../user-guide/public-sharing.md) — a unique token grants read-only external access |
| `last_accessed_at` | Used to prioritize cache warmup for active portfolios |

### Transaction (`transactions`)

Every buy, sell, dividend, fee, split, or transfer.

| Field | Purpose |
|---|---|
| `portfolio_id`, `asset_id` | What was traded and where |
| `type` | Enum: BUY, SELL, DIVIDEND, FEE, SPLIT, TRANSFER_IN, TRANSFER_OUT |
| `quantity`, `price`, `fees`, `currency` | Trade economics (`Numeric(20, 8)` for crypto-level precision) |
| `meta_data` (column `metadata`) | JSON extension field — e.g. links a conversion's paired legs |

### Asset (`assets`)

Shared across all portfolios — one row per unique ticker, not per user.

| Field | Purpose |
|---|---|
| `symbol`, `name`, `currency`, `class_` (STOCK/ETF/CRYPTO), `sector`, `industry`, `country` | Identity and classification |
| `market_cap`, `market_cap_usd`, `market_cap_fetched_at` | Cached fundamentals |
| `isin` | International identifier, backed by the [reference data](reference-data-isin.md) system |
| `logo_data`, `logo_light_data`, `logo_dark_data`, `logo_provider`, `logo_url`, `logo_light_url`, `logo_dark_url` | Cached logo bytes/URLs — see [Logo Fetching](logo-fetching.md) |
| `ath_price`, `ath_date`, `atl_price`, `atl_date` | All-time high/low tracking, source of ATH/ATL notifications |
| `first_transaction_date` | Anchors historical price backfill — see [Pricing](pricing.md) |

### Price (`prices`)

Cached current and historical price points per asset — see [Pricing](pricing.md) for how this table is populated and kept fresh.

## Cash Ledger

- **CashAccount** (`portfolio.cash_accounts`) — one row per portfolio and
  currency; the row-level locking anchor for strict-mode validation. No
  cached balance column exists.
- **CashMovement** (`portfolio.cash_movements`) — the signed cash ledger;
  balances are always `SUM(amount)` per portfolio and currency. Movements
  derived from transactions carry `transaction_id`; Forex conversion legs
  share a `conversion_id`; activation opening balances carry
  `activation_id`. See [Cash Ledger](cash-ledger.md) for the full schema,
  constraints and accounting rules.
- **Portfolio** additions — `cash_mode` (`untracked` default,
  `tracked_warn`, `tracked_strict`), `cash_tracking_started_on`,
  `cash_activation_id`/`cash_activation_meta` (activation audit), and the
  `tx_change_seq`/`cash_ledger_synced_seq` revision counters used to detect
  a stale retained ledger.

## Asset Intelligence

### AssetMetadataOverride (`asset_metadata_overrides`)

Per-user corrections to an asset's sector, industry, or country when the provider's classification is wrong. Scoped to `user_id` + `asset_id`, so overrides don't affect other users' view of the same asset.

### AssetInvestmentNote (`asset_investment_notes`)

A user's private research notes on an asset: `thesis`, `conviction`, `risks`, `target_price`/`target_text`, `invalidation_thesis`, `horizon`/`horizon_date`.

### AssetThemeClassification (`asset_theme_classifications`) & AssetThemeTaxonomySuggestion (`asset_theme_taxonomy_suggestions`)

Back the AI-assisted theme/subtheme system — see [Asset Themes](asset-themes.md). Classifications store the assigned `themes` (JSONB) plus provenance (`method`, `model`, `source_hash`); suggestions are pending taxonomy proposals awaiting admin review (`status`: pending/approved/rejected).

## Goals & Dividends

### PortfolioGoal (`portfolio_goals`)

A target amount (and optional target date) for a portfolio — see [Goals](../user-guide/portfolios.md#goals). Supports `monthly_contribution` for projection math and `is_active` to retire a goal without deleting its history.

### PendingDividend (`pending_dividends`)

A detected-but-unconfirmed dividend payment awaiting user review — see [Pending Dividends](../user-guide/transactions.md#pending-dividends). Stores `ex_dividend_date`, `payment_date`, `dividend_per_share`, `shares_held`, `gross_amount`, and `status` (pending/accepted/rejected). On acceptance, links to the generated `transaction_id`.

## Watchlist

### Watchlist (`watchlist`)

A tracked asset a user doesn't necessarily own: `notes`, `alert_target_price`, `alert_enabled`.

### WatchlistTag (`watchlist_tags`) & association table

User-defined tags (`name`, `icon`, `color`) for organizing watchlist items — see [Watchlist tags](../user-guide/watchlist.md#organizing-with-tags). Many-to-many via a join table.

## Notifications & Push

### Notification (`notifications`)

In-app notification feed: `type` (enum covering price alerts, ATH/ATL, daily change, reports, etc.), `title`, `message`, `meta_data`, `is_read`.

### PushSubscription (`push_subscriptions`)

Web Push subscription per browser/device — see [Push Notifications](push-notifications.md). Stores the endpoint URL and encryption keys (`p256dh_key`, `auth_key`) per the Web Push protocol, plus `failed_count` to prune dead subscriptions.

## Dashboards & Calendar

### DashboardLayout (`dashboard_layouts`)

A saved widget grid: `layout_config` (JSON), optionally scoped to a specific `portfolio_id`, with `is_default` and `is_shared` flags.

### EarningsCache (`earnings_cache`)

Cached upcoming/historical earnings dates per symbol, feeding the [Calendar](../user-guide/calendar.md) and [Today's Brief](../widgets/today-brief.md): estimate/actual EPS and revenue, `surprise_pct`, fiscal period.

## Reference Data

### AdanosListing (`adanos_listings`)

Exchange listing reference data used to reconcile tickers/ISINs across exchanges — see [Reference Data & ISIN](reference-data-isin.md). Keyed by `listing_key` (`"{exchange}::{ticker}"`), with `isin`, sector/category, and country fields.

## Notes

- All tables live in the `portfolio` Postgres schema (not `public`).
- Monetary fields use `Numeric(20, 8)` (or similar high-precision types) rather than floats, to avoid rounding drift across crypto-level decimals.
- Foreign keys generally cascade on delete from `User` and `Portfolio`, so deleting an account or portfolio cleans up its transactions, goals, dividends, and dashboards — see the deletion warnings in [Profile & Security](../user-guide/profile-security.md) and [Portfolios](../user-guide/portfolios.md).
- For exact column types and constraints, the SQLAlchemy models in `api/app/models/` and the Alembic migration history are authoritative — this page is a map, not a schema dump.
