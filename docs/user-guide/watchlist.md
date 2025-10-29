# Watchlist

Track assets you're interested in but don't own yet, set price alerts, and convert them to investments when ready.

## Overview

The Watchlist lets you monitor stocks, ETFs, cryptocurrencies, and other assets without actually owning them. It's perfect for researching potential investments, tracking market opportunities, and setting up price alerts. When you're ready to buy, convert watchlist items directly into portfolio transactions with one click.

## Accessing the Watchlist

1. Navigate to **Watchlist** in the main menu
2. View all assets you're tracking
3. Monitor current prices and daily changes
4. Manage alerts and notes for each asset

The Watchlist is independent of your portfolios—you can track assets even before deciding which portfolio to add them to.

## Adding Assets to Watchlist

Track new assets you want to monitor:

### Using Ticker Search

**Quick Add Method**

1. Find the **Add to Watchlist** form at the top
2. Start typing a ticker symbol or company name
3. Select from the autocomplete suggestions
4. Optionally add notes
5. Click **Add** to save

**Ticker Search Features**

- **Autocomplete**: Suggestions appear as you type
- **Company names**: Search by name, not just ticker
- **Asset details**: See full name and type before adding
- **Validation**: Prevents duplicate entries

**Example**

- Type "apple" → Select "AAPL - Apple Inc."
- Type "spy" → Select "SPY - SPDR S&P 500 ETF Trust"
- Type "btc" → Select "BTC-USD - Bitcoin USD"

### Adding Notes

**Optional Context**

- **Purpose**: Reminder about why you're tracking this asset
- **Examples**:
    - "Waiting for earnings report"
    - "Watch for dip below $150"
    - "Long-term hold candidate"
    - "Research for tech portfolio"
- **Notes are private**: Only you can see them
- **Editable anytime**: Update notes as your thinking evolves

!!! tip "Use Notes for Research"
    Notes help you remember your investment thesis when you revisit the watchlist later. Include key price levels, catalysts, or concerns.

## Viewing Watchlist Data

The watchlist table displays comprehensive information for each tracked asset:

### Asset Information

**Symbol & Logo**

- **Ticker symbol**: Standard identifier (e.g., AAPL, MSFT)
- **Company logo**: Visual identification
- **Full name**: Complete company/asset name
- **Asset type**: Stock, ETF, Crypto, etc.

### Price Data

**Current Price**

- Latest market price
- Updates with Refresh button
- Currency shown (USD, EUR, etc.)
- "N/A" if price unavailable

**Daily Change %**

- Percentage change from previous close
- 🟢 **Green with +**: Positive (up today)
- 🔴 **Red with -**: Negative (down today)
- Shows market performance at a glance

**How It's Calculated**

```
Daily Change % = ((Current Price - Previous Close) / Previous Close) × 100
```

### Sorting the Table

**Sortable Columns**

Click column headers to sort:

- **Symbol**: Alphabetical order
- **Name**: Company name alphabetical
- **Price**: Price value (low to high or high to low)
- **Daily Change %**: Performance (worst to best or best to worst)
- **Alert**: Alert target price

**Sort Indicators**

- ↕️ **Gray arrows**: Column is sortable
- ↑ **Up arrow**: Sorted ascending (A-Z, low to high)
- ↓ **Down arrow**: Sorted descending (Z-A, high to low)

**Default Sort**

- Initially sorted by symbol alphabetically
- Click again to reverse order
- Click different column to change sort

!!! tip "Find Top Performers Quickly"
    Click "Daily Change %" column twice to see your best-performing watchlist items at the top.

## Price Alerts

Set target prices and get notified when assets reach your desired levels.

### Setting Up Alerts

**Configure Price Targets**

1. Find the asset in your watchlist
2. Click the **Edit** button (pencil icon)
3. Enter **Target Price** in the alert field
4. Check **Enabled** to activate the alert
5. Click **Save** to confirm

**Alert Fields**

- **Alert Target Price**: The price you want to be notified at
- **Enabled checkbox**: Activate/deactivate the alert
- Both fields editable while editing

### How Alerts Work

**Trigger Conditions**

Alerts trigger when the current price crosses your target:

- **Upward crossing**: Price rises to meet or exceed target
- **Downward crossing**: Price falls to meet or go below target
- **Direction-agnostic**: Alerts work for both buy and sell opportunities

**Notification Creation**

When triggered:

- System creates a PRICE_ALERT notification
- You see it in the Notifications dropdown
- Alert remains enabled for future crossings
- Can disable alert to stop notifications

**Alert Status Display**

In the watchlist table:

