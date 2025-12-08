"""
Pricing service using yfinance with Redis caching
"""
import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
import yfinance as yf
from sqlalchemy.orm import Session
from fastapi import Depends

from app.config import settings
from app.models import Asset, Price
from app.crud import prices as crud_prices
from app.schemas import PriceCreate, PriceQuote
from app.db import get_db
from app.services.cache import CacheService, cache_price, get_cached_price

logger = logging.getLogger(__name__)

# In-memory cache for price fetches (symbol -> (quote, timestamp))
_price_memory_cache: Dict[str, Tuple[PriceQuote, datetime]] = {}
_memory_cache_lock: Optional[asyncio.Lock] = None
_memory_cache_loop: Optional[asyncio.AbstractEventLoop] = None
_MEMORY_CACHE_TTL = timedelta(seconds=30)  # Very short TTL for in-memory cache

# Deduplication cache for ongoing fetches
_ongoing_fetches: Dict[str, asyncio.Task] = {}
_fetch_lock: Optional[asyncio.Lock] = None
_fetch_lock_loop: Optional[asyncio.AbstractEventLoop] = None


def _cleanup_stale_tasks():
    """
    Clean up tasks from different event loops to prevent 'attached to a different loop' errors.
    This should be called when switching between event loops (e.g., in scheduler jobs).
    """
    global _ongoing_fetches, _fetch_lock, _fetch_lock_loop
    
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop, clear everything to be safe
        _ongoing_fetches.clear()
        _fetch_lock = None
        _fetch_lock_loop = None
        return
    
    # Clear tasks that are from a different loop
    stale_symbols = []
    for symbol, task in _ongoing_fetches.items():
        try:
            if task._loop != current_loop:
                stale_symbols.append(symbol)
        except AttributeError:
            stale_symbols.append(symbol)
    
    for symbol in stale_symbols:
        _ongoing_fetches.pop(symbol, None)
    
    # Reset lock if it's from a different loop
    if _fetch_lock_loop is not None and _fetch_lock_loop != current_loop:
        _fetch_lock = None
        _fetch_lock_loop = None


def _get_memory_lock() -> asyncio.Lock:
    """Get or create the memory cache lock for the current event loop"""
    global _memory_cache_lock, _memory_cache_loop
    
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop, create one
        current_loop = asyncio.get_event_loop()
    
    # Check if lock exists and is bound to the current loop
    if _memory_cache_lock is None or _memory_cache_loop is not current_loop:
        _memory_cache_lock = asyncio.Lock()
        _memory_cache_loop = current_loop
    
    return _memory_cache_lock


def _get_fetch_lock() -> asyncio.Lock:
    """Get or create the fetch lock for the current event loop"""
    global _fetch_lock, _fetch_lock_loop
    
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop, create one
        current_loop = asyncio.get_event_loop()
    
    # Check if lock exists and is bound to the current loop
    if _fetch_lock is None or _fetch_lock_loop is not current_loop:
        _fetch_lock = asyncio.Lock()
        _fetch_lock_loop = current_loop
    
    return _fetch_lock


