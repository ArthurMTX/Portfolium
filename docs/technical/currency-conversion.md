# Currency Conversion

Technical reference for how Portfolium handles multi-currency portfolios.

## Overview

Transactions are stored in the asset's native currency (`Transaction.currency`,
usually inherited from `Asset.currency`). Portfolios have a `base_currency`
(`Portfolio.base_currency`). Nothing is converted at write time — conversion
happens on read, whenever a value needs to be expressed in the portfolio's base
currency: position values, P&L, dashboard totals, insights, and reports.

The service lives at `api/app/services/market_data/currency.py` as a static
`CurrencyService` class. There is no database table for exchange rates and no
dedicated `/api/currencies/*` router — conversion is an internal service called
from wherever FX-aware values are computed.

## Rate source

Exchange rates come from Yahoo Finance forex pairs via the shared market data
provider (`get_market_data_provider()` in `yahoo_finance.py`), using the
`{FROM}{TO}=X` symbol format (e.g. `USDEUR=X`). If that symbol returns no data,
`CurrencyService` retries the inverse pair (`{TO}{FROM}=X`) and inverts the
resulting rate (`1 / rate`).

Same-currency conversions short-circuit to a rate of `1` without any lookup.

## API surface

`CurrencyService` exposes four static methods:

| Method | Purpose |
| --- | --- |
| `get_exchange_rate(from_currency, to_currency)` | Latest available rate (today) |
| `convert(amount, from_currency, to_currency)` | Convert an amount using the latest rate |
| `get_historical_exchange_rate(from_currency, to_currency, date)` | Rate for a specific date |
| `convert_historical(amount, from_currency, to_currency, date)` | Convert an amount using a historical rate |

`get_historical_exchange_rate` fetches a small window around the requested date
(`date - 5 days` to `date + 2 days`) and picks the closest available trading day,
since forex data (like equities) can have gaps around holidays. `convert`/
`convert_historical` both return `None` (never raise) if no rate is available, so
every caller must explicitly handle a missing conversion.

There is one HTTP endpoint that exposes this directly:
`GET /portfolios/{portfolio_id}/fx_rate?from_currency=...&to_currency=...&as_of_date=...`
(`api/app/routers/transactions.py`), used by the frontend to preview a
historical FX rate — for example when entering a dividend per-share in the
asset's currency but displaying the total in the portfolio's base currency. It
returns `404` if no rate can be found for that pair/date.

## Caching

Rates are cached in-memory (module-level dicts in `currency.py`), not in Redis
or PostgreSQL:

| Cache | TTL | Keyed by |
| --- | --- | --- |
| `_exchange_rate_cache` | 4 hours | `{from}{to}` |
| `_historical_exchange_rate_cache` | 7 days | `{from}{to}:{date}` |

Because the cache is per-process, it is not shared between the API workers and
the Celery worker/beat processes, and it is cleared on restart. `CurrencyService.
clear_cache()` clears it manually if needed (e.g. in a debugging shell).

### Stale-cache fallback under rate limiting

Currency lookups share the Yahoo Finance rate-limit circuit breaker used by
price fetching (`app.services.market_data.pricing.is_rate_limited` /
`set_rate_limited`, see [Pricing](pricing.md)). If yfinance is currently
rate-limited:

- A fresh, non-expired cache entry is returned as usual.
- An **expired** cache entry is still returned rather than making a live call
  (better a slightly stale FX rate than a failed request), and this is recorded
  via `record_stale_fallback("fx", reason="rate_limited", ...)` for observability.
- If there's no cache entry at all, the call returns `None`, with repeated
  "no cached rate" warnings throttled to once per 5 minutes per currency pair.

The same stale-fallback behavior applies on any fetch exception or empty
response from Yahoo (`reason="fetch_failed"` / `reason="no_data"`), not just
active rate-limiting — a failed live lookup with a cached (even expired) rate
falls back to that cached value instead of surfacing `None`.

A failed or rate-limit-flavored exception during an FX fetch also trips the
shared circuit breaker (`set_rate_limited(60)`), so a currency-pair failure can
temporarily suppress live price fetches too, and vice versa.

## Where conversion happens

`CurrencyService` is called from:

- `app/routers/transactions.py` — `fetch_price` and `add_position_transaction`
  helpers convert a fetched price from the asset's currency into the portfolio's
  base currency before storing/returning it; `fx_rate` exposes historical rates
  to the UI.
- `app/services/portfolio_analytics/metrics.py` — the bulk of the usage: position
  values, cost basis, realized/unrealized P&L, all-time-high display values, and
  per-transaction conversions all call `convert` or `convert_historical` as
  metrics are computed.
- `app/services/portfolio_analytics/position_details.py` — per-position detail
  views (current value, ATH) convert to base currency for display.
- `app/services/portfolio_analytics/insights.py` — historical conversions feed
  portfolio insights that span multiple currencies.

Conversion is applied at read/compute time on every call — there is no persisted
"converted value" column. If the asset currency equals the portfolio's base
currency, no conversion call is made at all.

## Failure behavior

If a rate genuinely cannot be obtained (no cache, live fetch fails, and no
inverse pair works either), `convert`/`convert_historical` return `None`. Callers
in `metrics.py` generally fall back to using the unconverted value with a warning
log rather than failing the whole metrics calculation — a multi-currency
portfolio metric can therefore occasionally show one position in its original
currency if FX data is temporarily unavailable for that pair.

## Related documentation

- [Pricing](pricing.md) — the shared Yahoo Finance provider and rate-limit circuit breaker.
- [Data Models](data-models.md) — `Portfolio.base_currency` and `Transaction.currency` fields.
- [Observability](observability.md) — `portfolium_fx_refresh_duration_seconds` and `portfolium_fx_failures_total` metrics.
