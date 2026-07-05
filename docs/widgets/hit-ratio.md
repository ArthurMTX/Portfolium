## Hit Ratio

### What It Shows

Hit Ratio answers a simple question about your current holdings: *right now, what share of my open positions are actually in the green?* It's a headcount, not a euro count — it tells you how often you're "right" on your open trades, regardless of how big any single win or loss is.

The widget displays:

- the **Hit Ratio** as a percentage (e.g. $63.5\%$);
- a subtitle showing the raw count, e.g. "5 of 8 positions profitable";
- the value colored **green** when the ratio is $50\%$ or higher, and **amber** when it's below $50\%$.

If you hold no positions, it shows **N/A** instead of a percentage.

### How It's Calculated

Hit Ratio looks only at **currently open positions** and their **unrealized profit/loss** — closed or realized trades don't factor in at all.

For each open position:

- unrealized P&L strictly greater than $0$ → counted as **profitable**;
- unrealized P&L of $0$, negative, or missing → counted as **not profitable**.

$$
\text{Hit Ratio} = \frac{\text{number of profitable positions}}{\text{total number of positions}} \times 100
$$

The result is rounded to one decimal place.

### Example

Suppose your portfolio holds 8 open positions:

| Position | Unrealized P&L | Profitable? |
|---|---|---|
| A | +€120 | Yes |
| B | −€45 | No |
| C | +€10 | Yes |
| D | €0 | No |
| E | +€250 | Yes |
| F | −€30 | No |
| G | +€5 | Yes |
| H | −€12 | No |

$$
\text{Hit Ratio} = \frac{4}{8} \times 100 = 50.0\%
$$

The widget shows **50.0%** in amber (since it's not strictly above $50\%$), with the subtitle "4 of 8 positions profitable."

### When To Use It

Check Hit Ratio when you want to:

- get a fast read on how many of your **current** trades are working, independent of position size;
- spot-check whether recent picks are landing more often than not;
- pair it with size-aware metrics — a high hit ratio with a small overall gain usually means your winners are small and your losers are large.

### Notes & Limitations

- **Position count, not money.** A €10 win and a €10,000 win count identically; a high Hit Ratio doesn't guarantee your portfolio is actually up.
- **Open positions only.** Closed/realized trades are excluded entirely — this is not a lifetime win-rate metric.
- **Zero P&L counts as a loss** in this metric, since only strictly positive P&L is counted as a "hit."
- Related pages: [Win Rate](win-rate.md), [Unrealized P&L](unrealized-pnl.md), [Top Performers](top-performers.md).
