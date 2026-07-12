## Alpha

### What It Shows

Alpha tells you whether your portfolio **beat or lagged the market** over the past year.

It's expressed as a single percentage, like $+2.30\%$ or $-1.15\%$, and answers a simple question:

> "Did my portfolio do better or worse than a broad market index, and by how much?"

- A **positive alpha** means your portfolio outperformed the benchmark — your picks, timing, or strategy added value beyond just "being in the market."
- A **negative alpha** means your portfolio underperformed the benchmark — you would have done better simply holding the index.

By default, Portfolium compares you against **SPY**, an ETF that tracks the S&P 500, as a proxy for "the market."

---

### How It's Calculated

Alpha here is your **excess return** — the gap between your portfolio's total return and the benchmark's total return over the same period (default: $1$ year).

**Step 1 — Portfolio return.** For each day in the period, Portfolium tracks your performance relative to what you've invested:

$$
\text{Portfolio Performance}_t = \frac{V_t - I_t}{I_t} \times 100
$$

where $V_t$ is your portfolio's value on day $t$ and $I_t$ is your invested capital on that day. The portfolio return used for alpha is this performance on the **last day** of the period.

**Step 2 — Benchmark return.** For SPY (or whichever benchmark is selected), Portfolium tracks price performance from the start of the period:

$$
\text{Benchmark Performance}_t = \frac{P_t - P_0}{P_0} \times 100
$$

where $P_0$ is the benchmark's price on the first day of the period, and $P_t$ is its price on day $t$. The benchmark return used is this performance on the **last day**.

**Step 3 — Alpha.**

$$
\alpha = R_{\text{portfolio}} - R_{\text{benchmark}}
$$

This is a straightforward "excess return" style of alpha — it does not adjust for how much extra risk (beta) your portfolio took on to get there. If you want a risk-adjusted comparison, pair this with [Beta & Market Correlation](beta-correlation.md).

If there isn't enough price history for your portfolio or the benchmark over the period, the widget shows **N/A** rather than a misleading number.

---

### Example

Over the last year:

| | Return |
|---|---|
| Your portfolio | $+12.50\%$ |
| SPY (benchmark) | $+10.20\%$ |

$$
\alpha = 12.50\% - 10.20\% = 2.30\%
$$

The widget displays **$+2.30\%$** — your portfolio outperformed SPY by $2.30$ percentage points over the year.

---

### When To Use It

Check Alpha when you want to:

- see whether your active choices (stock picking, timing, sector tilts) are actually **adding value** over simply buying an index fund;
- benchmark your results against a familiar reference point instead of judging performance in isolation;
- pair with [R-Squared](r-squared.md) to understand *how* your outperformance was achieved — a high alpha alongside a low R² suggests it came from positions that behave differently from the market, while high alpha with high R² suggests you're closely tracking the market but edging ahead of it.

---

### Notes & Limitations

- **Not risk-adjusted.** This is a simple excess-return alpha, not a full CAPM/Jensen's alpha that discounts for the extra risk (beta) taken to earn that return.
- **Total return over the period, not annualized.** A $1$-year alpha and a $5$-year alpha aren't directly comparable unless you account for the different time spans.
- **Benchmark choice matters.** SPY is a reasonable default for a globally diversified equity portfolio, but it may be a poor fit if you hold mostly bonds, crypto, or a specific regional market.
- **Depends on price history.** Gaps in portfolio or benchmark price data over the period will make alpha unavailable.
- Best read alongside [Beta & Market Correlation](beta-correlation.md) and [R-Squared](r-squared.md) rather than on its own.
