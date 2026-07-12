## Risk Score

### What It Shows
The **Risk Score** is a composite indicator (from **0 to 100**) that summarizes the overall risk profile of a position by combining several signals into a single number:

- recent price volatility (short- and medium-term),
- market sensitivity (Beta),
- how far the price is from its all-time high,
- how far the price is from the peak you personally experienced (your Personal Drawdown),
- short-term momentum versus the sector,
- long-term momentum versus the sector.

A higher score means the position carries **more combined risk** across these dimensions. It's a **relative, at-a-glance indicator** designed to let you compare positions quickly, not a precise probability of loss.

---

### How It's Calculated
Portfolium normalizes each underlying factor onto a common $0$–$1$ scale, then combines them using fixed weights.

#### 1. Normalizing each factor

| Factor | Normalization | Notes |
|---|---|---|
| Volatility | $\text{clamp}\left(\dfrac{\sigma}{80}, 0, 1\right)$ | Uses 30-day volatility if available, otherwise 90-day. $80\%$ annualized volatility is treated as "maximum risk." |
| Beta | $\text{clamp}\left(\dfrac{\beta - 0.8}{1.2}, 0, 1\right)$ | Beta of $0.8$ or below contributes no risk; Beta of $2.0$ or above saturates at maximum risk. |
| Distance to ATH | $\text{clamp}\left(\dfrac{\lvert d \rvert}{60}, 0, 1\right)$ | $d$ is the Distance to ATH percentage. Risk saturates once the price is $60\%$ or more below its all-time high. |
| Personal Drawdown | $\text{clamp}\left(\dfrac{\lvert pd \rvert}{50}, 0, 1\right)$ | $pd$ is the Personal Drawdown percentage. Saturates at a $50\%$ drop from your personal peak. |
| Short-term momentum (30d) | $\text{clamp}\left(\dfrac{-r_{30d}}{30}, 0, 1\right)$ | $r_{30d}$ is Relative Performance vs. sector over 30 days. A $30\%$ or worse underperformance is treated as maximum risk; outperformance contributes no risk. |
| Long-term momentum (1y) | $\text{clamp}\left(\dfrac{\lvert r_{1y} \rvert}{100}, 0, 1\right)$ | $r_{1y}$ is Relative Performance vs. sector over 1 year. Both **severe underperformance** and **extreme outperformance** (e.g. speculative mania) add risk. |

Where $\text{clamp}(x, 0, 1)$ keeps the value between $0$ and $1$. Any factor that is missing data is treated as **neutral** ($0.5$), so a lack of data doesn't push the score to an extreme.

#### 2. Weighting the factors

$$
\text{Risk}_{0-1} =
0.30\,V +
0.25\,\beta_n +
0.15\,D +
0.10\,PD +
0.15\,M_{30} +
0.05\,M_{1y}
$$

Where:

- $V$ = normalized volatility
- $\beta_n$ = normalized Beta
- $D$ = normalized distance to ATH
- $PD$ = normalized personal drawdown
- $M_{30}$ = normalized short-term momentum
- $M_{1y}$ = normalized long-term momentum

The weights are fixed and sum to $1.0$:

| Factor | Weight |
|---|---|
| Volatility | 30% |
| Beta | 25% |
| Distance to ATH | 15% |
| Personal Drawdown | 10% |
| Short-term momentum (30d) | 15% |
| Long-term momentum (1y) | 5% |

#### 3. Converting to the final 0–100 score

$$
\text{Risk Score} = \text{Risk}_{0-1} \times 100
$$

Rounded to one decimal place. If **no** underlying metric is available at all, the Risk Score is not shown.

Portfolium then classifies the score into bands:

- **Very Low:** $\text{score} < 20$
- **Low:** $20 \le \text{score} < 40$
- **Moderate:** $40 \le \text{score} < 60$
- **High:** $60 \le \text{score} < 80$
- **Extreme:** $\text{score} \ge 80$

---

### Example

#### Example 1 — High-Risk Growth Stock

- 30d volatility: $65\%$ → $V = \text{clamp}(65/80, 0, 1) = 0.8125$
- Beta: $1.9$ → $\beta_n = \text{clamp}((1.9-0.8)/1.2, 0, 1) = 0.9167$
- Distance to ATH: $-45\%$ → $D = \text{clamp}(45/60, 0, 1) = 0.75$
- Personal Drawdown: $-30\%$ → $PD = \text{clamp}(30/50, 0, 1) = 0.6$
- Relative performance 30d: $-18\%$ → $M_{30} = \text{clamp}(18/30, 0, 1) = 0.6$
- Relative performance 1y: $+70\%$ → $M_{1y} = \text{clamp}(70/100, 0, 1) = 0.7$

$$
\text{Risk}_{0-1} = 0.30(0.8125) + 0.25(0.9167) + 0.15(0.75) + 0.10(0.6) + 0.15(0.6) + 0.05(0.7)
$$

$$
\text{Risk}_{0-1} \approx 0.7594 \;\Rightarrow\; \text{Risk Score} \approx 75.9
$$

Portfolium classifies this as **High** risk.

---

#### Example 2 — Stable Blue-Chip

- 30d volatility: $14\%$ → $V = \text{clamp}(14/80, 0, 1) = 0.175$
- Beta: $0.9$ → $\beta_n = \text{clamp}((0.9-0.8)/1.2, 0, 1) \approx 0.083$
- Distance to ATH: $-6\%$ → $D = \text{clamp}(6/60, 0, 1) = 0.10$
- Personal Drawdown: $-4\%$ → $PD = \text{clamp}(4/50, 0, 1) = 0.08$
- Relative performance 30d: $+2\%$ → $M_{30} = \text{clamp}(-2/30, 0, 1) = 0$
- Relative performance 1y: $+8\%$ → $M_{1y} = \text{clamp}(8/100, 0, 1) = 0.08$

$$
\text{Risk}_{0-1} = 0.30(0.175) + 0.25(0.083) + 0.15(0.10) + 0.10(0.08) + 0.15(0) + 0.05(0.08)
$$

$$
\text{Risk}_{0-1} \approx 0.0938 \;\Rightarrow\; \text{Risk Score} \approx 9.4
$$

Portfolium classifies this as **Very Low** risk.

---

### When To Use It
The Risk Score is especially useful when you want to:

- quickly compare risk across positions in your portfolio,
- identify outliers that deserve closer attention or a smaller allocation,
- sanity-check a new position against your existing risk tolerance,
- see, at a glance, whether a position's risk comes mainly from volatility, market sensitivity, or price behavior.

It is most useful during:

- portfolio reviews and rebalancing,
- screening before opening a new position,
- market downturns, when distance-to-ATH and drawdown components tend to dominate the score.

---

### Notes & Limitations

- **Not predictive**  
  It does not forecast crashes or rallies — it only summarizes current statistical and price-behavior characteristics.
- **Missing data is treated as neutral**  
  If a factor (e.g. Beta or volatility) can't be computed, it contributes a neutral $0.5$ rather than being excluded, which can pull the score toward the middle for assets with sparse data.
- **Best used comparatively**  
  The absolute number matters less than how it ranks against your other holdings.
- **Backward-looking**  
  Every input (volatility, Beta, drawdowns, relative performance) is based on historical prices.
- **Not a fundamentals or valuation score**  
  Profitability, margins, and balance-sheet health are not part of this calculation — pair the Risk Score with those metrics for a fuller picture.

The Risk Score is a **powerful synthetic indicator**, but it should always be read alongside the individual metrics that feed into it — Volatility, Beta, Distance to ATH, Personal Drawdown, and Relative Performance.
