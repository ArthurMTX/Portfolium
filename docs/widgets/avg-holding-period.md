## Average Holding Period

### What It Shows

This widget tells you how long, **on average**, you keep an investment before selling it — or, for positions you still hold, how long you've held them so far.

It's displayed as a single readable duration, such as "$45$ days", "$6$ months", or "$1.8$ years", and answers:

> "On average, how many days do I hold a position before moving on?"

A short average holding period points to a more active, trading-oriented style. A long one points to a buy-and-hold, long-term investing style. If you have no buy/sell history yet, the widget shows **N/A**.

---

### How It's Calculated

Portfolium works through your full BUY/SELL transaction history, asset by asset, and matches trades using **FIFO (First In, First Out)** — the same convention used by most brokers and tax reporting.

**For completed trades:** each BUY creates a "lot" with a purchase date and quantity. Each SELL consumes the oldest remaining lots first. Whenever all or part of a lot is sold, that portion's holding period is recorded as:

$$
\text{Holding Days} = \text{Sell Date} - \text{Buy Date}
$$

**For positions you still hold:** after matching every sell, whatever BUY quantity remains represents your current position. Its holding period is measured from the purchase date up to today:

$$
\text{Holding Days} = \text{Today} - \text{Buy Date}
$$

**Final average:** every one of these holding-day entries — closed lots and open lots alike — goes into one list, and the average is a simple (unweighted) mean:

$$
\text{Average Holding Period} = \frac{\sum \text{Holding Days}}{\text{Number of lots}}
$$

This is a straight average across lots, not weighted by position size — a small $\$200$ position held for a year counts the same as a $\$20{,}000$ position held for a year.

---

### Example

| Asset | Event | Holding period |
|---|---|---|
| Asset A | Bought Jan 1, sold Feb 1 | $31$ days |
| Asset B | Bought Mar 1, still held (as of Apr 15) | $45$ days |

$$
\text{Average Holding Period} = \frac{31 + 45}{2} = 38 \text{ days}
$$

The widget displays **"$38$ days."**

---

### When To Use It

Check this widget when you want to:

- get an honest read on your actual investing style versus how you *think* you invest;
- notice if your holding periods are drifting shorter over time (a sign of creeping short-term trading);
- sanity-check your behavior against your stated strategy — for example, if your goal is long-term investing but this number keeps shrinking.

---

### Notes & Limitations

- **Simple average, not value-weighted** — every lot counts equally regardless of its dollar size.
- **FIFO matching** is used to pair sells with buys; this is a standard convention but won't always match your actual specific-lot intentions if you used a different method.
- **Includes both closed and open positions** — currently held positions are counted using days held so far, which pulls the average toward "still ongoing" holdings.
- Requires at least one BUY transaction; with no transaction history, the widget shows **N/A**.
