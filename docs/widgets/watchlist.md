## Watchlist

### What It Shows

The Watchlist widget is a compact view of assets you're keeping an eye on but don't necessarily hold — up to **5 symbols**, each showing:

- the asset's **logo, symbol, and name**;
- its **current price**, in the asset's own currency;
- its **daily percentage change**, in green with an up arrow if positive, red with a down arrow if negative.

If a price isn't available for an asset, the widget shows **N/A** for that row instead of guessing.

It answers the question:
> "What are the assets I'm tracking doing right now?"

---

### How It's Built

The widget shows the first **5 items** from your full Watchlist (the same list managed on the dedicated Watchlist page), refreshed regularly so prices and daily changes stay current.

- Prices refresh automatically roughly **once a minute** while the dashboard is open and the widget is visible.
- Daily change is shown with a directional arrow: an upward arrow and green text for gains, a downward arrow and red text for losses.
- Clicking anywhere on a row opens the full Watchlist page.
- The widget only loads data once it's actually visible on your dashboard, to avoid unnecessary requests.

Unlike your positions, watchlist assets carry no quantity or cost basis — this widget is purely about price and daily movement, not performance since purchase (since you haven't purchased them).

---

### Example

| Symbol | Name | Price | Daily Change |
|---|---|---|---|
| AMZN | Amazon.com Inc. | $145.80 | $+2.34\%$ |
| META | Meta Platforms Inc. | $325.60 | $-1.22\%$ |
| NFLX | Netflix Inc. | $465.90 | $+3.78\%$ |

---

### When To Use It

Check the Watchlist widget when you want to:

- monitor assets you're **considering buying** without cluttering your actual holdings;
- keep an eye on **competitors or related assets** alongside what you already own;
- get a quick read on **market direction** for names you care about;
- catch a big move on a stock you've been meaning to act on.

For assets you already hold, see the Positions widget instead — Watchlist is specifically for things you're tracking, not owning.

---

### Notes & Limitations

- **Only 5 items** are shown here, even if your full watchlist has more — open the Watchlist page for the complete list.
- To add, remove, or reorder tracked symbols, use the dedicated **Watchlist** page; this widget is read-only.
- **Empty is normal** — if you haven't added anything to your watchlist yet, the widget shows an empty state instead of a list.
- Price and daily-change data depend on market data availability; illiquid or delisted assets may show stale or missing values.
