# Stock Splits

Technical documentation for stock split handling in Portfolium.

## Overview

Stock splits are corporate actions where a company divides existing shares into multiple shares. Portfolium tracks splits as special transactions to maintain accurate position quantities and cost basis calculations.

## Split Ratios

### Common Split Types

**Forward Splits** (increase shares)

- `2:1` - Each share becomes 2 shares (doubles quantity)
- `3:1` - Each share becomes 3 shares (triples quantity)
- `3:2` - Each 2 shares become 3 shares (1.5x multiplier)
- `7:4` - Each 4 shares become 7 shares (1.75x multiplier)

**Reverse Splits** (decrease shares)

- `1:2` - Each 2 shares become 1 share (halves quantity)
- `1:5` - Each 5 shares become 1 share (0.2x multiplier)
- `1:10` - Each 10 shares become 1 share (0.1x multiplier)

### Ratio Format

Format: `new:old`

```
new:old = multiplier

Examples:
2:1 = 2 ÷ 1 = 2.0 (double shares)
3:2 = 3 ÷ 2 = 1.5 (1.5x shares)
1:4 = 1 ÷ 4 = 0.25 (quarter shares)
```

## Database Representation

### Transaction Model

```python
class Transaction(Base):
    id: int
    portfolio_id: int
    asset_id: int
    tx_date: date                # Split effective date
    type: TransactionType.SPLIT  # Enum value
    quantity: Decimal            # Unused (set to 0)
    price: Decimal               # Unused (set to 0)
    fees: Decimal                # Always 0 for splits
    currency: str                # Asset currency
    meta_data: JSON              # {"split": "2:1"}
    notes: str                   # Optional user notes
```

### Metadata Structure

The split ratio is stored in the `meta_data` JSON field:

```json
{
  "split": "2:1"
}
```

**Key**: `"split"`
**Value**: String in format `"new:old"`

## Split Processing Logic

### Ratio Parsing

Located in `app/services/metrics.py`:

```python
def _parse_split_ratio(self, split_str: str) -> Decimal:
    """
    Parse split ratio string (e.g., "2:1" -> 2.0, "1:2" -> 0.5)
    
    Args:
        split_str: Ratio in "new:old" format
        
    Returns:
        Decimal multiplier for quantity adjustment
    """
    try:
        parts = split_str.split(":")
        if len(parts) == 2:
            numerator = Decimal(parts[0])
            denominator = Decimal(parts[1])
            return numerator / denominator
    except:
        pass
    return Decimal(1)  # Default: no split (1:1)
```

**Error Handling**:

- Invalid format returns `Decimal(1)` (no effect)
- Malformed ratios default to 1:1
- Division by zero caught by exception

### Position Calculation

When calculating current positions, splits affect quantity:

```python
# In MetricsService.get_position()

quantity = Decimal(0)
total_shares_for_cost = Decimal(0)
total_cost = Decimal(0)
total_buy_shares = Decimal(0)
total_sell_shares = Decimal(0)

for tx in sorted_transactions:
    if tx.type == TransactionType.BUY:
        quantity += tx.quantity
        total_cost += (tx.quantity * tx.price) + tx.fees
        total_shares_for_cost += tx.quantity
        total_buy_shares += tx.quantity
        
    elif tx.type == TransactionType.SELL:
        quantity -= tx.quantity
        # ... cost basis and P&L calculations
        total_sell_shares += tx.quantity
        
    elif tx.type == TransactionType.SPLIT:
        split_ratio = self._parse_split_ratio(
            tx.meta_data.get("split", "1:1")
        )
        
        # Adjust all running totals
        quantity *= split_ratio
        total_shares_for_cost *= split_ratio
        total_buy_shares *= split_ratio
        total_sell_shares *= split_ratio
        
        # Note: total_cost does NOT change
        # Cost basis remains constant, just spread over more/fewer shares
```

**Key Points**:

1. **Quantity multiplied**: `quantity *= split_ratio`
2. **Cost basis unchanged**: Total investment stays the same
3. **All share counts adjusted**: Buy shares, sell shares, and shares used for cost basis
4. **Chronological processing**: Splits applied in date order

### Example Calculation

**Scenario**: Forward split 2:1

```
Initial:
- BUY 100 shares @ $50 = $5,000 cost
- Current quantity: 100 shares
- Cost basis: $5,000

After SPLIT 2:1:
- Split multiplier: 2:1 = 2.0
- New quantity: 100 × 2.0 = 200 shares
- Cost basis: $5,000 (unchanged)
- New average cost: $5,000 ÷ 200 = $25/share
```

**Scenario**: Reverse split 1:4

```
Initial:
- BUY 100 shares @ $10 = $1,000 cost
- Current quantity: 100 shares
- Cost basis: $1,000

After SPLIT 1:4:
- Split multiplier: 1:4 = 0.25
- New quantity: 100 × 0.25 = 25 shares
- Cost basis: $1,000 (unchanged)
- New average cost: $1,000 ÷ 25 = $40/share
```

## Cost Basis Preservation

### Why Cost Basis Doesn't Change

