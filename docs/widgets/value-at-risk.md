## Value at Risk

### What It Shows

Value at Risk (VaR) answers the question:
> "How much could I lose on a bad — but not catastrophic — day?"

It's shown as a negative percentage, for example $-2.50\%$, and read like this:

> "On $95\%$ of days, your portfolio shouldn't lose more than $2.50\%$."

That leaves the worst $5\%$ of days — genuine market shocks or crashes — outside what VaR is describing. It's meant to capture "a normal bad day," not the tail-risk extreme.

### How It's Calculated

Portfolium uses **historical simulation**: instead of assuming returns follow a bell curve, it looks directly at what your portfolio actually did.

1. Compute daily returns from your portfolio's value history over the past year (adjusted for deposits/withdrawals).
2. Sort all daily returns from worst to best.
3. Take the return at the **5th percentile** of that sorted list — the point below which only the worst $5\%$ of days fall.
4. Flip the sign and express it as a percentage.

$$
\text{VaR}_{95} = -\big(\text{5th percentile of daily returns}\big) \times 100
$$

The 5th percentile is found by linear interpolation between the two nearest sorted data points, so it isn't limited to picking an existing day's return outright. If there isn't enough return history, the widget shows **N/A**.

### Example

| Step | Value |
|---|---|
| Daily returns sorted, worst to best | ... |
| Return at the 5th percentile | $-0.025$ ($-2.5\%$) |
| **VaR (95%)** | $-2.50\%$ |

The widget would display **$-2.50\%$**, meaning that historically, $95\%$ of days saw a loss no worse than $2.5\%$.

### When To Use It

Reach for Value at Risk when you want to:

- put a concrete number on "how bad can a normal bad day get" for your portfolio;
- size positions or decide how much cash buffer feels comfortable given typical downside;
- compare the everyday riskiness of different portfolios or allocations.

### Notes & Limitations

- VaR describes **typical** bad days, not the worst-case scenario — a market crash can (and will) exceed it. If you need the average loss beyond that threshold, look for CVaR / Expected Shortfall in the detailed risk breakdown.
- Based entirely on historical daily returns over the default $1$-year window — it doesn't assume any particular statistical distribution, but it also can't anticipate a shock that hasn't happened yet in the lookback period.
- Always shown as a negative percentage; a more negative number means a rougher "normal" bad day.
- Complements [Max Drawdown](max-drawdown.md) (the single worst historical decline), [Volatility](volatility.md), and [Downside Deviation](downside-deviation.md).
