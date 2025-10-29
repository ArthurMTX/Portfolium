# Data Models

Technical documentation for SQLAlchemy ORM models and Pydantic validation schemas.

## Overview

Portfolium uses a two-layer data validation architecture:

1. **SQLAlchemy ORM Models**: Database schema definition and persistence
2. **Pydantic Schemas**: API request/response validation and serialization

This separation ensures database integrity while providing clean API contracts.

## Architecture

### Model Locations

- **ORM Models**: `api/app/models.py`
- **Pydantic Schemas**: `api/app/schemas.py`
- **Database**: PostgreSQL 14+ with `portfolio` schema

### Design Principles

1. **Single Responsibility**: Each model represents one entity
2. **Declarative Base**: All models inherit from SQLAlchemy `Base`
3. **Schema Separation**: PostgreSQL schema `portfolio` for organization
4. **Cascade Rules**: Explicit cascade behavior on relationships
5. **Type Safety**: Enumerations for fixed value sets
6. **High Precision**: `Numeric(20, 8)` for financial data

## Enumeration Types

### AssetClass

```python
class AssetClass(str, enum.Enum):
    """Asset class enumeration for categorizing financial assets."""
    
    STOCK = "stock"       # Individual company stock (e.g., AAPL, MSFT)
    ETF = "etf"           # Exchange-traded fund (e.g., SPY, QQQ)
    CRYPTO = "crypto"     # Cryptocurrency (e.g., BTC-USD, ETH-USD)
    CASH = "cash"         # Cash or money market
```

**Usage**:

```python
asset = Asset(symbol="AAPL", class_=AssetClass.STOCK)
asset = Asset(symbol="BTC-USD", class_=AssetClass.CRYPTO)
```

**Database Storage**: String values (`'stock'`, `'etf'`, `'crypto'`, `'cash'`)

### TransactionType

```python
class TransactionType(str, enum.Enum):
    """Transaction type enumeration for tracking portfolio activities."""
    
    BUY = "BUY"                     # Purchase of shares
    SELL = "SELL"                   # Sale of shares
    DIVIDEND = "DIVIDEND"           # Dividend payment
    FEE = "FEE"                     # Broker fee or other charge
    SPLIT = "SPLIT"                 # Stock split (adjusts shares)
    TRANSFER_IN = "TRANSFER_IN"     # External transfer into portfolio
    TRANSFER_OUT = "TRANSFER_OUT"   # External transfer out of portfolio
```

**Usage**:

```python
# Buy transaction
txn = Transaction(type=TransactionType.BUY, quantity=100, price=150.25)

# Split transaction (metadata contains ratio)
split = Transaction(
    type=TransactionType.SPLIT,
    quantity=0,  # No shares purchased
    price=0,
    meta_data={"split": "2:1"}
)
```

**Quantity Behavior**:

- `BUY`, `DIVIDEND`, `TRANSFER_IN`: Positive quantity increases position
- `SELL`, `FEE`, `TRANSFER_OUT`: Positive quantity decreases position
- `SPLIT`: Quantity is 0, ratio in `meta_data` multiplies existing shares

### NotificationType

```python
class NotificationType(str, enum.Enum):
    """Notification type enumeration for user alerts."""
    
    TRANSACTION_CREATED = "TRANSACTION_CREATED"   # New transaction added
    TRANSACTION_UPDATED = "TRANSACTION_UPDATED"   # Transaction modified
    TRANSACTION_DELETED = "TRANSACTION_DELETED"   # Transaction removed
    LOGIN = "LOGIN"                               # User logged in
    PRICE_ALERT = "PRICE_ALERT"                   # Watchlist price target hit
    DAILY_CHANGE_UP = "DAILY_CHANGE_UP"           # Asset gained > threshold %
    DAILY_CHANGE_DOWN = "DAILY_CHANGE_DOWN"       # Asset lost > threshold %
    SYSTEM = "SYSTEM"                             # Admin/system message
```

**Usage**:

```python
notification = Notification(
    user_id=1,
    type=NotificationType.DAILY_CHANGE_UP,
    title="AAPL +5.2%",
    message="Apple Inc. is up 5.2% today ($150.25)"
)
```

## ORM Models

### User

