"""
Portfolio insights and analytics router
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db import get_db
from app.schemas import (
    PortfolioInsights,
    AssetAllocation,
    PerformanceMetrics,
    RiskMetrics,
    BenchmarkComparison,
    TimeSeriesPoint,
    TopPerformer,
    SectorAllocation,
    GeographicAllocation
)
from app.services.insights import InsightsService
from app.auth import get_current_user
from app.models import User
from app.crud import portfolios as crud

router = APIRouter()


@router.get("/{portfolio_id}", response_model=PortfolioInsights)
async def get_portfolio_insights(
    portfolio_id: int,
    period: str = "1y",  # 1m, 3m, 6m, 1y, ytd, all
    benchmark: str = "SPY",  # SPY (S&P 500), QQQ (Nasdaq), IWM (Russell 2000)
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive portfolio insights including:
    - Asset allocation
    - Performance metrics
    - Risk analysis
    - Benchmark comparison
    - Top performers
    - Sector allocation
    """
    # Verify portfolio access
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio {portfolio_id} not found"
        )
    if portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this portfolio"
        )
    
    insights_service = InsightsService(db)
    
    try:
        return await insights_service.get_portfolio_insights(
            portfolio_id=portfolio_id,
            user_id=current_user.id,
            period=period,
            benchmark_symbol=benchmark
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{portfolio_id}/allocation", response_model=List[AssetAllocation])
async def get_asset_allocation(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current asset allocation breakdown"""
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if portfolio.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    insights_service = InsightsService(db)
    return insights_service.get_asset_allocation(portfolio_id)


@router.get("/{portfolio_id}/performance", response_model=PerformanceMetrics)
async def get_performance_metrics(
    portfolio_id: int,
    period: str = "1y",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get performance metrics for specified period"""
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if portfolio.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    insights_service = InsightsService(db)
    return insights_service.get_performance_metrics(portfolio_id, period)


@router.get("/{portfolio_id}/risk", response_model=RiskMetrics)
async def get_risk_metrics(
    portfolio_id: int,
    period: str = "1y",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get risk analysis metrics"""
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if portfolio.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    insights_service = InsightsService(db)
    return insights_service.get_risk_metrics(portfolio_id, period)


@router.get("/{portfolio_id}/benchmark", response_model=BenchmarkComparison)
async def compare_to_benchmark(
    portfolio_id: int,
    benchmark: str = "SPY",
    period: str = "1y",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Compare portfolio performance against benchmark"""
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if portfolio.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    insights_service = InsightsService(db)
    return insights_service.compare_to_benchmark(portfolio_id, benchmark, period)


@router.get("/{portfolio_id}/top-performers", response_model=List[TopPerformer])
async def get_top_performers(
    portfolio_id: int,
    period: str = "1y",
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get top performing assets in portfolio"""
    portfolio = crud.get_portfolio(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if portfolio.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    insights_service = InsightsService(db)
    return insights_service.get_top_performers(portfolio_id, period, limit)
