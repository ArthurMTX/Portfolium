"""
Background tasks for portfolio metrics calculation.
"""
import asyncio
import logging
from typing import List, Optional
from celery import group
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db import get_db_context
from app.models import Portfolio, User
from app.services.metrics import MetricsService
from app.services.cache import CacheService
from app.tasks.decorators import singleton_task, deduplicate_task

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.metrics_tasks.calculate_portfolio_metrics")
@deduplicate_task(ttl=30)  # Prevent duplicate calls within 30 seconds
def calculate_portfolio_metrics(self, portfolio_id: int, user_id: int) -> dict:
    """
    Calculate and cache metrics for a single portfolio.
    
    Args:
        portfolio_id: Portfolio ID to calculate metrics for
        user_id: User ID who owns the portfolio
        
    Returns:
        dict with status and metrics info
    """
    try:
        logger.info(f"Task {self.request.id}: Calculating metrics for portfolio {portfolio_id}")
        
        with get_db_context() as db:
            # Verify portfolio exists and belongs to user
            portfolio = db.query(Portfolio).filter(
                Portfolio.id == portfolio_id,
                Portfolio.user_id == user_id
            ).first()
            
            if not portfolio:
                logger.warning(f"Portfolio {portfolio_id} not found or doesn't belong to user {user_id}")
                return {"status": "error", "message": "Portfolio not found"}
            
            # Calculate metrics using MetricsService
            metrics_service = MetricsService(db)
            positions = asyncio.run(metrics_service.get_positions(portfolio_id, include_sold=False))
            
            # Cache the results (convert to dict for serialization)
            positions_data = [pos.model_dump() for pos in positions]
            CacheService.set(
                f"{CacheService.PREFIX_POSITION}{portfolio_id}",
                positions_data,
                ttl=CacheService.TTL_POSITION
            )
            
            logger.info(
                f"Task {self.request.id}: Successfully calculated and cached metrics "
                f"for portfolio {portfolio_id} ({len(positions)} positions)"
            )
            
            return {
                "status": "success",
                "portfolio_id": portfolio_id,
                "positions_count": len(positions),
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error calculating metrics for portfolio {portfolio_id}: {e}",
            exc_info=True
        )
        # Retry with exponential backoff (max 3 retries)
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries), max_retries=3)


@celery_app.task(bind=True, name="app.tasks.metrics_tasks.refresh_all_portfolio_metrics")
@singleton_task(timeout=300)  # Prevent overlapping executions
def refresh_all_portfolio_metrics(self) -> dict:
    """
    Refresh metrics for all active portfolios.
    Typically scheduled to run periodically.
    
    Returns:
        dict with summary of refreshed portfolios
    """
    try:
        logger.info(f"Task {self.request.id}: Starting refresh of all portfolio metrics")
        
        with get_db_context() as db:
            # Get all active portfolios (portfolios with at least one transaction)
            portfolios = db.query(Portfolio).join(User).filter(
                User.is_active == True
            ).all()
            
            if not portfolios:
                logger.info("No active portfolios to refresh")
                return {"status": "success", "portfolios_refreshed": 0}
            
            # Create a group of tasks to run in parallel
            job = group(
                calculate_portfolio_metrics.s(p.id, p.user_id)
                for p in portfolios
            )
            
            # Execute tasks in parallel
            result = job.apply_async()
            
            logger.info(
                f"Task {self.request.id}: Dispatched metrics calculation for "
                f"{len(portfolios)} portfolios"
            )
            
            return {
                "status": "success",
                "portfolios_dispatched": len(portfolios),
                "group_id": result.id,
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error refreshing all portfolio metrics: {e}",
            exc_info=True
        )
        raise


@celery_app.task(bind=True, name="app.tasks.metrics_tasks.calculate_sold_positions")
def calculate_sold_positions(self, portfolio_id: int, user_id: int) -> dict:
    """
    Calculate sold positions for a portfolio (for realized gains/losses).
    
    Args:
        portfolio_id: Portfolio ID
        user_id: User ID who owns the portfolio
        
    Returns:
        dict with status and count of sold positions
    """
    try:
        logger.info(f"Task {self.request.id}: Calculating sold positions for portfolio {portfolio_id}")
        
        with get_db_context() as db:
            portfolio = db.query(Portfolio).filter(
                Portfolio.id == portfolio_id,
                Portfolio.user_id == user_id
            ).first()
            
            if not portfolio:
                return {"status": "error", "message": "Portfolio not found"}
            
            metrics_service = MetricsService(db)
            sold_positions = asyncio.run(metrics_service.get_positions(portfolio_id, include_sold=True))
            
            # Cache sold positions separately
            CacheService.set(
                f"{CacheService.PREFIX_METRICS}{portfolio_id}:sold",
                sold_positions,
                ttl=CacheService.TTL_METRICS
            )
            
            logger.info(
                f"Task {self.request.id}: Cached {len(sold_positions)} sold positions "
                f"for portfolio {portfolio_id}"
            )
            
            return {
                "status": "success",
                "portfolio_id": portfolio_id,
                "sold_positions_count": len(sold_positions),
                "task_id": self.request.id
            }
            
    except Exception as e:
        logger.error(
            f"Task {self.request.id}: Error calculating sold positions for portfolio {portfolio_id}: {e}",
            exc_info=True
        )
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries), max_retries=3)


@celery_app.task(name="app.tasks.metrics_tasks.warmup_metrics_cache")
def warmup_metrics_cache(portfolio_ids: Optional[List[int]] = None) -> dict:
    """
    Warm up metrics cache for specified portfolios or all active portfolios.
    Useful on startup or after cache flush.
    
    Args:
        portfolio_ids: Optional list of specific portfolio IDs to warm up
        
    Returns:
        dict with summary of warmed up portfolios
    """
    try:
        logger.info("Warming up metrics cache")
        
        with get_db_context() as db:
            if portfolio_ids:
                portfolios = db.query(Portfolio).filter(Portfolio.id.in_(portfolio_ids)).all()
            else:
                # Get all active portfolios
                portfolios = db.query(Portfolio).join(User).filter(
                    User.is_active == True
                ).all()
            
            # Create parallel tasks for warmup
            job = group(
                calculate_portfolio_metrics.s(p.id, p.user_id)
                for p in portfolios
            )
            
            result = job.apply_async()
            
            logger.info(f"Dispatched cache warmup for {len(portfolios)} portfolios")
            
            return {
                "status": "success",
                "portfolios_warmed": len(portfolios),
                "group_id": result.id
            }
            
    except Exception as e:
        logger.error(f"Error warming up metrics cache: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