Stock splits don't create or destroy value:

- You owned X% of the company before → still own X% after
- Total investment remains the same
- Only the number of pieces changes

### Average Cost Adjustment

```
Average Cost Per Share = Total Cost Basis ÷ Adjusted Quantity

Example (2:1 split):
Before: $5,000 ÷ 100 shares = $50/share
After:  $5,000 ÷ 200 shares = $25/share
```

The average cost per share changes, but total cost basis does not.

## Transaction Order Dependency

### Chronological Processing

Splits **must** be processed in chronological order:

```python
# Transactions sorted by date ascending
sorted_transactions = sorted(
    transactions, 
    key=lambda t: t.tx_date
)
```

**Why Order Matters**:

```
Correct (chronological):
1. BUY 100 @ $50 → quantity = 100
2. SPLIT 2:1 → quantity = 200
3. SELL 50 @ $30 → quantity = 150

Incorrect (wrong order):
1. BUY 100 @ $50 → quantity = 100
2. SELL 50 @ $30 → quantity = 50
3. SPLIT 2:1 → quantity = 100 (wrong!)
```

If sell happens before split is processed, the calculation is incorrect.

### Multi-Split Scenarios

Multiple splits compound:

```
Initial: 100 shares

SPLIT 2:1 → 200 shares (×2)
SPLIT 3:2 → 300 shares (×1.5)
SPLIT 1:5 → 60 shares  (×0.2)

Final multiplier: 2 × 1.5 × 0.2 = 0.6
Final quantity: 100 × 0.6 = 60 shares
```

## API Endpoints

### Create Split Transaction

`POST /api/transactions`

```json
{
  "portfolio_id": 1,
  "asset_id": 42,
  "tx_date": "2024-06-15",
  "type": "SPLIT",
  "quantity": 0,
  "price": 0,
  "fees": 0,
  "currency": "USD",
  "metadata": {
    "split": "2:1"
  },
  "notes": "2-for-1 forward split announced 2024-06-10"
}
```

**Required Fields**:

- `portfolio_id`: Target portfolio
- `asset_id`: Asset being split
- `tx_date`: Effective date of split
- `type`: Must be `"SPLIT"`
- `metadata.split`: Ratio in `"new:old"` format

**Optional Fields**:

- `quantity`, `price`, `fees`: Set to 0 (ignored)
- `notes`: User description
- `currency`: Inherited from asset if omitted

### Update Split

`PUT /api/transactions/{id}`

Can update:

- `tx_date`: Change effective date
- `metadata.split`: Correct the ratio
- `notes`: Update description

**Cannot change**:

- `type`: Must remain `SPLIT`
- `asset_id`: Use delete + create instead
- `portfolio_id`: Use delete + create instead

### Delete Split

`DELETE /api/transactions/{id}`

Removes the split transaction. Position calculations revert to pre-split values.

## User Interface

### Recording a Split

1. Navigate to Transactions page
2. Click **Add Transaction**
3. Select type: **SPLIT**
4. Choose the asset
5. Enter effective date
6. Input split ratio (e.g., "2:1")
7. Add optional notes
8. Click **Add Transaction**

### Split Ratio Input

Format requirements:

- Two numbers separated by colon `:`
- New shares first, old shares second
- Examples: `2:1`, `3:2`, `1:5`, `7:4`
- Decimals allowed: `1.5:1` (same as `3:2`)

### Validation

Frontend and backend validate:

- Ratio format (must contain `:`)
- Positive numbers only
- Both parts numeric
- Not `0:X` or `X:0`

## Edge Cases

### Fractional Shares

Some splits result in fractional shares:

```
100 shares, 3:2 split
100 × 1.5 = 150 shares (whole number)

101 shares, 3:2 split
101 × 1.5 = 151.5 shares (fractional)
```

Portfolium uses `Decimal` type (precision up to 8 decimal places):

```python
quantity: Decimal(20, 8)  # e.g., 151.50000000
```

Brokers typically:

- Pay cash for fractional shares
- Round to whole shares
- Issue share certificates for fractions

Record the fractional result, then add a SELL transaction for the cash-in-lieu if applicable.

### Cash-in-Lieu Transactions

When brokers pay cash instead of fractional shares:

```
Example: 3:2 split on 101 shares

1. SPLIT 3:2 → 151.5 shares
2. SELL 0.5 shares @ $market_price (cash-in-lieu)

Final: 151 whole shares
```

### Multiple Splits Same Day

If multiple splits occur on the same day (rare), order by:

1. Split affecting more shares first
2. Forward splits before reverse splits
3. Or specify time in notes

Portfolium processes transactions with the same date in insertion order (by `id`).

### Zero or One-Share Positions

After reverse splits, you might have:

```
1 share, 1:10 split
1 × 0.1 = 0.1 shares
```

If rounded to 0, the position is effectively closed. Record as:

```
1. SPLIT 1:10 → 0.1 shares
2. SELL 0.1 shares @ $0 (eliminated by brokerage)
```

## Reporting and Display

### Transaction History

Splits appear in transaction list as:

