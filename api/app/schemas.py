"""
Pydantic schemas for request/response validation
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
import re

from app.models import AssetClass, TransactionType, NotificationType


# ============================================================================
# User & Authentication Schemas
# ============================================================================

class UserBase(BaseModel):
    """Base user schema"""
    email: str
    username: str = Field(..., min_length=3, max_length=50)
    full_name: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        # Accept any TLD, just check basic email format
        if not isinstance(v, str):
            raise TypeError('Email must be a string')
        # Basic regex: must have @ and at least one . after @
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError('Invalid email format')
        return v


class UserCreate(UserBase):
    """Schema for user registration"""
    password: str = Field(
        ..., min_length=8, max_length=256,
        description="Password (hashed with bcrypt_sha256; supports long passwords)"
    )


class UserLogin(BaseModel):
    """Schema for user login"""
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not isinstance(v, str):
            raise TypeError('Email must be a string')
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError('Invalid email format')
        return v



class UserUpdate(BaseModel):
    """Schema for user update"""
    full_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    is_admin: Optional[bool] = None

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if v is None:
            return v
        if not isinstance(v, str):
            raise TypeError('Email must be a string')
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError('Invalid email format')
        return v


class UserPasswordChange(BaseModel):
    """Schema for password change"""
    current_password: str
    new_password: str = Field(
        ..., min_length=8, max_length=256,
        description="New password (hashed with bcrypt_sha256; supports long passwords)"
    )


class UserPasswordReset(BaseModel):
    """Schema for password reset request"""
    email: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not isinstance(v, str):
            raise TypeError('Email must be a string')
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError('Invalid email format')
        return v


class UserPasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    token: str
    new_password: str = Field(
        ..., min_length=8, max_length=256,
        description="New password (hashed with bcrypt_sha256; supports long passwords)"
    )


class User(UserBase):
    """User response schema"""
    id: int
    is_active: bool
    is_verified: bool
    is_superuser: bool
    is_admin: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# ================================
# Admin-only user management
# ================================

class AdminUserCreate(UserBase):
    """Admin schema for creating a user"""
    password: str = Field(
        ..., min_length=8, max_length=256,
        description="Password (hashed with bcrypt_sha256; supports long passwords)"
    )
    is_admin: bool = False
    is_active: bool = True
    is_verified: bool = False


class AdminUserUpdate(BaseModel):
    """Admin schema for updating a user"""
    full_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_verified: Optional[bool] = None
    password: Optional[str] = Field(
        default=None, min_length=8, max_length=256,
        description="Optional: update password"
    )


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    user: User


class TokenData(BaseModel):
    """Token payload data"""
    user_id: Optional[int] = None
    email: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if v is None:
            return v
        if not isinstance(v, str):
            raise TypeError('Email must be a string')
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError('Invalid email format')
        return v


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
    user_id: int
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
    quantity: Decimal = Field(ge=0, decimal_places=12)
    price: Decimal = Field(ge=0, decimal_places=12)
    fees: Decimal = Field(default=Decimal(0), ge=0, decimal_places=12)
    currency: str = "USD"
    notes: Optional[str] = None


class TransactionCreate(TransactionBase):
    """Schema for creating a transaction"""
    # Accept 'metadata' in JSON input, store as 'meta_data' in Python
    meta_data: Dict[str, Any] = Field(default={}, alias="metadata")
    
    model_config = ConfigDict(populate_by_name=True)
    
    @field_validator('meta_data')
    @classmethod
    def validate_split_ratio(cls, v: Dict[str, Any], info) -> Dict[str, Any]:
        """Validate split ratio format if transaction is a SPLIT"""
        # Access the transaction type from the model being validated
        if hasattr(info, 'data') and info.data.get('type') == TransactionType.SPLIT:
            split_ratio = v.get('split', '')
            if not split_ratio:
                raise ValueError('SPLIT transactions must include a "split" ratio in metadata (e.g., {"split": "2:1"})')
            
            # Validate format: must be "N:M" where N and M are positive numbers
            if not isinstance(split_ratio, str):
                raise ValueError('Split ratio must be a string in format "N:M" (e.g., "2:1")')
            
            if ':' not in split_ratio:
                raise ValueError('Split ratio must be in format "N:M" (e.g., "2:1", "3:2", "1:10")')
            
            parts = split_ratio.split(':')
            if len(parts) != 2:
                raise ValueError('Split ratio must contain exactly one colon (e.g., "2:1")')
            
            try:
                numerator = float(parts[0].strip())
                denominator = float(parts[1].strip())
            except ValueError:
                raise ValueError('Split ratio parts must be valid numbers (e.g., "2:1", not "abc:def")')
            
            if numerator <= 0 or denominator <= 0:
                raise ValueError('Split ratio parts must be positive numbers (e.g., "2:1", not "0:1" or "-2:1")')
            
            if numerator == 0 and denominator == 0:
                raise ValueError('Split ratio cannot be "0:0"')
        
        return v


class Transaction(TransactionBase):
    """Transaction response schema"""
    id: int
    portfolio_id: int
    created_at: datetime
    updated_at: datetime
    # Read from meta_data attribute, serialize as 'metadata' in JSON
    meta_data: Dict[str, Any] = Field(default={}, serialization_alias="metadata")
    
    # Include asset details
    asset: Optional[Asset] = None
    
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


# ============================================================================
# Watchlist Schemas
# ============================================================================

class WatchlistItemBase(BaseModel):
    """Base watchlist item schema"""
    asset_id: int
    notes: Optional[str] = None
    alert_target_price: Optional[Decimal] = None
    alert_enabled: bool = False


class WatchlistItemCreate(WatchlistItemBase):
    """Schema for creating a watchlist item"""
    pass


class WatchlistItemUpdate(BaseModel):
    """Schema for updating a watchlist item"""
    notes: Optional[str] = None
    alert_target_price: Optional[Decimal] = None
    alert_enabled: Optional[bool] = None


class WatchlistItem(WatchlistItemBase):
    """Watchlist item response schema"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    # Include asset details
    asset: Optional[Asset] = None
    
    model_config = ConfigDict(from_attributes=True)


