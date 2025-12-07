# Dashboard

Monitor your portfolio performance in real-time with live metrics and position tracking.

## Overview

The Dashboard is your main workspace in Portfolium.
It provides a flexible, widget-based interface where you can arrange, resize, and customize your investment metrics exactly the way you want.

With real-time price updates, interactive widgets, and dynamic layouts, the Dashboard adapts to your style, whether you prefer a minimal view or a fully expanded market monitoring board.

## Accessing the Dashboard

1. Log in to Portfolium
2. Click **Dashboard** in the main navigation
3. Select your active portfolio from the dropdown
4. Your fully personalized dashboard loads instantly

Portfolium automatically saves your layout so it appears the same each time you open it.

## Customizable Widgets

The Dashboard is built entirely from widgets-small, independent blocks that you can freely organize.

### Widget Features

Each widget supports:

- Drag & Drop positioning
- Resizable layout (width × height)
- Real-time data updates
- Independent refresh logic
- Light & dark mode compatibility
- Persistent layout storage (saved in your profile)

Widgets automatically rearrange responsively on smaller screens.

### Managing Widgets

**Adding Widgets**

- Click Edit (grid icon)
- Open the Widgets panel
- Select any widget from the library
- It instantly appears on the grid
- Drag and resize as needed
- Click Save when done

**Removing Widgets**

- Enter Edit mode
- Click the trash icon on the widget
- Confirm removal
- Save the layout

**Rearranging Widgets**

Click Edit Layout

- Drag widgets to new positions
- Resize using the bottom-right handle
- Click Save

Widgets snap to your grid system, no overlaps.

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

## Price Updates and Refresh

### Understanding Price Sources

**Yahoo Finance Integration**

- Prices fetched from Yahoo Finance (yfinance)
- Supports stocks, ETFs, indexes, crypto
- Historical data available

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
- Metrics recalculated with new prices or quantities
- Position values updated
- P&L percentages adjusted
- Dashboard widgets reflect latest data

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

- [See Widgets](../widgets/index.md) for available options
- [View Charts](charts.md) for visual portfolio performance
- [Check Insights](insights.md) for detailed analytics and risk metrics
- [Manage Transactions](transactions.md) to keep data up-to-date
- [Configure Settings](settings.md) to customize auto-refresh and notifications
- [Review Assets](assets.md) for individual asset performance