"""
Background tasks for earnings calendar data fetching and caching.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal
import yfinance as yf

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import Asset, Transaction, EarningsCache
from app.tasks.decorators import singleton_task
from sqlalchemy import distinct

logger = logging.getLogger(__name__)


def serialize_value(val: Any) -> Any:
    """Serialize yfinance values to JSON-safe types"""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    if hasattr(val, 'item'):  # numpy types
        return val.item()
    if isinstance(val, Decimal):
        return float(val)
    return val


def fetch_earnings_for_symbol(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Fetch earnings data from yfinance for a single symbol.
    
    Returns dict with earnings info or None if no data available.
    """
    try:
        ticker = yf.Ticker(symbol)
        calendar = ticker.calendar
        
        if calendar is None:
            return None
            
        # Handle different calendar formats
        if hasattr(calendar, 'to_dict'):
            calendar_data = calendar.to_dict()
        elif isinstance(calendar, dict):
            calendar_data = calendar
        else:
            return None
        
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
                if hasattr(raw_date, 'date'):
                    earnings_date = raw_date.date()
                elif isinstance(raw_date, str):
                    try:
                        earnings_date = datetime.fromisoformat(raw_date.replace('Z', '+00:00')).date()
                    except:
                        pass
        
        if not earnings_date:
            return None
            
        # Extract estimates
        eps_estimate = calendar_data.get('Earnings Average') or calendar_data.get('EPS Estimate')
        if isinstance(eps_estimate, dict):
            eps_estimate = list(eps_estimate.values())[0] if eps_estimate else None
            
        revenue_estimate = calendar_data.get('Revenue Average') or calendar_data.get('Revenue Estimate')
        if isinstance(revenue_estimate, dict):
            revenue_estimate = list(revenue_estimate.values())[0] if revenue_estimate else None
        
        return {
            "earnings_date": earnings_date,
            "eps_estimate": serialize_value(eps_estimate),
            "revenue_estimate": serialize_value(revenue_estimate),
            "raw_data": {k: serialize_value(v) for k, v in calendar_data.items()},
        }
        
    except Exception as e:
        logger.warning(f"Failed to fetch earnings for {symbol}: {e}")
        return None


@celery_app.task(bind=True, name="app.tasks.calendar_tasks.refresh_earnings_cache")
@singleton_task(timeout=600)  # 10 minute timeout, prevent overlapping
def refresh_earnings_cache(self) -> dict:
    """
    Refresh earnings cache for all stock assets that are actively held.
    Only fetches for stocks (not ETFs, crypto, or other asset types).
    
    This task should run daily (e.g., at 6 AM) to keep earnings data fresh.
    """
    try:
        logger.info(f"Task {self.request.id}: Starting earnings cache refresh")
        
        with get_db_context() as db:
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
                return {"status": "success", "symbols_processed": 0, "cached": 0}
            
            symbols = [(s.symbol, s.id) for s in active_stocks]
            logger.info(f"Fetching earnings for {len(symbols)} active stocks")
            
            cached_count = 0
            failed_count = 0
            
            for symbol, asset_id in symbols:
                try:
                    earnings_data = fetch_earnings_for_symbol(symbol)
                    
                    if earnings_data and earnings_data.get("earnings_date"):
                        earnings_date = earnings_data["earnings_date"]
                        
                        # Check if we already have this entry
                        existing = db.query(EarningsCache).filter(
                            EarningsCache.symbol == symbol,
                            EarningsCache.earnings_date == earnings_date
                        ).first()
                        
                        if existing:
                            # Update existing entry
                            existing.eps_estimate = earnings_data.get("eps_estimate")
                            existing.revenue_estimate = earnings_data.get("revenue_estimate")
                            existing.raw_data = earnings_data.get("raw_data")
                            existing.fetched_at = datetime.utcnow()
                            existing.updated_at = datetime.utcnow()
                        else:
                            # Create new entry
                            new_cache = EarningsCache(
                                symbol=symbol,
                                earnings_date=earnings_date,
                                eps_estimate=earnings_data.get("eps_estimate"),
                                revenue_estimate=earnings_data.get("revenue_estimate"),
                                raw_data=earnings_data.get("raw_data"),
                                fetched_at=datetime.utcnow(),
                            )
                            db.add(new_cache)
                        
                        db.commit()
                        cached_count += 1
                        logger.debug(f"Cached earnings for {symbol}: {earnings_date}")
                        
                except Exception as e:
                    logger.warning(f"Error caching earnings for {symbol}: {e}")
                    failed_count += 1
                    db.rollback()
                    continue
            
            logger.info(
                f"Task {self.request.id}: Earnings cache refresh complete. "
                f"Cached: {cached_count}, Failed: {failed_count}, Total: {len(symbols)}"
            )
            
            return {
                "status": "success",
                "symbols_processed": len(symbols),
                "cached": cached_count,
                "failed": failed_count,
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(f"Task {self.request.id}: Error in earnings cache refresh: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@celery_app.task(bind=True, name="app.tasks.calendar_tasks.refresh_symbol_earnings")
def refresh_symbol_earnings(self, symbol: str) -> dict:
    """
    Refresh earnings cache for a single symbol.
    Called on-demand when a user adds a new stock position.
    """
    try:
        logger.info(f"Task {self.request.id}: Fetching earnings for {symbol}")
        
        earnings_data = fetch_earnings_for_symbol(symbol)
        
        if not earnings_data or not earnings_data.get("earnings_date"):
            return {"status": "success", "symbol": symbol, "cached": False, "reason": "No earnings data available"}
        
        with get_db_context() as db:
            earnings_date = earnings_data["earnings_date"]
            
            existing = db.query(EarningsCache).filter(
                EarningsCache.symbol == symbol,
                EarningsCache.earnings_date == earnings_date
            ).first()
            
            if existing:
                existing.eps_estimate = earnings_data.get("eps_estimate")
                existing.revenue_estimate = earnings_data.get("revenue_estimate")
                existing.raw_data = earnings_data.get("raw_data")
                existing.fetched_at = datetime.utcnow()
                existing.updated_at = datetime.utcnow()
            else:
                new_cache = EarningsCache(
                    symbol=symbol,
                    earnings_date=earnings_date,
                    eps_estimate=earnings_data.get("eps_estimate"),
                    revenue_estimate=earnings_data.get("revenue_estimate"),
                    raw_data=earnings_data.get("raw_data"),
                    fetched_at=datetime.utcnow(),
                )
                db.add(new_cache)
            
            db.commit()
            
        return {
            "status": "success",
            "symbol": symbol,
            "cached": True,
            "earnings_date": earnings_date.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Task {self.request.id}: Error fetching earnings for {symbol}: {e}")
        return {"status": "error", "symbol": symbol, "message": str(e)}
