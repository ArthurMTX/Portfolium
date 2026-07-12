# API Overview

Portfolium exposes a FastAPI REST API for the web application and external integrations. The API handles authentication, portfolios, transactions, assets, market data, dashboard layouts, insights, notifications, administrative operations, and background task controls.

## Base URL

Local Docker development:

```text
http://localhost:8000
```

Production deployments should use the public API origin configured for your instance.

## Interactive References

FastAPI generates interactive references from the application schema:

| UI | Local URL |
| --- | --- |
| Swagger UI | `http://localhost:8000/docs` |
| ReDoc | `http://localhost:8000/redoc` |
| Scalar | `http://localhost:8000/scalar` |
| OpenAPI JSON | `http://localhost:8000/openapi.json` |

The repository also stores a generated copy at [openapi.json](openapi.json). Regenerate it after route or schema changes:

```bash
python scripts/export_openapi.py
```

## Authentication

Most endpoints require a JWT bearer token.

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com" \
  -d "password=your-password"
```

Then pass the token:

```http
Authorization: Bearer <access_token>
```

See [Authentication](authentication.md) for registration, current user, password recovery, 2FA, and rate-limit details.

## Primary Route Families

| Area | Routes |
| --- | --- |
| Health and version | `/`, `/health`, `/health/redis`, `/health/core`, `/version` |
| Authentication | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/2fa/*`, password recovery routes |
| Portfolios | `/portfolios`, `/portfolios/{portfolio_id}`, positions, metrics, history, goals, reports |
| Transactions | `/portfolios/{portfolio_id}/transactions`, CSV import, conversions, price/FX helpers |
| Assets | `/assets`, search, research, themes, logos, metadata overrides, distributions, price history |
| Prices | `/prices`, `/prices/quote/{symbol}`, `/prices/indices`, `/prices/refresh` |
| Dashboard layouts | `/dashboard-layouts`, default layout, duplicate, import/export |
| Insights | `/insights/{portfolio_id}`, performance, attribution, exposure, risk, benchmark, scenarios |
| Watchlist | `/watchlist`, tags, CSV import/export, price refresh, convert to buy |
| Notifications | `/notifications`, unread count, read state, deletion |
| Push | `/push/vapid-public-key`, subscriptions, test push |
| Market | `/market/sentiment/*`, `/market/vix`, `/market/tnx`, `/market/dxy` |
| Admin and tasks | `/admin/*`, `/tasks/*`, `/batch/*` |

For the detailed map, see [Endpoints](endpoints.md).

## Error Handling

Portfolium uses standard HTTP status codes:

| Code | Meaning |
| --- | --- |
| `200` | Successful request |
| `201` | Resource created |
| `204` | Successful request with no response body |
| `400` | Invalid domain request |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but not allowed, unverified, inactive, or blocked by 2FA requirements |
| `404` | Resource not found |
| `422` | FastAPI/Pydantic validation error |
| `500` | Unexpected server error |

Typical error response:

```json
{
  "detail": "Error message describing what went wrong"
}
```

## Operational Notes

- API configuration is environment-driven through `api/app/config.py`.
- CORS origins must include the frontend origin used by browsers.
- Price and market data endpoints may use Redis-backed cache entries.
- Expensive refreshes may enqueue Celery tasks or rely on Celery beat schedules.
- `/metrics` exposes Prometheus-compatible metrics and is intentionally excluded from OpenAPI.
