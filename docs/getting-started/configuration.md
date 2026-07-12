# Configuration

All configuration is done through environment variables, typically set in a `.env` file used by `docker-compose.yml`. This page mirrors `api/app/config.py`, the single source of truth for defaults.

## Database

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `portfolium` | Database name |
| `POSTGRES_USER` | `portfolium` | Database user |
| `POSTGRES_PASSWORD` | `portfolium` | Database password |
| `POSTGRES_HOST` | `db` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |

!!! danger "Change the default password"
    `portfolium` is a placeholder default, not a secure production value. Always set a strong `POSTGRES_PASSWORD`.

## API & Security

| Variable | Default | Description |
|---|---|---|
| `API_HOST` | `0.0.0.0` | API bind host |
| `API_PORT` | `8000` | API port |
| `API_KEY` | `dev-key-12345` | Internal API key |
| `SECRET_KEY` | *(placeholder)* | JWT signing key — must be at least 32 characters |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | $10080$ ($7$ days) | Login session lifetime |
| `ALLOW_REGISTRATION` | `true` | Allow new users to self-register |

!!! danger "Generate a real SECRET_KEY"
    Never use the default in production — generate a strong random value and never commit it to version control.

### Rate Limiting (Auth Endpoints)

| Variable | Default | Description |
|---|---|---|
| `AUTH_RATE_LIMIT_ENABLED` | `true` | Master switch for auth rate limiting |
| `AUTH_LOGIN_RATE_LIMIT` / `AUTH_LOGIN_RATE_WINDOW_SECONDS` | $10$ / $300$s | Login attempts per window |
| `AUTH_REGISTER_RATE_LIMIT` / `AUTH_REGISTER_RATE_WINDOW_SECONDS` | $5$ / $3600$s | Registrations per window |
| `AUTH_RECOVERY_RATE_LIMIT` / `AUTH_RECOVERY_RATE_WINDOW_SECONDS` | $5$ / $3600$s | Password recovery requests per window |
| `AUTH_TOKEN_RATE_LIMIT` / `AUTH_TOKEN_RATE_WINDOW_SECONDS` | $20$ / $3600$s | Token refresh calls per window |
| `AUTH_2FA_RATE_LIMIT` / `AUTH_2FA_RATE_WINDOW_SECONDS` | $10$ / $600$s | 2FA verification attempts per window |

### Browser Security Headers

| Variable | Default | Description |
|---|---|---|
| `SECURITY_HEADERS_ENABLED` | `true` | Send CSP/HSTS/security headers |
| `CONTENT_SECURITY_POLICY` | *(strict default policy)* | Full CSP header value |
| `HSTS_MAX_AGE_SECONDS` | $31536000$ ($1$ year) | HSTS max-age |

### Reverse Proxy / Client IP

| Variable | Default | Description |
|---|---|---|
| `TRUSTED_PROXY_IPS` | *(empty)* | Comma-separated trusted proxy IPs/CIDRs — required before `X-Forwarded-For`/`X-Real-IP` are honored |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000,http://localhost:8080` | Allowed frontend origins |

See [Reverse Proxy & HTTPS](../operations/reverse-proxy-https.md) for deployment guidance.

## Admin Bootstrap

The first admin user is created automatically on startup by the `bootstrap` service.

| Variable | Default | Description |
|---|---|---|
| `ADMIN_AUTO_CREATE` | `true` | Create the admin user automatically if missing |
| `ADMIN_EMAIL` | *(none)* | Admin email address |
| `ADMIN_USERNAME` | *(none)* | Admin username |
| `ADMIN_PASSWORD` | *(none)* | Admin password |
| `ADMIN_FULL_NAME` | *(none)* | Admin display name |
| `ADMIN_IS_ACTIVE` / `ADMIN_IS_VERIFIED` | `true` / `true` | Initial account flags |

!!! warning "Change the default admin password"
    Log in and change the admin password immediately after first setup.

## Email (SMTP)

| Variable | Default | Description |
|---|---|---|
| `ENABLE_EMAIL` | `false` | Master switch for email sending |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` / `SMTP_PASSWORD` | *(empty)* | SMTP credentials |
| `SMTP_TLS` | `true` | Use TLS |
| `FROM_EMAIL` | `noreply@example.com` | Sender address |
| `FROM_NAME` | `Portfolium` | Sender display name |
| `FRONTEND_URL` | `http://localhost:5173` | Used to build links in emails |

