# Notifications

Stay on top of your portfolio with alerts for price milestones, trading activity, and account security — in the app and, if you choose, directly on your device.

## Overview

Portfolium keeps you informed with two layers of notifications:

- **In-app notifications** — a running feed available from the bell icon in the top navigation and from the full Notifications page.
- **Browser push notifications** — optional alerts delivered by your browser or operating system, even when Portfolium isn't open in a tab.

Notifications are generated automatically as things happen in your account. You decide which categories you want to receive from your notification preferences, and old notifications are cleaned up automatically so your history doesn't grow forever.

## Notification Types

Portfolium can generate the following kinds of notifications:

### Price Milestones

- **All-Time High** 🚀 — one of your holdings just closed above its previous highest recorded price. The notification tells you the new high and how much higher it is than the last record.
- **All-Time Low** 📉 — one of your holdings just dropped below its previous lowest recorded price, with the same kind of detail.
- **Price Alert** — a watchlist asset you're tracking reached the target price you set for it.
- **Daily Gain** 📈 / **Daily Loss** 📉 — one of your holdings moved by more than your chosen threshold in a single day, showing the percentage move and the dollar impact on your position.

### Transactions

- **Transaction Created** — a new buy, sell, dividend, conversion, or fee entry was added to a portfolio.
- **Transaction Updated** — an existing transaction was edited.
- **Transaction Deleted** — a transaction was removed.

### Dividends

- **Pending Dividend** 💰 — Portfolium detected one or more dividend payments for assets you hold and is waiting for you to review and confirm them before they're added to your portfolio.

### Account & Reports

- **Login** — a new login to your account was detected, including the IP address it came from. This notification is always created and cannot be turned off.
- **Daily Report** 📊 — confirms that your daily portfolio report was generated and emailed successfully.
- **System** — general announcements or important system messages.

!!! note "New since the last release"
    All-time high/low alerts and pending dividend detection are newer additions — if you haven't looked at your notification settings in a while, it's worth reviewing them so you don't miss these.

## Viewing Notifications

### Notification Bell

The bell icon in the top navigation shows a badge with your unread count (displayed as **99+** once it climbs past that). Hovering over the bell previews your most recent notifications; clicking it takes you to the full Notifications page. The unread count refreshes automatically in the background so the badge stays current while you work.

### Notification Dropdown

Hovering the bell opens a quick-preview dropdown showing your **5 most recent** notifications, with:

- A "Mark all as read" shortcut when you have unread items.
- The ability to mark an individual notification as read by clicking it.
- A delete (trash) button on each entry.
- A "View all notifications" link to the full page.

### Notifications Page

The full Notifications page gives you:

- Your complete notification history.
- Filter tabs for **All** and **Unread**, each showing a live count.
- Details specific to the notification type — for example, transaction notifications show the asset, quantity, price, and date; price-alert and daily-change notifications show the current price, percentage move, and dollar impact; login notifications show the IP address.

## Managing Notifications

### Marking as Read

- **One at a time**: click **Mark as read** on any unread notification.
- **All at once**: click **Mark all as read** to clear every unread item instantly.

### Deleting Notifications

Click the delete (trash) icon on a notification to remove it.

!!! warning "Permanent Deletion"
    Deleted notifications cannot be recovered.

### Filtering Notifications

Use the **All** and **Unread** tabs to narrow the list. Each tab shows a live count so you can see at a glance how many notifications are in each state.

## Browser Push Notifications

In addition to the in-app feed, Portfolium can send you push notifications through your browser or operating system — useful for catching price milestones and alerts even when you don't have a Portfolium tab open.

### Enabling Push Notifications

1. Open your notification preferences and turn on push notifications.
2. Your browser will show a permission prompt asking whether Portfolium can send you notifications.
3. Approve the prompt to finish enabling push notifications on that device.

Each browser and device you approve is registered separately, so you can, for example, enable push notifications on your laptop and your phone independently, and turn either one off without affecting the other.

!!! note "Secure connection and browser permission required"
    Browser push notifications only work over a secure (HTTPS) connection, and only after you explicitly approve your browser's permission prompt. If you dismiss or deny the prompt, push notifications won't be delivered until you re-enable the permission in your browser settings and try again.

### Sending a Test Notification

After enabling push notifications, you can send yourself a test alert to confirm everything is working correctly on that device.

### Disabling Push Notifications

