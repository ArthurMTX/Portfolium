"""
Background tasks for syncing secondary reference-data sources (currently:
Adanos free ticker database).
"""
import logging

from app.celery_app import celery_app
from app.db import get_db_context
from app.tasks.decorators import singleton_task
from app.services.reference_data.adanos_listings import sync_adanos_listings

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.reference_data_tasks.sync_adanos_listings_task")
@singleton_task(timeout=600)  # CSV is ~8.3MB / 74k rows; 10 minutes is a generous ceiling
def sync_adanos_listings_task(self) -> dict:
    logger.info(
        "Starting Adanos listings sync",
        extra={"event": "adanos_sync_started", "task_id": self.request.id},
    )

    with get_db_context() as db:
        result = sync_adanos_listings(db)

    logger.info(
        "Adanos listings sync complete",
        extra={
            "event": "adanos_sync_complete",
            "downloaded": result["downloaded"],
            "total_rows": result["total_rows"],
            "inserted": result["inserted"],
            "updated": result["updated"],
            "skipped_invalid_isin": result["skipped_invalid_isin"],
            "skipped_duplicate": result["skipped_duplicate"],
            "error_count": len(result["errors"]),
        },
    )
    return result