- **Target price**: Shown in Alert column
- **Distance to target**: Percentage difference from current price
- **Green %**: Target is higher than current (upside potential)
- **Red %**: Target is lower than current (downside watch)

**Example**

```
Current Price: $150
Target Price: $175
Display: "$175 (+16.67%)"

Current Price: $150  
Target Price: $140
Display: "$140 (-6.67%)"
```

### Managing Alerts

**Edit Alerts**

- Click Edit button for the asset
- Change target price
- Toggle enabled on/off
- Save changes

**Disable Alerts**

- Uncheck **Enabled** while editing
- Alert target remains saved
- No notifications sent
- Can re-enable anytime

**Remove Alerts**

- Edit the asset
- Clear the target price field
- Uncheck Enabled
- Save to remove completely

!!! note "Alert Limitations"
    Alerts check prices during regular refresh cycles. Extremely rapid price movements might trigger alerts between checks. For real-time alerts, consider your broker's platform.

## Editing Watchlist Items

Update notes, alerts, and other details:

### Edit Mode

**Entering Edit Mode**

1. Click the **Edit** button (pencil icon) on any row
2. Fields become editable:
    - Notes text field
    - Alert target price input
    - Alert enabled checkbox
3. Make your changes
4. Click **Save** or **Cancel**

**What You Can Edit**

- **Notes**: Update your research notes
- **Alert Target Price**: Change price level
- **Alert Enabled**: Turn alerts on/off
- **Cannot change**: Symbol (delete and re-add instead)

### Batch Operations

While watchlist doesn't support multi-select editing, you can:

- Edit items individually
- Export → modify in spreadsheet → re-import
- Use import/export for bulk updates

## Converting to Portfolio Transactions

Turn watchlist items into actual investments:

### Convert to BUY Transaction

**Quick Conversion**

1. Click the **Shopping Cart** icon on a watchlist item
2. **Convert to BUY** modal opens
3. Fill in transaction details:
    - **Portfolio**: Select destination portfolio
    - **Quantity**: Number of shares/units
    - **Price**: Purchase price (pre-filled with current price)
    - **Date**: Optional transaction date (defaults to today)
4. Click **Create BUY Transaction**

**What Happens**

- BUY transaction created in selected portfolio
- Asset added to portfolio if not already present
- Watchlist item remains (not automatically deleted)
- Portfolio position updates immediately
- Your notes copied to transaction notes

**Pre-filled Values**

- **Current price**: Auto-filled from latest price
- **Currency**: Matches asset's currency
- **Last updated time**: Shows price freshness
- Can override with actual purchase price

**After Conversion**

- Transaction appears in selected portfolio
- Asset shows in Current Positions on Dashboard
- Can view on Transactions page
- Watchlist item still trackable (delete manually if desired)

!!! tip "Keep or Remove After Buying"
    Some investors keep assets in watchlist even after buying to continue monitoring buy/sell signals. Others remove them to avoid confusion. Choose what works for you.

### Multiple Portfolios

**Choosing the Right Portfolio**

- Dropdown shows all your portfolios
- Select based on investment strategy
- Can convert same asset to multiple portfolios
- Each portfolio tracks independently

**Example Scenario**

- Asset: AAPL
- Convert to "Long-term IRA" portfolio (retirement)
- Keep in watchlist for future buys
- Later convert to "Trading Portfolio" (different strategy)
- Both portfolios now hold AAPL independently

## Import & Export

Move watchlist data in and out of Portfolium:

### Exporting Watchlist

**Export Formats**

Two formats available:

**CSV Export**

1. Click **Export CSV** button
2. File downloads automatically
3. Filename: `watchlist_YYYY-MM-DD.csv`
4. Open in Excel, Google Sheets, etc.

**CSV Columns**

- symbol
- name
- notes
- alert_target_price
- alert_enabled
- created_at

**JSON Export**

1. Click **Export JSON** button
2. File downloads automatically
3. Filename: `watchlist_YYYY-MM-DD.json`
4. Machine-readable format
5. Useful for backups or programmatic access

**Use Cases**

- **Backup**: Save watchlist before making changes
- **Analysis**: Analyze in spreadsheet tools
- **Sharing**: Share research with others (remove private notes first)
- **Migration**: Move between accounts or platforms
- **Archiving**: Keep historical records

### Importing Watchlist

**Import Process**

1. Click **Import** button
2. **Import Modal** opens
3. Select format (CSV or JSON)
4. Choose file from computer
5. Upload starts automatically
6. See import results with counts and warnings

**CSV Import Format**

Required columns:

```csv
symbol,notes,alert_target_price,alert_enabled
AAPL,Watch for earnings,150.00,true
MSFT,Long term hold,300.00,false
TSLA,,200.00,false
```

