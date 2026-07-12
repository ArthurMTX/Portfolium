## Volatility

### What It Shows

Volatility answers the question:
> "How much does my portfolio typically move, day to day?"

It's the annualized measure of how much your portfolio's daily returns swing around their average — in both directions, up and down. A calmer portfolio has a lower number; a portfolio that regularly makes big moves (in either direction) has a higher one.

Rough interpretation:

- **Below $10\%$** — low volatility, a relatively calm portfolio.
- **$10\%$ to $20\%$** — moderate volatility.
- **Above $20\%$** — high volatility, expect noticeable swings.

Higher volatility isn't automatically bad — it just means bigger moves both when things go your way and when they don't.

### How It's Calculated

Portfolium computes volatility from your portfolio's **daily returns over the past year**, adjusted for deposits and withdrawals so contributions aren't mistaken for gains:

1. Compute daily returns, $r_t = \dfrac{V_t - V_{t-1}}{V_{t-1}}$, from the daily portfolio value history.
2. Calculate the variance of those daily returns around their mean.
3. Take the square root to get daily volatility.
4. Annualize by multiplying by $\sqrt{252}$ (the standard number of trading days in a year).

$$
\sigma_{\text{annual}} = \sqrt{\frac{1}{N}\sum_{t=1}^{N}(r_t - \bar{r})^2} \times \sqrt{252}
$$

Where $r_t$ is a daily return, $\bar r$ is the average daily return, and $N$ is the number of days in the period. If there isn't enough daily history to compute this, the widget shows **N/A**.

### Example

| Step | Value |
|---|---|
| Standard deviation of daily returns | $1.16\%$ |
| Annualization factor ($\sqrt{252}$) | $\approx 15.87$ |
| **Annualized volatility** | $0.0116 \times 15.87 \approx 18.40\%$ |

The widget would display **$18.40\%$**.

### When To Use It

Look at Volatility when you want to:

- get a general sense of how "bumpy" your portfolio's ride has been;
- compare the overall riskiness of different portfolios or allocations;
- decide whether your current mix matches your comfort with fluctuation, before adding higher-risk positions.

### Notes & Limitations

- Counts both up and down swings equally — it doesn't distinguish "good" volatility (sharp gains) from "bad" volatility (sharp losses). For a downside-only view, see [Downside Deviation](downside-deviation.md).
- Based on the default $1$-year window of daily portfolio values.
- Backward-looking: it reflects what already happened, not a guarantee of future behavior.
- Pairs well with [Sharpe Ratio](sharpe-ratio.md), [Max Drawdown](max-drawdown.md), and [Beta](beta-correlation.md) for a rounder risk picture.
