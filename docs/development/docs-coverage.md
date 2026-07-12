# Documentation Coverage

This page is the maintenance map for Portfolium's documentation. Keep it close to the code: when a feature, API surface, background task, or deployment setting changes, update the matching documentation page in the same pull request.

## Current Status

| Area | Status | Source of truth | Documentation |
| --- | --- | --- | --- |
| Local and Docker installation | Complete | `docker-compose.yml`, `docker-compose.dev.yml`, `web/Dockerfile`, `api/Dockerfile` | [Installation](../getting-started/installation.md), [Quick Start](../getting-started/quick-start.md) |
| Runtime configuration | Partial | `api/app/config.py`, compose files | [Configuration](../getting-started/configuration.md) |
| User workflows | Partial | `web/src/features/*` | [User Guide](../user-guide/portfolios.md) |
| Widgets | Complete enough for users | `web/src/features/dashboard`, `web/src/features/dashboard-overview` | [Widgets](../widgets/index.md) |
| Detailed metrics | Complete enough for users | `api/app/services/portfolio_analytics` | [Detailed Metrics](../detailed-metrics/index.md) |
| API reference | Generated, narrative partial | `api/app/routers/*`, FastAPI OpenAPI | [API Overview](../api/overview.md), [Endpoints](../api/endpoints.md), [OpenAPI JSON](../api/openapi.json) |
| Authentication and 2FA | Partial | `api/app/auth.py`, `api/app/routers/auth.py`, `api/app/services/security` | [Authentication](../api/authentication.md) |
| Price fetching and caching | Good | `api/app/services/market_data/pricing.py`, `api/app/tasks/cache_tasks.py` | [Pricing](../technical/pricing.md) |
| Logo fetching and overrides | Needs regular review | `api/app/services/market_data/logo_resolver.py`, `trade_republic_logos.py`, `logos.py` | [Logo Fetching](../technical/logo-fetching.md), [Asset Metadata Overrides](../technical/asset-metadata-overrides.md) |
| Currency conversion | Good | `api/app/services/market_data/currency.py` | [Currency Conversion](../technical/currency-conversion.md) |
| Stock splits | Good | `api/app/services/market_data/yahoo_finance.py`, split-related tasks/tests | [Stock Splits](../technical/stock-splits.md) |
| Data model | Partial | `api/app/models/*`, Alembic migrations | [Data Models](../technical/data-models.md) |
| Observability | Good | `api/app/observability/*`, `monitoring/` | [Observability](../technical/observability.md) |
| Background jobs | Partial | `api/app/tasks/*`, `api/app/celery_app.py` | [Architecture](architecture.md), technical pages |
| Testing strategy | Complete baseline | `api/tests/*`, `web/src/**/*.test.*`, `web/package.json` | [Testing](testing.md) |
| Contribution process | Partial | `Makefile`, CI workflows | [Contributing](contributing.md) |

## Definition of Done

A feature is documented when:

- users can find the workflow from the User Guide or feature section;
- operators know the required environment variables, background jobs, and failure modes;
- developers know the relevant modules, tests, and data ownership rules;
- API changes are reflected in `docs/api/openapi.json`;
- `mkdocs build --strict` and `scripts/check_docs_health.py` pass.

## High-Priority Gaps

| Priority | Gap | Recommended next update |
| --- | --- | --- |
| P0 | API reference has generated schema but limited examples | Add request/response examples for the most used routes: portfolios, assets, transactions, prices, dashboard layouts. |
| P0 | Configuration page should mirror every important `Settings` field | Convert `api/app/config.py` into a grouped table with defaults, production guidance, and sensitivity notes. |
| P1 | Background task behavior is scattered | Add a dedicated Celery/background jobs page covering queues, schedules, retry behavior, and Flower. |
| P1 | Data model page should track Alembic-backed changes | Add entity diagrams and ownership notes for portfolios, assets, prices, transactions, goals, notifications, and users. |
| P1 | Screenshots are present in the repo but underused | Add current screenshots to the homepage, dashboard, transactions, assets, watchlist, insights, and gallery pages. |
