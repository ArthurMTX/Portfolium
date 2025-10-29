# Pricing Service Architecture

Technical documentation for the PricingService class design and integration patterns.

## Overview

The PricingService provides a centralized interface for fetching, caching, and managing asset price data. It follows dependency injection principles and integrates with yfinance, database caching, currency conversion, and portfolio metrics.

## Service Design

### Class Structure

```python
class PricingService:
    """
    Service for fetching and caching asset prices.
    
    Responsibilities:
    - Fetch current prices from yfinance
    - Cache prices in database with TTL
    - Concurrent batch fetching
    - Historical data backfilling
    - Integration with portfolio metrics
    """
    
    def __init__(self, db: Session):
        """Initialize with database session dependency."""
        self.db = db
```

**Design Pattern**: Service Layer Pattern

**Key Characteristics**:

- **Stateless**: No instance state beyond injected dependencies
- **Testable**: Database can be mocked for unit tests
- **Reusable**: Single service instance handles all price operations
- **Separation of Concerns**: Price logic isolated from API routes

### Dependency Injection

```python
# app/db.py
def get_db() -> Generator[Session, None, None]:
    """Database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# app/routers/prices.py
@router.get("/prices/{symbol}")
async def get_price_endpoint(
    symbol: str,
    db: Session = Depends(get_db)
):
    """API endpoint with injected database session."""
    pricing_service = PricingService(db)
    return await pricing_service.get_price(symbol)
```

**Benefits**:

1. **Testability**: Mock database for unit tests
2. **Connection Management**: Session lifecycle managed by FastAPI
3. **Transaction Control**: Explicit commit/rollback
4. **Resource Cleanup**: `finally` block ensures session closed

## Core Responsibilities

### 1. Price Fetching

**Single Symbol**:

```python
async def get_price(self, symbol: str) -> Optional[PriceResponse]:
    """
    Get current price for a symbol.
    
    Workflow:
    1. Check database cache (TTL validation)
    2. If cache miss/expired, fetch from yfinance
    3. Save to database
    4. Return price data
    """
```

**Multiple Symbols (Concurrent)**:

```python
async def get_multiple_prices(self, symbols: List[str]) -> Dict[str, Optional[PriceResponse]]:
    """
    Fetch prices for multiple symbols concurrently.
    
    Uses asyncio.gather for parallel execution.
    """
```

**Pattern**: Async/await with concurrent execution

### 2. Caching Strategy

**TTL-Based Cache**:

```python
def _is_cache_valid(self, price: Price) -> bool:
    """Check if cached price is within TTL."""
    age = datetime.utcnow() - price.updated_at
    return age.total_seconds() < settings.PRICE_CACHE_TTL_SECONDS
```

**Cache Levels**:

1. **Database**: Persistent cache (survives restarts)
2. **TTL**: 5-minute default (configurable)
3. **No in-memory cache**: Database is authoritative source

**Rationale**: Database cache shared across API instances, simpler than Redis

### 3. Historical Data

**Backfilling**:

```python
async def ensure_historical_prices(
    self,
    symbol: str,
    start_date: datetime,
    end_date: Optional[datetime] = None
) -> List[HistoricalPrice]:
    """
    Ensure historical prices exist for date range.
    
    Workflow:
    1. Query existing data
    2. Identify missing dates
    3. Fetch missing data from yfinance
    4. Save to database
    5. Return complete dataset
    """
```

**Use Cases**:

- Portfolio history charts (1Y, YTD, etc.)
- Backtesting strategies
- P&L calculations for past dates

### 4. Portfolio Integration

**Refresh All Prices**:

```python
async def refresh_all_portfolio_prices(self, portfolio_id: int) -> int:
    """
    Refresh prices for all assets in a portfolio.
    
    Workflow:
    1. Get unique symbols from portfolio transactions
    2. Fetch all prices concurrently
    3. Return success count
    """
```

**Integration with Metrics**:

```python
# In MetricsService
def calculate_unrealized_pnl(self, portfolio_id: int) -> Decimal:
    """
    Calculate unrealized P&L using current prices.
    
    Dependencies:
    - PricingService: Get current prices
    - CurrencyService: Convert to portfolio currency
    - MetricsService: Calculate position values
    """
```

## Integration Architecture

### Service Dependencies

```
┌─────────────────┐
│ API Routes      │
└────────┬────────┘
         │ depends on
         ▼
┌─────────────────┐       ┌──────────────┐
│ PricingService  │◄──────┤ Database     │
└────────┬────────┘       └──────────────┘
         │ uses
         ├──────────────┐
         │              │
         ▼              ▼
┌─────────────────┐    ┌──────────────┐
│ yfinance        │    │ asyncio      │
└─────────────────┘    └──────────────┘
```

### Cross-Service Communication

**PricingService → CurrencyService**:

```python
# In portfolio value calculation
current_price_usd = await pricing_service.get_price("AAPL")
price_eur = CurrencyService.convert(
    current_price_usd,
    from_currency="USD",
    to_currency="EUR"
)
```

**PricingService → MetricsService**:

```python
# In metrics calculation
pricing_service = PricingService(db)
metrics_service = MetricsService(db, pricing_service)

unrealized_pnl = metrics_service.calculate_unrealized_pnl(portfolio_id)
```

**Dependency Direction**: Services depend on lower-level services, never circular

## Async Architecture

### Threading for Blocking Calls

**Problem**: yfinance is synchronous (blocks event loop)

**Solution**: Run in thread pool

```python
async def get_price(self, symbol: str) -> Optional[PriceResponse]:
    # ...
    price_data = await asyncio.to_thread(
        self._fetch_price_from_yfinance,
        symbol
    )
    # ...
```

**asyncio.to_thread**:

- Runs blocking function in `ThreadPoolExecutor`
- Returns awaitable
- Doesn't block event loop
- Other async operations continue

### Concurrent Gathering

**Pattern**:

```python
async def get_multiple_prices(self, symbols: List[str]) -> Dict[str, Optional[PriceResponse]]:
    tasks = [self.get_price(symbol) for symbol in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    # ...
```

**Execution**:

```
Time 0:    Start all tasks
           ├─ get_price("AAPL")
           ├─ get_price("MSFT")
           └─ get_price("GOOGL")
           
Time 500ms: All complete
           └─ Return all results
```

**Performance**: 10 symbols in ~500ms vs 5000ms sequential

## Error Handling

### Graceful Degradation

**Price Fetch Failure**:

```python
try:
    price_data = await asyncio.to_thread(self._fetch_price_from_yfinance, symbol)
    if price_data:
        return self._price_to_response(price_data)
    else:
        # Return cached data if available (even if stale)
        cached = self._get_cached_price(symbol)
        if cached:
            logger.warning(f"Using stale cache for {symbol}")
            return self._price_to_response(cached)
        return None
except Exception as e:
    logger.error(f"Error fetching price for {symbol}: {e}")
    # Try to return cached data as fallback
    cached = self._get_cached_price(symbol)
    return self._price_to_response(cached) if cached else None
```

**Hierarchy**:

1. Fresh data from API
2. Stale cache (better than nothing)
3. None (failure, display error)

### Exception Propagation

**gather with return_exceptions**:

```python
results = await asyncio.gather(*tasks, return_exceptions=True)

for symbol, result in zip(symbols, results):
    if isinstance(result, Exception):
        logger.error(f"Error fetching {symbol}: {result}")
        price_map[symbol] = None  # Partial failure, continue
    else:
        price_map[symbol] = result
```

**Benefit**: One symbol failure doesn't stop others

## Performance Optimizations

### 1. Database Connection Pooling

```python
# app/db.py
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # Keep 10 connections ready
    max_overflow=20,       # Allow 20 more if needed
    pool_pre_ping=True,    # Validate before use
    pool_recycle=3600      # Recycle hourly
)
```

**Impact**: Eliminate connection setup time (50-100ms saved per query)

### 2. Batch Fetching

**Avoid N+1 Queries**:

