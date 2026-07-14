"""
Batch endpoint for dashboard data
Intelligently fetches only the data needed for visible widgets
"""
import asyncio
from contextlib import suppress
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.errors import PortfolioNotFoundError
from app.db import SessionLocal, get_db
from app.auth import get_current_verified_user
from app.models import User
from app.crud import portfolios as crud_portfolios
from app.routers import market
from app.dependencies import MetricsServiceDep, InsightsServiceDep
from app.services.platform.cache import CacheService
from app.services.platform.dashboard_cache_keys import build_dashboard_batch_cache_key
from app.services.market_data.yahoo_finance import get_market_data_provider, yahoo_timeout_seconds
from app.redis_client import get_redis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batch", tags=["batch"])

# Dashboard entries live long enough to be useful as stale fallbacks.  Their
# embedded timestamp determines the much shorter fresh window.
_BATCH_FRESH_TTL = 300
_BATCH_STALE_TTL = 3600
_DASHBOARD_LOCK_TTL = 600
_DASHBOARD_LOCK_RENEW_INTERVAL = 60.0
_DASHBOARD_COLD_WAIT_SECONDS = 30.0
_DASHBOARD_FOLLOWER_WAIT_SECONDS = 2.0
_dashboard_refresh_tasks: set[asyncio.Task] = set()


def _make_json_serializable(obj, _seen=None):
    """
    Recursively convert any object to JSON-serializable format.
    Handles SQLAlchemy models, datetime, Decimal, nested dicts/lists, and circular references.
    """
    from datetime import date, datetime
    from decimal import Decimal
    
    # Track seen objects to prevent infinite recursion
    if _seen is None:
        _seen = set()
    
    # Handle None
    if obj is None:
        return None
    
    # Check for circular references using id()
    obj_id = id(obj)
    if obj_id in _seen:
        return None  # Break circular reference
    
    # Primitive types that are already JSON serializable
    if isinstance(obj, (str, int, float, bool)):
        return obj
    
    # Convert datetime/date to ISO format
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    
    # Convert Decimal to float
    if isinstance(obj, Decimal):
        return float(obj)
    
    # Convert bytes to string
    if isinstance(obj, bytes):
        return obj.decode('utf-8')
    
    # Add to seen set for circular reference detection
    _seen.add(obj_id)
    
    try:
        # Handle Pydantic models
        if hasattr(obj, 'model_dump'):
            return obj.model_dump()
        
        # Handle lists/tuples
        if isinstance(obj, (list, tuple)):
            return [_make_json_serializable(item, _seen) for item in obj]
        
        # Handle SQLAlchemy models (have __table__ attribute).
        # Read values via the mapped attribute key, not the column name:
        # for renamed columns like Notification.meta_data = Column("metadata", ...),
        # getattr(obj, column.name) would return Base.metadata (the SQLAlchemy
        # MetaData registry, ~66KB serialized) instead of the column value.
        if hasattr(obj, '__table__'):
            from sqlalchemy import inspect as sa_inspect
            result = {}
            for attr in sa_inspect(obj).mapper.column_attrs:
                value = getattr(obj, attr.key)
                result[attr.columns[0].name] = _make_json_serializable(value, _seen)
            return result
        
        # Handle dictionaries
        if isinstance(obj, dict):
            return {
                k: _make_json_serializable(v, _seen) 
                for k, v in obj.items() 
                if not k.startswith('_')
            }
        
        # Handle objects with __dict__ (but filter SQLAlchemy internal state)
        if hasattr(obj, '__dict__'):
            return {
                k: _make_json_serializable(v, _seen)
                for k, v in obj.__dict__.items()
                if not k.startswith('_')
            }
        
        # For anything else, try to convert to string as last resort
        return str(obj)
        
    finally:
        # Remove from seen set after processing
        _seen.discard(obj_id)


def _serialize_model(obj) -> Dict:
    """Serialize SQLAlchemy model to JSON-safe dict, excluding internal state"""
    return _make_json_serializable(obj)


class DashboardBatchRequest(BaseModel):
    """Request model for batch dashboard data"""
    portfolio_id: int
    visible_widgets: List[str]  # List of widget IDs currently visible
    include_sold: bool = False  # Whether to fetch sold positions