```python
class User(Base):
    """Application user with authentication and notification settings."""
    
    __tablename__ = "users"
    __table_args__ = {"schema": "portfolio"}
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Authentication
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)  # bcrypt_sha256
    
    # Profile
    full_name = Column(String)
    
    # Account status
    is_active = Column(Boolean, default=False)         # Email verified
    is_verified = Column(Boolean, default=False)       # Email confirmation
    is_superuser = Column(Boolean, default=False)      # Full admin access
    is_admin = Column(Boolean, default=False)          # Admin panel access
    
    # Email verification
    verification_token = Column(String, index=True)
    verification_token_expires = Column(DateTime)
    
    # Password reset
    reset_password_token = Column(String, index=True)
    reset_password_token_expires = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Notification preferences
    daily_change_notifications_enabled = Column(Boolean, default=True)
    daily_change_threshold_pct = Column(Numeric(5, 2), default=5.0)  # 5%
    transaction_notifications_enabled = Column(Boolean, default=True)
    
    # Relationships
    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
```

**Indexes**:

- `email` (unique): Login lookup
- `username` (unique): Profile/display name
- `verification_token`: Email verification
- `reset_password_token`: Password reset

**Cascade Behavior**:

```python
# Deleting user cascades to portfolios
user = db.query(User).get(1)
db.delete(user)  # Also deletes all user's portfolios
db.commit()
```

**Password Hashing**:

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")

# Hash password
hashed = pwd_context.hash("MySecurePassword123")

# Verify password
is_valid = pwd_context.verify("MySecurePassword123", hashed)
```

**Notification Settings**:

- `daily_change_notifications_enabled`: Enable/disable daily change alerts
- `daily_change_threshold_pct`: Minimum % change to trigger alert (default 5%)
- `transaction_notifications_enabled`: Enable/disable transaction alerts

### Asset

```python
class Asset(Base):
    """Financial asset (stock, ETF, cryptocurrency)."""
    
    __tablename__ = "assets"
    __table_args__ = {"schema": "portfolio"}
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Asset identification
    symbol = Column(String, unique=True, nullable=False, index=True)  # Ticker
    name = Column(String)  # Company/fund name
    
    # Classification
    currency = Column(String, default="USD")
    class_ = Column(
        "class",  # Column name in database
        Enum(AssetClass, values_callable=lambda x: [e.value for e in x]),
        default=AssetClass.STOCK
    )
    sector = Column(String)         # e.g., "Technology", "Healthcare"
    industry = Column(String)       # e.g., "Software", "Pharmaceuticals"
    asset_type = Column(String)     # e.g., "EQUITY", "ETF", "CRYPTO"
    country = Column(String)        # e.g., "US", "GB", "JP"
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Logo caching (see Logo Fetching documentation)
    logo_data = Column(LargeBinary)           # WebP or SVG bytes
    logo_content_type = Column(String)        # MIME type
    logo_fetched_at = Column(DateTime)        # Cache timestamp
    
    # Relationships
    transactions = relationship("Transaction", back_populates="asset")
    prices = relationship("Price", back_populates="asset", cascade="all, delete-orphan")
```

**Indexes**:

- `symbol` (unique): Quick asset lookup by ticker

**Logo Caching**:

```python
# Serve logo from cache
if asset.logo_data:
    return Response(
        content=asset.logo_data,
        media_type=asset.logo_content_type
    )
else:
    # Fetch, cache, serve (see Logo Fetching docs)
    pass
```

**Column Name Mapping**:

```python
# Python: asset.class_
# Database: asset.class
# Reason: "class" is Python keyword, use class_ as attribute
```

### Portfolio

```python
class Portfolio(Base):
    """Investment portfolio belonging to a user."""
    
    __tablename__ = "portfolios"
    __table_args__ = {"schema": "portfolio"}
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key
    user_id = Column(
        Integer,
        ForeignKey("portfolio.users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Portfolio metadata
    name = Column(String, nullable=False, index=True)
    base_currency = Column(String, default="EUR")  # Currency for calculations
    description = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="portfolios")
    transactions = relationship(
        "Transaction",
        back_populates="portfolio",
        cascade="all, delete-orphan"
    )
```

**Indexes**:

- `name`: List/search portfolios by name
- `user_id` (foreign key): Implicit index for user's portfolios

**Cascade Behavior**:

```python
# Deleting portfolio cascades to transactions
portfolio = db.query(Portfolio).get(1)
db.delete(portfolio)  # Also deletes all portfolio's transactions
db.commit()

# Deleting user cascades through to transactions
user = db.query(User).get(1)
db.delete(user)  # Deletes portfolios AND their transactions
db.commit()
```

**Base Currency**:

All portfolio calculations (total value, P&L, etc.) are converted to `base_currency` using currency conversion service.

### Transaction

```python
class Transaction(Base):
    """Portfolio transaction (buy, sell, dividend, split, etc.)."""
    
    __tablename__ = "transactions"
    __table_args__ = {"schema": "portfolio"}
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    portfolio_id = Column(
        Integer,
        ForeignKey("portfolio.portfolios.id", ondelete="CASCADE"),
        nullable=False
    )
    asset_id = Column(
        Integer,
        ForeignKey("portfolio.assets.id", ondelete="RESTRICT"),
        nullable=False
    )
    
    # Transaction details
    tx_date = Column(Date, nullable=False, index=True)
    type = Column(Enum(TransactionType), nullable=False)
    quantity = Column(Numeric(20, 8), nullable=False, default=0)
    price = Column(Numeric(20, 8), nullable=False, default=0)
    fees = Column(Numeric(20, 8), nullable=False, default=0)
    currency = Column(String, default="USD")
    
    # Additional data
    meta_data = Column("metadata", JSON, default={})  # Flexible data storage
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="transactions")
    asset = relationship("Asset", back_populates="transactions")
