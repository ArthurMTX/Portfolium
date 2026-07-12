# Assets

See every investment you hold, dig into the details of any single position, and keep the information behind it accurate.

## Overview

Every stock, ETF, cryptocurrency, or other instrument you record a transaction against becomes an asset in Portfolium. The Assets page gives you a portfolio-wide ledger of everything you hold, while each asset's own page gives you a deep, single-position view: price history, ETF composition, ownership record, and a place to keep your own research and notes.

Portfolium enriches each asset automatically with company details, sector, industry, and country information from its market data provider. When that data is missing or wrong, you can correct it yourself.

## Browsing Your Holdings

The Assets page lists every position across your active portfolio (or across all portfolios, depending on your selection):

1. Log in and click **Assets** in the main navigation
2. Review the summary strip at the top — total value, number of positions, sectors, and countries represented
3. Use the search box to filter by symbol or company name
4. Use the **Sort** dropdown to order the list by value, portfolio weight, today's impact, lifetime return, symbol, name, class, country, type, sector, industry, quantity, or number of portfolios holding it
5. Click the sort direction button to flip between ascending and descending

Each row shows the asset's logo, symbol, name, type, sector, and country, alongside four key figures:

- **Value** — current market value and the number of shares/units you hold
- **Portfolio weight** — this position's share of your total portfolio value
- **Today's impact** — how much this position moved your portfolio today, in currency and percent
- **Lifetime return** — total gain or loss since you first bought it, in currency and percent

!!! tip "Show Sold Positions"
    By default, positions you've fully exited are still listed with a "Sold" label and reduced emphasis. Use the **Show Sold / Hide Sold** toggle to include or exclude them. Sold positions are kept so your historical performance and transaction record stay intact — nothing is deleted when you sell out of a position.

### Opening a Position's Ledger

Click the **Open** button on any row to expand an inline ledger with three sections:

- **Cost and price** — average cost, current price, cost basis, and quantity owned
- **Ownership record** — number of transactions, number of stock splits, number of portfolios holding it, how long you've held it, and whether it's still open or sold
- **Classification** — asset class, type, sector, industry, and country, with the country's flag shown when recognized

From this expanded ledger you can jump straight into any of the position's detail views:

- **Transactions** — full buy/sell history for this asset (only shown if there are transactions to view)
- **Splits** — stock split history (only shown if the asset has had splits)
- **Price chart** — historical price chart with your transactions and splits marked on it
- **Asset research** — the full research page for this asset (see below)
- **Note** — your personal investment note for this asset
- **Metadata** — only appears when sector, industry, or country is missing, letting you fill it in yourself

Clicking anywhere else on a row takes you straight to that asset's research page.

## The Asset Research Page

Clicking into an asset opens its dedicated research page — the single place to understand everything about that position. At the top you'll find the asset's logo, name, current price, daily change, and quick actions to add it to your watchlist or record a new transaction.

The page is organized into tabs:

- **Overview** — key stats, your investment note, your trading performance on this asset, its theme classifications, business profile, ETF composition (if applicable), the full price chart, and its all-time high/low
- **Fundamentals** — market cap, volume, valuation ratios, growth, profitability, and balance-sheet health (for stocks; hidden for ETFs and crypto)
- **Performance** — how the asset has performed relative to a matching sector benchmark over the last month, three months, year-to-date, and one year
- **Risk** — volatility, beta, a composite risk score, and distance from its all-time high
- **Analyst / Valuation** — analyst recommendations and price targets, where available

!!! note "Data Availability Varies by Asset Type"
    Sections like Fundamentals, Business, and Ownership only make sense for individual stocks and are hidden for ETFs and cryptocurrencies. ETFs instead show their composition breakdown; some sections may also show "no data available" if your market data provider doesn't cover that particular asset.

### Price Chart

The price chart on an asset's page shows historical prices over a period you choose (from one month up to the full history available). On top of the price line, Portfolium marks:

- **Buy and sell transactions** — green markers for buys, red for sells, with quantity and price shown on hover
- **Transfers and conversions** — cyan and indigo markers for transfers and currency/asset conversions
- **Stock splits** — purple markers showing the split ratio and whether it was a forward or reverse split

Hovering over the chart updates the price and percentage-change figures shown above it, so you can check performance as of any point in time, not just today.

### ETF Composition

For ETFs, the research page replaces stock-specific fundamentals with a composition breakdown:

- **Top holdings** — the ETF's largest underlying positions, with a flag showing which ones you also own directly elsewhere in your portfolio, and how much overlap that represents
- **Theme exposure** — which investment themes (for example, artificial intelligence or clean energy) the fund's holdings fall into, along with how much of the fund that classification actually covers
- **Sector allocation** — the fund's weighting across business sectors
- **Asset allocation** — the split between stocks, bonds, cash, and other instruments inside the fund

!!! note "Partial Coverage Is Flagged"
    If only some of a fund's holdings could be classified into themes, Portfolium tells you so rather than presenting an incomplete picture as if it were the whole fund.

### Transaction History for This Asset

Opening **Transactions** from an asset's ledger shows every buy and sell you've made in that asset, across all portfolios that hold it. You get:

- Buy and sell totals with quantities
- Split-adjusted quantities alongside the original recorded quantities, when the asset has had a stock split
- Price, fees, and portfolio name for every transaction
- Any notes you added when recording the transaction
- A running summary of your net position change

You can sort the table by date, type, quantity, price, fees, or total.

### Split History

Opening **Splits** shows every stock split recorded for the asset: the ratio (for example $2:1$), whether it was a forward split (share count increases) or a reverse split (share count decreases), the date, and any notes. This is what Portfolium uses to keep your quantities and cost basis consistent across a split — the split-adjusted figures you see in your transaction history come directly from this record.

## Investment Notes

Investment notes let you keep your own reasoning about a position attached to that asset, separate from the automatically fetched market data. Use them to record why you bought something and what would change your mind.

To add or edit a note, click **Note** from an asset's ledger (or the note card near the top of its research page) and fill in any of:

- **Thesis** — why you invested in this asset
- **Conviction** — low, medium, or high
- **Target price and target description** — where you think the price is headed, in numbers or in words
- **Risks** — what could go wrong
- **Invalidation thesis** — the condition that would make you sell or reconsider
- **Horizon** — short, medium, or long term, optionally with a target date

All fields are optional — fill in as much or as little as helps you. Your note is shown as a summary card on the asset's research page and can be edited or deleted at any time.

!!! tip "Use Notes to Stay Disciplined"
    Writing down your invalidation thesis when you buy makes it much easier to recognize, later, whether the reason you bought still holds — instead of rationalizing a losing position after the fact.

## Correcting Asset Information

Portfolium fills in sector, industry, and country automatically from its market data provider. Occasionally that data is missing — commonly for newer listings, small or thinly-traded companies, or less common asset types.

When Portfolium has no sector, industry, or country on file for an asset, a **Metadata** button appears in its ledger. Opening it lets you set the missing fields yourself:

1. Open the asset's ledger and click **Metadata**
2. For each field that's missing, choose a value from the dropdown (industries are filtered to match the sector you pick)
3. Click **Save**

!!! note "You Can Only Fill In What's Missing"
    If Portfolium already has a value for a field from its market data provider, that field is shown as read-only and cannot be overridden — only genuinely missing fields are editable. This keeps your corrections limited to filling real gaps rather than second-guessing verified data.

Your correction is stored as an override and is used everywhere that field appears — the assets list, distribution charts, and the research page — until the underlying data source provides its own value.

## Best Practices

- Run metadata correction shortly after adding a new or unusual asset, so your sector and country breakdowns stay accurate
- Write an investment note when you first buy a position, while your reasoning is still fresh
- Keep **Show Sold** enabled if you want to review closed positions when analyzing past performance
- Check the split history after a corporate action to confirm your quantities and cost basis updated correctly

## Troubleshooting

### Sector, Industry, or Country Is Missing

Open the asset's ledger and use the **Metadata** button to fill in the missing field yourself. This option only appears when the field genuinely has no data.

### An Asset Shows the Wrong Currency, Name, or Classification

Fields sourced from the market data provider cannot be overridden manually because they're expected to be authoritative. If one looks wrong, it usually means the provider has incorrect or stale data for that ticker; double-check that you're tracking the correct symbol.

### ETF Composition Section Is Empty

Composition data (holdings, sector weightings, theme exposure) depends on your market data provider having coverage for that fund. Smaller or less common ETFs may not have this data available, in which case the section is hidden rather than shown empty.

### A Section on the Research Page Shows an Error

Each section of the research page (fundamentals, business profile, ownership, risk, performance) loads independently. If one section fails to load, the rest of the page still works — try reopening the asset, and if the problem persists, it usually means the market data provider is temporarily unavailable for that section.

## Next Steps

- [Add Transactions](transactions.md) to keep your holdings and history up to date
- [View Portfolios](portfolios.md) to see which assets are grouped into each portfolio
- [Explore Insights](insights.md) for portfolio-wide analysis built on top of your asset data
