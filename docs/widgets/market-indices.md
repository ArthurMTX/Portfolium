## Market Indices

### What It Shows

Market Indices gives you a global pulse check without leaving your dashboard: the level and daily move of the world's major stock indices, grouped by region. For each index you see:

- the **index name** and a **country flag** for quick recognition;
- the **current level**;
- the **daily percentage change** versus the previous close;
- a trend icon — up arrow in green, down arrow in red, or a grey dash if flat or unavailable.

A "Key Markets" section always shows the S&P 500, Nasdaq, Dow Jones, FTSE 100, DAX, and Nikkei 225 up front. Everything else — TSX, CAC 40, FTSE MIB, Hang Seng, SSE Composite, ASX 200 — is grouped by region (Americas, Europe, Asia) behind a "show more" toggle.

### How It's Built

Portfolium fetches quotes for a fixed list of index symbols in a single batch request — `^GSPC` (S&P 500), `^DJI` (Dow Jones), `^IXIC` (Nasdaq), `^GSPTSE` (TSX), `^FTSE` (FTSE 100), `^GDAXI` (DAX), `^FCHI` (CAC 40), `FTSEMIB.MI` (FTSE MIB), `^N225` (Nikkei 225), `^HSI` (Hang Seng), `000001.SS` (SSE Composite), and `^AXJO` (ASX 200) — batching them into one external API call rather than one per index, to stay well under rate limits.

Each quote carries the latest price and the percentage change versus the previous close. Server-side, results are cached briefly (about a minute) so the dashboard doesn't refetch on every load; if fresh data can't be fetched in time, Portfolium serves the last known values rather than showing nothing. On the client, the whole widget also automatically refreshes about once a minute while visible.

For display, changes get a leading `+` or `-` sign, and the trend icon/color simply reflects the sign of the change — positive is green with an up arrow, negative is red with a down arrow, and zero or missing data is a neutral grey dash.

### Example

On a typical trading day, the "Key Markets" section might read:

| Index | Level | Change |
|---|---|---|
| S&P 500 | 4,750.32 | $+0.85\%$ |
| Nasdaq | 15,220.55 | $+1.30\%$ |
| Dow Jones | 38,120.10 | $+0.40\%$ |
| FTSE 100 | 7,650.10 | $-0.15\%$ |
| DAX | 15,950.80 | $-0.10\%$ |
| Nikkei 225 | 33,100.50 | $+0.20\%$ |

At a glance: US and Japan are up, UK and Germany are down slightly.

### When To Use It

Check Market Indices when you want to:

- get a quick macro read on whether it's a risk-on or risk-off day globally;
- see whether your portfolio's move today is in line with, or diverging from, the broader market;
- track which regions are leading or lagging before deciding to check individual holdings.

It pairs naturally with [Market Status](market-status.md) — indices only move meaningfully while their home market is actually open — and with your own [Daily Gain](daily-gain.md) or [Performance Metrics](performance-metrics.md) for comparison.

### Notes & Limitations

- Levels and changes reflect the **latest available quote**, which may lag slightly outside of exchange hours.
- An index occasionally shows **—** when a fresh quote isn't available and no fallback value exists yet.
- The tracked index list is currently **fixed**; there's no way to add or remove indices from the widget itself.
- Related pages: [Market Status](market-status.md), [Volatility](volatility.md).
