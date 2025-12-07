"""
Portfolio Goals router
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import PortfolioGoal, PortfolioGoalCreate, PortfolioGoalUpdate
from app.crud import goals as crud
from app.auth import get_current_user, verify_portfolio_access
from app.models import User, Portfolio
from app.services.goal_projections import GoalProjectionsService, GoalProjectionResult

router = APIRouter()


@router.get("/portfolios/{portfolio_id}/goals", response_model=List[PortfolioGoal], tags=["goals"])
async def get_portfolio_goals(
    portfolio_id: int,
    active_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """
    Get all goals for a portfolio
    
    - **active_only**: Filter to only active goals
    - **skip**: Number of goals to skip (pagination)
    - **limit**: Maximum number of goals to return
    """
    return crud.get_goals_by_portfolio(
        db, 
        portfolio_id=portfolio_id, 
        active_only=active_only,
        skip=skip, 
        limit=limit
    )


@router.get("/portfolios/{portfolio_id}/goals/{goal_id}", response_model=PortfolioGoal, tags=["goals"])
async def get_goal(
    portfolio_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get a specific goal by ID"""
    goal = crud.get_goal(db, goal_id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Goal with id {goal_id} not found"
        )
    
    # Verify goal belongs to the portfolio
    if goal.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Goal does not belong to this portfolio"
        )
    
    return goal


@router.post("/portfolios/{portfolio_id}/goals", response_model=PortfolioGoal, status_code=status.HTTP_201_CREATED, tags=["goals"])
async def create_goal(
    portfolio_id: int,
    goal: PortfolioGoalCreate,
    db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """
    Create a new goal for a portfolio
    
    - **title**: Goal title (required)
    - **target_amount**: Target amount to reach (required, must be positive)
    - **target_date**: Optional target date
    - **monthly_contribution**: Expected monthly contribution (default: 0)
    - **category**: Goal category (retirement, house, education, vacation, emergency, other)
    - **description**: Optional description
    - **color**: Optional color for UI
    - **is_active**: Whether goal is active (default: true)
    """
    return crud.create_goal(db, goal=goal, portfolio_id=portfolio_id)


@router.put("/portfolios/{portfolio_id}/goals/{goal_id}", response_model=PortfolioGoal, tags=["goals"])
async def update_goal(
    portfolio_id: int,
    goal_id: int,
    goal_data: PortfolioGoalUpdate,
    db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """
    Update an existing goal
    
    Only provided fields will be updated. All fields are optional.
    
    Note: If target_date is set to a past date, projections will show immediate timeline.
    The frontend should handle this case and display appropriate warnings to the user.
    """
    # Verify goal exists and belongs to portfolio
    existing_goal = crud.get_goal(db, goal_id)
    if not existing_goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Goal with id {goal_id} not found"
        )
    
    if existing_goal.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Goal does not belong to this portfolio"
        )
    
    # Validate target_date if provided
    if goal_data.target_date is not None:
        from datetime import datetime
        try:
            target_dt = datetime.fromisoformat(str(goal_data.target_date))
            if target_dt < datetime.utcnow():
                # Log warning but allow the update - projections will handle it
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Goal {goal_id} updated with past target_date: {goal_data.target_date}"
                )
        except Exception:
            pass  # Let validation happen elsewhere
    
    updated_goal = crud.update_goal(db, goal_id=goal_id, goal=goal_data)
    return updated_goal


@router.delete("/portfolios/{portfolio_id}/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["goals"])
async def delete_goal(
    portfolio_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """
    Delete a goal permanently
    
    This will permanently remove the goal from the database.
    Consider using PATCH with is_active=false for soft deletion.
    """
    # Verify goal exists and belongs to portfolio
    existing_goal = crud.get_goal(db, goal_id)
    if not existing_goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Goal with id {goal_id} not found"
        )
    
    if existing_goal.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Goal does not belong to this portfolio"
        )
    
    success = crud.delete_goal(db, goal_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete goal"
        )


@router.patch("/portfolios/{portfolio_id}/goals/{goal_id}/deactivate", response_model=PortfolioGoal, tags=["goals"])
async def deactivate_goal(
    portfolio_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """
    Soft delete - mark goal as inactive
    
    This preserves the goal data but marks it as inactive.
    Useful for maintaining historical records.
    """
    # Verify goal exists and belongs to portfolio
    existing_goal = crud.get_goal(db, goal_id)
    if not existing_goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Goal with id {goal_id} not found"
        )
    
    if existing_goal.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Goal does not belong to this portfolio"
        )
    
    return crud.deactivate_goal(db, goal_id)


@router.post("/portfolios/{portfolio_id}/goals/{goal_id}/projections", response_model=GoalProjectionResult, tags=["goals"])
async def calculate_goal_projections(
    portfolio_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """
    Calculate goal projections using Monte Carlo simulation.
    
    Returns GoalProjectionResult with:
    - **scenarios**: Three quantile-based scenarios (pessimistic=10th, median=50th, optimistic=90th percentile)
    - **milestones**: Progress milestones (25%, 50%, 75%, 100%)
    - **probability**: Overall probability of achieving goal (0.0 to 1.0)
    - **historical_performance**: Portfolio's historical annual return and volatility
    
    The calculations use:
    - Mark-to-market portfolio time series from transaction history
    - Monte Carlo simulation with 1,000 iterations
    - Box-Muller transform for normal distribution of returns
    - Quantile-based scenarios instead of deterministic ±volatility
    """
    # Verify goal exists and belongs to portfolio
    goal = crud.get_goal(db, goal_id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Goal with id {goal_id} not found"
        )
    
    if goal.portfolio_id != portfolio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Goal does not belong to this portfolio"
        )
    
    # Get current portfolio value by calculating from positions
    from app.services.metrics import MetricsService
    metrics_service = MetricsService(db)
    
    try:
        # Get portfolio metrics which includes total_value
        import asyncio
        metrics = await metrics_service.get_metrics(portfolio_id)
        current_value = float(metrics.total_value)
    except Exception as e:
        # If metrics fail, calculate from positions directly
        from decimal import Decimal
        current_value = 0.0
        
        # Get all positions and sum their market values
        positions = await metrics_service.get_positions(portfolio_id, include_sold=False)
        for position in positions:
            if position.market_value:
                current_value += float(position.market_value)
    
    # Calculate projections
    service = GoalProjectionsService(db)
    projections = service.calculate_goal_projections(
        portfolio_id=portfolio_id,
        current_value=current_value,
        target_amount=float(goal.target_amount),
        monthly_contribution=float(goal.monthly_contribution),
        target_date=goal.target_date
    )
    
    return projections
