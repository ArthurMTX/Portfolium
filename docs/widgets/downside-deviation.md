## Downside Deviation

### What It Shows

Downside Deviation measures how rough your portfolio's **losing days** have been. Unlike [Volatility](volatility.md), which treats a big up day and a big down day as equally "risky," downside deviation only looks at the days you lost money — it ignores upside swings entirely.

It answers the question:
> "When my portfolio has a bad day, how bad does it tend to get?"

- **Low downside deviation** — your losing days tend to be small and contained.
- **High downside deviation** — your losing days can be sharp and severe.

Two portfolios can have identical overall volatility, but the one with lower downside deviation is the more comfortable ride, because its swings are concentrated on the upside rather than the downside.

### How It's Calculated

Portfolium computes downside deviation from your portfolio's **daily returns over the past year**, adjusted for any deposits or withdrawals so cash flows don't distort the result.

1. Compute daily returns for the selected period.
2. Keep only the **negative** return days — every positive or flat day is discarded.
3. Average the squared negative returns to get the downside variance.
4. Take the square root to get daily downside deviation.
5. Annualize by multiplying by $\sqrt{252}$ (the number of trading days in a year).

$$
\sigma_{\text{down}} = \sqrt{\frac{1}{N_{\text{neg}}} \sum_{r_t < 0} r_t^2} \times \sqrt{252}
$$

Where $r_t$ is a daily return and $N_{\text{neg}}$ is the number of negative-return days.

If your portfolio had zero negative days in the period, downside deviation is $0\%$. If there isn't enough price history to compute daily returns, the widget shows **N/A**.

### Example

| Step | Value |
|---|---|
| Negative-return days in the period | $80$ |
| Average squared negative return | $0.0000578$ |
| Daily downside deviation ($\sqrt{0.0000578}$) | $0.0076$ |
| Annualization factor ($\sqrt{252}$) | $\approx 15.87$ |
| **Annualized downside deviation** | $0.0076 \times 15.87 \approx 12.07\%$ |

The widget would display **$12.07\%$**.

### When To Use It

Look at Downside Deviation when you want to:

- gauge how painful your portfolio's bad days actually are, rather than how "swingy" it is overall;
- compare two portfolios with similar [Volatility](volatility.md) but a different balance of upside vs. downside moves;
- get a feel for whether your risk is coming from occasional sharp drops or from broad two-sided noise.

### Notes & Limitations

- Uses the default $1$-year lookback window, based on your portfolio's actual daily value history (not a single holding).
- Only negative days count — a portfolio that only ever goes up would show $0\%$ downside deviation even with wild positive swings.
- Backward-looking: it describes what already happened, not what will happen next.
- Pairs naturally with [Max Drawdown](max-drawdown.md), [Value at Risk](value-at-risk.md), and [Volatility](volatility.md) for a fuller risk picture.
