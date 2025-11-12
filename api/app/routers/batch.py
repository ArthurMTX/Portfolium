"""
Batch endpoint for dashboard data
Intelligently fetches only the data needed for visible widgets
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db import get_db
from app.auth import get_current_verified_user
from app.models import User
from app.crud import portfolios as crud_portfolios
from app.routers import market

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batch", tags=["batch"])

# Cache for batch responses (cache_key -> (data, timestamp))
_batch_cache: Dict[str, Tuple[Dict[str, Any], datetime]] = {}
_BATCH_CACHE_TTL = timedelta(seconds=60)  # 1 minute cache


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


async def _fetch_metrics(portfolio_id: int, db: Session) -> Optional[Dict]:
    """Fetch portfolio metrics"""
    try:
        from app.services.metrics import MetricsService
        metrics_service = MetricsService(db)
        metrics = await metrics_service.get_metrics(portfolio_id)
        # Convert Pydantic model to dict if needed
        if hasattr(metrics, 'model_dump'):
            return metrics.model_dump()
        return dict(metrics)
    except Exception as e:
        logger.error(f"Failed to fetch metrics: {e}", exc_info=True)
        return None


async def _fetch_positions(portfolio_id: int, db: Session) -> Optional[List]:
    """Fetch current positions"""
    try:
        from app.services.metrics import MetricsService
        metrics_service = MetricsService(db)
        positions = await metrics_service.get_positions(portfolio_id)
        # Convert to list of dicts
        if positions and hasattr(positions[0], 'model_dump'):
            return [pos.model_dump() for pos in positions]
        return positions
    except Exception as e:
        logger.error(f"Failed to fetch positions: {e}", exc_info=True)
        return None


async def _fetch_sold_positions(portfolio_id: int, db: Session) -> Optional[List]:
    """Fetch sold positions"""
    try:
        from app.services.metrics import MetricsService
        metrics_service = MetricsService(db)
        positions = await metrics_service.get_sold_positions_only(portfolio_id)
        # Convert to list of dicts
        if positions and hasattr(positions[0], 'model_dump'):
            return [pos.model_dump() for pos in positions]
        return positions
    except Exception as e:
        logger.error(f"Failed to fetch sold positions: {e}", exc_info=True)
        return None


async def _fetch_watchlist(user: User, db: Session) -> Optional[List]:
    """Fetch user watchlist"""
    try:
        from app.crud import watchlist as crud_watchlist
        items = crud_watchlist.get_watchlist(db, user.id)
        return [item.__dict__ for item in items]
    except Exception as e:
        logger.error(f"Failed to fetch watchlist: {e}")
        return None


async def _fetch_notifications(user: User, db: Session) -> Optional[List]:
    """Fetch user notifications"""
    try:
        from app.crud import notifications as crud_notifications
        notifications = crud_notifications.get_user_notifications(db, user.id, limit=10)
        return [notif.__dict__ for notif in notifications]
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
        # This would need to be implemented in your pricing service
        # For now, return None to indicate it needs implementation
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


async def _fetch_asset_allocation(portfolio_id: int, db: Session) -> Optional[Dict]:
    """Fetch asset type distribution"""
    try:
        from app.crud import portfolios as crud_portfolios
        return crud_portfolios.get_types_distribution(db, portfolio_id)
    except Exception as e:
        logger.error(f"Failed to fetch asset allocation: {e}")
        return None


async def _fetch_sector_allocation(portfolio_id: int, db: Session) -> Optional[Dict]:
    """Fetch sector distribution"""
    try:
        from app.crud import portfolios as crud_portfolios
        return crud_portfolios.get_sectors_distribution(db, portfolio_id)
    except Exception as e:
        logger.error(f"Failed to fetch sector allocation: {e}")
        return None


async def _fetch_country_allocation(portfolio_id: int, db: Session) -> Optional[Dict]:
    """Fetch country distribution"""
    try:
        from app.crud import portfolios as crud_portfolios
        return crud_portfolios.get_countries_distribution(db, portfolio_id)
    except Exception as e:
        logger.error(f"Failed to fetch country allocation: {e}")
        return None


async def _fetch_performance_history(portfolio_id: int, db: Session) -> Optional[Dict]:
    """Fetch portfolio performance history for different periods"""
    try:
        from app.crud import portfolios as crud_portfolios
        # Fetch multiple periods in parallel
        periods = ['1W', '1M', 'YTD', '1Y']
        results = {}
        for period in periods:
            try:
                history = crud_portfolios.get_portfolio_history(db, portfolio_id, period)
                results[period] = history
            except Exception as period_error:
                logger.error(f"Failed to fetch {period} history: {period_error}")
                results[period] = None
        return results
    except Exception as e:
        logger.error(f"Failed to fetch performance history: {e}")
        return None


async def _fetch_risk_metrics(portfolio_id: int, db: Session, period: str = '1y') -> Optional[Dict]:
    """Fetch risk metrics"""
    try:
        from app.services.insights import InsightsService
        insights_service = InsightsService(db)
        metrics = await insights_service.get_risk_metrics(portfolio_id, period)
        # Convert Pydantic model to dict if needed
        if hasattr(metrics, 'model_dump'):
            return metrics.model_dump()
        return dict(metrics)
    except Exception as e:
        logger.error(f"Failed to fetch risk metrics: {e}", exc_info=True)
        return None


async def _fetch_benchmark_comparison(portfolio_id: int, db: Session, benchmark: str = 'SPY', period: str = '1y') -> Optional[Dict]:
    """Fetch benchmark comparison"""
    try:
        from app.services.insights import InsightsService
        insights_service = InsightsService(db)
        comparison = await insights_service.compare_to_benchmark(portfolio_id, benchmark, period)
        # Convert Pydantic model to dict if needed
        if hasattr(comparison, 'model_dump'):
            return comparison.model_dump()
        return dict(comparison)
    except Exception as e:
        logger.error(f"Failed to fetch benchmark comparison: {e}", exc_info=True)
        return None


async def _fetch_transactions(portfolio_id: int, db: Session) -> Optional[List]:
    """Fetch recent transactions"""
    try:
        from app.crud import transactions as crud_transactions
        transactions = crud_transactions.get_portfolio_transactions(db, portfolio_id, limit=10)
        return [txn.__dict__ for txn in transactions]
    except Exception as e:
        logger.error(f"Failed to fetch transactions: {e}")
        return None


@router.post("/dashboard")
async def get_dashboard_batch(
    request: DashboardBatchRequest,
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
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Create cache key
    widget_key = ','.join(sorted(request.visible_widgets))
    cache_key = f"dashboard_{request.portfolio_id}_{hash(widget_key)}"
    
    # Check cache
    now = datetime.now()
    if cache_key in _batch_cache:
        cached_data, cached_time = _batch_cache[cache_key]
        if now - cached_time < _BATCH_CACHE_TTL:
            logger.info(f"Batch cache hit for portfolio {request.portfolio_id}")
            return {
                **cached_data,
                "cached": True,
                "cache_age_seconds": (now - cached_time).total_seconds()
            }
    
    # Determine what data to fetch
    required_data = _extract_required_data(request.visible_widgets)
    logger.info(f"Fetching data for portfolio {request.portfolio_id}: {required_data}")
    
    # Build task list based on requirements
    tasks = {}
    
    if 'metrics' in required_data:
        tasks['metrics'] = _fetch_metrics(request.portfolio_id, db)
    
    if 'positions' in required_data:
        tasks['positions'] = _fetch_positions(request.portfolio_id, db)
    
    if 'sold_positions' in required_data or request.include_sold:
        tasks['sold_positions'] = _fetch_sold_positions(request.portfolio_id, db)
    
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
        tasks['asset_allocation'] = _fetch_asset_allocation(request.portfolio_id, db)
    
    if 'sector_allocation' in required_data:
        tasks['sector_allocation'] = _fetch_sector_allocation(request.portfolio_id, db)
    
    if 'country_allocation' in required_data:
        tasks['country_allocation'] = _fetch_country_allocation(request.portfolio_id, db)
    
    if 'performance_history' in required_data:
        tasks['performance_history'] = _fetch_performance_history(request.portfolio_id, db)
    
    if 'risk_metrics' in required_data:
        tasks['risk_metrics'] = _fetch_risk_metrics(request.portfolio_id, db)
    
    if 'benchmark_comparison' in required_data:
        tasks['benchmark_comparison'] = _fetch_benchmark_comparison(request.portfolio_id, db)
    
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
    response = {
        "data": data,
        "errors": errors if errors else None,
        "cached": False,
        "timestamp": now.isoformat(),
        "widgets_requested": len(request.visible_widgets),
        "data_fetched": len(data),
    }
    
    # Cache the response
    _batch_cache[cache_key] = (response, now)
    
    # Cleanup old cache entries (keep last 100)
    if len(_batch_cache) > 100:
        oldest_keys = sorted(_batch_cache.keys(), key=lambda k: _batch_cache[k][1])[:20]
        for key in oldest_keys:
            del _batch_cache[key]
    
    return response


@router.delete("/dashboard/cache")
async def clear_dashboard_cache(
    current_user: User = Depends(get_current_verified_user)
):
    """Clear dashboard batch cache (admin/debugging)"""
    _batch_cache.clear()
    return {"message": "Dashboard cache cleared", "timestamp": datetime.now().isoformat()}
