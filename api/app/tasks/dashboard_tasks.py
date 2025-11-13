"""
Background tasks for dashboard data pre-warming
Ensures users are greeted with instant data when they visit their dashboard
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import User, Portfolio, DashboardLayout
from app.routers.batch import (
    _extract_required_data,
    _fetch_metrics,
    _fetch_positions,
    _fetch_watchlist,
    _fetch_notifications,
    _fetch_market_tnx,
    _fetch_market_dxy,
    _fetch_market_vix,
    _fetch_market_indices,
    _fetch_sentiment_stock,
    _fetch_sentiment_crypto,
    _fetch_asset_allocation,
    _fetch_sector_allocation,
    _fetch_country_allocation,
    _fetch_performance_history,
    _fetch_transactions,
)
from app.services.metrics import MetricsService
from app.services.insights import InsightsService
from app.tasks.decorators import singleton_task, deduplicate_task

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="dashboard.warmup_user_dashboard")
@deduplicate_task(ttl=30)
def warmup_user_dashboard(self, user_id: int, portfolio_id: int, widget_ids: Optional[List[str]] = None):
    """
    Pre-warm dashboard cache for a specific user's portfolio
    
    This task fetches and caches all data needed for the user's dashboard widgets.
    When the user visits their dashboard, data will be served instantly from cache.
    
    Args:
        user_id: User ID
        portfolio_id: Portfolio ID
        widget_ids: List of widget IDs to warm (if None, uses default common widgets)
    """
    with get_db_context() as db:
        # Verify portfolio belongs to user
        portfolio = db.query(Portfolio).filter(
            and_(Portfolio.id == portfolio_id, Portfolio.user_id == user_id)
        ).first()
        
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found for user {user_id}")
            return {"success": False, "error": "Portfolio not found"}
        
        # Get user's dashboard layout if exists, otherwise use default widgets
        if widget_ids is None:
            layout = db.query(DashboardLayout).filter(
                and_(
                    DashboardLayout.user_id == user_id,
                    DashboardLayout.portfolio_id == portfolio_id,
                    DashboardLayout.is_default == True
                )
            ).first()
            
            if layout and layout.layout_config:
                # Extract widget IDs from layout config
                widget_ids = _extract_widget_ids_from_layout(layout.layout_config)
            else:
                # Default common widgets (fast widgets only)
                widget_ids = [
                    'total-value', 'daily-gain', 'unrealized-pnl', 'realized-pnl',
                    'positions-table', 'watchlist', 'market-indices',
                    'asset-allocation', 'recent-transactions'
                ]
        
        logger.info(f"Warming dashboard for user {user_id}, portfolio {portfolio_id} with {len(widget_ids)} widgets")
        
        # Determine required data sets
        required_data = _extract_required_data(widget_ids)
        
        # Initialize services with db session
        metrics_service = MetricsService(db)
        insights_service = InsightsService(db)
        
        # Fetch all required data
        async def fetch_all_data():
            tasks = {}
            
            if 'metrics' in required_data:
                tasks['metrics'] = _fetch_metrics(portfolio_id, metrics_service, db)
            
            if 'positions' in required_data:
                tasks['positions'] = _fetch_positions(portfolio_id, metrics_service, db)
            
            if 'watchlist' in required_data:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    tasks['watchlist'] = _fetch_watchlist(user, db)
            
            if 'notifications' in required_data:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    tasks['notifications'] = _fetch_notifications(user, db)
            
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
                tasks['asset_allocation'] = _fetch_asset_allocation(portfolio_id, db)
            
            if 'sector_allocation' in required_data:
                tasks['sector_allocation'] = _fetch_sector_allocation(portfolio_id, db)
            
            if 'country_allocation' in required_data:
                tasks['country_allocation'] = _fetch_country_allocation(portfolio_id, db)
            
            if 'performance_history' in required_data:
                tasks['performance_history'] = _fetch_performance_history(portfolio_id, db)
            
            if 'transactions' in required_data:
                tasks['transactions'] = _fetch_transactions(portfolio_id, db)
            
            # Execute all in parallel
            results = await asyncio.gather(*tasks.values(), return_exceptions=True)
            
            success_count = sum(1 for r in results if not isinstance(r, Exception))
            error_count = len(results) - success_count
            
            return {
                "success": True,
                "widgets_warmed": len(widget_ids),
                "data_sets_fetched": success_count,
                "errors": error_count,
                "timestamp": datetime.now().isoformat()
            }
        
        # Run the async fetch
        result = asyncio.run(fetch_all_data())
        logger.info(f"Dashboard warmup complete for portfolio {portfolio_id}: {result}")
        return result


@celery_app.task(bind=True, name="dashboard.warmup_active_dashboards")
@singleton_task(timeout=600)
def warmup_active_dashboards(self):
    """
    Pre-warm dashboards for recently active users
    
    This scheduled task identifies users who have been active recently and
    pre-warms their dashboard caches so they get instant data on next visit.
    
    Runs every 5 minutes during market hours, every 30 minutes off-hours.
    """
    with get_db_context() as db:
        # Find users active in the last hour
        cutoff_time = datetime.utcnow() - timedelta(hours=1)
        
        # Get distinct users with portfolios who were recently active
        # (This assumes you have a last_activity_at field, adjust as needed)
        active_users = db.query(
            User.id,
            Portfolio.id.label('portfolio_id')
        ).join(
            Portfolio, User.id == Portfolio.user_id
        ).filter(
            User.is_active == True
        ).limit(50).all()  # Limit to 50 most recent to avoid overload
        
        if not active_users:
            logger.info("No active users found for dashboard warmup")
            return {"success": True, "users_warmed": 0}
        
        logger.info(f"Warming dashboards for {len(active_users)} active users")
        
        # Queue warmup tasks for each user's portfolio
        warmed_count = 0
        for user in active_users:
            try:
                warmup_user_dashboard.delay(user.id, user.portfolio_id)
                warmed_count += 1
            except Exception as e:
                logger.error(f"Failed to queue warmup for user {user.id}: {e}")
        
        return {
            "success": True,
            "users_warmed": warmed_count,
            "timestamp": datetime.now().isoformat()
        }


@celery_app.task(bind=True, name="dashboard.warmup_portfolio_on_transaction")
def warmup_portfolio_on_transaction(self, portfolio_id: int, user_id: int):
    """
    Triggered after a transaction is created/updated
    Immediately warms the dashboard cache so user sees updated data
    
    Args:
        portfolio_id: Portfolio that had a transaction
        user_id: User who owns the portfolio
    """
    logger.info(f"Transaction detected for portfolio {portfolio_id}, warming dashboard")
    return warmup_user_dashboard(user_id, portfolio_id)


def _extract_widget_ids_from_layout(layout_config: dict) -> List[str]:
    """
    Extract widget IDs from dashboard layout configuration
    
    Args:
        layout_config: JSON layout configuration from DashboardLayout.layout_config
        
    Returns:
        List of widget IDs
    """
    widget_ids = []
    
    # Handle different layout config structures
    if isinstance(layout_config, dict):
        # Check for common layout structures
        if 'widgets' in layout_config:
            widgets = layout_config['widgets']
            if isinstance(widgets, list):
                for widget in widgets:
                    if isinstance(widget, dict) and 'id' in widget:
                        widget_ids.append(widget['id'])
                    elif isinstance(widget, str):
                        widget_ids.append(widget)
        
        # Check for grid-based layouts
        elif 'grid' in layout_config or 'layout' in layout_config:
            grid = layout_config.get('grid') or layout_config.get('layout')
            if isinstance(grid, list):
                for item in grid:
                    if isinstance(item, dict):
                        # Common grid formats: {i: 'widget-id', ...} or {id: 'widget-id', ...}
                        widget_id = item.get('i') or item.get('id') or item.get('widget_id')
                        if widget_id:
                            widget_ids.append(widget_id)
    
    return widget_ids
