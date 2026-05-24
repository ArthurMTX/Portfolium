"""
Pricing service using yfinance with Redis caching

Features:
- Batch downloading to minimize API calls and avoid rate limits
- Multi-level caching (Redis + DB)
- Request deduplication
- Exponential backoff on rate limits
"""
import asyncio
import logging
import random
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
import yfinance as yf
import pandas as pd
from sqlalchemy.orm import Session
from fastapi import Depends

from app.config import settings
from app.models import Asset, Price
from app.crud import prices as crud_prices
from app.schemas import PriceCreate, PriceQuote
from app.db import get_db
from app.services.cache import CacheService, cache_price, get_cached_price
from app.services.market_calendar import MarketAwareCacheTTL
from app.services.yahoo_finance import (
    call_yahoo,
    yahoo_timeout_seconds,
)

logger = logging.getLogger(__name__)

# Rate limiting tracker - GLOBAL circuit breaker
# Uses Redis for cross-process sharing between API and Celery workers
_RATE_LIMIT_KEY = "yfinance:rate_limit_until"
_last_batch_fetch_time: float = 0
_rate_limit_backoff: float = 0  # Local backoff for exponential calculation

def _get_batch_min_interval() -> float:
    """Get minimum interval between batch requests from settings"""
    return getattr(settings, 'PRICE_BATCH_MIN_INTERVAL', 2.0)

def _get_max_backoff() -> float:
    """Get maximum backoff time from settings"""
    return getattr(settings, 'PRICE_MAX_BACKOFF_SECONDS', 120.0)

def is_rate_limited() -> bool:
    """Check if we're currently in a rate limit backoff period (circuit breaker).
    Uses Redis for cross-process state sharing."""
    try:
        from app.redis_client import get_redis
        redis = get_redis()
        if redis:
            until_str = redis.get(_RATE_LIMIT_KEY)
            if until_str:
                until = float(until_str)
                return time.time() < until
    except Exception:
        pass
    return False

def get_rate_limit_remaining() -> float:
    """Get seconds remaining in rate limit period"""
    try:
        from app.redis_client import get_redis
        redis = get_redis()
        if redis:
            until_str = redis.get(_RATE_LIMIT_KEY)
            if until_str:
                remaining = float(until_str) - time.time()
                return max(0, remaining)
    except Exception:
        pass
    return 0

def set_rate_limited(duration_seconds: float = 60.0):
    """Set the rate limit circuit breaker for a duration.
    Stores in Redis for cross-process sharing."""
    global _rate_limit_backoff
    _rate_limit_backoff = duration_seconds
    try:
        from app.redis_client import get_redis
        redis = get_redis()
        if redis:
            until = time.time() + duration_seconds
            redis.setex(_RATE_LIMIT_KEY, int(duration_seconds) + 5, str(until))
    except Exception as e:
        logger.warning(f"Failed to set rate limit in Redis: {e}")
    logger.warning(f"Rate limit circuit breaker activated for {duration_seconds:.1f}s")

