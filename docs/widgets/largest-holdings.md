## Largest Holdings

### What It Shows

Largest Holdings answers a simple but important question: **where is most of your money actually sitting?**

The widget lists your top holdings ranked by current market value, showing for each one:

- its rank (#1, #2, ...);
- the logo, ticker, and name;
- its **weight** — the percentage of your total portfolio value it represents;
- its **market value** in your portfolio's base currency.

Each row also has a small progress bar that fills according to the holding's weight, so the biggest positions are visually obvious at a glance.

This is a snapshot of **concentration**, not performance — a holding can be your largest position while still being a loser, or your smallest position while being your best performer.

---

### How It's Calculated

1. Take all current positions with a market value greater than $0$.
2. Sort them by market value, descending.
3. Keep the top $5$.
4. For each one, compute its weight as:

$$
\text{weight} = \frac{\text{market value of holding}}{\text{total market value of all positions}} \times 100
$$

The total market value used for the denominator is the sum of the market value across **all** of your current positions, not just the ones shown.

---

### Example

| Rank | Symbol | Market Value | Weight |
|---|---|---|---|
| #1 | NVDA | $15{,}420 | $22.8\%$ |
| #2 | MSFT | $9{,}622 | $14.2\%$ |
| #3 | AAPL | $8{,}775 | $13.0\%$ |
| #4 | AMZN | $6{,}543 | $9.7\%$ |
| #5 | GOOGL | $5{,}234 | $7.7\%$ |

In this example, the top $5$ holdings alone make up about $67.4\%$ of the portfolio — useful to know if you're trying to gauge how diversified you really are.

---

### When To Use It

Check Largest Holdings when you want to:

- quickly see which positions would hurt the most if they dropped sharply;
- sanity-check that no single stock has quietly grown into an outsized share of your portfolio;
- decide where trimming would meaningfully change your overall risk;
- get a fast overview without opening the full [Positions](positions.md) table.

---

### Notes & Limitations

- **Top 5 only** — for the complete ranked list with cost basis and gain/loss, use [Positions](positions.md).
- **Value-based, not performance-based** — a holding can rank highly here purely because you've added a lot of capital to it, regardless of how well it's doing. For that angle, see [Top Performers](top-performers.md) and [Worst Performers](worst-performers.md).
- **Positions with no market value are excluded** — if a price hasn't been fetched yet, that holding won't appear until data is available.
- **Empty state** — if you have no open positions, the widget shows a simple "no data" message instead of an empty list.
