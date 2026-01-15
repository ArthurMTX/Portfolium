"""
Background tasks for tracking All-Time High (ATH) prices
"""
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db import get_db
from app.models.asset import Asset

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.update_asset_ath")
def update_asset_ath(asset_id: int, current_price: float, price_date: Optional[str] = None) -> dict:
    """
    Update the all-time high (ATH) and all-time low (ATL) for an asset if current price 
    exceeds stored ATH or falls below ATL. Notifies users holding this asset when ATH/ATL is reached.
    
    Args:
        asset_id: The asset ID to update
        current_price: The current/latest price
        price_date: ISO format datetime string when this price was recorded (defaults to now)
        
    Returns:
        dict with keys:
            - ath_updated: bool, whether ATH was updated
            - atl_updated: bool, whether ATL was updated
            - asset_id: int
            - symbol: str
            - old_ath: float or None
            - new_ath: float or None
            - old_atl: float or None
            - new_atl: float or None
            - ath_date: str or None
            - atl_date: str or None
            - users_notified: int, number of users notified
    """
    db = next(get_db())
    try:
        from app.models import User, Portfolio, Transaction
        from app.services.notifications import notification_service
        
        # Get the asset
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            logger.warning(f"Asset {asset_id} not found, cannot update ATH/ATL")
            return {"ath_updated": False, "atl_updated": False, "asset_id": asset_id, "error": "Asset not found"}
        
        current_price_decimal = Decimal(str(current_price))
        
        # Determine the date for this price
        if price_date:
            try:
                price_datetime = datetime.fromisoformat(price_date)
            except ValueError:
                logger.warning(f"Invalid price_date format: {price_date}, using current time")
                price_datetime = datetime.utcnow()
        else:
            price_datetime = datetime.utcnow()
        
        old_ath = asset.ath_price
        old_atl = asset.atl_price
        ath_updated = False
        atl_updated = False
        users_notified = 0
        
        # Update ATH if:
        # 1. No ATH exists yet (first time), OR
        # 2. Current price is higher than stored ATH
        if asset.ath_price is None or current_price_decimal > asset.ath_price:
            previous_ath = asset.ath_price
            asset.ath_price = current_price_decimal
            asset.ath_date = price_datetime
            asset.updated_at = datetime.utcnow()
            ath_updated = True
            
            logger.info(
                f"Updated ATH for {asset.symbol}: "
                f"{old_ath} -> {current_price_decimal} on {price_datetime.date()}"
            )
            
            # Notify users who hold this asset
            users_notified += _notify_users_for_ath_atl(
                db, asset, current_price_decimal, is_ath=True, previous_value=previous_ath
            )
        
        # Update ATL if:
        # 1. No ATL exists yet (first time), OR
        # 2. Current price is lower than stored ATL
        if asset.atl_price is None or current_price_decimal < asset.atl_price:
            previous_atl = asset.atl_price
            asset.atl_price = current_price_decimal
            asset.atl_date = price_datetime
            asset.updated_at = datetime.utcnow()
            atl_updated = True
            
            logger.info(
                f"Updated ATL for {asset.symbol}: "
                f"{old_atl} -> {current_price_decimal} on {price_datetime.date()}"
            )
            
            # Notify users who hold this asset
            users_notified += _notify_users_for_ath_atl(
                db, asset, current_price_decimal, is_ath=False, previous_value=previous_atl
            )
        
        if ath_updated or atl_updated:
            db.commit()
        
        return {
            "ath_updated": ath_updated,
            "atl_updated": atl_updated,
            "asset_id": asset_id,
            "symbol": asset.symbol,
            "old_ath": float(old_ath) if old_ath else None,
            "new_ath": float(asset.ath_price) if asset.ath_price else None,
            "old_atl": float(old_atl) if old_atl else None,
            "new_atl": float(asset.atl_price) if asset.atl_price else None,
            "ath_date": asset.ath_date.isoformat() if asset.ath_date else None,
            "atl_date": asset.atl_date.isoformat() if asset.atl_date else None,
            "users_notified": users_notified
        }
        
    except Exception as e:
        logger.error(f"Error updating ATH/ATL for asset {asset_id}: {e}")
        db.rollback()
        return {
            "ath_updated": False,
            "atl_updated": False,
            "asset_id": asset_id,
            "error": str(e)
        }
    finally:
        db.close()


