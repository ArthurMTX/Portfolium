## Top Performers

### What It Shows

Top Performers surfaces the holdings that are **making you the most money, percentage-wise**. It's a quick way to spot your biggest winners without scanning the entire [Positions](positions.md) table.

For each performer, the widget shows:

- its rank (#1, #2, ...);
- logo, ticker, and name;
- its **return** — unrealized gain, as a percentage;
- its current **position value** in your portfolio's base currency.

Only positions you **currently hold** are considered — once you fully sell something, it drops out of this list and its result lives in your realized P&L history instead.

---

### How It's Calculated

For every open position, the widget uses the unrealized profit/loss percentage:

$$
\text{return} = \frac{\text{current value} - \text{cost basis}}{\text{cost basis}} \times 100
$$

Steps:

1. Collect every open position that has a valid unrealized P&L.
2. Sort them from **highest to lowest** return percentage.
3. Keep the top $5$.

The return is shown rounded to two decimals, with a `+` sign for gains. Because the ranking is purely on percentage return, a small position that doubled will outrank a large position that only gained a few percent.

---

### Example

| Rank | Symbol | Cost Basis | Current Value | Return |
|---|---|---|---|---|
| #1 | NVDA | $5{,}000 | $9{,}250 | $+85.00\%$ |
| #2 | MSFT | $6{,}000 | $8{,}400 | $+40.00\%$ |
| #3 | AAPL | $4{,}000 | $5{,}000 | $+25.00\%$ |
| #4 | AMZN | $3{,}000 | $2{,}700 | $-10.00\%$ |
| #5 | TSLA | $7{,}000 | $7{,}500 | $+7.14\%$ |

Even with a losing position mixed in above, the widget itself would only ever show the top $5$ by return — a negative entry only appears here if fewer than $5$ of your holdings are currently profitable.

---

### When To Use It

Use Top Performers when you want to:

- identify which holdings are **driving your gains** right now;
- decide whether a big winner has grown large enough to consider trimming;
- get a sense of how concentrated your gains are in one or two names versus spread across the portfolio;
- pair with [Positions](positions.md) or [Largest Holdings](largest-holdings.md) to see the full picture — a top performer isn't necessarily a large position.

---

### Notes & Limitations

- **Open positions only** — fully sold holdings are excluded, no matter how well they did.
- **Percentage-based, not value-based** — a small position with a huge percentage gain can outrank a large position with a modest gain. If you want to see raw dollar impact instead, look at [Largest Holdings](largest-holdings.md).
- **Mirrors the bottom of the list** — see [Worst Performers](worst-performers.md) for the same ranking, inverted.
- Depends on up-to-date market prices; if a price hasn't refreshed recently, the return shown reflects the last price Portfolium has.
