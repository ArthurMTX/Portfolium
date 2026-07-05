## Worst Performers

### What It Shows

Worst Performers is the mirror image of [Top Performers](top-performers.md) — it surfaces the holdings that are **losing you the most money, percentage-wise**, so you can spot problem positions without scanning the whole [Positions](positions.md) table.

For each entry, the widget shows:

- its rank (#1, #2, ...);
- logo, ticker, and name;
- its **return** — unrealized gain or loss, as a percentage;
- its current **position value** in your portfolio's base currency.

Only positions you **currently hold** are considered. Once you fully sell a losing position, it moves into your realized P&L history and no longer appears here.

---

### How It's Calculated

For every open position, the widget uses the same unrealized profit/loss percentage as Top Performers:

$$
\text{return} = \frac{\text{current value} - \text{cost basis}}{\text{cost basis}} \times 100
$$

Steps:

1. Collect every open position that has a valid unrealized P&L.
2. Sort them from **lowest to highest** return percentage — the biggest losses first.
3. Keep the bottom $5$.

The return is shown rounded to two decimals, with a `-` sign for losses. Because the ranking is purely on percentage, a small position that's down heavily will outrank a large position with a modest loss.

---

### Example

Using the same holdings as the Top Performers example:

| Rank | Symbol | Cost Basis | Current Value | Return |
|---|---|---|---|---|
| #1 | GME | $1{,}500 | $1{,}200 | $-20.00\%$ |
| #2 | META | $2{,}000 | $1{,}800 | $-15.00\%$ |
| #3 | AMZN | $3{,}000 | $2{,}700 | $-10.00\%$ |

If you have fewer than $5$ positions currently at a loss, the list fills the remaining spots with your smallest gainers — so it's possible to see a positive return here on a quiet day.

---

### When To Use It

Use Worst Performers when you want to:

- catch **underperforming positions** early, before a small loss becomes a large one;
- decide whether to average down, hold, or cut a losing position;
- separate "this holding is genuinely struggling" from "the whole market is down today" by cross-checking with [Today's Brief](today-brief.md) or your portfolio's overall return;
- avoid the temptation to only look at your winners.

---

### Notes & Limitations

- **Open positions only** — fully sold holdings are excluded, even if they were realized at a loss.
- **Percentage-based, not value-based** — a small position that dropped sharply can outrank a large position with a smaller percentage loss. For raw position size instead, see [Largest Holdings](largest-holdings.md).
- **Can show gains** — if fewer than 5 positions are currently underwater, the list is padded with your weakest (but still positive) performers rather than left incomplete.
- Depends on up-to-date market prices; if a price hasn't refreshed recently, the return shown reflects the last price Portfolium has.
