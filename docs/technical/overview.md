# Technical Reference Overview

This section documents Portfolium's implementation for developers, contributors, and
self-hosters who need to understand what's actually running under the hood. It is not
end-user documentation — see the [User Guide](../user-guide/) for that.

## Stack

| Layer | Technology |
| --- | --- |
| Backend framework | FastAPI (Python), Uvicorn |
| Background jobs | Celery workers + Celery Beat scheduler |
| Broker / result backend / cache | Redis |
| Database | PostgreSQL |
| ORM / migrations | SQLAlchemy 2.0, Alembic |
| Frontend | React + TypeScript, Vite, React Router, TanStack Query |
| Market data | Yahoo Finance (`yfinance`) |
| Deployment | Docker Compose |

There is no APScheduler anywhere in the current codebase — all periodic and
asynchronous work runs through Celery. The FastAPI process itself never schedules
background work; it only serves HTTP requests.

## Services and how they talk to each other

`docker-compose.yml` defines these containers, all on a single `portfolium` bridge
network:

- **db** — PostgreSQL, holds all persistent state.
- **redis** — Celery broker/result backend and application cache (price data,
  computed metrics, dashboard payloads).
- **bootstrap** — one-shot container (`python -m app.bootstrap`) that runs Alembic
  migrations and any first-run setup, then exits. `api`, `celery-worker`, and
  `celery-beat` all wait for it to complete successfully before starting.
- **api** — the FastAPI app (`app/main.py`), serving all HTTP/JSON endpoints.
- **celery-worker** — runs `celery -A app.celery_app worker` consuming the
  `default`, `high`, and `low` queues.
- **celery-beat** — runs `celery -A app.celery_app beat`, the single source of
  periodic scheduling for the whole application.
- **web** — the built React app served by Nginx, talking to `api` over
  `VITE_API_URL`.

The API and both Celery processes share the same Docker image and the same
`app/` codebase — they differ only in their container `command`. This means a
change to a service module or model is picked up by all three simultaneously on
redeploy.

## Request flow (HTTP)

1. The browser (React SPA, built with Vite) calls the API, e.g.
   `GET /portfolios/{id}/metrics`.
2. `app/main.py` wires the request through `CORSMiddleware`,
   `ObservabilityMiddleware` (request ID, structured logging, Prometheus metrics —
   see [Observability](observability.md)), and `SecurityHeadersMiddleware`.
3. FastAPI dispatches to the matching router in `app/routers/` (e.g.
   `portfolios.py`, `transactions.py`, `assets.py`, `prices.py`). Each router is
   included in `main.py` with a fixed prefix and OpenAPI tag.
4. The router calls into a service module under `app/services/` — grouped by
   domain (`market_data`, `portfolio_analytics`, `asset_intelligence`,
   `communications`, `workflows`, `platform`, `security`, `reference_data`) — which
   contains the actual business logic and talks to PostgreSQL via SQLAlchemy models
   in `app/models/`, and to Redis for cached reads where applicable.
5. Some request paths enqueue Celery tasks instead of doing work inline — for
   example, a new transaction can trigger `dashboard.warmup_portfolio_on_transaction`
   on the `high` priority queue so the next dashboard load is already warm. The HTTP
   response does not wait for that task to finish.
6. The response is serialized through Pydantic schemas and returned as JSON.

Redis is optional at startup (`REDIS_ENABLED`): if it's unreachable, the API logs a
warning and continues to run without caching rather than failing to boot.

## Background job flow (Celery)

Celery Beat (`app/celery_app.py`) holds the full periodic schedule — cron-style
entries built with `celery.schedules.crontab`, gated on
`ENABLE_BACKGROUND_TASKS`. Representative examples:

