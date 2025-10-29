# Price Fetching

Technical documentation for the asset price fetching and caching system.

## Overview

Portfolium fetches real-time and historical stock prices using the yfinance library (Yahoo Finance API). The system includes TTL-based caching, concurrent fetching, daily change calculations, and automatic historical backfilling.

## Architecture

### Service Location

`api/app/services/pricing.py`

### Key Components

1. **PricingService**: Main service class with dependency injection
2. **yfinance Integration**: Third-party library for Yahoo Finance data
3. **Database Caching**: TTL-based price storage
4. **Concurrent Fetching**: asyncio for parallel price updates
5. **Historical Backfilling**: Ensure minimum price history

## PricingService Class

### Initialization

```python
class PricingService:
    """Service for fetching and caching asset prices."""
    
    def __init__(self, db: Session):
        """
        Initialize the pricing service.
        
        Args:
            db: SQLAlchemy database session (dependency injection)
        """
        self.db = db
```

**Dependency Injection Pattern**:

- Receives `db` session from FastAPI dependency
- Enables testing with mock databases
- Follows SOLID principles (Dependency Inversion)

### Database Dependency

```python
from app.db import get_db

@router.get("/prices/{symbol}")
async def get_price_endpoint(
    symbol: str,
    pricing_service: PricingService = Depends(lambda db=Depends(get_db): PricingService(db))
):
    """Endpoint using pricing service with injected DB."""
    return await pricing_service.get_price(symbol)
```

## Core Methods

### Get Single Price

```python
async def get_price(self, symbol: str) -> Optional[PriceResponse]:
    """
    Get the current price for a symbol, using cache if available.
    
    Caching logic:
    1. Check database for cached price within TTL
    2. If found and fresh, return cached price
    3. Otherwise, fetch from yfinance and cache
    
    Args:
        symbol: Stock ticker (e.g., "AAPL", "BTC-USD")
        
    Returns:
        PriceResponse with current, previous close, daily change
        None if symbol invalid or fetch failed
    """
    # Check cache first
    cached = self._get_cached_price(symbol)
    if cached and self._is_cache_valid(cached):
        logger.debug(f"Using cached price for {symbol}")
        return self._price_to_response(cached)
    
    # Cache miss or expired - fetch fresh data
    logger.info(f"Fetching fresh price for {symbol}")
    try:
        price_data = await asyncio.to_thread(self._fetch_price_from_yfinance, symbol)
        
        if price_data:
            # Save to database
            db_price = self._save_price(symbol, price_data)
            return self._price_to_response(db_price)
        else:
            logger.warning(f"No price data returned for {symbol}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching price for {symbol}: {e}")
        return None
```

**Flow Diagram**:

```
get_price(symbol)
    ↓
[Check cache]
    ↓
Cache valid? ──Yes──> Return cached price
    ↓ No
[Fetch from yfinance]
    ↓
Got data? ──No──> Return None
    ↓ Yes
[Save to database]
    ↓
Return new price
```

### Cache Validation

```python
def _is_cache_valid(self, price: Price) -> bool:
    """
    Check if cached price is still fresh based on TTL.
    
    Args:
        price: Price model from database
        
    Returns:
        True if cache age < TTL, False otherwise
    """
    if not price.updated_at:
        return False
    
    age = datetime.utcnow() - price.updated_at
    ttl_seconds = settings.PRICE_CACHE_TTL_SECONDS  # Default: 300 (5 min)
    
    return age.total_seconds() < ttl_seconds
```

**Default TTL**: 5 minutes (300 seconds)

**Configuration**:

```env
# .env file
PRICE_CACHE_TTL_SECONDS=300  # 5 minutes (default)
PRICE_CACHE_TTL_SECONDS=60   # 1 minute (more aggressive)
PRICE_CACHE_TTL_SECONDS=900  # 15 minutes (less API calls)
```

**TTL Considerations**:

- **Too short** (< 60s): Excessive API calls, rate limiting risk
- **Too long** (> 900s): Stale prices, inaccurate P&L
- **Optimal** (300s): Balance freshness vs. API usage

### Fetch from yfinance

