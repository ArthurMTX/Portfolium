## Today's Brief

### What It Shows

Today's Brief is your **daily catch-up card**. Instead of scrolling through every position and notification, it surfaces the handful of things that actually matter for your portfolio right now:

- how your portfolio is doing **today** (gain or loss, in € and %);
- your **best and worst movers** of the day;
- **earnings** coming up soon for stocks you hold;
- **dividends** that are pending review before they're added to your history;
- new **all-time highs or lows**, or price alerts that just triggered;
- a note when prices might be **delayed** (for example outside market hours).

Think of it as a short morning briefing rather than a full report — if nothing notable happened, the widget simply says so instead of padding the list with filler.

---

### How It's Built

Today's Brief doesn't just list recent activity — it builds a short, ranked set of items from several signals, using fixed thresholds so the card stays focused on what's actually notable.

**What feeds into it:**

- **Portfolio performance** — your total daily gain/loss, always considered first.
- **Best and worst movers** — a holding is only flagged as a mover if it moves at least $4\%$ that day.
- **Watchlist moves** — a watched asset is only flagged if it moves at least $5\%$ that day.
- **Earnings soon** — holdings reporting earnings within the next $7$ days.
- **Pending dividends** — dividend payments awaiting your confirmation.
- **Milestones and alerts** — the most recent all-time high/low or price alert from the last $24$ hours.
- **Delayed data** — shown when a position's price hasn't refreshed in the last $15$ minutes.

**How items are chosen:**

1. Gather all candidate items from the signals above.
2. Remove duplicates (for example, the same asset triggering two similar signals).
3. Rank the remaining items in a fixed order of importance:

$$
\text{portfolio performance} \;\rightarrow\; \text{best/worst movers} \;\rightarrow\; \text{earnings} \;\rightarrow\; \text{watchlist moves} \;\rightarrow\; \text{data freshness} \;\rightarrow\; \text{pending dividends} \;\rightarrow\; \text{other}
$$

   Ties within the same rank are broken by most recent first.
4. Keep only the top $7$ items.

The result is cached for a few minutes per portfolio, so reopening the dashboard doesn't recompute the brief on every load — it refreshes automatically in the background as new data comes in.

---

### Example

On a given morning, the brief might show:

| Item | Meaning |
|---|---|
| **Portfolio $+1.8\%$ today** ($+€312.40$) | Your overall portfolio is up for the day. |
| **$2$ earnings tomorrow** — NVDA, ASML | Two of your holdings report earnings the next day — expect bigger price swings. |
| **$1$ pending dividend** — $€18.40$ awaiting review | A dividend payment needs your confirmation before it's recorded. |

---

### When To Use It

Check Today's Brief when you want to:

- get a **quick daily pulse** on your portfolio without opening every widget;
- know **ahead of time** which holdings report earnings soon, so swings don't catch you off guard;
- catch **pending dividends** before they pile up unconfirmed;
- notice **new highs/lows** or triggered alerts without digging through notifications.

It's designed to be the first thing you glance at when you open your dashboard.

---

### Notes & Limitations

- **Summary, not a full history** — for the complete picture, use [Recent Transactions](recent-transactions.md), [Notifications](notifications.md), or [Insights](../user-guide/insights.md).
- **Delayed data note** appears when the market is closed or prices haven't refreshed recently — it's a freshness hint, not an error.
- **Empty is normal** — on a quiet day with no notable moves or events, the widget shows an empty state rather than forcing content.