def _notify_users_for_ath_atl(
    db: Session,
    asset: Asset,
    current_price: Decimal,
    is_ath: bool,
    previous_value: Optional[Decimal] = None
) -> int:
    """
    Notify all users who hold this asset about ATH or ATL
    
    Args:
        db: Database session
        asset: The asset that hit ATH/ATL
        current_price: The current price
        is_ath: True for ATH notification, False for ATL
        previous_value: Previous ATH or ATL value
        
    Returns:
        Number of users notified
    """
    from app.models import User, Portfolio, Transaction
    from app.services.notifications import notification_service
    
    try:
        # Find all users who have transactions with this asset and have notifications enabled
        users_with_asset = (
            db.query(User)
            .join(Portfolio, Portfolio.user_id == User.id)
            .join(Transaction, Transaction.portfolio_id == Portfolio.id)
            .filter(Transaction.asset_id == asset.id)
            .filter(User.is_active == True)
            .filter(User.ath_atl_notifications_enabled == True)
            .distinct()
            .all()
        )
        
        notified_count = 0
        for user in users_with_asset:
            try:
                if is_ath:
                    notification_service.create_ath_notification(
                        db=db,
                        user_id=user.id,
                        symbol=asset.symbol,
                        asset_name=asset.name,
                        asset_id=asset.id,
                        current_price=current_price,
                        previous_ath=previous_value
                    )
                else:
                    notification_service.create_atl_notification(
                        db=db,
                        user_id=user.id,
                        symbol=asset.symbol,
                        asset_name=asset.name,
                        asset_id=asset.id,
                        current_price=current_price,
                        previous_atl=previous_value
                    )
                notified_count += 1
            except Exception as e:
                logger.error(f"Failed to notify user {user.id} about {'ATH' if is_ath else 'ATL'}: {e}")
                continue
        
        logger.info(
            f"Notified {notified_count} users about {asset.symbol} {'ATH' if is_ath else 'ATL'} "
            f"at ${current_price}"
        )
        return notified_count
        
    except Exception as e:
        logger.error(f"Error notifying users for {'ATH' if is_ath else 'ATL'}: {e}")
        return 0


