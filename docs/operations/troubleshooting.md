# Troubleshooting

Common issues when self-hosting Portfolium, and how to diagnose them.

## Checking Service Health

Start with the overall stack status:

```bash
docker compose ps
```

All services (`db`, `redis`, `api`, `celery-worker`, `celery-beat`, `web`) should show as healthy/running. The `bootstrap` service is expected to exit after completing its one-shot setup — that's normal, not a failure.

Check the API's health endpoint directly:

```bash
curl http://localhost/api/health
```

## Reading Logs

```bash
docker compose logs -f api            # API request handling, errors
docker compose logs -f celery-worker  # background task execution
docker compose logs -f celery-beat    # scheduled task triggering
docker compose logs -f bootstrap      # migrations and startup checks
```

Add `--tail=200` to limit output when a service has been running a while.

## Common Issues

### App Won't Start / 502 from the Web Container

- Check `docker compose logs api` for a crash on startup — often a missing or invalid environment variable
- Confirm the `bootstrap` service completed successfully (`docker compose logs bootstrap`) — if migrations failed, the API may still start but behave incorrectly against an out-of-date schema

### Database Connection Errors

- Confirm the `db` service is healthy: `docker compose ps db`
- Check that `DATABASE_URL` (or equivalent DB environment variables) match the `db` service's actual credentials
- If you changed the database password after first boot, existing data won't match — restoring from backup or resetting credentials consistently is required

### Prices Not Updating

- Check `celery-beat` is running and scheduling tasks — see [Background Jobs](../technical/background-jobs.md) for the expected schedule
- Check `celery-worker` logs for task failures (often Yahoo Finance rate-limiting — see [Pricing](../technical/pricing.md) for how the rate-limit circuit breaker behaves)
- Confirm Redis is reachable — price caching depends on it

### Redis Connection Failures

- Confirm the `redis` service is healthy and `REDIS_PASSWORD` matches between the `redis` service and whatever consumes it (`api`, `celery-worker`, `celery-beat`)
- Redis holds the Celery broker/queue and price cache — if it's unreachable, background jobs stall and price refresh falls back to stale cached/DB data

### Emails Not Sending

- Confirm SMTP settings via the [Admin Email Configuration](../admin/email-configuration.md) page or environment variables
- Check `docker compose logs api | grep -i smtp` for connection/auth errors

### Metrics & Dashboards (Prometheus/Grafana)

If you're running the optional monitoring stack (`monitoring/docker-compose.monitoring.yml`):

```bash
docker compose -f monitoring/docker-compose.monitoring.yml logs -f prometheus grafana
```

See [Observability](../technical/observability.md) for what's exported and how to interpret it.

## Getting Further Help

If logs don't point to an obvious cause, open an issue with:

- The output of `docker compose ps`
- Relevant log excerpts (redact secrets/tokens)
- Your `PORTFOLIUM_IMAGE_TAG` version

## Related

- [Installation](../getting-started/installation.md)
- [Upgrades](upgrades.md)
- [Background Jobs](../technical/background-jobs.md)
- [Observability](../technical/observability.md)