Turning off push notifications removes the registration for that device. If you use Portfolium on multiple devices, disable it separately on each one, or turn off the master push toggle in your preferences to stop all push delivery.

## Notification Preferences

Configure what you receive from **Settings → Notifications**. See [Settings](settings.md) for the full settings page.

### Daily Change Notifications

- Toggle **Daily Gain / Daily Loss** alerts on or off.
- Set the percentage move that triggers an alert — default $5\%$, adjustable from $0\%$ to $100\%$ in $0.5\%$ increments.
- Applies to both gains and losses, and only to positions you currently hold.

!!! tip "Threshold Recommendations"
    - **2–3%**: Very sensitive, frequent notifications (active trading)
    - **5%**: Balanced, significant movements only (default)
    - **10%+**: Only major price swings (long-term holding)

### All-Time High / Low Alerts

Toggle notifications for when your holdings hit a new all-time high or all-time low. These are checked whenever fresh price data comes in, so you'll typically hear about a new record within the same update cycle it happens in.

### Transaction Notifications

Toggle alerts for transactions you create, update, or delete. Each notification includes the transaction type, asset, quantity, price, and date.

### Push Notifications

Master toggle for whether Portfolium is allowed to send push notifications to your registered devices at all, independent of which specific alert categories are enabled above.

### Daily Portfolio Reports

Toggle whether you receive a comprehensive PDF report by email on trading days, with an in-app confirmation once it's been sent. See [Settings](settings.md) for report contents and delivery timing.

### Saving Preferences

1. Adjust your preferences.
2. Click **Save Notification Settings**.
3. A success message confirms the update, and preferences apply account-wide across every device you're logged into.

!!! note "Login notifications can't be disabled"
    Every other category can be turned on or off, but login notifications are always generated as a basic account-security measure.

## How Notifications Are Triggered

- **Transactions**: created immediately whenever you add, edit, or delete a transaction (if enabled).
- **Daily Gain/Loss**: generated during price update cycles; Portfolium won't send more than one per asset per trading day, so you won't be spammed if a price keeps moving.
- **Price Alerts**: generated when a watchlist asset you've flagged reaches your target price.
- **All-Time High/Low**: generated the moment a new price record is set for an asset you hold; because the record itself updates immediately, you'll only be notified again if the price goes on to break that new record.
- **Pending Dividends**: generated when Portfolium detects a dividend payment for an asset you hold, so you can review and confirm it.
- **Login**: generated every time you log in.
- **Daily Report**: generated after your report email is confirmed sent.

## Notification Retention

To keep your notification history manageable, Portfolium automatically deletes notifications older than $30$ days. This cleanup runs automatically every night — you don't need to do anything, and there's nothing to configure. If you want to keep a record of something, note it down or act on it before the retention window passes; deleted notifications (whether removed by you or by automatic cleanup) cannot be recovered.

## Troubleshooting

### Not Receiving In-App Notifications

- Go to **Settings → Notifications** and verify the relevant category is enabled.
- Check that your daily-change threshold isn't set too high for the price movement you expected to trigger it.
- Confirm you still hold the position — notifications for daily change and price milestones only apply to assets you currently own.
- Save your settings after making changes; unsaved changes don't take effect.

### Not Receiving Push Notifications

- Confirm push notifications are enabled in your notification preferences.
- Check your browser's own notification permission for the site — if you previously denied the prompt, you'll need to re-allow it in your browser settings.
- Push notifications require a secure (HTTPS) connection; they won't work on an insecure connection.
- Try sending a test notification to confirm the device is registered and working.
- If you use multiple browsers or devices, remember each one needs its own permission approval.

### Too Many Notifications

- Raise your daily-change threshold (for example, from $5\%$ to $10\%$).
- Turn off categories you don't need, such as transaction notifications if you trade frequently.
- Use the **Unread** filter to focus on what's new, and mark-all-as-read to clear the slate.

### Missing Notification Details

Some notification types show more detail than others — transaction, price-alert, daily-change, and login notifications include rich metadata, while system-style notifications may show only a title and message.

## Next Steps

- [Configure Settings](settings.md) to adjust notification and app preferences
- [View Transactions](transactions.md) referenced in transaction notifications
- [Check Portfolios](portfolios.md) performance after a price alert or milestone
- [Review Watchlist](watchlist.md) to set price alert targets