!!! tip "Gmail App Passwords"
    For Gmail, create an [App Password](https://support.google.com/accounts/answer/185833) instead of using your account password.

These can also be viewed and tested at runtime from [Admin → Email Configuration](../admin/email-configuration.md).

## Web Push Notifications (VAPID)

| Variable | Default | Description |
|---|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | *(empty)* | Base64-encoded VAPID key pair |
| `VAPID_CLAIMS_EMAIL` | `mailto:admin@example.com` | Contact email required by the VAPID spec |

Without valid VAPID keys, push notifications cannot be offered — see [Push Notifications](../technical/push-notifications.md).

## Market Data & Pricing

| Variable | Default | Description |
|---|---|---|
| `PRICE_CACHE_TTL_SECONDS` | $300$ | Base price cache TTL (market-hours-aware; see [Pricing](../technical/pricing.md)) |
| `PRICE_BATCH_MIN_INTERVAL` | $2.0$s | Minimum interval between batched provider requests |
| `PRICE_MAX_BACKOFF_SECONDS` | $120.0$s | Max backoff when rate-limited |
| `YFINANCE_TZ_CACHE_DIR` | `/tmp/portfolium/py-yfinance` | Timezone cache directory used by the market data library |
| `BRANDFETCH_API_KEY` | *(empty)* | Optional — enables Brandfetch as a logo fallback provider (see [Logo Fetching](../technical/logo-fetching.md)) |

## Asset Theme Classification

| Variable | Default | Description |
|---|---|---|
| `ASSET_THEME_CLASSIFIER_MODE` | `minilm` | `minilm` (local, free) or `gemini` (LLM-based) |
| `GEMINI_API_KEY` | *(empty)* | Required only when mode is `gemini` |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Gemini model name |
| `GEMINI_TIMEOUT_SECONDS` / `GEMINI_MAX_RETRIES` | $20$ / $2$ | Gemini request tuning |
| `ASSET_THEME_GEMINI_STRATEGY` | `one_pass` | Classification strategy |
| `ASSET_THEME_TWO_PASS_CLASSIFICATION` | `false` | Enable a second refinement pass |
| `ASSET_THEME_SUBTHEME_GAP_SUGGESTIONS_ENABLED` | `false` | Let the classifier propose new subtheme taxonomy entries |
| `THEME_MINILM_MODEL_PATH` | *(empty)* | Optional path to a local MiniLM model directory |
| `THEME_MINILM_AUTO_DOWNLOAD` | `true` | Auto-download MiniLM assets if missing |
| `THEME_MINILM_TOP_K` | $15$ | Candidate count used during MiniLM retrieval |

See [Asset Themes](../technical/asset-themes.md) for how classification works.

## Redis

| Variable | Default | Description |
|---|---|---|
| `REDIS_ENABLED` | `true` | Enable Redis-backed caching/queues |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` | `redis` / `6379` / `0` | Connection target |
| `REDIS_PASSWORD` | *(empty)* | Redis password |
| `REDIS_MAX_CONNECTIONS` | $50$ | Connection pool size |
| `REDIS_SOCKET_TIMEOUT` / `REDIS_SOCKET_CONNECT_TIMEOUT` | $5$s / $5$s | Socket timeouts |

## Celery & Background Tasks

| Variable | Default | Description |
|---|---|---|
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | *(derived from Redis settings)* | Override only for a non-default broker/backend |
| `CELERY_TASK_ALWAYS_EAGER` | `false` | Run tasks synchronously — testing only |
| `CELERY_TASK_TRACK_STARTED` | `true` | Track task start state |
| `CELERY_TASK_TIME_LIMIT` | $300$s | Max time per task |
| `CELERY_WORKER_PREFETCH_MULTIPLIER` | $4$ | Worker prefetch tuning |
| `CELERY_WORKER_MAX_TASKS_PER_CHILD` | $1000$ | Worker recycling threshold |
| `CELERY_METRICS_PORT` | $9809$ | Prometheus metrics port for Celery |
| `ENABLE_BACKGROUND_TASKS` | `true` | Master switch for scheduled tasks |
| `METRICS_REFRESH_INTERVAL_MINUTES` | $5$ | Portfolio metrics refresh cadence |
| `INSIGHTS_REFRESH_INTERVAL_MINUTES` | $10$ | Insights refresh cadence |
| `MARKET_HOURS_START` / `MARKET_HOURS_END` | $9$ / $16$ | Reference market hours (ET) used for scheduling heuristics |

See [Background Jobs](../technical/background-jobs.md) for the full task/schedule reference.

## Notifications

| Variable | Default | Description |
|---|---|---|
| `NOTIFICATIONS_RETENTION_DAYS` | $30$ | Auto-delete notifications older than N days ($0$ disables cleanup) |
| `VALIDATE_SELL_QUANTITY` | `true` | Prevent selling more shares than currently held |

## Observability

| Variable | Default | Description |
|---|---|---|
| `ENVIRONMENT` | `development` | Deployment environment label |
| `TESTING` | `false` | Test-mode flag |
| `LOG_LEVEL` | `INFO` | Log verbosity |
| `LOG_FORMAT` | `auto` | `auto`, `json`, or `readable` |
| `LOG_FILE_ENABLED` | `true` | Write logs to file in addition to stdout |
| `LOG_FILE_PATH` | `logs/app.log` | Log file location |
| `LOG_FILE_MAX_BYTES` / `LOG_FILE_BACKUP_COUNT` | $5$ MB / $5$ | Log rotation settings |

See [Observability](../technical/observability.md) for what's exported to Prometheus/Grafana.

## Next Steps

- [Installation](installation.md)
- [Documentation Workflow](../development/documentation.md)
- [API Overview](../api/overview.md)
- [Operations: Troubleshooting](../operations/troubleshooting.md)
