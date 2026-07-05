# Background Jobs

Portfolium runs scheduled and on-demand work through Celery, with Redis as the broker/result backend. This page lists the real task modules and their schedule (Celery beat), defined in `api/app/celery_app.py`.

## Task Modules

| Module | Responsibility |
|---|---|
| `app.tasks.metrics_tasks` | Recomputes portfolio metrics (value, P&L, allocations) |
| `app.tasks.insights_tasks` | Refreshes the [Insights](../user-guide/insights.md) analytics blocks |
| `app.tasks.cache_tasks` | Price cache warmup/cleanup — see [Pricing](pricing.md) |
| `app.tasks.dashboard_tasks` | Warms dashboard widget data for active users |
| `app.tasks.report_tasks` | Generates and emails [Daily Reports](../user-guide/daily-reports.md) |
| `app.tasks.maintenance_tasks` | Price alerts, daily-change notifications, notification cleanup, historical price backfill and gap detection |
| `app.tasks.dividend_tasks` | Detects and expires [pending dividends](../user-guide/transactions.md#pending-dividends) |
| `app.tasks.calendar_tasks` | Refreshes the earnings [Calendar](../user-guide/calendar.md) cache |
| `app.tasks.ath_tasks` | Backfills all-time high/low tracking |
| `app.tasks.logo_tasks` | Fetches and caches asset logos — see [Logo Fetching](logo-fetching.md) |
| `app.tasks.reference_data_tasks` | Syncs exchange listing reference data — see [Reference Data & ISIN](reference-data-isin.md) |

## Beat Schedule

All times are in the scheduler's configured timezone (UTC unless overridden).

| Task | Schedule | Purpose |
|---|---|---|
| `refresh_all_portfolio_metrics` | Frequent during market hours, less frequent off-hours | Keeps portfolio value/P&L current |
| `refresh_all_portfolio_insights` | Every `INSIGHTS_REFRESH_INTERVAL_MINUTES` | Recomputes Insights analytics |
| `warmup_price_cache` | Frequent during market hours, less frequent off-hours | Pre-fetches prices for actively tracked assets |
| `warmup_active_dashboards` | Frequent during market hours, less frequent off-hours | Pre-warms dashboard data so pages load fast |
| `warmup_public_portfolios` | Every $20$ min | Keeps [publicly shared](../user-guide/public-sharing.md) portfolios' data fresh for visitors |
| `check_price_alerts` | Every $5$ min | Triggers watchlist/portfolio price alerts |
| `check_daily_changes` | Every $10$ min | Triggers daily-change notifications |
| `cleanup_expired_cache` | Daily at $3$:00 | Removes stale cache entries |
| `cleanup_old_notifications` | Daily at $3$:00 | Prunes old notifications per retention policy |
| `fetch_daily_closing_prices` | Weekdays at $17$:00 | Captures the official daily close |
| `backfill_ath_from_yfinance` | Weekdays at $17$:30 | Updates all-time high/low records |
| `send_daily_reports` | Weekdays at $16$:00 | Sends the [Daily Portfolio Report](../user-guide/daily-reports.md) email |
| `fetch_all_dividends` | Daily at $6$:00 | Detects new dividend payments into the pending queue |
| `refresh_earnings_cache` | Daily at $6$:30 | Refreshes upcoming earnings dates |
| `expire_old_pending_dividends` | Weekly, Sunday at $2$:00 | Expires unreviewed pending dividends |
| `detect_and_fill_price_gaps` | Weekly, Sunday at $3$:00 | Backfills missing historical price data |
| `sync_adanos_listings_task` | Weekly, Sunday at $4$:00 | Syncs exchange/ISIN reference data |

## Queues

Tasks are routed to named queues (`default`, `low`, etc.) with `expires` set on most schedule entries so a delayed task doesn't run long after it's no longer useful (for example, a price refresh queued behind an outage).

## Monitoring

Flower is available in the dev stack at `http://localhost:5555` for inspecting queues, task history, and worker status. See [Observability](observability.md) for metrics (`CELERY_TASK_DURATION`, `CELERY_TASK_FAILURES`) exported to Prometheus.
