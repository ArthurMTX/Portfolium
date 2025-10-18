"""
Background scheduler for periodic tasks
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime

from app.db import SessionLocal
from app.services.pricing import PricingService

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def refresh_all_prices():
    """
    Background job to refresh prices for all active assets
    
    This runs periodically to keep price cache up-to-date
    """
    logger.info("Starting scheduled price refresh...")
    
    db = SessionLocal()
    try:
        from app.models import Asset, Transaction
        from sqlalchemy import distinct
        
        # Get all unique assets that have transactions
        active_assets = (
            db.query(Asset)
            .join(Transaction)
            .distinct()
            .all()
        )
        
        pricing_service = PricingService(db)
        
        refreshed = 0
        failed = 0
        
        for asset in active_assets:
            try:
                price = pricing_service.get_price(asset.symbol)
                if price:
                    refreshed += 1
                    logger.debug(f"Refreshed {asset.symbol}: {price.price}")
                else:
                    failed += 1
                    logger.warning(f"Failed to refresh {asset.symbol}")
            except Exception as e:
                failed += 1
                logger.error(f"Error refreshing {asset.symbol}: {e}")
        
        logger.info(
            f"Price refresh completed. Refreshed: {refreshed}, Failed: {failed}, "
            f"Total: {len(active_assets)}"
        )
        
    except Exception as e:
        logger.error(f"Scheduled price refresh failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler"""
    # Schedule price refresh every 15 minutes
    scheduler.add_job(
        refresh_all_prices,
        trigger=IntervalTrigger(minutes=15),
        id="refresh_prices",
        name="Refresh asset prices",
        replace_existing=True,
        max_instances=1
    )
    
    scheduler.start()
    logger.info("Scheduler started - price refresh every 15 minutes")


def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
