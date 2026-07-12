"""
Risk analysis service - calculates risk scores and volatility metrics
"""
import logging
import math
from typing import Any, Dict, Optional
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models import Price

logger = logging.getLogger(__name__)


class RiskAnalysisService:
    """Service for calculating risk metrics and scores"""
    
    def __init__(self, db: Session):
        self.db = db
    
    @staticmethod
    def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
        """Clamp a value between min and max"""
        return max(min_value, min(max_value, value))
    
    @staticmethod
    def calculate_risk_score(metrics: Dict[str, Any]) -> Optional[float]:
        """
        Calculate a risk score (0-100) for a position based on various metrics.
        The score combines multiple factors like volatility, beta, distance to ATH, etc.
        
        Factors and weights:
        - Volatility (30%): Higher volatility = higher risk
        - Beta (25%): Higher beta = higher risk
        - Distance to ATH (15%): Farther from ATH = higher risk
        - Personal Drawdown (10%): Deeper drawdown = higher risk
        - Short-term momentum (15%): Underperformance = higher risk
        - Long-term momentum (5%): Extreme performance (either way) = higher risk
        """
        # Fetch raw metric values and convert to float for calculations
        distance_to_ath_pct = metrics.get("distance_to_ath_pct")
        personal_drawdown_pct = metrics.get("personal_drawdown_pct")
        vol_30d = metrics.get("volatility_30d")
        vol_90d = metrics.get("volatility_90d")
        beta = metrics.get("beta")
        rel_30d = metrics.get("relative_perf_30d")
        rel_1y = metrics.get("relative_perf_1y")
        
        # If no metrics available, return None
        if all(v is None for v in [
            distance_to_ath_pct, personal_drawdown_pct,
            vol_30d, vol_90d, beta, rel_30d, rel_1y
        ]):
            return None
        
        # Convert Decimal types to float for calculations
        if distance_to_ath_pct is not None:
            distance_to_ath_pct = float(distance_to_ath_pct)
        if personal_drawdown_pct is not None:
            personal_drawdown_pct = float(personal_drawdown_pct)
        if vol_30d is not None:
            vol_30d = float(vol_30d)
        if vol_90d is not None:
            vol_90d = float(vol_90d)
        if beta is not None:
            beta = float(beta)
        if rel_30d is not None:
            rel_30d = float(rel_30d)
        if rel_1y is not None:
            rel_1y = float(rel_1y)
        
        # Normalization of each factor to [0, 1]
        
        # Volatility: use 30d if available, otherwise 90d
        # Consider 80% annualized vol as "max risk"
        vol_source = vol_30d if vol_30d is not None else vol_90d
        if vol_source is None:
            vol_norm = 0.5  # neutral if no data
        else:
            vol_norm = RiskAnalysisService.clamp(vol_source / 80.0, 0.0, 1.0)
        
        # Beta: 0.8 => low neutral, 2.0 => very risky
        if beta is None:
            beta_norm = 0.5
        else:
            beta_norm = RiskAnalysisService.clamp((beta - 0.8) / 1.2, 0.0, 1.0)
        
        # Distance to ATH: the farther away, the higher the structural risk
        # Risk saturates beyond 60% below ATH
        if distance_to_ath_pct is None:
            dist_norm = 0.5
        else:
            dist = abs(distance_to_ath_pct)  # -60% => 60
            dist_norm = RiskAnalysisService.clamp(dist / 60.0, 0.0, 1.0)
        
        # Personal drawdown: combine historical volatility + psychological pain
        if personal_drawdown_pct is None:
            dd_norm = 0.5
        else:
            dd_norm = RiskAnalysisService.clamp(abs(personal_drawdown_pct) / 50.0, 0.0, 1.0)
        
        # Short-term momentum (30d):
        # Consider -30% underperformance vs sector as max risk
        if rel_30d is None:
            mom30_norm = 0.5
        else:
            mom30_norm = RiskAnalysisService.clamp(-rel_30d / 30.0, 0.0, 1.0)
        
        # Long-term momentum (1 year):
        # Strong underperformance = risk, but extreme outperformance also (penny mania)
        if rel_1y is None:
            mom1y_norm = 0.5
        else:
            # We take underperformance + extreme outperformance as risk
            mom1y_norm = RiskAnalysisService.clamp(abs(rel_1y) / 100.0, 0.0, 1.0)
        
        # Weighting of factors (sum of weights = 1.0)
        WEIGHTS = {
            "vol": 0.30,
            "beta": 0.25,
            "dist_ath": 0.15,
            "drawdown": 0.10,
            "mom30": 0.15,
            "mom1y": 0.05,
        }
        
        risk_0_1 = (
            WEIGHTS["vol"] * vol_norm +
            WEIGHTS["beta"] * beta_norm +
            WEIGHTS["dist_ath"] * dist_norm +
            WEIGHTS["drawdown"] * dd_norm +
            WEIGHTS["mom30"] * mom30_norm +
            WEIGHTS["mom1y"] * mom1y_norm
        )
        
        # Conversion to a 0–100 score
        risk_score = round(risk_0_1 * 100.0, 1)
        return risk_score
    
    def calculate_volatility(
        self,
        asset_id: int,
        days: int = 30
    ) -> Optional[float]:
        """
        Calculate annualized volatility for an asset over a given period
        
        Args:
            asset_id: Asset ID
            days: Number of days to look back (30, 90, etc.)
        
        Returns:
            Annualized volatility as a percentage (or None if insufficient data)
        """
        now = datetime.utcnow()
        
        prices = (
            self.db.query(Price.price, Price.asof)
            .filter(
                Price.asset_id == asset_id,
                Price.asof >= now - timedelta(days=days)
            )
            .order_by(Price.asof)
            .all()
        )
        
        if len(prices) < 2:
            return None
        
        # Calculate daily returns
        returns = []
        for i in range(1, len(prices)):
            prev_price = Decimal(str(prices[i-1][0]))
            curr_price = Decimal(str(prices[i][0]))
            if prev_price > 0:
                daily_return = float((curr_price - prev_price) / prev_price)
                returns.append(daily_return)
        
        if not returns:
            return None
        
        # Calculate standard deviation (volatility)
        mean_return = sum(returns) / len(returns)
        variance = sum((r - mean_return) ** 2 for r in returns) / len(returns)
        volatility = math.sqrt(variance) * math.sqrt(252) * 100  # Annualized
        
        return volatility
