"""
Periodic maintenance tasks executed only by Celery workers.

Celery Beat is the sole scheduler for these jobs. FastAPI workers stay
stateless and do not schedule or run periodic maintenance on startup.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import text

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import (
    Asset,
    Notification,
    NotificationType,
    Portfolio,
    Price,
    Transaction,
    TransactionType,
    User,
    Watchlist,
)
from app.services.communications.notifications import notification_service
from app.services.market_data.pricing import PricingService
from app.tasks.decorators import singleton_task

logger = logging.getLogger(__name__)


def _parse_split_ratio(split_str: str) -> Decimal:
    """Parse split ratio strings like 2:1 or 3/2 into a Decimal multiplier."""
    if not split_str:
        return Decimal("1")

    value = str(split_str).strip()
    if ":" in value:
        left, right = value.split(":", 1)
        return Decimal(left.strip()) / Decimal(right.strip())
    if "/" in value:
        left, right = value.split("/", 1)
        return Decimal(left.strip()) / Decimal(right.strip())

    return Decimal(value)


def _get_market_session_id() -> str:
    """Return a stable market-session identifier for duplicate-notification control."""
    try:
        from zoneinfo import ZoneInfo

        ny_tz = ZoneInfo("America/New_York")
    except Exception:
        from datetime import timezone

        ny_tz = timezone(timedelta(hours=-5))

    return datetime.now(ny_tz).strftime("%Y-%m-%d")


def _is_notification_sent_this_session(
    db,
    user_id: int,
    asset_id: int,
    session_id: str,
) -> bool:
    existing = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .filter(
            Notification.type.in_(
                [
                    NotificationType.DAILY_CHANGE_UP,
                    NotificationType.DAILY_CHANGE_DOWN,
                ]
            )
        )
        .filter(text("metadata->>'asset_id' = :asset_id"))
        .filter(text("metadata->>'session_id' = :session_id"))
        .params(asset_id=str(asset_id), session_id=session_id)
        .first()
    )
    return existing is not None


def _should_check_daily_changes() -> bool:
    from app.routers.health import get_market_status

    return get_market_status() in ["open", "afterhours"]


def _get_currently_held_assets(db) -> list[Asset]:
    """Return assets with a strictly positive current quantity across portfolios."""
    asset_ids = db.query(Transaction.asset_id.distinct()).all()
    held_assets: list[Asset] = []

    for asset_id_row in asset_ids:
        asset_id = asset_id_row[0]
        transactions = (
            db.query(Transaction)
            .filter(Transaction.asset_id == asset_id)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )

        total_quantity = Decimal("0")
        for tx in transactions:
            if tx.type in [
                TransactionType.BUY,
                TransactionType.TRANSFER_IN,
                TransactionType.CONVERSION_IN,
            ]:
                total_quantity += tx.quantity
            elif tx.type in [
                TransactionType.SELL,
                TransactionType.TRANSFER_OUT,
                TransactionType.CONVERSION_OUT,
            ]:
                total_quantity -= tx.quantity
            elif tx.type == TransactionType.SPLIT:
                split_value = "1:1"
                if tx.meta_data:
                    split_value = tx.meta_data.get("split", "1:1")
                total_quantity *= _parse_split_ratio(split_value)

        if total_quantity > 0:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                held_assets.append(asset)

    return held_assets


@celery_app.task(name="app.tasks.maintenance_tasks.check_price_alerts")
@singleton_task(timeout=300)
def check_price_alerts() -> dict:
    """Check watchlist price alerts and create notifications when targets are hit."""
    try:
        with get_db_context() as db:
            watchlist_rows = (
                db.query(Watchlist, Asset)
                .join(Asset, Asset.id == Watchlist.asset_id)
                .filter(Watchlist.alert_enabled.is_(True))
                .filter(Watchlist.alert_target_price.isnot(None))
                .all()
            )

            if not watchlist_rows:
                logger.info("No active price alerts to check")
                return {"status": "success", "alerts_checked": 0, "alerts_triggered": 0}

            symbols = sorted({asset.symbol for _, asset in watchlist_rows})
            pricing_service = PricingService(db)
            quotes = asyncio.run(pricing_service.get_multiple_prices(symbols))

            alerts_triggered = 0
            for item, asset in watchlist_rows:
                quote = quotes.get(asset.symbol)
                if not quote:
                    continue

                current_price = Decimal(str(quote.price))
                target_price = Decimal(str(item.alert_target_price))
                if target_price == 0:
                    logger.warning(
                        "Skipping price alert %s for asset %s because target price is zero",
                        item.id,
                        asset.symbol,
                    )
                    continue
                price_diff_pct = abs((current_price - target_price) / target_price * 100)

                if price_diff_pct > 1.0:
                    continue

                notification_service.create_price_alert_notification(
                    db=db,
                    user_id=item.user_id,
                    watchlist_item=item,
                    current_price=current_price,
                    target_price=target_price,
                )
                item.alert_enabled = False
                alerts_triggered += 1

                logger.info(
                    "Price alert triggered for %s: current=%s target=%s",
                    asset.symbol,
                    current_price,
                    target_price,
                )

            logger.info(
                "Price alert check completed. Triggered=%s Checked=%s",
                alerts_triggered,
                len(watchlist_rows),
            )
            return {
                "status": "success",
                "alerts_checked": len(watchlist_rows),
                "alerts_triggered": alerts_triggered,
            }
    except Exception as exc:
        logger.error("Price alert check failed: %s", exc, exc_info=True)
        return {"status": "error", "message": str(exc)}


@celery_app.task(name="app.tasks.maintenance_tasks.cleanup_old_notifications")
@singleton_task(timeout=300)
def cleanup_old_notifications() -> dict:
    """Delete notifications older than the configured retention window."""
    from app.config import settings

    if settings.NOTIFICATIONS_RETENTION_DAYS <= 0:
        return {"status": "success", "deleted": 0, "retention_days": 0}

    try:
        with get_db_context() as db:
            from app.crud.notifications import delete_old_notifications

            deleted = delete_old_notifications(
                db,
                days=settings.NOTIFICATIONS_RETENTION_DAYS,
            )
            logger.info(
                "Notifications cleanup completed. Deleted %s notifications older than %s days.",
                deleted,
                settings.NOTIFICATIONS_RETENTION_DAYS,
            )
            return {
                "status": "success",
                "deleted": deleted,
                "retention_days": settings.NOTIFICATIONS_RETENTION_DAYS,
            }
    except Exception as exc:
        logger.error("Notifications cleanup failed: %s", exc, exc_info=True)
        return {"status": "error", "message": str(exc)}


@celery_app.task(name="app.tasks.maintenance_tasks.check_daily_changes")
@singleton_task(timeout=900)
def check_daily_changes() -> dict:
    """Notify users when held assets move beyond configured daily thresholds."""
    if not _should_check_daily_changes():
        logger.info("Skipping daily change check because market is closed")
        return {"status": "skipped", "reason": "market_closed"}

    try:
        from app.services.portfolio_analytics.metrics import MetricsService
        from app.utils.notification_thresholds import get_daily_change_threshold

        with get_db_context() as db:
            session_id = _get_market_session_id()
            users = (
                db.query(User)
                .filter(User.is_active.is_(True))
                .filter(User.daily_change_notifications_enabled.is_(True))
                .all()
            )

            if not users:
                logger.info("No users with daily change notifications enabled")
                return {"status": "success", "users_checked": 0, "notifications_created": 0}

            total_notifications = 0
            total_skipped = 0

            for user in users:
                notified_assets: set[int] = set()
                portfolios = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()

                for portfolio in portfolios:
                    try:
                        metrics_service = MetricsService(db)
                        positions = asyncio.run(metrics_service.get_positions(portfolio.id))
                    except Exception as exc:
                        logger.error(
                            "Error checking positions for portfolio %s: %s",
                            portfolio.id,
                            exc,
                        )
                        continue

                    for position in positions:
                        if position.daily_change_pct is None:
                            continue

                        asset = db.query(Asset).filter(Asset.id == position.asset_id).first()
                        if not asset:
                            continue

                        threshold = get_daily_change_threshold(asset)
                        daily_change = abs(position.daily_change_pct)
                        if daily_change < threshold:
                            continue

                        if position.asset_id in notified_assets:
                            total_skipped += 1
                            continue

                        if _is_notification_sent_this_session(
                            db,
                            user.id,
                            position.asset_id,
                            session_id,
                        ):
                            total_skipped += 1
                            continue

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
                            session_id=session_id,
                        )
                        notified_assets.add(position.asset_id)
                        total_notifications += 1

                        logger.info(
                            "Daily change notification created for %s (user=%s change=%+.2f threshold=%s)",
                            position.symbol,
                            user.id,
                            position.daily_change_pct,
                            threshold,
                        )

            logger.info(
                "Daily change check completed. Created=%s Skipped=%s Users=%s",
                total_notifications,
                total_skipped,
                len(users),
            )
            return {
                "status": "success",
                "users_checked": len(users),
                "notifications_created": total_notifications,
                "notifications_skipped": total_skipped,
            }
    except Exception as exc:
        logger.error("Daily change check failed: %s", exc, exc_info=True)
        return {"status": "error", "message": str(exc)}


@celery_app.task(name="app.tasks.maintenance_tasks.fetch_daily_closing_prices")
@singleton_task(timeout=3600)
def fetch_daily_closing_prices() -> dict:
    """Fetch previous-trading-day closes for assets with active holdings."""
    try:
        with get_db_context() as db:
            from app.utils.exchange_calendars import get_missing_trading_days

            held_assets = _get_currently_held_assets(db)
            if not held_assets:
                logger.info("No held assets found, skipping daily closing price fetch")
                return {"status": "success", "assets_total": 0}

            pricing_service = PricingService(db)
            today = datetime.utcnow().date()
            window_start = datetime.combine(today - timedelta(days=7), datetime.min.time())
            window_end = datetime.combine(today - timedelta(days=1), datetime.max.time())

            successful = 0
            failed = 0
            skipped = 0

            for asset in held_assets:
                try:
                    existing_history_dates = {
                        price.asof.date()
                        for price in (
                            db.query(Price)
                            .filter(
                                Price.asset_id == asset.id,
                                Price.asof >= window_start,
                                Price.asof <= window_end,
                                Price.source == "yfinance_history",
                            )
                            .all()
                        )
                    }
                    missing_dates = get_missing_trading_days(
                        symbol=asset.symbol,
                        start_date=window_start.date(),
                        end_date=window_end.date(),
                        existing_dates=existing_history_dates,
                    )
                    if not missing_dates:
                        skipped += 1
                        continue

                    count = pricing_service.ensure_historical_prices(
                        asset,
                        datetime.combine(min(missing_dates), datetime.min.time()),
                        datetime.combine(max(missing_dates), datetime.max.time()),
                        interval="1d",
                    )
                    if count > 0:
                        successful += 1
                    else:
                        skipped += 1
                except Exception as exc:
                    failed += 1
                    logger.error("Error fetching closing price for %s: %s", asset.symbol, exc)

            logger.info(
                "Daily closing price fetch completed. Successful=%s Skipped=%s Failed=%s Total=%s",
                successful,
                skipped,
                failed,
                len(held_assets),
            )
            return {
                "status": "success",
                "assets_total": len(held_assets),
                "successful": successful,
                "skipped": skipped,
                "failed": failed,
            }
    except Exception as exc:
        logger.error("Daily closing price fetch failed: %s", exc, exc_info=True)
        return {"status": "error", "message": str(exc)}


@celery_app.task(name="app.tasks.maintenance_tasks.detect_and_fill_price_gaps")
@singleton_task(timeout=7200)
def detect_and_fill_price_gaps() -> dict:
    """Detect missing historical prices and backfill them from yfinance."""
    try:
        from app.utils.exchange_calendars import calculate_coverage

        with get_db_context() as db:
            asset_ids = db.query(Transaction.asset_id.distinct()).all()
            asset_ids = [row[0] for row in asset_ids]

            pricing_service = PricingService(db)
            assets_checked = 0
            assets_with_gaps = 0
            total_prices_added = 0
            errors: list[str] = []

            for asset_id in asset_ids:
                try:
                    asset = db.query(Asset).filter(Asset.id == asset_id).first()
                    if not asset:
                        continue

                    assets_checked += 1
                    end_date = datetime.utcnow()
                    one_year_ago = end_date - timedelta(days=365)

                    if asset.first_transaction_date:
                        start_date = datetime.combine(
                            asset.first_transaction_date,
                            datetime.min.time(),
                        )
                        if start_date < one_year_ago:
                            start_date = one_year_ago
                    else:
                        start_date = one_year_ago

                    prices = (
                        db.query(Price)
                        .filter(
                            Price.asset_id == asset_id,
                            Price.asof >= start_date,
                            Price.asof <= end_date,
                            Price.source == "yfinance_history",
                        )
                        .all()
                    )
                    price_dates = {price.asof.date() for price in prices}

                    coverage_info = calculate_coverage(
                        symbol=asset.symbol,
                        start_date=start_date.date(),
                        end_date=end_date.date(),
                        price_dates=price_dates,
                    )
                    coverage = coverage_info["coverage_pct"] / 100.0

                    if coverage >= 0.80:
                        continue

                    logger.info(
                        "Gap detected for %s: %s/%s days (%.1f%% coverage, exchange=%s)",
                        asset.symbol,
                        coverage_info["actual_data_points"],
                        coverage_info["expected_trading_days"],
                        coverage * 100,
                        coverage_info["exchange"],
                    )

                    count = pricing_service.ensure_historical_prices(
                        asset,
                        start_date,
                        end_date,
                        interval="1d",
                    )
                    if count > 0:
                        assets_with_gaps += 1
                        total_prices_added += count
                        logger.info("Backfilled %s prices for %s", count, asset.symbol)
                except Exception as exc:
                    errors.append(f"Asset {asset_id}: {exc}")
                    logger.error("Error checking asset %s: %s", asset_id, exc)

            logger.info(
                "Price gap detection completed. Checked=%s Gaps=%s PricesAdded=%s Errors=%s",
                assets_checked,
                assets_with_gaps,
                total_prices_added,
                len(errors),
            )
            return {
                "status": "success",
                "assets_checked": assets_checked,
                "assets_with_gaps": assets_with_gaps,
                "prices_added": total_prices_added,
                "errors": errors[:5],
            }
    except Exception as exc:
        logger.error("Price gap detection failed: %s", exc, exc_info=True)
        return {"status": "error", "message": str(exc)}