```
Symbol  | Type  | Quantity | Price | Date       | Notes
--------|-------|----------|-------|------------|----------------
AAPL    | SPLIT | -        | -     | 2024-06-15 | 2:1 forward split
```

Quantity and price columns may show:

- Blank or dash (`-`)
- The split ratio (`2:1`)
- Zero (`0`)

### Asset Detail Page

Shows splits chronologically with BUY/SELL transactions:

```
Date       | Type  | Quantity | Price  | Notes
-----------|-------|----------|--------|------------------------
2024-01-10 | BUY   | 100      | $50.00 | Initial purchase
2024-06-15 | SPLIT | -        | -      | 2:1 forward split
2024-09-01 | SELL  | 50       | $30.00 | Partial sale (post-split)
```

### Position Summary

Current position reflects all splits:

```
Symbol: AAPL
Quantity: 150 shares
Average Cost: $25.00
Cost Basis: $5,000
```

This is after:

- BUY 100 @ $50 = $5,000
- SPLIT 2:1 → 200 shares @ $25 avg
- SELL 50 @ $30 → 150 shares remain

## Common Errors

### Incorrect Ratio Direction

**Problem**: User enters `1:2` when they meant `2:1`

**Symptom**: Position quantity halves instead of doubling

**Solution**: Edit the split transaction and correct the ratio

### Missing Split

**Problem**: User doesn't record a split that occurred

**Symptom**: 
- Position quantity is wrong (half or double expected)
- Average cost doesn't match brokerage

**Solution**: Add the missing SPLIT transaction with the correct date and ratio

### Split Date Wrong

**Problem**: Split recorded before/after actual effective date

**Symptom**: Calculations are off when selling around the split date

**Solution**: Edit the split date to match the actual effective date (usually provided by broker)

### Double-Counting Splits

**Problem**: Split recorded twice (once manually, once from import)

**Symptom**: Position is 2x or 4x what it should be

**Solution**: Delete the duplicate split transaction

## Testing

### Test Cases

```python
def test_forward_split_2_for_1():
    """Test 2:1 forward split doubles quantity"""
    # Setup: BUY 100 shares
    position_before = get_position(portfolio_id, asset_id)
    assert position_before.quantity == Decimal("100")
    
    # Execute: SPLIT 2:1
    create_transaction(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        type=TransactionType.SPLIT,
        tx_date=date(2024, 6, 15),
        metadata={"split": "2:1"}
    )
    
    # Verify
    position_after = get_position(portfolio_id, asset_id)
    assert position_after.quantity == Decimal("200")
    assert position_after.cost_basis == position_before.cost_basis
    
def test_reverse_split_1_for_4():
    """Test 1:4 reverse split quarters quantity"""
    # Setup: BUY 100 shares @ $10
    position_before = get_position(portfolio_id, asset_id)
    assert position_before.quantity == Decimal("100")
    cost_basis = Decimal("1000")
    
    # Execute: SPLIT 1:4
    create_transaction(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        type=TransactionType.SPLIT,
        tx_date=date(2024, 6, 15),
        metadata={"split": "1:4"}
    )
    
    # Verify
    position_after = get_position(portfolio_id, asset_id)
    assert position_after.quantity == Decimal("25")
    assert position_after.cost_basis == cost_basis
    assert position_after.avg_cost == Decimal("40")  # 1000 / 25

def test_split_chronological_order():
    """Test splits are applied in chronological order"""
    # BUY 100, SPLIT 2:1, SELL 50
    assert final_quantity == Decimal("150")  # (100 * 2) - 50
    
    # Not: (100 - 50) * 2 = 100 (wrong!)
```

### Manual Testing

1. Create test portfolio
2. BUY 100 shares of a stock
3. Record a SPLIT 2:1 transaction
4. Verify quantity doubles to 200
5. Verify average cost halves
6. Verify total cost basis unchanged
7. SELL 50 shares post-split
8. Verify quantity reduces to 150

## Best Practices

### For Users

1. **Record splits promptly**: Don't wait until you sell
2. **Use broker date**: Use effective date from brokerage statement
3. **Check ratio direction**: Verify new:old format
4. **Add notes**: Document source (e.g., "Per AAPL press release 2024-06-10")
5. **Verify position**: Check quantity matches brokerage after split

### For Developers

1. **Always sort by date**: Process transactions chronologically
2. **Use Decimal type**: Avoid floating-point errors
3. **Preserve cost basis**: Never modify total_cost for splits
4. **Apply to all counters**: Adjust quantity, buy shares, sell shares, cost shares
5. **Test edge cases**: Fractional shares, multiple splits, reverse splits
6. **Validate input**: Check ratio format before parsing

## Related Documentation

- [Transactions User Guide](../user-guide/transactions.md) - User instructions for recording splits
- [Data Models](data-models.md) - Transaction model schema
- [Pricing Service](pricing-service.md) - How splits affect price history

## References

- [Investopedia: Stock Splits](https://www.investopedia.com/terms/s/stocksplit.asp)
- [SEC: Stock Splits](https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-splits)
- ISO 15022 standard for corporate actions (used by some financial systems)