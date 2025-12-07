## Liquidity Score

### What It Shows
The **Liquidity Score** summarizes how easily a stock can be bought or sold **without impacting its market price**.  
It is a composite indicator designed to answer:
> "How liquid and tradeable is this stock right now?"

In Portfolium, the Liquidity Score helps you quickly identify:

- whether an asset has **strong trading activity**,  
- if it belongs to a **large, stable company** or a smaller, riskier one,  
- how easily you could **enter or exit a position** without slippage.

A high liquidity score generally means:

- tighter spreads,  
- more reliable pricing,  
- lower transaction risk.

---

### How It's Calculated

Portfolium uses a **weighted scoring model** (0–100) combining **Volume**, **Average Volume**, **Market Cap**, and **Price**.

#### 1. **Volume Score** — 50% weight

Portfolium compares today's trading volume to the average volume:

$$
\text{Volume Ratio} = \frac{\text{Volume}}{\text{Average Volume}}
$$

Buckets:

- $Ratio \ge 2$ → Score 100  
- $Ratio \ge 1$ → Score 80  
- $Ratio \ge 0.6$ → Score 60  
- $Ratio \ge 0.3$ → Score 30  
- $Ratio < 0.3$ → Score 10  

#### 2. **Market Cap Score** — 30% weight

Bigger companies are usually more liquid.

Buckets:

- $\ge 50B$ → Score 100  
- $\ge 10B$ → Score 80  
- $\ge 2B$ → Score 60  
- $\ge 300M$ → Score 30  
- $< 300M$ → Score 10  

#### 3. **Price Score** — 20% weight

Very low-priced stocks (penny stocks) tend to have worse liquidity.

Buckets:

- $\ge 20$ → Score 100  
- $\ge 5$ → Score 70  
- $\ge 1$ → Score 40  
- $< 1$ → Score 10  

---

### Final Score

The final Liquidity Score is the weighted sum:

$$
\text{Liquidity Score} = 
0.5 \times \text{Volume Score} \;+\; 
0.3 \times \text{Market Cap Score} \;+\; 
0.2 \times \text{Price Score}
$$

Portfolium rounds the result to one decimal place.

---

### Example

#### Example 1 — Highly Liquid Large Cap

- Volume: $12M$
- Average Volume: $8M$ → $Ratio = 1.5$ → Volume Score = 80  
- Market Cap: $80B$ → Market Cap Score = 100  
- Price: $140$ → Price Score = 100  

Liquidity Score:

$$
0.5(80) + 0.3(100) + 0.2(100) = 40 + 30 + 20 = \mathbf{90}
$$

Portfolium classifies this as **Excellent liquidity**.

---

### Example 2 — Illiquid Small Cap

- Volume: $200k$  
- Average Volume: $1.2M$ → $Ratio \approx 0.17$ → Volume Score = 10  
- Market Cap: $250M$ → Market Cap Score = 30  
- Price: $2$ → Price Score = 40  

Liquidity Score:

$$
0.5(10) + 0.3(30) + 0.2(40) = 5 + 9 + 8 = \mathbf{22}
$$

Portfolium classifies this as **Below-average liquidity**.

---

### When To Use It

Use the liquidity score to:

- **Avoid stocks that may be hard to exit**  
  Low-liquidity assets can cause slippage or delayed order execution.
- **Compare liquidity within a sector**  
  For example, choosing between two semiconductor stocks with similar fundamentals.
- **Manage risk in small-cap or micro-cap stocks**  
  Liquidity can drop quickly during downturns.
- **Screen out speculative penny stocks**  
  Low liquidity often correlates with manipulation or price instability.

Especially useful when:

- you trade frequently,  
- you invest in small caps,  
- you want to avoid thinly traded assets.

---

### Notes & Limitations

- **Volume spikes can temporarily inflate the score**  
  Earnings releases or news events can distort the metric.
- **Depends on external data**  
  Missing or stale volume/market-cap data may cause the score to be unavailable.
- **Not a quality metric**  
  A company can be high-quality but thinly traded (especially international stocks).
- **Price-driven**  
  A stock split or sudden drop in price affects the score even if fundamentals stay the same.

The Liquidity Score is best used as a **risk and execution indicator**, complementing other fundamental and volatility metrics.
