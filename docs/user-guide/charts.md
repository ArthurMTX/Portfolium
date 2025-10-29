# Charts

Visualize your portfolio performance over time with interactive charts and allocation heatmaps.

## Overview

The Charts page provides visual representations of your portfolio's value history and asset allocation. Use charts to spot trends, understand composition, and track performance over different time periods. Visual data helps you make informed decisions and quickly identify patterns in your investments.

## Accessing Charts

1. Navigate to **Charts** in the main menu
2. Ensure you have an active portfolio selected
3. Verify you have transactions in your portfolio
4. View your portfolio visualizations

!!! note "Requires Transaction Data"
    Charts require at least one transaction in your portfolio. If you see an empty state, add transactions first by visiting the [Transactions](transactions.md) page.

## Portfolio Heatmap

The heatmap shows your current asset allocation as a visual treemap.

### What It Shows

**Visual Asset Allocation**

- Each rectangle represents one asset
- Size proportional to market value
- Larger boxes = bigger positions
- Smaller boxes = smaller positions
- All holdings visible at once

**Color Coding by Performance**

The heatmap uses color to show each asset's performance:

- 🟢 **Green shades**: Positive P&L (profits)
- 🔴 **Red shades**: Negative P&L (losses)
- **Color intensity**: Stronger = bigger percentage gain/loss
- **Neutral gray**: Break-even positions (~0% P&L)

**Position Details**

Each tile displays:

- **Symbol**: Asset ticker (e.g., AAPL, MSFT)
- **Percentage**: Portfolio allocation (e.g., 25.3%)
- **Market Value**: Current position value
- **P&L %**: Performance percentage

### Understanding the Layout

**Size and Position**

- Largest holdings appear first (top-left)
- Smaller holdings fill remaining space
- Grid-based layout for clean organization
- Responsive to screen size

**Tile Sizes**

- ≥20% holdings: Large tiles (50% width)
- 12-20% holdings: Medium tiles (33% width)
- 8-12% holdings: Medium-small tiles (25% width)
- 5-8% holdings: Small tiles (25% width)
- 2.5-5% holdings: Extra-small tiles (16% width)
- <2.5% holdings: Tiny tiles (16% width)

### Interpreting the Heatmap

**Diversification Check**

- One or two giant boxes? → Concentrated portfolio
- Many medium boxes? → Well-diversified
- Lots of tiny boxes? → Over-diversified or many small positions
- Balance depends on your strategy

**Performance Overview**

- Mostly green? → Portfolio performing well
- Mostly red? → Portfolio underperforming
- Mixed colors? → Some winners, some losers
- Bright green in large box? → Big winner driving returns
- Bright red in large box? → Big loser dragging down portfolio

**Allocation Analysis**

- Compare tile sizes to your target allocation
- Identify positions that have grown too large
- Spot positions that may need rebalancing
- Visualize sector/asset concentration

!!! tip "Rebalancing Indicator"
    If one position grows much larger than intended, the heatmap makes it obvious. Use this visual cue to decide when to rebalance.

### Use Cases

**Portfolio Construction**

- Verify allocation matches your strategy
- Check for over-concentration
- Identify diversification gaps
- Plan new purchases

**Risk Management**

- Spot concentration risk visually
- Monitor largest positions
- Track performance of key holdings
- Identify hedging opportunities

**Performance Monitoring**

- Quick glance at what's up/down
- Identify strongest/weakest performers
- Track impact of winners and losers
- Celebrate successes, analyze failures

## Portfolio History Chart

Track your portfolio value over time with an interactive line chart.

### What It Shows

**Value Over Time**

- Total portfolio value on Y-axis
- Date/time on X-axis
- Line shows historical performance
- Gradient fill emphasizes growth/decline
- Interactive hover for exact values

**Chart Features**

- **Smooth line**: Connects daily portfolio values
- **Gradient fill**: Visual area under the line
- **Responsive**: Adjusts to screen size
- **Interactive**: Hover for exact data points
- **Clean design**: Minimal distractions, focus on data

### Time Period Selection

Choose the time range to visualize:

**Available Intervals**

- **1D**: Past 24 hours (daily granularity)
- **1W**: Past week (daily points)
- **6M**: Past 6 months (daily aggregation)
- **YTD**: Year-to-date (from Jan 1 to today)
- **1Y**: Past 365 days (daily points)
- **ALL**: Entire portfolio history (since first transaction)

**Selecting an Interval**

1. Look for interval buttons above the chart
2. Click the desired time period (1D, 1W, 6M, YTD, 1Y, ALL)
3. Chart reloads with selected timeframe
4. Selection persists as you navigate

**What Changes**

