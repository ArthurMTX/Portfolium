"""
CRUD operations for pending dividends
"""
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models import PendingDividend, PendingDividendStatus, Asset
from app.schemas import PendingDividendCreate


def create_pending_dividend(
    db: Session,
    pending_dividend: PendingDividendCreate
) -> PendingDividend:
    """Create a new pending dividend"""
    db_pending = PendingDividend(
        portfolio_id=pending_dividend.portfolio_id,
        asset_id=pending_dividend.asset_id,
        user_id=pending_dividend.user_id,
        ex_dividend_date=pending_dividend.ex_dividend_date,
        payment_date=pending_dividend.payment_date,
        dividend_per_share=pending_dividend.dividend_per_share,
        shares_held=pending_dividend.shares_held,
        gross_amount=pending_dividend.gross_amount,
        currency=pending_dividend.currency,
        status=PendingDividendStatus.PENDING,
        yfinance_raw_data=pending_dividend.yfinance_raw_data
    )
    db.add(db_pending)
    db.commit()
    db.refresh(db_pending)
    return db_pending


def get_pending_dividend(db: Session, dividend_id: int) -> Optional[PendingDividend]:
    """Get a pending dividend by ID"""
    return db.query(PendingDividend).filter(PendingDividend.id == dividend_id).first()


def get_pending_dividends_by_user(
    db: Session,
    user_id: int,
    status: Optional[PendingDividendStatus] = None,
    portfolio_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100
) -> List[PendingDividend]:
    """
    Get pending dividends for a user with optional filters
    
    Args:
        db: Database session
        user_id: User ID
        status: Filter by status (default: all)
        portfolio_id: Filter by portfolio (default: all portfolios)
        skip: Pagination offset
        limit: Maximum results
    """
    query = db.query(PendingDividend).filter(PendingDividend.user_id == user_id)
    
    if status:
        query = query.filter(PendingDividend.status == status)
    if portfolio_id:
        query = query.filter(PendingDividend.portfolio_id == portfolio_id)
    
    # Order by ex-dividend date descending (most recent first)
    query = query.order_by(PendingDividend.ex_dividend_date.desc())
    query = query.offset(skip).limit(limit)
    
    return query.all()


def get_pending_dividends_by_portfolio(
    db: Session,
    portfolio_id: int,
    status: Optional[PendingDividendStatus] = None,
    skip: int = 0,
    limit: int = 100
) -> List[PendingDividend]:
    """Get pending dividends for a specific portfolio"""
    query = db.query(PendingDividend).filter(PendingDividend.portfolio_id == portfolio_id)
    
    if status:
        query = query.filter(PendingDividend.status == status)
    
    query = query.order_by(PendingDividend.ex_dividend_date.desc())
    query = query.offset(skip).limit(limit)
    
    return query.all()


def check_dividend_exists(
    db: Session,
    portfolio_id: int,
    asset_id: int,
    ex_dividend_date: date
) -> bool:
    """
    Check if a pending dividend already exists for this portfolio/asset/date combination.
    Also checks if there's already a DIVIDEND transaction for this date.
    """
    from app.models import Transaction, TransactionType
    
    # Check pending dividends
    existing_pending = db.query(PendingDividend).filter(
        and_(
            PendingDividend.portfolio_id == portfolio_id,
            PendingDividend.asset_id == asset_id,
            PendingDividend.ex_dividend_date == ex_dividend_date
        )
    ).first()
    
    if existing_pending:
        return True
    
    # Check actual dividend transactions (user may have entered manually)
    existing_transaction = db.query(Transaction).filter(
        and_(
            Transaction.portfolio_id == portfolio_id,
            Transaction.asset_id == asset_id,
            Transaction.type == TransactionType.DIVIDEND,
            Transaction.tx_date == ex_dividend_date
        )
    ).first()
    
    return existing_transaction is not None


def update_pending_dividend_status(
    db: Session,
    dividend_id: int,
    status: PendingDividendStatus,
    transaction_id: Optional[int] = None
) -> Optional[PendingDividend]:
    """Update the status of a pending dividend"""
    pending = get_pending_dividend(db, dividend_id)
    if not pending:
        return None
    
    pending.status = status
    pending.processed_at = datetime.utcnow()
    if transaction_id:
        pending.transaction_id = transaction_id
    
    db.commit()
    db.refresh(pending)
    return pending


def get_pending_dividend_stats(db: Session, user_id: int) -> dict:
    """Get statistics about pending dividends for a user"""
    # Count by status
    pending_count = db.query(func.count(PendingDividend.id)).filter(
        PendingDividend.user_id == user_id,
        PendingDividend.status == PendingDividendStatus.PENDING
    ).scalar() or 0
    
    pending_total = db.query(func.sum(PendingDividend.gross_amount)).filter(
        PendingDividend.user_id == user_id,
        PendingDividend.status == PendingDividendStatus.PENDING
    ).scalar() or Decimal(0)
    
    accepted_count = db.query(func.count(PendingDividend.id)).filter(
        PendingDividend.user_id == user_id,
        PendingDividend.status == PendingDividendStatus.ACCEPTED
    ).scalar() or 0
    
    rejected_count = db.query(func.count(PendingDividend.id)).filter(
        PendingDividend.user_id == user_id,
        PendingDividend.status == PendingDividendStatus.REJECTED
    ).scalar() or 0
    
    # Oldest pending date
    oldest = db.query(func.min(PendingDividend.ex_dividend_date)).filter(
        PendingDividend.user_id == user_id,
        PendingDividend.status == PendingDividendStatus.PENDING
    ).scalar()
    
    return {
        "pending_count": pending_count,
        "pending_total_amount": pending_total,
        "accepted_count": accepted_count,
        "rejected_count": rejected_count,
        "oldest_pending_date": oldest
    }


def delete_pending_dividend(db: Session, dividend_id: int) -> bool:
    """Delete a pending dividend (only if still pending)"""
    pending = get_pending_dividend(db, dividend_id)
    if not pending or pending.status != PendingDividendStatus.PENDING:
        return False
    
    db.delete(pending)
    db.commit()
    return True


def expire_old_pending_dividends(db: Session, days_old: int = 365) -> int:
    """Mark very old pending dividends as expired"""
    from datetime import timedelta
    
    cutoff_date = date.today() - timedelta(days=days_old)
    
    count = db.query(PendingDividend).filter(
        PendingDividend.status == PendingDividendStatus.PENDING,
        PendingDividend.ex_dividend_date < cutoff_date
    ).update({"status": PendingDividendStatus.EXPIRED, "processed_at": datetime.utcnow()})
    
    db.commit()
    return count
