# Architecture

Portfolium is a self-hosted portfolio management system composed of a React web application, a FastAPI backend, PostgreSQL, Redis, and Celery workers. The production Docker stack runs the web, API, database, Redis, bootstrap, worker, and beat services as separate containers.

## Runtime Topology

```text
Browser
  |
  v
web / nginx
  |-- serves React app
  |-- serves MkDocs at /docs
  v
FastAPI API
  |-- PostgreSQL for durable data
  |-- Redis for cache, Celery broker, and Celery result backend
  |-- Celery workers for async work
  |-- Celery beat for schedules
```

The production entrypoint is `docker-compose.yml`. Local development uses `docker-compose.dev.yml`, which mounts the backend source into the API and worker containers and exposes Vite on port `5173`.

## Main Services

| Service | Responsibility | Key files |
| --- | --- | --- |
| `web` | React application, static assets, embedded docs, nginx routing | `web/src`, `web/Dockerfile`, `web/nginx.conf` |
| `api` | REST API, auth, validation, orchestration, observability middleware | `api/app/main.py`, `api/app/routers/*`, `api/app/config.py` |
| `db` | PostgreSQL persistence | `db/`, `api/alembic/versions/*`, `api/app/models/*` |
| `redis` | Cache, Celery broker, Celery result backend | `api/app/redis_client.py`, `api/app/services/platform/cache.py` |
| `celery-worker` | Async jobs for metrics, pricing, reports, logos, insights, calendars, maintenance | `api/app/tasks/*`, `api/app/celery_app.py` |
| `celery-beat` | Periodic scheduling | `api/app/celery_app.py` |
| `bootstrap` | First-run initialization and migrations | `api/app/bootstrap.py`, `api/app/services/platform/migrations.py` |

## Backend Layout

```text
api/app/
├── routers/              # HTTP route groups
├── services/             # Business logic grouped by domain
├── crud/                 # Database access helpers
├── models/               # SQLAlchemy models
├── tasks/                # Celery task entrypoints
├── observability/        # Logging, metrics, request/task context
├── auth.py               # JWT, password hashing, auth dependencies
├── config.py             # Environment-driven settings
└── main.py               # FastAPI application assembly
```

Routes should stay thin: validate inputs, enforce authentication/authorization, call CRUD or service modules, and return schemas. Domain logic belongs under `api/app/services`, and long-running work belongs in Celery tasks.

## Frontend Layout

```text
web/src/
├── app/                  # App shell, providers, routing, layout
├── api/                  # Typed API client modules
├── features/             # Product feature modules
├── shared/               # Shared components and utilities
├── assets/layouts/       # Dashboard layout examples
└── locales/              # English and French translations
```

Feature code is grouped by product area: portfolios, transactions, dashboard, assets, watchlist, insights, notifications, settings, admin, charts, calendar, and auth. Shared UI primitives live under `web/src/shared`.

## Data Flow

1. The user interacts with the React app.
2. Frontend API modules call FastAPI with a JWT bearer token.
3. Routers validate the request and use CRUD/services for database work.
4. Market data services fetch or cache prices, fundamentals, calendars, logos, and currency rates.
5. Celery handles expensive refreshes and periodic work.
6. Redis stores cache entries, Celery messages, and task results.
7. PostgreSQL remains the durable source for users, portfolios, assets, transactions, settings, notifications, and dashboard layouts.

## Background Jobs

Celery is configured in `api/app/celery_app.py`. The worker imports task modules for:

- portfolio metrics and insights;
- dashboard cache warmups;
- price and market data cache maintenance;
- daily reports and email work;
- dividend and calendar refreshes;
- ATH/ATL checks;
- logo refreshes;
- reference data maintenance.

Celery beat is the only scheduler. API workers do not schedule periodic jobs at startup, which keeps HTTP startup predictable and avoids duplicate scheduling when multiple API containers run.

## Observability

FastAPI uses `ObservabilityMiddleware` and `SecurityHeadersMiddleware`. Prometheus-compatible metrics are exposed at `/metrics`, health endpoints are exposed under `/health`, and Celery workers can expose task metrics on `CELERY_METRICS_PORT`.

For more details, see [Observability](../technical/observability.md).

## Documentation Architecture

The documentation is built with MkDocs Material. The web Docker image builds it into the React public directory and nginx serves it at `/docs`.

Documentation quality gates live in:

- `docs/requirements.txt`
- `scripts/export_openapi.py`
- `scripts/check_docs_health.py`
- `.github/workflows/quality.yml`

Run:

```bash
pip install -r docs/requirements.txt -e ./api
make docs-check
```
