"""
Background tasks monitoring and management endpoints.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth import get_current_user, get_current_admin_user
from app.models import User
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/status")
async def get_tasks_status(current_user: User = Depends(get_current_user)):
    """
    Get background tasks system status.
    Shows if tasks are enabled and Celery connectivity.
    """
    try:
        from app.celery_app import celery_app
        
        # Check if tasks are enabled
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {
                "enabled": False,
                "message": "Background tasks are disabled in configuration"
            }
        
        # Check Celery connectivity
        try:
            inspect = celery_app.control.inspect()
            stats = inspect.stats()
            active = inspect.active()
            scheduled = inspect.scheduled()
            
            worker_count = len(stats) if stats else 0
            active_tasks_count = sum(len(tasks) for tasks in (active or {}).values())
            scheduled_tasks_count = sum(len(tasks) for tasks in (scheduled or {}).values())
            
            return {
                "enabled": True,
                "celery_connected": True,
                "workers": worker_count,
                "active_tasks": active_tasks_count,
                "scheduled_tasks": scheduled_tasks_count,
                "broker_url": settings.celery_broker_url.replace(settings.REDIS_PASSWORD, "***") if settings.REDIS_PASSWORD else settings.celery_broker_url,
            }
        except Exception as e:
            logger.error(f"Failed to connect to Celery: {e}")
            return {
                "enabled": True,
                "celery_connected": False,
                "error": str(e),
                "message": "Background tasks enabled but Celery is not responding"
            }
            
    except Exception as e:
        logger.error(f"Error checking tasks status: {e}")
        return {
            "enabled": False,
            "error": str(e)
        }


@router.get("/workers")
async def get_workers_info(current_user: User = Depends(get_current_admin_user)):
    """
    Get detailed information about Celery workers (admin only).
    Shows worker stats, queues, and configuration.
    """
    try:
        from app.celery_app import celery_app
        
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        inspect = celery_app.control.inspect()
        
        stats = inspect.stats()
        active = inspect.active()
        scheduled = inspect.scheduled()
        registered = inspect.registered()
        
        workers_info = []
        
        if stats:
            for worker_name, worker_stats in stats.items():
                workers_info.append({
                    "name": worker_name,
                    "status": "online",
                    "pool": worker_stats.get("pool", {}),
                    "active_tasks": len(active.get(worker_name, [])) if active else 0,
                    "scheduled_tasks": len(scheduled.get(worker_name, [])) if scheduled else 0,
                    "registered_tasks": len(registered.get(worker_name, [])) if registered else 0,
                    "total_tasks": worker_stats.get("total", {}),
                })
        
        return {
            "workers": workers_info,
            "total_workers": len(workers_info)
        }
        
    except Exception as e:
        logger.error(f"Error getting workers info: {e}")
        return {"error": str(e)}


@router.get("/active")
async def get_active_tasks(current_user: User = Depends(get_current_admin_user)):
    """
    Get list of currently executing tasks (admin only).
    """
    try:
        from app.celery_app import celery_app
        
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        inspect = celery_app.control.inspect()
        active = inspect.active()
        
        if not active:
            return {"active_tasks": [], "count": 0}
        
        all_active = []
        for worker_name, tasks in active.items():
            for task in tasks:
                all_active.append({
                    "worker": worker_name,
                    "task_id": task.get("id"),
                    "name": task.get("name"),
                    "args": task.get("args"),
                    "kwargs": task.get("kwargs"),
                    "time_start": task.get("time_start"),
                })
        
        return {
            "active_tasks": all_active,
            "count": len(all_active)
        }
        
    except Exception as e:
        logger.error(f"Error getting active tasks: {e}")
        return {"error": str(e)}


@router.get("/scheduled")
async def get_scheduled_tasks(current_user: User = Depends(get_current_admin_user)):
    """
    Get list of scheduled (queued) tasks (admin only).
    """
    try:
        from app.celery_app import celery_app
        
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        inspect = celery_app.control.inspect()
        scheduled = inspect.scheduled()
        
        if not scheduled:
            return {"scheduled_tasks": [], "count": 0}
        
        all_scheduled = []
        for worker_name, tasks in scheduled.items():
            for task in tasks:
                all_scheduled.append({
                    "worker": worker_name,
                    "task_id": task.get("request", {}).get("id"),
                    "name": task.get("request", {}).get("name"),
                    "eta": task.get("eta"),
                })
        
        return {
            "scheduled_tasks": all_scheduled,
            "count": len(all_scheduled)
        }
        
    except Exception as e:
        logger.error(f"Error getting scheduled tasks: {e}")
        return {"error": str(e)}


@router.post("/warmup-cache")
async def trigger_cache_warmup(
    portfolio_ids: Optional[List[int]] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Manually trigger cache warmup for metrics and insights (admin only).
    
    Args:
        portfolio_ids: Optional list of specific portfolio IDs to warm up.
                      If not provided, warms up all active portfolios.
    """
    try:
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        from app.tasks.metrics_tasks import warmup_metrics_cache
        from app.tasks.insights_tasks import warmup_insights_cache
        
        # Trigger cache warmup tasks
        metrics_result = warmup_metrics_cache.delay(portfolio_ids)
        insights_result = warmup_insights_cache.delay(portfolio_ids, periods=["1mo", "3mo", "1y"])
        
        return {
            "status": "success",
            "message": "Cache warmup tasks queued",
            "tasks": {
                "metrics": metrics_result.id,
                "insights": insights_result.id
            }
        }
        
    except Exception as e:
        logger.error(f"Error triggering cache warmup: {e}")
        return {"error": str(e)}


