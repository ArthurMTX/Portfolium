## Sharpe Ratio

### What It Shows

The Sharpe Ratio answers the question:
> "Am I being properly paid for the risk I'm taking?"

It measures how much **extra return** your portfolio earns above a safe, risk-free baseline, per unit of volatility endured to get there. Two portfolios can have the same return, but the one that got there with a smoother ride has the better Sharpe Ratio.

Rough interpretation of the number:

- **Below $0$** — your portfolio underperformed even a risk-free investment.
- **$0$ to $1$** — modest risk-adjusted performance.
- **$1$ to $2$** — good risk-adjusted performance.
- **Above $2$** — excellent risk-adjusted performance.

### How It's Calculated

Portfolium computes the Sharpe Ratio from your portfolio's **daily returns over the past year** (adjusted for deposits and withdrawals):

$$
\text{Sharpe Ratio} = \frac{R_p - R_f}{\sigma_p}
$$

Where:

- $R_p$ = your portfolio's annualized return, calculated as the geometric (compounded) growth rate over the period;
- $R_f$ = the assumed risk-free rate, fixed at $2\%$ per year;
- $\sigma_p$ = your portfolio's annualized volatility (the same figure shown in the [Volatility](volatility.md) widget).

In other words: take your annualized return, subtract the $2\%$ risk-free baseline, then divide by how much your portfolio swings around on a typical year. If your portfolio's volatility is zero or too close to zero to divide by meaningfully, the ratio can't be computed and the widget shows **N/A**.

### Example

| Step | Value |
|---|---|
| Annualized return | $8\%$ |
| Risk-free rate | $2\%$ |
| Annualized volatility | $4\%$ |
| Sharpe Ratio | $\frac{0.08 - 0.02}{0.04} = 1.50$ |

The widget would display **$1.50$**.

### When To Use It

Use the Sharpe Ratio when you want to:

- judge whether your returns actually justify the ups and downs you went through to get them;
- compare portfolios or strategies that have different risk levels, not just different returns;
- decide whether adding a volatile holding is worth the extra bumpiness it brings.

### Notes & Limitations

- Based on the portfolio's own daily value history over the default $1$-year window.
- The risk-free rate is a fixed assumption ($2\%$ annually), not pulled from a live market rate — treat comparisons across time periods with that in mind.
- Volatility here counts both upside and downside swings; a portfolio with big positive surprises can still show a lower Sharpe Ratio than expected. For a downside-only view, see [Downside Deviation](downside-deviation.md).
- Backward-looking, like all metrics on this page — past risk-adjusted performance doesn't guarantee future results.
