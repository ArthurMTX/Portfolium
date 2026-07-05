## Diversification Score

### What It Shows

Diversification Score condenses "how spread out is my money?" into a single number from $0$ to $100$ — higher means your portfolio is more evenly spread across your holdings, lower means it's concentrated in a handful of positions (or one).

The widget displays:

- the **score** out of 100 (e.g. $72/100$);
- a subtitle noting how many positions the score is based on;
- color coding: **green** at $70$ and above, **amber** from $40$ to $69$, **red** below $40$.

If you have no open positions, or your positions' total market value is zero, it shows **N/A**.

### How It's Calculated

The score is built from the **Herfindahl-Hirschman Index (HHI)**, a standard concentration measure: it sums the squared weight of every position in your portfolio.

$$
\text{HHI} = \sum_{i=1}^{n} w_i^2, \qquad w_i = \frac{\text{market value of position } i}{\text{total portfolio value}}
$$

HHI ranges from $\frac{1}{n}$ (perfectly equal-weighted across $n$ positions — as diversified as possible) up to $1$ (100% in a single position — fully concentrated). Portfolium inverts and rescales HHI onto a $0$–$100$ scale so that higher always means *more* diversified:

$$
\text{Score} = \frac{\text{maxHHI} - \text{HHI}}{\text{maxHHI} - \text{minHHI}} \times 100,
\qquad \text{maxHHI} = 1,\ \ \text{minHHI} = \frac{1}{n}
$$

The result is clamped to the $[0, 100]$ range and rounded to the nearest whole number for display.

Two things follow directly from the formula:

- **More holdings, all else equal, raise the ceiling.** With more positions, the "perfectly diversified" HHI floor ($1/n$) gets smaller, meaning an equal-weighted portfolio of more positions scores closer to 100 than an equal-weighted portfolio of fewer positions.
- **Concentration in a few large positions drags the score down hard**, because HHI squares each weight — a single 40% position contributes disproportionately more to HHI than four 10% positions combined.

This measure only looks at **position weights** within the portfolio you hold — it does not account for sector, geography, or asset-class overlap between positions (see [Concentration Risk](concentration-risk.md) and [Asset Allocation](asset-allocation.md) for that kind of breakdown).

### Example

A portfolio with 4 positions:

| Position | Market Value | Weight |
|---|---|---|
| A | €4,000 | $40\%$ |
| B | €3,000 | $30\%$ |
| C | €2,000 | $20\%$ |
| D | €1,000 | $10\%$ |

$$
\text{HHI} = 0.40^2 + 0.30^2 + 0.20^2 + 0.10^2 = 0.16 + 0.09 + 0.04 + 0.01 = 0.30
$$

With $n = 4$, the perfectly diversified floor is $\text{minHHI} = 1/4 = 0.25$:

$$
\text{Score} = \frac{1 - 0.30}{1 - 0.25} \times 100 = \frac{0.70}{0.75} \times 100 \approx 93
$$

The widget shows **93/100** in green, with the subtitle "Based on 4 positions" — even with a 40% top position, the score reads high because the position count is small and the floor for "perfect" diversification at $n=4$ is itself fairly concentrated ($25\%$ each).

### When To Use It

Reach for Diversification Score when you want to:

- get an at-a-glance concentration check without manually eyeballing position weights;
- track whether adding or trimming positions is actually improving balance, not just adding names;
- catch a portfolio that looks diversified by holding count but is secretly dominated by one or two large positions.

### Notes & Limitations

- **Weight-based only.** It measures how evenly value is spread across positions — it says nothing about whether those positions are correlated, in the same sector, or in the same currency.
- **Score is relative to your own position count.** More positions does not automatically mean better diversification — what matters is how evenly value is distributed among them, scaled against what's achievable for that number of holdings.
- **Requires at least one open position with non-zero market value** — otherwise the widget shows N/A.
- Pair with [Concentration Risk](concentration-risk.md), [Asset Allocation](asset-allocation.md), and [Theme Allocation](theme-allocation.md) for a fuller picture of how your portfolio is actually spread.
