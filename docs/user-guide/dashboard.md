# Dashboard

Monitor your portfolio performance in real-time with live metrics and position tracking.

## Overview

The Dashboard is your central command center for tracking portfolio performance. It provides real-time price updates, key performance metrics, and detailed position information all in one place. Use the Dashboard to get a quick overview of your investments and monitor daily changes.

## Accessing the Dashboard

1. Log in to Portfolium
2. Click **Dashboard** in the main navigation
3. Select your active portfolio from the dropdown
4. View your real-time portfolio data

The Dashboard is typically your landing page after login, giving you immediate access to your portfolio status.

## Key Metrics Cards

The Dashboard displays four essential metrics at the top of the page:

### Total Value

**What It Shows**

- Current market value of all holdings
- Sum of (quantity × current price) for all positions
- Excludes sold positions
- Updates with latest prices

**Calculation**

```
Total Value = Σ (Position Quantity × Current Price)
```

**When to Monitor**

- Daily portfolio check-ins
- Before making investment decisions
- Tracking portfolio growth over time
- Comparing to your investment goals

### Unrealized P&L (Profit & Loss)

**What It Shows**

- Profit or loss on your current holdings
- Difference between current value and cost basis
- Percentage return on investment
- Updates in real-time with prices

**Calculation**

```
Unrealized P&L = Total Value - Total Cost
Unrealized P&L % = (Unrealized P&L / Total Cost) × 100
```

**Color Coding**

- 🟢 **Green**: Positive (profit)
- 🔴 **Red**: Negative (loss)
- Includes both dollar amount and percentage

**Understanding Unrealized**

"Unrealized" means you still hold the positions. The gain/loss is "on paper" until you sell.

### Realized P&L

**What It Shows**

- Actual profit or loss from completed sales
- Based on historical sell transactions
- Does not include current holdings
- Permanent record of past performance

**Calculation**

```
Realized P&L = Σ (Sale Proceeds - Cost Basis) for all sells
```

**When It Updates**

- When you record SELL transactions
- After processing stock splits
- When dividends are factored in

**Use Cases**

- Tax planning and reporting
- Evaluating past trading decisions
- Tracking total returns over time
- Performance reporting

### Dividends & Fees

**What It Shows**

- **Dividends**: Total dividend income received
- **Fees**: Total transaction fees and commissions paid
- Based on DIVIDEND and FEE transaction types
- Cumulative over portfolio lifetime

**Tracking Income**

- Monitor dividend yield
- Calculate total income from investments
- Track fee impact on returns
- Evaluate cost efficiency

!!! tip "Net Returns"
    For true performance, consider: Unrealized P&L + Realized P&L + Dividends - Fees

## Market Status Indicator

Real-time market status badge shows current trading hours:

**Status Types**

- 🟢 **Market Open**: Regular trading hours (9:30 AM - 4:00 PM ET)
- 🔵 **Pre-Market**: Before regular hours (4:00 AM - 9:30 AM ET)
- 🟠 **After Hours**: After regular hours (4:00 PM - 8:00 PM ET)
- 🔴 **Market Closed**: Outside trading hours (weekends, holidays)
- ⚪ **Status Unknown**: Unable to determine market status

**Why It Matters**

- Know when to expect price updates
- Understand if current prices are live or delayed
- Plan trades during appropriate hours
- Context for price movements

Updates every 5 minutes automatically.

## Auto-Refresh Feature

Keep your portfolio prices up-to-date automatically:

### Enabling Auto-Refresh

**From Dashboard**

- Click the **Auto** button (lightning bolt icon)
- 🟢 **Green**: Auto-refresh is ON
- ⚪ **Gray**: Auto-refresh is OFF
- Toggle on/off with a single click

**From Settings**

- Navigate to Settings → General tab
- Toggle auto-refresh on/off
- Select refresh interval
- Changes apply immediately

### Refresh Intervals

Choose how often prices update:

- **15 seconds**: Very frequent (testing/high-frequency only)
- **30 seconds**: Frequent updates for active monitoring
- **1 minute**: Default, good balance (recommended)
- **2 minutes**: Moderate updates
- **5 minutes**: Less frequent, conserves API usage
- **10 minutes**: Minimal updates

**Selecting an Interval**

1. Go to Settings → General
2. Choose interval from dropdown
3. Setting saves automatically
4. Applies when auto-refresh is enabled

!!! tip "Choosing the Right Interval"
    - **Active trading**: 30 seconds - 1 minute
    - **Regular monitoring**: 1-2 minutes  
    - **Casual tracking**: 5-10 minutes
    - Shorter intervals use more API quota

