## Volatility (30d & 90d)

### What It Shows
Volatility measures **how much a stock's price fluctuates over time**.

In Portfolium, you get two views:

- **30-Day Volatility** → more **short-term**, sensitive to recent spikes, crashes, and news.
- **90-Day Volatility** → more **medium-term**, smoothing out some noise to show a more stable risk profile.

Higher volatility means:

- larger day-to-day moves,
- more uncertainty,
- both **bigger potential gains** and **larger potential losses**.

It is a **risk and instability metric**, not a measure of quality or trend direction (a stock can be volatile and go up or down).

---

### How It's Calculated
Conceptually, volatility is based on the **variability of returns** over a given period.

For each day, you can define a simple daily return like:

$$
r_t = \frac{P_t - P_{t-1}}{P_{t-1}}
$$

where:

- $P_t$ = closing price on day $t$,
- $P_{t-1}$ = closing price on day $t-1$.

Then, over a window of $N$ days (e.g. 30 or 90), you look at the **standard deviation** of these returns:

$$
\sigma_N = \sqrt{
\frac{1}{N - 1}
\sum_{t=1}^{N}
\left(r_t - \bar{r}\right)^2
}
$$

where $\bar{r}$ is the average return in that period.

In Portfolium:

- **30d Volatility** is computed from the recent ~30 days of price history.
- **90d Volatility** is computed from the recent ~90 days of price history.

The result is expressed as a **percentage** (e.g. `25%`, `45%`) and then classified into risk bands:

- **Low Volatility:** $v \le 20\%$  
- **Moderate Volatility:** $20\% < v \le 40\%$  
- **High Volatility:** $40\% < v \le 60\%$  
- **Very High Volatility:** $v > 60\%$

Where $v$ is the calculated volatility percentage.

These bands are used to generate the explanatory text below the card ("Low volatility", "Very high volatility", etc.).

---

### Example

#### Example 1 — 30d vs 90d diverge

- 30d volatility: $65\%$  
- 90d volatility: $35\%$

Interpretation:

- **30d:** $65\% > 60\%$ → **Very High**  
- **90d:** $20\% < 35\% \le 40\%$ → **Moderate**

This usually means:
- The last month has been chaotic (earnings, news, macro shocks).
- Over the last three months, things were **less** unstable on average.
- Recent risk has **spiked** compared to the medium-term baseline.

---

#### Example 2 — Both stable

- 30d volatility: $15\%$  
- 90d volatility: $18\%$

Both are $\le 20\%$ → **Low Volatility**.

This typically corresponds to:

- large, mature companies,
- defensive sectors (utilities, staples),
- relatively predictable price behaviour.

---

### When To Use It

Use volatility (30d & 90d) when you want to:

- **Assess risk per position**  
  Decide if a stock is "calm" or "wild" compared to the rest of your portfolio.
- **Compare similar stocks**  
  Two companies in the same sector can have very different volatility profiles.
- **Tune position sizing**  
  High-volatility names may deserve **smaller allocations** to keep portfolio risk under control.
- **Check recent regime changes**  
  A big gap between 30d and 90d indicates that **recent behaviour ≠ usual behaviour**.

Typical use cases:

- before opening a new position,
- when deciding which holdings to trim during stress,
- when reviewing whether your portfolio matches your risk tolerance.

---

### Notes & Limitations

- **Direction-agnostic**  
  Volatility doesn't say if the stock is going **up** or **down** – only how violently it moves.
- **Past ≠ future**  
  It is based on **historical** prices; a calm stock can become volatile after a surprise event (and vice versa).
- **Short-term noise vs structure**  
  30d can be heavily influenced by single events (earnings, news), while 90d smooths this but reacts slower to regime changes.
- **Data quality dependent**  
  Missing or sparse price data will reduce accuracy. Very illiquid or rarely traded stocks may show misleading volatility.
- **Not a standalone decision tool**  
  Volatility should be combined with fundamentals, valuation, and your own strategy.  
  A high-volatility stock is not automatically "bad", just **riskier and more unstable**.
