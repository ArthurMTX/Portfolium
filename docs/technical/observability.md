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
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

Set `GRAFANA_ADMIN_PASSWORD` before startup outside an isolated development machine.

- Portfolium metrics: <http://localhost:8000/metrics>
- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3000>
- Default local Grafana credentials: `admin` / `admin`

The monitoring Compose file reaches the published API port through
`host.docker.internal`. On Linux this mapping is provisioned with Docker's
`host-gateway`.

Stop only the monitoring stack with:

```bash
docker compose -f monitoring/docker-compose.monitoring.yml down
```

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

Routes are FastAPI route templates, never raw URLs. Cache names and failure reasons
are mapped to bounded categories. User, portfolio, asset, symbol, exception message,
and token values are not metric labels.

The supplied API container configures Prometheus multiprocess mode so both Uvicorn
workers are represented by `/metrics`. Celery emits task metrics in worker
processes, but the default monitoring stack does not scrape worker-local registries.
Use a Celery exporter or a separate worker metrics endpoint when cross-process task
metrics are required in Prometheus; Flower remains available in development for
operational task inspection.

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

## Recommended alerts

The included Prometheus rules cover:

- API scrape unavailable for two minutes.
- 5xx responses above 5% for ten minutes.
- overall HTTP p95 latency above two seconds for ten minutes.
- more than 20 Yahoo failures in 15 minutes.

Production thresholds should be tuned against observed traffic. Additional useful
alerts are sustained cache hit-ratio degradation, repeated daily-gain
`previous_close_unavailable` results, and stale critical Celery jobs from
`/health/core`.