class PricingService:
    """Service for fetching and caching asset prices"""
    
    def __init__(self, db: Session):
        self.db = db
        self.cache_ttl = timedelta(seconds=settings.PRICE_CACHE_TTL_SECONDS)
    
    async def get_price(self, symbol: str, force_refresh: bool = False) -> Optional[PriceQuote]:
        """
        Get current price for a symbol (async to avoid blocking)
        
        Uses multi-level caching:
        1. Redis cache (30-60 seconds TTL) - fastest, shared across instances
        2. Database cache (configured TTL) - persistent across restarts
        3. yfinance API - fallback
        
        Also deduplicates concurrent requests for the same symbol.
        Includes timeout to prevent hanging on slow yfinance calls.
        """
        # Check Redis cache first (very fast, shared across instances)
        if not force_refresh:
            cached = get_cached_price(symbol)
            if cached:
                logger.debug(f"Using Redis cached price for {symbol}")
                return PriceQuote(**cached)
        
        # Get the current event loop to ensure task is created in the right loop
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running loop - this shouldn't happen in async context
            logger.warning(f"No running event loop when fetching price for {symbol}")
            return await self._get_price_internal(symbol, force_refresh)
        
        # Check if there's an ongoing fetch for this symbol in the current loop
        async with _get_fetch_lock():
            if symbol in _ongoing_fetches:
                existing_task = _ongoing_fetches[symbol]
                # Verify the task is from the same event loop
                try:
                    # Check if task's loop matches current loop
                    if existing_task._loop == current_loop:
                        logger.info(f"Reusing ongoing price fetch for {symbol}")
                        try:
                            return await asyncio.wait_for(existing_task, timeout=15.0)
                        except asyncio.TimeoutError:
                            logger.warning(f"Timeout waiting for ongoing fetch for {symbol}")
                            return None
                        except asyncio.CancelledError:
                            logger.warning(f"Task cancelled while waiting for ongoing fetch for {symbol}")
                            _ongoing_fetches.pop(symbol, None)
                            return None
                    else:
                        # Task is from a different loop, remove it and create a new one
                        logger.warning(f"Removing stale task for {symbol} (different event loop)")
                        _ongoing_fetches.pop(symbol, None)
                except AttributeError:
                    # Task doesn't have _loop attribute (shouldn't happen), treat as stale
                    logger.warning(f"Removing invalid task for {symbol}")
                    _ongoing_fetches.pop(symbol, None)
            
            # Create a new task for this fetch in the current loop
            task = asyncio.create_task(self._get_price_internal(symbol, force_refresh))
            _ongoing_fetches[symbol] = task
        
        try:
            # Add timeout to prevent hanging
            result = await asyncio.wait_for(task, timeout=20.0)
            
            # Update Redis cache
            if result:
                # Cache with shorter TTL during market hours, longer after close
                now = datetime.utcnow()
                # Market hours: 14:30-21:00 UTC (9:30-16:00 EST)
                is_market_hours = 14 <= now.hour < 21 and now.weekday() < 5
                ttl = 60 if is_market_hours else 300  # 1 min or 5 min
                
                cache_price(symbol, result.model_dump(), ttl)
            
            return result
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching price for {symbol}")
            return None
        except asyncio.CancelledError:
            logger.warning(f"Task cancelled while fetching price for {symbol}")
            return None
        finally:
            # Remove from ongoing fetches
            async with _get_fetch_lock():
                _ongoing_fetches.pop(symbol, None)
    
    async def _get_price_internal(self, symbol: str, force_refresh: bool = False) -> Optional[PriceQuote]:
        """
        Internal method that actually fetches the price
        
        1. Check cache (DB) with TTL
        2. If stale/missing or force_refresh, fetch from yfinance
        3. Update cache
        """
        # Get asset
        asset = self.db.query(Asset).filter(Asset.symbol == symbol).first()
        if not asset:
            logger.warning(f"Asset not found: {symbol}")
            return None
        
        # Check DB cache
        latest_price = crud_prices.get_latest_price(self.db, asset.id)
        
        if not force_refresh and latest_price and self._is_price_fresh(latest_price.asof):
            logger.info(f"Using DB cached price for {symbol}")
            # Try to get the official previous close price from DB first
            daily_change_pct = self._calculate_daily_change_with_official_close(asset.id, latest_price.price)
            
            # If we don't have a daily change (no historical data), try to fetch just the previous close from yfinance
            if daily_change_pct is None:
                logger.info(f"No historical data for {symbol}, fetching previous close from yfinance")
                prev_close_data = await asyncio.to_thread(self._fetch_previous_close_only, symbol, asset.id)
                if prev_close_data:
                    daily_change_pct = (
                        (latest_price.price - prev_close_data) / prev_close_data * 100
                    )
            
            return PriceQuote(
                symbol=symbol,
                price=latest_price.price,
                asof=latest_price.asof,
                currency=asset.currency,
                daily_change_pct=daily_change_pct
            )
        
        # Fetch from yfinance (in thread pool to avoid blocking event loop)
        logger.info(f"Fetching fresh price for {symbol} from yfinance")
        price = await asyncio.to_thread(self._fetch_from_yfinance, symbol)
        
        if price:
            # Calculate daily change percentage
            daily_change_pct = None
            if "previous_close" in price and price["previous_close"] > 0:
                daily_change_pct = (
                    (price["price"] - price["previous_close"]) / price["previous_close"] * 100
                )
                
                # Save the official previous close as a historical price point
                # Use a special source tag to distinguish it from intraday prices
                yesterday = datetime.utcnow() - timedelta(days=1)
                # Check if we already have an official previous close stored
                existing_prev = crud_prices.get_prices(
                    self.db, 
                    asset.id, 
                    date_from=yesterday - timedelta(hours=12),
                    date_to=yesterday + timedelta(hours=12),
                    limit=10  # Get more to check for official close
                )
                # Only save if we don't have a yfinance_prev_close for this time period
                has_official_close = any(p.source == "yfinance_prev_close" for p in existing_prev)
                if not has_official_close:
                    try:
                        prev_price_create = PriceCreate(
                            asset_id=asset.id,
                            asof=yesterday,
                            price=price["previous_close"],
                            volume=None,
                            source="yfinance_prev_close"
                        )
                        crud_prices.create_price(self.db, prev_price_create)
                        logger.info(f"Saved previous close price for {symbol}: {price['previous_close']}")
                    except Exception as e:
                        logger.warning(f"Failed to save previous close for {symbol}: {e}")
            
            # Save current price to cache
            price_create = PriceCreate(
                asset_id=asset.id,
                asof=price["asof"],
                price=price["price"],
                volume=price.get("volume"),
                source="yfinance"
            )
            crud_prices.create_price(self.db, price_create)
            
            # Trigger ATH update in background
            try:
                from app.tasks.ath_tasks import update_asset_ath
                update_asset_ath.delay(
                    asset_id=asset.id,
                    current_price=float(price["price"]),
                    price_date=price["asof"].isoformat() if price["asof"] else None
                )
            except Exception as e:
                logger.warning(f"Failed to trigger ATH update for {symbol}: {e}")
            
            return PriceQuote(
                symbol=symbol,
                price=price["price"],
                asof=price["asof"],
                currency=asset.currency,
                daily_change_pct=daily_change_pct
            )
        
        # Fallback to last known price
        if latest_price:
            logger.warning(f"yfinance failed, using last known price for {symbol}")
            daily_change_pct = self._calculate_daily_change_with_official_close(asset.id, latest_price.price)
            
            return PriceQuote(
                symbol=symbol,
                price=latest_price.price,
                asof=latest_price.asof,
                currency=asset.currency,
                daily_change_pct=daily_change_pct
            )
        
        return None
    
    async def get_multiple_prices(self, symbols: List[str]) -> Dict[str, PriceQuote]:
        """
        Get prices for multiple symbols concurrently.
        
        NOTE: Database writes are serialized to avoid SQLAlchemy session concurrency issues.
        We fetch from yfinance in parallel but save to DB one at a time.
        """
        results = {}
        
        # Process each symbol sequentially to avoid DB session conflicts
        # The get_price method handles caching, so this is still efficient
        for symbol in symbols:
            try:
                price = await self.get_price(symbol)
                if price:
                    results[symbol] = price
            except Exception as e:
                logger.error(f"Error fetching price for {symbol}: {e}")
        
        return results
    
    async def refresh_all_portfolio_prices(self, portfolio_id: int) -> int:
        """
        Refresh prices for all assets in a portfolio concurrently
        Returns number of prices updated
        """
        from app.models import Transaction
        
        # Get unique assets in portfolio
        assets = (
            self.db.query(Asset)
            .join(Transaction)
            .filter(Transaction.portfolio_id == portfolio_id)
            .distinct()
            .all()
        )
        
        # Force refresh all prices concurrently
        symbols = [asset.symbol for asset in assets]
        tasks = [self.get_price(symbol, force_refresh=True) for symbol in symbols]
        prices = await asyncio.gather(*tasks, return_exceptions=True)
        
        count = sum(1 for price in prices if not isinstance(price, Exception) and price)
        
        logger.info(f"Refreshed {count} prices for portfolio {portfolio_id}")
        return count

    def ensure_historical_prices(self, asset: Asset, start_date: datetime, end_date: datetime, interval: str = '1d') -> int:
        """
        Ensure historical close prices exist in DB for an asset over [start_date, end_date].
        Returns number of new price rows saved.
        """
        try:
            # Fetch history from yfinance
            ticker = yf.Ticker(asset.symbol)
            # Map our interval to yfinance interval
            yf_interval = '1d' if interval in ('1d', '1w') else '1d'
            hist = ticker.history(start=start_date.date(), end=(end_date + timedelta(days=1)).date(), interval=yf_interval)
            if hist is None or hist.empty:
                return 0

            from app.schemas import PriceCreate
            from app.crud import prices as crud_prices

            new_count = 0
            # Save close prices by day
            for idx, row in hist.iterrows():
                try:
                    asof_dt = datetime(idx.year, idx.month, idx.day)
                    price_val = Decimal(str(float(row.get('Close'))))
                    if price_val and price_val > 0:
                        pc = PriceCreate(
                            asset_id=asset.id,
                            asof=asof_dt,
                            price=price_val,
                            volume=int(row.get('Volume', 0)) if 'Volume' in row else None,
                            source='yfinance_history'
                        )
                        crud_prices.create_price(self.db, pc)
                        new_count += 1
                except Exception:
                    # Skip bad row
                    continue
            return new_count
        except Exception as e:
            logger.warning(f"Failed to fetch history for {asset.symbol}: {e}")
            return 0
    
    def _fetch_from_yfinance(self, symbol: str) -> Optional[Dict]:
        """
        Fetch price from Yahoo Finance
        
        Returns dict with price, asof, volume, previous_close or None
        
        Strategy: Use ticker.info for both current price and previousClose.
        This matches what Yahoo Finance website and other platforms (Trade Republic) show.
        The previousClose includes after-hours trading and is the reference point for
        intraday percentage calculations that users expect to see.
        """
        import socket
        # Set socket timeout to prevent hanging on slow network
        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(10.0)  # 10 second timeout
        
        try:
            ticker = yf.Ticker(symbol)
            
            # Try to get current price and previous close from info
            # This is what Yahoo Finance website uses and what users expect
            logger.info(f"Fetching data for {symbol}")
            try:
                info = ticker.info
                current_price = info.get('regularMarketPrice') or info.get('currentPrice')
                prev_close = info.get('previousClose')
                
                if current_price and current_price > 0:
                    result = {
                        "price": Decimal(str(current_price)),
                        "asof": datetime.utcnow(),
                        "volume": info.get('regularMarketVolume')
                    }
                    
                    if prev_close and prev_close > 0:
                        result["previous_close"] = Decimal(str(prev_close))
                        logger.info(f"Yahoo Finance for {symbol}: price=${current_price}, prev_close=${prev_close}")
                    
                    return result
            except Exception as e:
                logger.warning(f"ticker.info failed for {symbol}: {e}")
            
            # Fallback to history for both current and previous close
            logger.info(f"Fetching history for {symbol}")
            hist = ticker.history(period="10d")
            
            if not hist.empty:
                logger.info(f"History data for {symbol}: {len(hist)} rows")
                last_row = hist.iloc[-1]
                current_price = Decimal(str(float(last_row["Close"])))
                
                result = {
                    "price": current_price,
                    "asof": datetime.utcnow(),
                    "volume": int(last_row.get("Volume", 0)) if "Volume" in last_row else None
                }
                
                # Get previous close from history
                if len(hist) > 1:
                    prev_row = hist.iloc[-2]
                    prev_close_val = Decimal(str(float(prev_row["Close"])))
                    result["previous_close"] = prev_close_val
                    logger.info(f"Using history for {symbol}: price=${current_price}, prev_close=${prev_close_val}")
                
                return result
            
            logger.error(f"No data returned from yfinance for {symbol}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e}")
            return None
        finally:
            # Restore original timeout
            socket.setdefaulttimeout(old_timeout)
    
    def _is_price_fresh(self, asof: datetime) -> bool:
        """Check if price is within TTL"""
        age = datetime.utcnow() - asof
        return age < self.cache_ttl
    
    def _fetch_previous_close_only(self, symbol: str, asset_id: int) -> Optional[Decimal]:
        """
        Fetch only the previous close from yfinance and save it to DB.
        This is used when we have a cached price but no historical data for daily change calculation.
        Returns the previous close price if found, None otherwise.
        
        Uses ticker.info previousClose to match what Yahoo Finance website shows.
        """
        try:
            ticker = yf.Ticker(symbol)
            
            # Try ticker.info first - matches Yahoo Finance website
            try:
                info = ticker.info
                prev_close = info.get('previousClose')
                
                if prev_close and prev_close > 0:
                    prev_close_decimal = Decimal(str(prev_close))
                    
                    # Save to DB if not already saved
                    yesterday = datetime.utcnow() - timedelta(days=1)
                    existing_prev = crud_prices.get_prices(
                        self.db, 
                        asset_id, 
                        date_from=yesterday - timedelta(hours=12),
                        date_to=yesterday + timedelta(hours=12),
                        limit=10
                    )
                    has_official_close = any(p.source == "yfinance_prev_close" for p in existing_prev)
                    if not has_official_close:
                        prev_price_create = PriceCreate(
                            asset_id=asset_id,
                            asof=yesterday,
                            price=prev_close_decimal,
                            volume=None,
                            source="yfinance_prev_close"
                        )
                        crud_prices.create_price(self.db, prev_price_create)
                        logger.info(f"Saved previous close from info for {symbol}: {prev_close_decimal}")
                    
                    return prev_close_decimal
            except Exception as e:
                logger.warning(f"ticker.info failed for {symbol}, trying history: {e}")
            
            # Fallback to history
            hist = ticker.history(period="10d")
            if not hist.empty and len(hist) > 1:
                prev_row = hist.iloc[-2]
                prev_close_decimal = Decimal(str(float(prev_row["Close"])))
                
                # Save to DB
                yesterday = datetime.utcnow() - timedelta(days=1)
                existing_prev = crud_prices.get_prices(
                    self.db, 
                    asset_id, 
                    date_from=yesterday - timedelta(hours=12),
                    date_to=yesterday + timedelta(hours=12),
                    limit=10
                )
                has_official_close = any(p.source == "yfinance_prev_close" for p in existing_prev)
                if not has_official_close:
                    prev_price_create = PriceCreate(
                        asset_id=asset_id,
                        asof=yesterday,
                        price=prev_close_decimal,
                        volume=None,
                        source="yfinance_prev_close"
                    )
                    crud_prices.create_price(self.db, prev_price_create)
                    logger.info(f"Saved previous close from history for {symbol}: {prev_close_decimal}")
                
                return prev_close_decimal
            
            return None
        except Exception as e:
            logger.error(f"Error fetching previous close for {symbol}: {e}")
            return None
    
    def _calculate_daily_change_with_official_close(self, asset_id: int, current_price: Decimal) -> Optional[Decimal]:
        """
        Calculate daily change percentage using the official previous close price.
        Prioritizes yfinance_prev_close entries over regular intraday prices.
        """
        try:
            # Look for the official previous close in the last 5 days (to handle weekends)
            lookback = datetime.utcnow() - timedelta(days=5)
            previous_prices = crud_prices.get_prices(
                self.db, 
                asset_id, 
                date_from=lookback,
                limit=100  # Get enough to find official close or good approximation
            )
            
            if previous_prices:
                # First, try to find an official previous close (source = yfinance_prev_close)
                official_closes = [p for p in previous_prices if p.source == "yfinance_prev_close"]
                if official_closes:
                    # Use the most recent official close
                    prev_price = official_closes[0].price
                    if prev_price and prev_price > 0:
                        return ((current_price - prev_price) / prev_price * 100)
                
                # Fallback: get a price from approximately 1 day ago
                # Look for prices between 18-30 hours ago (to approximate previous day's close)
                target_time = datetime.utcnow() - timedelta(hours=24)
                min_time = datetime.utcnow() - timedelta(hours=30)
                max_time = datetime.utcnow() - timedelta(hours=18)
                
                approximate_prices = [
                    p for p in previous_prices 
                    if min_time <= p.asof <= max_time
                ]
                
                if approximate_prices:
                    # Use the closest price to 24 hours ago
                    closest_price = min(approximate_prices, key=lambda p: abs((p.asof - target_time).total_seconds()))
                    prev_price = closest_price.price
                    if prev_price and prev_price > 0:
                        return ((current_price - prev_price) / prev_price * 100)
                
                # Last fallback: use any price from at least 12 hours ago
                old_cutoff = datetime.utcnow() - timedelta(hours=12)
                old_prices = [p for p in previous_prices if p.asof < old_cutoff]
                if old_prices:
                    # Get the most recent of the old prices (first in list since ordered DESC)
                    prev_price = old_prices[0].price
                    if prev_price and prev_price > 0:
                        return ((current_price - prev_price) / prev_price * 100)
            
            return None
        except Exception as e:
            logger.error(f"Error calculating daily change for asset {asset_id}: {e}")
            return None


def get_pricing_service(db: Session = Depends(get_db)) -> PricingService:
    """Dependency for getting pricing service"""
    return PricingService(db)