# Widget ID prefixes to data requirement mapping
WIDGET_DATA_MAP = {
    # Core metrics widgets
    'total-value': {'metrics'},
    'daily-gain': {'metrics'},
    'unrealized-pnl': {'metrics'},
    'realized-pnl': {'metrics'},
    'dividends': {'metrics'},
    
    # Position widgets
    'positions': {'positions', 'metrics'},
    'positions-table': {'positions', 'metrics'},
    'sold-positions': {'sold_positions'},
    
    # List widgets
    'watchlist': {'watchlist'},
    'notifications': {'notifications'},
    'recent-transactions': {'transactions'},
    
    # Market indices
    'tnx-index': {'market_tnx'},
    'dxy-index': {'market_dxy'},
    'vix-index': {'market_vix'},
    'market-indices': {'market_indices'},
    
    # Sentiment
    'sentiment-stock': {'sentiment_stock'},
    'sentiment-crypto': {'sentiment_crypto'},
    'market-sentiment': {'sentiment_stock'},
    'crypto-sentiment': {'sentiment_crypto'},
    
    # Analysis widgets
    'concentration-risk': {'positions'},
    'best-worst-today': {'positions'},
    'top-performers': {'positions'},
    'worst-performers': {'positions'},
    'largest-holdings': {'positions'},
    'asset-allocation': {'asset_allocation', 'sector_allocation', 'country_allocation'},
    'theme-allocation': {'theme_allocation'},
    'portfolio-heatmap': {'positions'},
    'performance-metrics': {'performance_history'},
    
    # Risk metrics widgets - EXCLUDED FROM BATCH (too slow, loaded separately)
    # 'volatility': {'risk_metrics'},
    # 'sharpe-ratio': {'risk_metrics'},
    # 'max-drawdown': {'risk_metrics'},
    # 'value-at-risk': {'risk_metrics'},
    # 'beta-correlation': {'risk_metrics'},
    # 'downside-deviation': {'risk_metrics'},
    
    # Benchmark widgets - EXCLUDED FROM BATCH (too slow, loaded separately)
    # 'alpha': {'benchmark_comparison'},
    # 'r-squared': {'benchmark_comparison'},
    
    # Additional insight widgets
    'avg-holding-period': {'transactions'},
    'hit-ratio': {'positions'},
}


def _extract_required_data(visible_widgets: List[str]) -> Set[str]:
    """
    Determine which data sets are needed based on visible widgets
    
    Args:
        visible_widgets: List of widget IDs (e.g., ['total-value', 'watchlist-1', 'tnx-index-2'])
    
    Returns:
        Set of required data types to fetch
    """
    required = set()
    
    # Always fetch core metrics and positions for dashboard
    required.add('metrics')
    required.add('positions')
    
    for widget_id in visible_widgets:
        # Extract base widget ID (remove instance suffix like '-1', '-2')
        base_id = widget_id.rsplit('-', 1)[0] if widget_id[-1].isdigit() and '-' in widget_id else widget_id
        
        # Get requirements for this widget
        if base_id in WIDGET_DATA_MAP:
            required.update(WIDGET_DATA_MAP[base_id])
        else:
            # Try partial match for complex widget IDs
            for key in WIDGET_DATA_MAP:
                if key in base_id or base_id.startswith(key):
                    required.update(WIDGET_DATA_MAP[key])
                    break
    
    return required


async def _fetch_metrics(portfolio_id: int, metrics_service, db: Session) -> Optional[Dict]:
    """Fetch portfolio metrics"""
    try:
        metrics = await metrics_service.get_metrics(portfolio_id)
        # Convert Pydantic model to dict if needed
        if hasattr(metrics, 'model_dump'):
            return metrics.model_dump()
        return dict(metrics)
    except Exception as e:
        logger.error(f"Failed to fetch metrics: {e}", exc_info=True)
        return None


async def _fetch_positions(portfolio_id: int, metrics_service, db: Session) -> Optional[List]:
    """Fetch current positions"""
    try:
        positions = await metrics_service.get_positions(portfolio_id)
        # Convert to list of dicts
        if positions and hasattr(positions[0], 'model_dump'):
            return [pos.model_dump() for pos in positions]
        return positions
    except Exception as e:
        logger.error(f"Failed to fetch positions: {e}", exc_info=True)
        return None


async def _fetch_sold_positions(portfolio_id: int, metrics_service, db: Session) -> Optional[List]:
    """Fetch sold positions"""
    try:
        positions = await metrics_service.get_sold_positions_only(portfolio_id)
        # Convert to list of dicts
        if positions and hasattr(positions[0], 'model_dump'):
            return [pos.model_dump() for pos in positions]
        return positions
    except Exception as e:
        logger.error(f"Failed to fetch sold positions: {e}", exc_info=True)
        return None


