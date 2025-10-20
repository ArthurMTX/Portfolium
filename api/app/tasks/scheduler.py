"""
Background scheduler for periodic tasks
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime

from app.db import SessionLocal
from app.services.pricing import PricingService
from app.services.notifications import notification_service

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


def check_price_alerts():
    """
    Background job to check watchlist price alerts
    
    This runs periodically to check if any watchlist items with alerts
    have reached their target price
    """
    logger.info("Starting scheduled price alert check...")
    
    db = SessionLocal()
    try:
        from app.models import Watchlist, Asset
        from decimal import Decimal
        
        # Get all watchlist items with alerts enabled
        watchlist_items = (
            db.query(Watchlist)
            .filter(Watchlist.alert_enabled == True)
            .filter(Watchlist.alert_target_price.isnot(None))
            .all()
        )
        
        if not watchlist_items:
            logger.info("No active price alerts to check")
            return
        
        pricing_service = PricingService(db)
        
        alerts_triggered = 0
        
        for item in watchlist_items:
            try:
                asset = db.query(Asset).filter(Asset.id == item.asset_id).first()
                if not asset:
                    continue
                
                # Get current price
                price_data = pricing_service.get_price(asset.symbol)
                if not price_data:
                    continue
                
                current_price = Decimal(str(price_data.price))
                target_price = Decimal(str(item.alert_target_price))
                
                # Check if alert should be triggered
                # Alert triggers if price crosses the target (either above or below)
                # For simplicity, we'll trigger if current price >= target for upward alerts
                # or current price <= target for downward alerts
                should_alert = False
                
                # Determine alert direction based on whether price is close to target
                # If target is above current, we want to alert when price reaches or exceeds target
                # If target is below current, we want to alert when price reaches or falls below target
                
                # Simple approach: alert if price is within 1% of target or has crossed it
                price_diff_pct = abs((current_price - target_price) / target_price * 100)
                
                if price_diff_pct <= 1.0:  # Within 1% of target
                    should_alert = True
                
                if should_alert:
                    # Create notification
                    notification_service.create_price_alert_notification(
                        db=db,
                        user_id=item.user_id,
                        watchlist_item=item,
                        current_price=current_price,
                        target_price=target_price
                    )
                    
                    # Disable alert to prevent repeated notifications
                    item.alert_enabled = False
                    db.commit()
                    
                    alerts_triggered += 1
                    logger.info(
                        f"Price alert triggered for {asset.symbol}: "
                        f"current=${current_price}, target=${target_price}"
                    )
                    
            except Exception as e:
                logger.error(f"Error checking price alert for watchlist item {item.id}: {e}")
        
        logger.info(
            f"Price alert check completed. Alerts triggered: {alerts_triggered}, "
            f"Total checked: {len(watchlist_items)}"
        )
        
    except Exception as e:
        logger.error(f"Scheduled price alert check failed: {e}")
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
    
    # Schedule price alert check every 5 minutes
    scheduler.add_job(
        check_price_alerts,
        trigger=IntervalTrigger(minutes=5),
        id="check_price_alerts",
        name="Check price alerts",
        replace_existing=True,
        max_instances=1
    )
    
    scheduler.start()
    logger.info("Scheduler started - price refresh every 15 minutes, alerts check every 5 minutes")


def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
