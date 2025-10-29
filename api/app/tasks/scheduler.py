"""
Background scheduler for periodic tasks
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta

from app.db import SessionLocal
from app.services.pricing import PricingService
from app.services.notifications import notification_service

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def refresh_all_prices():
    """
    Background job to refresh prices for all active assets
    
    This runs periodically to keep price cache up-to-date
    Runs asynchronously to avoid blocking the main event loop
    """
    logger.info("Starting scheduled price refresh...")
    
    # Run database operations in a thread pool to avoid blocking
    def _refresh_prices():
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
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _refresh_prices)


async def check_price_alerts():
    """
    Background job to check watchlist price alerts
    
    This runs periodically to check if any watchlist items with alerts
    have reached their target price
    Runs asynchronously to avoid blocking the main event loop
    """
    logger.info("Starting scheduled price alert check...")
    
    # Run database operations in a thread pool to avoid blocking
    def _check_alerts():
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
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _check_alerts)


def get_market_session_id() -> str:
    """
    Get a unique identifier for the current market session.
    Returns date in format YYYY-MM-DD for US Eastern Time.
    This ensures we only send one notification per asset per user per trading day.
    """
    try:
        from zoneinfo import ZoneInfo
        ny_tz = ZoneInfo("America/New_York")
    except Exception:
        from datetime import timezone, timedelta
        ny_tz = timezone(timedelta(hours=-5))
    
    now = datetime.now(ny_tz)
    return now.strftime("%Y-%m-%d")


def is_notification_sent_this_session(
    db, user_id: int, asset_id: int, session_id: str
) -> bool:
    """
    Check if a daily change notification has already been sent for this 
    asset/user combination during the current market session.
    """
    from app.models import Notification, NotificationType
    from sqlalchemy import text
    
    # Look for any daily change notification (up or down) created today
    # Using raw SQL for JSON field comparison to ensure it works correctly
    existing = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .filter(
            Notification.type.in_([
                NotificationType.DAILY_CHANGE_UP,
                NotificationType.DAILY_CHANGE_DOWN
            ])
        )
        .filter(text("metadata->>'asset_id' = :asset_id"))
        .filter(text("metadata->>'session_id' = :session_id"))
        .params(asset_id=str(asset_id), session_id=session_id)
        .first()
    )
    
    return existing is not None


def should_check_daily_changes() -> bool:
    """
    Determine if we should check for daily changes based on market status.
    Only check during market hours (open + afterhours).
    """
    from app.routers.health import get_market_status
    
    market_status = get_market_status()
    # Check during market open and afterhours (when most trading happens)
    return market_status in ["open", "afterhours"]


async def check_daily_changes():
    """
    Background job to check for significant daily price changes in user holdings
    
    This runs periodically (every 10-15 minutes during market hours) to notify 
    users about significant price movements in their portfolio positions.
    Only sends ONE notification per asset per user per market session, even if 
    price oscillates around the threshold.
    Runs asynchronously to avoid blocking the main event loop
    """
    # Skip if market is not open or in afterhours
    if not should_check_daily_changes():
        logger.debug("Market closed, skipping daily change check")
        return
    
    logger.info("Starting scheduled daily change check...")
    
    # Run database operations in a thread pool to avoid blocking
    def _check_changes():
        db = SessionLocal()
        try:
            from app.models import User, Portfolio
            from app.services.metrics import MetricsService
            from decimal import Decimal
            
            # Get current market session identifier
            session_id = get_market_session_id()
            
            # Get all active users with notifications enabled
            users = (
                db.query(User)
                .filter(User.is_active == True)
                .filter(User.daily_change_notifications_enabled == True)
                .all()
            )
            
            if not users:
                logger.info("No users with daily change notifications enabled")
                return
            
            total_notifications = 0
            total_skipped = 0
            
            for user in users:
                try:
                    threshold = Decimal(str(user.daily_change_threshold_pct or 5.0))
                    logger.debug(f"Checking daily changes for user {user.id} (threshold: {threshold}%)")
                    
                    # Get all user portfolios
                    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
                    
                    for portfolio in portfolios:
                        try:
                            # Get positions for this portfolio
                            metrics_service = MetricsService(db)
                            # Run async method in event loop
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            try:
                                positions = loop.run_until_complete(
                                    metrics_service.get_positions(portfolio.id)
                                )
                            finally:
                                loop.close()
                            
                            for position in positions:
                                # Check if daily change exceeds threshold
                                if position.daily_change_pct is None:
                                    continue
                                
                                daily_change = abs(position.daily_change_pct)
                                
                                if daily_change >= threshold:
                                    # Check if we already sent a notification this session
                                    if is_notification_sent_this_session(
                                        db, user.id, position.asset_id, session_id
                                    ):
                                        total_skipped += 1
                                        logger.debug(
                                            f"Skipping duplicate notification for {position.symbol} "
                                            f"(user {user.id}, session {session_id})"
                                        )
                                        continue
                                    
                                    # Create notification with session tracking
                                    notification_service.create_daily_change_notification(
                                        db=db,
                                        user_id=user.id,
                                        symbol=position.symbol,
                                        asset_name=position.name or position.symbol,
                                        asset_id=position.asset_id,
                                        portfolio_id=portfolio.id,
                                        current_price=position.current_price,
                                        daily_change_pct=position.daily_change_pct,
                                        quantity=position.quantity,
                                        session_id=session_id
                                    )
                                    
                                    total_notifications += 1
                                    logger.info(
                                        f"Daily change notification created: {position.symbol} "
                                        f"{position.daily_change_pct:+.2f}% for user {user.id}"
                                    )
                        
                        except Exception as e:
                            logger.error(
                                f"Error checking positions for portfolio {portfolio.id}: {e}"
                            )
                            continue
                
                except Exception as e:
                    logger.error(f"Error checking daily changes for user {user.id}: {e}")
                    continue
            
            logger.info(
                f"Daily change check completed. Notifications created: {total_notifications}, "
                f"Skipped (already notified): {total_skipped}, Users checked: {len(users)}"
            )
            
        except Exception as e:
            logger.error(f"Scheduled daily change check failed: {e}")
        finally:
            db.close()
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _check_changes)


async def send_daily_reports():
    """
    Background job to generate and send daily portfolio reports
    
    This runs once per day (typically end of day) to send PDF reports to all users
    who have daily reports enabled. Reports include portfolio summary, heatmap,
    daily changes, transactions, and asset allocation.
    Runs asynchronously to avoid blocking the main event loop
    """
    logger.info("Starting daily report generation and distribution...")
    
    # Run database operations in a thread pool to avoid blocking
    def _send_reports():
        db = SessionLocal()
        try:
            from app.models import User, Portfolio
            from app.services.pdf_reports import PDFReportService
            from app.services.email import email_service
            from app.services.notifications import notification_service
            
            # Get yesterday's date (report for previous day)
            report_date = (datetime.utcnow() - timedelta(days=1)).date()
            
            # Get all active users with daily reports enabled
            users = (
                db.query(User)
                .filter(User.is_active == True)
                .filter(User.is_verified == True)
                .filter(User.daily_report_enabled == True)
                .all()
            )
            
            if not users:
                logger.info("No users with daily reports enabled")
                return
            
            pdf_service = PDFReportService(db)
            total_reports = 0
            total_failed = 0
            
            for user in users:
                try:
                    logger.info(f"Generating daily report for user {user.id} ({user.email})")
                    
                    # Get user's portfolios
                    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
                    
                    if not portfolios:
                        logger.info(f"User {user.id} has no portfolios, skipping")
                        continue
                    
                    # Generate PDF report (async method called in sync context via run_coroutine_threadsafe)
                    import asyncio
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    
                    try:
                        pdf_data = loop.run_until_complete(
                            pdf_service.generate_daily_report(
                                user_id=user.id,
                                report_date=report_date
                            )
                        )
                    finally:
                        loop.close()
                    
                    # Send email with PDF attachment
                    success = email_service.send_daily_report_email(
                        to_email=user.email,
                        username=user.username,
                        report_date=report_date.strftime('%B %d, %Y'),
                        pdf_data=pdf_data
                    )
                    
                    if success:
                        total_reports += 1
                        logger.info(f"Daily report sent successfully to {user.email}")
                        
                        # Create notification for successful report delivery
                        notification_service.create_system_notification(
                            db=db,
                            user_id=user.id,
                            title="📊 Daily Portfolio Report Sent",
                            message=f"Your daily portfolio report for {report_date.strftime('%B %d, %Y')} has been sent to {user.email}",
                            metadata={
                                "report_date": report_date.isoformat(),
                                "portfolios_count": len(portfolios)
                            }
                        )
                    else:
                        total_failed += 1
                        logger.error(f"Failed to send daily report to {user.email}")
                
                except Exception as e:
                    total_failed += 1
                    logger.error(f"Error generating/sending report for user {user.id}: {e}", exc_info=True)
                    continue
            
            logger.info(
                f"Daily report distribution completed. "
                f"Reports sent: {total_reports}, Failed: {total_failed}, "
                f"Users checked: {len(users)}"
            )
            
        except Exception as e:
            logger.error(f"Daily report job failed: {e}", exc_info=True)
        finally:
            db.close()
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_reports)


def start_scheduler():
    """Start the background scheduler"""
    # Schedule price refresh every 15 minutes
    scheduler.add_job(
        refresh_all_prices,
        trigger=IntervalTrigger(minutes=15),
        id="refresh_prices",
        name="Refresh asset prices",
        replace_existing=True,
        max_instances=1,
        coalesce=True  # Prevent job pileup if previous run is still executing
    )
    
    # Schedule price alert check every 5 minutes
    scheduler.add_job(
        check_price_alerts,
        trigger=IntervalTrigger(minutes=5),
        id="check_price_alerts",
        name="Check price alerts",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Schedule daily change check every 10 minutes during market hours
    # This will check for significant price movements and send notifications
    # Only one notification per asset per user per market session
    scheduler.add_job(
        check_daily_changes,
        trigger=IntervalTrigger(minutes=10),
        id="check_daily_changes",
        name="Check daily price changes",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Schedule daily report generation and distribution
    # Run at 4:00 PM EST (16:00) when after-hours trading starts
    # Only run on weekdays (Monday-Friday) when markets are open
    # This is right after US markets close at 4:00 PM EST
    scheduler.add_job(
        send_daily_reports,
        trigger=CronTrigger(hour=16, minute=0, day_of_week='mon-fri', timezone='America/New_York'),
        id="send_daily_reports",
        name="Send daily portfolio reports",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    scheduler.start()
    logger.info(
        "AsyncIO Scheduler started - price refresh every 15 minutes, "
        "alerts check every 5 minutes, daily changes check every 10 minutes, "
        "daily reports at 4:00 PM EST (weekdays only). "
        "All jobs run asynchronously to prevent blocking."
    )


def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
