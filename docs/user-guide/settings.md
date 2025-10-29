# Settings

Customize Portfolium to match your preferences and workflow.

## Overview

The Settings page allows you to configure application behavior, notification preferences, validation rules, and manage your data. Settings are organized into four tabs for easy navigation.

## Accessing Settings

1. Click the **Settings** icon in the navigation menu
2. Or navigate to Settings from your user profile dropdown
3. Select the tab for the settings you want to adjust

## General Settings

Configure application-wide preferences and features.

### Auto-Refresh Settings

Control automatic price updates for your portfolio dashboard:

**Enable/Disable Auto-Refresh**

- Toggle automatic price refresh on or off
- When enabled, prices update automatically at your chosen interval
- When disabled, prices only update manually or on page load

**Refresh Interval**

Choose how often prices update automatically:

- **15 seconds**: Very frequent (testing only)
- **30 seconds**: Frequent updates
- **1 minute**: Default, good balance
- **2 minutes**: Moderate updates
- **5 minutes**: Less frequent
- **10 minutes**: Minimal API usage

!!! tip "Refresh Interval Recommendations"
    - **Active trading**: 30 seconds - 1 minute
    - **Regular monitoring**: 1-2 minutes
    - **Casual tracking**: 5-10 minutes
    - Shorter intervals use more API quota

**How It Works**

- Auto-refresh can also be toggled from the Dashboard (lightning bolt button)
- Prices refresh automatically when you return to the browser tab
- Settings are saved to your browser (local storage)
- Each user can have their own refresh preferences

**Settings Location**

Changes are saved instantly to your browser's local storage and persist across sessions.

## Notification Settings

Configure what notifications you receive and when. See [Notifications](notifications.md) for detailed information about notification types.

### Daily Change Notifications

Get alerted when your holdings have significant price movements:

**Enable Daily Change Notifications**

- Toggle daily change notifications on or off
- Receive alerts for both upward 📈 and downward 📉 movements
- Notifications created during daily price check (9:00 AM)

**Notification Threshold**

Set the percentage that triggers alerts:

- **Range**: 0% to 100%
- **Default**: 5%
- **Increment**: 0.5%
- Applies to both positive and negative changes

**How It Works**

- System checks holdings daily at 9:00 AM
- Compares current price to previous day's close
- Creates notifications for changes exceeding threshold
- Separate notifications for each affected asset
- Shows percentage change and dollar impact on your position

### Transaction Notifications

Get notified about transaction activity:

**Enable Transaction Notifications**

- Toggle transaction notifications on or off
- Receive alerts when you create, update, or delete transactions
- Helps track all portfolio activity

**What You'll Receive**

- New transaction notifications (BUY, SELL, DIVIDEND, etc.)
- Transaction update notifications
- Transaction deletion notifications
- Each includes asset symbol, quantity, price, and date

### Saving Notification Settings

After adjusting notification preferences:

1. Click **Save Notification Settings** button
2. Settings are saved to your user account
3. Success message confirms update
4. Changes take effect immediately for future notifications

!!! note "Account-Wide Settings"
    Notification settings are saved to your user account and apply across all devices where you're logged in.

## Validation Settings

Control transaction validation rules and data integrity checks.

### Sell Quantity Validation

Prevent selling more shares than you own:

**Enable Validation**

- When enabled: Cannot sell more shares than current position
- When disabled: Can sell any quantity (useful for imports)
- Default: Enabled

**When to Disable**

- Importing historical transactions out of chronological order
- Recording short selling positions
- Fixing data entry errors temporarily
- Advanced scenarios requiring flexibility

**When to Enable**

- Normal transaction entry
- Preventing accidental overselling
- Ensuring data integrity
- Maintaining accurate position tracking

!!! warning "Runtime Changes Only"
    Changes to validation settings take effect immediately but are **not persisted** across server restarts. To make permanent changes, update the `VALIDATE_SELL_QUANTITY` environment variable in your `.env` file.

**Error Messages**

When validation is enabled and you try to sell too many shares:

```
Cannot sell X shares of SYMBOL.
Current position: Y shares.
(This check can be disabled in settings: VALIDATE_SELL_QUANTITY=false)
```

This error protects you from accidentally creating invalid positions.

## Danger Zone

Critical operations that permanently affect your data.

!!! danger "Irreversible Actions"
    Operations in the Danger Zone **cannot be undone**. Deleted data is permanently removed and cannot be recovered.

### Delete All Data

Permanently remove all portfolio data from your account:

**What Gets Deleted**