```python
# Bad: N+1 queries
for symbol in symbols:
    price = await get_price(symbol)  # N database queries

# Good: Batch fetch
price_map = await get_multiple_prices(symbols)  # 1 batch
```

### 3. Index Usage

**Optimized Queries**:

```sql
-- Fast: Uses symbol index
SELECT * FROM portfolio.prices WHERE symbol = 'AAPL';

-- Fast: Uses updated_at index
SELECT * FROM portfolio.prices 
WHERE symbol = 'AAPL' AND updated_at > NOW() - INTERVAL '5 minutes';
```

### 4. Concurrent API Calls

**Serial** (slow):

```python
for symbol in symbols:
    yf.Ticker(symbol).info  # 500ms each
# Total: 500ms * 10 = 5000ms
```

**Parallel** (fast):

```python
await asyncio.gather(*[
    asyncio.to_thread(yf.Ticker(symbol).info)
    for symbol in symbols
])
# Total: ~500-800ms
```

## Testing Strategies

### Unit Tests (Mocked Database)

```python
@pytest.fixture
def mock_db():
    """Mock database session."""
    return MagicMock(spec=Session)

def test_get_price_cache_hit(mock_db):
    """Test returning cached price without API call."""
    # Setup mock
    cached_price = Price(
        symbol="AAPL",
        current_price=Decimal("150"),
        updated_at=datetime.utcnow()  # Fresh
    )
    mock_db.query().filter_by().first.return_value = cached_price
    
    # Test
    service = PricingService(mock_db)
    result = await service.get_price("AAPL")
    
    # Verify
    assert result.current_price == Decimal("150")
    mock_db.commit.assert_not_called()  # No API call, no DB write
```

### Integration Tests (Real Database)

```python
@pytest.mark.integration
async def test_get_price_full_workflow(db: Session):
    """Test full price fetch workflow with real DB."""
    service = PricingService(db)
    
    # Clear cache
    db.query(Price).filter_by(symbol="AAPL").delete()
    db.commit()
    
    # Fetch price (should call API)
    result = await service.get_price("AAPL")
    
    assert result is not None
    assert result.symbol == "AAPL"
    assert result.current_price > 0
    
    # Verify cached
    cached = db.query(Price).filter_by(symbol="AAPL").first()
    assert cached is not None
    assert cached.current_price == result.current_price
```

### Performance Tests

```python
@pytest.mark.performance
async def test_concurrent_fetch_performance(db: Session):
    """Test that concurrent fetching is faster than serial."""
    service = PricingService(db)
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
    
    # Concurrent
    start = time.time()
    await service.get_multiple_prices(symbols)
    concurrent_time = time.time() - start
    
    # Should complete in under 2 seconds
    assert concurrent_time < 2.0
```

## Configuration

### Environment Variables

```env
# Price cache TTL (seconds)
PRICE_CACHE_TTL_SECONDS=300  # 5 minutes

# yfinance timeout (seconds)
YFINANCE_TIMEOUT=10

# Database pool settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=3600
```

### Settings Class

```python
# app/config.py
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 3600
    
    # Pricing
    PRICE_CACHE_TTL_SECONDS: int = 300
    YFINANCE_TIMEOUT: int = 10
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## API Endpoints

### Get Price

```python
@router.get("/prices/{symbol}")
async def get_price(
    symbol: str,
    db: Session = Depends(get_db)
) -> PriceResponse:
    """Get current price for a symbol."""
    service = PricingService(db)
    price = await service.get_price(symbol)
    
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    
    return price
```

### Batch Prices

```python
@router.post("/prices/batch")
async def get_batch_prices(
    request: PriceBatchRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Optional[PriceResponse]]:
    """Get prices for multiple symbols."""
    service = PricingService(db)
    return await service.get_multiple_prices(request.symbols)
```

### Refresh Portfolio

```python
@router.post("/portfolios/{portfolio_id}/refresh-prices")
async def refresh_portfolio_prices(
    portfolio_id: int,
    db: Session = Depends(get_db)
) -> dict:
    """Refresh all prices for a portfolio."""
    service = PricingService(db)
    count = await service.refresh_all_portfolio_prices(portfolio_id)
    return {"refreshed": count}
