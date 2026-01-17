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
from app.config import settings

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
            from app.services.pricing import _cleanup_stale_tasks
            
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
            
            # Create event loop for async operations
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Clean up any stale tasks from previous event loops
                _cleanup_stale_tasks()
                
                for asset in active_assets:
                    try:
                        # Run async get_price in the event loop
                        price = loop.run_until_complete(pricing_service.get_price(asset.symbol))
                        if price:
                            refreshed += 1
                            logger.debug(f"Refreshed {asset.symbol}: {price.price}")
                        else:
                            failed += 1
                            logger.warning(f"Failed to refresh {asset.symbol}")
                    except Exception as e:
                        failed += 1
                        logger.error(f"Error refreshing {asset.symbol}: {e}")
            finally:
                loop.close()
            
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
            from app.services.pricing import _cleanup_stale_tasks
            
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
            
            # Create event loop for async operations
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Clean up any stale tasks from previous event loops
                _cleanup_stale_tasks()
                
                for item in watchlist_items:
                    try:
                        asset = db.query(Asset).filter(Asset.id == item.asset_id).first()
                        if not asset:
                            continue
                        
                        # Get current price (async call)
                        price_data = loop.run_until_complete(pricing_service.get_price(asset.symbol))
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
            finally:
                loop.close()
            
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


async def cleanup_old_notifications():
    """Delete notifications older than the configured retention window."""
    if settings.NOTIFICATIONS_RETENTION_DAYS <= 0:
        return

    logger.info("Starting scheduled notifications cleanup...")

    def _cleanup():
        db = SessionLocal()
        try:
            from app.crud.notifications import delete_old_notifications

            deleted = delete_old_notifications(db, days=settings.NOTIFICATIONS_RETENTION_DAYS)
            logger.info(
                "Notifications cleanup completed. Deleted %s notifications older than %s days.",
                deleted,
                settings.NOTIFICATIONS_RETENTION_DAYS,
            )
        except Exception as e:
            logger.error(f"Scheduled notifications cleanup failed: {e}", exc_info=True)
        finally:
            db.close()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _cleanup)


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