@celery_app.task(name="tasks.backfill_ath_from_yfinance")
def backfill_ath_from_yfinance(asset_id: Optional[int] = None) -> dict:
    """
    Backfill ATH and ATL data from yfinance (fetches complete historical data)
    
    Args:
        asset_id: Optional asset ID to backfill. If None, backfills all assets.
        
    Returns:
        dict with keys:
            - processed: int, number of assets processed
            - ath_updated: int, number of assets with ATH updated
            - atl_updated: int, number of assets with ATL updated
            - errors: list of error messages
    """
    db = next(get_db())
    try:
        import yfinance as yf
        
        processed = 0
        ath_updated = 0
        atl_updated = 0
        errors = []
        
        # Build query for assets to process
        query = select(Asset)
        if asset_id:
            query = query.where(Asset.id == asset_id)
        
        assets = db.execute(query).scalars().all()
        
        for asset in assets:
            try:
                logger.info(f"Fetching all-time high/low for {asset.symbol} from yfinance...")
                
                # Fetch complete historical data from yfinance
                ticker = yf.Ticker(asset.symbol)
                hist = ticker.history(period="max")  # Get all available historical data
                
                if hist.empty:
                    logger.warning(f"No historical data available for {asset.symbol}")
                    processed += 1
                    continue
                
                # Find the highest closing price (ATH)
                max_price = hist['Close'].max()
                max_price_idx = hist['Close'].idxmax()
                max_price_date = max_price_idx.to_pydatetime()
                
                # Find the lowest closing price (ATL)
                min_price = hist['Close'].min()
                min_price_idx = hist['Close'].idxmin()
                min_price_date = min_price_idx.to_pydatetime()
                
                # Update ATH if no ATH exists or found price is higher
                if asset.ath_price is None or Decimal(str(max_price)) > asset.ath_price:
                    asset.ath_price = Decimal(str(max_price))
                    asset.ath_date = max_price_date
                    ath_updated += 1
                    
                    logger.info(
                        f"Updated ATH for {asset.symbol}: "
                        f"{max_price} on {max_price_date.date()}"
                    )
                else:
                    logger.info(f"ATH for {asset.symbol} unchanged: {asset.ath_price}")
                
                # Update ATL if no ATL exists or found price is lower
                if asset.atl_price is None or Decimal(str(min_price)) < asset.atl_price:
                    asset.atl_price = Decimal(str(min_price))
                    asset.atl_date = min_price_date
                    atl_updated += 1
                    
                    logger.info(
                        f"Updated ATL for {asset.symbol}: "
                        f"{min_price} on {min_price_date.date()}"
                    )
                else:
                    logger.info(f"ATL for {asset.symbol} unchanged: {asset.atl_price}")
                
                asset.updated_at = datetime.utcnow()
                processed += 1
                
            except Exception as e:
                error_msg = f"Error processing asset {asset.symbol}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        db.commit()
        
        logger.info(
            f"ATH/ATL backfill complete: {processed} assets processed, "
            f"{ath_updated} ATH updated, {atl_updated} ATL updated"
        )
        
        return {
            "processed": processed,
            "ath_updated": ath_updated,
            "atl_updated": atl_updated,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in ATH/ATL backfill: {e}")
        db.rollback()
        return {
            "processed": 0,
            "ath_updated": 0,
            "atl_updated": 0,
            "errors": [str(e)]
        }
    finally:
        db.close()


@celery_app.task(name="tasks.backfill_ath_from_prices")
def backfill_ath_from_prices(asset_id: Optional[int] = None) -> dict:
    """
    Backfill ATH and ATL data from historical prices table (local data only)
    
    Note: This only uses data we have in the database. For true all-time high/low,
    use backfill_ath_from_yfinance instead.
    
    Args:
        asset_id: Optional asset ID to backfill. If None, backfills all assets.
        
    Returns:
        dict with keys:
            - processed: int, number of assets processed
            - ath_updated: int, number of assets with ATH updated
            - atl_updated: int, number of assets with ATL updated
            - errors: list of error messages
    """
    db = next(get_db())
    try:
        from app.models.price import Price
        
        processed = 0
        ath_updated = 0
        atl_updated = 0
        errors = []
        
        # Build query for assets to process
        query = select(Asset)
        if asset_id:
            query = query.where(Asset.id == asset_id)
        
        assets = db.execute(query).scalars().all()
        
        for asset in assets:
            try:
                # Find the highest price for this asset from prices table (ATH)
                max_price_result = db.query(
                    Price.price, Price.asof
                ).filter(
                    Price.asset_id == asset.id,
                    Price.price.isnot(None)
                ).order_by(
                    Price.price.desc()
                ).first()
                
                if max_price_result:
                    max_price, max_price_date = max_price_result
                    
                    # Update if no ATH exists or found price is higher
                    if asset.ath_price is None or max_price > asset.ath_price:
                        asset.ath_price = max_price
                        asset.ath_date = max_price_date
                        ath_updated += 1
                        
                        logger.info(
                            f"Backfilled ATH for {asset.symbol}: "
                            f"{max_price} on {max_price_date.date() if max_price_date else 'unknown'}"
                        )
                
                # Find the lowest price for this asset from prices table (ATL)
                min_price_result = db.query(
                    Price.price, Price.asof
                ).filter(
                    Price.asset_id == asset.id,
                    Price.price.isnot(None)
                ).order_by(
                    Price.price.asc()
                ).first()
                
                if min_price_result:
                    min_price, min_price_date = min_price_result
                    
                    # Update if no ATL exists or found price is lower
                    if asset.atl_price is None or min_price < asset.atl_price:
                        asset.atl_price = min_price
                        asset.atl_date = min_price_date
                        atl_updated += 1
                        
                        logger.info(
                            f"Backfilled ATL for {asset.symbol}: "
                            f"{min_price} on {min_price_date.date() if min_price_date else 'unknown'}"
                        )
                
                if max_price_result or min_price_result:
                    asset.updated_at = datetime.utcnow()
                
                processed += 1
                
            except Exception as e:
                error_msg = f"Error processing asset {asset.symbol}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        db.commit()
        
        logger.info(
            f"ATH/ATL backfill complete: {processed} assets processed, "
            f"{ath_updated} ATH updated, {atl_updated} ATL updated"
        )
        
        return {
            "processed": processed,
            "ath_updated": ath_updated,
            "atl_updated": atl_updated,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in ATH/ATL backfill: {e}")
        db.rollback()
        return {
            "processed": 0,
            "ath_updated": 0,
            "atl_updated": 0,
            "errors": [str(e)]
        }
    finally:
        db.close()