- X-axis scale adjusts to timeframe
- Number of data points varies
- Y-axis rescales to value range
- Chart redraws with new data

### Reading the Chart

**Upward Trend**

- Line slopes upward → Portfolio growing
- Steep slope → Rapid growth
- Gradual slope → Steady growth
- Green gradient → Positive trajectory

**Downward Trend**

- Line slopes downward → Portfolio declining
- Steep drop → Rapid loss
- Gradual decline → Slow erosion
- Shows need for strategy review

**Flat/Sideways**

- Horizontal line → Stable value
- Small fluctuations → Normal volatility
- Extended flatness → Market consolidation or no activity
- May indicate good entry/exit points

**Volatility**

- Jagged line → High volatility
- Smooth line → Stable performance
- Sharp spikes → Major events or large trades
- Consider risk tolerance

### Hover Interactions

**Viewing Exact Values**

- Hover cursor over chart line
- Tooltip appears with:
    - Exact date
    - Portfolio value at that date
    - Formatted currency amount
- Move along timeline to explore history

**Tooltip Information**

- **Date**: Precise date/time of data point
- **Value**: Total portfolio value
- **Currency**: In portfolio's base currency
- **Format**: Clean, readable numbers

### Historical Data Points

**How Data is Calculated**

For each date, the chart shows:

```
Portfolio Value = Σ (Holdings Quantity × Price on that Date)
```

**Includes**

- All buy transactions up to that date
- All sell transactions up to that date
- Stock split adjustments
- Historical prices for each holding

**Excludes**

- Dividends (added separately to metrics)
- Fees (tracked separately)
- Unrealized P&L from sold positions (realized separately)

!!! note "Historical Price Availability"
    Chart accuracy depends on historical price data availability. Some assets may not have complete history, showing gaps in the chart.

## Backfill History Feature

Populate missing historical price data for better chart accuracy.

### What Is Backfilling?

**Purpose**

- Fetches historical daily prices for all portfolio assets
- Fills gaps in price history
- Enables accurate historical value calculations
- Improves chart completeness

**When to Use**

- After adding old transactions with past dates
- When importing historical data
- If chart shows gaps or missing data
- To complete portfolio history

### How to Backfill

**Running Backfill**

1. Navigate to the Charts page
2. Click **Backfill History** button
3. Wait for process to complete
4. See status message with results
5. Chart updates automatically

**What Happens**

- System identifies all assets in your portfolio
- Fetches daily prices for past 365 days (configurable)
- Saves price data to database
- Calculates historical portfolio values
- Updates chart with new data

**Backfill Results**

Status message shows:

- Number of assets processed
- Price points saved per asset
- Success/failure indication
- Any errors encountered

**Example Output**

```
Backfilled 5 assets. Saved: AAPL: 365, MSFT: 365, GOOGL: 365, TSLA: 250, BTC-USD: 365
```

This means:

- 5 assets in portfolio
- Most have 365 days of data
- TSLA only has 250 days (maybe newer position or data gap)

### Backfill Considerations

**Time to Complete**

- Depends on number of assets
- More assets = longer process
- Typically completes in 10-30 seconds
- Progress shown during processing

**API Rate Limits**

- Uses Yahoo Finance API
- Subject to rate limits
- Multiple assets fetched sequentially
- May fail if rate limited

**Data Quality**

- Historical data from Yahoo Finance
- Some assets may have incomplete history
- Delisted stocks may have gaps
- Crypto may have shorter history

**When It Fails**

If backfill fails:

- Check error message for details
- Wait a few minutes and retry
- Verify asset symbols are valid
- Some assets may not have full history
- Network issues may cause failure

!!! tip "Run Backfill Sparingly"
    Backfill is resource-intensive. Run it only when needed (after bulk imports or when historical data is missing), not regularly.

## Chart Use Cases

### Performance Tracking

**Daily Monitoring**

- Use **1D** interval during market hours
- Track intraday portfolio value changes
- Monitor impact of day's trades
- Watch market volatility effect

**Weekly Review**

- Use **1W** interval for weekly check-in
- Compare week's start vs end
- Identify weekly trends
- Plan next week's strategy

**Long-term Analysis**

- Use **1Y** or **ALL** for big picture
- Evaluate long-term growth trajectory
- Compare to investment goals
- Track progress over years

### Investment Decisions

**Entry Points**

- Identify dips in portfolio value
- Look for buying opportunities
- See if downtrends are reversing
- Time new investments

**Exit Points**

- Spot peaks in portfolio value
- Consider taking profits
- Identify unsustainable growth
- Plan strategic sells

**Trend Analysis**

- Recognize patterns (uptrend, downtrend, sideways)
- Assess momentum
- Evaluate strategy effectiveness
- Adjust allocation based on trends

