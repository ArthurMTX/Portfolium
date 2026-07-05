## Market Status

### What It Shows

Market Status tells you, at a glance, whether the world's major stock markets are open for trading right now — which is exactly the context you need when a price hasn't moved and you're wondering if it's stale data or just a closed exchange. For four regions (USA, Europe, Asia, Oceania), it shows:

- a **colored status dot** — green for open, amber for the US pre-market/after-hours windows, red for closed, grey if the status can't be determined;
- a **status label** next to each region.

The US gets the most detail, with four possible states: **Pre-market**, **Open**, **After-hours**, and **Closed**. The other three regions are shown simply as **Open** or **Closed**.

### How It's Calculated

Each region's status is derived from the current time in its local exchange timezone, checked against fixed session windows — there's no holiday calendar or half-day awareness, just weekday + time-of-day rules.

**United States** (America/New_York time), checked against:

- before $4{:}00$ → **Closed**
- $4{:}00$–$9{:}30$ → **Pre-market**
- $9{:}30$–$16{:}00$ → **Open**
- $16{:}00$–$20{:}00$ → **After-hours**
- after $20{:}00$ → **Closed**

**Europe** (Europe/London time): **Open** between $8{:}00$ and $16{:}30$, **Closed** otherwise.

**Asia** (Asia/Tokyo time): **Open** between $9{:}00$ and $15{:}00$, **Closed** otherwise.

**Oceania** (Australia/Sydney time): **Open** between $10{:}00$ and $16{:}00$, **Closed** otherwise.

For every region, **Saturdays and Sundays are always Closed**, regardless of the time of day. The widget refreshes this check automatically about once a minute.

### Example

Mid-morning in New York on a weekday, you might see:

| Region | Status |
|---|---|
| USA | 🟢 Open |
| Europe | 🔴 Closed |
| Asia | 🔴 Closed |
| Oceania | 🔴 Closed |

A couple of hours earlier, before the US open, you'd instead see USA as 🟠 **Pre-market**, with the other regions reflecting their own local session at that moment.

### When To Use It

Check Market Status when you want to:

- understand why a price or index hasn't updated — it may simply be outside trading hours;
- time trades, rebalancing, or monitoring around actual market sessions rather than guessing;
- get a quick view of which of the world's major regions are actively trading right now.

Pairs naturally with [Market Indices](market-indices.md) — index moves are only meaningful while the underlying exchange is open.

### Notes & Limitations

- **Regular hours only.** Public holidays, exchange-specific half-days, and special sessions are not accounted for — the widget can show "Open" on a holiday if it falls on a weekday within normal hours.
- **One reference exchange per region.** Europe uses London, Asia uses Tokyo, and Oceania uses Sydney as stand-ins for their broader region — other exchanges in the same region may keep slightly different hours.
- **US-only detail.** Pre-market and after-hours states are only tracked for the US; other regions collapse to a simple open/closed.
- Related page: [Market Indices](market-indices.md).