**Field Requirements**

- **symbol**: Required, ticker symbol
- **notes**: Optional, your notes
- **alert_target_price**: Optional, numeric price
- **alert_enabled**: Optional, true/false

**JSON Import Format**

Array of objects:

```json
[
  {
    "symbol": "AAPL",
    "notes": "Watch for earnings",
    "alert_target_price": 150.00,
    "alert_enabled": true
  },
  {
    "symbol": "MSFT",
    "notes": "Long term hold",
    "alert_target_price": 300.00,
    "alert_enabled": false
  }
]
```

### Import Results

**Success Indicators**

- **Imported count**: Number of items successfully added
- **Warnings**: Non-critical issues (duplicates, invalid data)
- **Errors**: Critical failures (malformed data)

**Common Warnings**

- "Symbol already in watchlist, skipped" → Prevents duplicates
- "Invalid alert price, skipped alert" → Imports symbol but ignores bad price
- "Missing symbol, skipped" → Row ignored if no ticker

**Duplicate Handling**

- Existing watchlist items not overwritten
- Import skips duplicates
- Warning message indicates skipped symbols
- Prevents accidental data loss

!!! warning "Import Appends, Doesn't Replace"
    Importing adds to your existing watchlist—it doesn't replace it. To start fresh, export first, delete all items, then import the modified file.

## Refreshing Prices

Keep watchlist prices up-to-date:

### Manual Refresh

**Refresh All Prices**

1. Click the **Refresh** button
2. System fetches latest prices for all watchlist items
3. Price, daily change, and last updated timestamp update
4. Refresh completes in a few seconds

**What Gets Updated**

- Current price for each asset
- Daily change percentage
- Last updated timestamp
- Triggers price alert checks

**When to Refresh**

- Before making investment decisions
- After market opens or closes
- When checking alert status
- Periodically during market hours

### Automatic Updates

**Price Caching**

- Prices cached to reduce API calls
- Cache duration varies by market hours
- Stale prices refresh automatically over time
- Manual refresh bypasses cache

**API Rate Limits**

- Yahoo Finance has usage limits
- Too many refreshes may rate limit
- Error message shown if rate limited
- Wait a few minutes before retrying

!!! tip "Refresh Strategically"
    Watchlist doesn't have auto-refresh like Dashboard. Click Refresh when you're actively monitoring, but avoid excessive refreshing to conserve API quota.

## Deleting Watchlist Items

Remove assets you're no longer tracking:

### Delete Individual Items

**Deletion Process**

1. Click the **Delete** button (trash icon) on asset row
2. **Confirmation modal** appears
3. Review the asset you're deleting
4. Click **Delete** to confirm or **Cancel** to abort
5. Item removed immediately

**What Gets Deleted**

- Watchlist item (tracking record)
- Your notes for that asset
- Alert settings for that asset
- Price data remains (shared across app)

**Cannot Be Undone**

- Deletion is permanent
- No recycle bin or undo
- Re-add symbol to start tracking again
- Consider exporting before mass deletions

### Delete Confirmation

**Safety Feature**

- Modal prevents accidental clicks
- Shows asset name and symbol
- Requires explicit confirmation
- Can cancel at any time

**After Deletion**

- Row disappears from table
- Total count decreases
- Other watchlist items unaffected
- Asset still exists in system (for portfolios, etc.)

!!! warning "Delete vs Convert"
    Converting to BUY doesn't delete the watchlist item. You must manually delete if you no longer want to track it.

## Best Practices

### Research and Planning

**Build a Research Pipeline**

- Add interesting assets as you discover them
- Use notes to document investment thesis
- Set alerts at key technical levels
- Review watchlist regularly

**Organize with Notes**

- **Catalyst watching**: "Earnings on 2025-11-15"
- **Price targets**: "Buy if drops below $140"
- **Strategy fit**: "Dividend growth candidate"
- **Risk factors**: "High volatility, wait for confirmation"

**Prioritize Your Watchlist**

- Keep it manageable (20-50 items max)
- Delete assets you're no longer interested in
- Export old watchlists for archives
- Focus on high-conviction ideas

### Alert Strategy

**Set Meaningful Targets**

- **Support levels**: Buy at support
- **Resistance levels**: Sell signals
- **Valuation targets**: Fair value estimates
- **Stop losses**: Exit points for owned positions

**Multiple Alerts**

- Track same asset in watchlist for upside target
- Own in portfolio for downside protection
- Different strategies for different scenarios

**Review and Adjust**

- Update targets as market conditions change
- Disable irrelevant alerts
- Re-enable when conditions align again

