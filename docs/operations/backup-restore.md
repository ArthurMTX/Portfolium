# Backup & Restore

Portfolium keeps all durable state in two Docker named volumes: the PostgreSQL
data directory and the Redis append-only file. This guide covers backing up
and restoring both in a Docker Compose deployment.

## What holds state

From the production `docker-compose.yml`:

| Volume | Mounted in | Contents |
| --- | --- | --- |
| `postgres_data` | `db` service, at `/var/lib/postgresql/data` | All application data: users, portfolios, transactions, prices, settings |
| `redis_data` | `redis` service, at `/data` | Celery broker/result backend queues and cached data (append-only file, `--appendonly yes`) |

There is no separate volume for uploaded files or logos — asset logos are
resolved on demand through the API (`/assets/logo/...`, proxied by nginx at
`/logos/`) and cached in nginx's `brandfetch_cache` proxy cache directory
inside the `web` container, not in a named volume. That cache is disposable:
losing it only means logos are re-fetched and re-cached.

The container names referenced below (`portfolium-db`, `portfolium-redis`,
`portfolium-api`) come directly from `container_name` in `docker-compose.yml`.

Redis is only a broker/cache for Celery in this deployment (queues, task
results, price cache). It does not hold anything that isn't reproducible from
PostgreSQL and external price sources, so most operators only need to back up
`postgres_data` on a schedule and can treat `redis_data` as best-effort.

## PostgreSQL: logical backup with `pg_dump`

A logical dump (`pg_dump`) is the recommended default: it's portable across
minor PostgreSQL versions, easy to inspect, and works whether or not the stack
is running.

### Back up

```bash
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-portfolium}" \
  -d "${POSTGRES_DB:-portfolium}" \
  --format=custom \
  --file=/tmp/portfolium.dump

docker compose cp db:/tmp/portfolium.dump ./portfolium-$(date +%Y%m%d-%H%M%S).dump
```

`--format=custom` produces a compressed archive that works with `pg_restore`
and supports selective/parallel restore. Substitute your actual `POSTGRES_USER`
and `POSTGRES_DB` values from `.env` if you changed them from the defaults.

For a quick plain-SQL dump instead (human-readable, restorable with `psql`):

```bash
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-portfolium}" \
  -d "${POSTGRES_DB:-portfolium}" \
  > portfolium-$(date +%Y%m%d-%H%M%S).sql
```

### Restore

Restoring into a running stack (target database already exists, e.g.
disaster recovery onto a fresh `postgres_data` volume that has already gone
through first-boot initialization):

```bash
# Copy the dump into the container
docker compose cp ./portfolium-20260705-0000.dump db:/tmp/portfolium.dump

# Restore (--clean drops existing objects first, --if-exists avoids errors
# on a database that doesn't have every object yet)
docker compose exec -T db pg_restore \
  -U "${POSTGRES_USER:-portfolium}" \
  -d "${POSTGRES_DB:-portfolium}" \
  --clean --if-exists \
  /tmp/portfolium.dump
```

For a plain-SQL dump:

```bash
docker compose exec -T db psql \
  -U "${POSTGRES_USER:-portfolium}" \
  -d "${POSTGRES_DB:-portfolium}" \
  < portfolium-20260705-0000.sql
```

!!! warning "Stop writers before restoring"
    Stop `api`, `celery-worker`, and `celery-beat` before restoring so nothing
    writes to the database mid-restore:
    ```bash
    docker compose stop api celery-worker celery-beat
    # ... restore ...
    docker compose start api celery-worker celery-beat
    ```

### Schema/version compatibility after restore

Portfolium tracks its schema version with Alembic (`api/alembic/versions`,
recorded in the `portfolio.alembic_version` table). A dump restored from an
**older** Portfolium version will have an older schema revision than the
application you're running expects.

- If you're restoring onto the **same application version** the dump was
  taken from, no migration step is needed — the schema already matches.
- If you're restoring onto a **newer** application version, the `bootstrap`
  one-shot container (which runs automatically before `api`, `celery-worker`,
  and `celery-beat` start — see `docker-compose.yml`'s `depends_on:
  bootstrap: condition: service_completed_successfully`) will run
  `alembic upgrade head` and bring the schema forward. Check the container
  logs to confirm it succeeded:
  ```bash
  docker compose logs bootstrap
  ```
- Never restore a dump taken from a **newer** application version into an
  older one — Alembic only migrates forward, and the running code may not
  understand newer schema objects.

See [Upgrades](upgrades.md) for the full migration flow.

## PostgreSQL: volume-level backup (alternative)

If you'd rather snapshot the raw data directory (e.g. for a full
point-in-time copy before an upgrade), stop the database first — copying a
live Postgres data directory without a consistent snapshot mechanism can
produce a corrupt backup:

```bash
docker compose stop db

docker run --rm \
  -v portfolium_postgres_data:/volume \
  -v "$(pwd)":/backup \
  alpine \
  tar czf /backup/postgres_data-$(date +%Y%m%d-%H%M%S).tar.gz -C /volume .

docker compose start db
```

Docker Compose prefixes volume names with the project/directory name by
default (typically `portfolium_postgres_data`); confirm the exact name with:

```bash
docker volume ls | grep postgres_data
```

To restore, stop the stack, clear the target volume, and extract the archive
back into it the same way (reversing `tar czf` for `tar xzf`), then start the
stack again. Prefer the `pg_dump`/`pg_restore` approach above unless you
specifically need a full binary snapshot — it's simpler to verify and doesn't
require matching PostgreSQL major versions.

## Redis: backing up the append-only file

Redis in this deployment runs with `--appendonly yes`, so `redis_data`
contains an AOF that Redis can replay on startup. Since Redis here only holds
Celery queue/result state and a price cache — all reconstructible — a backup
is optional, but if you want one:

```bash
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" BGSAVE
docker run --rm \
  -v portfolium_redis_data:/volume \
  -v "$(pwd)":/backup \
  alpine \
  tar czf /backup/redis_data-$(date +%Y%m%d-%H%M%S).tar.gz -C /volume .
```

To restore, stop `redis`, extract the archive into the `redis_data` volume,
and start `redis` again. In practice, most operators skip Redis backups
entirely: on data loss, Celery simply rebuilds its queues and the price cache
repopulates on the next scheduled refresh.

## Automating backups

There's no built-in backup scheduler in Portfolium — wire the `pg_dump`
command above into your own cron job or host-level backup tool, writing to
storage outside the Docker host. A minimal example crontab entry:

```cron
0 3 * * * cd /path/to/Portfolium && docker compose exec -T db pg_dump -U portfolium -d portfolium --format=custom > /backups/portfolium-$(date +\%Y\%m\%d).dump
```

Keep backups offsite or on separate storage from the Docker host, and
periodically test a restore — an untested backup is not a backup.