async def warmup_position_caches():
    """
    Background job to proactively warm up position caches
    
    This refreshes position calculations BEFORE they expire (every 20 min, cache is 30 min)
    This ensures users never hit an expired cache and have to wait for price fetching
    Runs asynchronously in the background without blocking user requests
    """
    logger.info("Starting proactive position cache warmup...")
    
    def _warmup_caches():
        db = SessionLocal()
        try:
            from app.models import Portfolio
            from app.services.metrics import MetricsService
            from app.services.cache import get_cached_positions
            import time
            from datetime import datetime, timedelta
            
            # Get portfolios accessed in the last 24 hours (actively used)
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            portfolios = (
                db.query(Portfolio)
                .filter(Portfolio.last_accessed_at >= cutoff_time)
                .all()
            )
            
            if not portfolios:
                logger.info("No portfolios to warm up")
                return
            
            warmed_up = 0
            skipped = 0
            failed = 0
            
            # Create event loop for async operations
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                for portfolio in portfolios:
                    try:
                        # Warm up cache for recently accessed portfolios
                        metrics_service = MetricsService(db)
                        start_time = time.time()
                        
                        # This will fetch fresh prices and recalculate positions
                        # Result is automatically cached for 30 minutes
                        positions = loop.run_until_complete(
                            metrics_service.get_positions(portfolio.id, include_sold=False)
                        )
                        
                        elapsed = time.time() - start_time
                        warmed_up += 1
                        logger.info(
                            f"Warmed up cache for portfolio {portfolio.id} ({portfolio.name}): "
                            f"{len(positions)} positions in {elapsed:.2f}s"
                        )
                            
                    except Exception as e:
                        failed += 1
                        logger.error(f"Error warming up cache for portfolio {portfolio.id}: {e}")
            finally:
                loop.close()
            
            logger.info(
                f"Position cache warmup completed. Warmed up: {warmed_up}, "
                f"Failed: {failed}, Total portfolios (accessed in 24h): {len(portfolios)}"
            )
            
        except Exception as e:
            logger.error(f"Position cache warmup job failed: {e}")
        finally:
            db.close()
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _warmup_caches)


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
            from app.models import User, Portfolio, Asset
            from app.services.metrics import MetricsService
            from decimal import Decimal
            from app.services.pricing import _cleanup_stale_tasks
            
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
                    logger.debug(f"Checking daily changes for user {user.id}")
                    
                    # Track assets already notified for this user in this cycle
                    # This prevents duplicate notifications when the same asset appears in multiple portfolios
                    notified_assets = set()
                    
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
                                # Clean up any stale tasks from previous event loops
                                _cleanup_stale_tasks()
                                
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
                                
                                # Get asset to determine threshold based on its characteristics
                                asset = db.query(Asset).filter(Asset.id == position.asset_id).first()
                                if not asset:
                                    continue
                                
                                # Import threshold utility
                                from app.utils.notification_thresholds import get_daily_change_threshold
                                
                                # Get asset-specific threshold
                                threshold = get_daily_change_threshold(asset)
                                
                                if daily_change >= threshold:
                                    # Skip if already notified for this asset in this cycle
                                    if position.asset_id in notified_assets:
                                        total_skipped += 1
                                        logger.debug(
                                            f"Skipping duplicate notification for {position.symbol} "
                                            f"(user {user.id}, already notified in this cycle)"
                                        )
                                        continue
                                    
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
                                    
                                    # Mark this asset as notified for this user in this cycle
                                    notified_assets.add(position.asset_id)
                                    
                                    total_notifications += 1
                                    logger.info(
                                        f"Daily change notification created: {position.symbol} "
                                        f"{position.daily_change_pct:+.2f}% for user {user.id} "
                                        f"(threshold: {threshold}%)"
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


async def fetch_daily_closing_prices():
    """
    Background job to fetch daily closing prices for all held assets
    
    This runs once per day (typically after market close) to ensure we have
    complete historical price data for portfolio value calculation and charting.
    Fetches closing prices for the previous trading day for all assets with positions.
    Runs asynchronously to avoid blocking the main event loop.
    """
    logger.info("Starting daily closing price fetch for all held assets...")
    
    def _fetch_closing_prices():
        db = SessionLocal()
        try:
            from app.models import Asset, Transaction, TransactionType
            from sqlalchemy import distinct
            from datetime import datetime, timedelta
            
            # Get all unique assets that have current holdings (BUY - SELL > 0)
            # We need to calculate which assets are currently held
            from app.routers.assets import _parse_split_ratio
            from decimal import Decimal
            
            # Get all assets that have transactions
            asset_ids = db.query(Transaction.asset_id.distinct()).all()
            asset_ids = [aid[0] for aid in asset_ids]
            
            held_assets = []
            for asset_id in asset_ids:
                # Get all transactions for this asset across all portfolios
                transactions = (
                    db.query(Transaction)
                    .filter(Transaction.asset_id == asset_id)
                    .order_by(Transaction.tx_date, Transaction.created_at)
                    .all()
                )
                
                # Calculate total quantity with split adjustments
                total_quantity = Decimal(0)
                
                for tx in transactions:
                    if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                        total_quantity += tx.quantity
                    elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                        total_quantity -= tx.quantity
                    elif tx.type == TransactionType.SPLIT:
                        # Apply split ratio to current quantity
                        split_ratio = _parse_split_ratio(tx.meta_data.get("split", "1:1") if tx.meta_data else "1:1")
                        total_quantity *= split_ratio
                
                # Only include assets with positive quantity
                if total_quantity > 0:
                    asset = db.query(Asset).filter(Asset.id == asset_id).first()
                    if asset:
                        held_assets.append(asset)
            
            if not held_assets:
                logger.info("No held assets found, skipping daily price fetch")
                return
            
            logger.info(f"Fetching daily closing prices for {len(held_assets)} held assets")
            
            pricing_service = PricingService(db)
            
            # Fetch closing price for yesterday (last complete trading day)
            # We use yesterday because today's closing price might not be available yet
            yesterday = datetime.utcnow() - timedelta(days=1)
            yesterday_start = datetime.combine(yesterday.date(), datetime.min.time())
            yesterday_end = datetime.combine(yesterday.date(), datetime.max.time())
            
            successful = 0
            failed = 0
            skipped = 0
            
            for asset in held_assets:
                try:
                    # Check if we already have a price for yesterday
                    from app.crud import prices as crud_prices
                    existing_prices = crud_prices.get_prices(
                        db,
                        asset.id,
                        date_from=yesterday_start,
                        date_to=yesterday_end,
                        limit=10
                    )
                    
                    # Skip if we already have prices for this day
                    if existing_prices:
                        skipped += 1
                        logger.debug(f"Skipping {asset.symbol}, already have price for yesterday")
                        continue
                    
                    # Fetch historical prices for yesterday
                    # This will get the closing price from yfinance
                    count = pricing_service.ensure_historical_prices(
                        asset,
                        yesterday_start,
                        yesterday_end,
                        interval='1d'
                    )
                    
                    if count > 0:
                        successful += 1
                        logger.debug(f"Fetched closing price for {asset.symbol}")
                    else:
                        # No data available (might be weekend, holiday, or delisted stock)
                        skipped += 1
                        logger.debug(f"No closing price available for {asset.symbol} (possibly market closed)")
                    
                except Exception as e:
                    failed += 1
                    logger.error(f"Error fetching closing price for {asset.symbol}: {e}")
            
            logger.info(
                f"Daily closing price fetch completed. "
                f"Successful: {successful}, Skipped: {skipped}, Failed: {failed}, "
                f"Total assets: {len(held_assets)}"
            )
            
        except Exception as e:
            logger.error(f"Daily closing price fetch failed: {e}", exc_info=True)
        finally:
            db.close()
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _fetch_closing_prices)


