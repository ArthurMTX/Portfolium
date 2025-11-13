"""
Portfolio insights and analytics router
"""
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.errors import CannotGetPortfolioInsightsError
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
from app.dependencies import InsightsServiceDep
from app.auth import get_current_user, verify_portfolio_access
from app.models import User, Portfolio

router = APIRouter()


@router.get("/{portfolio_id}", response_model=PortfolioInsights)
async def get_portfolio_insights(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",  # 1m, 3m, 6m, 1y, ytd, all
    benchmark: str = "SPY",  # SPY (S&P 500), QQQ (Nasdaq), IWM (Russell 2000)
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
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
    
    try:
        return await insights_service.get_portfolio_insights(
            portfolio_id=portfolio_id,
            user_id=current_user.id,
            period=period,
            benchmark_symbol=benchmark
        )
    except ValueError as e:
        raise CannotGetPortfolioInsightsError(portfolio_id, str(e))


@router.get("/{portfolio_id}/allocation", response_model=List[AssetAllocation])
async def get_asset_allocation(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get current asset allocation breakdown"""
    return insights_service.get_asset_allocation(portfolio_id)


@router.get("/{portfolio_id}/performance", response_model=PerformanceMetrics)
async def get_performance_metrics(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get performance metrics for specified period"""
    return insights_service.get_performance_metrics(portfolio_id, period)


@router.get("/{portfolio_id}/risk", response_model=RiskMetrics)
async def get_risk_metrics(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get risk analysis metrics"""
    return await insights_service.get_risk_metrics(portfolio_id, period)


@router.get("/{portfolio_id}/benchmark", response_model=BenchmarkComparison)
async def compare_to_benchmark(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    benchmark: str = "SPY",
    period: str = "1y",
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Compare portfolio performance against benchmark"""
    return await insights_service.compare_to_benchmark(portfolio_id, benchmark, period)


@router.get("/{portfolio_id}/top-performers", response_model=List[TopPerformer])
async def get_top_performers(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",
    limit: int = 5,
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get top performing assets in portfolio"""
    return await insights_service.get_top_performers(portfolio_id, period, limit)


@router.get("/{portfolio_id}/average-holding-period")
async def get_average_holding_period(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get average holding period in days for completed positions"""
    avg_days = insights_service.get_average_holding_period(portfolio_id)
    
    return {
        "portfolio_id": portfolio_id,
        "average_holding_period_days": avg_days
    }