@router.post("/recalculate-portfolio/{portfolio_id}")
async def trigger_portfolio_recalculation(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger full recalculation of metrics and insights for a portfolio.
    User must own the portfolio or be admin.
    """
    try:
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        # Verify portfolio access
        from app.crud.portfolios import get_portfolio
        portfolio = get_portfolio(db, portfolio_id)
        
        if not portfolio:
            return {"error": "Portfolio not found"}
        
        if portfolio.user_id != current_user.id and not current_user.is_admin:
            return {"error": "Access denied"}
        
        # Queue recalculation tasks
        from app.tasks.metrics_tasks import calculate_portfolio_metrics
        from app.tasks.insights_tasks import calculate_insights_all_periods
        
        metrics_result = calculate_portfolio_metrics.delay(portfolio_id, portfolio.user_id)
        insights_result = calculate_insights_all_periods.delay(portfolio_id, portfolio.user_id)
        
        return {
            "status": "success",
            "message": f"Recalculation tasks queued for portfolio {portfolio_id}",
            "tasks": {
                "metrics": metrics_result.id,
                "insights": insights_result.id
            }
        }
        
    except Exception as e:
        logger.error(f"Error triggering portfolio recalculation: {e}")
        return {"error": str(e)}


@router.get("/beat-schedule")
async def get_beat_schedule(current_user: User = Depends(get_current_admin_user)):
    """
    Get Celery Beat schedule (periodic tasks configuration) - admin only.
    Shows all scheduled periodic tasks and their intervals.
    """
    try:
        from app.celery_app import celery_app
        
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        schedule = celery_app.conf.beat_schedule
        
        schedule_info = []
        for task_name, task_config in schedule.items():
            schedule_info.append({
                "name": task_name,
                "task": task_config.get("task"),
                "schedule": str(task_config.get("schedule")),
                "options": task_config.get("options", {}),
            })
        
        return {
            "periodic_tasks": schedule_info,
            "count": len(schedule_info),
            "metrics_interval_minutes": settings.METRICS_REFRESH_INTERVAL_MINUTES,
            "insights_interval_minutes": settings.INSIGHTS_REFRESH_INTERVAL_MINUTES,
        }
        
    except Exception as e:
        logger.error(f"Error getting beat schedule: {e}")
        return {"error": str(e)}


@router.post("/dashboard/warmup/{portfolio_id}")
async def warmup_dashboard(
    portfolio_id: int,
    widget_ids: Optional[List[str]] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger dashboard cache warmup for a portfolio.
    
    This pre-fetches all data needed for the dashboard so subsequent
    requests are served instantly from cache.
    
    Args:
        portfolio_id: Portfolio ID to warm up
        widget_ids: Optional list of specific widget IDs to warm (if None, uses default/layout widgets)
    """
    try:
        from app.tasks.dashboard_tasks import warmup_user_dashboard
        from app.crud import portfolios as crud_portfolios
        from app.errors import PortfolioNotFoundError
        
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        # Verify user has access to portfolio
        portfolio = crud_portfolios.get_portfolio(db, portfolio_id)
        if not portfolio or portfolio.user_id != current_user.id:
            raise PortfolioNotFoundError()
        
        # Queue warmup task
        result = warmup_user_dashboard.delay(current_user.id, portfolio_id, widget_ids)
        
        return {
            "status": "success",
            "message": f"Dashboard warmup queued for portfolio {portfolio_id}",
            "task_id": result.id,
            "widgets": len(widget_ids) if widget_ids else "default"
        }
        
    except Exception as e:
        logger.error(f"Error triggering dashboard warmup: {e}")
        return {"error": str(e)}


@router.post("/dashboard/warmup-on-transaction/{portfolio_id}")
async def warmup_dashboard_on_transaction(
    portfolio_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger dashboard warmup after a transaction is created/updated.
    
    This should be called by the frontend after transaction operations
    to ensure the dashboard shows updated data immediately.
    
    Args:
        portfolio_id: Portfolio that had a transaction
    """
    try:
        from app.tasks.dashboard_tasks import warmup_portfolio_on_transaction
        from app.crud import portfolios as crud_portfolios
        from app.errors import PortfolioNotFoundError
        
        if not settings.ENABLE_BACKGROUND_TASKS:
            return {"error": "Background tasks are disabled"}
        
        # Verify user has access to portfolio
        portfolio = crud_portfolios.get_portfolio(db, portfolio_id)
        if not portfolio or portfolio.user_id != current_user.id:
            raise PortfolioNotFoundError()
        
        # Queue warmup task (high priority)
        result = warmup_portfolio_on_transaction.delay(portfolio_id, current_user.id)
        
        return {
            "status": "success",
            "message": f"Dashboard warmup triggered for portfolio {portfolio_id}",
            "task_id": result.id
        }
        
    except Exception as e:
        logger.error(f"Error triggering dashboard warmup on transaction: {e}")
        return {"error": str(e)}