### How Auto-Refresh Works

**Automatic Behavior**

- Prices update at selected interval when enabled
- Updates pause when browser tab is hidden
- Resumes when you return to the tab
- One immediate refresh when tab becomes visible
- Saves settings to browser local storage

**Manual Refresh**

- Click **Refresh** button anytime
- Overrides auto-refresh timer
- Useful for immediate updates
- Resets the auto-refresh countdown

**Last Update Timestamp**

- Shows when prices were last fetched
- Displays as "Xs ago" or "Xm ago"
- Helps verify data freshness
- Updates with each refresh

!!! note "Cross-Tab Synchronization"
    Auto-refresh settings sync across browser tabs. Changing settings in one tab updates all tabs automatically.

## Portfolio Selector

Switch between portfolios without leaving the Dashboard:

**Using the Selector**

1. Look for the "Active Portfolio" dropdown
2. Click to see all your portfolios
3. Select a different portfolio
4. Dashboard reloads with new portfolio data

**What Updates**

- All four metrics cards
- Current positions table
- Sold positions table
- Auto-refresh continues with new portfolio

Your portfolio selection persists across pages and sessions.

## Current Positions Table

View all assets you currently hold:

### Position Details

**Asset Information**

- **Symbol**: Ticker symbol (e.g., AAPL, MSFT)
- **Name**: Full company or asset name
- **Logo**: Company logo (when available)
- **Asset Type**: Stock, ETF, Crypto, etc.

**Quantity & Pricing**

- **Quantity**: Number of shares/units held
- **Avg Cost**: Your average purchase price per share
- **Current Price**: Latest market price
- **Market Value**: Current worth (Quantity × Price)

**Performance Metrics**

- **P&L**: Profit/loss in dollars
- **P&L %**: Percentage gain/loss
- **Daily Change**: Today's price movement
- **Allocation**: Percentage of total portfolio

**Color Coding**

- 🟢 **Green numbers**: Gains/increases
- 🔴 **Red numbers**: Losses/decreases
- Makes it easy to spot performance at a glance

### Interacting with Positions

**Click on an Asset**

- Opens asset detail page
- View full transaction history
- See historical performance
- Access asset-specific charts

**Sorting**

Tables may support sorting by:

- Symbol (alphabetical)
- Market value (size)
- P&L performance
- Daily change

### Empty Positions

**No Positions Shown**

If you see no current positions:

- Verify you've added BUY transactions
- Check that you haven't sold all shares
- Ensure transactions are in the correct portfolio
- Refresh the page to reload data

## Sold Positions Table

Track your historical trading performance:

### Viewing Sold Positions

**Accessing the Tab**

1. Look for tabs above the positions table
2. Click **Sold Positions (Realized P&L)**
3. View assets you've completely sold

**What Counts as Sold**

- Assets where you've sold all shares (quantity = 0)
- Only shows if you had BUY then SELL transactions
- Positions with SELL before BUY won't show correctly
- Requires complete position closure

### Sold Position Details

**Displayed Information**

- **Symbol & Name**: The sold asset
- **Average Cost**: Your average purchase price
- **Average Proceeds**: Average sale price per share
- **Realized P&L**: Actual profit/loss from the sale
- **Realized P&L %**: Percentage return on investment

**Understanding Realized P&L**

```
Realized P&L = Total Sale Proceeds - Total Cost Basis
Realized P&L % = (Realized P&L / Total Cost Basis) × 100
```

**No Current Price**

Sold positions don't show current prices because you no longer own them. The performance is locked in based on your sale.

### Lazy Loading

**Performance Optimization**

- Sold positions load only when you click the tab
- Reduces initial page load time
- Data is cached after first load
- Switches between tabs are instant after loading

**Loading Indicator**

If loading takes a moment, you'll see:

- Spinner animation
- "Loading sold positions..." message
- Progress indicator

### Empty Sold Positions

**No Sold Positions Yet**

If you see an empty state:

- You haven't fully sold any positions yet
- Partial sales don't appear here
- Only complete position closures show
- Start shows up after first complete sell

!!! note "Partial Sales vs Full Sales"
    Partially selling shares (selling some but not all) keeps the asset in Current Positions with reduced quantity. Only when you sell ALL shares does it move to Sold Positions.

## Price Updates and Refresh

### Understanding Price Sources

**Yahoo Finance Integration**

- Prices fetched from Yahoo Finance (yfinance)
- Supports stocks, ETFs, indexes, crypto
- Historical data available
- Free tier with rate limits