### Conversion Workflow

**From Research to Investment**

1. **Discover**: Add to watchlist
2. **Research**: Monitor price, add notes, set alerts
3. **Wait**: Alert triggers or opportunity arises
4. **Convert**: Create BUY transaction in portfolio
5. **Track**: Monitor on Dashboard and in portfolio
6. **Decide**: Keep in watchlist or delete

**Pre-Purchase Checklist**

- Review your notes and thesis
- Check current price vs target
- Verify portfolio selection
- Confirm quantity and price
- Ensure sufficient funds

**Post-Purchase**

- Verify transaction in portfolio
- Check Dashboard position
- Update or remove from watchlist
- Set new alerts if continuing to monitor

## Troubleshooting

### Assets Not Loading

**Empty Watchlist**

- Confirm you've added assets
- Check for error messages
- Refresh the page
- Try adding a new asset

**Loading Errors**

- Check internet connection
- Verify you're logged in
- Clear browser cache
- Try different browser

### Prices Showing "N/A"

**Possible Causes**

- Asset symbol invalid or delisted
- Price data unavailable from Yahoo Finance
- Temporary API issue
- Recent IPO with limited data

**Solutions**

- Click Refresh to retry
- Verify ticker symbol is correct
- Wait and try again later
- Check if asset trades on supported exchanges

### Cannot Add Symbol

**"Already in Watchlist" Error**

- Symbol already tracked
- Check table for duplicate
- Delete existing entry if you want to re-add
- Intentional duplicate prevention

**Invalid Symbol**

- Ticker doesn't exist
- Wrong exchange or suffix needed
- Try with exchange suffix (e.g., "BTC-USD" not "BTC")
- Verify ticker on Yahoo Finance first

### Alerts Not Triggering

**Check Alert Settings**

- Ensure alert is **Enabled**
- Verify target price is set
- Confirm price has actually crossed target
- Check Notifications page for alert

**Alert Timing**

- Alerts check during price refreshes
- Not real-time, periodic checks
- Rapid price movements may miss exact target
- Manual refresh triggers alert check

### Import Failures

**File Format Issues**

- Ensure correct file extension (.csv or .json)
- Check for proper column headers in CSV
- Validate JSON syntax
- Save with UTF-8 encoding

**Data Validation Errors**

- Review error messages
- Fix invalid symbols
- Correct malformed prices
- Check true/false values for alert_enabled

**Partial Imports**

- Check warnings for skipped items
- Duplicates intentionally skipped
- Invalid rows ignored
- Successfully imported items added

### Conversion Problems

**Missing Portfolio Dropdown**

- Must have at least one portfolio
- Create portfolio first (see [Portfolios](portfolios.md))
- Refresh page after creating portfolio

**Price Pre-fill Incorrect**

- Shows cached price, may be stale
- Click Refresh on main watchlist first
- Override with actual purchase price
- Use current market price from broker

**Transaction Not Created**

- Check for error message
- Ensure all fields filled
- Verify portfolio permissions
- Try manual transaction creation as backup

## Use Cases

### Pre-Investment Research

**Building a Buy List**

- Add stocks from your research
- Monitor for entry points
- Set alerts at buy prices
- Convert when conditions met

**Sector Rotation**

- Track assets across sectors
- Monitor relative performance
- Identify rotation opportunities
- Switch portfolio allocations

### Opportunity Monitoring

**Earnings Season**

- Watchlist stocks before earnings
- Note earnings dates
- Set alerts for post-earnings reactions
- Convert on favorable results

**Market Corrections**

- Track quality stocks during bull markets
- Set alerts below current prices
- Buy dips during corrections
- Dollar-cost average into positions

### Portfolio Planning

**Future Additions**

- Assets for next paycheck
- Long-term accumulation targets
- Diversification candidates
- Replacement for sold positions

**Rebalancing Targets**

- Watch for correlation changes
- Monitor alternative investments
- Plan portfolio adjustments
- Research before executing

### Educational Tracking

**Learning to Invest**

- Paper trade ideas in watchlist
- Track performance without risk
- Practice research and analysis
- Test strategies before committing capital

**Market Education**

- Follow different asset classes
- Understand sector dynamics
- Learn technical analysis
- Build market intuition

## Next Steps

Integrate the Watchlist with other Portfolium features:

- [Create Portfolios](portfolios.md) to receive converted transactions
- [View Dashboard](dashboard.md) to monitor owned positions
- [Check Notifications](notifications.md) for price alerts
- [Manage Transactions](transactions.md) for manual additions
- [Configure Settings](settings.md) for notification preferences