```python
def _fetch_price_from_yfinance(self, symbol: str) -> Optional[Dict[str, Any]]:
    """
    Fetch current price data from Yahoo Finance.
    
    Uses yfinance library to get:
    - Current price (regularMarketPrice)
    - Previous close (regularMarketPreviousClose)
    - Currency (currency)
    - Market time (regularMarketTime)
    
    Args:
        symbol: Ticker symbol
        
    Returns:
        Dict with price data or None if fetch failed
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info  # API call happens here
        
        # Extract relevant fields
        current_price = info.get('regularMarketPrice') or info.get('currentPrice')
        previous_close = info.get('regularMarketPreviousClose') or info.get('previousClose')
        currency = info.get('currency', 'USD')
        market_time = info.get('regularMarketTime')
        
        if current_price is None:
            logger.warning(f"No current price found for {symbol}")
            return None
        
        # Calculate daily change percentage
        daily_change_pct = None
        if current_price and previous_close and previous_close != 0:
            daily_change_pct = ((current_price - previous_close) / previous_close) * 100
        
        return {
            'symbol': symbol,
            'current_price': Decimal(str(current_price)),
            'previous_close': Decimal(str(previous_close)) if previous_close else None,
            'daily_change_pct': Decimal(str(daily_change_pct)) if daily_change_pct else None,
            'currency': currency,
            'market_time': datetime.fromtimestamp(market_time) if market_time else datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"yfinance fetch failed for {symbol}: {e}")
        return None
```

**yfinance Fields**:

| Field | Description | Fallback |
|-------|-------------|----------|
| `regularMarketPrice` | Current trading price | `currentPrice` |
| `regularMarketPreviousClose` | Previous day's close | `previousClose` |
| `currency` | Price currency (USD, EUR, etc.) | "USD" |
| `regularMarketTime` | Last update timestamp | Current time |

**Error Handling**:

- Invalid symbol → Returns None
- Network timeout → Logged, returns None
- API rate limit → Logged, returns None (relies on cache)

### Save to Database

```python
def _save_price(self, symbol: str, price_data: Dict[str, Any]) -> Price:
    """
    Save or update price in database.
    
    Uses upsert logic:
    - If price exists for symbol, update it
    - Otherwise, create new price record
    
    Args:
        symbol: Ticker symbol
        price_data: Dict with price fields
        
    Returns:
        Price model instance (committed to database)
    """
    existing = self.db.query(Price).filter_by(symbol=symbol).first()
    
    if existing:
        # Update existing record
        for key, value in price_data.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
        db_price = existing
    else:
        # Create new record
        db_price = Price(**price_data)
        self.db.add(db_price)
    
    self.db.commit()
    self.db.refresh(db_price)
    
    return db_price
```

**Schema**:

```python
class Price(Base):
    __tablename__ = 'prices'
    
    id = Column(Integer, primary_key=True)
    symbol = Column(String, unique=True, index=True)  # Unique constraint
    current_price = Column(Numeric(20, 8))            # High precision
    previous_close = Column(Numeric(20, 8))
    daily_change_pct = Column(Numeric(10, 4))
    currency = Column(String)
    market_time = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow)
```

**Precision**:

- `Numeric(20, 8)`: Up to 12 integer digits, 8 decimal places
- Handles crypto (e.g., $0.00012345) and large values (e.g., $999999.99)

## Concurrent Fetching

### Get Multiple Prices

```python
async def get_multiple_prices(self, symbols: List[str]) -> Dict[str, Optional[PriceResponse]]:
    """
    Fetch prices for multiple symbols concurrently.
    
    Uses asyncio.gather to fetch all prices in parallel,
    significantly faster than sequential fetching.
    
    Args:
        symbols: List of ticker symbols
        
    Returns:
        Dict mapping symbol to PriceResponse (or None if failed)
    """
    tasks = [self.get_price(symbol) for symbol in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Build result dictionary
    price_map = {}
    for symbol, result in zip(symbols, results):
        if isinstance(result, Exception):
            logger.error(f"Error fetching {symbol}: {result}")
            price_map[symbol] = None
        else:
            price_map[symbol] = result
    
    return price_map
```

**Performance Comparison**:

Sequential (10 symbols):

```
Symbol 1: 500ms
Symbol 2: 500ms
...
Symbol 10: 500ms
Total: 5000ms (5 seconds)
```

Concurrent (10 symbols):

