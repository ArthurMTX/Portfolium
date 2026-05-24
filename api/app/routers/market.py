"""
Market data endpoints - Sentiment, indices, etc.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Literal, Tuple, Any

import httpx
from fastapi import APIRouter

from app.errors import (
    DXYDataFetchError,
    ExternalServiceError, 
    FailedToFetchCryptoSentimentError, 
    FailedToFetchMarketSentimentError,
    InvalidMarketSentimentTypeError,
    TNXDataFetchError,
    VIXDataFetchError,
)
from app.services.yahoo_finance import get_market_data_provider, yahoo_timeout_seconds

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])

# In-memory cache for market data (endpoint -> (data, timestamp))
_market_cache: Dict[str, Tuple[Any, datetime]] = {}
_CACHE_TTL = timedelta(minutes=5)  # Sentiment changes slowly; 5 minutes avoids external API churn.
_INDEX_CACHE_TTL = timedelta(seconds=60)
_STALE_CACHE_TTL = timedelta(minutes=30)
_market_refresh_tasks: set[str] = set()


async def _refresh_market_cache_async(cache_key: str, fetch_func) -> None:
    """Best-effort background refresh for stale in-memory market data."""
    if cache_key in _market_refresh_tasks:
        return

    _market_refresh_tasks.add(cache_key)
    try:
        data = await asyncio.wait_for(
            asyncio.to_thread(fetch_func),
            timeout=yahoo_timeout_seconds(default=8.0) + 2.0,
        )
        _market_cache[cache_key] = (data, datetime.now())
        logger.info("market_cache refreshed cache_key=%s", cache_key)
    except Exception as exc:
        logger.warning("market_cache refresh_failed cache_key=%s error=%s", cache_key, exc)
    finally:
        _market_refresh_tasks.discard(cache_key)


async def _get_cached_or_fetch_async(cache_key: str, fetch_func, ttl: timedelta = _CACHE_TTL):
    """
    Async wrapper that only offloads the blocking external fetch to a worker thread.
    Cache bookkeeping stays local to the event loop thread.
    """
    now = datetime.now()

    stale_data = None
    if cache_key in _market_cache:
        data, timestamp = _market_cache[cache_key]
        stale_data = data
        age = now - timestamp
        if age < ttl:
            logger.debug(f"Cache hit for {cache_key}")
            return data
        if age < _STALE_CACHE_TTL:
            logger.info(
                "market_cache stale_hit cache_key=%s age_seconds=%.1f action=return_stale enqueue_refresh=true",
                cache_key,
                age.total_seconds(),
            )
            asyncio.create_task(_refresh_market_cache_async(cache_key, fetch_func))
            return data

    logger.debug(f"Cache miss for {cache_key}, fetching fresh data")
    try:
        data = await asyncio.wait_for(
            asyncio.to_thread(fetch_func),
            timeout=yahoo_timeout_seconds(default=8.0) + 2.0,
        )
        _market_cache[cache_key] = (data, datetime.now())
        return data
    except Exception as exc:
        if stale_data is not None:
            logger.warning(
                "provider=external cache_key=%s fallback=expired_stale_memory_cache error=%s",
                cache_key,
                exc,
            )
            return stale_data
        raise


@router.get("/sentiment/stock")
async def get_stock_market_sentiment():
    """
    Get stock market sentiment from CNN Fear & Greed Index (cached for 5 minutes)
    
    Returns:
        - score: 0-100 sentiment score
        - rating: text rating (extreme fear, fear, neutral, greed, extreme greed)
        - previous_close: previous day's score
        - timestamp: when the data was collected
    """
    def fetch_stock_sentiment():
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            url = f"https://production.dataviz.cnn.io/index/fearandgreed/graphdata/{today}"
            
            # Add headers to mimic a browser request
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.cnn.com/",
                "Origin": "https://www.cnn.com",
            }
            
            with httpx.Client(timeout=5.0, headers=headers) as client:
                response = client.get(url)
                response.raise_for_status()
                data = response.json()
                
                fear_and_greed = data.get("fear_and_greed", {})
                
                return {
                    "score": round(fear_and_greed.get("score", 0)),
                    "rating": fear_and_greed.get("rating", "unknown").lower(),
                    "previous_close": round(fear_and_greed.get("previous_close", 0)),
                    "timestamp": fear_and_greed.get("timestamp"),
                }
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch stock sentiment: {e}")
            raise FailedToFetchMarketSentimentError(str(e))
        except Exception as e:
            logger.error(f"Unexpected error fetching stock sentiment: {e}")
            raise ExternalServiceError("stock market sentiment", str(e))
    
    return await _get_cached_or_fetch_async("sentiment_stock", fetch_stock_sentiment)


@router.get("/sentiment/crypto")
async def get_crypto_market_sentiment():
    """
    Get crypto market sentiment from Alternative.me Fear & Greed Index (cached for 5 minutes)
    
    Returns:
        - score: 0-100 sentiment score
        - rating: text rating (extreme fear, fear, neutral, greed, extreme greed)
        - previous_value: previous day's score
        - timestamp: when the data was collected
    """
    def fetch_crypto_sentiment():
        try:
            url = "https://api.alternative.me/fng/?limit=2"
            
            # Add headers to mimic a browser request
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
            }
            
            with httpx.Client(timeout=5.0, headers=headers) as client:
                response = client.get(url)
                response.raise_for_status()
                data = response.json()
                
                if not data.get("data") or len(data["data"]) == 0:
                    raise FailedToFetchCryptoSentimentError("No sentiment data returned")
                
                current = data["data"][0]
                previous = data["data"][1] if len(data["data"]) > 1 else None
                
                return {
                    "score": int(current.get("value", 0)),
                    "rating": current.get("value_classification", "unknown").lower(),
                    "previous_value": int(previous.get("value", 0)) if previous else None,
                    "timestamp": current.get("timestamp"),
                }
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch crypto sentiment: {e}")
            raise FailedToFetchCryptoSentimentError(str(e))
        except Exception as e:
            logger.error(f"Unexpected error fetching crypto sentiment: {e}")
            raise ExternalServiceError("crypto market sentiment", str(e))
    
    return await _get_cached_or_fetch_async("sentiment_crypto", fetch_crypto_sentiment)


@router.get("/sentiment/{market_type}")
async def get_market_sentiment(market_type: Literal["stock", "crypto"]):
    """
    Get market sentiment for either stock or crypto markets
    
    Args:
        market_type: Either "stock" or "crypto"
    
    Returns:
        Sentiment data with score, rating, and historical comparison
    """
    if market_type == "stock":
        return await get_stock_market_sentiment()
    elif market_type == "crypto":
        return await get_crypto_market_sentiment()
    else:
        raise InvalidMarketSentimentTypeError(market_type)


@router.get("/vix")
async def get_vix_index():
    """
    Get CBOE Volatility Index (VIX) data (cached for 5 minutes)
    
    Returns:
        - price: Current VIX value
        - change: Point change from previous close
        - change_pct: Percentage change from previous close
        - timestamp: When the data was collected
    """
    def fetch_vix():
        try:
            # Fetch VIX data
            provider = get_market_data_provider()
            info = provider.get_info(
                "^VIX",
                action="market_index_info",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            
            current_price = info.get("regularMarketPrice") or info.get("currentPrice")
            previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
            
            if current_price is None:
                raise VIXDataFetchError("VIX data not available")
            
            change = None
            change_pct = None
            
            if previous_close and previous_close > 0:
                change = current_price - previous_close
                change_pct = (change / previous_close) * 100
            
            return {
                "price": round(current_price, 2),
                "change": round(change, 2) if change is not None else None,
                "change_pct": round(change_pct, 2) if change_pct is not None else None,
                "previous_close": round(previous_close, 2) if previous_close else None,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to fetch VIX data: {e}")
            raise VIXDataFetchError(str(e))
    
    return await _get_cached_or_fetch_async("index_vix", fetch_vix, ttl=_INDEX_CACHE_TTL)


@router.get("/tnx")
async def get_tnx_index():
    """
    Get 10-Year Treasury Note Yield (^TNX) data (cached for 5 minutes)
    
    Returns:
        - price: Current 10-Year Treasury yield value
        - change: Point change from previous close
        - change_pct: Percentage change from previous close
        - timestamp: When the data was collected
    """
    def fetch_tnx():
        try:
            # Fetch TNX data
            provider = get_market_data_provider()
            info = provider.get_info(
                "^TNX",
                action="market_index_info",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            
            current_price = info.get("regularMarketPrice") or info.get("currentPrice")
            previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
            
            if current_price is None:
                raise TNXDataFetchError("TNX data not available")
            
            change = None
            change_pct = None
            
            if previous_close and previous_close > 0:
                change = current_price - previous_close
                change_pct = (change / previous_close) * 100
            
            return {
                "price": round(current_price, 2),
                "change": round(change, 2) if change is not None else None,
                "change_pct": round(change_pct, 2) if change_pct is not None else None,
                "previous_close": round(previous_close, 2) if previous_close else None,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to fetch TNX data: {e}")
            raise TNXDataFetchError(str(e))
    
    return await _get_cached_or_fetch_async("index_tnx", fetch_tnx, ttl=_INDEX_CACHE_TTL)


@router.get("/dxy")
async def get_dxy_index():
    """
    Get U.S. Dollar Index (DX-Y.NYB) data (cached for 5 minutes)
    
    Returns:
        - price: Current U.S. Dollar Index value
        - change: Point change from previous close
        - change_pct: Percentage change from previous close
        - timestamp: When the data was collected
    """
    def fetch_dxy():
        try:
            # Fetch DXY data
            provider = get_market_data_provider()
            info = provider.get_info(
                "DX-Y.NYB",
                action="market_index_info",
                timeout_seconds=yahoo_timeout_seconds(),
            )
            
            current_price = info.get("regularMarketPrice") or info.get("currentPrice")
            previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
            
            if current_price is None:
                raise DXYDataFetchError("DXY data not available")
            
            change = None
            change_pct = None
            
            if previous_close and previous_close > 0:
                change = current_price - previous_close
                change_pct = (change / previous_close) * 100
            
            return {
                "price": round(current_price, 2),
                "change": round(change, 2) if change is not None else None,
                "change_pct": round(change_pct, 2) if change_pct is not None else None,
                "previous_close": round(previous_close, 2) if previous_close else None,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to fetch DXY data: {e}")
            raise DXYDataFetchError(str(e))
    
    return await _get_cached_or_fetch_async("index_dxy", fetch_dxy, ttl=_INDEX_CACHE_TTL)
