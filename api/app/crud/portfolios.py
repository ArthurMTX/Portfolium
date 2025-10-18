"""
CRUD operations for portfolios
"""
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import Portfolio
from app.schemas import PortfolioCreate


def get_portfolio(db: Session, portfolio_id: int) -> Optional[Portfolio]:
    """Get portfolio by ID"""
    return db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()


def get_portfolio_by_name(db: Session, name: str) -> Optional[Portfolio]:
    """Get portfolio by name"""
    return db.query(Portfolio).filter(Portfolio.name == name).first()


def get_portfolios(db: Session, skip: int = 0, limit: int = 100) -> List[Portfolio]:
    """Get list of portfolios"""
    return db.query(Portfolio).offset(skip).limit(limit).all()


def create_portfolio(db: Session, portfolio: PortfolioCreate) -> Portfolio:
    """Create new portfolio"""
    db_portfolio = Portfolio(
        name=portfolio.name,
        base_currency=portfolio.base_currency,
        description=portfolio.description
    )
    db.add(db_portfolio)
    db.commit()
    db.refresh(db_portfolio)
    return db_portfolio


def update_portfolio(
    db: Session, 
    portfolio_id: int, 
    portfolio: PortfolioCreate
) -> Optional[Portfolio]:
    """Update existing portfolio"""
    db_portfolio = get_portfolio(db, portfolio_id)
    if not db_portfolio:
        return None
    
    db_portfolio.name = portfolio.name
    db_portfolio.base_currency = portfolio.base_currency
    db_portfolio.description = portfolio.description
    
    db.commit()
    db.refresh(db_portfolio)
    return db_portfolio


def delete_portfolio(db: Session, portfolio_id: int) -> bool:
    """Delete portfolio"""
    db_portfolio = get_portfolio(db, portfolio_id)
    if not db_portfolio:
        return False
    
    db.delete(db_portfolio)
    db.commit()
    return True