async def detect_and_fill_price_gaps():
    """
    Background job to detect gaps in price history and automatically fill them.
    
    This scans all active assets for gaps in their price history (missing days
    that should have prices based on their first transaction date) and backfills
    the missing data from yfinance.
    
    Runs weekly to catch and fix any data gaps.
    Uses exchange calendars to properly account for market holidays.
    """
    logger.info("Starting price gap detection and auto-fill...")
    
    def _fill_gaps():
        db = SessionLocal()
        try:
            from app.models import Asset, Transaction
            from app.crud import prices as crud_prices
            from app.utils.exchange_calendars import calculate_coverage
            from sqlalchemy import distinct, func
            from datetime import datetime, timedelta
            from collections import defaultdict
            
            # Get all unique assets that have transactions
            asset_ids = db.query(Transaction.asset_id.distinct()).all()
            asset_ids = [aid[0] for aid in asset_ids]
            
            assets_checked = 0
            assets_with_gaps = 0
            total_prices_added = 0
            errors = []
            
            pricing_service = PricingService(db)
            
            for asset_id in asset_ids:
                try:
                    asset = db.query(Asset).filter(Asset.id == asset_id).first()
                    if not asset:
                        continue
                    
                    assets_checked += 1
                    
                    # Determine date range to check
                    # Start from first transaction date or 1 year ago, whichever is more recent
                    end_date = datetime.utcnow()
                    one_year_ago = end_date - timedelta(days=365)
                    
                    if asset.first_transaction_date:
                        start_date = datetime.combine(asset.first_transaction_date, datetime.min.time())
                        # Don't go further back than 1 year for performance
                        if start_date < one_year_ago:
                            start_date = one_year_ago
                    else:
                        start_date = one_year_ago
                    
                    # Get all prices in the date range
                    prices = crud_prices.get_prices(
                        db,
                        asset_id,
                        date_from=start_date,
                        date_to=end_date,
                        limit=10000
                    )
                    
                    # Group prices by date
                    price_dates = set()
                    for price in prices:
                        price_dates.add(price.asof.date())
                    
                    # Calculate expected trading days using exchange calendar
                    # This properly excludes weekends AND holidays for the asset's exchange
                    coverage_info = calculate_coverage(
                        symbol=asset.symbol,
                        start_date=start_date.date(),
                        end_date=end_date.date(),
                        price_dates=price_dates
                    )
                    
                    expected_days = coverage_info["expected_trading_days"]
                    actual_days = coverage_info["actual_data_points"]
                    coverage = coverage_info["coverage_pct"] / 100.0  # Convert to decimal
                    
                    # If we're missing more than 20% of expected data, try to backfill
                    if coverage < 0.80:
                        # Significant gap detected - try to fill it
                        logger.info(
                            f"Gap detected for {asset.symbol}: {actual_days}/{expected_days} days "
                            f"({coverage*100:.1f}% coverage, exchange: {coverage_info['exchange']}). Attempting backfill..."
                        )
                        
                        try:
                            count = pricing_service.ensure_historical_prices(
                                asset,
                                start_date,
                                end_date,
                                interval='1d'
                            )
                            
                            if count > 0:
                                assets_with_gaps += 1
                                total_prices_added += count
                                logger.info(f"Backfilled {count} prices for {asset.symbol}")
                            
                        except Exception as e:
                            errors.append(f"{asset.symbol}: {str(e)}")
                            logger.warning(f"Failed to backfill {asset.symbol}: {e}")
                    
                except Exception as e:
                    errors.append(f"Asset {asset_id}: {str(e)}")
                    logger.error(f"Error checking asset {asset_id}: {e}")
            
            logger.info(
                f"Price gap detection completed. "
                f"Checked: {assets_checked}, Gaps found: {assets_with_gaps}, "
                f"Prices added: {total_prices_added}, Errors: {len(errors)}"
            )
            
            if errors:
                for error in errors[:5]:  # Log first 5 errors
                    logger.error(f"Gap fill error: {error}")
            
        except Exception as e:
            logger.error(f"Price gap detection failed: {e}", exc_info=True)
        finally:
            db.close()
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _fill_gaps)


