"""
Goal projections service - Monte Carlo simulation and scenario analysis

This service calculates goal achievement probabilities using:
- Portfolio-level mark-to-market time series
- Weighted position returns and volatility
- Monte Carlo simulation with configurable parameters
- Quantile-based scenario generation

Units convention:
- All returns are expressed as decimals (0.08 = 8%)
- All volatilities are expressed as decimals (0.15 = 15%)
- All probabilities are expressed as decimals (0.75 = 75%)
"""
import logging
import math
import random
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel, Field

from app.models import Portfolio, Price, Transaction
from app.services.risk_analysis import RiskAnalysisService

logger = logging.getLogger(__name__)

# Constants for safety limits and defaults
MIN_ANNUAL_RETURN = -0.60  # -60% cap (realistic equity bear market)
MAX_ANNUAL_RETURN = 0.40   # +40% cap (realistic equity bull market)
MIN_VOLATILITY = 0.05      # 5% minimum volatility
MAX_VOLATILITY = 0.40      # 40% maximum volatility (realistic equity)
DEFAULT_ANNUAL_RETURN = 0.08  # 8% default
DEFAULT_VOLATILITY = 0.15     # 15% default
MIN_MONTE_CARLO_ITERATIONS = 100
MAX_MONTHS_HORIZON = 600  # 50 years
MIN_DATA_DAYS = 60  # Minimum 60 days for reliable performance estimation
QUANTILE_PESSIMISTIC = 0.10  # 10th percentile
QUANTILE_MEDIAN = 0.50       # 50th percentile (median)
QUANTILE_OPTIMISTIC = 0.90   # 90th percentile
TRADING_DAYS_PER_YEAR = 252  # Standard trading days for annualization


# Pydantic output models
class ScenarioResult(BaseModel):
    """Single scenario projection result representing a quantile outcome"""
    label: str = Field(..., description="Scenario label: Pessimistic, Median, or Optimistic")
    return_rate: float = Field(..., description="Implied annual return for this scenario (decimal)")
    projected_months: int = Field(..., description="Months to target date")
    projected_amount: float = Field(..., description="Projected final portfolio value at this quantile")
    quantile: float = Field(..., ge=0.0, le=1.0, description="Quantile this scenario represents (0.10, 0.50, 0.90)")
    color: str = Field(..., description="UI color: red, blue, or green")


class MilestoneResult(BaseModel):
    """Progress milestone result"""
    percentage: int = Field(..., description="Milestone percentage: 25, 50, 75, or 100")
    amount: float = Field(..., description="Milestone dollar amount")
    achieved: bool = Field(..., description="Whether milestone has been reached")
    label: str = Field(..., description="Human-readable label")


class GoalProjectionResult(BaseModel):
    """Complete goal projection calculation result"""
    scenarios: List[ScenarioResult] = Field(..., description="Three scenario projections")
    milestones: List[MilestoneResult] = Field(..., description="Progress milestones")
    probability: float = Field(..., ge=0.0, le=1.0, description="Overall achievement probability")
    historical_performance: Dict[str, float] = Field(..., description="Portfolio's historical performance metrics")
    is_past_target_date: bool = Field(
        default=False,
        description="Whether the target date is in the past"
    )
    warning: Optional[str] = Field(
        default=None,
        description="Warning message if there are issues with the goal parameters"
    )