class WatchlistItemWithPrice(BaseModel):
    """Watchlist item with current price data"""
    id: int
    user_id: int
    asset_id: int
    symbol: str
    name: Optional[str]
    notes: Optional[str]
    alert_target_price: Optional[Decimal]
    alert_enabled: bool
    current_price: Optional[Decimal]
    daily_change_pct: Optional[Decimal]
    currency: str
    asset_type: Optional[str]
    last_updated: Optional[datetime]
    created_at: datetime


class WatchlistImportItem(BaseModel):
    """Single item for watchlist import"""
    symbol: str
    notes: Optional[str] = None
    alert_target_price: Optional[Decimal] = None
    alert_enabled: bool = False


class WatchlistImportResult(BaseModel):
    """Result of watchlist import"""
    success: bool
    imported_count: int
    errors: List[str] = []
    warnings: List[str] = []


# ============================================================================
# Watchlist Convert Payload
# ============================================================================

class WatchlistConvertToBuy(BaseModel):
    """Request body for converting a watchlist item into a BUY transaction"""
    portfolio_id: int
    quantity: Decimal
    price: Decimal
    tx_date: Optional[str] = None
    fees: Decimal = Field(default=Decimal(0))


# ============================================================================
# Notification Schemas
# ============================================================================

class NotificationBase(BaseModel):
    """Base notification schema"""
    type: NotificationType
    title: str
    message: str
    meta_data: Dict[str, Any] = Field(default={}, alias="metadata")


class NotificationCreate(NotificationBase):
    """Schema for creating a notification"""
    user_id: int


class Notification(NotificationBase):
    """Notification response schema"""
    id: int
    user_id: int
    is_read: bool
    created_at: datetime
    
    model_config = ConfigDict(populate_by_name=True)


class NotificationUpdate(BaseModel):
    """Schema for updating a notification"""
    is_read: Optional[bool] = None