```

**Indexes**:

- `tx_date`: Date-range queries for history charts
- `portfolio_id` (foreign key): Get all portfolio transactions
- `asset_id` (foreign key): Get all transactions for an asset

**Cascade Behavior**:

```python
# Portfolio deletion cascades
portfolio = db.query(Portfolio).get(1)
db.delete(portfolio)  # Deletes transactions
db.commit()

# Asset deletion RESTRICTED (cannot delete if transactions exist)
asset = db.query(Asset).filter_by(symbol="AAPL").first()
db.delete(asset)  # Raises IntegrityError if transactions reference it
db.commit()
```

**Rationale**: Prevent accidental data loss from asset deletion.

**Metadata Examples**:

```python
# Stock split
txn.meta_data = {"split": "2:1"}

# Import source
txn.meta_data = {"import_file": "transactions_2024.csv", "row_number": 15}

# Broker reference
txn.meta_data = {"broker": "Interactive Brokers", "order_id": "U12345678"}
```

**Precision**:

```python
quantity = Numeric(20, 8)  # Up to 12 integer digits, 8 decimal places
price = Numeric(20, 8)     # Same
fees = Numeric(20, 8)      # Same

# Examples:
# quantity: 123456789.12345678 (crypto micro-amounts)
# price: 1234.567890 (high precision per-share price)
# fees: 9.99 (typical broker fee)
```

### Price

```python
class Price(Base):
    """Asset price cache from yfinance."""
    
    __tablename__ = "prices"
    __table_args__ = {"schema": "portfolio"}
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key
    asset_id = Column(
        Integer,
        ForeignKey("portfolio.assets.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Price data
    asof = Column(DateTime, nullable=False, index=True)  # Timestamp
    price = Column(Numeric(20, 8), nullable=False)
    volume = Column(BigInteger)  # Trading volume (large numbers)
    source = Column(String, default="yfinance")
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    asset = relationship("Asset", back_populates="prices")
```

**Indexes**:

- `asof`: Time-series queries (historical charts)
- `asset_id` (foreign key): Get all prices for an asset

**Cascade Behavior**:

```python
# Asset deletion cascades to prices
asset = db.query(Asset).filter_by(symbol="AAPL").first()
db.delete(asset)  # Also deletes price cache
db.commit()
```

**TTL Logic** (not in model, handled by service):

```python
# In PricingService
def _is_cache_valid(self, price: Price) -> bool:
    age = datetime.utcnow() - price.asof
    return age.total_seconds() < settings.PRICE_CACHE_TTL_SECONDS
```

### Watchlist

```python
class Watchlist(Base):
    """User watchlist for tracking assets without ownership."""
    
    __tablename__ = "watchlist"
    __table_args__ = {"schema": "portfolio"}
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    user_id = Column(
        Integer,
        ForeignKey("portfolio.users.id", ondelete="CASCADE"),
        nullable=False
    )
    asset_id = Column(
        Integer,
        ForeignKey("portfolio.assets.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Watchlist entry data
    notes = Column(Text)
    alert_target_price = Column(Numeric(20, 8))  # Price alert threshold
    alert_enabled = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    asset = relationship("Asset")
```

**Price Alerts**:

```python
# Set price alert
watchlist_entry = Watchlist(
    user_id=1,
    asset_id=5,  # AAPL
    alert_target_price=Decimal("160.00"),
    alert_enabled=True,
    notes="Buy if drops to $160"
)

# Scheduler checks periodically
if asset.current_price <= watchlist_entry.alert_target_price:
    send_notification(user, f"AAPL hit target price ${alert_target_price}")
```

### Notification

```python
class Notification(Base):
    """User notification for alerts and activity."""
    
    __tablename__ = "notifications"
    __table_args__ = {"schema": "portfolio"}
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key
    user_id = Column(
        Integer,
        ForeignKey("portfolio.users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Notification content
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    meta_data = Column("metadata", JSON, default={})
    
    # Status
    is_read = Column(Boolean, default=False)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User")
```

**Indexes**:

- `created_at`: Sort notifications chronologically
- `user_id` (foreign key): Get user's notifications

**Metadata Examples**:

```python
# Transaction notification
notif.meta_data = {
    "transaction_id": 123,
    "symbol": "AAPL",
    "quantity": 100,
    "price": 150.25
}

# Price alert
notif.meta_data = {
    "asset_id": 5,
    "symbol": "AAPL",
    "target_price": 160.00,
    "current_price": 159.50
}

# Daily change
notif.meta_data = {
    "symbol": "TSLA",
    "change_pct": -6.2,
    "previous_close": 250.00,
    "current_price": 234.50
}
```

**Mark as Read**:

```python
notification = db.query(Notification).get(42)
notification.is_read = True
db.commit()
```

## Pydantic Schemas

### Schema Purpose

Pydantic schemas serve three functions:

1. **Request Validation**: Validate incoming API data
2. **Response Serialization**: Convert ORM models to JSON
3. **Documentation**: Auto-generate OpenAPI/Swagger docs

### Schema Patterns

**Base Schema**:

```python
class PortfolioBase(BaseModel):
    """Shared fields for portfolio schemas."""
    name: str
    base_currency: str = "EUR"
    description: Optional[str] = None
```

**Create Schema** (inherits Base, adds creation fields):

```python
class PortfolioCreate(PortfolioBase):
    """Schema for creating a portfolio."""
    # Inherits name, base_currency, description
    # No additional fields needed
    pass
```

**Update Schema** (all fields optional):

```python
class PortfolioUpdate(BaseModel):
    """Schema for updating a portfolio."""
    name: Optional[str] = None
    base_currency: Optional[str] = None
    description: Optional[str] = None
```

**Response Schema** (includes database fields):

```python
class PortfolioResponse(PortfolioBase):
    """Schema for portfolio API responses."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    # Allows: PortfolioResponse.model_validate(orm_portfolio)
```

### Validation Examples

#### Email Validation

```python
class UserCreate(BaseModel):
    email: str
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not isinstance(v, str):
            raise TypeError('Email must be a string')
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError('Invalid email format')
        return v
```

**Rejects**:

- `"not-an-email"`
- `"missing@domain"`
- `"spaces in@email.com"`

**Accepts**:

- `"user@example.com"`
- `"user.name+tag@subdomain.example.co.uk"`

#### Password Validation

```python
class UserCreate(BaseModel):
    password: str = Field(
        ...,
        min_length=8,
        max_length=256,
        description="Password (hashed with bcrypt_sha256)"
    )
```

**Rejects**:

- `"short"` (< 8 characters)
- `"a" * 300` (> 256 characters)

**Accepts**:

- `"MySecurePassword123"`
- `"correct-horse-battery-staple"`

#### Decimal Range Validation

```python
class UserUpdate(BaseModel):
    daily_change_threshold_pct: Optional[Decimal] = Field(None, ge=0, le=100)
```

**Rejects**:

- `-5.0` (negative)
- `150.0` (> 100)

**Accepts**:

- `5.0`
- `0.5`
- `100.0`

### Configuration

#### from_attributes (Pydantic v2)

```python
class PortfolioResponse(BaseModel):
    id: int
    name: str
    
    model_config = ConfigDict(from_attributes=True)
```

**Enables**:

```python
# Convert ORM model to Pydantic schema
orm_portfolio = db.query(Portfolio).first()
response = PortfolioResponse.model_validate(orm_portfolio)
```

**Equivalent (Pydantic v1)**:

```python
class Config:
    from_attributes = True  # v1: orm_mode = True
```

#### JSON Encoders

```python
class TransactionResponse(BaseModel):
    price: Decimal
    tx_date: date
    
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            Decimal: lambda v: float(v),
            date: lambda v: v.isoformat()
        }
    )
```

**JSON Output**:

```json
{
  "price": 150.25,  // Decimal → float
  "tx_date": "2024-01-15"  // date → ISO string
}
```

## Database Schema

### PostgreSQL Schema

All tables reside in `portfolio` schema:

```sql
CREATE SCHEMA IF NOT EXISTS portfolio;

CREATE TABLE portfolio.users (...);
CREATE TABLE portfolio.assets (...);
CREATE TABLE portfolio.portfolios (...);
CREATE TABLE portfolio.transactions (...);
CREATE TABLE portfolio.prices (...);
CREATE TABLE portfolio.watchlist (...);
CREATE TABLE portfolio.notifications (...);
```

**Benefit**: Organize related tables, avoid global namespace pollution

### Relationships Diagram

```
User
 │
 ├─► Portfolio (cascade delete)
 │    │
 │    └─► Transaction (cascade delete)
 │         │
 │         └─► Asset (restrict delete)
 │              └─► Price (cascade delete)
 │
 ├─► Watchlist (cascade delete)
 │    └─► Asset
 │
 └─► Notification (cascade delete)
```

**Cascade Rules**:

- **CASCADE**: Delete child when parent deleted
- **RESTRICT**: Prevent deletion if children exist
- **SET NULL**: Set foreign key to NULL (not used in Portfolium)

### Constraints

**Unique Constraints**:

```sql
-- User
UNIQUE (email)
UNIQUE (username)

-- Asset
UNIQUE (symbol)
```

**Check Constraints** (not defined in models, but could be):

```sql
-- Prevent negative quantities for BUY transactions
ALTER TABLE portfolio.transactions
ADD CONSTRAINT check_buy_quantity_positive
CHECK (type != 'BUY' OR quantity > 0);

-- Prevent negative prices
ALTER TABLE portfolio.transactions
ADD CONSTRAINT check_price_positive
CHECK (price >= 0);
```

## Migrations

### Alembic Setup

```bash
# Generate migration
alembic revision --autogenerate -m "Add logo caching to assets"

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Migration Example

```python
"""Add logo caching to assets

Revision ID: abc123
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('assets',
        sa.Column('logo_data', sa.LargeBinary(), nullable=True),
        schema='portfolio'
    )
    op.add_column('assets',
        sa.Column('logo_content_type', sa.String(), nullable=True),
        schema='portfolio'
    )
    op.add_column('assets',
        sa.Column('logo_fetched_at', sa.DateTime(), nullable=True),
        schema='portfolio'
    )

def downgrade():
    op.drop_column('assets', 'logo_fetched_at', schema='portfolio')
    op.drop_column('assets', 'logo_content_type', schema='portfolio')
    op.drop_column('assets', 'logo_data', schema='portfolio')
```

## Best Practices

### For Developers

1. **Use Decimal for money**: Never `float` for financial data
2. **Define enums**: Prevent invalid values with Python enums
3. **Explicit cascades**: Always specify cascade behavior
4. **Index foreign keys**: Improves join performance
5. **Validate in schemas**: Catch errors before database
6. **Use transactions**: Group related operations in `db.begin()`

### For Database Design

1. **Normalize data**: Separate entities into tables
2. **Use constraints**: Enforce data integrity at DB level
3. **Schema organization**: Use PostgreSQL schemas for namespacing
4. **Audit columns**: Include `created_at`, `updated_at`
5. **Soft deletes** (optional): Add `deleted_at` instead of hard delete

## Testing

### Model Tests

```python
def test_user_creation():
    """Test creating a user with hashed password"""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=pwd_context.hash("password123")
    )
    db.add(user)
    db.commit()
    
    assert user.id is not None
    assert user.created_at is not None

def test_portfolio_cascade_delete():
    """Test deleting user cascades to portfolios"""
    user = User(email="test@example.com", username="testuser")
    db.add(user)
    db.commit()
    
    portfolio = Portfolio(user_id=user.id, name="Test Portfolio")
    db.add(portfolio)
    db.commit()
    
    db.delete(user)
    db.commit()
    
    # Portfolio should be deleted
    assert db.query(Portfolio).filter_by(id=portfolio.id).first() is None
```

### Schema Tests

```python
def test_email_validation():
    """Test email validation rejects invalid emails"""
    with pytest.raises(ValueError):
        UserCreate(
            email="not-an-email",
            username="testuser",
            password="password123"
        )

def test_decimal_range_validation():
    """Test threshold percentage range validation"""
    # Valid: 5.0%
    update = UserUpdate(daily_change_threshold_pct=Decimal("5.0"))
    assert update.daily_change_threshold_pct == Decimal("5.0")
    
    # Invalid: -5.0%
    with pytest.raises(ValueError):
        UserUpdate(daily_change_threshold_pct=Decimal("-5.0"))
```

## Related Documentation

- [Stock Splits](stock-splits.md) - Uses Transaction metadata
- [Logo Fetching](logo-fetching.md) - Uses Asset logo fields
- [Price Fetching](price-fetching.md) - Uses Price model
- [Currency Conversion](currency-conversion.md) - Uses currency fields

## References

- [SQLAlchemy ORM Documentation](https://docs.sqlalchemy.org/en/20/orm/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [Alembic Migration Tool](https://alembic.sqlalchemy.org/)