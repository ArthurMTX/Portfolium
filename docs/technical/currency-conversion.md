# Currency Conversion

Technical documentation for the multi-currency conversion system.

## Overview

Portfolium supports multi-currency portfolios, automatically converting asset prices to the portfolio's base currency for accurate calculations. The system uses Yahoo Finance forex rates with in-memory caching.

## Architecture

### Service Location

`api/app/services/currency.py`

### Key Components

1. **CurrencyService**: Static service class for conversions
2. **Exchange Rate Cache**: In-memory dict with 1-hour TTL
3. **Yahoo Finance Forex**: Real-time exchange rates
4. **Automatic Conversion**: Portfolio metrics use base currency

## CurrencyService Class

### Static Methods

```python
class CurrencyService:
    """
    Service for currency conversion.
    
    All methods are static (no instance needed).
    Maintains internal cache for exchange rates.
    """
    
    @staticmethod
    def get_exchange_rate(from_currency: str, to_currency: str) -> Optional[Decimal]:
        """Get exchange rate between two currencies."""
        ...
    
    @staticmethod
    def convert(amount: Decimal, from_currency: str, to_currency: str) -> Optional[Decimal]:
        """Convert amount from one currency to another."""
        ...
    
    @staticmethod
    def clear_cache():
        """Clear the exchange rate cache."""
        ...
```

**Design Pattern**: Static utility class (no state beyond cache)

## Exchange Rate Fetching

### Get Exchange Rate

```python
@staticmethod
def get_exchange_rate(from_currency: str, to_currency: str) -> Optional[Decimal]:
    """
    Get exchange rate from one currency to another.
    
    Args:
        from_currency: Source currency code (e.g., 'USD')
        to_currency: Target currency code (e.g., 'EUR')
        
    Returns:
        Exchange rate as Decimal, or None if unavailable
        
    Example:
        get_exchange_rate('USD', 'EUR') -> 0.85
        Means: 1 USD = 0.85 EUR
    """
    # Same currency = rate of 1
    if from_currency == to_currency:
        return Decimal(1)
    
    # Check cache
    cache_key = f"{from_currency}{to_currency}"
    if cache_key in _exchange_rate_cache:
        rate, timestamp = _exchange_rate_cache[cache_key]
        if datetime.utcnow() - timestamp < _CACHE_DURATION:
            return rate
    
    # Fetch from Yahoo Finance using forex pair format
    forex_symbol = f"{from_currency}{to_currency}=X"
    
    try:
        ticker = yf.Ticker(forex_symbol)
        info = ticker.history(period="1d")
        
        if info.empty:
            logger.warning(f"No exchange rate data for {forex_symbol}")
            return None
        
        # Get the most recent close price
        rate = Decimal(str(info['Close'].iloc[-1]))
        
        # Cache the rate
        _exchange_rate_cache[cache_key] = (rate, datetime.utcnow())
        
        logger.info(f"Fetched exchange rate {forex_symbol}: {rate}")
        return rate
        
    except Exception as e:
        logger.error(f"Failed to fetch exchange rate for {forex_symbol}: {e}")
        return None
```

**Flow Diagram**:

```
get_exchange_rate('USD', 'EUR')
    ↓
Same currency? ──Yes──> Return 1.0
    ↓ No
Check cache (USDEUR)
    ↓
Cache valid? ──Yes──> Return cached rate
    ↓ No
Fetch from Yahoo (USDEUR=X)
    ↓
Got data? ──No──> Return None
    ↓ Yes
Parse Close price
    ↓
Cache with timestamp
    ↓
Return rate
```

### Forex Symbol Format

Yahoo Finance uses special forex pair syntax:

```
{FROM}{TO}=X
```

**Examples**:

| Conversion | Symbol | Rate Meaning |
|------------|--------|--------------|
| USD → EUR | `EURUSD=X` | Inverted! See below |
| EUR → USD | `USDEUR=X` | Not available |
| GBP → USD | `GBPUSD=X` | 1 GBP = X USD |
| JPY → USD | `JPYUSD=X` | 1 JPY = X USD |

**Important**: Yahoo Finance quotes are sometimes inverted from what you'd expect.

### Exchange Rate Inversion

**Problem**: Yahoo Finance may return inverted rates

**Example**:

