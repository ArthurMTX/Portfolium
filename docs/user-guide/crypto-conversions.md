# Crypto Conversions

Swap one cryptocurrency for another within your portfolio using the crypto conversion feature.

## Overview

Crypto conversions allow you to record cryptocurrency swaps (e.g., converting BTC to ETH) as a single transaction. This is essential for tracking trades made on exchanges like Binance, Coinbase, or Kraken where you swap one crypto directly for another without going through fiat currency.

Instead of recording separate sell and buy transactions, a conversion captures the entire swap in one step, maintaining accurate portfolio records and simplifying your transaction history.

## When to Use Conversions

Use crypto conversions when you:

- **Swap crypto-to-crypto**: Exchange one cryptocurrency for another (BTC → ETH, SOL → USDT)
- **Trade on DEX platforms**: Record swaps made on decentralized exchanges
- **Rebalance crypto holdings**: Move value between different cryptocurrencies
- **Convert stablecoins**: Swap between different stablecoins (USDT → USDC)

!!! tip "Conversions vs Regular Transactions"
    Use conversions for direct crypto swaps. Use regular BUY/SELL transactions when trading crypto for fiat currency (USD, EUR, etc.).

## Accessing Crypto Conversions

1. Navigate to the **Transactions** page
2. Click the **Convert Crypto** button
3. The conversion modal will open

!!! note "Crypto Assets Required"
    You must have at least one cryptocurrency in your portfolio to use conversions. The source asset must be a crypto you already own.

## Recording a Conversion

### Step 1: Select the Transaction Date

1. Choose the **Date** when the conversion occurred
2. Defaults to today's date
3. Use the date picker to select a past date if needed

### Step 2: Select Source Asset (From Crypto)

The "From Crypto" section shows all cryptocurrencies you currently hold:

1. Click on the crypto you want to convert **from**
2. The list displays:
    - **Asset logo**: Visual identification
    - **Symbol**: Ticker (BTC-USD, ETH-USD)
    - **Name**: Full cryptocurrency name
3. After selection, you'll see your current holdings displayed

**Example**: If converting from Bitcoin, click "BTC-USD - Bitcoin USD"

### Step 3: Select Target Asset (To Crypto)

Search for the cryptocurrency you want to convert **to**:

1. Type in the search field (e.g., "eth", "ethereum")
2. Results show only cryptocurrency assets
3. Click to select the target crypto
4. If you already own this crypto, your current quantity is shown

**Example**: Search "ETH" and select "ETH-USD - Ethereum USD"

### Step 4: Enter Quantities and Prices

The conversion form has two sections:

**You Send (Red Section)**

- **Quantity**: Amount of source crypto you're converting
- **Price per unit**: Price of source crypto in your portfolio currency
- Click the refresh icon to fetch the current market price

**You Receive (Green Section)**

- **Quantity**: Amount of target crypto you'll receive
- **Price per unit**: Price of target crypto in your portfolio currency
- Click the refresh icon to fetch the current market price

!!! tip "Auto-Calculate Quantity"
    When you enter the "From" quantity and both prices, the "To" quantity is automatically calculated based on the conversion rate. You can override this by manually editing the "To" quantity field.

### Step 5: Review the Conversion Rate

A purple info box displays the calculated conversion rate:

- Shows how many units of the target crypto equal 1 unit of the source crypto
- Also displays the inverse rate for reference

**Example**:
```
Rate: 1 BTC-USD = 15.234567 ETH-USD
1 ETH-USD = 0.065641 BTC-USD
```

### Step 6: Add Optional Details

**Fees**

- Enter any network or exchange fees paid
- Fees are recorded in your portfolio currency

**Notes**

- Add context about the conversion
- Examples:
    - "Swapped on Binance"
    - "Rebalancing to more ETH exposure"
    - "Taking profits from BTC"

### Step 7: Complete the Conversion

1. Review all details
2. Click the **Convert** button
3. Wait for confirmation
4. The modal closes automatically on success

## Understanding Conversion Mechanics

### What Happens Behind the Scenes

When you create a conversion, Portfolium records:

1. A **SELL** transaction for the source crypto (reduces your holdings)
2. A **BUY** transaction for the target crypto (increases your holdings)
3. Both transactions are linked and dated the same

### Price Handling

- Prices are converted to your portfolio's base currency
- Current market prices can be fetched automatically
- You can manually override prices if they differ from market rates

### Portfolio Impact

After a conversion:

- **Source crypto**: Quantity decreases by the "From" amount
- **Target crypto**: Quantity increases by the "To" amount
- **Total value**: Remains approximately the same (minus fees)
- **Performance metrics**: Updated to reflect the new holdings

## Examples

### Example 1: Converting BTC to ETH

**Scenario**: You want to convert 0.5 BTC to ETH

1. Open the conversion modal
2. Select **BTC-USD** as source (From Crypto)
3. Search and select **ETH-USD** as target (To Crypto)
4. Enter:
    - From Quantity: `0.5`
    - From Price: `$45,000` (auto-fetched)
    - To Price: `$2,500` (auto-fetched)
5. Auto-calculated To Quantity: `9` ETH
6. Add notes: "Rebalancing crypto allocation"
7. Click **Convert**

**Result**: 
- BTC holdings: decreased by 0.5
- ETH holdings: increased by 9

### Example 2: Stablecoin Swap

**Scenario**: Converting USDT to USDC

1. Select **USDT-USD** as source
2. Select **USDC-USD** as target
3. Enter:
    - From Quantity: `1000`
    - From Price: `$1.00`
    - To Quantity: `1000`
    - To Price: `$1.00`
4. Fees: `$0.50`
5. Click **Convert**

## Viewing Conversion History

Conversions appear in your transaction history as linked BUY/SELL pairs:

1. Go to **Transactions** page
2. Filter by transaction type if needed
3. Conversion-related transactions show the same date and linked amounts

## Troubleshooting

### "No crypto assets in portfolio"

You need to own at least one cryptocurrency to make conversions. First add a BUY transaction for a crypto asset.

### "Cannot convert an asset to itself"

Select different cryptocurrencies for source and target. You cannot convert BTC to BTC.

### Price Not Auto-Fetching

If the price refresh doesn't work:

1. Check your internet connection
2. The cryptocurrency may be newly listed
3. Enter the price manually from your exchange

### Quantity Calculation Seems Wrong

The auto-calculated quantity uses the formula:

$$
\text{To Quantity} = \frac{\text{From Quantity} \times \text{From Price}}{\text{To Price}}
$$

If this doesn't match your actual exchange trade, manually enter the correct "To" quantity.

## Best Practices

1. **Record promptly**: Log conversions soon after making them to ensure accurate prices
2. **Use exact prices**: Enter the actual prices from your exchange for accurate cost basis
3. **Include fees**: Don't forget network/exchange fees for complete records
4. **Add notes**: Document which exchange you used and why you made the swap
5. **Verify quantities**: Double-check the calculated quantity matches your exchange confirmation

!!! warning "Tax Implications"
    Crypto-to-crypto conversions may be taxable events in many jurisdictions. Consult with a tax professional regarding your specific situation.