def reset_rate_limit():
    """Reset rate limit state on successful fetch"""
    global _rate_limit_backoff
    if _rate_limit_backoff > 0:
        _rate_limit_backoff = max(0, _rate_limit_backoff - 5)
        if _rate_limit_backoff == 0:
            try:
                from app.redis_client import get_redis
                redis = get_redis()
                if redis:
                    redis.delete(_RATE_LIMIT_KEY)
            except Exception:
                pass
            logger.info("Rate limit circuit breaker reset")

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
                            return self._get_stale_price_quote(symbol, reason="ongoing_fetch_timeout")
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
                # Use market-aware TTL: short during trading, long after hours
                ttl = MarketAwareCacheTTL.get_ttl_for_symbol(symbol)
                logger.debug(f"Caching {symbol} with TTL={ttl}s (market-aware)")
                cache_price(symbol, result.model_dump(), ttl)
            
            return result
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching price for {symbol}")
            return self._get_stale_price_quote(symbol, reason="fetch_timeout")
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
    
    async def get_multiple_prices(self, symbols: List[str], force_refresh: bool = False) -> Dict[str, PriceQuote]:
        """
        Get prices for multiple symbols using BATCH downloading to minimize API calls.
        
        This method uses yf.download() to fetch all symbols in a SINGLE API request,
        which dramatically reduces rate limiting issues compared to individual fetches.
        
        Strategy:
        1. Check Redis/DB cache for each symbol
        2. Collect symbols that need fresh data
        3. Batch fetch all missing symbols in ONE API call
        4. Update caches and return results
        
        Performance:
        - Old approach: 30 symbols = 30+ API calls (rate limited!)
        - New approach: 30 symbols = 1-2 API calls (batch download)
        """
        results = {}
        symbols_to_fetch = []
        
        # Phase 1: Check caches first
        for symbol in symbols:
            if not force_refresh:
                # Check Redis cache first
                cached = get_cached_price(symbol)
                if cached:
                    logger.debug(f"Using Redis cached price for {symbol}")
                    results[symbol] = PriceQuote(**cached)
                    continue
                
                # Check DB cache
                asset = self.db.query(Asset).filter(Asset.symbol == symbol).first()
                if asset:
                    latest_price = crud_prices.get_latest_price(self.db, asset.id)
                    if latest_price and self._is_price_fresh(latest_price.asof):
                        daily_change_pct = self._calculate_daily_change_with_official_close(
                            asset.id, latest_price.price
                        )
                        quote = PriceQuote(
                            symbol=symbol,
                            price=latest_price.price,
                            asof=latest_price.asof,
                            currency=asset.currency,
                            daily_change_pct=daily_change_pct
                        )
                        results[symbol] = quote
                        # Also cache in Redis with market-aware TTL
                        ttl = MarketAwareCacheTTL.get_ttl_for_symbol(symbol)
                        cache_price(symbol, quote.model_dump(), ttl)
                        continue
            
            symbols_to_fetch.append(symbol)
        
        if not symbols_to_fetch:
            logger.info(f"All {len(symbols)} symbols served from cache")
            return results
        
        logger.info(f"Need to fetch {len(symbols_to_fetch)}/{len(symbols)} symbols via batch download")
        
        # Phase 2: Batch fetch all missing symbols
        try:
            batch_results = await asyncio.wait_for(
                asyncio.to_thread(self._batch_fetch_from_yfinance, symbols_to_fetch),
                timeout=yahoo_timeout_seconds(default=15.0) + 5.0,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "provider=yahoo action=batch_download timeout=true symbols=%s fallback=stale_db",
                len(symbols_to_fetch),
            )
            batch_results = {}
        
        # Phase 3: Process batch results and update caches
        for symbol in symbols_to_fetch:
            if symbol in batch_results and batch_results[symbol]:
                price_data = batch_results[symbol]
                asset = self.db.query(Asset).filter(Asset.symbol == symbol).first()
                
                if asset:
                    # Calculate daily change
                    daily_change_pct = None
                    if price_data.get("previous_close"):
                        prev = price_data["previous_close"]
                        curr = price_data["price"]
                        if prev and prev > 0:
                            daily_change_pct = (curr - prev) / prev * 100
                    
                    # Save to DB
                    try:
                        price_create = PriceCreate(
                            asset_id=asset.id,
                            asof=price_data["asof"],
                            price=price_data["price"],
                            volume=price_data.get("volume"),
                            source="yfinance_batch"
                        )
                        crud_prices.create_price(self.db, price_create)
                    except Exception as e:
                        logger.warning(f"Failed to save price for {symbol}: {e}")
                    
                    quote = PriceQuote(
                        symbol=symbol,
                        price=price_data["price"],
                        asof=price_data["asof"],
                        currency=asset.currency if asset else "USD",
                        daily_change_pct=daily_change_pct
                    )
                    results[symbol] = quote
                    
                    # Cache in Redis with market-aware TTL
                    ttl = MarketAwareCacheTTL.get_ttl_for_symbol(symbol)
                    cache_price(symbol, quote.model_dump(), ttl)
            else:
                # Fallback to last known price
                asset = self.db.query(Asset).filter(Asset.symbol == symbol).first()
                if asset:
                    latest_price = crud_prices.get_latest_price(self.db, asset.id)
                    if latest_price:
                        logger.warning(f"Batch fetch failed for {symbol}, using last known price")
                        daily_change_pct = self._calculate_daily_change_with_official_close(
                            asset.id, latest_price.price
                        )
                        results[symbol] = PriceQuote(
                            symbol=symbol,
                            price=latest_price.price,
                            asof=latest_price.asof,
                            currency=asset.currency,
                            daily_change_pct=daily_change_pct
                        )
        
        logger.info(f"Batch fetch complete: {len(results)}/{len(symbols)} symbols have prices")
        return results
    
    def _batch_fetch_from_yfinance(self, symbols: List[str]) -> Dict[str, Optional[Dict]]:
        """
        Batch fetch prices for multiple symbols using yf.download().
        
        This makes a SINGLE API call for all symbols, dramatically reducing
        rate limiting issues compared to individual Ticker.info calls.
        
        Returns dict mapping symbol -> price data or None
        """
        global _last_batch_fetch_time, _rate_limit_backoff
        
        if not symbols:
            return {}
        
        # Circuit breaker - if we're rate limited, don't even try
        if is_rate_limited():
            remaining = get_rate_limit_remaining()
            logger.warning(f"Rate limit circuit breaker active, skipping batch fetch ({remaining:.1f}s remaining)")
            return {}
        
        try:
            # Rate limiting: ensure minimum interval between batch requests
            now = time.time()
            time_since_last = now - _last_batch_fetch_time
            wait_time = max(0, _get_batch_min_interval() + _rate_limit_backoff - time_since_last)
            
            if wait_time > 0:
                logger.info(f"Rate limiting: waiting {wait_time:.1f}s before batch fetch")
                time.sleep(wait_time)
            
            _last_batch_fetch_time = time.time()
            
            # Batch download - ONE API call for all symbols!
            logger.info(f"Batch downloading {len(symbols)} symbols: {symbols[:10]}{'...' if len(symbols) > 10 else ''}")
            
            # Use 2 days of data to get current price and previous close
            df = call_yahoo(
                lambda: yf.download(
                    symbols,
                    period="2d",
                    interval="1d",
                    group_by="ticker",
                    auto_adjust=True,
                    progress=False,
                    threads=True,
                ),
                symbol=",".join(symbols[:5]) + ("..." if len(symbols) > 5 else ""),
                action="batch_download",
                timeout_seconds=yahoo_timeout_seconds(default=15.0),
            )
            
            if df is None or df.empty:
                logger.warning("Batch download returned empty data")
                backoff = min(_rate_limit_backoff * 2 + 1, _get_max_backoff())
                set_rate_limited(backoff)  # Trigger circuit breaker
                return {}
            
            # Success - reset backoff
            reset_rate_limit()
            
            results = {}
            now = datetime.utcnow()
            
            # Handle single symbol case (different DataFrame structure)
            if len(symbols) == 1:
                symbol = symbols[0]
                if 'Close' in df.columns and not df['Close'].empty:
                    closes = df['Close'].dropna()
                    if len(closes) >= 1:
                        current_price = Decimal(str(float(closes.iloc[-1])))
                        prev_close = Decimal(str(float(closes.iloc[-2]))) if len(closes) >= 2 else None
                        volume = int(df['Volume'].iloc[-1]) if 'Volume' in df.columns and not pd.isna(df['Volume'].iloc[-1]) else None
                        
                        results[symbol] = {
                            "price": current_price,
                            "previous_close": prev_close,
                            "asof": now,
                            "volume": volume
                        }
            else:
                # Multi-symbol case
                for symbol in symbols:
                    try:
                        if symbol in df.columns.get_level_values(0):
                            symbol_data = df[symbol]
                            if 'Close' in symbol_data.columns:
                                closes = symbol_data['Close'].dropna()
                                if len(closes) >= 1:
                                    current_price = Decimal(str(float(closes.iloc[-1])))
                                    prev_close = Decimal(str(float(closes.iloc[-2]))) if len(closes) >= 2 else None
                                    volume = None
                                    if 'Volume' in symbol_data.columns:
                                        vol_val = symbol_data['Volume'].iloc[-1]
                                        if not pd.isna(vol_val):
                                            volume = int(vol_val)
                                    
                                    results[symbol] = {
                                        "price": current_price,
                                        "previous_close": prev_close,
                                        "asof": now,
                                        "volume": volume
                                    }
                    except Exception as e:
                        logger.warning(f"Failed to parse batch data for {symbol}: {e}")
            
            logger.info(f"Batch download successful: got {len(results)}/{len(symbols)} prices")
            return results
            
        except Exception as e:
            error_msg = str(e).lower()
            if "rate" in error_msg or "limit" in error_msg or "429" in error_msg or "too many" in error_msg:
                # Rate limited - trigger circuit breaker with jitter
                backoff = min(_rate_limit_backoff * 2 + random.uniform(30, 90), _get_max_backoff())
                set_rate_limited(backoff)
            else:
                logger.error(f"Batch fetch error: {e}")
            return {}

    async def refresh_all_portfolio_prices(self, portfolio_id: int) -> int:
        """
        Refresh prices for all assets in a portfolio using batch fetch.
        Returns number of prices updated.
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
        
        # Use batch fetch for efficiency
        symbols = [asset.symbol for asset in assets]
        prices = await self.get_multiple_prices(symbols, force_refresh=True)
        
        count = len(prices)
        logger.info(f"Refreshed {count} prices for portfolio {portfolio_id}")
        return count

    def ensure_historical_prices(self, asset: Asset, start_date: datetime, end_date: datetime, interval: str = '1d') -> int:
        """
        Ensure historical close prices exist in DB for an asset over [start_date, end_date].
        Returns number of new price rows saved.
        """
        try:
            ticker = yf.Ticker(asset.symbol)
            # Map our interval to yfinance interval
            yf_interval = '1d' if interval in ('1d', '1w') else '1d'
            hist = call_yahoo(
                lambda: ticker.history(
                    start=start_date.date(),
                    end=(end_date + timedelta(days=1)).date(),
                    interval=yf_interval,
                ),
                symbol=asset.symbol,
                action="history_backfill",
                timeout_seconds=yahoo_timeout_seconds(default=15.0),
            )
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
        
        Note: For multiple symbols, prefer using get_multiple_prices() which uses
        batch downloading to minimize API calls and avoid rate limits.
        """
        global _rate_limit_backoff
        
        # Circuit breaker - if we're rate limited, don't even try
        if is_rate_limited():
            remaining = get_rate_limit_remaining()
            logger.debug(f"Rate limit circuit breaker active for {symbol}, skipping ({remaining:.1f}s remaining)")
            return None
        
        try:
            ticker = yf.Ticker(symbol)
            
            # Try to get current price and previous close from info
            # This is what Yahoo Finance website uses and what users expect
            logger.info(f"Fetching data for {symbol}")
            try:
                info = call_yahoo(
                    lambda: ticker.info,
                    symbol=symbol,
                    action="ticker_info",
                    timeout_seconds=yahoo_timeout_seconds(),
                )
                current_price = info.get('regularMarketPrice') or info.get('currentPrice')
                prev_close = info.get('previousClose')
                
                if current_price and current_price > 0:
                    # Success - reduce backoff
                    reset_rate_limit()
                    
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
                error_msg = str(e).lower()
                if "rate" in error_msg or "limit" in error_msg or "429" in error_msg or "too many" in error_msg:
                    backoff = min(_rate_limit_backoff * 2 + random.uniform(30, 60), _get_max_backoff())
                    set_rate_limited(backoff)
                    return None  # Don't even try history fallback if rate limited
                else:
                    logger.warning(f"ticker.info failed for {symbol}: {e}")
            
            # Fallback to history for both current and previous close
            logger.info(f"Fetching history for {symbol}")
            hist = call_yahoo(
                lambda: ticker.history(period="10d"),
                symbol=symbol,
                action="history_current",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            
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
                info = call_yahoo(
                    lambda: ticker.info,
                    symbol=symbol,
                    action="previous_close_info",
                    timeout_seconds=yahoo_timeout_seconds(),
                )
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
            hist = call_yahoo(
                lambda: ticker.history(period="10d"),
                symbol=symbol,
                action="previous_close_history",
                timeout_seconds=yahoo_timeout_seconds(),
            )
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

    def _get_stale_price_quote(self, symbol: str, reason: str) -> Optional[PriceQuote]:
        """Return the latest DB price even if it is stale."""
        asset = self.db.query(Asset).filter(Asset.symbol == symbol).first()
        if not asset:
            return None

        latest_price = crud_prices.get_latest_price(self.db, asset.id)
        if not latest_price:
            return None

        logger.warning(
            "provider=yahoo symbol=%s fallback=stale_db reason=%s asof=%s",
            symbol,
            reason,
            latest_price.asof,
        )
        daily_change_pct = self._calculate_daily_change_with_official_close(
            asset.id,
            latest_price.price,
        )
        return PriceQuote(
            symbol=symbol,
            price=latest_price.price,
            asof=latest_price.asof,
            currency=asset.currency,
            daily_change_pct=daily_change_pct,
        )
    
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
