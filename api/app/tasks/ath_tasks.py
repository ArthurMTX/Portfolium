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
    Update the all-time high (ATH) for an asset if current price exceeds stored ATH
    
    Args:
        asset_id: The asset ID to update
        current_price: The current/latest price
        price_date: ISO format datetime string when this price was recorded (defaults to now)
        
    Returns:
        dict with keys:
            - updated: bool, whether ATH was updated
            - asset_id: int
            - symbol: str
            - old_ath: float or None
            - new_ath: float or None
            - ath_date: str or None
    """
    db = next(get_db())
    try:
        # Get the asset
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            logger.warning(f"Asset {asset_id} not found, cannot update ATH")
            return {"updated": False, "asset_id": asset_id, "error": "Asset not found"}
        
        current_price_decimal = Decimal(str(current_price))
        
        # Determine the date for this ATH
        if price_date:
            try:
                ath_datetime = datetime.fromisoformat(price_date)
            except ValueError:
                logger.warning(f"Invalid price_date format: {price_date}, using current time")
                ath_datetime = datetime.utcnow()
        else:
            ath_datetime = datetime.utcnow()
        
        old_ath = asset.ath_price
        updated = False
        
        # Update ATH if:
        # 1. No ATH exists yet (first time), OR
        # 2. Current price is higher than stored ATH
        if asset.ath_price is None or current_price_decimal > asset.ath_price:
            asset.ath_price = current_price_decimal
            asset.ath_date = ath_datetime
            asset.updated_at = datetime.utcnow()
            db.commit()
            updated = True
            
            logger.info(
                f"Updated ATH for {asset.symbol}: "
                f"{old_ath} -> {current_price_decimal} on {ath_datetime.date()}"
            )
        
        return {
            "updated": updated,
            "asset_id": asset_id,
            "symbol": asset.symbol,
            "old_ath": float(old_ath) if old_ath else None,
            "new_ath": float(asset.ath_price) if asset.ath_price else None,
            "ath_date": asset.ath_date.isoformat() if asset.ath_date else None,
        }
        
    except Exception as e:
        logger.error(f"Error updating ATH for asset {asset_id}: {e}")
        db.rollback()
        return {
            "updated": False,
            "asset_id": asset_id,
            "error": str(e)
        }
    finally:
        db.close()


@celery_app.task(name="tasks.backfill_ath_from_yfinance")
def backfill_ath_from_yfinance(asset_id: Optional[int] = None) -> dict:
    """
    Backfill ATH data from yfinance (fetches complete historical data)
    
    Args:
        asset_id: Optional asset ID to backfill. If None, backfills all assets.
        
    Returns:
        dict with keys:
            - processed: int, number of assets processed
            - updated: int, number of assets with ATH updated
            - errors: list of error messages
    """
    db = next(get_db())
    try:
        import yfinance as yf
        
        processed = 0
        updated = 0
        errors = []
        
        # Build query for assets to process
        query = select(Asset)
        if asset_id:
            query = query.where(Asset.id == asset_id)
        
        assets = db.execute(query).scalars().all()
        
        for asset in assets:
            try:
                logger.info(f"Fetching all-time high for {asset.symbol} from yfinance...")
                
                # Fetch complete historical data from yfinance
                ticker = yf.Ticker(asset.symbol)
                hist = ticker.history(period="max")  # Get all available historical data
                
                if hist.empty:
                    logger.warning(f"No historical data available for {asset.symbol}")
                    processed += 1
                    continue
                
                # Find the highest closing price
                max_price = hist['Close'].max()
                max_price_idx = hist['Close'].idxmax()
                max_price_date = max_price_idx.to_pydatetime()
                
                # Update if no ATH exists or found price is higher
                if asset.ath_price is None or Decimal(str(max_price)) > asset.ath_price:
                    asset.ath_price = Decimal(str(max_price))
                    asset.ath_date = max_price_date
                    asset.updated_at = datetime.utcnow()
                    updated += 1
                    
                    logger.info(
                        f"Updated ATH for {asset.symbol}: "
                        f"{max_price} on {max_price_date.date()}"
                    )
                else:
                    logger.info(f"ATH for {asset.symbol} unchanged: {asset.ath_price}")
                
                processed += 1
                
            except Exception as e:
                error_msg = f"Error processing asset {asset.symbol}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        db.commit()
        
        logger.info(f"ATH backfill complete: {processed} assets processed, {updated} updated")
        
        return {
            "processed": processed,
            "updated": updated,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in ATH backfill: {e}")
        db.rollback()
        return {
            "processed": 0,
            "updated": 0,
            "errors": [str(e)]
        }
    finally:
        db.close()


@celery_app.task(name="tasks.backfill_ath_from_prices")
def backfill_ath_from_prices(asset_id: Optional[int] = None) -> dict:
    """
    Backfill ATH data from historical prices table (local data only)
    
    Note: This only uses data we have in the database. For true all-time high,
    use backfill_ath_from_yfinance instead.
    
    Args:
        asset_id: Optional asset ID to backfill. If None, backfills all assets.
        
    Returns:
        dict with keys:
            - processed: int, number of assets processed
            - updated: int, number of assets with ATH updated
            - errors: list of error messages
    """
    db = next(get_db())
    try:
        from app.models.price import Price
        
        processed = 0
        updated = 0
        errors = []
        
        # Build query for assets to process
        query = select(Asset)
        if asset_id:
            query = query.where(Asset.id == asset_id)
        
        assets = db.execute(query).scalars().all()
        
        for asset in assets:
            try:
                # Find the highest price for this asset from prices table
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
                        asset.updated_at = datetime.utcnow()
                        updated += 1
                        
                        logger.info(
                            f"Backfilled ATH for {asset.symbol}: "
                            f"{max_price} on {max_price_date.date() if max_price_date else 'unknown'}"
                        )
                
                processed += 1
                
            except Exception as e:
                error_msg = f"Error processing asset {asset.symbol}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        db.commit()
        
        logger.info(f"ATH backfill complete: {processed} assets processed, {updated} updated")
        
        return {
            "processed": processed,
            "updated": updated,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in ATH backfill: {e}")
        db.rollback()
        return {
            "processed": 0,
            "updated": 0,
            "errors": [str(e)]
        }
    finally:
        db.close()