async def update_all_time_highs():
    """
    Background job to update all-time high prices from yfinance
    
    This runs once per day (after market close) to fetch the true all-time high
    for all assets from complete yfinance historical data.
    Runs asynchronously to avoid blocking the main event loop
    """
    logger.info("Starting ATH update from yfinance...")
    
    # Run database operations in a thread pool to avoid blocking
    def _update_ath():
        from app.tasks.ath_tasks import backfill_ath_from_yfinance
        try:
            result = backfill_ath_from_yfinance()
            logger.info(
                f"ATH update completed. Processed: {result['processed']}, "
                f"Updated: {result['updated']}, Errors: {len(result['errors'])}"
            )
            if result['errors']:
                for error in result['errors'][:5]:  # Log first 5 errors
                    logger.error(f"ATH update error: {error}")
        except Exception as e:
            logger.error(f"ATH update failed: {e}", exc_info=True)
    
    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _update_ath)


async def fetch_pending_dividends():
    """
    Background job to fetch pending dividends for all active portfolios.
    
    This runs daily to check yfinance for new dividends that users may be
    entitled to based on their holdings at ex-dividend dates.
    Dividends are created as "pending" and require user confirmation.
    """
    logger.info("Starting dividend auto-fetch from yfinance...")
    
    def _fetch_dividends():
        db = SessionLocal()
        try:
            from sqlalchemy import distinct
            from app.models import Transaction, Portfolio
            from app.services.dividends import DividendService
            from app.services.notifications import notification_service
            
            # Get all portfolios that have transactions (active portfolios)
            active_portfolio_ids = (
                db.query(distinct(Transaction.portfolio_id))
                .all()
            )
            active_portfolio_ids = [p[0] for p in active_portfolio_ids]
            
            logger.info(f"Fetching dividends for {len(active_portfolio_ids)} active portfolios")
            
            total_created = 0
            
            for portfolio_id in active_portfolio_ids:
                try:
                    dividend_service = DividendService(db)
                    created = dividend_service.fetch_dividends_for_portfolio(
                        portfolio_id,
                        lookback_days=90,  # Check last 90 days
                        lookahead_days=90   # And next 90 days for announced
                    )
                    
                    if created:
                        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
                        if portfolio:
                            notification_service.create_pending_dividend_notification(
                                db,
                                user_id=portfolio.user_id,
                                pending_dividends=created
                            )
                    
                    total_created += len(created)
                    
                except Exception as e:
                    logger.error(f"Error fetching dividends for portfolio {portfolio_id}: {e}")
                    continue
            
            logger.info(
                f"Dividend fetch completed: {total_created} new pending dividends "
                f"across {len(active_portfolio_ids)} portfolios"
            )
            
        except Exception as e:
            logger.error(f"Dividend fetch job failed: {e}", exc_info=True)
        finally:
            db.close()
    
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _fetch_dividends)


