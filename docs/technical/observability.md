# Observability

Portfolium exposes structured backend logs and Prometheus-compatible metrics. The
monitoring stack is optional and is not required for normal local development.

## Logging

Development defaults to readable console and rotating file logs. Production uses
JSON console logs and disables the container-local log file in the supplied Compose
configuration.

Relevant environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Selects development or production defaults |
| `LOG_FORMAT` | `auto` | `readable`, `json`, or environment-aware `auto` |
| `LOG_LEVEL` | `INFO` | Root application log level |
| `LOG_FILE_ENABLED` | `true` | Enables the optional rotating log file |
| `LOG_FILE_PATH` | `logs/app.log` | Rotating log file location |

Each HTTP response contains `X-Request-ID`. Portfolium accepts a valid incoming
`X-Request-ID`, otherwise it generates one. Request logs contain the normalized
route template, method, status code, duration, and request ID. Request bodies,
authorization headers, cookies, credentials, raw API keys, and identifiers used as
portfolio data are not added to request logs.

## Start Prometheus and Grafana

Start Portfolium first, then run:

```bash
docker compose --env-file .env -f monitoring/docker-compose.monitoring.yml up -d
```

Set `GRAFANA_ADMIN_PASSWORD` before startup outside an isolated development machine.

- Portfolium metrics: internal target `api:8000/metrics`
- Celery worker metrics: <http://localhost:9809/metrics>
- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3000>
- Default local Grafana credentials: `admin` / `admin`
- PostgreSQL exporter: <http://localhost:9187/metrics>
- Redis exporter: <http://localhost:9121/metrics>
- Celery exporter: <http://localhost:9808/metrics>

Prometheus reaches the API directly over the private `portfolium` Docker
network. The public nginx path `/api/metrics` returns `403`; `/api/docs`,
`/api/scalar`, and `/api/openapi.json` intentionally remain public.

Stop only the monitoring stack with:

```bash
docker compose -f monitoring/docker-compose.monitoring.yml down
```

