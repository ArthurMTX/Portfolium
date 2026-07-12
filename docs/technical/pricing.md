# Price Fetching & Caching

How Portfolium fetches, caches, and refreshes market prices.

## Overview

Prices come from Yahoo Finance (`yfinance`), fetched through `PricingService` in `api/app/services/market_data/pricing.py`. Because Yahoo Finance enforces unofficial rate limits, the service is built around minimizing outbound calls: multi-level caching, request deduplication, batch downloads, and a circuit breaker for rate-limit backoff.

## Caching Layers

A price lookup checks these layers in order, falling back only when the previous one misses:

1. **Redis cache** — fastest path, shared across all API and Celery worker processes. TTL is market-hours aware (see below).
2. **Database cache** — persists across restarts; used when Redis misses but a fresh-enough row exists in `prices`.
3. **Stale database cache** — if no fresh data exists, a stale row is returned immediately while a refresh is triggered in the background, so requests never block waiting on Yahoo Finance.
4. **Provider fetch** — Yahoo Finance is only called when none of the above can satisfy the request.

### Market-Aware TTL

Cache lifetime adapts to whether the relevant market is open, via `MarketAwareCacheTTL` (`api/app/services/market_data/market_calendar.py`), which uses the `exchange-calendars` library for real trading-session data across 50+ exchanges:

| Condition | TTL |
|---|---|
| Market open | $300$ s ($5$ min) |
| After-hours (within $4$ hours of close) | $1800$ s ($30$ min) |
| Weekend / holiday | $14400$ s ($4$ hours) |
| Crypto (trades 24/7) | $300$ s ($5$ min) |

### Request Deduplication

If two requests ask for the same symbol at the same time, only one Yahoo Finance call is made — the second request awaits the first's in-flight result instead of triggering a duplicate fetch. Each fetch has a timeout ($20$ s outer, $15$ s when reusing an in-flight fetch); a stale cached quote is returned if it times out rather than failing the request.

## Rate-Limit Circuit Breaker

Yahoo Finance rate limits are handled with a Redis-backed circuit breaker shared across all API and worker processes:

- Batch requests are throttled to at least `PRICE_BATCH_MIN_INTERVAL` seconds apart (default $2.0$ s).
- On a rate-limit response, the breaker opens for a backoff period, capped at `PRICE_MAX_BACKOFF_SECONDS` (default $120$ s).
- While the breaker is open, requests fall back to cached/stale data instead of calling the provider again.

## Batch Fetching

`get_multiple_prices()` fetches many symbols in a single batched download rather than one request per symbol, which is what portfolio-wide refreshes use — refreshing a 50-asset portfolio costs one batch call, not 50 individual ones.

## Background Refresh (Celery)

Price warming and cache maintenance run as scheduled Celery tasks (`api/app/tasks/cache_tasks.py`), not on the request path:

- **`warmup_price_cache`** — proactively refreshes prices for actively-tracked symbols.
- **`warmup_specific_symbols`** — refreshes a targeted list of symbols on demand.
- **`warmup_public_portfolios`** — keeps cached data fresh for portfolios exposed via [public sharing](../user-guide/public-sharing.md), so visitors don't trigger a live fetch.
- **`cleanup_expired_cache`** — clears stale cache entries.
- **`invalidate_portfolio_cache`** — drops cached data for a specific portfolio when its holdings change.
- **`get_cache_statistics`** — reports cache hit/miss figures for observability.

See [Background Jobs](background-jobs.md) for the full Celery task and schedule reference.

## Historical Data

`ensure_historical_prices()` checks what daily bars already exist for an asset in a date range and fetches only the missing days from Yahoo Finance, backfilling the database rather than re-fetching data that's already stored. This is what powers portfolio history charts and long-lookback risk metrics.

## Daily Change Calculation

Daily change is computed against the official previous close (not just the last cached price), falling back to a dedicated previous-close fetch when needed, so the percentage shown matches what you'd see on a financial data terminal even around market open/close transitions and dividend ex-dates.

## Related

- [Currency Conversion](currency-conversion.md) — converts fetched prices into a portfolio's base currency
- [Stock Splits](stock-splits.md) — how split events adjust historical price series
- [Background Jobs](background-jobs.md) — full Celery schedule
- [Observability](observability.md) — price refresh metrics
