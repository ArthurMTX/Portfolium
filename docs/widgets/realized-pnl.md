## Realized P&L

### What It Shows

Realized P&L shows the profit or loss you've already **locked in** by selling — money you've actually made or lost on completed trades, as opposed to paper gains that could still change. It answers:
> "How much have I actually made or lost from the trades I've already closed?"

The widget shows a single currency amount, colored green when positive and red when negative.

---

### How It's Calculated

For every sell (or transfer/conversion out), Portfolium compares the sale proceeds to the cost basis being disposed of at that moment, using a moving weighted-average cost per asset:

$$
\text{Realized PNL} = \sum_{i=1}^{n} \left( S_i - C_i \right)
$$

Where, for each disposal $i$:

- $S_i$ = net sale proceeds (quantity sold × sale price, minus fees on that sale)
- $C_i$ = the average cost basis attributed to the shares sold, based on the weighted-average cost of the position at the time of the sale

This total is summed across **every sell you've ever made** in the portfolio — both from positions you've fully closed and from partial sells on positions you still hold today. Once realized, a gain or loss is final: it does not fluctuate with today's market price.

---

### Example

- Asset A: sold for $S_1 = €2{,}400$, cost basis of shares sold $C_1 = €2{,}000$
- Asset B: sold for $S_2 = €1{,}300$, cost basis of shares sold $C_2 = €1{,}500$

$$
\text{Realized PNL} = (2{,}400 - 2{,}000) + (1{,}300 - 1{,}500) = 400 - 200 = 200
$$

The widget displays **+€200.00**.

---

### When To Use It

Check Realized P&L when you want to:

- review the results of **trades you've already completed**;
- track your long-term trading performance separately from open positions;
- support **tax reporting**, since realized gains and losses are what typically matters for tax purposes;
- see which past trades actually contributed to your results.

Pair it with [Unrealized P&L](unrealized-pnl.md) for paper gains still in play, and [Total Return](total-return.md) for the combined picture including dividends and fees.

---

### Notes & Limitations

- Realized P&L is **final** — it does not change with current market prices, unlike Unrealized P&L.
- Both fully closed positions and partial sells on still-open positions contribute to this total.
- Cost basis for each sale is calculated using a moving weighted-average method, so the exact split between "cost" and "gain" on a partial sell depends on your full buy history for that asset up to that point.
- Currency and formatting follow your portfolio's base currency settings; sales in a foreign currency are converted at the time of the transaction.
