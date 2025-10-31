# Transactions

Learn how to record and manage your investment transactions.

## Overview

Transactions are the building blocks of your portfolio. Every buy, sell, dividend, or stock split is recorded as a transaction, allowing you to track the complete history of your investments and calculate accurate performance metrics.

## Transaction Types

Portfolium supports several types of transactions:

- **BUY**: Purchase of shares or units
- **SELL**: Sale of shares or units
- **DIVIDEND**: Dividend payments received
- **FEE**: Transaction fees or charges
- **SPLIT**: Stock splits or reverse splits
- **TRANSFER_IN**: Transfer of shares into this portfolio
- **TRANSFER_OUT**: Transfer of shares out of this portfolio

## Adding a Transaction

### Quick Add with Auto-Price

1. Navigate to the **Transactions** page
2. Click the **Add Transaction** button
3. Search for your asset by ticker symbol
4. Select the asset from the search results
5. Enter transaction details:
    - **Date**: When the transaction occurred
    - **Type**: Select transaction type (BUY, SELL, etc.)
    - **Quantity**: Number of shares or units
    - **Price**: Leave empty to auto-fetch the historical price
    - **Fees**: Any transaction fees (optional)
    - **Notes**: Additional context (optional)
6. Click **Add Transaction**

!!! tip "Auto-Price Feature"
    When adding BUY or SELL transactions, you can leave the price field empty. Portfolium will automatically fetch the historical closing price for the transaction date, making it easy to record past transactions accurately.

### Manual Price Entry

If you prefer to enter prices manually or the auto-fetch doesn't work for your asset:

1. Follow steps 1-4 above
2. Enter the **Price** manually in your portfolio's base currency
3. Complete the remaining fields
4. Click **Add Transaction**

## Recording Special Transaction Types

### Stock Splits

Stock splits adjust the number of shares you own without changing the total value. For example, in a 2:1 split, you receive 2 new shares for each 1 share you owned.

1. Click **Add Transaction**
2. Select the asset that had the split
3. Set **Type** to **SPLIT**
4. Enter the **Date** of the split
5. Enter the **Split Ratio** in the format "N:M":
    - **2:1** for a 2-for-1 split (doubles shares)
    - **3:1** for a 3-for-1 split (triples shares)
    - **1:2** for a 1:2 reverse split (halves shares)
6. Add **Notes** if desired
7. Click **Add Transaction**

!!! warning "Stock Split Requirements"
    You must have at least one BUY transaction for an asset before you can record a split. This ensures the split is applied to an existing position.

### Dividends

Record dividend payments to track your income:

1. Click **Add Transaction**
2. Select the asset that paid the dividend
3. Set **Type** to **DIVIDEND**
4. Enter the payment **Date**
5. Enter the dividend amount in the **Price** field
6. Set **Quantity** to 1
7. Click **Add Transaction**

### Portfolio Transfers

When moving shares between portfolios:

1. In the **source portfolio**, record a **TRANSFER_OUT** transaction
2. In the **destination portfolio**, record a **TRANSFER_IN** transaction
3. Use matching dates, quantities, and prices for both transactions

## Managing Transactions

### Viewing Transactions

The Transactions page displays all your recorded transactions with:

- **Date**: When the transaction occurred
- **Asset**: Ticker symbol and name
- **Type**: Transaction type with color-coding
- **Quantity**: Number of shares or units
- **Price**: Price per share
- **Fees**: Transaction costs
- **Total**: Total transaction value
- **Notes**: Additional context

### Filtering by Type

Use the tabs at the top to filter transactions:

- **All**: Show all transactions
- **Buy**: Show only purchases
- **Sell**: Show only sales
- **Dividend**: Show only dividend payments
- **Fees**: Show only fee transactions
- **Split**: Show only stock splits

### Sorting Transactions

Click any column header to sort by that field:

- Date (newest or oldest first)
- Asset (alphabetically)
- Type
- Quantity
- Price
- Fees
- Total value

### Edit Transaction

1. Find the transaction in the list
2. Click the **Edit** button (pencil icon)
3. Update the details
4. Click **Save Changes**

!!! note "Price Editing"
    When editing transactions, the price field is required. Auto-fetch is only available when adding new transactions.

### Delete Transaction

!!! warning "Permanent Action"
    Deleting a transaction removes it from your portfolio history and affects all performance calculations. This cannot be undone!

1. Find the transaction in the list
2. Click the **Delete** button (trash icon)
3. Confirm the deletion

## Bulk Import/Export

### Import from CSV

Import multiple transactions at once:

1. Click the **Import** button
2. Select a CSV file with the following format:

```csv
date,symbol,type,quantity,price,fees,currency,notes
2024-01-15,AAPL,BUY,10,150.25,9.99,USD,Initial purchase
2024-02-20,AAPL,SELL,5,165.50,9.99,USD,Taking profits
```

For stock splits:
```csv
date,symbol,type,split_ratio,notes
2024-06-01,AAPL,SPLIT,2:1,2-for-1 stock split
```

3. Review the import results
4. Fix any errors if needed and try again

### Export to CSV

Export your transaction history:

1. Click the **Export** button
2. Choose a save location
3. The CSV file will include all transactions in the current portfolio

!!! tip "Backup Your Data"
    Regular CSV exports are a great way to backup your transaction history and make it portable across different platforms.

## Transaction History

View the complete buy/sell history for any asset:

1. Find a transaction for the asset
2. Click the **Split History** icon (if available)
3. View all transactions with split-adjusted quantities

This shows:
- Original transaction quantities
- Split-adjusted quantities (after all stock splits)
- Total buy and sell transactions
- Net position changes

## Troubleshooting

### Cannot Sell More Than I Own

By default, Portfolium prevents you from selling more shares than you currently own. If you encounter this error:

- Verify you have the correct quantity
- Check if you recorded all your purchase transactions
- Ensure stock splits are recorded correctly
- If this validation is too strict, an administrator can disable it in settings

### Auto-Price Not Working

If the automatic price fetch fails:

- Verify the ticker symbol is correct
- Check that the date is a trading day (not weekend/holiday)
- Some assets may not have historical data available
- Enter the price manually as an alternative

### Missing Transactions

If transactions don't appear:

- Check that the correct portfolio is selected
- Verify filter tabs aren't hiding transactions
- Try the "All" tab to see all transaction types
- Check the date range if filters are applied

### Split Not Recording

If you can't record a stock split:

- Ensure you have at least one BUY transaction for that asset first
- Verify the split ratio format (e.g., "2:1")
- Check that you selected the correct asset

## Next Steps

- [View Portfolio Performance](portfolios.md)
- [Explore Insights](insights.md)
- [Set Up Notifications](notifications.md)