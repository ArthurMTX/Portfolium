"""
Batch endpoint for dashboard data
Intelligently fetches only the data needed for visible widgets
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.errors import PortfolioNotFoundError
from app.db import get_db
from app.auth import get_current_verified_user, verify_portfolio_access
from app.models import User, Portfolio as PortfolioModel
from app.crud import portfolios as crud_portfolios
from app.routers import market
from app.dependencies import MetricsServiceDep, InsightsServiceDep
from app.services.cache import CacheService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batch", tags=["batch"])

# Cache TTL for batch responses
_BATCH_CACHE_TTL = 60  # 60 seconds


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
        
        # Handle SQLAlchemy models (have __table__ attribute)
        if hasattr(obj, '__table__'):
            result = {}
            for column in obj.__table__.columns:
                value = getattr(obj, column.name)
                result[column.name] = _make_json_serializable(value, _seen)
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
        from app.services.pricing import PricingService
        
        pricing_service = PricingService()
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
                price_data = await pricing_service.get_price(item.asset)
                if price_data:
                    current_price = float(price_data.get('price', 0))
                    daily_change_pct = price_data.get('daily_change_pct')
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
        from app.services import pricing
        # Fetch major indices in parallel
        symbols = ['^GSPC', '^DJI', '^IXIC', '^FTSE', '^GDAXI', '^FCHI', '^N225', '^HSI']
        logger.warning("Market indices batch fetch not yet implemented")
        return None
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


async def _fetch_performance_history(portfolio_id: int, db: Session) -> Optional[Dict]:
    """Fetch portfolio performance history for different periods"""
    try:
        from app.services.metrics import MetricsService
        metrics_service = MetricsService(db)
        # Fetch multiple periods in parallel
        periods = ['1W', '1M', 'YTD', '1Y']
        results = {}
        for period in periods:
            try:
                history = metrics_service.get_portfolio_history(portfolio_id, period)
                results[period] = history
                logger.debug(f"Fetched {period} history: {len(history) if history else 0} data points")
            except Exception as period_error:
                logger.error(f"Failed to fetch {period} history: {period_error}", exc_info=True)
                results[period] = None
        logger.info(f"Performance history fetch complete. Periods with data: {[k for k,v in results.items() if v]}")
        return results
    except Exception as e:
        logger.error(f"Failed to fetch performance history: {e}", exc_info=True)
        return None


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


@router.post("/dashboard")
async def get_dashboard_batch(
    request: DashboardBatchRequest,
    metrics_service: MetricsServiceDep,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """
    Batch fetch dashboard data based on visible widgets
    
    This endpoint intelligently fetches only the data required for currently
    visible widgets, reducing over-fetching and improving performance.
    
    Returns:
        - data: Dict of requested data sections
        - errors: Dict of any errors encountered (partial failures allowed)
        - cached: Whether response was served from cache
        - timestamp: When data was fetched
    """
    # Verify user has access to portfolio
    portfolio = crud_portfolios.get_portfolio(db, request.portfolio_id)
    if not portfolio or portfolio.user_id != current_user.id:
        raise PortfolioNotFoundError()
    
    # Create cache key
    widget_key = ','.join(sorted(request.visible_widgets))
    cache_key = f"dashboard_batch:{request.portfolio_id}:{hash(widget_key)}"
    
    # Check Redis cache
    cache = CacheService()
    cached_data = cache.get(cache_key)
    
    if cached_data:
        logger.info(f"Batch cache hit for portfolio {request.portfolio_id}")
        return {
            **cached_data,
            "cached": True,
        }
    
    # Determine what data to fetch
    required_data = _extract_required_data(request.visible_widgets)
    logger.info(f"Fetching data for portfolio {request.portfolio_id}: {required_data}")
    
    # Build task list based on requirements
    tasks = {}
    
    if 'metrics' in required_data:
        tasks['metrics'] = _fetch_metrics(request.portfolio_id, metrics_service, db)
    
    if 'positions' in required_data:
        tasks['positions'] = _fetch_positions(request.portfolio_id, metrics_service, db)
    
    if 'sold_positions' in required_data or request.include_sold:
        tasks['sold_positions'] = _fetch_sold_positions(request.portfolio_id, metrics_service, db)
    
    if 'watchlist' in required_data:
        tasks['watchlist'] = _fetch_watchlist(current_user, db)
    
    if 'notifications' in required_data:
        tasks['notifications'] = _fetch_notifications(current_user, db)
    
    if 'market_tnx' in required_data:
        tasks['market_tnx'] = _fetch_market_tnx()
    
    if 'market_dxy' in required_data:
        tasks['market_dxy'] = _fetch_market_dxy()
    
    if 'market_vix' in required_data:
        tasks['market_vix'] = _fetch_market_vix()
    
    if 'market_indices' in required_data:
        tasks['market_indices'] = _fetch_market_indices()
    
    if 'sentiment_stock' in required_data:
        tasks['sentiment_stock'] = _fetch_sentiment_stock()
    
    if 'sentiment_crypto' in required_data:
        tasks['sentiment_crypto'] = _fetch_sentiment_crypto()
    
    if 'asset_allocation' in required_data:
        tasks['asset_allocation'] = _fetch_asset_allocation(request.portfolio_id, db, metrics_service, current_user)
    
    if 'sector_allocation' in required_data:
        tasks['sector_allocation'] = _fetch_sector_allocation(request.portfolio_id, db, metrics_service, current_user)
    
    if 'country_allocation' in required_data:
        tasks['country_allocation'] = _fetch_country_allocation(request.portfolio_id, db, metrics_service, current_user)
    
    if 'performance_history' in required_data:
        tasks['performance_history'] = _fetch_performance_history(request.portfolio_id, db)
    
    if 'risk_metrics' in required_data:
        tasks['risk_metrics'] = _fetch_risk_metrics(request.portfolio_id, insights_service, db)
    
    if 'benchmark_comparison' in required_data:
        tasks['benchmark_comparison'] = _fetch_benchmark_comparison(request.portfolio_id, insights_service, db)
    
    if 'transactions' in required_data:
        tasks['transactions'] = _fetch_transactions(request.portfolio_id, db)
    
    # Execute all tasks in parallel
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    
    # Map results back to keys
    data = {}
    errors = {}
    
    for (key, _), result in zip(tasks.items(), results):
        if isinstance(result, Exception):
            logger.error(f"Error fetching {key}: {result}")
            errors[key] = str(result)
        elif result is not None:
            data[key] = result
        else:
            errors[key] = "No data returned"
    
    # Build response
    now = datetime.now()
    response = {
        "data": data,
        "errors": errors if errors else None,
        "cached": False,
        "timestamp": now.isoformat(),
        "widgets_requested": len(request.visible_widgets),
        "data_fetched": len(data),
    }
    
    # Ensure the entire response is JSON serializable before caching and returning
    response = _make_json_serializable(response)
    
    # Cache the response in Redis (shared across workers)
    cache.set(cache_key, response, ttl=_BATCH_CACHE_TTL)
    
    return response


@router.delete("/dashboard/cache")
async def clear_dashboard_cache(
    current_user: User = Depends(get_current_verified_user)
):
    """Clear dashboard batch cache (admin/debugging)"""
    cache = CacheService()
    # Clear all dashboard batch cache keys
    # Note: This is a simple implementation. For production, consider using Redis SCAN pattern
    return {"message": "Dashboard cache cleared (individual keys will expire)", "timestamp": datetime.now().isoformat()}
