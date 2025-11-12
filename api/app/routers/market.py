"""
Market data endpoints - Sentiment, indices, etc.
"""
import logging
from datetime import datetime
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/sentiment/stock")
async def get_stock_market_sentiment():
    """
    Get stock market sentiment from CNN Fear & Greed Index
    
    Returns:
        - score: 0-100 sentiment score
        - rating: text rating (extreme fear, fear, neutral, greed, extreme greed)
        - previous_close: previous day's score
        - timestamp: when the data was collected
    """
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
        
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            response = await client.get(url)
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
        raise HTTPException(status_code=503, detail="Failed to fetch stock market sentiment data")
    except Exception as e:
        logger.error(f"Unexpected error fetching stock sentiment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/sentiment/crypto")
async def get_crypto_market_sentiment():
    """
    Get crypto market sentiment from Alternative.me Fear & Greed Index
    
    Returns:
        - score: 0-100 sentiment score
        - rating: text rating (extreme fear, fear, neutral, greed, extreme greed)
        - previous_value: previous day's score
        - timestamp: when the data was collected
    """
    try:
        url = "https://api.alternative.me/fng/?limit=2"
        
        # Add headers to mimic a browser request
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }
        
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            if not data.get("data") or len(data["data"]) == 0:
                raise HTTPException(status_code=503, detail="No crypto sentiment data available")
            
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
        raise HTTPException(status_code=503, detail="Failed to fetch crypto market sentiment data")
    except Exception as e:
        logger.error(f"Unexpected error fetching crypto sentiment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


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
        raise HTTPException(status_code=400, detail="Invalid market type. Use 'stock' or 'crypto'")


@router.get("/vix")
async def get_vix_index():
    """
    Get CBOE Volatility Index (VIX) data
    
    Returns:
        - price: Current VIX value
        - change: Point change from previous close
        - change_pct: Percentage change from previous close
        - timestamp: When the data was collected
    """
    try:
        import yfinance as yf
        
        # Fetch VIX data
        vix = yf.Ticker("^VIX")
        info = vix.info
        
        current_price = info.get("regularMarketPrice") or info.get("currentPrice")
        previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
        
        if current_price is None:
            raise HTTPException(status_code=503, detail="VIX data not available")
        
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
        raise HTTPException(status_code=503, detail="Failed to fetch VIX data")


@router.get("/tnx")
async def get_tnx_index():
    """
    Get 10-Year Treasury Note Yield (^TNX) data
    
    Returns:
        - price: Current 10-Year Treasury yield value
        - change: Point change from previous close
        - change_pct: Percentage change from previous close
        - timestamp: When the data was collected
    """
    try:
        import yfinance as yf
        
        # Fetch TNX data
        tnx = yf.Ticker("^TNX")
        info = tnx.info
        
        current_price = info.get("regularMarketPrice") or info.get("currentPrice")
        previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
        
        if current_price is None:
            raise HTTPException(status_code=503, detail="TNX data not available")
        
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
        raise HTTPException(status_code=503, detail="Failed to fetch TNX data")


@router.get("/dxy")
async def get_dxy_index():
    """
    Get U.S. Dollar Index (DX-Y.NYB) data
    
    Returns:
        - price: Current U.S. Dollar Index value
        - change: Point change from previous close
        - change_pct: Percentage change from previous close
        - timestamp: When the data was collected
    """
    try:
        import yfinance as yf
        
        # Fetch DXY data
        dxy = yf.Ticker("DX-Y.NYB")
        info = dxy.info
        
        current_price = info.get("regularMarketPrice") or info.get("currentPrice")
        previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
        
        if current_price is None:
            raise HTTPException(status_code=503, detail="DXY data not available")
        
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
        raise HTTPException(status_code=503, detail="Failed to fetch DXY data")
