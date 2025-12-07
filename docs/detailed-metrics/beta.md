## Beta

### What It Shows
Beta measures how much a stock tends to **move relative to the overall market**.

It answers the question:  
> "If the market goes up or down by 1%, how much does this stock typically move?"

In Portfolium, Beta helps you understand:

- whether a stock is **more volatile** than the market (beta > 1),
- whether it is **more stable and defensive** (beta < 1),
- whether it tends to **move in the same direction** as the market,
- or even behaves **inversely** (negative beta).

It is fundamentally a **market correlation & sensitivity metric**, not a measure of quality or trend strength.

A high-beta stock exaggerates market movements.  
A low-beta stock dampens them.

---

### How It's Calculated
Beta is based on the **relationship between the stock's returns and the benchmark's returns**.

Portfolium selects the benchmark based on the stock's sector:

| Sector                  | Benchmark Ticker | Reasoning      |
|-------------------------|------------------|----------------|
| Basic Materials         | XLB              | Commodity-linked sector |
| Communication Services  | QQQ              | Tech-heavy    |
| Consumer Cyclical       | SPY              | Mix of sectors |
| Consumer Defensive      | XLP              | Solid staples  |
| Energy                  | XLE              | Cyclical sector specific |
| Financial Services      | SPY              | Banking usually follows broad market |
| Healthcare              | SPY              | Pharma is very S&P-correlated |
| Industrials             | SPY              | Global US market exposure |
| Real Estate             | XLRE             | Specific RE sector |
| Technology              | QQQ              | Tech-focused   |
| Utilities               | XLU              | Defensive sector |

The general Beta formula is:

$$
\beta = 
\frac{\text{Cov}(R_{\text{asset}},\, R_{\text{benchmark}})}
{\text{Var}(R_{\text{benchmark}})}
$$

Where:

- $R_{\text{asset}}$ = daily returns of the stock  
- $R_{\text{benchmark}}$ = daily returns of the sector-appropriate index  
- $\text{Cov}$ = covariance  
- $\text{Var}$ = variance  

Portfolium fetches:

- ~1 year of historical prices for both the stock and the benchmark,
- computes daily returns,
- aligns dates,
- filters out periods with insufficient data,
- and calculates Beta according to the formula above.

Then it is classified into categories:

- **High Beta:** $\beta > 1.5$  
- **Above Average:** $1.2 < \beta \le 1.5$  
- **Market-Like:** $0.8 \le \beta \le 1.2$  
- **Defensive:** $0.5 \le \beta < 0.8$  
- **Low Beta:** $0 \le \beta < 0.5$  
- **Negative Beta:** $\beta < 0$

These classifications drive the explanatory text below the card.

---

### Example

#### Example 1 — High-Beta Tech Stock

- Sector: Technology  
- Benchmark: QQQ  
- Calculated $\beta = 1.72$

Interpretation:

- Moves **much more wildly** than NASDAQ.
- Likely to outperform in strong bull markets.
- Likely to fall faster in corrections.

---

#### Example 2 — Defensive Consumer Staples

- Sector: Consumer Defensive  
- Benchmark: XLP  
- Calculated $\beta = 0.65$

Interpretation:

- Moves less than the market.
- Often performs better during downturns.
- Fits a **low-volatility**, defensive profile.

---

#### Example 3 — Negative Beta

- Calculated $\beta = -0.3$

Interpretation:

- Moves **opposite** the market on average.
- Rare among typical stocks.
- Sometimes observed in hedging assets (gold miners, certain commodities, etc.).

---

### When To Use It

Use Beta when you want to:

- **Understand how a stock responds to market swings**  
  Is it a shock absorber or an amplifier?
- **Manage portfolio volatility**  
  High-beta names require smaller weights if you're controlling downside risk.
- **Compare stocks within the same sector**  
  Beta helps distinguish calm vs. high-octane candidates.
- **Check how "market-dependent" a company is**  
  Some stocks move almost entirely with their index; others behave independently.

It's especially useful for:

- building factor-balanced portfolios,
- identifying overexposure to "high-beta risk",
- positioning around macro events (CPI, FOMC, earnings season).

---

### Notes & Limitations

- **Historical, not predictive**  
  Beta is backward-looking and regime-dependent.
- **Breaks during extreme events**  
  Correlations can shift dramatically in crashes and liquidity crises.
- **Not a measure of intrinsic risk**  
  Beta measures *market-related* volatility, not business fundamentals.
- **Sector selection matters**  
  Portfolium uses tailored benchmarks, which improves accuracy versus always using SPY.
- **Illiquid stocks produce noisy beta**  
  Thinly traded assets may show erratic or meaningless beta values.

Beta is best interpreted **in context**, alongside volatility, fundamentals, and your own risk tolerance.
