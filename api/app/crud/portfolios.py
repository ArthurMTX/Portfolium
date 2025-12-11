"""
CRUD operations for portfolios
"""
from typing import List, Optional, Union
from sqlalchemy.orm import Session

from app.models import Portfolio
from app.schemas import PortfolioCreate, PortfolioUpdate


def get_portfolio(db: Session, portfolio_id: int) -> Optional[Portfolio]:
    """Get portfolio by ID (direct from database)"""
    return db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()


def get_portfolio_by_share_token(db: Session, share_token: str) -> Optional[Portfolio]:
    """Get portfolio by share token"""
    return db.query(Portfolio).filter(Portfolio.share_token == share_token).first()


def get_public_portfolio_by_share_token(db: Session, share_token: str) -> Optional[Portfolio]:
    """Get public portfolio by share token (only if is_public=True)"""
    return db.query(Portfolio).filter(
        Portfolio.share_token == share_token,
        Portfolio.is_public == True
    ).first()


def get_portfolio_by_name(db: Session, name: str) -> Optional[Portfolio]:
    """Get portfolio by name"""
    return db.query(Portfolio).filter(Portfolio.name == name).first()


def get_portfolios(db: Session, skip: int = 0, limit: int = 100) -> List[Portfolio]:
    """Get list of portfolios"""
    return db.query(Portfolio).offset(skip).limit(limit).all()


def get_portfolios_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Portfolio]:
    """Get portfolios for a specific user"""
    return db.query(Portfolio).filter(
        Portfolio.user_id == user_id
    ).offset(skip).limit(limit).all()


def get_portfolio_by_name_and_user(db: Session, name: str, user_id: int) -> Optional[Portfolio]:
    """Get portfolio by name for specific user"""
    return db.query(Portfolio).filter(
        Portfolio.name == name,
        Portfolio.user_id == user_id
    ).first()


def create_portfolio(db: Session, portfolio: PortfolioCreate, user_id: int = None) -> Portfolio:
    """Create new portfolio"""
    db_portfolio = Portfolio(
        name=portfolio.name,
        base_currency=portfolio.base_currency,
        description=portfolio.description,
        is_public=portfolio.is_public,
        user_id=user_id
    )
    db.add(db_portfolio)
    db.commit()
    db.refresh(db_portfolio)
    return db_portfolio


def create_portfolio_for_user(db: Session, portfolio: PortfolioCreate, user_id: int) -> Portfolio:
    """Create portfolio for specific user"""
    return create_portfolio(db, portfolio, user_id)


def update_portfolio(
    db: Session, 
    portfolio_id: int, 
    portfolio: Union[PortfolioCreate, PortfolioUpdate]
) -> Optional[Portfolio]:
    """Update existing portfolio"""
    db_portfolio = get_portfolio(db, portfolio_id)
    if not db_portfolio:
        return None
    
    db_portfolio.name = portfolio.name
    db_portfolio.base_currency = portfolio.base_currency
    db_portfolio.description = portfolio.description
    
    # Handle is_public field (PortfolioUpdate may have None)
    if hasattr(portfolio, 'is_public') and portfolio.is_public is not None:
        db_portfolio.is_public = portfolio.is_public
    
    db.commit()
    db.refresh(db_portfolio)
    
    # Invalidate position cache since portfolio base_currency may have changed
    from app.services.cache import invalidate_positions
    invalidate_positions(portfolio_id)
    
    return db_portfolio


def delete_portfolio(db: Session, portfolio_id: int) -> bool:
    """Delete portfolio"""
    db_portfolio = get_portfolio(db, portfolio_id)
    if not db_portfolio:
        return False
    
    db.delete(db_portfolio)
    db.commit()
    
    # Invalidate position cache
    from app.services.cache import invalidate_positions
    invalidate_positions(portfolio_id)
    
    return True