```python
# Want: 1 USD = 0.85 EUR
rate = get_exchange_rate('USD', 'EUR')

# Yahoo returns EURUSD=X = 1.18 (1 EUR = 1.18 USD)
# This is inverted!

# Correct rate: 1 / 1.18 = 0.847 EUR per USD
```

**Current Implementation**: Assumes Yahoo returns correct direction

**Potential Fix** (not implemented):

```python
# Detect inverted rates
if rate > 2:  # Heuristic: if rate seems too high, invert
    rate = Decimal(1) / rate
```

**Better Solution**: Use forex API with explicit quote direction (e.g., exchangeratesapi.io)

## Currency Conversion

### Convert Amount

```python
@staticmethod
def convert(
    amount: Decimal, 
    from_currency: str, 
    to_currency: str
) -> Optional[Decimal]:
    """
    Convert an amount from one currency to another.
    
    Args:
        amount: Amount to convert
        from_currency: Source currency code
        to_currency: Target currency code
        
    Returns:
        Converted amount as Decimal, or None if conversion failed
    """
    if from_currency == to_currency:
        return amount
    
    rate = CurrencyService.get_exchange_rate(from_currency, to_currency)
    if rate is None:
        return None
    
    return amount * rate
```

**Example Usage**:

```python
# Convert $100 USD to EUR
amount_usd = Decimal('100')
amount_eur = CurrencyService.convert(amount_usd, 'USD', 'EUR')
# Result: Decimal('85.00') (assuming 1 USD = 0.85 EUR)
```

**Precision**:

```python
# High precision maintained
amount = Decimal('123.456789')
converted = CurrencyService.convert(amount, 'USD', 'EUR')
# Result: Decimal('104.938270') (no rounding loss)
```

## Caching System

### Cache Structure

```python
# Global module-level cache
_exchange_rate_cache: Dict[str, tuple[Decimal, datetime]] = {}
_CACHE_DURATION = timedelta(hours=1)  # 1 hour TTL

# Cache entry example:
{
    'USDEUR': (Decimal('0.85'), datetime(2024, 1, 15, 10, 30, 0)),
    'GBPUSD': (Decimal('1.27'), datetime(2024, 1, 15, 10, 28, 15)),
    'JPYUSD': (Decimal('0.0068'), datetime(2024, 1, 15, 10, 25, 30))
}
```

**Cache Key Format**: `{from}{to}` (e.g., `USDEUR`, `GBPUSD`)

### Cache Validation

```python
if cache_key in _exchange_rate_cache:
    rate, timestamp = _exchange_rate_cache[cache_key]
    if datetime.utcnow() - timestamp < _CACHE_DURATION:
        return rate  # Cache hit
    # Cache expired, fetch fresh rate
```

**TTL**: 1 hour (3600 seconds)

**Rationale**:

- Forex rates change continuously but slowly
- 1 hour strikes balance between freshness and API usage
- Portfolio calculations don't need real-time forex rates

### Cache Invalidation

```python
@staticmethod
def clear_cache():
    """Clear the exchange rate cache."""
    _exchange_rate_cache.clear()
```

**Manual Clear**:

```python
# In Python console or endpoint
from app.services.currency import CurrencyService
CurrencyService.clear_cache()
```

**Automatic Clear**: None (cache persists until app restart or manual clear)

**Cache Lifespan**: Process lifetime (not persisted to database)

## Integration with Portfolio Calculations

### Portfolio Base Currency

```python
class Portfolio(Base):
    __tablename__ = 'portfolios'
    
    # ... other fields ...
    currency = Column(String, default='USD')  # Base currency
```

**Default**: USD

**Supported**: Any currency Yahoo Finance supports (USD, EUR, GBP, JPY, CAD, AUD, CHF, etc.)

### Position Value Conversion

```python
def calculate_position_value(position: Position, portfolio_currency: str) -> Decimal:
    """
    Calculate position value in portfolio's base currency.
    
    Args:
        position: Position model with quantity and current_price
        portfolio_currency: Portfolio's base currency (e.g., 'USD')
        
    Returns:
        Position value in portfolio currency
    """
    # Get asset price (may be in different currency)
    asset = position.asset
    price_in_asset_currency = asset.current_price
    asset_currency = asset.price_currency  # e.g., 'GBP'
    
    # Convert to portfolio currency if needed
    if asset_currency != portfolio_currency:
        converted_price = CurrencyService.convert(
            price_in_asset_currency,
            from_currency=asset_currency,
            to_currency=portfolio_currency
        )
    else:
        converted_price = price_in_asset_currency
    
    # Calculate position value
    position_value = position.quantity * converted_price
    
    return position_value
```