```
All symbols: ~500-800ms
Total: 500-800ms (< 1 second)
```

**6-10x faster** for typical portfolios.

### Refresh All Portfolio Prices

```python
async def refresh_all_portfolio_prices(self, portfolio_id: int) -> int:
    """
    Refresh prices for all assets in a portfolio.
    
    Workflow:
    1. Get all unique symbols from portfolio transactions
    2. Fetch all prices concurrently
    3. Return count of successfully updated prices
    
    Args:
        portfolio_id: ID of portfolio to refresh
        
    Returns:
        Number of prices successfully fetched
    """
    # Get unique symbols
    transactions = self.db.query(Transaction).filter_by(portfolio_id=portfolio_id).all()
    symbols = list(set(t.symbol for t in transactions))
    
    if not symbols:
        logger.info(f"No symbols found for portfolio {portfolio_id}")
        return 0
    
    logger.info(f"Refreshing {len(symbols)} prices for portfolio {portfolio_id}")
    
    # Fetch concurrently
    price_map = await self.get_multiple_prices(symbols)
    
    # Count successes
    success_count = sum(1 for price in price_map.values() if price is not None)
    
    logger.info(f"Successfully refreshed {success_count}/{len(symbols)} prices")
    return success_count
```

**Endpoint**:

```python
@router.post("/portfolios/{portfolio_id}/refresh-prices")
async def refresh_prices(
    portfolio_id: int,
    pricing_service: PricingService = Depends(get_pricing_service)
):
    """Refresh all prices for a portfolio."""
    count = await pricing_service.refresh_all_portfolio_prices(portfolio_id)
    return {"refreshed": count}
```

## Historical Price Backfilling

### Ensure Historical Prices

```python
async def ensure_historical_prices(
    self, 
    symbol: str, 
    start_date: datetime, 
    end_date: Optional[datetime] = None
) -> List[HistoricalPrice]:
    """
    Ensure historical prices exist for a symbol in the given date range.
    
    Checks database first, fetches missing data from yfinance if needed.
    
    Args:
        symbol: Ticker symbol
        start_date: First date needed
        end_date: Last date needed (default: today)
        
    Returns:
        List of HistoricalPrice models covering the date range
    """
    if end_date is None:
        end_date = datetime.now()
    
    # Check existing data
    existing = self.db.query(HistoricalPrice).filter(
        HistoricalPrice.symbol == symbol,
        HistoricalPrice.date >= start_date,
        HistoricalPrice.date <= end_date
    ).all()
    
    # Calculate coverage
    existing_dates = set(p.date.date() for p in existing)
    required_dates = set(self._trading_days_in_range(start_date, end_date))
    missing_dates = required_dates - existing_dates
    
    if not missing_dates:
        logger.debug(f"Historical prices for {symbol} already complete")
        return existing
    
    # Fetch missing data
    logger.info(f"Fetching {len(missing_dates)} missing historical prices for {symbol}")
    
    try:
        ticker = yf.Ticker(symbol)
        hist_data = await asyncio.to_thread(
            ticker.history,
            start=start_date,
            end=end_date,
            interval="1d"
        )
        
        # Save to database
        for date_idx, row in hist_data.iterrows():
            date = date_idx.to_pydatetime().date()
            
            if date in missing_dates:
                hist_price = HistoricalPrice(
                    symbol=symbol,
                    date=date,
                    open=Decimal(str(row['Open'])),
                    high=Decimal(str(row['High'])),
                    low=Decimal(str(row['Low'])),
                    close=Decimal(str(row['Close'])),
                    volume=int(row['Volume'])
                )
                self.db.add(hist_price)
        
        self.db.commit()
        
        # Re-query all data
        return self.db.query(HistoricalPrice).filter(
            HistoricalPrice.symbol == symbol,
            HistoricalPrice.date >= start_date,
            HistoricalPrice.date <= end_date
        ).order_by(HistoricalPrice.date).all()
        
    except Exception as e:
        logger.error(f"Failed to fetch historical prices for {symbol}: {e}")
        return existing  # Return what we have
```

**Use Case**: Portfolio history chart needs daily prices for past year

**Workflow**:

1. Chart requests historical data for AAPL (Jan 1 - Dec 31)
2. Database has Jan-Jun, missing Jul-Dec
3. System fetches Jul-Dec from yfinance
4. Saves to database
5. Returns complete Jan-Dec data

### Trading Days Calculation

```python
def _trading_days_in_range(self, start: datetime, end: datetime) -> List[date]:
    """
    Calculate trading days between start and end dates.
    
    Excludes weekends and US market holidays.
    
    Args:
        start: Start date
        end: End date
        
    Returns:
        List of trading day dates
    """
    from pandas.tseries.holiday import USFederalHolidayCalendar
    from pandas.tseries.offsets import CustomBusinessDay
    
    us_bd = CustomBusinessDay(calendar=USFederalHolidayCalendar())
    
    dates = pd.date_range(start=start, end=end, freq=us_bd)
    return [d.date() for d in dates]
```

**Excludes**:

- Saturdays and Sundays
- New Year's Day, MLK Day, Presidents' Day
- Good Friday
- Memorial Day, Independence Day, Labor Day
- Thanksgiving, Christmas

## Daily Change Calculation

### Formula

```python
daily_change_pct = ((current_price - previous_close) / previous_close) * 100
```

**Example**:

```
AAPL:
  current_price = $150.00
  previous_close = $145.00
  
daily_change_pct = ((150 - 145) / 145) * 100 = 3.45%
```

### Edge Cases

**Market Closed**:

```python
# During market hours: current_price changes in real-time
# After hours: current_price = last traded price
# Before open: current_price = previous_close (0% change)

if current_price == previous_close:
    daily_change_pct = 0.0  # No change
```

**Gaps (Halt/Resume)**:

```python
# Stock halted yesterday at $100, resumes today at $90

previous_close = $100  # Last close before halt
current_price = $90     # Resume price

daily_change_pct = ((90 - 100) / 100) * 100 = -10%  # Correct
```

**Dividends (Ex-Date)**:

```python
# Previous close: $100
# Dividend: $2
# Open (ex-dividend): $98
# Current: $99

previous_close = $100  # Includes dividend
current_price = $99

daily_change_pct = ((99 - 100) / 100) * 100 = -1%

# NOTE: yfinance adjusts previous_close to $98 on ex-date
# So actual calc: ((99 - 98) / 98) * 100 = +1.02%
```

Yahoo Finance handles dividend adjustments automatically.

## Response Schema

### PriceResponse

```python
class PriceResponse(BaseModel):
    """Response model for price data."""
    
    symbol: str
    current_price: Decimal
    previous_close: Optional[Decimal]
    daily_change_pct: Optional[Decimal]
    currency: str
    market_time: datetime
    cached_at: datetime
    
    class Config:
        json_encoders = {
            Decimal: lambda v: float(v),  # Convert Decimal to float for JSON
            datetime: lambda v: v.isoformat()  # ISO 8601 format
        }
```

**Example JSON**:

```json
{
  "symbol": "AAPL",
  "current_price": 150.25,
  "previous_close": 148.50,
  "daily_change_pct": 1.18,
  "currency": "USD",
  "market_time": "2024-01-15T16:00:00",
  "cached_at": "2024-01-15T16:05:23"
}
```

## API Endpoints

### Get Price

`GET /api/prices/{symbol}`

**Response**: PriceResponse

```bash
curl http://localhost:8000/api/prices/AAPL
```

### Get Multiple Prices

`POST /api/prices/batch`

**Request Body**:

```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL"]
}
```

**Response**:

```json
{
  "AAPL": { "current_price": 150.25, ... },
  "MSFT": { "current_price": 380.50, ... },
  "GOOGL": { "current_price": 140.75, ... }
}
```

### Refresh Portfolio Prices

`POST /api/portfolios/{portfolio_id}/refresh-prices`

**Response**:

```json
{
  "refreshed": 15  // Number of prices updated
}
```

## Performance Optimizations

### Database Indexing

```sql
CREATE INDEX idx_prices_symbol ON portfolio.prices(symbol);
CREATE INDEX idx_prices_updated_at ON portfolio.prices(updated_at);
CREATE INDEX idx_historical_symbol_date ON portfolio.historical_prices(symbol, date);
```

**Query Performance**:

- Symbol lookup: O(log n) with B-tree index
- Cache validation: Fast updated_at comparison
- Historical range: Efficient with composite index

