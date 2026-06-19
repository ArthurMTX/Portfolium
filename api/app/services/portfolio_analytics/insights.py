"""
Portfolio insights and analytics service
"""
import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, List, Dict, Optional, Tuple
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import math

from app.models import Transaction, Asset, TransactionType
from app.services.platform.analytics_cache import get_cached_analytics
from app.services.platform.cache import CacheService
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
    PortfolioDNATrait,
    DuplicateExposureItem,
    HiddenConcentrationItem,
    ScenarioResult,
    PerformanceInsightsDomain,
    AttributionInsights,
    ExposureInsights,
    RiskInsights,
)
from app.services.portfolio_analytics.metrics import MetricsService
from app.services.market_data.pricing import PricingService
from app.crud import portfolios as crud_portfolios
from app.crud import prices as crud_prices

logger = logging.getLogger(__name__)


@dataclass
class PortfolioInsightsSnapshot:
    """Shared base data for domain-level Insights calculations."""
    portfolio_id: int
    user_id: Optional[int]
    portfolio: Any
    positions: List[Any]
    total_value: Decimal
    total_cost: Decimal
    asset_map: Dict[int, Asset]
    effective_metadata: Dict[int, Dict[str, Any]]


class InsightsService:
    """Service for portfolio insights and analytics"""
    
    def __init__(self, db: Session):
        self.db = db
        self.metrics_service = MetricsService(db)
        self.pricing_service = PricingService(db)
        self._risk_cache: Dict[Tuple[int, str], Tuple[datetime, RiskMetrics]] = {}
    
    def _percentile(self, values: List[float], q: float) -> float:
        """
        Calculate the q-th percentile of the values using linear interpolation.
        values: list of floats (will be sorted internally)
        q: percentile in [0, 1]
        """
        if not values:
            return 0.0
        
        sorted_values = sorted(values)
        n = len(sorted_values)
        position = q * (n - 1)
        lower_idx = math.floor(position)
        upper_idx = math.ceil(position)
        
        if lower_idx == upper_idx:
            return sorted_values[int(lower_idx)]
        
        lower_val = sorted_values[int(lower_idx)]
        upper_val = sorted_values[int(upper_idx)]
        
        return lower_val + (position - lower_idx) * (upper_val - lower_val)

    def _get_cache_key(self, portfolio_id: int, period: str, benchmark_symbol: str) -> str:
        """Generate cache key for insights"""
        return f"{CacheService.PREFIX_INSIGHTS}{portfolio_id}:{period}:{benchmark_symbol}"
    
    def _get_cached_insights(self, cache_key: str) -> Optional[PortfolioInsights]:
        """Get insights from Redis cache if available"""
        cached = CacheService.get(cache_key)
        if cached:
            logger.info("Returning cached insights from Redis")
            return PortfolioInsights(**cached)
        return None
    
    def _cache_insights(self, cache_key: str, insights: PortfolioInsights) -> None:
        """Store insights in Redis cache"""
        CacheService.set(cache_key, insights.model_dump(), CacheService.TTL_INSIGHTS)
    
    async def get_portfolio_insights(
        self,
        portfolio_id: int,
        user_id: int,
        period: str = "1y",
        benchmark_symbol: str = "SPY"
    ) -> PortfolioInsights:
        """Get comprehensive portfolio insights with user-specific metadata overrides"""
        # Check cache first
        cache_key = self._get_cache_key(portfolio_id, period, benchmark_symbol)
        cached_insights = self._get_cached_insights(cache_key)
        if cached_insights:
            return cached_insights
        
        logger.info(f"Computing fresh insights for portfolio {portfolio_id}, period {period}, benchmark {benchmark_symbol}")
        
        portfolio = crud_portfolios.get_portfolio(self.db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")
        
        # Get current positions (async)
        positions = await self.metrics_service.get_positions(portfolio_id)
        
        if not positions:
            raise ValueError("No positions found in portfolio. Please add transactions to see insights.")
        
        # Calculate allocations (now async, with user-specific overrides)
        asset_allocation = await self.get_asset_allocation(portfolio_id)
        sector_allocation = await self.get_sector_allocation(portfolio_id, user_id)
        geographic_allocation = await self.get_geographic_allocation(portfolio_id, user_id)
        
        # Calculate performance metrics
        try:
            performance = self.get_performance_metrics(portfolio_id, period)
        except Exception as e:
            logger.warning(f"Failed to calculate performance metrics: {e}")
            performance = self._empty_performance_metrics(period)
        
        # Calculate risk metrics
        try:
            risk = await self.get_risk_metrics(portfolio_id, period)
        except Exception as e:
            logger.warning(f"Failed to calculate risk metrics: {e}")
            risk = self._empty_risk_metrics(period)
        
        # Benchmark comparison
        try:
            benchmark_comparison = await self.compare_to_benchmark(
                portfolio_id, benchmark_symbol, period
            )
            if benchmark_comparison is None:
                raise ValueError("Benchmark comparison returned no result")
        except Exception as e:
            logger.warning(f"Failed to compare to benchmark: {e}")
            # Create minimal benchmark comparison
            benchmark_comparison = BenchmarkComparison(
                benchmark_symbol=benchmark_symbol,
                benchmark_name=benchmark_symbol,
                period=period,
                portfolio_return=Decimal(0),
                benchmark_return=Decimal(0),
                alpha=Decimal(0),
                portfolio_series=[],
                benchmark_series=[],
                correlation=None
            )
        
        # Top and worst performers
        top_performers = await self.get_top_performers(portfolio_id, period, limit=5)
        worst_performers = await self.get_top_performers(
            portfolio_id, period, limit=5, ascending=True
        )
        
        # Calculate total metrics
        total_value = sum(p.market_value for p in positions if p.market_value)
        total_cost = sum(p.cost_basis for p in positions)
        total_return = total_value - total_cost
        total_return_pct = (
            (total_return / total_cost * 100) if total_cost > 0 else Decimal(0)
        )
        
        # Diversification score (based on number of positions and allocation spread)
        diversification_score = self._calculate_diversification_score(asset_allocation)
        
        insights = PortfolioInsights(
            portfolio_id=portfolio_id,
            portfolio_name=portfolio.name,
            as_of_date=datetime.utcnow(),
            period=period,
            asset_allocation=asset_allocation,
            sector_allocation=sector_allocation,
            geographic_allocation=geographic_allocation,
            performance=performance,
            risk=risk,
            benchmark_comparison=benchmark_comparison,
            top_performers=top_performers,
            worst_performers=worst_performers,
            total_value=total_value,
            total_cost=total_cost,
            total_return=total_return,
            total_return_pct=total_return_pct,
            diversification_score=diversification_score
        )
        
        # Cache the result
        self._cache_insights(cache_key, insights)
        
        return insights
    
    async def get_asset_allocation(self, portfolio_id: int) -> List[AssetAllocation]:
        """Get current asset allocation breakdown"""
        positions = await self.metrics_service.get_positions(portfolio_id)
        
        total_value = sum(
            p.market_value for p in positions if p.market_value
        ) or Decimal(1)
        
        allocations = []
        for pos in positions:
            if pos.market_value:
                percentage = (pos.market_value / total_value * 100)
                allocations.append(AssetAllocation(
                    symbol=pos.symbol,
                    name=pos.name,
                    percentage=percentage,
                    value=pos.market_value,
                    quantity=pos.quantity,
                    asset_type=pos.asset_type
                ))
        
        # Sort by value descending
        allocations.sort(key=lambda x: x.value, reverse=True)
        return allocations
    
    async def get_sector_allocation(self, portfolio_id: int, user_id: int) -> List[SectorAllocation]:
        """Get sector allocation breakdown with user-specific metadata overrides"""
        from app.crud import assets as crud_assets
        
        positions = await self.metrics_service.get_positions(portfolio_id)
        
        sector_data: Dict[str, Dict] = {}
        total_value = Decimal(0)
        
        for pos in positions:
            if not pos.market_value:
                continue
            
            # Get asset details
            asset = self.db.query(Asset).filter(Asset.id == pos.asset_id).first()
            if not asset:
                continue
                
            # Get user-specific effective metadata
            effective_data = crud_assets.get_effective_asset_metadata(self.db, asset, user_id)
            sector = effective_data["effective_sector"] or "Unknown"
            
            if sector not in sector_data:
                sector_data[sector] = {"value": Decimal(0), "count": 0}
            
            sector_data[sector]["value"] += pos.market_value
            sector_data[sector]["count"] += 1
            total_value += pos.market_value
        
        allocations = []
        for sector, data in sector_data.items():
            percentage = (
                (data["value"] / total_value * 100) if total_value > 0 else Decimal(0)
            )
            allocations.append(SectorAllocation(
                sector=sector,
                percentage=percentage,
                value=data["value"],
                count=data["count"]
            ))
        
        allocations.sort(key=lambda x: x.value, reverse=True)
        return allocations
    
    async def get_geographic_allocation(self, portfolio_id: int, user_id: int) -> List[GeographicAllocation]:
        """Get geographic allocation breakdown with user-specific metadata overrides"""
        from app.crud import assets as crud_assets
        
        positions = await self.metrics_service.get_positions(portfolio_id)
        
        country_data: Dict[str, Dict] = {}
        total_value = Decimal(0)
        
        for pos in positions:
            if not pos.market_value:
                continue
            
            # Get asset details
            asset = self.db.query(Asset).filter(Asset.id == pos.asset_id).first()
            if not asset:
                continue
                
            # Get user-specific effective metadata
            effective_data = crud_assets.get_effective_asset_metadata(self.db, asset, user_id)
            country = effective_data["effective_country"] or "Unknown"
            
            if country not in country_data:
                country_data[country] = {"value": Decimal(0), "count": 0}
            
            country_data[country]["value"] += pos.market_value
            country_data[country]["count"] += 1
            total_value += pos.market_value
        
        allocations = []
        for country, data in country_data.items():
            percentage = (
                (data["value"] / total_value * 100) if total_value > 0 else Decimal(0)
            )
            allocations.append(GeographicAllocation(
                country=country,
                percentage=percentage,
                value=data["value"],
                count=data["count"]
            ))
        
        allocations.sort(key=lambda x: x.value, reverse=True)
        return allocations
    
    def get_performance_metrics(
        self,
        portfolio_id: int,
        period: str
    ) -> PerformanceMetrics:
        """Calculate performance metrics for specified period based on market performance only"""
        # Get historical values with invested amounts
        start_date, end_date = self._get_date_range(period, portfolio_id)
        performance_data = self._get_daily_portfolio_performance(
            portfolio_id, start_date, end_date
        )
        
        if not performance_data:
            return self._empty_performance_metrics(period)
        
        start_date_actual, start_value, start_invested = performance_data[0]
        end_date_actual, end_value, end_invested = performance_data[-1]
        
        # Calculate returns based on invested amount (market performance)
        total_return = end_value - end_invested
        total_return_pct = (
            (total_return / end_invested * 100) if end_invested > 0 else Decimal(0)
        )
        
        # Annualized return based on performance percentage
        days = (end_date - start_date).days
        years = days / 365.25
        
        # Calculate annualized return from the performance percentage
        if end_invested > 0 and years > 0:
            total_return_multiplier = float(end_value / end_invested)
            annualized_return = (pow(total_return_multiplier, 1 / years) - 1) * 100
        else:
            annualized_return = 0
        
        # Daily performance returns (market-driven only)
        # Calculate performance % for each day: (value - invested) / invested * 100
        daily_performance_pcts = []
        for i in range(len(performance_data)):
            curr_date, curr_value, curr_invested = performance_data[i]
            if curr_invested > 0:
                perf_pct = (curr_value - curr_invested) / curr_invested * 100
                daily_performance_pcts.append((curr_date, perf_pct))
        
        # Calculate daily performance changes (day-to-day performance difference)
        # This shows how much the performance % changed each day
        daily_perf_changes = []
        for i in range(1, len(daily_performance_pcts)):
            prev_date, prev_perf = daily_performance_pcts[i-1]
            curr_date, curr_perf = daily_performance_pcts[i]
            perf_change = curr_perf - prev_perf  # Change in performance percentage
            daily_perf_changes.append((curr_date, perf_change))
        
        # Best and worst days based on performance changes
        best_day = None
        best_day_date = None
        worst_day = None
        worst_day_date = None
        positive_days = 0
        negative_days = 0
        
        if daily_perf_changes:
            sorted_changes = sorted(daily_perf_changes, key=lambda x: x[1], reverse=True)
            best_day = sorted_changes[0][1]
            best_day_date = sorted_changes[0][0].isoformat()
            worst_day = sorted_changes[-1][1]
            worst_day_date = sorted_changes[-1][0].isoformat()
            
            positive_days = sum(1 for _, change in daily_perf_changes if change > 0)
            negative_days = sum(1 for _, change in daily_perf_changes if change < 0)
        
        win_rate = (
            (Decimal(positive_days) / len(daily_perf_changes) * 100)
            if daily_perf_changes else Decimal(0)
        )
        
        # Get invested/withdrawn amounts for the period
        total_invested, total_withdrawn = self._calculate_cash_flows(
            portfolio_id, start_date, end_date
        )
        
        return PerformanceMetrics(
            period=period,
            total_return=total_return,
            total_return_pct=total_return_pct,
            annualized_return=Decimal(str(annualized_return)),
            start_value=start_value,
            end_value=end_value,
            total_invested=total_invested,
            total_withdrawn=total_withdrawn,
            best_day=best_day,
            best_day_date=best_day_date,
            worst_day=worst_day,
            worst_day_date=worst_day_date,
            positive_days=positive_days,
            negative_days=negative_days,
            win_rate=win_rate
        )
    
    async def get_risk_metrics(
        self,
        portfolio_id: int,
        period: str,
        positions: Optional[List[Any]] = None,
    ) -> RiskMetrics:
        """Calculate risk metrics with smart caching"""
        # Current positions are used only for the analytics-cache fingerprint.
        if positions is None:
            positions = await self.metrics_service.get_positions(portfolio_id)
        
        # Get last transaction date
        last_txn = self.db.query(func.max(Transaction.tx_date)).filter(
            Transaction.portfolio_id == portfolio_id
        ).scalar()
        last_txn_str = last_txn.isoformat() if last_txn else None
        
        # Use smart cache
        def calculator():
            return self._calculate_risk_metrics(portfolio_id, period)
        
        return get_cached_analytics(
            cache_key=f'risk_metrics_{period}',
            portfolio_id=portfolio_id,
            positions=positions,
            last_transaction_date=last_txn_str,
            calculator=calculator
        )
    
    def _calculate_risk_metrics(self, portfolio_id: int, period: str) -> RiskMetrics:
        """Internal method to calculate risk metrics (called only on cache miss)"""
        # Check in-memory cache
        cache_key = (portfolio_id, period)
        if cache_key in self._risk_cache:
            cached_at, cached_metrics = self._risk_cache[cache_key]
            if datetime.utcnow() - cached_at < timedelta(hours=1):
                return cached_metrics

        start_date, end_date = self._get_date_range(period, portfolio_id)
        
        # Use performance data which includes invested amount to handle cash flows
        performance_data = self._get_daily_portfolio_performance(
            portfolio_id, start_date, end_date
        )
        
        if len(performance_data) < 2:
            return self._empty_risk_metrics(period)
        
        # Calculate daily returns adjusting for cash flows (Time-Weighted Return)
        daily_returns = []
        equity_curve = [1.0]  # Start at 1.0 for drawdown calculation
        
        for i in range(1, len(performance_data)):
            prev_date, prev_value, prev_invested = performance_data[i-1]
            curr_date, curr_value, curr_invested = performance_data[i]
            
            # Convert to float for calculations
            prev_val_f = float(prev_value)
            curr_val_f = float(curr_value)
            prev_inv_f = float(prev_invested)
            curr_inv_f = float(curr_invested)
            
            # Calculate net flow (deposit/withdrawal)
            flow = curr_inv_f - prev_inv_f
            
            # Adjusted return: (Value_t - Flow_t - Value_{t-1}) / Value_{t-1}
            # We assume flows happen at the end of the day for this calculation
            if prev_val_f > 0:
                ret = (curr_val_f - flow - prev_val_f) / prev_val_f
                daily_returns.append(ret)
            else:
                daily_returns.append(0.0)
                
            # Update equity curve
            equity_curve.append(equity_curve[-1] * (1 + daily_returns[-1]))
        
        if not daily_returns:
            return self._empty_risk_metrics(period)
        
        # Volatility (annualized standard deviation)
        mean_return = sum(daily_returns) / len(daily_returns)
        variance = sum((r - mean_return) ** 2 for r in daily_returns) / len(daily_returns)
        daily_volatility = math.sqrt(variance)
        annualized_volatility = daily_volatility * math.sqrt(252)  # Trading days
        
        # Calculate annualized return (CAGR) from the equity curve
        # Total return over period = Equity_final - 1
        total_period_return = equity_curve[-1] - 1
        
        days_diff = (performance_data[-1][0] - performance_data[0][0]).days
        years = days_diff / 365.25
        
        if years > 0:
            # Geometric annualized return
            annualized_return = (equity_curve[-1]) ** (1 / years) - 1
        else:
            annualized_return = total_period_return

        risk_free_rate = 0.02  # 2%
        excess_annual_return = annualized_return - risk_free_rate
        sharpe_ratio = (
            excess_annual_return / annualized_volatility
            if annualized_volatility > 0 else None
        )
        
        # Maximum drawdown based on Equity Curve (not raw values)
        peak = equity_curve[0]
        max_drawdown = 0
        max_drawdown_date = None

        # We need to zip with dates. equity_curve has N items, performance_data has N items.
        for i, value in enumerate(equity_curve):
            date_val = performance_data[i][0]
            
            if value > peak:
                peak = value
            
            drawdown = (peak - value) / peak
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                max_drawdown_date = date_val.isoformat()

        max_drawdown *= 100
        
        # Downside deviation (volatility of negative returns)
        negative_returns = [r for r in daily_returns if r < 0]
        downside_variance = (
            sum(r ** 2 for r in negative_returns) / len(negative_returns)
            if negative_returns else 0
        )
        downside_deviation = math.sqrt(downside_variance) * math.sqrt(252)
        
        # Value at Risk (95% confidence) using percentile helper
        var_95_val = self._percentile(daily_returns, 0.05)
        var_95 = Decimal(str(-var_95_val * 100))
        
        # VaR 99%
        var_99_val = self._percentile(daily_returns, 0.01)
        var_99 = Decimal(str(-var_99_val * 100))
        
        # CVaR / Expected Shortfall (95%)
        cvar_95_returns = [r for r in daily_returns if r <= var_95_val]
        cvar_95_val = sum(cvar_95_returns) / len(cvar_95_returns) if cvar_95_returns else var_95_val
        cvar_95 = Decimal(str(-cvar_95_val * 100))
        
        # CVaR / Expected Shortfall (99%)
        cvar_99_returns = [r for r in daily_returns if r <= var_99_val]
        cvar_99_val = sum(cvar_99_returns) / len(cvar_99_returns) if cvar_99_returns else var_99_val
        cvar_99 = Decimal(str(-cvar_99_val * 100))
        
        # Time-scaled VaR
        var_95_1w = Decimal(str(-var_95_val * math.sqrt(5) * 100))
        var_95_1m = Decimal(str(-var_95_val * math.sqrt(21) * 100))
        
        # Tail Exposure
        tail_cutoff = mean_return - (3 * daily_volatility)
        tail_events = [r for r in daily_returns if r < tail_cutoff]
        tail_exposure = Decimal(str((len(tail_events) / len(daily_returns)) * 100)) if daily_returns else Decimal(0)
        
        # Beta calculation
        # Reconstruct daily_values for beta calculation compatibility
        daily_values = [(d, v) for d, v, _ in performance_data]
        beta = self._calculate_beta(portfolio_id, start_date, end_date, daily_returns, daily_values)
        
        metrics = RiskMetrics(
            period=period,
            volatility=Decimal(str(annualized_volatility * 100)),
            sharpe_ratio=Decimal(str(sharpe_ratio)) if sharpe_ratio is not None else None,
            max_drawdown=Decimal(str(max_drawdown)),
            max_drawdown_date=max_drawdown_date,
            beta=beta,
            var_95=var_95,
            var_99=var_99,
            cvar_95=cvar_95,
            cvar_99=cvar_99,
            var_95_1w=var_95_1w,
            var_95_1m=var_95_1m,
            tail_exposure=tail_exposure,
            downside_deviation=Decimal(str(downside_deviation * 100))
        )
        
        # Update cache
        self._risk_cache[cache_key] = (datetime.utcnow(), metrics)
        
        return metrics
    
    async def compare_to_benchmark(
        self, 
        portfolio_id: int, 
        benchmark_symbol: str, 
        period: str,
        positions: Optional[List[Any]] = None,
    ) -> BenchmarkComparison:
        """Compare portfolio performance to benchmark with smart caching"""
        # Current positions are used only for the analytics-cache fingerprint.
        if positions is None:
            positions = await self.metrics_service.get_positions(portfolio_id)
        
        # Get last transaction date
        last_txn = self.db.query(func.max(Transaction.tx_date)).filter(
            Transaction.portfolio_id == portfolio_id
        ).scalar()
        last_txn_str = last_txn.isoformat() if last_txn else None
        
        # Use smart cache
        def calculator():
            return self._calculate_benchmark_comparison(portfolio_id, benchmark_symbol, period)
        
        return get_cached_analytics(
            cache_key=f'benchmark_{benchmark_symbol}_{period}',
            portfolio_id=portfolio_id,
            positions=positions,
            last_transaction_date=last_txn_str,
            calculator=calculator
        )
    
    def _calculate_benchmark_comparison(
        self, 
        portfolio_id: int, 
        benchmark_symbol: str, 
        period: str
    ) -> BenchmarkComparison:
        """Internal method to calculate benchmark comparison (called only on cache miss)"""
        start_date, end_date = self._get_date_range(period, portfolio_id)
        
        # Get portfolio performance data (value and invested amounts)
        portfolio_data = self._get_daily_portfolio_performance(
            portfolio_id, start_date, end_date
        )
        
        if not portfolio_data:
            raise ValueError("No portfolio data available for this period")
        
        # Get benchmark data
        benchmark_asset = self.db.query(Asset).filter(
            Asset.symbol == benchmark_symbol
        ).first()
        
        if not benchmark_asset:
            # Create benchmark asset if it doesn't exist
            from app.crud.assets import create_asset
            from app.schemas import AssetCreate
            benchmark_asset = create_asset(
                self.db,
                AssetCreate(symbol=benchmark_symbol, name=benchmark_symbol)
            )
        
        # Ensure we have benchmark prices
        self.pricing_service.ensure_historical_prices(
            benchmark_asset,
            datetime.combine(start_date, datetime.min.time()),
            datetime.combine(end_date, datetime.max.time())
        )
        
        # Get benchmark prices
        benchmark_prices = crud_prices.get_prices(
            self.db,
            benchmark_asset.id,
            date_from=datetime.combine(start_date, datetime.min.time()),
            date_to=datetime.combine(end_date, datetime.max.time()),
            limit=10000
        )
        
        # Build benchmark dictionary
        benchmark_dict = {p.asof.date(): p.price for p in benchmark_prices}
        
        # Calculate performance percentages for both portfolio and benchmark
        # Portfolio performance = (Value - Invested) / Invested * 100
        # Benchmark performance = (Current Price - Start Price) / Start Price * 100
        
        benchmark_series = []
        portfolio_series = []
        benchmark_start_price = None
        
        for p_date, p_value, p_invested in portfolio_data:
            # Get benchmark price for this date
            b_price = benchmark_dict.get(p_date)
            if b_price:
                if benchmark_start_price is None:
                    benchmark_start_price = b_price
                
                # Calculate portfolio performance percentage
                portfolio_perf = (
                    ((p_value - p_invested) / p_invested * 100)
                    if p_invested > 0 else Decimal(0)
                )
                
                # Calculate benchmark performance percentage (relative to start)
                benchmark_perf = (
                    ((b_price - benchmark_start_price) / benchmark_start_price * 100)
                    if benchmark_start_price > 0 else Decimal(0)
                )
                
                # Store as performance percentages
                portfolio_series.append(
                    TimeSeriesPoint(date=p_date.isoformat(), value=portfolio_perf)
                )
                benchmark_series.append(
                    TimeSeriesPoint(date=p_date.isoformat(), value=benchmark_perf)
                )
        
        # Calculate final returns (these are the performance at the end of the period)
        portfolio_return = portfolio_series[-1].value if portfolio_series else Decimal(0)
        benchmark_return = benchmark_series[-1].value if benchmark_series else Decimal(0)
        
        alpha = portfolio_return - benchmark_return
        
        # Calculate correlation
        correlation = self._calculate_correlation(portfolio_series, benchmark_series)
        
        benchmark_name_map = {
            "SPY": "S&P 500",
            "QQQ": "Nasdaq 100",
            "IWM": "Russell 2000",
            "DIA": "Dow Jones",
            "VTI": "Total Stock Market"
        }
        
        return BenchmarkComparison(
            benchmark_symbol=benchmark_symbol,
            benchmark_name=benchmark_name_map.get(benchmark_symbol, benchmark_symbol),
            period=period,
            portfolio_return=portfolio_return,
            benchmark_return=benchmark_return,
            alpha=alpha,
            portfolio_series=portfolio_series,
            benchmark_series=benchmark_series,
            correlation=correlation
        )
    
    async def get_top_performers(
        self, 
        portfolio_id: int, 
        period: str,
        limit: int = 5,
        ascending: bool = False
    ) -> List[TopPerformer]:
        """Get top (or worst) performing assets"""
        positions = await self.metrics_service.get_positions(portfolio_id)
        
        performers = []
        for pos in positions:
            if pos.unrealized_pnl is None or pos.unrealized_pnl_pct is None:
                continue
            
            performers.append(TopPerformer(
                symbol=pos.symbol,
                name=pos.name,
                return_pct=pos.unrealized_pnl_pct,
                value=pos.market_value or Decimal(0),
                unrealized_pnl=pos.unrealized_pnl,
                period=period,
                asset_type=pos.asset_type
            ))
        
        # Sort by return percentage
        performers.sort(key=lambda x: x.return_pct, reverse=not ascending)
        return performers[:limit]
    
    def _get_date_range(self, period: str, portfolio_id: int) -> Tuple[date, date]:
        """Get start and end dates for period"""
        end_date = datetime.utcnow().date()
        
        if period == "1w":
            start_date = end_date - timedelta(days=7)
        elif period == "1m":
            start_date = end_date - timedelta(days=30)
        elif period == "3m":
            start_date = end_date - timedelta(days=90)
        elif period == "6m":
            start_date = end_date - timedelta(days=180)
        elif period == "1y":
            start_date = end_date - timedelta(days=365)
        elif period == "ytd":
            start_date = date(end_date.year, 1, 1)
        elif period == "all":
            # Get first transaction date
            first_tx = (
                self.db.query(func.min(Transaction.tx_date))
                .filter(Transaction.portfolio_id == portfolio_id)
                .scalar()
            )
            start_date = first_tx if first_tx else end_date - timedelta(days=365)
        else:
            start_date = end_date - timedelta(days=365)
        
        return start_date, end_date
    
    def _get_daily_portfolio_values(
        self, 
        portfolio_id: int,
        start_date: date,
        end_date: date
    ) -> List[Tuple[date, Decimal]]:
        """Get daily portfolio values for period with invested amounts for performance calculation"""
        # Map period to appropriate interval for history method
        # Calculate days in range to determine best interval
        days_diff = (end_date - start_date).days
        
        if days_diff <= 7:
            interval = "1W"
        elif days_diff <= 30:
            interval = "1M"
        elif days_diff <= 90:
            interval = "3M"
        elif days_diff <= 180:
            interval = "6M"
        elif days_diff <= 365:
            interval = "1Y"
        else:
            interval = "ALL"
        
        # Use the existing portfolio history method which includes invested amounts
        history_points = self.metrics_service.get_portfolio_history(
            portfolio_id, interval=interval
        )
        
        # Filter to date range and convert - return tuples of (date, value)
        # Note: This maintains backward compatibility by returning value, not performance
        values = []
        for point in history_points:
            point_date = date.fromisoformat(point.date)
            if start_date <= point_date <= end_date:
                values.append((point_date, Decimal(str(point.value))))
        
        return values
    
    def _get_daily_portfolio_performance(
        self, 
        portfolio_id: int,
        start_date: date,
        end_date: date
    ) -> List[Tuple[date, Decimal, Decimal]]:
        """Get daily portfolio performance (value and invested) for proper performance calculation"""
        days_diff = (end_date - start_date).days
        
        if days_diff <= 7:
            interval = "1W"
        elif days_diff <= 30:
            interval = "1M"
        elif days_diff <= 90:
            interval = "3M"
        elif days_diff <= 180:
            interval = "6M"
        elif days_diff <= 365:
            interval = "1Y"
        else:
            interval = "ALL"
        
        history_points = self.metrics_service.get_portfolio_history(
            portfolio_id, interval=interval
        )
        
        # Return tuples of (date, value, invested) for performance calculation
        performance_data = []
        for point in history_points:
            point_date = date.fromisoformat(point.date)
            if start_date <= point_date <= end_date:
                value = Decimal(str(point.value))
                invested = Decimal(str(point.invested)) if point.invested else value
                performance_data.append((point_date, value, invested))
        
        return performance_data
    
    def _calculate_cash_flows(
        self,
        portfolio_id: int,
        start_date: date,
        end_date: date
    ) -> Tuple[Decimal, Decimal]:
        """Calculate total invested and withdrawn amounts"""
        transactions = (
            self.db.query(Transaction)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.tx_date >= start_date,
                Transaction.tx_date <= end_date
            )
            .all()
        )
        
        total_invested = Decimal(0)
        total_withdrawn = Decimal(0)
        
        for tx in transactions:
            if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN]:
                total_invested += (tx.quantity * tx.price) + tx.fees
            elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT]:
                total_withdrawn += (tx.quantity * tx.price) - tx.fees
        
        return total_invested, total_withdrawn
    
    def _calculate_diversification_score(
        self, 
        allocations: List[AssetAllocation]
    ) -> Decimal:
        """Calculate diversification score (0-100)"""
        if not allocations:
            return Decimal(0)
        
        # Number of holdings component (max 50 points)
        num_holdings = len(allocations)
        holdings_score = min(num_holdings * 5, 50)
        
        # Concentration component (max 50 points)
        # Lower concentration = higher score
        herfindahl_index = sum(
            (float(a.percentage) / 100) ** 2 for a in allocations
        )
        concentration_score = (1 - herfindahl_index) * 50
        
        total_score = holdings_score + concentration_score
        return Decimal(str(min(total_score, 100)))
    
    def _calculate_beta(
        self,
        portfolio_id: int,
        start_date: date,
        end_date: date,
        portfolio_returns: List[float],
        portfolio_values: List[Tuple[date, Decimal]]
    ) -> Optional[Decimal]:
        """
        Calculate portfolio beta vs SPY (market proxy)
        Beta = Covariance(Portfolio, Market) / Variance(Market)
        """
        # Get SPY (market benchmark) data
        benchmark_symbol = "SPY"
        benchmark_asset = self.db.query(Asset).filter(
            Asset.symbol == benchmark_symbol
        ).first()
        
        if not benchmark_asset:
            # Create SPY asset if it doesn't exist
            from app.crud.assets import create_asset
            from app.schemas import AssetCreate
            benchmark_asset = create_asset(
                self.db,
                AssetCreate(symbol=benchmark_symbol, name="SPDR S&P 500 ETF")
            )
        
        # Ensure we have benchmark prices
        try:
            self.pricing_service.ensure_historical_prices(
                benchmark_asset,
                datetime.combine(start_date, datetime.min.time()),
                datetime.combine(end_date, datetime.max.time())
            )
        except Exception as e:
            logger.warning(f"Failed to fetch benchmark prices for beta calculation: {e}")
            return None
        
        # Get benchmark prices
        benchmark_prices = crud_prices.get_prices(
            self.db,
            benchmark_asset.id,
            date_from=datetime.combine(start_date, datetime.min.time()),
            date_to=datetime.combine(end_date, datetime.max.time()),
            limit=10000
        )
        
        if not benchmark_prices or len(benchmark_prices) < 2:
            return None
        
        # Build benchmark price dictionary by date
        benchmark_dict = {p.asof.date(): float(p.price) for p in benchmark_prices}
        
        # Calculate benchmark returns
        benchmark_returns_map = {}
        sorted_bench_dates = sorted(benchmark_dict.keys())
        for i in range(1, len(sorted_bench_dates)):
            d_prev = sorted_bench_dates[i-1]
            d_curr = sorted_bench_dates[i]
            p_prev = benchmark_dict[d_prev]
            p_curr = benchmark_dict[d_curr]
            if p_prev > 0:
                ret = (p_curr - p_prev) / p_prev
                benchmark_returns_map[d_curr] = ret
        
        # Map portfolio returns to dates
        # portfolio_values has dates. portfolio_returns are returns between values.
        # daily_returns[i] corresponds to daily_values[i+1].date
        portfolio_dates = [d for d, _ in portfolio_values]
        if len(portfolio_dates) - 1 != len(portfolio_returns):
            # Mismatch in lengths, cannot align reliably
            return None
            
        portfolio_returns_map = {}
        for i in range(len(portfolio_returns)):
            # The return at index i corresponds to the date at index i+1
            d = portfolio_dates[i+1]
            portfolio_returns_map[d] = portfolio_returns[i]
            
        # Intersect keys to find common dates
        common_dates = sorted(set(portfolio_returns_map.keys()) & set(benchmark_returns_map.keys()))
        
        # If fewer than 30 points, return None
        if len(common_dates) < 30:
            logger.warning(f"Insufficient aligned returns for beta calculation: {len(common_dates)} points")
            return None
            
        # Build aligned lists
        aligned_portfolio_returns = [portfolio_returns_map[d] for d in common_dates]
        aligned_benchmark_returns = [benchmark_returns_map[d] for d in common_dates]
        
        # Calculate covariance and variance using aligned returns
        portfolio_mean = sum(aligned_portfolio_returns) / len(aligned_portfolio_returns)
        benchmark_mean = sum(aligned_benchmark_returns) / len(aligned_benchmark_returns)
        
        covariance = sum(
            (p - portfolio_mean) * (b - benchmark_mean)
            for p, b in zip(aligned_portfolio_returns, aligned_benchmark_returns)
        ) / len(aligned_portfolio_returns)
        
        benchmark_variance = sum(
            (b - benchmark_mean) ** 2
            for b in aligned_benchmark_returns
        ) / len(aligned_benchmark_returns)
        
        if benchmark_variance == 0:
            logger.warning("Benchmark variance is zero, cannot calculate beta")
            return None
        
        beta = covariance / benchmark_variance
        logger.info(f"Calculated beta: {beta:.3f} (based on {len(aligned_portfolio_returns)} aligned returns)")
        return Decimal(str(round(beta, 3)))
    
    def _calculate_correlation(
        self,
        series1: List[TimeSeriesPoint],
        series2: List[TimeSeriesPoint]
    ) -> Optional[Decimal]:
        """Calculate correlation between two time series"""
        if len(series1) != len(series2) or len(series1) < 2:
            return None
        
        values1 = [float(p.value) for p in series1]
        values2 = [float(p.value) for p in series2]
        
        mean1 = sum(values1) / len(values1)
        mean2 = sum(values2) / len(values2)
        
        numerator = sum((v1 - mean1) * (v2 - mean2) for v1, v2 in zip(values1, values2))
        
        sum_sq1 = sum((v1 - mean1) ** 2 for v1 in values1)
        sum_sq2 = sum((v2 - mean2) ** 2 for v2 in values2)
        
        denominator = math.sqrt(sum_sq1 * sum_sq2)
        
        if denominator == 0:
            return None
        
        correlation = numerator / denominator
        return Decimal(str(correlation))
    
    def _empty_performance_metrics(self, period: str) -> PerformanceMetrics:
        """Return empty performance metrics"""
        return PerformanceMetrics(
            period=period,
            total_return=Decimal(0),
            total_return_pct=Decimal(0),
            annualized_return=Decimal(0),
            start_value=Decimal(0),
            end_value=Decimal(0),
            total_invested=Decimal(0),
            total_withdrawn=Decimal(0),
            best_day=None,
            best_day_date=None,
            worst_day=None,
            worst_day_date=None,
            positive_days=0,
            negative_days=0,
            win_rate=Decimal(0)
        )
    
    def _empty_risk_metrics(self, period: str) -> RiskMetrics:
        """Return empty risk metrics"""
        return RiskMetrics(
            period=period,
            volatility=Decimal(0),
            sharpe_ratio=None,
            max_drawdown=Decimal(0),
            max_drawdown_date=None,
            beta=None,
            var_95=None,
            var_99=None,
            cvar_95=None,
            cvar_99=None,
            var_95_1w=None,
            var_95_1m=None,
            tail_exposure=None,
            downside_deviation=Decimal(0)
        )

    def _decimal_or_zero(self, value: Any) -> Decimal:
        if value is None:
            return Decimal(0)
        try:
            return Decimal(str(value))
        except Exception:
            return Decimal(0)

    def _safe_pct(self, numerator: Decimal, denominator: Decimal) -> Decimal:
        return (numerator / denominator * Decimal(100)) if denominator > 0 else Decimal(0)

    def _parse_split_ratio(self, split_str: str) -> Decimal:
        try:
            parts = split_str.split(":")
            if len(parts) == 2:
                denominator = Decimal(parts[1])
                if denominator != 0:
                    return Decimal(parts[0]) / denominator
        except Exception:
            pass
        return Decimal(1)

    def _extract_theme_weights(self, themes: Optional[List[Any]]) -> List[tuple[str, Decimal, List[str]]]:
        """Return normalized top-level theme weights for a position."""
        extracted: List[tuple[str, Optional[Decimal], List[str]]] = []
        seen_labels: set[str] = set()

        for raw_theme in themes or []:
            if isinstance(raw_theme, dict):
                theme_payload = raw_theme.get("theme") if isinstance(raw_theme.get("theme"), dict) else raw_theme
                raw_label = theme_payload.get("label")
                raw_weight = theme_payload.get("weight", raw_theme.get("weight"))
                raw_children = theme_payload.get("children", raw_theme.get("children", []))
            else:
                raw_label = getattr(raw_theme, "label", None)
                raw_weight = getattr(raw_theme, "weight", None)
                raw_children = getattr(raw_theme, "children", [])

            if raw_label is None:
                continue

            label = str(raw_label).strip()
            normalized_label = label.casefold()
            if not label or normalized_label in seen_labels:
                continue

            weight = None
            if raw_weight is not None:
                parsed_weight = self._decimal_or_zero(raw_weight)
                if parsed_weight > 0:
                    weight = parsed_weight

            subthemes: List[str] = []
            seen_subthemes: set[str] = set()
            for raw_child in raw_children or []:
                raw_child_label = raw_child.get("label") if isinstance(raw_child, dict) else getattr(raw_child, "label", None)
                if raw_child_label is None:
                    continue
                child_label = str(raw_child_label).strip()
                normalized_child = child_label.casefold()
                if child_label and normalized_child not in seen_subthemes:
                    seen_subthemes.add(normalized_child)
                    subthemes.append(child_label)

            seen_labels.add(normalized_label)
            extracted.append((label, weight, subthemes))

        if not extracted:
            return []

        if all(weight is not None for _, weight, _ in extracted):
            total_weight = sum(weight for _, weight, _ in extracted if weight is not None)
            if total_weight > 0:
                return [
                    (label, (weight or Decimal(0)) / total_weight, subthemes)
                    for label, weight, subthemes in extracted
                ]

        equal_weight = Decimal(1) / Decimal(len(extracted))
        return [(label, equal_weight, subthemes) for label, _, subthemes in extracted]

    def _build_contribution_item(
        self,
        *,
        name: str,
        value: Decimal,
        cost_basis: Decimal,
        unrealized_pnl: Decimal,
        total_value: Decimal,
        total_cost: Decimal,
        count: int = 1,
        symbol: Optional[str] = None,
        asset_type: Optional[str] = None,
    ) -> ContributionItem:
        return ContributionItem(
            name=name,
            symbol=symbol,
            asset_type=asset_type,
            value=value,
            cost_basis=cost_basis,
            unrealized_pnl=unrealized_pnl,
            unrealized_pnl_pct=self._safe_pct(unrealized_pnl, cost_basis),
            portfolio_weight=self._safe_pct(value, total_value),
            contribution_to_return=self._safe_pct(unrealized_pnl, total_cost),
            count=count,
        )

    async def _get_position_context(self, portfolio_id: int) -> tuple[List[Any], Decimal, Decimal]:
        positions = await self.metrics_service.get_positions(portfolio_id)
        total_value = sum((p.market_value or Decimal(0)) for p in positions)
        total_cost = sum((p.cost_basis or Decimal(0)) for p in positions)
        return positions, total_value, total_cost

    async def build_portfolio_insights_snapshot(
        self,
        portfolio_id: int,
        user_id: Optional[int] = None,
    ) -> PortfolioInsightsSnapshot:
        """Build shared base data once for a domain-level Insights request."""
        portfolio = crud_portfolios.get_portfolio(self.db, portfolio_id)
        if not portfolio:
            raise ValueError(f"Portfolio {portfolio_id} not found")

        positions, total_value, total_cost = await self._get_position_context(portfolio_id)
        asset_ids = sorted({position.asset_id for position in positions if getattr(position, "asset_id", None) is not None})
        assets = (
            self.db.query(Asset)
            .options(joinedload(Asset.theme_classification))
            .filter(Asset.id.in_(asset_ids))
            .all()
            if asset_ids
            else []
        )
        asset_map = {asset.id: asset for asset in assets}
        effective_metadata: Dict[int, Dict[str, Any]] = {}

        if user_id is not None:
            from app.crud import assets as crud_assets

            effective_metadata = {
                asset.id: crud_assets.get_effective_asset_metadata(self.db, asset, user_id)
                for asset in assets
            }

        logger.debug(
            "Built insights snapshot portfolio_id=%s holdings=%s assets=%s user_metadata=%s",
            portfolio_id,
            len(positions),
            len(asset_map),
            bool(effective_metadata),
        )
        return PortfolioInsightsSnapshot(
            portfolio_id=portfolio_id,
            user_id=user_id,
            portfolio=portfolio,
            positions=positions,
            total_value=total_value,
            total_cost=total_cost,
            asset_map=asset_map,
            effective_metadata=effective_metadata,
        )

    def _themes_for_position(self, snapshot: PortfolioInsightsSnapshot, position: Any) -> Optional[List[Any]]:
        themes = getattr(position, "themes", None)
        if themes:
            return themes
        asset = snapshot.asset_map.get(getattr(position, "asset_id", None))
        return getattr(asset, "themes", None) if asset else None

    def _effective_metadata_for_position(
        self,
        snapshot: PortfolioInsightsSnapshot,
        position: Any,
    ) -> Dict[str, Optional[str]]:
        asset_id = getattr(position, "asset_id", None)
        metadata = snapshot.effective_metadata.get(asset_id)
        if metadata:
            return metadata

        asset = snapshot.asset_map.get(asset_id)
        return {
            "effective_sector": getattr(asset, "sector", None) if asset else None,
            "effective_country": getattr(asset, "country", None) if asset else None,
        }

    def _summary_from_snapshot(self, snapshot: PortfolioInsightsSnapshot, period: str) -> PortfolioInsightsSummary:
        total_return = snapshot.total_value - snapshot.total_cost
        allocations = [
            AssetAllocation(
                symbol=position.symbol,
                name=position.name,
                percentage=self._safe_pct(position.market_value or Decimal(0), snapshot.total_value),
                value=position.market_value or Decimal(0),
                quantity=position.quantity,
                asset_type=position.asset_type,
            )
            for position in snapshot.positions
            if position.market_value
        ]

        return PortfolioInsightsSummary(
            portfolio_id=snapshot.portfolio_id,
            portfolio_name=snapshot.portfolio.name,
            as_of_date=datetime.utcnow(),
            period=period,
            total_value=snapshot.total_value,
            total_cost=snapshot.total_cost,
            total_return=total_return,
            total_return_pct=self._safe_pct(total_return, snapshot.total_cost),
            positions_count=len(snapshot.positions),
            diversification_score=self._calculate_diversification_score(allocations),
        )

    def _asset_contributions_from_snapshot(
        self,
        snapshot: PortfolioInsightsSnapshot,
        limit: int = 10,
        ascending: bool = False,
    ) -> List[ContributionItem]:
        items = [
            self._build_contribution_item(
                name=position.name or position.symbol,
                symbol=position.symbol,
                asset_type=position.asset_type,
                value=position.market_value or Decimal(0),
                cost_basis=position.cost_basis or Decimal(0),
                unrealized_pnl=position.unrealized_pnl or Decimal(0),
                total_value=snapshot.total_value,
                total_cost=snapshot.total_cost,
            )
            for position in snapshot.positions
            if position.market_value
        ]
        items.sort(key=lambda item: item.unrealized_pnl, reverse=not ascending)
        return items[:limit]

    def _move_summary_from_snapshot(
        self,
        snapshot: PortfolioInsightsSnapshot,
        limit: int = 10,
        side_limit: int = 5,
    ) -> PortfolioMoveSummary:
        movers: List[ContributionItem] = []
        explained_value = Decimal(0)
        has_daily_data = False

        for position in snapshot.positions:
            value = position.market_value or Decimal(0)
            if value <= 0 or position.daily_change_pct is None:
                continue
            has_daily_data = True
            daily_change_value = value * position.daily_change_pct / Decimal(100)
            explained_value += daily_change_value
            movers.append(
                ContributionItem(
                    name=position.name or position.symbol,
                    symbol=position.symbol,
                    asset_type=position.asset_type,
                    value=value,
                    cost_basis=position.cost_basis or Decimal(0),
                    unrealized_pnl=daily_change_value,
                    unrealized_pnl_pct=position.daily_change_pct,
                    portfolio_weight=self._safe_pct(value, snapshot.total_value),
                    contribution_to_return=self._safe_pct(daily_change_value, snapshot.total_value),
                    count=1,
                )
            )

        best_movers = sorted(
            (item for item in movers if item.unrealized_pnl > 0),
            key=lambda item: item.unrealized_pnl,
            reverse=True,
        )[:side_limit]
        worst_movers = sorted(
            (item for item in movers if item.unrealized_pnl < 0),
            key=lambda item: item.unrealized_pnl,
        )[:side_limit]
        movers.sort(key=lambda item: abs(item.unrealized_pnl), reverse=True)
        daily_change_pct = self._safe_pct(explained_value, snapshot.total_value) if has_daily_data else None
        return PortfolioMoveSummary(
            portfolio_id=snapshot.portfolio_id,
            total_value=snapshot.total_value,
            daily_change_value=explained_value if has_daily_data else None,
            daily_change_pct=daily_change_pct,
            explained_value=explained_value,
            unexplained_value=Decimal(0),
            movers=movers[:limit],
            best_movers=best_movers,
            worst_movers=worst_movers,
        )

    def _group_contribution_from_snapshot(
        self,
        snapshot: PortfolioInsightsSnapshot,
        group_by: str,
    ) -> List[ContributionItem]:
        groups: Dict[str, Dict[str, Any]] = {}

        def add_to_group(label: str, position: Any, weight: Decimal = Decimal(1)) -> None:
            value = (position.market_value or Decimal(0)) * weight
            cost_basis = (position.cost_basis or Decimal(0)) * weight
            unrealized_pnl = (position.unrealized_pnl or Decimal(0)) * weight
            if value <= 0:
                return
            payload = groups.setdefault(
                label or "Unknown",
                {"value": Decimal(0), "cost_basis": Decimal(0), "unrealized_pnl": Decimal(0), "symbols": set()},
            )
            payload["value"] += value
            payload["cost_basis"] += cost_basis
            payload["unrealized_pnl"] += unrealized_pnl
            payload["symbols"].add(position.symbol)

        for position in snapshot.positions:
            if not position.market_value:
                continue

            if group_by == "asset":
                add_to_group(position.symbol, position)
            elif group_by == "theme":
                weighted_themes = self._extract_theme_weights(self._themes_for_position(snapshot, position))
                if not weighted_themes:
                    weighted_themes = [("Unclassified", Decimal(1), [])]
                for theme_label, weight, _subthemes in weighted_themes:
                    add_to_group(theme_label, position, weight)
            elif group_by == "currency":
                add_to_group(position.currency or "Unknown", position)
            elif group_by == "asset_type":
                add_to_group(position.asset_type or "Unknown", position)
            elif group_by == "market_cap":
                add_to_group(self._market_cap_bucket_for_position(snapshot, position), position)
            elif group_by in {"sector", "country"}:
                metadata = self._effective_metadata_for_position(snapshot, position)
                label = (
                    metadata.get("effective_sector")
                    if group_by == "sector"
                    else metadata.get("effective_country")
                )
                add_to_group(label or "Unknown", position)
            else:
                raise ValueError(f"Unsupported group_by: {group_by}")

        result = [
            self._build_contribution_item(
                name=label,
                value=payload["value"],
                cost_basis=payload["cost_basis"],
                unrealized_pnl=payload["unrealized_pnl"],
                total_value=snapshot.total_value,
                total_cost=snapshot.total_cost,
                count=len(payload["symbols"]),
            )
            for label, payload in groups.items()
        ]
        result.sort(key=lambda item: item.value, reverse=True)
        return result

    def _market_cap_bucket_for_position(
        self,
        snapshot: PortfolioInsightsSnapshot,
        position: Any,
    ) -> str:
        asset = snapshot.asset_map.get(getattr(position, "asset_id", None))
        market_cap = getattr(position, "market_cap_usd", None)
        if market_cap is None and asset is not None:
            market_cap = getattr(asset, "market_cap_usd", None)
        if market_cap is None:
            market_cap = getattr(position, "market_cap", None)
        if market_cap is None and asset is not None:
            market_cap = getattr(asset, "market_cap", None)

        if market_cap is not None:
            parsed_market_cap = self._decimal_or_zero(market_cap)
            if parsed_market_cap >= Decimal("200000000000"):
                return "Mega Cap"
            if parsed_market_cap >= Decimal("10000000000"):
                return "Large Cap"
            if parsed_market_cap >= Decimal("2000000000"):
                return "Mid Cap"
            if parsed_market_cap >= Decimal("300000000"):
                return "Small Cap"
            if parsed_market_cap > 0:
                return "Micro Cap"

        asset_type = (getattr(position, "asset_type", None) or getattr(asset, "asset_type", None) or "").upper()
        if asset_type in {"ETF", "FUND", "MUTUALFUND", "MUTUAL_FUND"}:
            return "Funds / ETFs"
        if asset_type in {"CRYPTO", "CRYPTOCURRENCY"}:
            return "Crypto assets"
        return "Market cap unavailable"

    def _concentration_from_snapshot(self, snapshot: PortfolioInsightsSnapshot) -> ConcentrationMetrics:
        items = self._asset_contributions_from_snapshot(snapshot, limit=len(snapshot.positions), ascending=False)
        items.sort(key=lambda item: item.value, reverse=True)
        weights = [item.portfolio_weight / Decimal(100) for item in items]
        hhi = sum(weight * weight for weight in weights)
        effective_positions = (Decimal(1) / hhi) if hhi > 0 else Decimal(0)

        allocations = [
            AssetAllocation(
                symbol=item.symbol or item.name,
                name=item.name,
                percentage=item.portfolio_weight,
                value=item.value,
                quantity=Decimal(0),
                asset_type=item.asset_type,
            )
            for item in items
        ]

        return ConcentrationMetrics(
            portfolio_id=snapshot.portfolio_id,
            positions_count=len(items),
            largest_position_weight=items[0].portfolio_weight if items else Decimal(0),
            top_3_weight=sum((item.portfolio_weight for item in items[:3]), Decimal(0)),
            top_5_weight=sum((item.portfolio_weight for item in items[:5]), Decimal(0)),
            herfindahl_index=hhi,
            effective_positions=effective_positions,
            diversification_score=self._calculate_diversification_score(allocations),
            largest_position=items[0] if items else None,
        )

    def _group_members_from_snapshot(
        self,
        snapshot: PortfolioInsightsSnapshot,
        group_by: str,
    ) -> Dict[str, set[str]]:
        members: Dict[str, set[str]] = {}

        def add_member(label: str, symbol: str) -> None:
            members.setdefault(label or "Unknown", set()).add(symbol)

        for position in snapshot.positions:
            if not position.market_value:
                continue
            if group_by == "theme":
                weighted_themes = self._extract_theme_weights(self._themes_for_position(snapshot, position))
                if not weighted_themes:
                    weighted_themes = [("Unclassified", Decimal(1), [])]
                for theme_label, _weight, _subthemes in weighted_themes:
                    add_member(theme_label, position.symbol)
            elif group_by == "currency":
                add_member(position.currency or "Unknown", position.symbol)
            elif group_by in {"sector", "country"}:
                metadata = self._effective_metadata_for_position(snapshot, position)
                label = (
                    metadata.get("effective_sector")
                    if group_by == "sector"
                    else metadata.get("effective_country")
                )
                add_member(label or "Unknown", position.symbol)

        return members

    def _duplicate_exposure_from_groups(
        self,
        contributions_by_group: Dict[str, List[ContributionItem]],
        members_by_group: Dict[str, Dict[str, set[str]]],
    ) -> List[DuplicateExposureItem]:
        groups: List[DuplicateExposureItem] = []
        for exposure_type in ("theme", "sector", "country", "currency"):
            for item in contributions_by_group.get(exposure_type, []):
                if item.count >= 2 and item.portfolio_weight >= Decimal(15):
                    groups.append(
                        DuplicateExposureItem(
                            label=item.name,
                            exposure_type=exposure_type,
                            portfolio_weight=item.portfolio_weight,
                            count=item.count,
                            assets=sorted(members_by_group.get(exposure_type, {}).get(item.name, set())),
                        )
                    )
        groups.sort(key=lambda item: item.portfolio_weight, reverse=True)
        return groups[:10]

    def _hidden_concentration_from_groups(
        self,
        contributions_by_group: Dict[str, List[ContributionItem]],
    ) -> List[HiddenConcentrationItem]:
        concentrations: List[HiddenConcentrationItem] = []
        for exposure_type in ("theme", "sector", "country", "currency"):
            for item in contributions_by_group.get(exposure_type, []):
                if item.count >= 2 and item.portfolio_weight >= Decimal(35):
                    concentrations.append(
                        HiddenConcentrationItem(
                            label=item.name,
                            exposure_type=exposure_type,
                            portfolio_weight=item.portfolio_weight,
                            count=item.count,
                        )
                    )
        concentrations.sort(key=lambda item: item.portfolio_weight, reverse=True)
        return concentrations[:10]

    def _portfolio_dna_from_groups(
        self,
        snapshot: PortfolioInsightsSnapshot,
        concentration: ConcentrationMetrics,
        type_exposure: List[ContributionItem],
        country_exposure: List[ContributionItem],
        currency_exposure: List[ContributionItem],
        theme_exposure: List[ContributionItem],
    ) -> PortfolioDNA:
        def top_label(items: List[ContributionItem], fallback: str = "Unknown") -> tuple[str, Decimal]:
            if not items:
                return fallback, Decimal(0)
            return items[0].name, items[0].portfolio_weight

        concentration_label = (
            "Concentrated"
            if concentration.largest_position_weight >= Decimal(35)
            else "Balanced"
            if concentration.largest_position_weight >= Decimal(20)
            else "Diversified"
        )
        type_label, type_weight = top_label(type_exposure)
        country_label, country_weight = top_label(country_exposure)
        currency_label, currency_weight = top_label(currency_exposure)
        theme_label, theme_weight = top_label(theme_exposure, "Unclassified")

        return PortfolioDNA(
            portfolio_id=snapshot.portfolio_id,
            traits=[
                PortfolioDNATrait(label="Concentration", value=concentration_label, score=concentration.largest_position_weight),
                PortfolioDNATrait(label="Instrument tilt", value=type_label, score=type_weight),
                PortfolioDNATrait(label="Geographic tilt", value=country_label, score=country_weight),
                PortfolioDNATrait(label="Currency tilt", value=currency_label, score=currency_weight),
                PortfolioDNATrait(
                    label="Theme profile",
                    value="Thematic" if theme_weight >= Decimal(50) else theme_label,
                    score=theme_weight,
                ),
                PortfolioDNATrait(label="Breadth", value=f"{concentration.positions_count} positions", score=concentration.effective_positions),
            ],
        )

    async def get_portfolio_summary(self, portfolio_id: int, period: str) -> PortfolioInsightsSummary:
        """Return a small summary payload for independently loaded metric blocks."""
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id)
        return self._summary_from_snapshot(snapshot, period)

    async def get_asset_contributions(
        self,
        portfolio_id: int,
        limit: int = 10,
        ascending: bool = False,
    ) -> List[ContributionItem]:
        """Return position-level contribution rows sorted by P&L."""
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id)
        return self._asset_contributions_from_snapshot(snapshot, limit=limit, ascending=ascending)

    async def get_portfolio_move_summary(self, portfolio_id: int, limit: int = 8) -> PortfolioMoveSummary:
        """Explain daily portfolio movement from position daily change percentages."""
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id)
        return self._move_summary_from_snapshot(snapshot, limit=limit)

    async def get_group_contribution(
        self,
        portfolio_id: int,
        user_id: int,
        group_by: str,
    ) -> List[ContributionItem]:
        """Aggregate contribution by deterministic exposure groups."""
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        return self._group_contribution_from_snapshot(snapshot, group_by)

    async def get_concentration_metrics(self, portfolio_id: int) -> ConcentrationMetrics:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id)
        return self._concentration_from_snapshot(snapshot)

    async def _get_group_members(
        self,
        portfolio_id: int,
        user_id: int,
        group_by: str,
    ) -> Dict[str, set[str]]:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        return self._group_members_from_snapshot(snapshot, group_by)

    async def get_duplicate_exposure(self, portfolio_id: int, user_id: int) -> List[DuplicateExposureItem]:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        contributions_by_group = {
            group: self._group_contribution_from_snapshot(snapshot, group)
            for group in ("theme", "sector", "country", "currency")
        }
        members_by_group = {
            group: self._group_members_from_snapshot(snapshot, group)
            for group in ("theme", "sector", "country", "currency")
        }
        return self._duplicate_exposure_from_groups(contributions_by_group, members_by_group)

    async def get_hidden_concentration(self, portfolio_id: int, user_id: int) -> List[HiddenConcentrationItem]:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        contributions_by_group = {
            group: self._group_contribution_from_snapshot(snapshot, group)
            for group in ("theme", "sector", "country", "currency")
        }
        return self._hidden_concentration_from_groups(contributions_by_group)

    def _theme_groups_for_basis(
        self,
        asset: Asset,
        basis_value: Decimal,
    ) -> List[tuple[str, Decimal]]:
        weighted_themes = self._extract_theme_weights(asset.themes)
        if not weighted_themes:
            return [("Unclassified", basis_value)]
        return [(label, basis_value * weight) for label, weight, _subthemes in weighted_themes]

    def _theme_bucket_dates(self, start_date: date, end_date: date) -> List[date]:
        days = max((end_date - start_date).days, 0)
        if days <= 35:
            step = 7
        elif days <= 370:
            step = 30
        else:
            step = max(days // 12, 30)

        dates: List[date] = []
        cursor = start_date
        while cursor < end_date:
            dates.append(cursor)
            cursor += timedelta(days=step)
        if not dates or dates[-1] != end_date:
            dates.append(end_date)
        return dates

    async def get_theme_evolution(
        self,
        portfolio_id: int,
        period: str,
        snapshot: Optional[PortfolioInsightsSnapshot] = None,
    ) -> List[ThemeEvolutionPoint]:
        """Return deterministic theme exposure snapshots based on transaction cost basis."""
        portfolio = snapshot.portfolio if snapshot else crud_portfolios.get_portfolio(self.db, portfolio_id)
        start_date, end_date = self._get_date_range(period, portfolio_id)

        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.portfolio_id == portfolio_id, Transaction.tx_date <= end_date)
            .order_by(Transaction.tx_date, Transaction.created_at)
            .all()
        )
        if not transactions:
            return []

        asset_ids = sorted({tx.asset_id for tx in transactions})
        asset_map = dict(snapshot.asset_map) if snapshot else {}
        missing_asset_ids = [asset_id for asset_id in asset_ids if asset_id not in asset_map]
        if missing_asset_ids:
            assets = (
                self.db.query(Asset)
                .options(joinedload(Asset.theme_classification))
                .filter(Asset.id.in_(missing_asset_ids))
                .all()
            )
            asset_map.update({asset.id: asset for asset in assets})

        from app.services.market_data.currency import CurrencyService

        def convert_amount(amount: Decimal, from_currency: Optional[str], snapshot_date: date) -> Decimal:
            target_currency = portfolio.base_currency if portfolio else from_currency
            if not from_currency or not target_currency or from_currency == target_currency:
                return amount
            converted = CurrencyService.convert_historical(
                amount,
                from_currency=from_currency,
                to_currency=target_currency,
                date=datetime.combine(snapshot_date, datetime.min.time()),
            )
            return converted or amount

        points: List[ThemeEvolutionPoint] = []
        for snapshot_date in self._theme_bucket_dates(start_date, end_date):
            quantities: Dict[int, Decimal] = {}
            cost_basis: Dict[int, Decimal] = {}
            shares_for_cost: Dict[int, Decimal] = {}

            for tx in transactions:
                if tx.tx_date > snapshot_date:
                    break
                quantities.setdefault(tx.asset_id, Decimal(0))
                cost_basis.setdefault(tx.asset_id, Decimal(0))
                shares_for_cost.setdefault(tx.asset_id, Decimal(0))

                if tx.type in [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.CONVERSION_IN]:
                    amount = convert_amount((tx.quantity * tx.price) + tx.fees, tx.currency, tx.tx_date)
                    quantities[tx.asset_id] += tx.quantity
                    cost_basis[tx.asset_id] += amount
                    shares_for_cost[tx.asset_id] += tx.quantity
                elif tx.type in [TransactionType.SELL, TransactionType.TRANSFER_OUT, TransactionType.CONVERSION_OUT]:
                    quantity_to_remove = min(tx.quantity, quantities[tx.asset_id])
                    if shares_for_cost[tx.asset_id] > 0 and quantity_to_remove > 0:
                        avg_cost = cost_basis[tx.asset_id] / shares_for_cost[tx.asset_id]
                        cost_basis[tx.asset_id] -= avg_cost * quantity_to_remove
                        shares_for_cost[tx.asset_id] -= quantity_to_remove
                    quantities[tx.asset_id] -= tx.quantity
                elif tx.type == TransactionType.SPLIT:
                    split_ratio = self._parse_split_ratio(tx.meta_data.get("split", "1:1") if tx.meta_data else "1:1")
                    quantities[tx.asset_id] *= split_ratio
                    shares_for_cost[tx.asset_id] *= split_ratio

            theme_totals: Dict[str, Decimal] = {}
            total_basis = Decimal(0)
            for asset_id, basis in cost_basis.items():
                if quantities.get(asset_id, Decimal(0)) <= 0 or basis <= 0:
                    continue
                asset = asset_map.get(asset_id)
                if not asset:
                    continue
                total_basis += basis
                for theme_label, theme_value in self._theme_groups_for_basis(asset, basis):
                    theme_totals[theme_label] = theme_totals.get(theme_label, Decimal(0)) + theme_value

            if total_basis <= 0:
                exposures = {}
            else:
                exposures = {
                    label: self._safe_pct(value, total_basis)
                    for label, value in sorted(theme_totals.items(), key=lambda item: item[1], reverse=True)
                }

            points.append(ThemeEvolutionPoint(date=snapshot_date.isoformat(), exposures=exposures))

        return points

    async def get_portfolio_dna(self, portfolio_id: int, user_id: int) -> PortfolioDNA:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        concentration = self._concentration_from_snapshot(snapshot)
        return self._portfolio_dna_from_groups(
            snapshot,
            concentration,
            self._group_contribution_from_snapshot(snapshot, "asset_type"),
            self._group_contribution_from_snapshot(snapshot, "country"),
            self._group_contribution_from_snapshot(snapshot, "currency"),
            self._group_contribution_from_snapshot(snapshot, "theme"),
        )

    def _scenario_definitions(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "Broad equity selloff",
                "description": "Global risk assets fall, with higher shocks for crypto and single-name equities.",
                "default": Decimal("-10"),
                "asset_type": {"CRYPTO": Decimal("-25"), "CRYPTOCURRENCY": Decimal("-25"), "EQUITY": Decimal("-15"), "ETF": Decimal("-10")},
            },
            {
                "name": "Rate shock",
                "description": "Interest rates rise sharply; long-duration growth sectors are hit hardest.",
                "default": Decimal("-4"),
                "sector": {"Technology": Decimal("-12"), "Real Estate": Decimal("-14"), "Utilities": Decimal("-8"), "Financial Services": Decimal("3"), "Financials": Decimal("3")},
            },
            {
                "name": "USD strength",
                "description": "The US dollar strengthens; non-base-currency exposure faces translation pressure.",
                "default": Decimal("0"),
                "foreign_currency": Decimal("-5"),
            },
            {
                "name": "Crypto winter",
                "description": "Digital assets reprice materially lower while other holdings are unchanged.",
                "default": Decimal("0"),
                "asset_type": {"CRYPTO": Decimal("-35"), "CRYPTOCURRENCY": Decimal("-35")},
            },
        ]

    async def get_scenario_analysis(self, portfolio_id: int, user_id: int) -> List[ScenarioResult]:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        return self._simulate_scenarios_from_snapshot(snapshot, self._scenario_definitions())

    async def get_stress_tests(self, portfolio_id: int, user_id: int) -> List[ScenarioResult]:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        return self._stress_tests_from_snapshot(snapshot)

    def _stress_tests_from_snapshot(self, snapshot: PortfolioInsightsSnapshot) -> List[ScenarioResult]:
        concentration = self._concentration_from_snapshot(snapshot)
        sector_exposure = self._group_contribution_from_snapshot(snapshot, "sector")
        currency_exposure = self._group_contribution_from_snapshot(snapshot, "currency")
        results: List[ScenarioResult] = []

        if concentration.largest_position:
            impact_value = concentration.largest_position.value * Decimal("-0.30")
            results.append(
                ScenarioResult(
                    name="Largest position drawdown",
                    description=f"{concentration.largest_position.symbol or concentration.largest_position.name} falls 30%.",
                    estimated_impact_pct=self._safe_pct(impact_value, snapshot.total_value),
                    estimated_impact_value=impact_value,
                )
            )

        if sector_exposure:
            top_sector = sector_exposure[0]
            impact_value = top_sector.value * Decimal("-0.20")
            results.append(
                ScenarioResult(
                    name="Top sector shock",
                    description=f"{top_sector.name} exposure falls 20%.",
                    estimated_impact_pct=self._safe_pct(impact_value, snapshot.total_value),
                    estimated_impact_value=impact_value,
                )
            )

        if currency_exposure:
            top_currency = currency_exposure[0]
            impact_value = top_currency.value * Decimal("-0.08")
            results.append(
                ScenarioResult(
                    name="Top currency translation shock",
                    description=f"{top_currency.name} exposure weakens 8% versus the portfolio base currency.",
                    estimated_impact_pct=self._safe_pct(impact_value, snapshot.total_value),
                    estimated_impact_value=impact_value,
                )
            )

        total_position_value = sum((position.market_value or Decimal(0)) for position in snapshot.positions)
        if total_position_value > 0:
            impact_value = total_position_value * Decimal("-0.12")
            results.append(
                ScenarioResult(
                    name="Liquidity stress",
                    description="All marked positions are shocked by 12% to approximate forced-sale pressure.",
                    estimated_impact_pct=self._safe_pct(impact_value, snapshot.total_value),
                    estimated_impact_value=impact_value,
                )
            )

        return results

    async def _simulate_scenarios(
        self,
        portfolio_id: int,
        user_id: int,
        scenarios: List[Dict[str, Any]],
    ) -> List[ScenarioResult]:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        return self._simulate_scenarios_from_snapshot(snapshot, scenarios)

    def _simulate_scenarios_from_snapshot(
        self,
        snapshot: PortfolioInsightsSnapshot,
        scenarios: List[Dict[str, Any]],
    ) -> List[ScenarioResult]:
        results: List[ScenarioResult] = []

        for scenario in scenarios:
            impact_value = Decimal(0)
            for position in snapshot.positions:
                value = position.market_value or Decimal(0)
                if value <= 0:
                    continue

                shock = scenario.get("default", Decimal(0))
                asset_type = (position.asset_type or "").upper()
                asset_type_shocks = scenario.get("asset_type", {})
                if asset_type in asset_type_shocks:
                    shock = asset_type_shocks[asset_type]

                if "sector" in scenario:
                    sector = self._effective_metadata_for_position(snapshot, position).get("effective_sector")
                    if sector in scenario["sector"]:
                        shock = scenario["sector"][sector]

                if "foreign_currency" in scenario and snapshot.portfolio and position.currency != snapshot.portfolio.base_currency:
                    shock = scenario["foreign_currency"]

                impact_value += value * shock / Decimal(100)

            results.append(
                ScenarioResult(
                    name=scenario["name"],
                    description=scenario["description"],
                    estimated_impact_pct=self._safe_pct(impact_value, snapshot.total_value),
                    estimated_impact_value=impact_value,
                )
            )

        return results

    async def get_performance_domain(
        self,
        portfolio_id: int,
        period: str = "1y",
    ) -> PerformanceInsightsDomain:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id)
        logger.debug("Building performance insights domain portfolio_id=%s period=%s", portfolio_id, period)
        return PerformanceInsightsDomain(
            summary=self._summary_from_snapshot(snapshot, period),
            performance=self.get_performance_metrics(portfolio_id, period),
            risk=await self.get_risk_metrics(portfolio_id, period, positions=snapshot.positions),
        )

    async def get_attribution_domain(
        self,
        portfolio_id: int,
        user_id: int,
    ) -> AttributionInsights:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        logger.debug("Building attribution insights domain portfolio_id=%s holdings=%s", portfolio_id, len(snapshot.positions))
        return AttributionInsights(
            move=self._move_summary_from_snapshot(snapshot, limit=10),
            top_contributors=self._asset_contributions_from_snapshot(snapshot, limit=5, ascending=False),
            top_detractors=self._asset_contributions_from_snapshot(snapshot, limit=5, ascending=True),
            asset_contribution=self._asset_contributions_from_snapshot(snapshot, limit=20, ascending=False),
            theme_contribution=self._group_contribution_from_snapshot(snapshot, "theme"),
            sector_contribution=self._group_contribution_from_snapshot(snapshot, "sector"),
            country_contribution=self._group_contribution_from_snapshot(snapshot, "country"),
            currency_contribution=self._group_contribution_from_snapshot(snapshot, "currency"),
            concentration=self._concentration_from_snapshot(snapshot),
        )

    async def get_exposure_domain(
        self,
        portfolio_id: int,
        user_id: int,
        period: str = "1y",
    ) -> ExposureInsights:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        logger.debug("Building exposure insights domain portfolio_id=%s holdings=%s", portfolio_id, len(snapshot.positions))

        theme_exposure = self._group_contribution_from_snapshot(snapshot, "theme")
        sector_exposure = self._group_contribution_from_snapshot(snapshot, "sector")
        country_exposure = self._group_contribution_from_snapshot(snapshot, "country")
        currency_exposure = self._group_contribution_from_snapshot(snapshot, "currency")
        contributions_by_group = {
            "theme": theme_exposure,
            "sector": sector_exposure,
            "country": country_exposure,
            "currency": currency_exposure,
        }
        members_by_group = {
            group: self._group_members_from_snapshot(snapshot, group)
            for group in ("theme", "sector", "country", "currency")
        }
        concentration = self._concentration_from_snapshot(snapshot)

        return ExposureInsights(
            theme_exposure=theme_exposure,
            sector_exposure=sector_exposure,
            country_exposure=country_exposure,
            currency_exposure=currency_exposure,
            market_cap_exposure=self._group_contribution_from_snapshot(snapshot, "market_cap"),
            duplicate_exposure=self._duplicate_exposure_from_groups(contributions_by_group, members_by_group),
            hidden_concentration=self._hidden_concentration_from_groups(contributions_by_group),
            portfolio_dna=self._portfolio_dna_from_groups(
                snapshot,
                concentration,
                self._group_contribution_from_snapshot(snapshot, "asset_type"),
                country_exposure,
                currency_exposure,
                theme_exposure,
            ),
            theme_evolution=await self.get_theme_evolution(portfolio_id, period, snapshot=snapshot),
        )

    async def get_risk_domain(
        self,
        portfolio_id: int,
        user_id: int,
        period: str = "1y",
        benchmark_symbol: str = "SPY",
    ) -> RiskInsights:
        snapshot = await self.build_portfolio_insights_snapshot(portfolio_id, user_id)
        logger.debug(
            "Building risk insights domain portfolio_id=%s period=%s benchmark=%s holdings=%s",
            portfolio_id,
            period,
            benchmark_symbol,
            len(snapshot.positions),
        )
        return RiskInsights(
            risk=await self.get_risk_metrics(portfolio_id, period, positions=snapshot.positions),
            benchmark_comparison=await self.compare_to_benchmark(
                portfolio_id,
                benchmark_symbol,
                period,
                positions=snapshot.positions,
            ),
            scenarios=self._simulate_scenarios_from_snapshot(snapshot, self._scenario_definitions()),
            stress_tests=self._stress_tests_from_snapshot(snapshot),
        )
    
    def get_average_holding_period(self, portfolio_id: int) -> Optional[Decimal]:
        """
        Calculate average holding period in days.
        - For completed positions: Uses FIFO matching of BUY/SELL transactions
        - For currently held positions: Calculates from purchase date to today
        - Returns weighted average of both
        """
        # Get all transactions for this portfolio, grouped by asset
        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.portfolio_id == portfolio_id)
            .filter(Transaction.type.in_([TransactionType.BUY, TransactionType.SELL]))
            .order_by(Transaction.asset_id, Transaction.tx_date, Transaction.created_at)
            .all()
        )
        
        if not transactions:
            return None
        
        # Group transactions by asset
        asset_transactions: Dict[int, List[Transaction]] = {}
        for tx in transactions:
            if tx.asset_id not in asset_transactions:
                asset_transactions[tx.asset_id] = []
            asset_transactions[tx.asset_id].append(tx)
        
        holding_periods = []
        today = date.today()
        
        # For each asset, match BUYs with SELLs using FIFO (First In, First Out)
        for asset_id, txs in asset_transactions.items():
            buys = []  # Stack of (date, quantity) tuples
            
            for tx in txs:
                if tx.type == TransactionType.BUY:
                    # Add to buy stack
                    buys.append((tx.tx_date, tx.quantity))
                    
                elif tx.type == TransactionType.SELL:
                    # Match with oldest buys (FIFO)
                    remaining_to_sell = tx.quantity
                    
                    while remaining_to_sell > 0 and buys:
                        buy_date, buy_quantity = buys[0]
                        
                        if buy_quantity <= remaining_to_sell:
                            # Fully sold this buy
                            holding_days = (tx.tx_date - buy_date).days
                            holding_periods.append(holding_days)
                            remaining_to_sell -= buy_quantity
                            buys.pop(0)
                        else:
                            # Partially sold this buy
                            holding_days = (tx.tx_date - buy_date).days
                            holding_periods.append(holding_days)
                            buys[0] = (buy_date, buy_quantity - remaining_to_sell)
                            remaining_to_sell = 0
            
            # Add holding periods for remaining buys (currently held positions)
            for buy_date, quantity in buys:
                holding_days = (today - buy_date).days
                holding_periods.append(holding_days)
        
        if not holding_periods:
            return None
        
        # Calculate average
        avg_days = sum(holding_periods) / len(holding_periods)
        return Decimal(str(round(avg_days, 1)))