The monitoring stack provisions PostgreSQL, Redis, and Celery exporters. The
PostgreSQL exporter reads `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and
`POSTGRES_PORT` from the root `.env`. The Redis exporter reads `REDIS_PORT` and
`REDIS_PASSWORD`. Set `CELERY_BROKER_URL` to an authenticated Redis URL before
starting the optional monitoring stack. Reserved password characters must be
percent-encoded in that exporter URL. The API and its Celery workers instead
build encoded URLs directly from `REDIS_PASSWORD` and never fall back to
`SECRET_KEY`.

## Dashboards

Grafana automatically provisions the compatibility **Portfolium Overview** landing
dashboard plus six focused dashboards:

- **Portfolium API**: volume, average latency, p50/p95/p99, errors, status codes,
  request grouping, and top endpoint tables.
- **Portfolium Price Refresh**: Yahoo, price refresh, FX, cache, missing-price, and
  Daily Gain signals.
- **Portfolium PostgreSQL**: connection state, transactions, application query
  latency, slow queries, rows, size, cache hit ratio, and deadlocks.
- **Portfolium Redis**: memory, clients, commands, hit/miss ratios, evictions,
  expiration, network throughput, and command latency.
- **Portfolium Celery**: workers, running tasks, task outcomes, retries, queues,
  duration, longest tasks, and worker/exporter health.
- **Portfolium Business Metrics**: portfolio inventory, enabled users, transaction
  and notification activity, imports, and core business-operation latency.

## Key metrics

| Metric | Labels |
| --- | --- |
| `portfolium_http_requests_total` | `method`, `route`, `status_code` |
| `portfolium_http_request_duration_seconds` | `method`, `route` |
| `portfolium_http_errors_total` | `method`, `route`, `status_class` |
| `portfolium_price_refresh_duration_seconds` | `provider` |
| `portfolium_yfinance_calls_total` | `provider` |
| `portfolium_yfinance_failures_total` | `provider`, `reason_category` |
| `portfolium_cache_hits_total` | `cache_name` |
| `portfolium_cache_misses_total` | `cache_name` |
| `portfolium_celery_task_duration_seconds` | `task_name` |
| `portfolium_celery_task_failures_total` | `task_name` |
| `portfolium_daily_gain_reliable_total` | none |
| `portfolium_daily_gain_unavailable_total` | `reason_category` |
| `portfolium_price_assets_refreshed_total` | `provider` |
| `portfolium_missing_prices_total` | none |
| `portfolium_fx_refresh_duration_seconds` | none |
| `portfolium_fx_failures_total` | `reason_category` |
| `portfolium_business_operation_duration_seconds` | `operation` |
| `portfolium_db_query_duration_seconds` | `operation` |
| `portfolium_db_slow_queries_total` | `operation` |
| `portfolium_transactions_created_total` | none |
| `portfolium_imported_transactions_total` | none |
| `portfolium_notifications_created_total` | none |
| `portfolium_portfolios` | none |
| `portfolium_assets` | none |
| `portfolium_active_users` | none |
| `portfolium_transactions_last_24h` | none |
| `portfolium_notifications_last_24h` | none |

Routes are FastAPI route templates, never raw URLs. Cache names and failure reasons
are mapped to bounded categories. User, portfolio, asset, symbol, exception message,
and token values are not metric labels.

The supplied API container configures Prometheus multiprocess mode so both Uvicorn
workers are represented by `/metrics`. The Celery worker exposes its own
multiprocess-compatible endpoint on port `9809`. The Celery event exporter supplies
worker, queue, retry, and lifecycle metrics; task events are enabled in the Celery
configuration. Flower remains available in development for task inspection.

Database query instrumentation records only the operation class (`select`, `insert`,
`update`, `delete`, or `other`) and duration. SQL text is never exported.

## Example PromQL

Request rate:

```promql
sum by (route) (rate(portfolium_http_requests_total[5m]))
```

5xx percentage:

```promql
sum(rate(portfolium_http_errors_total{status_class="5xx"}[5m]))
/
clamp_min(sum(rate(portfolium_http_requests_total[5m])), 0.001)
```

P95 latency by route:

```promql
histogram_quantile(
  0.95,
  sum by (le, route) (rate(portfolium_http_request_duration_seconds_bucket[5m]))
)
```

Yahoo failure rate by category:

```promql
sum by (reason_category) (rate(portfolium_yfinance_failures_total[10m]))
```

Cache hit ratio:

```promql
sum by (cache_name) (rate(portfolium_cache_hits_total[5m]))
/
clamp_min(
  sum by (cache_name) (
    rate(portfolium_cache_hits_total[5m])
    + rate(portfolium_cache_misses_total[5m])
  ),
  0.001
)
```

Daily gain unavailable in the last hour:

```promql
sum by (reason_category) (increase(portfolium_daily_gain_unavailable_total[1h]))
```

Assets refreshed per minute:

```promql
sum(rate(portfolium_price_assets_refreshed_total[5m])) * 60
```

PostgreSQL connection utilization:

```promql
sum(pg_stat_activity_count{job="portfolium-postgres"})
/
max(pg_settings_max_connections{job="portfolium-postgres"})
```

Redis hit ratio:

```promql
sum(rate(redis_keyspace_hits_total{job="portfolium-redis"}[5m]))
/
clamp_min(
  sum(rate(redis_keyspace_hits_total{job="portfolium-redis"}[5m]))
  + sum(rate(redis_keyspace_misses_total{job="portfolium-redis"}[5m])),
  0.001
)
```

Celery queue backlog:

```promql
sum by (queue_name) (celery_queue_length)
```

Business-operation p95:

```promql
histogram_quantile(
  0.95,
  sum by (le, operation) (
    rate(portfolium_business_operation_duration_seconds_bucket[5m])
  )
)
```

## Recommended alerts

The included Prometheus rules cover:

- API scrape unavailable for two minutes.
- 5xx responses above 2% for ten minutes.
- overall HTTP p95 latency above two seconds for ten minutes.
- request rate dropping to zero.
- more than 20 Yahoo failures in 15 minutes.
- Yahoo refresh p95 above ten seconds.
- PostgreSQL unavailable or above 85% connection utilization.
- Redis unavailable, above 85% configured memory, or evicting keys.
- Celery exporter/worker metrics unavailable, no workers, queue backlog, or repeated failures.
- Daily Gain unavailable spikes.
- application cache hit ratio below 50%.

Production thresholds should be tuned against observed traffic. The request-rate
zero alert assumes normal continuous traffic and should be disabled for intentionally
idle installations.

## Limitations

- PostgreSQL query duration and slow-query metrics come from the application and do
  not expose SQL text. `pg_stat_statements` is intentionally not enabled by this
  stack because it requires PostgreSQL server configuration and a controlled
  database migration.
- `portfolium_active_users` means enabled users, not recent unique sessions.
- Celery event metrics begin accumulating after workers restart with task events
  enabled.
- Exporters reach the application services through published host ports. Production
  deployments with isolated networks should attach the monitoring services to the
  deployment network and use internal DNS names instead.
