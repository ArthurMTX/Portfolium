## Positions

### What It Shows

Positions is your full holdings table right on the dashboard — the detailed, sortable view behind the summary widgets. It's split into three tabs:

- **Current** — everything you still hold, in full;
- **Realized** — positions you've **partially** sold (you still hold some quantity, but part of it has already been sold and booked as realized gain/loss);
- **Sold** — positions you've **fully** closed out (zero quantity remaining).

**Current** positions show, per row: quantity held, average cost per share, current price, daily change %, market value, % of your total portfolio ("% of Wallet"), and unrealized P&L in both currency and percentage.

**Realized** positions show: quantity sold vs. quantity remaining, realized P&L and P&L %, and lifetime P&L (realized plus unrealized combined).

**Sold** positions show: average cost basis, average proceeds (average sale price), realized P&L, and realized P&L %.

Every column header is clickable to sort by that column, ascending or descending. On mobile, rows collapse into cards with the same information grouped together. Clicking any row opens a detail modal with deeper metrics for that asset (drawdown, breakeven distance, volatility contribution, and more).

---

### How It's Built

For **current** positions in a loss, an extra line appears under the P&L percentage showing the **breakeven gain needed** — how far the price would need to rise from here to get you back to your average cost:

$$
\text{breakeven gain} = \frac{\text{average cost} - \text{current price}}{\text{current price}} \times 100
$$

A position's **% of Wallet** is its share of your total current market value:

$$
\text{\% of wallet} = \frac{\text{position market value}}{\text{total market value of all current positions}} \times 100
$$

The **Realized** tab includes any position where you still hold a positive quantity but have also sold part of it at some point (a partial exit) — it sits between "still fully held" and "fully closed."

By default, current positions sort by market value (largest first), and realized/sold positions sort by realized P&L (largest gain first). You can change the sort at any time by clicking a column header.

---

### Example

**Current** tab:

| Symbol | Quantity | Avg Cost | Current Price | Market Value | % of Wallet | P&L |
|---|---|---|---|---|---|---|
| AAPL | $15$ | $\$150.00$ | $\$190.00$ | $\$2{,}850.00$ | $12.5\%$ | $+\$600.00$ ($+26.67\%$) |

**Sold** tab:

| Symbol | Avg Cost Basis | Avg Proceeds | Realized P&L | Realized P&L % |
|---|---|---|---|---|
| TSLA | $€180.00$ | $€230.00$ | $+€500.00$ | $+27.78\%$ |

---

### When To Use It

Use Positions when you want to:

- see everything you hold in one sortable, detailed table instead of scanning multiple summary widgets;
- check exactly how much of your portfolio a single holding represents;
- review how a fully or partially closed trade actually performed;
- dig into a specific asset's breakeven point or other detail metrics via the row modal.

---

### Notes & Limitations

- Figures are built from your recorded **transactions** combined with the latest **market prices** — if a price hasn't refreshed recently, market value and P&L reflect the last known price.
- The **Realized** and **Sold** tabs use the same realized P&L definitions used elsewhere in Portfolium, so numbers stay consistent across widgets.
- Empty tabs show a short explanatory message rather than a blank table.
- For a quick top-N view instead of the full table, see [Largest Holdings](largest-holdings.md), [Top Performers](top-performers.md), or [Worst Performers](worst-performers.md).