**Price Caching**

- Recent prices cached to reduce API calls
- Cache duration: varies by asset and market hours
- Automatic cache invalidation
- Manual refresh bypasses cache

### Refresh Strategies

**When Prices Update**

- Auto-refresh when enabled (at chosen interval)
- Manual refresh button click
- Returning to browser tab after being away
- Initial page load

**What Gets Refreshed**

- Current prices for all held assets
- Metrics recalculated with new prices
- Position values updated
- P&L percentages adjusted
- Dashboard cards reflect new totals

**Refresh Behavior**

- Refresh button shows spinning icon during update
- All positions update simultaneously
- Metrics update after all prices fetched
- Error alerts appear if refresh fails

### Handling Price Errors

**Common Issues**

- API rate limits exceeded
- Invalid or delisted symbols
- Network connectivity problems
- Market data unavailable

**Error Alerts**

When price updates fail, you'll see:

- Red error banner at top of page
- Specific error message
- Guidance on resolution
- Retry instructions

**Troubleshooting**

1. Wait a few minutes and retry
2. Check internet connection
3. Verify asset symbols are correct
4. Try manual refresh instead of auto-refresh
5. Reduce auto-refresh frequency if rate limited

!!! warning "API Rate Limits"
    Yahoo Finance has usage limits. Very frequent refreshes (especially <30s) may trigger rate limiting. Use longer intervals for normal monitoring.

## Best Practices

### Daily Monitoring

**Morning Routine**

- Check Dashboard first thing
- Review overnight changes
- Check market status
- Enable auto-refresh for the day
- Monitor key positions

**During Market Hours**

- Use 1-2 minute auto-refresh
- Watch for significant movements
- Check notifications for alerts
- Review P&L throughout the day

**End of Day**

- Disable auto-refresh to save quota
- Review final metrics
- Check daily change notifications
- Plan next day's trades

### Performance Tracking

**Weekly Reviews**

- Compare week-over-week metrics
- Review realized vs unrealized P&L
- Check dividend income
- Assess fee impact
- Identify top/bottom performers

**Monthly Analysis**

- Evaluate portfolio allocation
- Review sold positions performance
- Calculate total returns
- Compare to benchmarks (see [Insights](insights.md))
- Adjust strategy as needed

### Optimization Tips

**Reduce API Usage**

- Use longer auto-refresh intervals when not actively monitoring
- Disable auto-refresh when done for the day
- Manual refresh only when needed
- Close browser tabs not in use

**Improve Performance**

- Keep browser tabs to minimum
- Clear browser cache occasionally
- Use modern browser for best experience
- Close other resource-intensive applications

**Data Accuracy**

- Ensure all transactions are entered
- Record stock splits promptly
- Update transactions as they occur
- Verify positions match brokerage statements

## Troubleshooting

### Metrics Not Updating

**Check Auto-Refresh**

- Verify auto-refresh is enabled (green button)
- Check selected interval
- Look for last update timestamp
- Click manual Refresh to test

**Network Issues**

- Check internet connection
- Look for error messages
- Try refreshing browser page
- Check browser console for errors

### Incorrect Position Values

**Verify Transactions**

- Go to Transactions page
- Check all BUY/SELL transactions are entered
- Verify quantities are correct
- Ensure prices are accurate
- Record any stock splits

**Price Data Issues**

- Some assets may have delayed prices
- Delisted stocks may need manual prices
- Check if symbol is correct
- Try manual price refresh

### Auto-Refresh Not Working

**Check Settings**

- Go to Settings → General
- Verify auto-refresh is enabled
- Check interval setting
- Try toggling off and on

**Browser Tab Issues**

- Auto-refresh pauses in hidden tabs
- Bring tab to foreground
- Check if browser is blocking timers
- Try reloading the page

**Rate Limiting**

- Reduce refresh frequency
- Wait before retrying
- Use longer intervals
- Check error messages

### Portfolio Selector Empty

**No Portfolios**

- Create your first portfolio
- See [Portfolios](portfolios.md) for guidance
- Reload page after creating

**Portfolios Not Loading**

- Check network connection
- Refresh the page
- Clear browser cache
- Try logging out and back in

## Next Steps

With your Dashboard set up, explore more features:

- [View Charts](charts.md) for visual portfolio performance
- [Check Insights](insights.md) for detailed analytics and risk metrics
- [Manage Transactions](transactions.md) to keep data up-to-date
- [Configure Settings](settings.md) to customize auto-refresh and notifications
- [Review Assets](assets.md) for individual asset performance