```

## Best Practices

### For Service Development

1. **Inject dependencies**: Use FastAPI `Depends()` for DB sessions
2. **Async for I/O**: Use `async/await` for network calls
3. **Thread blocking calls**: Use `asyncio.to_thread()` for sync libraries
4. **Batch operations**: Prefer `get_multiple_prices()` over loops
5. **Cache aggressively**: 5-minute TTL balances freshness vs API usage
6. **Graceful degradation**: Return stale cache on errors
7. **Log everything**: Debug price fetch issues with logs

### For API Design

1. **Service layer separation**: Don't put business logic in routes
2. **Dependency injection**: Services receive dependencies, not singletons
3. **Schema validation**: Use Pydantic for all inputs/outputs
4. **Error handling**: Return proper HTTP status codes
5. **Rate limiting**: Consider rate limits on public endpoints

## Troubleshooting

### Slow Price Fetching

**Symptom**: API responses taking 5+ seconds

**Checks**:

1. **Serial vs concurrent**:

```python
# Check if using concurrent fetching
await service.get_multiple_prices(symbols)  # Good
for symbol in symbols:
    await service.get_price(symbol)  # Bad (serial)
```

2. **Database connection pool**:

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;
-- If near max_connections, increase pool size
```

3. **yfinance timeout**:

```env
YFINANCE_TIMEOUT=30  # Increase if timing out
```

### Stale Prices

**Symptom**: Prices not updating

**Checks**:

1. **Cache TTL**:

```sql
SELECT symbol, updated_at, 
       EXTRACT(EPOCH FROM (NOW() - updated_at)) as age_seconds
FROM portfolio.prices
WHERE symbol = 'AAPL';
```

If `age_seconds < 300`, cache is fresh (expected).

2. **Force refresh**:

```python
# Delete cached price
db.query(Price).filter_by(symbol="AAPL").delete()
db.commit()
```

3. **Check yfinance**:

```python
import yfinance as yf
ticker = yf.Ticker("AAPL")
print(ticker.info)  # Should show current data
```

### Database Deadlocks

**Symptom**: `deadlock detected` errors

**Cause**: Concurrent writes to same price records

**Solution**: Use UPSERT with row-level locking

```python
def _save_price(self, symbol: str, price_data: Dict) -> Price:
    # Row-level lock (FOR UPDATE)
    existing = self.db.query(Price).filter_by(symbol=symbol).with_for_update().first()
    
    if existing:
        for key, value in price_data.items():
            setattr(existing, key, value)
        db_price = existing
    else:
        db_price = Price(**price_data)
        self.db.add(db_price)
    
    self.db.commit()
    return db_price
```

## Future Improvements

### Potential Enhancements

1. **Redis caching**: Shared cache across API instances
2. **WebSocket streaming**: Real-time price updates
3. **Multiple data sources**: Fallback to Alpha Vantage, IEX Cloud
4. **Smart TTL**: Market hours-aware cache (longer when market closed)
5. **Prefetching**: Background task pre-fetches frequently accessed symbols
6. **Circuit breaker**: Stop calling yfinance if too many failures

### Known Limitations

1. **Single data source**: yfinance only, no fallback
2. **In-memory state**: No distributed cache (Redis)
3. **No WebSocket**: Poll-based refresh only
4. **Rate limiting**: No built-in rate limiter (relies on yfinance throttling)

## Related Documentation

- [Price Fetching](price-fetching.md) - Detailed price fetch logic
- [Currency Conversion](currency-conversion.md) - Used in portfolio calculations
- [Data Models](data-models.md) - Price and Asset models
- [Stock Splits](stock-splits.md) - Price adjustments for splits

## References

- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [SQLAlchemy Session Management](https://docs.sqlalchemy.org/en/20/orm/session.html)
- [yfinance Documentation](https://github.com/ranaroussi/yfinance)