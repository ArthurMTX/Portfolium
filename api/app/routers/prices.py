"""
Prices router
"""
from typing import List, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from datetime import timedelta
from decimal import Decimal
import asyncio
import logging

from app.errors import InvalidPriceRequestError, PortfolioNotFoundError
from app.db import get_db
from app.schemas import PriceQuote
from app.services.pricing import get_pricing_service, PricingService, is_rate_limited, get_rate_limit_remaining
from app.services.yahoo_finance import get_market_data_provider, yahoo_timeout_seconds
from app.crud import portfolios as portfolio_crud

logger = logging.getLogger(__name__)
router = APIRouter()
_indices_cache: Dict[str, tuple[Dict[str, PriceQuote], datetime]] = {}
_INDICES_CACHE_TTL = timedelta(seconds=60)
_INDICES_STALE_TTL = timedelta(minutes=30)
_indices_refresh_tasks: set[str] = set()


def _batch_fetch_indices(symbols: List[str]) -> Dict[str, PriceQuote]:
    """Batch fetch all indices in a single provider call."""
    prices = {}
    try:
        provider = get_market_data_provider()
        df = provider.download(
            symbols,
            action="market_indices_download",
            timeout_seconds=yahoo_timeout_seconds(default=15.0),
            period="2d",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )

        if df is None or df.empty:
            logger.warning("No data returned for market indices batch fetch")
            return {}

        now = datetime.utcnow()

        if len(symbols) == 1:
            symbol = symbols[0]
            if 'Close' in df.columns:
                closes = df['Close'].dropna()
                if len(closes) >= 1:
                    current_price = Decimal(str(float(closes.iloc[-1])))
                    prev_close = Decimal(str(float(closes.iloc[-2]))) if len(closes) >= 2 else None
                    daily_change_pct = None
                    if prev_close and prev_close > 0:
                        daily_change_pct = (current_price - prev_close) / prev_close * 100

                    prices[symbol] = PriceQuote(
                        symbol=symbol,
                        price=current_price,
                        asof=now,
                        currency="USD",
                        daily_change_pct=daily_change_pct
                    )
        else:
            for symbol in symbols:
                try:
                    if symbol in df.columns.get_level_values(0):
                        symbol_data = df[symbol]
                        if 'Close' in symbol_data.columns:
                            closes = symbol_data['Close'].dropna()
                            if len(closes) >= 1:
                                current_price = Decimal(str(float(closes.iloc[-1])))
                                prev_close = Decimal(str(float(closes.iloc[-2]))) if len(closes) >= 2 else None
                                daily_change_pct = None
                                if prev_close and prev_close > 0:
                                    daily_change_pct = (current_price - prev_close) / prev_close * 100

                                prices[symbol] = PriceQuote(
                                    symbol=symbol,
                                    price=current_price,
                                    asof=now,
                                    currency="USD",
                                    daily_change_pct=daily_change_pct
                                )
                except Exception as e:
                    logger.warning(f"Failed to parse index data for {symbol}: {e}")

        logger.info(f"Fetched {len(prices)}/{len(symbols)} market indices via batch download")
        return prices

    except Exception as e:
        error_msg = str(e).lower()
        if "rate" in error_msg or "limit" in error_msg or "429" in error_msg or "too many" in error_msg:
            from app.services.pricing import set_rate_limited
            set_rate_limited(60)
        logger.warning(f"Failed to fetch market indices: {e}")
        return {}


async def _refresh_indices_cache_async(cache_key: str, symbols: List[str]) -> None:
    """Best-effort background refresh for stale market indices cache."""
    if cache_key in _indices_refresh_tasks:
        return

    _indices_refresh_tasks.add(cache_key)
    try:
        prices = await asyncio.wait_for(
            asyncio.to_thread(_batch_fetch_indices, symbols),
            timeout=yahoo_timeout_seconds(default=15.0) + 5.0,
        )
        if prices:
            _indices_cache[cache_key] = (prices, datetime.utcnow())
            logger.info("indices_cache refreshed symbols=%s", len(symbols))
    except Exception as exc:
        logger.warning("indices_cache refresh_failed symbols=%s error=%s", len(symbols), exc)
    finally:
        _indices_refresh_tasks.discard(cache_key)

