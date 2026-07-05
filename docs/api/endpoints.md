# Endpoints

The generated OpenAPI schema is the source of truth for exact request bodies, response schemas, validation rules, and status codes:

- JSON schema in this repository: [openapi.json](openapi.json)
- Swagger UI at runtime: `http://localhost:8000/docs`
- ReDoc at runtime: `http://localhost:8000/redoc`
- Scalar at runtime: `http://localhost:8000/scalar`

Run `python scripts/export_openapi.py` after changing FastAPI routes or Pydantic schemas.

## Route Groups

| Group | Prefix | Purpose |
| --- | --- | --- |
| Health | `/health` | API health, Redis health, and core dependency health checks |
| Version | `/version` | Build and version metadata |
| Authentication | `/auth` | Registration, login, current user, password recovery, 2FA |
| Settings | `/settings` | User application settings |
| Admin | `/admin`, selected root admin paths | User administration, system actions, logs, email config, logo cache |
| Assets | `/assets` | Asset CRUD, search, research, themes, logos, distributions, prices, metadata overrides |
| Portfolios | `/portfolios` | Portfolio CRUD, positions, metrics, history, reports, goals, transactions |
| Transactions | `/portfolios/{portfolio_id}/transactions`, import paths | Buy/sell/dividend transactions, conversions, CSV import, price helpers |
| Prices | `/prices` | Quotes, index prices, refresh triggers |
| Watchlist | `/watchlist` | Watchlist CRUD, tags, CSV import/export, price refresh |
| Notifications | `/notifications` | Notification list, unread count, read state, deletion |
| Push notifications | `/push` | VAPID key, subscriptions, unsubscribe, push test |
| Insights | `/insights` | Portfolio performance, attribution, exposure, risk, benchmark, scenario views |
| Dashboard layouts | `/dashboard-layouts` | Persisted dashboard layouts, duplicate, import/export |
| Market | `/market/sentiment`, `/market/vix`, `/market/tnx`, `/market/dxy` | Market sentiment and macro indicators |
| Batch | `/batch` | Consolidated dashboard data and dashboard cache invalidation |
| Tasks | `/tasks` | Celery status, worker inspection, cache warmups, recalculation tasks |
| Public | `/public` | Shared public portfolio insights |
| Dividends | `/dividends` | Pending dividend fetch, accept/reject, bulk operations |
| Calendar | `/calendar` | Events, earnings, daily performance, holidays, exchanges |

## Common Patterns

### Authentication

Protected endpoints require:

```http
Authorization: Bearer <token>
```

See [Authentication](authentication.md) for login, 2FA, and rate-limit details.

### Pagination

List endpoints commonly use `skip` and `limit` query parameters when the backing route supports pagination.

```http
GET /assets?skip=0&limit=100
```

### Portfolio-Scoped Resources

Portfolio-scoped endpoints include the portfolio ID in the path:

```http
GET /portfolios/{portfolio_id}/positions
GET /portfolios/{portfolio_id}/metrics
GET /portfolios/{portfolio_id}/transactions
GET /insights/{portfolio_id}/summary
```

The backend enforces user ownership before returning portfolio data.

### Async Work

Endpoints that trigger expensive work may enqueue Celery tasks or return task identifiers. Use `/tasks/status`, `/tasks/workers`, and route-specific task status endpoints to inspect progress when available.

### Errors

FastAPI validation errors return `422`. Authentication failures return `401` or `403` depending on whether the token is missing, invalid, inactive, unauthorized, or blocked by 2FA requirements. Domain errors return structured `detail` messages.

## Examples

### List Portfolios

```bash
curl http://localhost:8000/portfolios \
  -H "Authorization: Bearer $PORTFOLIUM_TOKEN"
```

### Refresh Prices

```bash
curl -X POST "http://localhost:8000/prices/refresh?portfolio_id=1" \
  -H "Authorization: Bearer $PORTFOLIUM_TOKEN"
```

### Export a Dashboard Layout

```bash
curl http://localhost:8000/dashboard-layouts/1/export \
  -H "Authorization: Bearer $PORTFOLIUM_TOKEN"
```
