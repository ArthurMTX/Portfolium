# Upgrades

How to safely upgrade a self-hosted Portfolium instance to a new version.

!!! warning "0.4.0 destructive migration"
    Back up PostgreSQL before upgrading. Revision `20260712_1000` permanently
    removes the unused legacy table `portfolio.asset_price_history`. Its
    downgrade recreates the empty table definition and indexes, but cannot
    recover deleted rows without a database backup.

## How Versioning Works

Production images are pinned via the `PORTFOLIUM_IMAGE_TAG` variable in `docker-compose.yml` (for example `arthurmtx/portfolium-api:0.3.2`). Upgrading means changing this tag and pulling the new images — there's no in-place code update inside a running container.

## How Migrations Run

Database migrations are **not** something you run manually. A dedicated one-shot `bootstrap` service (`python -m app.bootstrap`) runs on every stack startup, applies pending Alembic migrations, and ensures baseline setup (admin user, email config) before the API, Celery worker, and Celery beat services start. This means a normal upgrade-and-restart already applies any new migrations automatically.

## Upgrade Procedure

1. **Back up first.** See [Backup & Restore](backup-restore.md) — take a `pg_dump` snapshot before touching anything.
2. **Check the release notes** for the version you're upgrading to, for any breaking changes or manual steps.
3. **Update the image tag**, e.g. in your `.env` or directly in `docker-compose.yml`:
   ```bash
   PORTFOLIUM_IMAGE_TAG=0.4.0
   ```
4. **Pull the new images:**
   ```bash
   docker compose pull
   ```
5. **Restart the stack:**
   ```bash
   docker compose up -d
   ```
   The `bootstrap` service runs first, applies any pending migrations, then the API/worker/beat/web services start.
6. **Verify:**
   - Check `docker compose logs bootstrap` for a clean migration run
   - Confirm the app loads and you can log in
   - Check `docker compose logs api celery-worker celery-beat` for startup errors

## Rolling Back

If an upgrade causes problems:

1. Restore the database backup taken in step 1, if the new version's migrations changed the schema in a way older code can't read
2. Set `PORTFOLIUM_IMAGE_TAG` back to the previous version
3. `docker compose pull && docker compose up -d`

!!! warning "Migrations Are Rarely Reversible"
    Alembic migrations in this project are written forward-only in typical use. Rolling back application code after a migration has altered the schema can break the older code. Always back up before upgrading so you have a clean restore point rather than relying on a migration downgrade.

## Related

- [Backup & Restore](backup-restore.md)
- [Installation](../getting-started/installation.md)
- [Troubleshooting](troubleshooting.md)
