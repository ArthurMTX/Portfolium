# Notifications

Stay informed about your portfolio activity and important market events.

## Overview

Notifications keep you updated on portfolio changes, price movements, and system events. Portfolium automatically generates notifications for key activities and allows you to customize what notifications you receive.

## Notification Types

Portfolium supports several types of notifications:

### Transaction Notifications

Automatic notifications for all portfolio activity:

- **Transaction Created**: New buy, sell, or dividend transaction added
- **Transaction Updated**: Existing transaction modified
- **Transaction Deleted**: Transaction removed from portfolio

### Daily Change Notifications

Get alerted when your holdings experience significant price movements:

- **Daily Change Up** 📈: Asset price increased significantly
- **Daily Change Down** 📉: Asset price decreased significantly

### Price Alerts

Receive notifications when watchlist assets reach target prices:

- **Price Alert**: Asset hits your specified target price

### System Notifications

Important system messages:

- **Login**: New login to your account detected
- **System**: Important system updates or announcements

## Viewing Notifications

### Notification Bell

The bell icon in the top navigation shows:

- **Badge**: Number of unread notifications
- **Red dot**: Indicates new unread notifications
- **Click**: Opens notification dropdown

### Notification Dropdown

Click the bell to see recent notifications:

- Shows last 5 notifications
- Quick access to mark as read
- Link to view all notifications

### Notifications Page

Access the full Notifications page for:

- Complete notification history
- Filtering by read/unread
- Detailed notification information
- Bulk actions (mark all as read)

## Managing Notifications

### Marking as Read

Individual notifications:

1. Find the notification in the list
2. Click **Mark as read** button
3. Notification moves to read state (no red dot)

All notifications:

1. Click **Mark all as read** button at the top
2. All current notifications marked as read instantly

### Deleting Notifications

Remove notifications you no longer need:

1. Find the notification
2. Click the **Delete** button (trash icon)
3. Notification is permanently removed

!!! warning "Permanent Deletion"
    Deleted notifications cannot be recovered. They are permanently removed from the system.

### Filtering Notifications

Use filter buttons to view:

- **All**: Show all notifications (read and unread)
- **Unread**: Show only unread notifications

Counts are displayed next to each filter option.

## Notification Settings

Configure your notification preferences in Settings → Notifications.

### Daily Change Notifications

Get alerted when your holdings have significant price movements:

**Enable/Disable**

- Toggle daily change notifications on or off
- When enabled, you'll receive alerts for price movements
- When disabled, no daily change alerts are sent

**Notification Threshold**

Set the percentage change that triggers alerts:

- Default: 5%
- Range: 0% to 100%
- Example: 5% threshold triggers alerts when price moves up or down 5% or more

!!! tip "Threshold Recommendations"
    - **2-3%**: Very sensitive, many notifications (active trading)
    - **5%**: Balanced, significant movements only (default)
    - **10%+**: Only major price swings (long-term holding)

**How It Works**

1. Portfolium checks daily price changes for all your holdings
2. If any asset moves above your threshold, a notification is created
3. Shows both percentage change and dollar impact on your position
4. Separate notifications for increases (📈) and decreases (📉)

### Transaction Notifications

Get notified about portfolio transaction activity:

**Enable/Disable**

- Toggle transaction notifications on or off
- When enabled, you receive alerts for all transaction changes
- When disabled, no transaction alerts are sent

**What You'll Receive**

- Notification when you add a new transaction
- Alert when you update an existing transaction
- Notice when a transaction is deleted

Each notification includes:
    - Transaction type (BUY, SELL, DIVIDEND, etc.)
    - Asset symbol and name
    - Quantity and price
    - Transaction date

### Saving Settings

After adjusting notification preferences:

1. Click **Save Notification Settings**
2. Settings are saved immediately
3. Success message confirms update
4. Changes take effect for future notifications

## Notification Details

Each notification displays:

### Header Information

- **Icon**: Color-coded icon for notification type
- **Title**: Brief description of the event
- **Badge**: Notification type label (color-coded)
- **Time**: How long ago the notification was created
- **Unread indicator**: Red dot for unread notifications