class GoalProjectionsService:
    """Service for calculating goal achievement projections and probabilities"""
    
    def __init__(self, db: Session):
        self.db = db
        self.risk_service = RiskAnalysisService(db)
    
    def calculate_portfolio_performance(
        self, 
        portfolio_id: int,
        days: int = 252
    ) -> Dict[str, float]:
        """
        Calculate historical portfolio performance using mark-to-market time series.
        
        Builds a complete portfolio value series by:
        1. Loading all price history for portfolio assets
        2. Computing daily portfolio values based on actual holdings
        3. Calculating daily returns from the portfolio value series
        4. Deriving annualized return and volatility from portfolio returns
        
        Args:
            portfolio_id: Portfolio ID
            days: Number of days to look back (default 252 = 1 year)
        
        Returns:
            Dict with 'annual_return' and 'volatility' (both as decimals, e.g., 0.08 = 8%)
        """
        try:
            # Get portfolio
            portfolio = self.db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
            if not portfolio:
                logger.warning(f"Portfolio {portfolio_id} not found")
                return self._default_performance()
            
            # Get all transactions to understand holdings over time
            now = datetime.utcnow()
            start_date = now - timedelta(days=days)
            
            transactions = (
                self.db.query(Transaction)
                .filter(
                    Transaction.portfolio_id == portfolio_id,
                    Transaction.tx_date <= now.date()
                )
                .order_by(Transaction.tx_date.asc())
                .all()
            )
            
            if not transactions:
                logger.warning(f"No transactions found for portfolio {portfolio_id}")
                return self._default_performance()
            
            # Get unique asset IDs
            asset_ids = list(set(t.asset_id for t in transactions))
            
            # Preload ALL price data for all assets in one query (performance optimization)
            prices_data = (
                self.db.query(Price.asset_id, Price.asof, Price.price)
                .filter(
                    and_(
                        Price.asset_id.in_(asset_ids),
                        Price.asof >= start_date,
                        Price.asof <= now
                    )
                )
                .order_by(Price.asset_id, Price.asof)
                .all()
            )
            
            if not prices_data:
                logger.warning(f"No price data found for portfolio {portfolio_id} assets")
                return self._default_performance()
            
            # Build price lookup: {asset_id: {date: price}}
            price_lookup: Dict[int, Dict[datetime, float]] = {}
            for asset_id, asof, price in prices_data:
                if asset_id not in price_lookup:
                    price_lookup[asset_id] = {}
                price_lookup[asset_id][asof.date() if isinstance(asof, datetime) else asof] = float(price)
            
            # Build time series of portfolio values
            portfolio_values = self._build_portfolio_time_series(
                transactions, price_lookup, start_date, now
            )
            
            if len(portfolio_values) < MIN_DATA_DAYS:
                logger.warning(
                    f"Insufficient data points for portfolio {portfolio_id}: "
                    f"{len(portfolio_values)} days (need {MIN_DATA_DAYS}), using defaults"
                )
                return self._default_performance()
            
            # Calculate log-returns from portfolio values: ln(value[t] / value[t-1])
            log_returns = []
            sorted_dates = sorted(portfolio_values.keys())
            
            for i in range(1, len(sorted_dates)):
                prev_value = portfolio_values[sorted_dates[i-1]]
                curr_value = portfolio_values[sorted_dates[i]]
                
                if prev_value > 0 and curr_value > 0:
                    log_return = math.log(curr_value / prev_value)
                    log_returns.append(log_return)
            
            if len(log_returns) < MIN_DATA_DAYS:
                logger.warning(
                    f"Insufficient valid log-returns for portfolio {portfolio_id}: "
                    f"{len(log_returns)} days (need {MIN_DATA_DAYS}), using defaults"
                )
                return self._default_performance()
            
            # Calculate statistics from log-returns
            n = len(log_returns)
            mean_log = sum(log_returns) / n
            variance_log = sum((r - mean_log) ** 2 for r in log_returns) / n
            
            # Annualize using proper formulas
            annual_volatility = math.sqrt(variance_log * TRADING_DAYS_PER_YEAR)
            annual_return = math.exp(mean_log * TRADING_DAYS_PER_YEAR) - 1
            
            # Apply safety caps
            annual_return = max(MIN_ANNUAL_RETURN, min(MAX_ANNUAL_RETURN, annual_return))
            annual_volatility = max(MIN_VOLATILITY, min(MAX_VOLATILITY, annual_volatility))
            
            logger.info(
                f"Portfolio {portfolio_id} performance (log-returns): "
                f"return={annual_return:.2%}, volatility={annual_volatility:.2%}, "
                f"data_points={len(portfolio_values)}, valid_returns={len(log_returns)}"
            )
            
            return {
                'annual_return': annual_return,
                'volatility': annual_volatility
            }
            
        except Exception as e:
            logger.error(f"Error calculating portfolio performance: {e}", exc_info=True)
            return self._default_performance()
    
    def _build_portfolio_time_series(
        self,
        transactions: List[Transaction],
        price_lookup: Dict[int, Dict[datetime, float]],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[datetime, float]:
        """
        Build mark-to-market time series for portfolio.
        
        Args:
            transactions: All portfolio transactions
            price_lookup: Preloaded price data {asset_id: {date: price}}
            start_date: Start of time series
            end_date: End of time series
        
        Returns:
            Dict mapping date to portfolio value
        """
        from collections import defaultdict
        
        # Track holdings over time: {asset_id: quantity}
        holdings = defaultdict(float)
        
        # Apply all transactions up to start_date to get initial holdings
        for txn in transactions:
            if txn.tx_date <= start_date.date():
                qty = float(txn.quantity)
                if txn.type.value in ['BUY', 'DEPOSIT']:
                    holdings[txn.asset_id] += qty
                elif txn.type.value in ['SELL', 'WITHDRAWAL']:
                    holdings[txn.asset_id] -= qty
        
        # Build time series
        portfolio_values = {}
        
        # Get all unique dates from price data
        all_dates = set()
        for asset_prices in price_lookup.values():
            all_dates.update(asset_prices.keys())
        
        for date in sorted(all_dates):
            if isinstance(date, datetime):
                date = date.date()
            
            if date < start_date.date() or date > end_date.date():
                continue
            
            # Update holdings for any transactions on this date
            for txn in transactions:
                if txn.tx_date == date:
                    qty = float(txn.quantity)
                    if txn.type.value in ['BUY', 'DEPOSIT']:
                        holdings[txn.asset_id] += qty
                    elif txn.type.value in ['SELL', 'WITHDRAWAL']:
                        holdings[txn.asset_id] -= qty
            
            # Calculate portfolio value on this date
            portfolio_value = 0.0
            for asset_id, quantity in holdings.items():
                if quantity <= 0:
                    continue
                
                # Get price for this asset on this date (or closest previous date)
                asset_prices = price_lookup.get(asset_id, {})
                if date in asset_prices:
                    price = asset_prices[date]
                    portfolio_value += quantity * price
            
            if portfolio_value > 0:
                portfolio_values[datetime.combine(date, datetime.min.time())] = portfolio_value
        
        return portfolio_values
    
    def _default_performance(self) -> Dict[str, float]:
        """
        Return default conservative performance assumptions.
        
        Returns:
            Dict with default annual_return and volatility (as decimals)
        """
        return {
            'annual_return': DEFAULT_ANNUAL_RETURN,
            'volatility': DEFAULT_VOLATILITY
        }
    
    def run_monte_carlo_simulation(
        self,
        current_value: float,
        target_amount: float,
        monthly_contribution: float,
        months: int,
        annual_return: float,
        volatility: float,
        iterations: int = 1000,
        seed: Optional[int] = None
    ) -> float:
        """
        Run Monte Carlo simulation to calculate probability of achieving goal.
        
        Uses geometric Brownian motion with Box-Muller transform for
        normally distributed returns.
        
        Args:
            current_value: Current portfolio value
            target_amount: Goal target amount
            monthly_contribution: Monthly contribution amount
            months: Number of months to target date
            annual_return: Expected annual return (decimal, e.g., 0.08 = 8%)
            volatility: Annual volatility (decimal, e.g., 0.15 = 15%)
            iterations: Number of simulation iterations (min 100)
            seed: Optional random seed for reproducibility
        
        Returns:
            Probability of achieving goal (decimal, 0.0 to 1.0)
        """
        if current_value >= target_amount:
            return 1.0
        
        # Apply safety limits
        months = min(months, MAX_MONTHS_HORIZON)
        if months <= 0:
            return 0.0
        
        iterations = max(iterations, MIN_MONTE_CARLO_ITERATIONS)
        
        # Use local Random instance if seed provided
        rng = random.Random(seed) if seed is not None else random
        
        # GBM parameters
        dt = 1.0 / 12.0  # Monthly time step
        drift = annual_return - 0.5 * (volatility ** 2)
        vol_sqrt_dt = volatility * math.sqrt(dt)
        
        success_count = 0
        
        for _ in range(iterations):
            value = current_value
            
            for _ in range(months):
                # Add monthly contribution
                value += monthly_contribution
                
                # Generate standard normal random variable using Box-Muller
                u1 = rng.random()
                u2 = rng.random()
                z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
                
                # Apply GBM step: value *= exp(drift * dt + volatility * sqrt(dt) * z)
                value *= math.exp(drift * dt + vol_sqrt_dt * z)
            
            if value >= target_amount:
                success_count += 1
        
        return success_count / iterations
    
    def run_monte_carlo_paths(
        self,
        current_value: float,
        monthly_contribution: float,
        months: int,
        annual_return: float,
        volatility: float,
        iterations: int = 1000,
        seed: Optional[int] = None
    ) -> List[float]:
        """
        Run Monte Carlo simulation and return all final values.
        
        Useful for generating quantile-based scenarios from the full
        distribution of outcomes.
        
        Args:
            current_value: Current portfolio value
            monthly_contribution: Monthly contribution amount
            months: Number of months to project
            annual_return: Expected annual return (decimal)
            volatility: Annual volatility (decimal)
            iterations: Number of simulation iterations (min 100)
            seed: Optional random seed for reproducibility
        
        Returns:
            List of final portfolio values from all iterations
        """
        # Apply safety limits
        months = min(months, MAX_MONTHS_HORIZON)
        if months <= 0:
            return [current_value] * iterations
        
        iterations = max(iterations, MIN_MONTE_CARLO_ITERATIONS)
        
        # Use local Random instance if seed provided
        rng = random.Random(seed) if seed is not None else random
        
        # GBM parameters
        dt = 1.0 / 12.0  # Monthly time step
        drift = annual_return - 0.5 * (volatility ** 2)
        vol_sqrt_dt = volatility * math.sqrt(dt)
        
        final_values = []
        
        for _ in range(iterations):
            value = current_value
            
            for _ in range(months):
                # Add monthly contribution
                value += monthly_contribution
                
                # Generate standard normal random variable using Box-Muller
                u1 = rng.random()
                u2 = rng.random()
                z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
                
                # Apply GBM step: value *= exp(drift * dt + volatility * sqrt(dt) * z)
                value *= math.exp(drift * dt + vol_sqrt_dt * z)
            
            final_values.append(max(0, value))  # Ensure non-negative
        
        return final_values
    
    def _quantile(self, sorted_values: List[float], q: float) -> float:
        """
        Calculate quantile from sorted values using robust index calculation.
        
        Args:
            sorted_values: List of values (must be sorted)
            q: Quantile to calculate (0.0 to 1.0)
        
        Returns:
            Value at the specified quantile
        """
        n = len(sorted_values)
        if n == 0:
            return 0.0
        
        idx = max(0, min(n - 1, int(q * (n - 1))))
        return sorted_values[idx]
    
    def _build_scenarios_from_distribution(
        self,
        final_values: List[float],
        months_remaining: int,
        current_value: float,
        monthly_contribution: float,
        annual_return: float
    ) -> List[ScenarioResult]:
        """
        Build scenario projections from Monte Carlo distribution using quantiles.
        
        Extracts P10 (pessimistic), P50 (median), P90 (optimistic) from the
        distribution and calculates implied returns for each scenario.
        
        Args:
            final_values: List of final portfolio values from Monte Carlo
            months_remaining: Months to target date
            current_value: Current portfolio value
            monthly_contribution: Monthly contribution
            annual_return: Historical annual return
        
        Returns:
            List of three ScenarioResult objects (pessimistic, median, optimistic)
        """
        # Sort values for quantile extraction
        sorted_values = sorted(final_values)
        
        # Extract quantile values
        pessimistic_value = self._quantile(sorted_values, QUANTILE_PESSIMISTIC)
        median_value = self._quantile(sorted_values, QUANTILE_MEDIAN)
        optimistic_value = self._quantile(sorted_values, QUANTILE_OPTIMISTIC)
        
        # Calculate implied annual returns from final values using continuous compounding
        def calculate_implied_return(final_value: float) -> float:
            """Calculate implied annual return from final value using log-normal approach"""
            if months_remaining == 0 or current_value <= 0:
                return annual_return
            
            years = months_remaining / 12.0
            total_contributions = monthly_contribution * months_remaining
            
            # Adjusted initial value accounting for average contribution timing
            adjusted_initial = current_value + total_contributions / 2
            
            if adjusted_initial <= 0 or final_value <= 0:
                return annual_return
            
            # Implied return: r = ln(final / initial) / years
            implied_r = math.log(final_value / adjusted_initial) / years if years > 0 else annual_return
            
            # Clamp to reasonable bounds
            return max(MIN_ANNUAL_RETURN, min(MAX_ANNUAL_RETURN, implied_r))
        
        pessimistic_return = calculate_implied_return(pessimistic_value)
        median_return = calculate_implied_return(median_value)
        optimistic_return = calculate_implied_return(optimistic_value)
        
        # Build scenario results with quantiles (NO individual probabilities)
        scenarios = [
            ScenarioResult(
                label="Pessimistic",
                return_rate=pessimistic_return,
                projected_months=months_remaining,
                projected_amount=pessimistic_value,
                quantile=QUANTILE_PESSIMISTIC,
                color="red"
            ),
            ScenarioResult(
                label="Median",
                return_rate=median_return,
                projected_months=months_remaining,
                projected_amount=median_value,
                quantile=QUANTILE_MEDIAN,
                color="blue"
            ),
            ScenarioResult(
                label="Optimistic",
                return_rate=optimistic_return,
                projected_months=months_remaining,
                projected_amount=optimistic_value,
                   quantile=QUANTILE_OPTIMISTIC,
                color="green"
            )
        ]
        
        return scenarios
    
    def calculate_scenarios(
        self,
        final_values: List[float],
        months_remaining: int,
        current_value: float,
        monthly_contribution: float,
        annual_return: float
    ) -> List[ScenarioResult]:
        """
        DEPRECATED: Use _build_scenarios_from_distribution instead.
        
        This method is kept for backward compatibility but now just delegates
        to the internal helper method.
        
        Args:
            final_values: List of final portfolio values from Monte Carlo
            months_remaining: Months to target date
            current_value: Current portfolio value
            monthly_contribution: Monthly contribution
            annual_return: Historical annual return
        
        Returns:
            List of ScenarioResult objects (pessimistic, median, optimistic)
        """
        return self._build_scenarios_from_distribution(
            final_values,
            months_remaining,
            current_value,
            monthly_contribution,
            annual_return
        )
    
    def calculate_milestones(
        self,
        current_value: float,
        target_amount: float
    ) -> List[MilestoneResult]:
        """
        Calculate progress milestones (25%, 50%, 75%, 100%).
        
        Args:
            current_value: Current portfolio value
            target_amount: Goal target amount
        
        Returns:
            List of MilestoneResult objects
        """
        milestones_config = [
            {'percentage': 25, 'label': 'Quarter Way'},
            {'percentage': 50, 'label': 'Halfway There'},
            {'percentage': 75, 'label': 'Three Quarters'},
            {'percentage': 100, 'label': 'Goal Reached!'}
        ]
        
        results = []
        for config in milestones_config:
            amount = target_amount * (config['percentage'] / 100.0)
            achieved = current_value >= amount
            
            results.append(MilestoneResult(
                percentage=config['percentage'],
                amount=amount,
                achieved=achieved,
                label=config['label']
            ))
        
        return results
    
    def calculate_goal_projections(
        self,
        portfolio_id: int,
        current_value: float,
        target_amount: float,
        monthly_contribution: float,
        target_date: Optional[str],
        seed: Optional[int] = None
    ) -> GoalProjectionResult:
        """
        Calculate complete goal projections including scenarios, milestones, and probability.
        
        Uses a single Monte Carlo simulation run to compute both scenarios and achievement probability.
        
        Args:
            portfolio_id: Portfolio ID
            current_value: Current portfolio value
            target_amount: Goal target amount
            monthly_contribution: Monthly contribution
            target_date: Target date (ISO format string or None)
            seed: Optional random seed for reproducibility
        
        Returns:
            GoalProjectionResult with scenarios, milestones, probability, and performance metrics
        """
        # Get historical performance
        performance = self.calculate_portfolio_performance(portfolio_id)
        annual_return = performance['annual_return']
        volatility = performance['volatility']
        
        # Calculate target date months and check if target is in the past
        is_past_date = False
        if target_date:
            try:
                # Parse ISO format date string (e.g., "2025-11-06")
                if isinstance(target_date, str):
                    target_dt = datetime.fromisoformat(target_date)
                else:
                    # If it's a date object, convert to datetime
                    target_dt = datetime.combine(target_date, datetime.min.time())
                
                today = datetime.utcnow()
                days_diff = (target_dt - today).days
                
                if days_diff < 0:
                    # Target date is in the past
                    is_past_date = True
                    logger.warning(f"Target date {target_date} is in the past (by {abs(days_diff)} days)")
                    months_remaining = 1  # Use 1 month for past dates
                else:
                    # Normal future date
                    months_remaining = max(1, round(days_diff / 30.44))
            except Exception as e:
                logger.warning(f"Invalid target_date '{target_date}': {e}, using default 10 years")
                months_remaining = 120  # Default 10 years
        else:
            months_remaining = 120  # Default 10 years
        
        # Run Monte Carlo simulation ONCE to get final values distribution
        final_values = self.run_monte_carlo_paths(
            current_value=current_value,
            months=months_remaining,
            monthly_contribution=monthly_contribution,
            annual_return=annual_return,
            volatility=volatility,
            iterations=1000,
            seed=seed
        )
        
        # Build scenarios from the distribution using quantiles
        scenarios = self._build_scenarios_from_distribution(
            final_values=final_values,
            months_remaining=months_remaining,
            current_value=current_value,
            monthly_contribution=monthly_contribution,
            annual_return=annual_return
        )
        
        # Calculate milestones
        milestones = self.calculate_milestones(current_value, target_amount)
        
        # Calculate single global achievement probability from distribution
        global_probability = sum(1 for v in final_values if v >= target_amount) / len(final_values)
        
        # Generate warning for past target dates
        warning = None
        if is_past_date:
            warning = "Target date is in the past. Projections show immediate timeline with current trajectory."
        
        return GoalProjectionResult(
            scenarios=scenarios,
            milestones=milestones,
            probability=global_probability,
            historical_performance={
                'annual_return': annual_return,
                'annual_volatility': volatility
            },
            is_past_target_date=is_past_date,
            warning=warning
        )