- All transactions (BUY, SELL, DIVIDEND, etc.)
- All price history data
- All portfolios
- All assets
- User account remains active

**How to Delete**

1. Navigate to Settings → Danger Zone
2. Type `delete` in the confirmation field (case-insensitive)
3. Click **Delete all data** button
4. Data is immediately removed

**After Deletion**

- Your user account remains active
- You can log in and create new portfolios
- All historical data is gone
- Notification history is preserved
- Settings return to defaults

**Confirmation Required**

- Must type exactly "delete" to enable the button
- Prevents accidental deletion
- Irreversible once confirmed

!!! tip "Before Deleting"
    Consider exporting your data first:
    
    1. Go to Transactions page
    2. Click **Export** to download CSV
    3. Save the CSV file as a backup
    4. You can re-import later if needed

**Use Cases**

- Starting fresh with a clean slate
- Testing or demo purposes
- Removing old/incorrect data completely
- Switching investment strategies entirely

## Settings Management

### How Settings Are Saved

Different settings use different storage methods:

**Browser Local Storage** (General Settings)

- Auto-refresh enabled/disabled
- Refresh interval
- Saved per device/browser
- Not synced across devices

**User Account** (Notification Settings)

- Daily change notifications enabled/disabled
- Notification threshold percentage
- Transaction notifications enabled/disabled
- Synced across all devices

**Application Runtime** (Validation Settings)

- Sell quantity validation
- Changes lost on server restart
- Requires environment variable for persistence

### Checking Current Settings

**General Settings**

- Look at the General tab
- Auto-refresh status shows current state
- Dropdown displays selected interval

**Notification Settings**

- Check Notifications tab
- Checkboxes show enabled/disabled state
- Threshold input shows current percentage

**Validation Settings**

- Navigate to Validation tab
- Checkbox shows current validation state
- Status messages confirm changes

## Best Practices

### Auto-Refresh

**For Active Trading**

- Enable auto-refresh
- Use 30-second to 1-minute interval
- Monitor API usage
- Disable when not actively trading

**For Long-Term Investing**

- Use 5-10 minute interval or disable
- Manual refresh when needed
- Conserve API quota
- Check prices periodically

### Notifications

**Avoid Notification Fatigue**

- Set appropriate threshold (5% default is balanced)
- Disable notifications you don't need
- Review settings periodically
- Adjust based on market volatility

**Stay Informed**

- Enable daily change notifications for significant movements
- Enable transaction notifications to track activity
- Set threshold matching your risk tolerance
- Use notifications as portfolio health check

### Validation

**Data Integrity**

- Keep validation enabled for normal use
- Temporarily disable for imports
- Re-enable after completing bulk operations
- Verify positions after disabling validation

### Data Management

**Regular Backups**

- Export transactions regularly
- Keep CSV backups of important data
- Store exports in a safe location
- Test imports to verify backups work

**Before Major Changes**

- Export data before deleting
- Test on a small dataset first
- Understand deletion is permanent
- Consider starting a new portfolio instead

## Troubleshooting

### Auto-Refresh Not Working

**Check Settings**

- Verify auto-refresh is enabled in Settings
- Check selected interval
- Look for the lightning bolt icon on Dashboard
- Try toggling off and on

**Browser Issues**

- Clear browser cache
- Disable browser extensions temporarily
- Try in incognito/private mode
- Check browser console for errors

**Tab Visibility**

- Auto-refresh pauses when tab is hidden
- Returns to foreground refreshes prices
- Works only in active tab
- Use shorter interval for background updates

### Notification Settings Not Saving

**Validation Errors**

- Ensure threshold is between 0 and 100
- Check that all fields are filled correctly
- Look for error messages
- Try logging out and back in

**Network Issues**

- Check internet connection
- Wait for save operation to complete
- Look for success message
- Refresh page to verify changes

### Validation Preventing Transaction

**Too Strict**

- Check current position quantity
- Verify all transactions are entered
- Ensure stock splits are recorded
- Temporarily disable to complete import

**Override Needed**

- Go to Settings → Validation
- Disable sell quantity validation
- Complete your operation
- Re-enable validation afterward

### Delete Operation Failed

**Incomplete Deletion**

- Check error message for details
- May have been partially successful
- Contact support if data inconsistency
- Try again if it failed completely

**Permission Issues**

- Ensure you're logged in
- Verify account is in good standing
- Check for server errors
- Try refreshing and retrying

## Next Steps

- [Configure Notifications](notifications.md) in detail
- [Review Portfolio](portfolios.md) after changing settings
- [Check Transactions](transactions.md) if validation was adjusted
- [View Insights](insights.md) after data changes