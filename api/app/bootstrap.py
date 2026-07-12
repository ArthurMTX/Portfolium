"""
Explicit one-shot application bootstrap.

This module is intended to be run by Docker Compose or manually before
starting FastAPI/Celery runtime processes.
"""
import logging
import sys

from app.db import SessionLocal
from app.services.platform.admin import ensure_admin_user, ensure_email_config
from app.services.platform.migrations import run_migrations


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("portfolium.bootstrap")


def run_bootstrap() -> None:
    """Run one-shot DB/bootstrap steps exactly once per environment startup."""
    logger.info("Starting Portfolium bootstrap")

    logger.info("Running database migrations")
    run_migrations()
    logger.info("Database migrations completed")

    db = SessionLocal()
    try:
        logger.info("Ensuring email configuration")
        ensure_email_config(db)
        logger.info("Email configuration ready")

        logger.info("Ensuring admin user")
        ensure_admin_user(db)
        logger.info("Admin bootstrap complete")
    finally:
        db.close()

    logger.info("Portfolium bootstrap finished successfully")


def main() -> int:
    try:
        run_bootstrap()
        return 0
    except Exception:
        logger.exception("Portfolium bootstrap failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
