"""
Portfolio insights and analytics service
"""
import logging
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func
import math
import hashlib
import json

from app.models import Transaction, Asset, TransactionType, Price
from app.services.analytics_cache import get_cached_analytics
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
from app.services.metrics import MetricsService
from app.services.pricing import PricingService
from app.crud import portfolios as crud_portfolios
from app.crud import prices as crud_prices

logger = logging.getLogger(__name__)

# Simple in-memory cache for insights
_insights_cache: Dict[str, Tuple[PortfolioInsights, datetime]] = {}
_CACHE_DURATION = timedelta(minutes=5)  # Cache insights for 5 minutes


class InsightsService:
    """Service for portfolio insights and analytics"""
    
    def __init__(self, db: Session):
        self.db = db
        self.metrics_service = MetricsService(db)
        self.pricing_service = PricingService(db)
    
    def _get_cache_key(self, portfolio_id: int, period: str, benchmark_symbol: str) -> str:
        """Generate cache key for insights"""
        key_data = f"{portfolio_id}:{period}:{benchmark_symbol}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _get_cached_insights(self, cache_key: str) -> Optional[PortfolioInsights]:
        """Get insights from cache if available and not expired"""
        if cache_key in _insights_cache:
            insights, timestamp = _insights_cache[cache_key]
            if datetime.utcnow() - timestamp < _CACHE_DURATION:
                logger.info(f"Returning cached insights (age: {datetime.utcnow() - timestamp})")
                return insights
            else:
                # Cache expired, remove it
                del _insights_cache[cache_key]
        return None
    
    def _cache_insights(self, cache_key: str, insights: PortfolioInsights) -> None:
        """Store insights in cache"""
        _insights_cache[cache_key] = (insights, datetime.utcnow())
        # Keep cache size reasonable (max 100 entries)
        if len(_insights_cache) > 100:
            # Remove oldest entry
            oldest_key = min(_insights_cache.keys(), key=lambda k: _insights_cache[k][1])
            del _insights_cache[oldest_key]
    
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
            risk = self.get_risk_metrics(portfolio_id, period)
        except Exception as e:
            logger.warning(f"Failed to calculate risk metrics: {e}")
            risk = self._empty_risk_metrics(period)
        
        # Benchmark comparison
        try:
            benchmark_comparison = self.compare_to_benchmark(
                portfolio_id, benchmark_symbol, period
            )
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
    
    async def get_risk_metrics(self, portfolio_id: int, period: str) -> RiskMetrics:
        """Calculate risk metrics with smart caching"""
        # Get current positions for fingerprint (need to await since it's async)
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
        start_date, end_date = self._get_date_range(period, portfolio_id)
        daily_values = self._get_daily_portfolio_values(
            portfolio_id, start_date, end_date
        )
        
        if len(daily_values) < 2:
            return self._empty_risk_metrics(period)
        
        # Calculate daily returns
        daily_returns = []
        for i in range(1, len(daily_values)):
            prev_value = daily_values[i-1][1]
            curr_value = daily_values[i][1]
            if prev_value > 0:
                ret = float((curr_value - prev_value) / prev_value)
                daily_returns.append(ret)
        
        if not daily_returns:
            return self._empty_risk_metrics(period)
        
        # Volatility (annualized standard deviation)
        mean_return = sum(daily_returns) / len(daily_returns)
        variance = sum((r - mean_return) ** 2 for r in daily_returns) / len(daily_returns)
        daily_volatility = math.sqrt(variance)
        annualized_volatility = daily_volatility * math.sqrt(252)  # Trading days
        
        # Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        daily_rf = risk_free_rate / 252
        excess_returns = [r - daily_rf for r in daily_returns]
        avg_excess_return = sum(excess_returns) / len(excess_returns)
        sharpe_ratio = (
            (avg_excess_return / daily_volatility * math.sqrt(252))
            if daily_volatility > 0 else None
        )
        
        # Maximum drawdown
        max_drawdown = Decimal(0)
        max_drawdown_date = None
        peak_value = daily_values[0][1]
        
        for curr_date, curr_value in daily_values:
            if curr_value > peak_value:
                peak_value = curr_value
            
            drawdown = (peak_value - curr_value) / peak_value if peak_value > 0 else Decimal(0)
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                max_drawdown_date = curr_date.isoformat()
        
        max_drawdown = max_drawdown * 100  # Convert to percentage
        
        # Downside deviation (volatility of negative returns)
        negative_returns = [r for r in daily_returns if r < 0]
        downside_variance = (
            sum(r ** 2 for r in negative_returns) / len(negative_returns)
            if negative_returns else 0
        )
        downside_deviation = math.sqrt(downside_variance) * math.sqrt(252)
        
        # Value at Risk (95% confidence)
        sorted_returns = sorted(daily_returns)
        var_index = int(len(sorted_returns) * 0.05)
        var_95 = Decimal(str(sorted_returns[var_index] * 100)) if var_index < len(sorted_returns) else None
        
        # Beta calculation (vs SPY as market proxy)
        beta = self._calculate_beta(portfolio_id, start_date, end_date, daily_returns, daily_values)
        
        return RiskMetrics(
            period=period,
            volatility=Decimal(str(annualized_volatility * 100)),
            sharpe_ratio=Decimal(str(sharpe_ratio)) if sharpe_ratio else None,
            max_drawdown=max_drawdown,
            max_drawdown_date=max_drawdown_date,
            beta=beta,
            var_95=var_95,
            downside_deviation=Decimal(str(downside_deviation * 100))
        )
    
    async def compare_to_benchmark(
        self, 
        portfolio_id: int, 
        benchmark_symbol: str, 
        period: str
    ) -> BenchmarkComparison:
        """Compare portfolio performance to benchmark with smart caching"""
        # Get current positions for fingerprint (need to await since it's async)
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
        
        # Calculate benchmark returns aligned with portfolio dates
        # Only include returns where we have both portfolio and benchmark data
        aligned_portfolio_returns = []
        benchmark_returns = []
        portfolio_dates = [d for d, _ in portfolio_values]
        
        for i in range(1, len(portfolio_dates)):
            prev_date = portfolio_dates[i-1]
            curr_date = portfolio_dates[i]
            
            prev_price = benchmark_dict.get(prev_date)
            curr_price = benchmark_dict.get(curr_date)
            
            if prev_price and curr_price and prev_price > 0:
                # We have matching benchmark data for this period
                bench_ret = (curr_price - prev_price) / prev_price
                benchmark_returns.append(bench_ret)
                aligned_portfolio_returns.append(portfolio_returns[i-1])
        
        # Ensure we have enough data points
        if len(benchmark_returns) < 2 or len(aligned_portfolio_returns) < 2:
            logger.warning(f"Insufficient aligned returns for beta calculation: portfolio={len(aligned_portfolio_returns)}, benchmark={len(benchmark_returns)}")
            return None
        
        # Calculate covariance and variance using aligned returns
        portfolio_mean = sum(aligned_portfolio_returns) / len(aligned_portfolio_returns)
        benchmark_mean = sum(benchmark_returns) / len(benchmark_returns)
        
        covariance = sum(
            (p - portfolio_mean) * (b - benchmark_mean)
            for p, b in zip(aligned_portfolio_returns, benchmark_returns)
        ) / len(aligned_portfolio_returns)
        
        benchmark_variance = sum(
            (b - benchmark_mean) ** 2
            for b in benchmark_returns
        ) / len(benchmark_returns)
        
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
            downside_deviation=Decimal(0)
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