### Message Content

- **Description**: Detailed message about the event
- **Metadata**: Additional context (varies by type)

### Transaction Notification Details

- Asset symbol
- Transaction date
- Quantity and price (for trades)
- Transaction type

### Daily Change Notification Details

- Current price
- Percentage change
- Dollar impact on your position
- Number of shares you hold

### Login Notification Details

- IP address of login
- Time of login
- User agent (device/browser)

## Understanding Notification Behavior

### When Notifications Are Created

**Transaction Notifications**

- Created immediately when you add, edit, or delete transactions
- One notification per transaction action
- Requires transaction notifications to be enabled

**Daily Change Notifications**

- Created during daily price update cycles
- One notification per asset per day (if threshold exceeded)
- Only for currently held positions (quantity > 0)
- Requires daily change notifications to be enabled

**Price Alerts**

- Created when watchlist asset hits target price
- Triggered during price updates
- Only if you have price alert enabled for the asset

**Login Notifications**

- Created each time you log in
- Helps you monitor account access
- Always created (cannot be disabled)

### Notification Timing

- **Immediate**: Transaction and login notifications
- **Periodic**: Daily change and price alerts (during price updates)
- **Batched**: No batching; notifications created as events occur

### Duplicate Prevention

- Same asset won't generate multiple daily change notifications on the same day
- Transaction notifications are unique per transaction action
- Login notifications are created per login session

## Best Practices

### Notification Settings

**Balance Your Preferences**

- Enable notifications for events you care about
- Set appropriate daily change threshold
- Don't set threshold too low (notification fatigue)

**Regular Review**

- Check notifications daily or weekly
- Mark read notifications to stay organized
- Delete old notifications you no longer need

### Managing Notification Volume

**Too Many Notifications?**

- Increase daily change threshold (5% → 10%)
- Disable transaction notifications if you trade frequently
- Focus on significant events only

**Not Enough Notifications?**

- Lower daily change threshold (5% → 2%)
- Enable all notification types
- Add price alerts to watchlist items

### Using Notifications Effectively

**Daily Change Alerts**

- Review why assets moved significantly
- Check news or market conditions
- Consider rebalancing if needed
- Track patterns over time

**Transaction Notifications**

- Verify transactions were recorded correctly
- Track your trading activity
- Review for unexpected changes

**Login Notifications**

- Monitor for unauthorized access
- Verify logins from new devices/locations
- Contact support if suspicious activity

## Troubleshooting

### Not Receiving Notifications

**Check Settings**

- Go to Settings → Notifications
- Verify notifications are enabled
- Check threshold isn't too high
- Save settings after making changes

**For Daily Change Notifications**

- Ensure your holdings actually moved above threshold
- Price updates may have a delay
- Check that you have current positions (not sold)

**For Transaction Notifications**

- Verify setting is enabled in Settings
- Check that transactions are being created
- Refresh the notifications page

### Too Many Notifications

**Adjust Threshold**

- Increase daily change threshold percentage
- Disable less important notification types
- Focus on critical alerts only

**Clear Old Notifications**

- Mark all as read to clear the slate
- Delete notifications you've addressed
- Filter to unread to focus on new items

### Notifications Not Showing Count

- Refresh the page
- Check browser console for errors
- Ensure you're logged in
- Try logging out and back in

### Missing Notification Details

- Some older notifications may have limited metadata
- Metadata depends on notification type
- System notifications may have minimal details

## Notification Privacy

### What's Stored

Notifications contain:
    - Event type and description
    - Related asset/transaction information
    - Timestamp of event
    - Read/unread status

### Who Can See

- Only you can see your notifications
- Notifications are user-specific
- Not shared with other users
- Stored securely in the database

### Data Retention

- Notifications remain until you delete them
- No automatic expiration
- You control retention through deletion
- Can delete individually or in bulk

## Next Steps

- [Configure Settings](settings.md) to customize notification preferences
- [View Transactions](transactions.md) referenced in notifications
- [Check Portfolio](portfolios.md) performance after price alerts
- [Review Assets](assets.md) with significant price changes