async def _fetch_watchlist(user: User, db: Session) -> Optional[List]:
    """Fetch user watchlist with current prices"""
    try:
        from app.crud import watchlist as crud_watchlist
        from app.services.market_data.pricing import PricingService
        
        pricing_service = PricingService(db)
        items = crud_watchlist.get_watchlist_items_by_user(db, user.id)
        
        result = []
        for item in items:
            # Skip items without valid assets
            if not item.asset or not item.asset.symbol:
                logger.warning(f"Skipping watchlist item {item.id} - missing or invalid asset")
                continue
                
            item_dict = _serialize_model(item)
            
            # Get current price and daily change
            current_price = None
            daily_change_pct = None
            try:
                price_data = await pricing_service.get_price(item.asset.symbol)
                if price_data:
                    current_price = float(price_data.price) if price_data.price else 0
                    daily_change_pct = float(price_data.daily_change_pct) if price_data.daily_change_pct else None
            except Exception as e:
                logger.debug(f"Could not fetch price for {item.asset.symbol}: {e}")
            
            # Include asset details with price data
            item_dict['asset'] = {
                'id': item.asset.id,
                'symbol': item.asset.symbol,
                'name': item.asset.name,
                'asset_type': item.asset.asset_type,
                'currency': item.asset.currency
            }
            item_dict['current_price'] = current_price
            item_dict['daily_change_pct'] = daily_change_pct
            
            result.append(item_dict)
        
        return result
    except Exception as e:
        logger.error(f"Failed to fetch watchlist: {e}")
        return None


async def _fetch_notifications(user: User, db: Session) -> Optional[List]:
    """Fetch user notifications"""
    try:
        from app.crud import notifications as crud_notifications
        notifications = crud_notifications.get_user_notifications(db, user.id, limit=10)
        return [_serialize_model(notif) for notif in notifications]
    except Exception as e:
        logger.error(f"Failed to fetch notifications: {e}")
        return None


async def _fetch_market_tnx() -> Optional[Dict]:
    """Fetch TNX index data"""
    try:
        return await market.get_tnx_index()
    except Exception as e:
        logger.error(f"Failed to fetch TNX: {e}")
        return None


async def _fetch_market_dxy() -> Optional[Dict]:
    """Fetch DXY index data"""
    try:
        return await market.get_dxy_index()
    except Exception as e:
        logger.error(f"Failed to fetch DXY: {e}")
        return None


async def _fetch_market_vix() -> Optional[Dict]:
    """Fetch VIX index data"""
    try:
        return await market.get_vix_index()
    except Exception as e:
        logger.error(f"Failed to fetch VIX: {e}")
        return None


