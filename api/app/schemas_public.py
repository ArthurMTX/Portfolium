from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class PublicTimeSeriesPoint(BaseModel):
    """Time series data point for public view"""
    date: str
    value: Decimal

class PublicPerformanceMetrics(BaseModel):
    """Public performance metrics (percentages only)"""
    period: str
    total_return_pct: Decimal
    annualized_return: Decimal
    best_day_date: Optional[str]
    worst_day_date: Optional[str]
    positive_days: int
    negative_days: int
    win_rate: Decimal

class PublicRiskMetrics(BaseModel):
    """Public risk metrics"""
    period: str
    volatility: Decimal
    sharpe_ratio: Optional[Decimal]
    max_drawdown: Decimal
    max_drawdown_date: Optional[str]
    beta: Optional[Decimal]

class PublicSectorAllocation(BaseModel):
    """Public sector allocation (percentages only)"""
    sector: str
    percentage: Decimal

class PublicGeographicAllocation(BaseModel):
    """Public geographic allocation (percentages only)"""
    country: str
    percentage: Decimal

class PublicHolding(BaseModel):
    """Public holding information (sanitized)"""
    symbol: str
    name: Optional[str]
    sector: Optional[str]
    industry: Optional[str]
    country: Optional[str]
    weight_pct: Decimal
    asset_type: Optional[str]

class PublicPortfolioInsights(BaseModel):
    """Public portfolio insights (sanitized)"""
    portfolio_id: int
    portfolio_name: str
    owner_username: str
    as_of_date: datetime
    period: str
    
    # Allocation (percentages only)
    sector_allocation: List[PublicSectorAllocation]
    geographic_allocation: List[PublicGeographicAllocation]
    
    # Holdings
    holdings: List[PublicHolding]
    
    model_config = ConfigDict(from_attributes=True)
