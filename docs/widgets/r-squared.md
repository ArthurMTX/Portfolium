## R-Squared

### What It Shows

R-Squared tells you **how much of your portfolio's ups and downs can be explained by the broader market**, expressed as a percentage from $0\%$ to $100\%$.

It answers the question:

> "Does my portfolio move because of the market, or because of things specific to what I hold?"

- A **high R²** (closer to $100\%$) means your portfolio behaves a lot like the benchmark — when it moves, your portfolio tends to move with it.
- A **low R²** means your portfolio's returns are largely independent of the benchmark — driven more by your specific holdings than by overall market swings.

By default, the benchmark is **SPY**, tracking the S&P 500.

---

### How It's Calculated

R² is derived from the **correlation** between your portfolio's daily performance and the benchmark's daily performance over the selected period (default: $1$ year).

1. Portfolium builds daily performance series for both your portfolio and the benchmark, aligned by date.
2. It computes the correlation coefficient $\rho$ between the two series.
3. R-Squared is simply the correlation squared, as a percentage:

$$
R^2 = \rho^2 \times 100
$$

Since it's a squared value, R² is always between $0\%$ and $100\%$ regardless of whether the correlation itself was positive or negative — R² only measures the strength of the relationship, not its direction.

If there isn't enough aligned data to compute a correlation, the widget falls back to $0$ or shows **N/A**.

---

### Example

Suppose the correlation between your portfolio and SPY over the past year works out to $\rho = 0.92$:

$$
R^2 = 0.92^2 \times 100 = 84.64\%
$$

The widget displays **$84.64\%$** — about $85\%$ of the variation in your portfolio's returns lines up with movements in SPY. Your portfolio behaves quite similarly to the broader market.

---

### When To Use It

Check R-Squared when you want to:

- confirm whether an "actively managed" portfolio is really behaving differently from an index, or is effectively just tracking it;
- put [Alpha](alpha.md) in context — a high alpha with high R² suggests you're beating the market while still moving with it, while a high alpha with low R² suggests your outperformance comes from positions that march to their own beat;
- gauge how much diversification benefit your specific holdings provide versus a plain index fund — a low R² can be a sign of genuinely differentiated exposure (or, alternatively, a mismatched benchmark).

---

### Notes & Limitations

- **Direction-blind.** R² tells you how tightly your portfolio and the benchmark move together, not whether that movement is positive or negative — check [Beta & Market Correlation](beta-correlation.md) or [Alpha](alpha.md) for direction and magnitude.
- **Not a quality signal by itself.** A high R² isn't "good" or "bad" on its own — it only measures how benchmark-like your returns are.
- **Benchmark choice matters.** SPY may not be the most meaningful reference for a portfolio concentrated in crypto, bonds, or a single non-US market.
- **Depends on price history.** Missing or misaligned price data for the portfolio or benchmark reduces the reliability of the correlation this is based on.
- Best interpreted together with [Alpha](alpha.md) and [Beta & Market Correlation](beta-correlation.md), not in isolation.