@router.get("", response_model=Dict[str, PriceQuote])
async def get_prices(
    symbols: str = Query(..., description="Comma-separated list of symbols (e.g., 'AAPL,MSFT,BTC-USD')"),
    pricing_service = Depends(get_pricing_service)
):
    """
    Get current prices for multiple symbols
    
    - Checks cache first (TTL from config)
    - Fetches from Yahoo Finance if stale/missing
    - Updates cache
    - Falls back to last known price if fetch fails
    
    Example: `/prices?symbols=AAPL,MSFT,NVDA`
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",")]
    
    if not symbol_list:
        raise InvalidPriceRequestError("No symbols provided")
    
    if len(symbol_list) > 50:
        raise InvalidPriceRequestError("Maximum 50 symbols per request")
    
    prices = await pricing_service.get_multiple_prices(symbol_list)
    
    return prices


@router.get("/indices", response_model=Dict[str, PriceQuote])
async def get_market_indices(
    symbols: str = Query(
        default="^GSPC,^DJI,^IXIC,^GSPTSE,^FTSE,^GDAXI,^FCHI,FTSEMIB.MI,^N225,^HSI,000001.SS,^AXJO",
        description="Comma-separated list of market index symbols"
    )
):
    """
    Get current prices for market indices using batch downloading to minimize API calls.
    
    This endpoint uses provider batch download to fetch all indices in a single API call,
    making it much more efficient and less likely to trigger rate limits.
    
    Example: `/prices/indices?symbols=^GSPC,^DJI,^IXIC`
    """
    symbol_list = [s.strip() for s in symbols.split(",")]
    
    if not symbol_list:
        raise InvalidPriceRequestError("No symbols provided")
    
    if len(symbol_list) > 50:
        raise InvalidPriceRequestError("Maximum 50 symbols per request")

    cache_key = ",".join(symbol_list)
    cached_indices = _indices_cache.get(cache_key)
    if cached_indices:
        age = datetime.utcnow() - cached_indices[1]
        if age < _INDICES_CACHE_TTL:
            logger.debug("Market indices cache hit")
            return cached_indices[0]
        if age < _INDICES_STALE_TTL:
            logger.info(
                "indices_cache stale_hit symbols=%s age_seconds=%.1f action=return_stale enqueue_refresh=true",
                len(symbol_list),
                age.total_seconds(),
            )
            asyncio.create_task(_refresh_indices_cache_async(cache_key, symbol_list))
            return cached_indices[0]
    
    # Check circuit breaker
    if is_rate_limited():
        remaining = get_rate_limit_remaining()
        logger.warning(f"Rate limit active for indices fetch, {remaining:.1f}s remaining")
        if cached_indices:
            logger.warning("provider=yahoo action=market_indices fallback=stale_memory_cache")
            return cached_indices[0]
        return {}  # Return empty rather than hitting rate limits more
    
    # Run batch fetch in thread pool
    try:
        prices = await asyncio.wait_for(
            asyncio.to_thread(_batch_fetch_indices, symbol_list),
            timeout=yahoo_timeout_seconds(default=15.0) + 5.0,
        )
    except asyncio.TimeoutError:
        logger.warning("provider=yahoo action=market_indices timeout=true fallback=stale_memory_cache")
        if cached_indices:
            return cached_indices[0]
        return {}

    if prices:
        _indices_cache[cache_key] = (prices, datetime.utcnow())
    elif cached_indices:
        logger.warning("provider=yahoo action=market_indices fallback=stale_memory_cache")
        return cached_indices[0]

    return prices


@router.get("/quote/{symbol}", response_model=PriceQuote)
async def get_price_quote(
    symbol: str,
    target_currency: str = Query(None, description="Convert price to this currency (e.g., 'USD', 'EUR')"),
    pricing_service = Depends(get_pricing_service)
):
    """
    Get current price for a single symbol
    
    - Fetches from Yahoo Finance
    - Returns price quote with current price, currency, and daily change
    - Optionally converts to target currency
    
    Example: `/prices/quote/BTC-USD` or `/prices/quote/ETH-EUR?target_currency=USD`
    """
    from app.services.currency import CurrencyService
    
    symbol = symbol.strip().upper()
    target_currency = target_currency.upper() if target_currency else None
    prices = await pricing_service.get_multiple_prices([symbol])
    
    if symbol not in prices or prices[symbol] is None:
        # Try to fetch directly from the market data provider
        try:
            provider = get_market_data_provider()
            hist = provider.get_history(
                symbol,
                action="quote_history",
                timeout_seconds=yahoo_timeout_seconds(),
                period="2d",
            )
            if not hist.empty:
                current_price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current_price
                daily_change = ((current_price - prev_close) / prev_close * 100) if prev_close else 0
                
                # Get actual currency from ticker info
                try:
                    info = provider.get_info(
                        symbol,
                        action="quote_info",
                        timeout_seconds=yahoo_timeout_seconds(),
                    )
                    source_currency = info.get('currency', 'USD')
                except:
                    source_currency = 'USD'
                
                price = Decimal(str(current_price))
                
                # Convert to target currency if specified
                if target_currency and target_currency != source_currency:
                    converted_price = CurrencyService.convert(price, source_currency, target_currency)
                    if converted_price is not None:
                        price = converted_price
                        source_currency = target_currency
                
                return PriceQuote(
                    symbol=symbol,
                    price=price,
                    currency=source_currency,
                    daily_change_pct=Decimal(str(round(daily_change, 2))),
                    asof=datetime.utcnow()
                )
        except Exception:
            pass
        
        raise InvalidPriceRequestError(f"Could not fetch price for symbol: {symbol}")
    
    price_quote = prices[symbol]
    
    # Convert to target currency if specified
    if target_currency and price_quote.currency != target_currency:
        converted_price = CurrencyService.convert(price_quote.price, price_quote.currency, target_currency)
        if converted_price is not None:
            return PriceQuote(
                symbol=price_quote.symbol,
                price=converted_price,
                currency=target_currency,
                daily_change_pct=price_quote.daily_change_pct,
                asof=price_quote.asof
            )
    
    return price_quote


@router.post("/refresh")
async def refresh_prices(
    portfolio_id: int = Query(..., description="Portfolio ID to refresh prices for"),
    pricing_service = Depends(get_pricing_service)
):
    """
    Force refresh prices for all assets in a portfolio
    
    This will fetch fresh prices from Yahoo Finance regardless of cache TTL.
    Useful for manual refresh or when you need the most up-to-date data.
    """
    # Verify portfolio exists
    portfolio = portfolio_crud.get_portfolio(pricing_service.db, portfolio_id)
    if not portfolio:
        raise PortfolioNotFoundError(portfolio_id)
    
    # Clear cache and refresh
    count = await pricing_service.refresh_all_portfolio_prices(portfolio_id)
    
    return {
        "portfolio_id": portfolio_id,
        "refreshed_count": count,
        "message": f"Refreshed {count} asset prices"
    }
