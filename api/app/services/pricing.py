"""
Pricing service using yfinance with caching
"""
import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
import yfinance as yf
from sqlalchemy.orm import Session
from fastapi import Depends

from app.config import settings
from app.models import Asset, Price
from app.crud import prices as crud_prices
from app.schemas import PriceCreate, PriceQuote
from app.db import get_db

logger = logging.getLogger(__name__)


class PricingService:
    """Service for fetching and caching asset prices"""
    
    def __init__(self, db: Session):
        self.db = db
        self.cache_ttl = timedelta(seconds=settings.PRICE_CACHE_TTL_SECONDS)
    
    async def get_price(self, symbol: str, force_refresh: bool = False) -> Optional[PriceQuote]:
        """
        Get current price for a symbol (async to avoid blocking)
        
        1. Check cache (DB) with TTL
        2. If stale/missing or force_refresh, fetch from yfinance
        3. Update cache
        """
        # Get asset
        asset = self.db.query(Asset).filter(Asset.symbol == symbol).first()
        if not asset:
            logger.warning(f"Asset not found: {symbol}")
            return None
        
        # Check cache
        latest_price = crud_prices.get_latest_price(self.db, asset.id)
        
        if not force_refresh and latest_price and self._is_price_fresh(latest_price.asof):
            logger.info(f"Using cached price for {symbol}")
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
        """Get prices for multiple symbols concurrently"""
        # Fetch all prices in parallel using asyncio.gather
        tasks = [self.get_price(symbol) for symbol in symbols]
        prices = await asyncio.gather(*tasks, return_exceptions=True)
        
        results = {}
        for symbol, price in zip(symbols, prices):
            if isinstance(price, Exception):
                logger.error(f"Error fetching price for {symbol}: {price}")
            elif price:
                results[symbol] = price
        
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
        """
        try:
            ticker = yf.Ticker(symbol)
            
            # Try fast_info first (faster) - includes previous close
            try:
                info = ticker.fast_info
                price = float(info.get('last_price', 0))
                prev_close = float(info.get('previous_close', 0))
                
                logger.info(f"Yahoo Finance fast_info for {symbol}: price={price}, prev_close={prev_close}")
                
                if price > 0:
                    result = {
                        "price": Decimal(str(price)),
                        "asof": datetime.utcnow(),
                        "volume": None
                    }
                    if prev_close > 0:
                        result["previous_close"] = Decimal(str(prev_close))
                        logger.info(f"Added previous_close={prev_close} to result for {symbol}")
                    return result
            except Exception as e:
                logger.warning(f"fast_info failed for {symbol}: {e}")
            
            # Fallback to history - get 5 days to ensure we have previous close
            logger.info(f"Fetching history for {symbol}")
            hist = ticker.history(period="5d")
            if not hist.empty:
                logger.info(f"History data for {symbol}: {len(hist)} rows")
                last_row = hist.iloc[-1]
                result = {
                    "price": Decimal(str(float(last_row["Close"]))),
                    "asof": datetime.utcnow(),
                    "volume": int(last_row.get("Volume", 0)) if "Volume" in last_row else None
                }
                
                # Get previous close from history
                if len(hist) > 1:
                    prev_row = hist.iloc[-2]
                    prev_close_val = Decimal(str(float(prev_row["Close"])))
                    result["previous_close"] = prev_close_val
                    logger.info(f"Added previous_close={prev_close_val} from history for {symbol}")
                
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
        """
        try:
            ticker = yf.Ticker(symbol)
            
            # Try fast_info first
            try:
                info = ticker.fast_info
                prev_close = float(info.get('previous_close', 0))
                
                if prev_close > 0:
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
                        logger.info(f"Saved previous close for {symbol}: {prev_close_decimal}")
                    
                    return prev_close_decimal
            except Exception as e:
                logger.warning(f"fast_info failed for {symbol} when fetching prev close: {e}")
            
            # Fallback to history
            hist = ticker.history(period="5d")
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