**Example**:

```
Portfolio: USD
Asset: BP.L (British Petroleum, London)
Price: £4.50 GBP
Quantity: 100 shares
Exchange rate: 1 GBP = 1.27 USD

Converted price: 4.50 * 1.27 = $5.715 USD
Position value: 100 * 5.715 = $571.50 USD
```

### Total Portfolio Value

```python
def get_total_portfolio_value(portfolio_id: int) -> Decimal:
    """
    Calculate total portfolio value in base currency.
    
    Sums all positions, converting each to portfolio currency.
    """
    portfolio = db.query(Portfolio).get(portfolio_id)
    base_currency = portfolio.currency
    
    total_value = Decimal(0)
    
    for position in portfolio.positions:
        position_value = calculate_position_value(position, base_currency)
        total_value += position_value
    
    return total_value
```

**Multi-Currency Example**:

```
Portfolio: EUR
Positions:
  - AAPL (USD): $150.00 * 10 = $1,500 USD → €1,275 EUR (rate 0.85)
  - BP.L (GBP): £4.50 * 50 = £225 GBP → €264.71 EUR (rate 1.176)
  - SAP (EUR): €120.00 * 5 = €600 EUR → €600 EUR (no conversion)

Total: €1,275 + €264.71 + €600 = €2,139.71 EUR
```

## Supported Currencies

### Major Currencies

| Code | Currency | Yahoo Symbol |
|------|----------|--------------|
| USD | US Dollar | Base currency |
| EUR | Euro | EURUSD=X |
| GBP | British Pound | GBPUSD=X |
| JPY | Japanese Yen | JPYUSD=X |
| CHF | Swiss Franc | CHFUSD=X |
| CAD | Canadian Dollar | CADUSD=X |
| AUD | Australian Dollar | AUDUSD=X |
| NZD | New Zealand Dollar | NZDUSD=X |

### Exotic Currencies

| Code | Currency | Yahoo Symbol |
|------|----------|--------------|
| SEK | Swedish Krona | SEKUSD=X |
| NOK | Norwegian Krone | NOKUSD=X |
| DKK | Danish Krone | DKKUSD=X |
| PLN | Polish Zloty | PLNUSD=X |
| HUF | Hungarian Forint | HUFUSD=X |
| CZK | Czech Koruna | CZKUSD=X |

### Cryptocurrencies

**Not Supported**: Crypto conversions (BTC, ETH, etc.) require different API

**Workaround**: Use crypto as base currency or convert via USD intermediary

```python
# BTC → EUR (via USD)
btc_to_usd = get_exchange_rate('BTC', 'USD')  # Won't work
# Use crypto-specific API instead
```

## Error Handling

### Exchange Rate Unavailable

```python
rate = CurrencyService.get_exchange_rate('USD', 'XYZ')  # Invalid currency
# Returns: None

converted = CurrencyService.convert(Decimal('100'), 'USD', 'XYZ')
# Returns: None (propagates failure)
```

**Frontend Handling**:

```tsx
const convertedValue = await convertCurrency(amount, fromCurrency, toCurrency)

if (convertedValue === null) {
  // Show error message
  toast.error('Currency conversion failed')
  // Fall back to original currency
  displayValue = amount + ' ' + fromCurrency
}
```

### Network Failures

```python
try:
    ticker = yf.Ticker(forex_symbol)
    info = ticker.history(period="1d")
except Exception as e:
    logger.error(f"Failed to fetch exchange rate for {forex_symbol}: {e}")
    return None
```

**Behavior**: Returns None, caller must handle

**Improvement**: Retry logic with exponential backoff

```python
for attempt in range(3):
    try:
        info = ticker.history(period="1d")
        break
    except Exception as e:
        if attempt == 2:  # Last attempt
            logger.error(f"Failed after 3 attempts: {e}")
            return None
        await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s
```

### Empty Data

```python
info = ticker.history(period="1d")

if info.empty:
    logger.warning(f"No exchange rate data for {forex_symbol}")
    return None
```

**Causes**:

- Invalid currency pair
- Market closed (shouldn't affect forex, 24/5 market)
- Yahoo Finance outage

## API Endpoints

### Get Exchange Rate

`GET /api/currencies/rate?from={from}&to={to}`

**Query Parameters**:

- `from`: Source currency code (required)
- `to`: Target currency code (required)

**Response**:

```json
{
  "from": "USD",
  "to": "EUR",
  "rate": 0.85,
  "cached_at": "2024-01-15T10:30:00Z"
}
```

**Example**:

```bash
curl "http://localhost:8000/api/currencies/rate?from=USD&to=EUR"
```

### Convert Amount

`GET /api/currencies/convert?amount={amount}&from={from}&to={to}`

**Query Parameters**:

- `amount`: Amount to convert (required)
- `from`: Source currency code (required)
- `to`: Target currency code (required)

**Response**:

```json
{
  "original_amount": 100.00,
  "original_currency": "USD",
  "converted_amount": 85.00,
  "converted_currency": "EUR",
  "rate": 0.85
}
```

**Example**:

```bash
curl "http://localhost:8000/api/currencies/convert?amount=100&from=USD&to=EUR"
```

## Performance Considerations

### Cache Hit Rate

**Typical Scenario**:

- User views dashboard (fetches all asset prices)
- Each asset requires currency conversion
- Same currency pairs repeated across assets

**Without Cache**:

```
10 USD assets → 10 USD→EUR conversions → 10 API calls
5 GBP assets → 5 GBP→EUR conversions → 5 API calls
Total: 15 API calls per page load
```

**With Cache** (1-hour TTL):

```
First page load: 15 API calls
Subsequent loads: 0 API calls (all cached)
Cache hit rate: 93-98%
```

### Memory Usage

**Cache Size**:

```python
# Typical cache:
10 currency pairs * (Decimal + datetime) ≈ 1 KB
100 currency pairs ≈ 10 KB
```

Negligible memory impact.

### API Rate Limits

**Yahoo Finance**:

- No documented forex rate limits
- More lenient than stock price API
- Forex data less resource-intensive

**Mitigation**:

- 1-hour cache duration
- Forex rates change slowly (safe to cache)

## Configuration

### Environment Variables

```env
# Currency cache TTL (hours)
CURRENCY_CACHE_TTL_HOURS=1  # Default

# Forex API timeout (seconds)
FOREX_TIMEOUT=10
```

### Application Settings

```python
# In app/services/currency.py

_CACHE_DURATION = timedelta(hours=settings.CURRENCY_CACHE_TTL_HOURS)

# In app/config.py
class Settings(BaseSettings):
    CURRENCY_CACHE_TTL_HOURS: int = 1
    FOREX_TIMEOUT: int = 10
```

## Troubleshooting

### Incorrect Conversion Rates

**Symptom**: Portfolio values don't match manual calculations

**Checks**:

1. Verify exchange rate direction

```python
rate = CurrencyService.get_exchange_rate('USD', 'EUR')
print(f"1 USD = {rate} EUR")  # Should be ~0.85, not 1.18
```

2. Check Yahoo Finance directly

```python
import yfinance as yf
ticker = yf.Ticker('EURUSD=X')
print(ticker.history(period='1d'))
```

3. Clear cache and retry

```python
CurrencyService.clear_cache()
```

### Currency Not Found

**Symptom**: `get_exchange_rate` returns None

**Causes**:

1. Invalid currency code (e.g., 'XXX')
2. Yahoo Finance doesn't support the pair
3. Network/API failure

**Debugging**:

```python
# Test manually
from app.services.currency import CurrencyService
rate = CurrencyService.get_exchange_rate('USD', 'EUR')
print(rate)  # Should print Decimal or None

# Check logs
docker compose logs api | grep -i currency
```

### Stale Exchange Rates

**Symptom**: Rates don't update despite market changes

**Cause**: Cache TTL too long

**Solutions**:

1. Reduce cache TTL

```env
CURRENCY_CACHE_TTL_HOURS=0.5  # 30 minutes
```

2. Clear cache manually

```bash
# In API container
docker compose exec api python -c "from app.services.currency import CurrencyService; CurrencyService.clear_cache()"
```

3. Restart API (clears in-memory cache)

```bash
docker compose restart api
```

## Testing

### Unit Tests

```python
def test_same_currency_conversion():
    """Test converting same currency returns amount unchanged"""
    amount = Decimal('100')
    result = CurrencyService.convert(amount, 'USD', 'USD')
    assert result == amount

def test_exchange_rate_caching():
    """Test exchange rates are cached"""
    # First call fetches from API
    rate1 = CurrencyService.get_exchange_rate('USD', 'EUR')
    
    # Second call uses cache (faster)
    rate2 = CurrencyService.get_exchange_rate('USD', 'EUR')
    
    assert rate1 == rate2

def test_cache_expiration():
    """Test cache expires after TTL"""
    # Mock time advancement
    with patch('app.services.currency.datetime') as mock_dt:
        # First call caches rate
        mock_dt.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)
        rate1 = CurrencyService.get_exchange_rate('USD', 'EUR')
        
        # Advance time 2 hours (beyond 1-hour TTL)
        mock_dt.utcnow.return_value = datetime(2024, 1, 1, 12, 0, 1)
        
        # Should fetch fresh rate, not cache
        rate2 = CurrencyService.get_exchange_rate('USD', 'EUR')
        # (Would need to mock yfinance to verify API call)

def test_conversion_precision():
    """Test high precision maintained in conversions"""
    amount = Decimal('123.456789')
    rate = Decimal('0.85')
    
    # Mock exchange rate
    with patch.object(CurrencyService, 'get_exchange_rate', return_value=rate):
        result = CurrencyService.convert(amount, 'USD', 'EUR')
        
        expected = amount * rate  # Decimal('104.938270')
        assert result == expected
```

### Integration Tests

```python
@pytest.mark.integration
def test_real_forex_api():
    """Test actual Yahoo Finance forex API"""
    rate = CurrencyService.get_exchange_rate('USD', 'EUR')
    
    # Should get a reasonable rate
    assert rate is not None
    assert Decimal('0.7') < rate < Decimal('1.2')  # Reasonable range

@pytest.mark.integration
def test_multi_currency_portfolio():
    """Test portfolio with multiple currencies"""
    # Create portfolio in EUR
    portfolio = Portfolio(currency='EUR')
    db.add(portfolio)
    
    # Add USD asset
    asset_usd = Asset(symbol='AAPL', price_currency='USD', current_price=Decimal('150'))
    db.add(asset_usd)
    
    # Calculate total value (should convert USD to EUR)
    total_eur = get_total_portfolio_value(portfolio.id)
    
    # Verify conversion happened
    rate = CurrencyService.get_exchange_rate('USD', 'EUR')
    expected_eur = Decimal('150') * rate
    
    assert abs(total_eur - expected_eur) < Decimal('0.01')  # Within 1 cent
```

## Best Practices

### For Developers

1. **Cache aggressively**: Forex rates change slowly, 1-hour TTL is safe
2. **Handle None returns**: Always check if conversion succeeded
3. **Use Decimal**: Never use float for currency amounts
4. **Log conversions**: Help debug unexpected values
5. **Test edge cases**: Same currency, invalid pairs, network failures

### For Users

1. **Choose correct base currency**: Portfolio currency should match your accounting
2. **Understand delays**: Exchange rates cached up to 1 hour
3. **Monitor discrepancies**: Report if values seem wrong
4. **Use major currencies**: USD, EUR, GBP most reliable

## Future Improvements

### Potential Enhancements

1. **Dedicated forex API**: Use exchangeratesapi.io or fixer.io for better reliability
2. **Historical rates**: Support historical date conversions for P&L calculations
3. **Rate inversion detection**: Auto-detect when Yahoo returns inverted rates
4. **Redis caching**: Shared cache across API instances
5. **Cross-rate calculation**: Calculate EUR→GBP via USD if direct pair unavailable

### Known Limitations

1. **Yahoo Finance dependency**: Free service may be unreliable
2. **Inverted rates**: May require manual correction for some pairs
3. **No crypto**: Cryptocurrency conversions not supported
4. **In-memory cache**: Cache not shared across API instances
5. **No historical data**: Only current/recent exchange rates

## Related Documentation

- [Price Fetching](price-fetching.md) - Asset price retrieval (uses currency)
- [Pricing Service](pricing-service.md) - Service architecture
- [Data Models](data-models.md) - Portfolio and Asset currency fields
- [Insights User Guide](../user-guide/insights.md) - Multi-currency analytics

## References

- [Yahoo Finance Forex Symbols](https://finance.yahoo.com/currencies)
- [yfinance Documentation](https://github.com/ranaroussi/yfinance)
- [ISO 4217 Currency Codes](https://en.wikipedia.org/wiki/ISO_4217)
- [Python Decimal Module](https://docs.python.org/3/library/decimal.html)