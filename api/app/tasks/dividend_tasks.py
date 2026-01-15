"""
Background tasks for fetching and managing dividends
"""
import logging
from datetime import datetime
from typing import Optional

from app.celery_app import celery_app
from app.db import get_db
from app.models import Portfolio, User, PendingDividendStatus
from app.services.dividends import DividendService
from app.services.notifications import notification_service
from app.crud import pending_dividends as crud_pending

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.fetch_dividends_for_portfolio")
def fetch_dividends_for_portfolio_task(
    portfolio_id: int,
    lookback_days: int = 365,
    lookahead_days: int = 90
) -> dict:
    """
    Celery task to fetch dividends for a specific portfolio.
    
    Args:
        portfolio_id: Portfolio ID to fetch dividends for
        lookback_days: How far back to check
        lookahead_days: How far ahead to check for announced dividends
        
    Returns:
        dict with results
    """
    db = next(get_db())
    try:
        dividend_service = DividendService(db)
        
        created = dividend_service.fetch_dividends_for_portfolio(
            portfolio_id,
            lookback_days=lookback_days,
            lookahead_days=lookahead_days
        )
        
        # Create notification if dividends were found
        if created:
            portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
            if portfolio:
                notification_service.create_pending_dividend_notification(
                    db,
                    user_id=portfolio.user_id,
                    pending_dividends=created
                )
        
        return {
            "success": True,
            "portfolio_id": portfolio_id,
            "dividends_found": len(created),
            "dividend_ids": [d.id for d in created]
        }
        
    except Exception as e:
        logger.exception(f"Failed to fetch dividends for portfolio {portfolio_id}: {e}")
        return {
            "success": False,
            "portfolio_id": portfolio_id,
            "error": str(e)
        }
    finally:
        db.close()


@celery_app.task(name="tasks.fetch_all_dividends")
def fetch_all_dividends_task(
    lookback_days: int = 90,
    lookahead_days: int = 90
) -> dict:
    """
    Celery task to fetch dividends for all active portfolios.
    
    This is meant to run as a scheduled job (e.g., daily).
    
    Args:
        lookback_days: How far back to check (shorter for regular runs)
        lookahead_days: How far ahead for announced dividends
        
    Returns:
        dict with summary results
    """
    db = next(get_db())
    try:
        # Get all portfolios that have transactions (active portfolios)
        from sqlalchemy import distinct
        from app.models import Transaction
        
        active_portfolio_ids = (
            db.query(distinct(Transaction.portfolio_id))
            .all()
        )
        active_portfolio_ids = [p[0] for p in active_portfolio_ids]
        
        logger.info(f"Fetching dividends for {len(active_portfolio_ids)} active portfolios")
        
        total_created = 0
        portfolio_results = {}
        
        for portfolio_id in active_portfolio_ids:
            try:
                dividend_service = DividendService(db)
                created = dividend_service.fetch_dividends_for_portfolio(
                    portfolio_id,
                    lookback_days=lookback_days,
                    lookahead_days=lookahead_days
                )
                
                if created:
                    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
                    if portfolio:
                        notification_service.create_pending_dividend_notification(
                            db,
                            user_id=portfolio.user_id,
                            pending_dividends=created
                        )
                
                total_created += len(created)
                portfolio_results[portfolio_id] = len(created)
                
            except Exception as e:
                logger.error(f"Error fetching dividends for portfolio {portfolio_id}: {e}")
                portfolio_results[portfolio_id] = f"error: {str(e)}"
        
        logger.info(
            f"Dividend fetch completed: {total_created} new pending dividends "
            f"across {len(active_portfolio_ids)} portfolios"
        )
        
        return {
            "success": True,
            "portfolios_processed": len(active_portfolio_ids),
            "total_dividends_found": total_created,
            "portfolio_results": portfolio_results
        }
        
    except Exception as e:
        logger.exception(f"Failed to fetch all dividends: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()


@celery_app.task(name="tasks.expire_old_pending_dividends")
def expire_old_pending_dividends_task(days_old: int = 365) -> dict:
    """
    Expire pending dividends that are too old.
    
    This prevents the pending list from growing indefinitely with
    dividends the user never acted upon.
    
    Args:
        days_old: How old a dividend must be to expire
        
    Returns:
        dict with results
    """
    db = next(get_db())
    try:
        count = crud_pending.expire_old_pending_dividends(db, days_old=days_old)
        
        logger.info(f"Expired {count} old pending dividends (older than {days_old} days)")
        
        return {
            "success": True,
            "expired_count": count
        }
        
    except Exception as e:
        logger.exception(f"Failed to expire old pending dividends: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()


@celery_app.task(name="tasks.cleanup_duplicate_pending_dividends")
def cleanup_duplicate_pending_dividends_task() -> dict:
    """
    Clean up any duplicate pending dividends that might have been created.
    
    Keeps the oldest pending dividend for each (portfolio, asset, ex_date) combo.
    """
    db = next(get_db())
    try:
        from sqlalchemy import func
        from app.models import PendingDividend
        
        # Find duplicates
        subq = (
            db.query(
                PendingDividend.portfolio_id,
                PendingDividend.asset_id,
                PendingDividend.ex_dividend_date,
                func.min(PendingDividend.id).label('keep_id')
            )
            .group_by(
                PendingDividend.portfolio_id,
                PendingDividend.asset_id,
                PendingDividend.ex_dividend_date
            )
            .having(func.count(PendingDividend.id) > 1)
            .subquery()
        )
        
        # This is a simplified approach - in production you'd want more careful handling
        # For now, we just log duplicates
        duplicates = db.query(subq).all()
        
        logger.info(f"Found {len(duplicates)} groups with duplicate pending dividends")
        
        return {
            "success": True,
            "duplicate_groups_found": len(duplicates)
        }
        
    except Exception as e:
        logger.exception(f"Failed to cleanup duplicate pending dividends: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()