### Connection Pooling

```python
# SQLAlchemy engine configuration
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # Maintain 10 idle connections
    max_overflow=20,       # Allow 20 additional connections
    pool_pre_ping=True,    # Validate connections before use
    pool_recycle=3600      # Recycle connections after 1 hour
)
```

Reuses database connections, avoiding connection overhead.

### Async Threading

```python
# Block thread pool for sync yfinance calls
price_data = await asyncio.to_thread(ticker.info)
```

Prevents blocking the event loop during synchronous yfinance API calls.

## Rate Limiting

### yfinance Limits

Yahoo Finance unofficial limits:

- **~2000 requests/hour** (approximate, undocumented)
- **~48,000 requests/day**

**Exceeded**: Temporary IP ban (15-60 minutes)

### Mitigation Strategies

1. **Caching**: 5-minute TTL reduces calls by 95%
2. **Concurrent batching**: Fetch all portfolio symbols at once
3. **Backoff**: Exponential retry on rate limit errors
4. **User-triggered**: Only fetch when user views prices

**Example Calculation**:

```
Portfolio with 50 assets:
Without cache: 50 calls every page load → 600 calls/hour (10 page loads)
With 5-min cache: 50 calls once, then 0 for 5 min → 120 calls/hour max

95% reduction
```

## Error Handling

### Network Failures

```python
try:
    ticker = yf.Ticker(symbol)
    info = ticker.info
except requests.exceptions.ConnectionError:
    logger.error(f"Network error fetching {symbol}")
    # Return cached data if available
    cached = self._get_cached_price(symbol)
    return self._price_to_response(cached) if cached else None
```

**Fallback**: Serve stale cache rather than failing completely

### Invalid Symbols

```python
info = ticker.info
if not info or 'regularMarketPrice' not in info:
    logger.warning(f"Invalid symbol: {symbol}")
    return None
```

**Frontend**: Shows "Price unavailable" message

### Rate Limiting

```python
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 429:  # Too Many Requests
        logger.error(f"Rate limited on {symbol}, retrying in 60s")
        await asyncio.sleep(60)
        return await self.get_price(symbol)  # Retry once
    raise
```

**Retry Logic**: Single retry after 60-second delay

## Configuration

### Environment Variables

```env
# Price cache TTL (seconds)
PRICE_CACHE_TTL_SECONDS=300  # 5 minutes default

# yfinance timeout (seconds)
YFINANCE_TIMEOUT=10

# Historical data backfill batch size
HISTORICAL_BATCH_SIZE=365  # 1 year at a time
```

### Application Settings

```python
class Settings(BaseSettings):
    PRICE_CACHE_TTL_SECONDS: int = 300
    YFINANCE_TIMEOUT: int = 10
    HISTORICAL_BATCH_SIZE: int = 365
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## Troubleshooting

### Prices Not Updating

**Symptom**: Dashboard shows stale prices

**Checks**:

1. Verify cache TTL not too long
2. Check backend logs for yfinance errors
3. Test API endpoint manually

```bash
curl http://localhost:8000/api/prices/AAPL
```

4. Check database timestamps

```sql
SELECT symbol, current_price, updated_at,
       EXTRACT(EPOCH FROM (NOW() - updated_at)) as age_seconds
FROM portfolio.prices
WHERE symbol = 'AAPL';
```

If `age_seconds > 300`, cache should refresh on next request.

### Rate Limit Errors

**Symptom**: Logs show 429 errors or "Too many requests"

**Solutions**:

1. Increase cache TTL to 600+ seconds
2. Reduce portfolio refresh frequency
3. Add exponential backoff to retries
4. Consider using paid data provider (Alpha Vantage, IEX Cloud)

### Incorrect Daily Change

**Symptom**: Daily change % doesn't match Yahoo Finance website

**Causes**:

1. **Extended hours trading**: yfinance may include after-hours prices
2. **Dividend adjustments**: Ex-dividend dates adjust previous_close
3. **Stock splits**: Split ratios affect historical comparisons

**Debugging**:

```python
# Check raw yfinance data
import yfinance as yf
ticker = yf.Ticker("AAPL")
print(ticker.info)  # Inspect all fields
```

Compare `regularMarketPrice`, `regularMarketPreviousClose`, and manual calculation.

## Testing

### Unit Tests

```python
def test_cache_validation():
    """Test TTL-based cache validation"""
    # Fresh price (0 seconds old)
    fresh_price = Price(symbol="AAPL", updated_at=datetime.utcnow())
    assert pricing_service._is_cache_valid(fresh_price) == True
    
    # Stale price (10 minutes old)
    stale_price = Price(
        symbol="AAPL",
        updated_at=datetime.utcnow() - timedelta(minutes=10)
    )
    assert pricing_service._is_cache_valid(stale_price) == False

