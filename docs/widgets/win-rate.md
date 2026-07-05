## Win Rate

### What It Shows

Win Rate is a compact, dedicated card that answers: *out of everything I currently hold, how many positions are actually green right now?* It shows:

- the **Win Rate** as a whole-number percentage (e.g. $63\%$);
- a subtitle with the raw count of profitable positions out of the total;
- the value colored **green** at $70\%$ or above, **amber** between $50\%$ and $69\%$, and **red** below $50\%$.

It uses the same underlying signal as [Hit Ratio](hit-ratio.md) — the share of open positions with positive unrealized P&L — but is a separate, simpler widget with its own three-tier color scale (rather than Hit Ratio's two-tier green/amber split) and no "N/A" empty-state distinction for missing P&L.

### How It's Calculated

Win Rate counts **open positions with a defined unrealized P&L**, then checks how many of those are strictly positive:

1. Count positions where unrealized P&L is not null and greater than $0$ → the "winners."
2. Count positions where unrealized P&L is not null (regardless of sign) → the total considered.
3. Compute the percentage.

$$
\text{Win Rate} = \frac{\text{positions with unrealized P\&L} > 0}{\text{positions with a defined unrealized P\&L}} \times 100
$$

The displayed value is rounded to the nearest whole percent (no decimal), unlike Hit Ratio which shows one decimal place. Positions sitting at exactly $0$ P&L are not counted as winners. If there are no positions with a defined P&L, the widget shows $0\%$.

### Example

Say your portfolio has 8 positions with a defined unrealized P&L, and 5 of them are currently profitable:

$$
\text{Win Rate} = \frac{5}{8} \times 100 = 62.5\% \rightarrow 63\%
$$

The widget displays **63%** in amber (since it falls between $50\%$ and $69\%$), with a line reading "5 of 8 in profit."

### When To Use It

Use Win Rate when you want:

- a quick glance at trade quality without opening the full positions table;
- a stricter visual signal than Hit Ratio — the extra "green ≥ 70%" tier makes it easier to tell a strong streak from a merely adequate one;
- to track whether a change in strategy (position sizing, stop-losses, entry timing) is nudging your win/loss count in the right direction over time.

### Notes & Limitations

- **Ignores position size.** A tiny winning position and a large losing one count exactly the same, so Win Rate can look good even while the portfolio is down in absolute terms.
- **Live prices, so it moves throughout the day.** Because it's based on unrealized P&L, Win Rate shifts as prices update — it's a snapshot, not a historical average.
- **Not the same scale as Hit Ratio.** The two widgets use the same underlying win/loss test, but different rounding (whole percent vs. one decimal) and different color thresholds — expect the color, not necessarily the number, to sometimes differ between them.
- Pair with [Unrealized P&L](unrealized-pnl.md) and [Total Return](total-return.md) to see the euro impact behind the percentage.