async def _fetch_market_indices() -> Optional[Dict]:
    """Fetch all major market indices"""
    try:
        # Define major market indices
        indices = {
            'GSPC': '^GSPC',  # S&P 500
            'DJI': '^DJI',    # Dow Jones
            'IXIC': '^IXIC',  # NASDAQ
            'GSPTSE': '^GSPTSE', # S&P/TSX Composite
            'FTSE': '^FTSE',  # FTSE 100
            'GDAXI': '^GDAXI', # DAX
            'FCHI': '^FCHI',  # CAC 40
            'FTSEMIB.MI': 'FTSEMIB.MI', # FTSE MIB
            'N225': '^N225',  # Nikkei 225
            'HSI': '^HSI',    # Hang Seng
            '000001.SS': '000001.SS', # SSE Composite
            '^AXJO': '^AXJO',  # ASX 200
        }
        provider = get_market_data_provider()
        
        def fetch_index(symbol: str):
            try:
                info = provider.get_info(
                    symbol,
                    action="dashboard_market_index_info",
                    timeout_seconds=yahoo_timeout_seconds(),
                )
                
                current_price = info.get("regularMarketPrice") or info.get("currentPrice")
                previous_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
                
                if current_price is None:
                    return None
                
                change = None
                change_pct = None
                
                if previous_close and previous_close > 0:
                    change = current_price - previous_close
                    change_pct = (change / previous_close) * 100
                
                return {
                    "symbol": symbol,
                    "price": round(current_price, 2),
                    "current_price": round(current_price, 2),
                    "change": round(change, 2) if change is not None else None,
                    "change_pct": round(change_pct, 2) if change_pct is not None else None,
                    "percent_change": round(change_pct, 2) if change_pct is not None else None,
                    "daily_change_pct": round(change_pct, 2) if change_pct is not None else None,
                    "previous_close": round(previous_close, 2) if previous_close else None,
                }
            except Exception as e:
                logger.warning(f"Failed to fetch {symbol}: {e}")
                return None
        
        # Fetch all indices concurrently in worker threads to avoid blocking the event loop.
        tasks = [asyncio.to_thread(fetch_index, symbol) for symbol in indices.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dict with non-None values, keyed by symbol (with caret)
        result = {}
        for (key, symbol), data in zip(indices.items(), results):
            if data and not isinstance(data, Exception):
                result[symbol] = data  # Use symbol (e.g., "^GSPC") as key, not short name
        
        logger.info(f"Fetched market indices: {list(result.keys())}")
        return result if result else None
        
    except Exception as e:
        logger.error(f"Failed to fetch market indices: {e}")
        return None


async def _fetch_sentiment_stock() -> Optional[Dict]:
    """Fetch stock market sentiment"""
    try:
        return await market.get_stock_market_sentiment()
    except Exception as e:
        logger.error(f"Failed to fetch stock sentiment: {e}")
        return None


async def _fetch_sentiment_crypto() -> Optional[Dict]:
    """Fetch crypto market sentiment"""
    try:
        return await market.get_crypto_market_sentiment()
    except Exception as e:
        logger.error(f"Failed to fetch crypto sentiment: {e}")
        return None


async def _fetch_asset_allocation(portfolio_id: int, db: Session, metrics_service, current_user) -> Optional[Dict]:
    """Fetch asset type distribution"""
    try:
        from app.routers import assets as assets_router
        return await assets_router.get_types_distribution(
            metrics_service=metrics_service,
            portfolio_id=portfolio_id,
            current_user=current_user,
            db=db
        )
    except Exception as e:
        logger.error(f"Failed to fetch asset allocation: {e}", exc_info=True)
        return None


async def _fetch_sector_allocation(portfolio_id: int, db: Session, metrics_service, current_user) -> Optional[Dict]:
    """Fetch sector distribution"""
    try:
        from app.routers import assets as assets_router
        return await assets_router.get_sectors_distribution(
            metrics_service=metrics_service,
            portfolio_id=portfolio_id,
            current_user=current_user,
            db=db
        )
    except Exception as e:
        logger.error(f"Failed to fetch sector allocation: {e}", exc_info=True)
        return None


async def _fetch_country_allocation(portfolio_id: int, db: Session, metrics_service, current_user) -> Optional[Dict]:
    """Fetch country distribution"""
    try:
        from app.routers import assets as assets_router
        return await assets_router.get_countries_distribution(
            metrics_service=metrics_service,
            portfolio_id=portfolio_id,
            current_user=current_user,
            db=db
        )
    except Exception as e:
        logger.error(f"Failed to fetch country allocation: {e}", exc_info=True)
        return None


async def _fetch_theme_allocation(portfolio_id: int, db: Session, metrics_service, current_user) -> Optional[Dict]:
    """Fetch theme distribution"""
    try:
        from app.routers import assets as assets_router
        return await assets_router.get_themes_distribution(
            metrics_service=metrics_service,
            portfolio_id=portfolio_id,
            current_user=current_user,
            db=db,
        )
    except Exception as e:
        logger.error(f"Failed to fetch theme allocation: {e}", exc_info=True)
        return None


async def _fetch_performance_history(portfolio_id: int, db: Session) -> Optional[Dict]:
    """Calculate one canonical series and derive every dashboard period."""
    del db  # History is isolated because SQLAlchemy sessions are not thread-safe.
    try:
        from app.services.portfolio_analytics.metrics import MetricsService

        def calculate_canonical_history():
            history_db = SessionLocal()
            try:
                return MetricsService(history_db).get_portfolio_history(portfolio_id, "ALL")
            finally:
                history_db.close()

        # This method is synchronous and database-heavy.  Offloading it keeps the
        # Uvicorn event loop available for lightweight endpoints during refresh.
        canonical = await asyncio.to_thread(calculate_canonical_history)
        results = _derive_performance_history_periods(canonical)
        logger.info(
            "dashboard_history canonical_points=%s derived_periods=%s",
            len(canonical),
            {period: len(points) for period, points in results.items()},
            extra={"event": "dashboard_history_derived"},
        )
        return results
    except Exception as e:
        logger.error(f"Failed to fetch performance history: {e}", exc_info=True)
        return None


def _derive_performance_history_periods(
    canonical: List[Any], today=None
) -> Dict[str, List[Any]]:
    """Derive dashboard periods from the exact canonical ALL calculation."""
    today = today or datetime.utcnow().date()
    starts = {
        "1W": today - timedelta(days=7),
        "1M": today - timedelta(days=30),
        "3M": today - timedelta(days=90),
        "YTD": today.replace(month=1, day=1),
        "1Y": today - timedelta(days=365),
    }

    def point_date(point: Any):
        value = point.get("date") if isinstance(point, dict) else point.date
        return datetime.fromisoformat(value).date()

    # ``ALL`` alone prepends a synthetic zero point. It must remain in the
    # ALL chart but must not leak into a short period for a new portfolio.
    slice_source = canonical[1:] if canonical else canonical
    results = {
        period: [point for point in slice_source if point_date(point) >= start]
        for period, start in starts.items()
    }
    results["ALL"] = canonical
    return results


async def _fetch_risk_metrics(portfolio_id: int, insights_service, db: Session, period: str = '1y') -> Optional[Dict]:
    """Fetch risk metrics"""
    try:
        metrics = await insights_service.get_risk_metrics(portfolio_id, period)
        # Convert Pydantic model to dict if needed
        if hasattr(metrics, 'model_dump'):
            return metrics.model_dump()
        return dict(metrics)
    except Exception as e:
        logger.error(f"Failed to fetch risk metrics: {e}", exc_info=True)
        return None


async def _fetch_benchmark_comparison(portfolio_id: int, insights_service, db: Session, benchmark: str = 'SPY', period: str = '1y') -> Optional[Dict]:
    """Fetch benchmark comparison"""
    try:
        comparison = await insights_service.compare_to_benchmark(portfolio_id, benchmark, period)
        # Convert Pydantic model to dict if needed
        if hasattr(comparison, 'model_dump'):
            return comparison.model_dump()
        return dict(comparison)
    except Exception as e:
        logger.error(f"Failed to fetch benchmark comparison: {e}", exc_info=True)
        return None


async def _fetch_transactions(portfolio_id: int, db: Session) -> Optional[List]:
    """Fetch recent transactions with asset details"""
    try:
        from app.crud import transactions as crud_transactions
        transactions = crud_transactions.get_transactions(db, portfolio_id=portfolio_id, limit=10)
        
        # Serialize each transaction with asset details
        result = []
        for txn in transactions:
            txn_dict = _serialize_model(txn)
            
            # Include asset details if available
            if txn.asset:
                txn_dict['asset'] = {
                    'id': txn.asset.id,
                    'symbol': txn.asset.symbol,
                    'name': txn.asset.name,
                    'asset_type': txn.asset.asset_type,
                    'currency': txn.asset.currency
                }
            
            result.append(txn_dict)
        
        return result
    except Exception as e:
        logger.error(f"Failed to fetch transactions: {e}", exc_info=True)
        return None


def _dashboard_lock_key(cache_key: str) -> str:
    return f"dashboard_refresh_lock:{cache_key}"


def _acquire_dashboard_lock(cache_key: str) -> Optional[str]:
    """Acquire a cross-process lock and return its ownership token."""
    redis_client = get_redis()
    if redis_client is None:
        return None
    token = uuid.uuid4().hex
    try:
        acquired = redis_client.set(
            _dashboard_lock_key(cache_key), token, nx=True, ex=_DASHBOARD_LOCK_TTL
        )
        if acquired:
            logger.info(
                "dashboard_lock acquired ttl_seconds=%s renew_interval_seconds=%s",
                _DASHBOARD_LOCK_TTL,
                _DASHBOARD_LOCK_RENEW_INTERVAL,
                extra={
                    "event": "dashboard_lock_acquired",
                    "lock_ttl_seconds": _DASHBOARD_LOCK_TTL,
                    "renew_interval_seconds": _DASHBOARD_LOCK_RENEW_INTERVAL,
                },
            )
        return token if acquired else None
    except RedisError:
        logger.warning("dashboard_lock acquire_failed", extra={"event": "dashboard_lock_failed"})
        return None


def _release_dashboard_lock(cache_key: str, token: str) -> None:
    """Delete a lock only if it is still owned by this refresh."""
    redis_client = get_redis()
    if redis_client is None:
        return
    script = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    end
    return 0
    """
    try:
        redis_client.eval(script, 1, _dashboard_lock_key(cache_key), token)
    except RedisError:
        # The TTL is the final safety net if Redis disappears during refresh.
        logger.warning("dashboard_lock release_failed", extra={"event": "dashboard_lock_failed"})


def _renew_dashboard_lock(cache_key: str, token: str) -> Optional[bool]:
    """Extend the lease only while this refresh still owns the token."""
    redis_client = get_redis()
    if redis_client is None:
        return None
    script = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('expire', KEYS[1], ARGV[2])
    end
    return 0
    """
    try:
        return bool(redis_client.eval(
            script, 1, _dashboard_lock_key(cache_key), token, _DASHBOARD_LOCK_TTL
        ))
    except RedisError:
        logger.warning("dashboard_lock renew_failed", extra={"event": "dashboard_lock_failed"})
        return None


def _owns_dashboard_lock(cache_key: str, token: str) -> bool:
    redis_client = get_redis()
    if redis_client is None:
        return False
    try:
        return redis_client.get(_dashboard_lock_key(cache_key)) == token
    except RedisError:
        return False


async def _maintain_dashboard_lock(cache_key: str, token: str) -> None:
    """Renew a legitimate long refresh well before its Redis lease expires."""
    while True:
        await asyncio.sleep(_DASHBOARD_LOCK_RENEW_INTERVAL)
        renewed = _renew_dashboard_lock(cache_key, token)
        if renewed is False:
            logger.warning(
                "dashboard_lock ownership_lost key=%s", cache_key,
                extra={"event": "dashboard_lock_ownership_lost"},
            )
            return


def _cache_age_seconds(cached_data: Dict[str, Any]) -> float:
    try:
        cached_at = datetime.fromisoformat(cached_data["timestamp"])
        return max(0.0, (datetime.now(cached_at.tzinfo) - cached_at).total_seconds())
    except (KeyError, TypeError, ValueError):
        return float("inf")


def _spawn_refresh(coro) -> asyncio.Task:
    """Keep an uncancelled refresh alive after its initiating request ends."""
    task = asyncio.create_task(coro)
    _dashboard_refresh_tasks.add(task)
    task.add_done_callback(_dashboard_refresh_tasks.discard)
    return task


async def _timed_dashboard_fetch(
    section: str, awaitable, timings: Dict[str, float]
) -> Any:
    started = time.monotonic()
    try:
        return await awaitable
    finally:
        timings[section] = timings.get(section, 0.0) + (time.monotonic() - started) * 1000


async def _compute_dashboard_response(
    portfolio_id: int,
    visible_widgets: List[str],
    include_sold: bool,
    user: User,
    db: Session,
) -> Dict[str, Any]:
    """Compute a complete dashboard response without reading or writing cache."""
    from app.services.portfolio_analytics.insights import InsightsService
    from app.services.portfolio_analytics.metrics import MetricsService

    started = time.monotonic()
    required_data = _extract_required_data(visible_widgets)
    metrics_service = MetricsService(db)
    insights_service = InsightsService(db)
    timings: Dict[str, float] = {}
    tasks: Dict[str, Any] = {}

    def add(key: str, awaitable, timing_section: Optional[str] = None) -> None:
        tasks[key] = _timed_dashboard_fetch(timing_section or key, awaitable, timings)

    if "metrics" in required_data:
        add("metrics", _fetch_metrics(portfolio_id, metrics_service, db))
    if "positions" in required_data:
        add("positions", _fetch_positions(portfolio_id, metrics_service, db))
    if "sold_positions" in required_data or include_sold:
        add("sold_positions", _fetch_sold_positions(portfolio_id, metrics_service, db), "positions")
    if "watchlist" in required_data:
        add("watchlist", _fetch_watchlist(user, db))
    if "notifications" in required_data:
        add("notifications", _fetch_notifications(user, db))
    if "market_tnx" in required_data:
        add("market_tnx", _fetch_market_tnx())
    if "market_dxy" in required_data:
        add("market_dxy", _fetch_market_dxy())
    if "market_vix" in required_data:
        add("market_vix", _fetch_market_vix())
    if "market_indices" in required_data:
        add("market_indices", _fetch_market_indices())
    if "sentiment_stock" in required_data:
        add("sentiment_stock", _fetch_sentiment_stock())
    if "sentiment_crypto" in required_data:
        add("sentiment_crypto", _fetch_sentiment_crypto())
    if "asset_allocation" in required_data:
        add("asset_allocation", _fetch_asset_allocation(portfolio_id, db, metrics_service, user), "allocations")
    if "sector_allocation" in required_data:
        add("sector_allocation", _fetch_sector_allocation(portfolio_id, db, metrics_service, user), "allocations")
    if "country_allocation" in required_data:
        add("country_allocation", _fetch_country_allocation(portfolio_id, db, metrics_service, user), "allocations")
    if "theme_allocation" in required_data:
        add("theme_allocation", _fetch_theme_allocation(portfolio_id, db, metrics_service, user), "allocations")
    if "performance_history" in required_data:
        add("performance_history", _fetch_performance_history(portfolio_id, db))
    if "risk_metrics" in required_data:
        add("risk_metrics", _fetch_risk_metrics(portfolio_id, insights_service, db))
    if "benchmark_comparison" in required_data:
        add("benchmark_comparison", _fetch_benchmark_comparison(portfolio_id, insights_service, db))
    if "transactions" in required_data:
        add("transactions", _fetch_transactions(portfolio_id, db))

    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    data: Dict[str, Any] = {}
    errors: Dict[str, str] = {}
    for key, result in zip(tasks, results):
        if isinstance(result, Exception):
            logger.error("dashboard section_failed section=%s error=%s", key, result)
            errors[key] = str(result)
        elif result is not None:
            data[key] = result
        else:
            errors[key] = "No data returned"

    total_ms = (time.monotonic() - started) * 1000
    for section in ("metrics", "positions", "allocations", "transactions", "performance_history"):
        duration_ms = timings.get(section, 0.0)
        logger.info(
            "dashboard_timing section=%s duration_ms=%.1f portfolio_id=%s",
            section,
            duration_ms,
            portfolio_id,
            extra={
                "event": "dashboard_section_timing",
                "section": section,
                "duration_ms": round(duration_ms, 1),
                "portfolio_id": portfolio_id,
            },
        )
    logger.info(
        "dashboard_timing section=total duration_ms=%.1f portfolio_id=%s",
        total_ms,
        portfolio_id,
        extra={
            "event": "dashboard_request_timing",
            "section": "total",
            "duration_ms": round(total_ms, 1),
            "portfolio_id": portfolio_id,
        },
    )
    return _make_json_serializable({
        "data": data,
        "errors": errors or None,
        "cached": False,
        "timestamp": datetime.now().isoformat(),
        "widgets_requested": len(visible_widgets),
        "data_fetched": len(data),
    })


async def _refresh_dashboard_cache(
    cache_key: str,
    lock_token: str,
    portfolio_id: int,
    visible_widgets: List[str],
    include_sold: bool,
    user_id: int,
) -> Optional[Dict[str, Any]]:
    """Refresh with a private session so request cancellation cannot abort it."""
    db = SessionLocal()
    lease_task = asyncio.create_task(_maintain_dashboard_lock(cache_key, lock_token))
    try:
        user = db.query(User).filter(User.id == user_id).first()
        portfolio = crud_portfolios.get_portfolio(db, portfolio_id)
        if user is None or portfolio is None or portfolio.user_id != user_id:
            return None
        result = await _compute_dashboard_response(
            portfolio_id, visible_widgets, include_sold, user, db
        )
        # Partial/error responses must never displace a known-good stale value.
        if not result.get("errors") and _owns_dashboard_lock(cache_key, lock_token):
            CacheService.set(cache_key, result, ttl=_BATCH_STALE_TTL)
        return result
    except Exception:
        logger.exception(
            "dashboard_refresh failed portfolio_id=%s", portfolio_id,
            extra={"event": "dashboard_refresh_failed"},
        )
        return None
    finally:
        lease_task.cancel()
        with suppress(asyncio.CancelledError):
            await lease_task
        db.close()
        _release_dashboard_lock(cache_key, lock_token)


async def _wait_for_dashboard_cache(cache_key: str, timeout: float) -> Optional[Dict[str, Any]]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        cached = CacheService.get(cache_key)
        if cached:
            return cached
        await asyncio.sleep(0.1)
    return None


def _refreshing_response(request: DashboardBatchRequest) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        headers={"Retry-After": "5"},
        content={
            "data": {},
            "errors": None,
            "cached": False,
            "refreshing": True,
            "lock_ttl_seconds": _DASHBOARD_LOCK_TTL,
            "timestamp": datetime.now().isoformat(),
            "widgets_requested": len(request.visible_widgets),
            "data_fetched": 0,
        },
    )