### Risk Assessment

**Volatility Check**

- Jagged chart = high volatility = higher risk
- Smooth chart = low volatility = lower risk
- Match volatility to your risk tolerance
- Consider hedging if too volatile

**Drawdown Analysis**

- Find peak-to-trough declines
- Measure maximum drawdown
- Assess recovery time
- Determine if drawdowns are acceptable

**Correlation with Markets**

- Compare your chart to market indexes
- See if you're tracking the market or diverging
- Identify periods of outperformance/underperformance
- Evaluate diversification effectiveness

## Best Practices

### Regular Monitoring

**Daily Traders**

- Check **1D** chart multiple times per day
- Enable auto-refresh on Dashboard
- Monitor heatmap for position changes
- Use charts to time trades

**Long-term Investors**

- Review **1W** or **1M** chart weekly
- Check heatmap monthly for rebalancing
- Focus on long-term trends (1Y, ALL)
- Ignore short-term fluctuations

**Quarterly Reviews**

- Use **6M** or **YTD** for quarterly analysis
- Compare to investment goals
- Assess allocation via heatmap
- Adjust strategy as needed

### Combining with Other Tools

**Charts + Dashboard**

- Charts show trends
- Dashboard shows current snapshot
- Use together for complete picture
- Dashboard metrics explain chart movements

**Charts + Insights**

- Charts show what happened
- Insights explain why (see [Insights](insights.md))
- Combine visual and analytical views
- Deeper understanding of performance

**Charts + Transactions**

- Transaction timing visible in chart
- See impact of large buys/sells
- Correlate trades with performance
- Learn from past decisions

### Interpretation Tips

**Context Matters**

- Portfolio value chart affected by:
    - New deposits (adding cash)
    - Withdrawals (removing cash)
    - Market movements
    - Transaction timing
- Separate contribution effects from performance

**Percentage vs Absolute**

- Dollar value can be misleading if you're adding/removing money
- Consider percentage returns
- Compare to benchmarks (in Insights)
- Account for cash flows

**Time Horizon**

- Short-term: More noise, less signal
- Long-term: Clearer trends, better decisions
- Match chart timeframe to your strategy
- Don't overreact to short-term moves

## Troubleshooting

### Charts Not Loading

**Empty Portfolio**

- Charts require transactions to display
- Add at least one transaction
- See [Transactions](transactions.md)

**No Active Portfolio**

- Select a portfolio from the dropdown
- Create a portfolio if you have none
- See [Portfolios](portfolios.md)

**Network Issues**

- Check internet connection
- Refresh the page
- Check browser console for errors
- Try again in a few minutes

### Missing Historical Data

**Gaps in Chart**

- Run **Backfill History** to fill gaps
- Some assets may not have full history
- Delisted stocks may have missing data
- Newly added assets won't have old data

**Backfill Not Working**

- Wait a few minutes and retry
- Check API rate limits
- Verify asset symbols are correct
- Review error message for details

### Heatmap Empty or Incorrect

**No Current Positions**

- Heatmap only shows held positions
- Sold positions don't appear
- Add BUY transactions to see holdings
- Check Dashboard for current positions

**Wrong Allocation Percentages**

- Verify all transactions are entered
- Ensure prices are up-to-date
- Refresh price data on Dashboard
- Check for missing SELL transactions

**Colors Don't Make Sense**

- Colors based on unrealized P&L %
- Check position P&L on Dashboard
- Verify cost basis is correct
- Ensure stock splits are recorded

### Chart Shows Unexpected Drops

**Large Withdrawals**

- Selling positions reduces portfolio value
- Chart reflects actual value, not returns
- Consider SELL transactions timing
- Normal if you took profits or rebalanced

**Price Data Issues**

- Incorrect historical prices from data source
- Delisted stocks may have price gaps
- Check if specific asset has bad data
- May require manual correction

**Stock Splits**

- Ensure splits are recorded in Transactions
- Unrecorded splits cause incorrect valuations
- See [Transactions](transactions.md) for split entry
- Backfill after adding splits

### Interval Selection Not Working

**Chart Not Updating**

- Click interval button again
- Refresh browser page
- Check for loading indicator
- Clear browser cache

**Data Missing for Interval**

- Some intervals may have insufficient data
- New portfolios won't have YTD or 1Y data
- Add more transactions over time
- Run backfill for historical intervals

## Next Steps

Enhance your portfolio analysis by exploring:

- [Dashboard](dashboard.md) for real-time metrics and position details
- [Insights](insights.md) for advanced analytics and risk metrics
- [Transactions](transactions.md) to maintain accurate historical data
- [Assets](assets.md) to explore individual asset performance
- [Settings](settings.md) to configure your viewing preferences