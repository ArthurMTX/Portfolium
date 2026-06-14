"""
Portfolio insights and analytics router
"""
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.errors import CannotGetPortfolioInsightsError
from app.db import get_db
from app.schemas import (
    PortfolioInsights,
    PortfolioInsightsSummary,
    AssetAllocation,
    PerformanceMetrics,
    RiskMetrics,
    BenchmarkComparison,
    TimeSeriesPoint,
    TopPerformer,
    SectorAllocation,
    GeographicAllocation,
    ContributionItem,
    PortfolioMoveSummary,
    ConcentrationMetrics,
    ThemeEvolutionPoint,
    PortfolioDNA,
    DuplicateExposureItem,
    HiddenConcentrationItem,
    ScenarioResult,
    PerformanceInsightsDomain,
    AttributionInsights,
    ExposureInsights,
    RiskInsights,
)
from app.dependencies import InsightsServiceDep
from app.auth import get_current_user, verify_portfolio_access
from app.models import User, Portfolio

router = APIRouter()


@router.get("/{portfolio_id}", response_model=PortfolioInsights)
def get_portfolio_insights(
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
        return asyncio.run(
            insights_service.get_portfolio_insights(
                portfolio_id=portfolio_id,
                user_id=current_user.id,
                period=period,
                benchmark_symbol=benchmark
            )
        )
    except ValueError as e:
        raise CannotGetPortfolioInsightsError(portfolio_id, str(e))


@router.get("/{portfolio_id}/summary", response_model=PortfolioInsightsSummary)
async def get_portfolio_summary(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get small portfolio summary metrics for progressive insights loading."""
    _ = portfolio
    return await insights_service.get_portfolio_summary(portfolio_id, period)


@router.get("/{portfolio_id}/performance/overview", response_model=PerformanceInsightsDomain)
async def get_performance_insights_domain(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get performance-tab data from a shared snapshot and cached historical metrics."""
    _ = portfolio
    return await insights_service.get_performance_domain(portfolio_id, period)


@router.get("/{portfolio_id}/attribution", response_model=AttributionInsights)
async def get_attribution_insights_domain(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get attribution-tab data from one shared deterministic snapshot."""
    _ = portfolio
    return await insights_service.get_attribution_domain(portfolio_id, current_user.id)


@router.get("/{portfolio_id}/exposure", response_model=ExposureInsights)
async def get_exposure_insights_domain(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get exposure-tab data from one shared deterministic snapshot."""
    _ = portfolio
    return await insights_service.get_exposure_domain(portfolio_id, current_user.id, period)


@router.get("/{portfolio_id}/risk/overview", response_model=RiskInsights)
async def get_risk_insights_domain(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    benchmark: str = "SPY",
    period: str = "1y",
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get risk-tab data from one shared deterministic snapshot and cached risk metrics."""
    _ = portfolio
    return await insights_service.get_risk_domain(portfolio_id, current_user.id, period, benchmark)


@router.get("/{portfolio_id}/allocation", response_model=List[AssetAllocation])
async def get_asset_allocation(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get current asset allocation breakdown"""
    return await insights_service.get_asset_allocation(portfolio_id)


@router.get("/{portfolio_id}/attribution/move", response_model=PortfolioMoveSummary)
async def get_portfolio_move_summary(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    limit: int = 8,
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Explain daily portfolio movement from deterministic position data."""
    _ = portfolio
    return await insights_service.get_portfolio_move_summary(portfolio_id, limit=limit)


@router.get("/{portfolio_id}/attribution/assets", response_model=List[ContributionItem])
async def get_asset_contributions(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    limit: int = 10,
    ascending: bool = False,
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get deterministic asset-level contribution rows."""
    _ = portfolio
    return await insights_service.get_asset_contributions(portfolio_id, limit=limit, ascending=ascending)


@router.get("/{portfolio_id}/attribution/themes", response_model=List[ContributionItem])
async def get_theme_contribution(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get deterministic contribution by investment theme."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "theme")


@router.get("/{portfolio_id}/attribution/sectors", response_model=List[ContributionItem])
async def get_sector_contribution(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get deterministic contribution by sector."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "sector")


@router.get("/{portfolio_id}/attribution/countries", response_model=List[ContributionItem])
async def get_country_contribution(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get deterministic contribution by country."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "country")


@router.get("/{portfolio_id}/attribution/currencies", response_model=List[ContributionItem])
async def get_currency_contribution(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get deterministic contribution by currency."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "currency")


@router.get("/{portfolio_id}/attribution/concentration", response_model=ConcentrationMetrics)
async def get_attribution_concentration(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get concentration metrics used by attribution diagnostics."""
    _ = portfolio
    return await insights_service.get_concentration_metrics(portfolio_id)


@router.get("/{portfolio_id}/exposure/themes", response_model=List[ContributionItem])
async def get_theme_exposure(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get market-value exposure by investment theme."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "theme")


@router.get("/{portfolio_id}/exposure/sectors", response_model=List[ContributionItem])
async def get_sector_exposure(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get market-value exposure by sector."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "sector")


@router.get("/{portfolio_id}/exposure/countries", response_model=List[ContributionItem])
async def get_country_exposure(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get market-value exposure by country."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "country")


@router.get("/{portfolio_id}/exposure/currencies", response_model=List[ContributionItem])
async def get_currency_exposure(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get market-value exposure by currency."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "currency")


@router.get("/{portfolio_id}/exposure/market-caps", response_model=List[ContributionItem])
async def get_market_cap_exposure(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get market-cap exposure from stored data; currently unclassified when market cap is unavailable."""
    _ = portfolio
    return await insights_service.get_group_contribution(portfolio_id, current_user.id, "market_cap")


@router.get("/{portfolio_id}/exposure/duplicates", response_model=List[DuplicateExposureItem])
async def get_duplicate_exposure(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get repeated high-weight exposures across deterministic groups."""
    _ = portfolio
    return await insights_service.get_duplicate_exposure(portfolio_id, current_user.id)


@router.get("/{portfolio_id}/exposure/hidden-concentration", response_model=List[HiddenConcentrationItem])
async def get_hidden_concentration(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get high-weight grouped exposures that may not be obvious from asset rows."""
    _ = portfolio
    return await insights_service.get_hidden_concentration(portfolio_id, current_user.id)


@router.get("/{portfolio_id}/exposure/theme-evolution", response_model=List[ThemeEvolutionPoint])
async def get_theme_evolution(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    period: str = "1y",
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get deterministic theme exposure snapshots over time."""
    _ = portfolio
    return await insights_service.get_theme_evolution(portfolio_id, period)


@router.get("/{portfolio_id}/exposure/dna", response_model=PortfolioDNA)
async def get_portfolio_dna(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Get deterministic portfolio style traits."""
    _ = portfolio
    return await insights_service.get_portfolio_dna(portfolio_id, current_user.id)


@router.get("/{portfolio_id}/risk/scenarios", response_model=List[ScenarioResult])
async def get_scenario_analysis(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Simulate predefined deterministic market events."""
    _ = portfolio
    return await insights_service.get_scenario_analysis(portfolio_id, current_user.id)


@router.get("/{portfolio_id}/risk/stress-tests", response_model=List[ScenarioResult])
async def get_stress_tests(
    portfolio_id: int,
    insights_service: InsightsServiceDep,
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(verify_portfolio_access)
):
    """Run deterministic concentration stress tests."""
    _ = portfolio
    return await insights_service.get_stress_tests(portfolio_id, current_user.id)


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
