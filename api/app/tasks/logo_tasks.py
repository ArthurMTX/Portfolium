"""
Background tasks for asset ISIN + logo enrichment.
"""
import logging
from typing import Optional

from sqlalchemy import select

from app.celery_app import celery_app
from app.db import get_db
from app.models.asset import Asset

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.backfill_asset_logos")
def backfill_asset_logos(asset_id: Optional[int] = None, force: bool = False) -> dict:
    """
    Opportunistically resolve ISIN + logo (Trade Republic -> Brandfetch ->
    logo.dev -> generated) for one asset or all assets.

    Args:
        asset_id: Optional asset ID to backfill. If None, backfills all assets.
        force: If True, re-resolves even assets already resolved via Trade Republic.

    Returns:
        dict with keys:
            - processed: int
            - isin_resolved: int
            - trade_republic: int
            - brandfetch: int
            - logo_dev: int
            - generated: int
            - unchanged: int
            - errors: list of error messages
    """
    db = next(get_db())
    try:
        from app.services.market_data.logo_resolver import resolve_asset_logo

        query = select(Asset)
        if asset_id:
            query = query.where(Asset.id == asset_id)

        assets = db.execute(query).scalars().all()

        counters = {
            "processed": 0,
            "isin_resolved": 0,
            "trade_republic": 0,
            "brandfetch": 0,
            "logo_dev": 0,
            "generated": 0,
            "unchanged": 0,
        }
        errors = []

        for asset in assets:
            try:
                result = resolve_asset_logo(db, asset, force=force, allow_isin_lookup=True)
                counters["processed"] += 1
                if result.isin_resolved:
                    counters["isin_resolved"] += 1
                counters[result.provider] = counters.get(result.provider, 0) + 1
            except Exception as e:
                db.rollback()
                error_msg = f"Error processing asset {asset.symbol}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)

        logger.info(
            "Logo/ISIN backfill complete: %s processed, %s trade_republic, %s brandfetch, %s logo_dev, %s generated",
            counters["processed"],
            counters["trade_republic"],
            counters["brandfetch"],
            counters["logo_dev"],
            counters["generated"],
        )

        return {**counters, "errors": errors}
    except Exception as e:
        logger.error(f"Error in logo/ISIN backfill: {e}")
        db.rollback()
        return {
            "processed": 0,
            "isin_resolved": 0,
            "trade_republic": 0,
            "brandfetch": 0,
            "logo_dev": 0,
            "generated": 0,
            "unchanged": 0,
            "errors": [str(e)],
        }
    finally:
        db.close()