| Schedule entry | Task | Purpose |
| --- | --- | --- |
| Every N minutes, market hours | `metrics_tasks.refresh_all_portfolio_metrics` | Recompute cached portfolio metrics |
| Every 2 minutes, market hours | `cache_tasks.warmup_price_cache` | Pre-fetch prices so user requests hit cache |
| Every 5 minutes | `maintenance_tasks.check_price_alerts` | Evaluate watchlist price alerts |
| Every 10 minutes | `maintenance_tasks.check_daily_changes` | Detect daily portfolio swings for notifications |
| Daily 03:00 | `cache_tasks.cleanup_expired_cache` | Evict stale cache rows/keys |
| Daily 06:00 | `dividend_tasks.fetch_all_dividends` | Pull upcoming/pending dividends |
| Daily 06:30 | `calendar_tasks.refresh_earnings_cache` | Refresh earnings-calendar cache |
| Weekdays 16:00 | `report_tasks.send_daily_reports` | Email daily portfolio reports |
| Weekly (Sun) | `reference_data_tasks.sync_adanos_listings_task` | Sync ISIN/reference listings |

Beat only enqueues; it never executes task bodies itself. The flow for any one
entry is:

1. **Celery Beat** evaluates its schedule and publishes a task message to Redis
   (the broker) on the queue named in that entry's `options.queue`
   (`default`, `high`, or `low`).
2. **celery-worker** (started with `-Q default,high,low`, concurrency 4) picks up
   the message, and Celery signal handlers (`task_prerun`/`task_postrun` in
   `celery_app.py`) attach request-ID/task-name context and start duration timing.
3. The task body — a module in `app/tasks/` (`metrics_tasks.py`, `cache_tasks.py`,
   `insights_tasks.py`, `maintenance_tasks.py`, `dividend_tasks.py`,
   `calendar_tasks.py`, `ath_tasks.py`, `logo_tasks.py`, `reference_data_tasks.py`,
   `report_tasks.py`, `dashboard_tasks.py`) — opens its own DB session, calls the
   relevant service (e.g. `portfolio_analytics`, `market_data`), and writes results
   back to PostgreSQL and/or the Redis cache.
4. On completion, `task_postrun` records duration and outcome into Prometheus
   metrics (`portfolium_celery_task_duration_seconds`,
   `portfolium_celery_task_failures_total`) and clears the request/task context.
   Failures are also counted via the `task_failure` signal.
5. HTTP-triggered tasks (like the transaction-driven dashboard warmup) follow the
   same worker path but are published directly from a router instead of by Beat.

Tasks are routed to queues by priority (`task_routes` in `celery_app.py`): `high`
for cache warmups that affect perceived UI latency, `default` for metrics/insights
computation, `low` for cleanup and maintenance. Several tasks also carry
`task_annotations` rate limits (e.g. `10/m` for
`metrics_tasks.calculate_portfolio_metrics`) to avoid flooding the worker when many
requests arrive at once.

See [Background Jobs](background-jobs.md) for the full task/queue reference (task
signatures, retry behavior, and per-task detail) once that page is published, and
[Observability](observability.md) for the metrics and dashboards that monitor this
pipeline.

## Frontend structure

`web/src/app/App.tsx` sets up:

- `QueryClientProvider` (TanStack Query) with a 30s stale time and single-retry
  policy for all data fetching.
- `AuthProvider` and `LanguageProvider` context providers.
- `BrowserRouter` with lazy-loaded (`React.lazy`) feature pages under
  `web/src/features/` — dashboard, portfolios, transactions, assets,
  asset-research, watchlist, notifications, insights, calendar, allocation,
  charts, admin, devtools, settings.
- A public, unauthenticated route (`/p/:shareToken`) for shared portfolios,
  served alongside the authenticated app shell.

Protected routes require an authenticated session (`ProtectedRoute`); admin-only
pages (theme taxonomy, classification benchmark, dev tools) additionally require
`requireAdmin`.

## Where to go next

- [Data Models](data-models.md) — entity reference for everything under `app/models/`.
- [Pricing](pricing.md) — market data fetching, caching, and refresh scheduling.
- [Currency Conversion](currency-conversion.md) — how multi-currency portfolios are converted.
- [Logo Fetching](logo-fetching.md) — asset logo provider chain and caching.
- [Observability](observability.md) — logging, metrics, dashboards, alerts.
- [Architecture](../development/architecture.md) — contributor-facing structural overview.
