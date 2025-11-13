"""
Background tasks for portfolio insights calculation.
"""
import asyncio
import logging
from typing import List, Optional
from celery import group
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import Portfolio, User
from app.services.insights import InsightsService
from app.services.cache import CacheService
from app.tasks.decorators import singleton_task, deduplicate_task

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.insights_tasks.calculate_portfolio_insights")
@deduplicate_task(ttl=60)  # Prevent duplicate calls within 60 seconds
def calculate_portfolio_insights(self, portfolio_id: int, user_id: int, period: str = "1mo") -> dict:
    """
    Calculate and cache insights for a single portfolio.
    
    Args:
        portfolio_id: Portfolio ID to calculate insights for
        user_id: User ID who owns the portfolio
        period: Time period for insights (e.g., '1mo', '3mo', '1y')
        
    Returns:
        dict with status and insights info
    """
    try:
        logger.info(
            f"Task {self.request.id}: Calculating insights for portfolio {portfolio_id} "
            f"(period: {period})"
        )
        
        with get_db_context() as db:
            # Verify portfolio exists and belongs to user
            portfolio = db.query(Portfolio).filter(
                Portfolio.id == portfolio_id,
                Portfolio.user_id == user_id
            ).first()
            
            if not portfolio:
                logger.warning(f"Portfolio {portfolio_id} not found or doesn't belong to user {user_id}")
                return {"status": "error", "message": "Portfolio not found"}
            
            # Calculate insights using InsightsService (with default benchmark SPY)
            insights_service = InsightsService(db)
            benchmark = "SPY"  # Default benchmark
            insights = asyncio.run(insights_service.get_portfolio_insights(portfolio_id, user_id, period, benchmark))
            
            # Note: Caching is handled by InsightsService._cache_insights internally
            # The cache key format is: insights:{portfolio_id}:{period}:{benchmark}
            
            logger.info(
                f"Task {self.request.id}: Successfully calculated and cached insights "
                f"for portfolio {portfolio_id}"
            )
            
            return {
                "status": "success",
                "portfolio_id": portfolio_id,
                "period": period,
                "has_allocations": len(insights.asset_allocation) > 0,
                "has_performance": insights.performance is not None,
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error calculating insights for portfolio {portfolio_id}: {e}",
            exc_info=True
        )
        # Retry with exponential backoff (max 3 retries)
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries), max_retries=3)


@celery_app.task(bind=True, name="app.tasks.insights_tasks.refresh_all_portfolio_insights")
@singleton_task(timeout=600)  # Prevent overlapping executions (10 min)
def refresh_all_portfolio_insights(self, period: str = "1mo") -> dict:
    """
    Refresh insights for all active portfolios.
    Typically scheduled to run periodically.
    
    Args:
        period: Time period for insights
        
    Returns:
        dict with summary of refreshed portfolios
    """
    try:
        logger.info(
            f"Task {self.request.id}: Starting refresh of all portfolio insights (period: {period})"
        )
        
        with get_db_context() as db:
            # Get all active portfolios
            portfolios = db.query(Portfolio).join(User).filter(
                User.is_active == True
            ).all()
            
            if not portfolios:
                logger.info("No active portfolios to refresh insights for")
                return {"status": "success", "portfolios_refreshed": 0}
            
            # Create a group of tasks to run in parallel
            job = group(
                calculate_portfolio_insights.s(p.id, p.user_id, period)
                for p in portfolios
            )
            
            # Execute tasks in parallel
            result = job.apply_async()
            
            logger.info(
                f"Task {self.request.id}: Dispatched insights calculation for "
                f"{len(portfolios)} portfolios"
            )
            
            return {
                "status": "success",
                "portfolios_dispatched": len(portfolios),
                "period": period,
                "group_id": result.id,
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error refreshing all portfolio insights: {e}",
            exc_info=True
        )
        raise


@celery_app.task(bind=True, name="app.tasks.insights_tasks.calculate_insights_all_periods")
def calculate_insights_all_periods(self, portfolio_id: int, user_id: int) -> dict:
    """
    Calculate insights for a portfolio across multiple time periods.
    Useful when a transaction is created/updated to refresh all views.
    
    Args:
        portfolio_id: Portfolio ID
        user_id: User ID who owns the portfolio
        
    Returns:
        dict with status for each period
    """
    try:
        periods = ["1mo", "3mo", "6mo", "1y", "ytd", "all"]
        logger.info(
            f"Task {self.request.id}: Calculating insights for portfolio {portfolio_id} "
            f"across {len(periods)} periods"
        )
        
        # Create subtasks for each period
        job = group(
            calculate_portfolio_insights.s(portfolio_id, user_id, period)
            for period in periods
        )
        
        result = job.apply_async()
        
        return {
            "status": "success",
            "portfolio_id": portfolio_id,
            "periods": periods,
            "group_id": result.id,
            "task_id": self.request.id
        }
        
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error calculating insights for all periods: {e}",
            exc_info=True
        )
        raise self.retry(exc=e, countdown=30, max_retries=2)


@celery_app.task(name="app.tasks.insights_tasks.warmup_insights_cache")
def warmup_insights_cache(portfolio_ids: Optional[List[int]] = None, periods: Optional[List[str]] = None) -> dict:
    """
    Warm up insights cache for specified portfolios and periods.
    
    Args:
        portfolio_ids: Optional list of specific portfolio IDs to warm up
        periods: Optional list of periods to calculate (default: ['1mo', '3mo', '1y'])
        
    Returns:
        dict with summary of warmed up portfolios
    """
    try:
        if periods is None:
            periods = ["1mo", "3mo", "1y"]
        
        logger.info(f"Warming up insights cache for periods: {periods}")
        
        with get_db_context() as db:
            if portfolio_ids:
                portfolios = db.query(Portfolio).filter(Portfolio.id.in_(portfolio_ids)).all()
            else:
                # Get all active portfolios
                portfolios = db.query(Portfolio).join(User).filter(
                    User.is_active == True
                ).all()
            
            # Create parallel tasks for each portfolio and period combination
            tasks = []
            for portfolio in portfolios:
                for period in periods:
                    tasks.append(
                        calculate_portfolio_insights.s(portfolio.id, portfolio.user_id, period)
                    )
            
            job = group(tasks)
            result = job.apply_async()
            
            logger.info(
                f"Dispatched insights cache warmup for {len(portfolios)} portfolios "
                f"across {len(periods)} periods ({len(tasks)} total tasks)"
            )
            
            return {
                "status": "success",
                "portfolios_warmed": len(portfolios),
                "periods": periods,
                "total_tasks": len(tasks),
                "group_id": result.id
            }
            
    except Exception as e:
        logger.error(f"Error warming up insights cache: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