@router.post("/dashboard")
async def get_dashboard_batch(
    request: DashboardBatchRequest,
    metrics_service: MetricsServiceDep,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """Serve fresh/stale dashboard data and single-flight cold refreshes."""
    del metrics_service, insights_service  # refreshes use an independent session
    request_started = time.monotonic()
    portfolio = crud_portfolios.get_portfolio(db, request.portfolio_id)
    if not portfolio:
        raise PortfolioNotFoundError(request.portfolio_id)
    if portfolio.user_id != current_user.id:
        from app.errors import UnauthorizedPortfolioAccessError
        raise UnauthorizedPortfolioAccessError(request.portfolio_id)

    cache_key = build_dashboard_batch_cache_key(
        request.portfolio_id, request.visible_widgets, request.include_sold
    )
    cached_data = CacheService.get(cache_key)
    # Older deployments may have written partial payloads. Do not serve or
    # extend them as stale fallbacks.
    if cached_data and cached_data.get("errors"):
        cached_data = None
    cache_age = _cache_age_seconds(cached_data) if cached_data else None

    if cached_data and cache_age is not None and cache_age <= _BATCH_FRESH_TTL:
        result = {**cached_data, "cached": True, "cache_age_seconds": cache_age}
        duration_ms = (time.monotonic() - request_started) * 1000
        logger.info(
            "dashboard_timing section=total duration_ms=%.1f cache_state=fresh",
            duration_ms,
            extra={
                "event": "dashboard_request_timing",
                "section": "total",
                "duration_ms": round(duration_ms, 1),
                "portfolio_id": request.portfolio_id,
                "cache_state": "fresh",
            },
        )
        return result

    lock_token = _acquire_dashboard_lock(cache_key)
    refresh_task: Optional[asyncio.Task] = None
    if lock_token:
        refresh_task = _spawn_refresh(_refresh_dashboard_cache(
            cache_key,
            lock_token,
            request.portfolio_id,
            list(request.visible_widgets),
            request.include_sold,
            current_user.id,
        ))

    if cached_data:
        duration_ms = (time.monotonic() - request_started) * 1000
        logger.info(
            "dashboard_timing section=total duration_ms=%.1f cache_state=stale refresh_started=%s",
            duration_ms,
            bool(refresh_task),
            extra={
                "event": "dashboard_request_timing",
                "section": "total",
                "duration_ms": round(duration_ms, 1),
                "portfolio_id": request.portfolio_id,
                "cache_state": "stale",
            },
        )
        return {
            **cached_data,
            "cached": True,
            "stale": True,
            "refreshing": True,
            "lock_ttl_seconds": _DASHBOARD_LOCK_TTL,
            "cache_age_seconds": cache_age,
        }

    if refresh_task:
        try:
            computed = await asyncio.wait_for(
                asyncio.shield(refresh_task), timeout=_DASHBOARD_COLD_WAIT_SECONDS
            )
            if computed is not None:
                return computed
        except asyncio.TimeoutError:
            pass
    else:
        cached_data = await _wait_for_dashboard_cache(
            cache_key, _DASHBOARD_FOLLOWER_WAIT_SECONDS
        )
        if cached_data:
            return {**cached_data, "cached": True, "cache_age_seconds": _cache_age_seconds(cached_data)}

    return _refreshing_response(request)


@router.delete("/dashboard/cache")
async def clear_dashboard_cache(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_verified_user)
):
    """Clear every dashboard digest/variant owned by one portfolio."""
    portfolio = crud_portfolios.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise PortfolioNotFoundError(portfolio_id)
    if portfolio.user_id != current_user.id:
        from app.errors import UnauthorizedPortfolioAccessError
        raise UnauthorizedPortfolioAccessError(portfolio_id)

    deleted = CacheService.delete_pattern(f"dashboard_batch:{portfolio_id}:*")
    deleted += CacheService.delete_pattern(
        f"dashboard_refresh_lock:dashboard_batch:{portfolio_id}:*"
    )
    return {
        "message": "Dashboard cache cleared",
        "portfolio_id": portfolio_id,
        "deleted": deleted,
        "timestamp": datetime.now().isoformat(),
    }
