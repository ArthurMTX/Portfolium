## Notifications

### What It Shows

The Notifications widget is a rolling feed of things Portfolium thinks you should know about — without digging through emails or a separate page. It shows your **5 most recent notifications**, each with:

- an icon indicating the type (price alert, transaction, login, dividend, etc.),
- a short title and message describing what happened,
- how long ago it happened (e.g. "30 minutes ago"),
- a highlighted background and small dot for anything you haven't read yet.

Clicking a notification marks it as read. A trash icon lets you dismiss individual entries directly from the widget.

It answers the question:
> "What happened recently that's worth my attention?"

---

### How It's Built

The widget doesn't compute anything itself — it displays the same notification feed that powers the full Notifications page, just trimmed down. Portfolium currently generates these notification types:

| Type | What triggers it |
|---|---|
| **Price Alert** | One of your assets crossed a target price you set, either above or below it |
| **Daily Change (Up/Down)** | A holding moved noticeably during the day |
| **Transaction Created/Updated/Deleted** | A buy, sell, dividend, fee, or other transaction was recorded, changed, or removed |
| **Pending Dividend** | A dividend payment is waiting for your confirmation before it's added to your history |
| **Daily Report** | A summary of the day's portfolio activity |
| **Login** | A new sign-in was detected on your account |
| **System** | Other account or app-level notices |

Behavior in the widget:

- Only the latest $5$ notifications are shown, most recent first.
- Unread notifications get a subtle highlighted background and a small colored dot; clicking one marks it read.
- Deleting a notification from the widget removes it everywhere, including the full Notifications page.
- If the widget is hidden (e.g. scrolled off-screen or on a collapsed layout), it skips loading data until it becomes visible again, to avoid unnecessary requests.

---

### Example

| Icon | Title | Message | When |
|---|---|---|---|
| 🔔 | AAPL Price Alert | Apple reached your target price of $175 | 30 minutes ago |
| 📈 | Portfolio Up 3.46% | Your portfolio gained €373.98 today | 2 hours ago |
| 💰 | Dividend Received | MSFT paid a dividend of €15.50 | 1 day ago |

The first two are unread (highlighted); the dividend notice has already been read.

---

### When To Use It

Check the Notifications widget when you want to:

- catch a **price alert** the moment it fires, without checking every position manually;
- confirm that a **transaction** you just entered was recorded correctly;
- notice a **login** you don't recognize;
- get a nudge about a **pending dividend** waiting for confirmation.

For a quicker, curated version of "what matters today," see [Today's Brief](today-brief.md), which folds notable notifications together with performance and earnings data into a single ranked summary.

---

### Notes & Limitations

- **Only the 5 most recent** notifications are shown here — open the full Notifications page for the complete history and to mark everything as read at once.
- **Preview/edit mode** on the dashboard may show sample notifications instead of your real data.
- **Empty is normal** — if nothing has happened recently, the widget shows an empty state rather than forcing content.
- Notification types and wording depend on your account activity and Portfolium's alerting rules (e.g. price alerts you've configured, or thresholds for daily moves) — see [Recent Transactions](recent-transactions.md) for a dedicated transaction history view.