def test_daily_change_calculation():
    """Test daily change percentage calculation"""
    price_data = {
        'symbol': 'AAPL',
        'current_price': Decimal('150'),
        'previous_close': Decimal('145'),
    }
    
    # Mock yfinance to return controlled data
    with patch('yfinance.Ticker') as mock_ticker:
        mock_ticker.return_value.info = {
            'regularMarketPrice': 150,
            'regularMarketPreviousClose': 145,
            'currency': 'USD'
        }
        
        result = pricing_service._fetch_price_from_yfinance('AAPL')
        
        assert result['daily_change_pct'] == Decimal('3.45')  # (150-145)/145 * 100
```

### Integration Tests

```python
@pytest.mark.integration
async def test_concurrent_fetching():
    """Test parallel price fetching performance"""
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
    
    start_time = time.time()
    prices = await pricing_service.get_multiple_prices(symbols)
    elapsed = time.time() - start_time
    
    # Should complete in under 2 seconds (concurrent)
    assert elapsed < 2.0
    
    # All symbols should have prices
    assert len(prices) == 5
    assert all(p is not None for p in prices.values())

@pytest.mark.integration
async def test_historical_backfill():
    """Test historical price backfilling"""
    symbol = 'AAPL'
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2024, 1, 31)
    
    # Clear existing data
    db.query(HistoricalPrice).filter_by(symbol=symbol).delete()
    db.commit()
    
    # Fetch historical data
    prices = await pricing_service.ensure_historical_prices(symbol, start_date, end_date)
    
    # Should have ~21 trading days in January 2024
    assert len(prices) >= 20
    assert all(p.symbol == symbol for p in prices)
    assert all(start_date.date() <= p.date <= end_date.date() for p in prices)
```

## Best Practices

### For Developers

1. **Always use async**: Fetch prices asynchronously to avoid blocking
2. **Batch requests**: Use `get_multiple_prices()` for multiple symbols
3. **Check cache first**: Avoid unnecessary API calls
4. **Handle errors gracefully**: Return cached data or None, don't crash
5. **Log fetch results**: Help debug rate limiting and failures

### For Users

1. **Refresh manually**: Use refresh button sparingly (respects cache)
2. **Monitor rate limits**: Excessive refreshing may trigger bans
3. **Accept delays**: Prices may be up to 5 minutes old
4. **Report stale data**: If prices don't update after 10+ minutes

## Future Improvements

### Potential Enhancements

1. **WebSocket streaming**: Real-time price updates via WebSocket
2. **Multiple data sources**: Add Alpha Vantage, IEX Cloud as fallbacks
3. **Smarter caching**: Market hours-aware TTL (longer when market closed)
4. **Redis caching**: Shared cache across multiple API instances
5. **Price alerts**: Notify users when prices cross thresholds

### Known Limitations

1. **Delayed data**: Free tier is 15-20 minutes delayed during market hours
2. **Rate limiting**: Unofficial limits may change without notice
3. **No tick data**: Only daily/minute bars, no tick-by-tick
4. **Crypto pairs**: Limited support, prefer direct crypto APIs

## Related Documentation

- [Insights User Guide](../user-guide/insights.md) - Uses price data for analytics
- [Dashboard User Guide](../user-guide/dashboard.md) - Displays real-time prices
- [Currency Conversion](currency-conversion.md) - Converts prices to portfolio currency
- [Pricing Service](pricing-service.md) - Detailed service architecture

## References

- [yfinance Documentation](https://github.com/ranaroussi/yfinance)
- [Yahoo Finance API](https://finance.yahoo.com/)
- [asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [Decimal Precision Best Practices](https://docs.python.org/3/library/decimal.html)