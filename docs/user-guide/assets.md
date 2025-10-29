# Assets

Learn about your investment assets and how Portfolium tracks them.

## Overview

Assets are the individual investments in your portfolios - stocks, ETFs, cryptocurrencies, and other financial instruments. Portfolium automatically enriches asset data with information from Yahoo Finance, including company details, sector classification, and current market data.

## What is an Asset?

An asset represents a unique financial instrument that you can trade. Each asset has:

- **Symbol**: Ticker symbol (e.g., AAPL, BTC-USD)
- **Name**: Full company or asset name
- **Class**: Asset classification (Stock, ETF, Crypto, Cash)
- **Type**: Specific type (Equity, ETF, Cryptocurrency, etc.)
- **Currency**: Trading currency
- **Sector**: Industry sector (for stocks)
- **Industry**: Specific industry classification
- **Country**: Country of origin or primary listing

## Viewing Your Assets

The Assets page shows all assets across your portfolios:

### Asset Table

View detailed information about each asset:

- **Symbol & Logo**: Company ticker and brand logo
- **Name**: Full company or asset name
- **Class**: Asset classification badge
- **Type**: Detailed asset type
- **Country**: Country flag and name
- **Sector**: Business sector
- **Industry**: Industry classification
- **Quantity**: Total shares held across all portfolios
- **Portfolios**: Number of portfolios holding this asset

### Sorting Assets

Click any column header to sort by that field:

- Symbol (alphabetically)
- Name
- Class
- Type
- Country
- Sector
- Industry
- Quantity (total holdings)
- Portfolio count

!!! tip "Quick Navigation"
    Click column headers again to reverse the sort order. The arrow icon shows the current sort direction.

## Asset Types

Portfolium automatically classifies assets into types:

### Stocks
- **Equity**: Common stocks
- **Preferred Stock**: Preferred shares
- **ADR**: American Depositary Receipts
- **REIT**: Real Estate Investment Trusts

### Funds
- **ETF**: Exchange-Traded Funds
- **Mutual Fund**: Mutual funds
- **Index Fund**: Index-tracking funds

### Other
- **Cryptocurrency**: Digital currencies (e.g., BTC-USD, ETH-USD)
- **Derivative**: Options, futures, warrants

## Held vs Sold Assets

### Held Assets

Assets you currently own (quantity > 0):

- Displayed at the top of the list
- Full opacity
- Shows current quantity

### Sold Assets

Assets you previously owned but have fully sold (quantity = 0):

1. Click **Show Sold** button to view
2. Sold assets appear with reduced opacity and "Sold" badge
3. Click **Hide Sold** to filter them out

!!! note "Why Keep Sold Assets?"
    Sold assets remain in your database to preserve historical transaction data and performance metrics. You can still view their complete transaction history.

## Asset Metadata Enrichment

Portfolium automatically fetches asset metadata from Yahoo Finance:

### Automatic Enrichment

When you add a new asset (through transactions), Portfolium automatically enriches it with:

- Full company name
- Correct trading currency
- Sector and industry classification
- Asset type (Equity, ETF, etc.)
- Country of origin

### Manual Enrichment

To update metadata for existing assets:

1. Click the **Enrich Metadata** button
2. Portfolium fetches latest data for all assets
3. Missing information is filled in
4. Outdated names are updated

!!! tip "When to Enrich"
    Run enrichment after importing old data or if asset names appear incorrect. This ensures you have the most accurate and complete information.

## Asset Distribution Charts

At the bottom of the Assets page, view visual breakdowns:

### Asset Class Distribution

Pie chart showing your holdings by class:

- Stocks
- ETFs
- Cryptocurrencies
- Other classes

### Sector Allocation

See how your investments are distributed across sectors:

- Technology
- Healthcare
- Financial Services
- And more

### Geographic Distribution

View your holdings by country:

- United States
- Canada
- International markets
- Emerging markets

!!! note "Chart Data"
    Charts show only currently held assets (quantity > 0). Sold assets are excluded from distribution calculations.

## Transaction & Split History

### View Transaction History

For assets with buy/sell transactions:

1. Look for the **transaction count** badge with up arrow icon
2. Click the badge to view complete transaction history
3. See all buy and sell transactions across all portfolios
4. View split-adjusted quantities

The transaction history shows:

- Transaction dates
- Buy or sell type
- Original quantities
- Split-adjusted quantities (if applicable)
- Prices and fees
- Portfolio names
- Transaction notes

### View Split History

For assets with stock splits:

1. Look for the **split count** badge with shuffle icon
2. Click the badge to view all stock splits
3. See split ratios and dates
4. Understand how splits affected your position

## Asset Details

### Symbol Format

Assets use Yahoo Finance ticker symbols:

- **US Stocks**: `AAPL`, `MSFT`, `GOOGL`
- **Cryptocurrencies**: `BTC-USD`, `ETH-USD`, `ADA-USD`
- **Foreign Stocks**: May include exchange suffix
- **Indexes**: `^GSPC` (S&P 500), `^DJI` (Dow Jones)

### Currency

Each asset trades in a specific currency:

- **USD**: US Dollars (most common)
- **EUR**: Euros
- **GBP**: British Pounds
- **CAD**: Canadian Dollars
- And others

!!! note "Portfolio Currency vs Asset Currency"
    Your portfolio's base currency can differ from an asset's trading currency. Portfolium handles currency conversions automatically for valuation.

## Search & Filter

While there's no dedicated search on the Assets page, you can:

1. Use browser search (Ctrl+F / Cmd+F)
2. Sort by symbol or name
3. Toggle sold assets on/off
4. View specific portfolios for filtered asset lists

## Understanding Asset Data

### Why Some Fields Are Empty

Not all assets have complete data:

- **Sector/Industry**: Only applicable to stocks, not ETFs or crypto
- **Country**: May not be available for all asset types
- **Type**: Some assets may have generic types

### Data Accuracy

Asset data comes from Yahoo Finance:

- Generally accurate and up-to-date
- May occasionally have gaps or errors
- Enrichment updates data from the source
- You can manually verify critical information

## Best Practices

### Keep Assets Updated

- Run **Enrich Metadata** periodically
- Verify asset names after import
- Check symbols are correct for your intended assets

### Asset Tracking

- Review asset distribution regularly
- Check for over-concentration in sectors
- Monitor geographic diversification
- Track which portfolios hold which assets

### Sold Assets

- Keep **Show Sold** enabled to see full history
- Review sold assets periodically for performance analysis
- Don't delete sold assets - they preserve your history

## Troubleshooting

### Asset Name Shows Symbol Only

- Run **Enrich Metadata** to fetch the full name
- Yahoo Finance may not have data for this symbol
- Verify the ticker symbol is correct

### Missing Sector or Industry

- Only stocks have sector/industry data
- ETFs and cryptocurrencies don't have sectors
- Some stocks may not be classified yet
- Try enrichment to fetch latest data

### Logo Not Displaying

- Logos are cached for performance
- Some assets may not have logos available
- Generic fallback logos are used when needed
- Refresh the page if logo appears broken

### Incorrect Currency

- Run **Enrich Metadata** to update from Yahoo Finance
- Yahoo Finance is the authoritative source
- Currency is determined by the asset's primary listing

## Next Steps

- [Add Transactions](transactions.md) to track purchases and sales
- [View Portfolios](portfolios.md) to see which assets are in each portfolio
- [Explore Insights](insights.md) for deeper analysis of your holdings