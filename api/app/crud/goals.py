"""
CRUD operations for portfolio goals
"""
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import PortfolioGoal
from app.schemas import PortfolioGoalCreate, PortfolioGoalUpdate


def get_goal(db: Session, goal_id: int) -> Optional[PortfolioGoal]:
    """Get goal by ID"""
    return db.query(PortfolioGoal).filter(PortfolioGoal.id == goal_id).first()


def get_goals_by_portfolio(
    db: Session, 
    portfolio_id: int, 
    active_only: bool = False,
    skip: int = 0, 
    limit: int = 100
) -> List[PortfolioGoal]:
    """Get goals for a specific portfolio"""
    query = db.query(PortfolioGoal).filter(PortfolioGoal.portfolio_id == portfolio_id)
    
    if active_only:
        query = query.filter(PortfolioGoal.is_active == True)
    
    return query.order_by(PortfolioGoal.created_at.desc()).offset(skip).limit(limit).all()


def create_goal(
    db: Session, 
    goal: PortfolioGoalCreate, 
    portfolio_id: int
) -> PortfolioGoal:
    """Create new goal for a portfolio"""
    db_goal = PortfolioGoal(
        portfolio_id=portfolio_id,
        title=goal.title,
        target_amount=goal.target_amount,
        target_date=goal.target_date,
        monthly_contribution=goal.monthly_contribution,
        category=goal.category,
        description=goal.description,
        color=goal.color,
        is_active=goal.is_active,
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal


def update_goal(
    db: Session, 
    goal_id: int, 
    goal: PortfolioGoalUpdate
) -> Optional[PortfolioGoal]:
    """Update existing goal"""
    db_goal = get_goal(db, goal_id)
    if not db_goal:
        return None
    
    # Update only provided fields
    update_data = goal.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_goal, field, value)
    
    db.commit()
    db.refresh(db_goal)
    return db_goal


def delete_goal(db: Session, goal_id: int) -> bool:
    """Delete goal"""
    db_goal = get_goal(db, goal_id)
    if not db_goal:
        return False
    
    db.delete(db_goal)
    db.commit()
    return True


def deactivate_goal(db: Session, goal_id: int) -> Optional[PortfolioGoal]:
    """Soft delete - mark goal as inactive"""
    db_goal = get_goal(db, goal_id)
    if not db_goal:
        return None
    
    db_goal.is_active = False
    db.commit()
    db.refresh(db_goal)
    return db_goal