async def expire_pending_dividends():
    """
    Background job to expire old pending dividends.
    
    This runs weekly to mark very old pending dividends as expired,
    preventing the pending list from growing indefinitely.
    """
    logger.info("Starting pending dividend expiration...")
    
    def _expire_dividends():
        db = SessionLocal()
        try:
            from app.crud import pending_dividends as crud_pending
            
            count = crud_pending.expire_old_pending_dividends(db, days_old=365)
            logger.info(f"Expired {count} old pending dividends (older than 365 days)")
            
        except Exception as e:
            logger.error(f"Pending dividend expiration failed: {e}", exc_info=True)
        finally:
            db.close()
    
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _expire_dividends)


async def refresh_earnings_cache_job():
    """
    Background job to refresh earnings cache for all active stocks.
    
    This runs daily to fetch earnings dates from yfinance for all stocks
    that users currently hold. The cached data is used by the calendar
    feature to avoid slow API calls on every request.
    """
    logger.info("Starting earnings cache refresh...")
    
    def _refresh_earnings():
        db = SessionLocal()
        try:
            from sqlalchemy import distinct
            from app.models import Asset, Transaction, EarningsCache
            import yfinance as yf
            from datetime import datetime
            
            # Get all unique STOCK symbols that have transactions
            # Filter to only stocks - exclude ETFs, crypto, etc.
            active_stocks = (
                db.query(distinct(Asset.symbol), Asset.id)
                .join(Asset.transactions)
                .filter(
                    Asset.asset_type.in_(['EQUITY', 'stock', 'Stock', 'STOCK']),
                )
                .all()
            )
            
            if not active_stocks:
                logger.info("No active stocks to fetch earnings for")
                return
            
            symbols = [(s[0], s[1]) for s in active_stocks]
            logger.info(f"Fetching earnings for {len(symbols)} active stocks")
            
            cached_count = 0
            failed_count = 0
            
            for symbol, asset_id in symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    calendar = ticker.calendar
                    
                    if calendar is None:
                        continue
                    
                    # Handle different calendar formats
                    if hasattr(calendar, 'to_dict'):
                        calendar_data = calendar.to_dict()
                    elif isinstance(calendar, dict):
                        calendar_data = calendar
                    else:
                        continue
                    
                    # Parse earnings date
                    earnings_date = None
                    earnings_dates_raw = calendar_data.get('Earnings Date', [])
                    
                    if earnings_dates_raw:
                        if isinstance(earnings_dates_raw, dict):
                            raw_date = list(earnings_dates_raw.values())[0] if earnings_dates_raw else None
                        elif isinstance(earnings_dates_raw, list) and len(earnings_dates_raw) > 0:
                            raw_date = earnings_dates_raw[0]
                        else:
                            raw_date = earnings_dates_raw
                            
                        if raw_date:
                            # Check if it's already a date object
                            from datetime import date as date_type
                            if isinstance(raw_date, date_type):
                                earnings_date = raw_date
                            elif hasattr(raw_date, 'date'):
                                earnings_date = raw_date.date()
                            elif isinstance(raw_date, str):
                                try:
                                    from datetime import datetime as dt
                                    earnings_date = dt.fromisoformat(raw_date.replace('Z', '+00:00')).date()
                                except:
                                    pass
                    
                    if not earnings_date:
                        continue
                    
                    # Check if we already have this entry
                    existing = db.query(EarningsCache).filter(
                        EarningsCache.symbol == symbol,
                        EarningsCache.earnings_date == earnings_date
                    ).first()
                    
                    # Extract estimates
                    eps_estimate = calendar_data.get('Earnings Average') or calendar_data.get('EPS Estimate')
                    if isinstance(eps_estimate, dict):
                        eps_estimate = list(eps_estimate.values())[0] if eps_estimate else None
                        
                    revenue_estimate = calendar_data.get('Revenue Average') or calendar_data.get('Revenue Estimate')
                    if isinstance(revenue_estimate, dict):
                        revenue_estimate = list(revenue_estimate.values())[0] if revenue_estimate else None
                    
                    # Serialize raw_data to be JSON safe
                    def serialize_val(val):
                        if val is None:
                            return None
                        if hasattr(val, 'isoformat'):
                            return val.isoformat()
                        if hasattr(val, 'item'):
                            return val.item()
                        return val
                    
                    raw_data = {k: serialize_val(v) for k, v in calendar_data.items()}
                    
                    if existing:
                        existing.eps_estimate = eps_estimate
                        existing.revenue_estimate = revenue_estimate
                        existing.raw_data = raw_data
                        existing.fetched_at = datetime.utcnow()
                        existing.updated_at = datetime.utcnow()
                    else:
                        new_cache = EarningsCache(
                            symbol=symbol,
                            earnings_date=earnings_date,
                            eps_estimate=eps_estimate,
                            revenue_estimate=revenue_estimate,
                            raw_data=raw_data,
                            fetched_at=datetime.utcnow(),
                        )
                        db.add(new_cache)
                    
                    db.commit()
                    cached_count += 1
                    
                except Exception as e:
                    logger.warning(f"Error caching earnings for {symbol}: {e}")
                    failed_count += 1
                    db.rollback()
                    continue
            
            logger.info(f"Earnings cache refresh complete: {cached_count} cached, {failed_count} failed")
            
        except Exception as e:
            logger.error(f"Earnings cache refresh failed: {e}", exc_info=True)
        finally:
            db.close()
    
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _refresh_earnings)


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
            from app.services.pricing import _cleanup_stale_tasks
            from zoneinfo import ZoneInfo
            
            # Get current date in EST timezone (report for the trading day that just ended)
            # When this runs at 4:00 PM EST, it's for the current day's market close
            report_date = datetime.now(ZoneInfo('America/New_York')).date()
            
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
                    
                    # Generate one PDF per portfolio
                    import asyncio
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    
                    try:
                        # Clean up any stale tasks from previous event loops
                        _cleanup_stale_tasks()
                        
                        # Generate PDFs for each portfolio
                        pdf_attachments = []
                        for portfolio in portfolios:
                            pdf_data = loop.run_until_complete(
                                pdf_service.generate_daily_report(
                                    user_id=user.id,
                                    portfolio_id=portfolio.id,
                                    report_date=report_date
                                )
                            )
                            # Clean portfolio name for filename (remove special chars)
                            clean_name = "".join(c if c.isalnum() or c in (' ', '_', '-') else '_' for c in portfolio.name)
                            filename = f"portfolio_report_{clean_name}_{report_date.strftime('%Y%m%d')}.pdf"
                            pdf_attachments.append((filename, pdf_data))
                            logger.info(f"Generated PDF for portfolio '{portfolio.name}' ({portfolio.id})")
                    finally:
                        loop.close()
                    
                    # Send email with multiple PDF attachments (one per portfolio)
                    success = email_service.send_daily_report_email(
                        to_email=user.email,
                        username=user.username,
                        report_date=report_date.strftime('%B %d, %Y'),
                        pdf_attachments=pdf_attachments,
                        language=user.preferred_language
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
    
    # Schedule position cache warmup every 20 minutes (before 30 min cache expires)
    # This ensures users never hit an expired cache
    scheduler.add_job(
        warmup_position_caches,
        trigger=IntervalTrigger(minutes=20),
        id="warmup_position_caches",
        name="Warm up position caches",
        replace_existing=True,
        max_instances=1,
        coalesce=True
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

    # Schedule notifications cleanup daily (UTC)
    if settings.NOTIFICATIONS_RETENTION_DAYS > 0:
        scheduler.add_job(
            cleanup_old_notifications,
            trigger=CronTrigger(hour=3, minute=0, timezone='UTC'),
            id="cleanup_notifications",
            name="Cleanup old notifications",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
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
    
    # Daily reports are scheduled via Celery Beat when background tasks are enabled.
    # Avoid scheduling them here as well (would duplicate emails if both are running).
    if not settings.ENABLE_BACKGROUND_TASKS:
        # Schedule daily report generation and distribution
        # Run at 4:00 PM ET (16:00) after US market close
        # Only run on weekdays (Monday-Friday) when markets are open
        scheduler.add_job(
            send_daily_reports,
            trigger=CronTrigger(hour=16, minute=0, day_of_week='mon-fri', timezone='America/New_York'),
            id="send_daily_reports",
            name="Send daily portfolio reports",
            replace_existing=True,
            max_instances=1,
            coalesce=True
        )
    else:
        logger.info("Daily reports are handled by Celery Beat; skipping APScheduler job registration")
    
    # Schedule daily closing price fetch
    # Run at 5:00 PM EST (17:00) after markets close and after-hours trading is done
    # Only run on weekdays (Monday-Friday)
    # This ensures we capture the final closing prices for the day
    scheduler.add_job(
        fetch_daily_closing_prices,
        trigger=CronTrigger(hour=17, minute=0, day_of_week='mon-fri', timezone='America/New_York'),
        id="fetch_daily_closing_prices",
        name="Fetch daily closing prices for all held assets",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Schedule ATH backfill from yfinance
    # Run at 5:30 PM EST (17:30) after markets close, after closing prices are fetched
    # Only run on weekdays (Monday-Friday)
    # This updates the true all-time high for all assets from yfinance historical data
    scheduler.add_job(
        update_all_time_highs,
        trigger=CronTrigger(hour=17, minute=30, day_of_week='mon-fri', timezone='America/New_York'),
        id="update_all_time_highs",
        name="Update all-time highs from yfinance",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Schedule dividend auto-fetch daily at 6:00 AM UTC
    # This checks for new dividends for all active portfolios
    scheduler.add_job(
        fetch_pending_dividends,
        trigger=CronTrigger(hour=6, minute=0, timezone='UTC'),
        id="fetch_pending_dividends",
        name="Fetch pending dividends from yfinance",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Schedule earnings cache refresh daily at 6:30 AM UTC
    # This fetches earnings dates for all active stocks
    scheduler.add_job(
        refresh_earnings_cache_job,
        trigger=CronTrigger(hour=6, minute=30, timezone='UTC'),
        id="refresh_earnings_cache",
        name="Refresh earnings calendar cache",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Schedule expired pending dividends cleanup weekly (Sunday at 2:00 AM UTC)
    scheduler.add_job(
        expire_pending_dividends,
        trigger=CronTrigger(hour=2, minute=0, day_of_week='sun', timezone='UTC'),
        id="expire_pending_dividends",
        name="Expire old pending dividends",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Schedule price gap detection and auto-fill weekly (Sunday at 3:00 AM UTC)
    # This scans all assets for missing price history and backfills from yfinance
    scheduler.add_job(
        detect_and_fill_price_gaps,
        trigger=CronTrigger(hour=3, minute=0, day_of_week='sun', timezone='UTC'),
        id="detect_and_fill_price_gaps",
        name="Detect and fill price data gaps",
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    scheduler.start()
    daily_reports_msg = (
        "daily reports at 4:00 PM ET (weekdays only), "
        if not settings.ENABLE_BACKGROUND_TASKS
        else "daily reports via Celery Beat (4:00 PM ET weekdays), "
    )
    logger.info(
        "AsyncIO Scheduler started - price refresh every 15 minutes, "
        "position cache warmup every 20 minutes, "
        "alerts check every 5 minutes, daily changes check every 10 minutes, "
        f"notifications cleanup daily at 03:00 UTC (retention={settings.NOTIFICATIONS_RETENTION_DAYS}d), "
        + daily_reports_msg
        + "daily closing prices at 5:00 PM ET (weekdays only), "
        + "ATH update at 5:30 PM ET (weekdays only), "
        + "dividend fetch at 6:00 AM UTC daily, "
        + "earnings cache refresh at 6:30 AM UTC daily, "
        + "expired dividends cleanup Sundays at 2:00 AM UTC, "
        + "price gap detection Sundays at 3:00 AM UTC. "
        + "All jobs run asynchronously to prevent blocking."
    )


def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
