"""
Pydantic schemas for request/response validation
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.models import AssetClass, TransactionType


# ============================================================================
# Asset Schemas
# ============================================================================

class AssetBase(BaseModel):
    """Base asset schema"""
    symbol: str = Field(..., description="Yahoo Finance ticker symbol")
    name: Optional[str] = None
    currency: str = "USD"
    class_: AssetClass = Field(default=AssetClass.STOCK, alias="class")
    sector: Optional[str] = None
    industry: Optional[str] = None
    asset_type: Optional[str] = None  # 'EQUITY', 'ETF', 'CRYPTO', etc.
    country: Optional[str] = None


class AssetCreate(AssetBase):
    """Schema for creating an asset"""
    pass


class Asset(AssetBase):
    """Asset response schema"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Portfolio Schemas
# ============================================================================

class PortfolioBase(BaseModel):
    """Base portfolio schema"""
    name: str
    base_currency: str = "EUR"
    description: Optional[str] = None


class PortfolioCreate(PortfolioBase):
    """Schema for creating a portfolio"""
    pass


class Portfolio(PortfolioBase):
    """Portfolio response schema"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Transaction Schemas
# ============================================================================

class TransactionBase(BaseModel):
    """Base transaction schema"""
    asset_id: int
    tx_date: date
    type: TransactionType
    quantity: Decimal = Field(ge=0, decimal_places=8)
    price: Decimal = Field(ge=0, decimal_places=8)
    fees: Decimal = Field(default=Decimal(0), ge=0, decimal_places=8)
    currency: str = "USD"
    meta_data: Dict[str, Any] = Field(default={}, alias="metadata")
    notes: Optional[str] = None


class TransactionCreate(TransactionBase):
    """Schema for creating a transaction"""
    pass


class Transaction(TransactionBase):
    """Transaction response schema"""
    id: int
    portfolio_id: int
    created_at: datetime
    updated_at: datetime
    
    # Include asset details
    asset: Optional[Asset] = None
    
    @field_validator('meta_data', mode='before')
    @classmethod
    def validate_metadata(cls, v: Any) -> Dict[str, Any]:
        """Ensure metadata is always a dict"""
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        # Handle special JSON objects
        return {}
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Price Schemas
# ============================================================================

class PriceBase(BaseModel):
    """Base price schema"""
    asset_id: int
    asof: datetime
    price: Decimal
    volume: Optional[int] = None
    source: str = "yfinance"


class PriceCreate(PriceBase):
    """Schema for creating a price"""
    pass


class Price(PriceBase):
    """Price response schema"""
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PriceQuote(BaseModel):
    """Simplified price quote"""
    symbol: str
    price: Decimal
    asof: datetime
    currency: str
    daily_change_pct: Optional[Decimal] = None


# ============================================================================
# Portfolio Analytics Schemas
# ============================================================================

class Position(BaseModel):
    """Portfolio position"""
    asset_id: int
    symbol: str
    name: Optional[str]
    quantity: Decimal
    avg_cost: Decimal  # PRU (Prix de Revient Unitaire)
    current_price: Optional[Decimal]
    market_value: Optional[Decimal]
    cost_basis: Decimal
    unrealized_pnl: Optional[Decimal]
    unrealized_pnl_pct: Optional[Decimal]
    daily_change_pct: Optional[Decimal]  # Daily price change percentage
    currency: str
    last_updated: Optional[datetime]
    asset_type: Optional[str] = None


class PortfolioMetrics(BaseModel):
    """Portfolio-level metrics"""
    portfolio_id: int
    portfolio_name: str
    total_value: Decimal
    total_cost: Decimal
    total_unrealized_pnl: Decimal
    total_unrealized_pnl_pct: Decimal
    total_realized_pnl: Decimal
    total_dividends: Decimal
    total_fees: Decimal
    positions_count: int
    last_updated: datetime


# ============================================================================
# Import Schemas
# ============================================================================

class CsvImportRow(BaseModel):
    """Single row from CSV import"""
    date: date
    symbol: str
    type: TransactionType
    quantity: Decimal = Field(default=Decimal(0))
    price: Decimal = Field(default=Decimal(0))
    fees: Decimal = Field(default=Decimal(0))
    currency: str = "USD"
    split_ratio: Optional[str] = None  # e.g., "2:1"
    notes: Optional[str] = None


class CsvImportResult(BaseModel):
    """Result of CSV import"""
    success: bool
    imported_count: int
    errors: List[str] = []
    warnings: List[str] = []


# ============================================================================
# Health Check
# ============================================================================

class HealthCheck(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime
    database: str
    version: str


# Portfolio value history point for charting
class PortfolioHistoryPoint(BaseModel):
    date: str  # ISO date string
    value: float
