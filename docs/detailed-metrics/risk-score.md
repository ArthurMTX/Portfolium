## Risk Score

### What It Shows
The **Risk Score** is a composite indicator (from **0 to 100**) that summarizes the overall risk profile of an asset by combining:

- volatility (short- & medium-term),
- market sensitivity (beta),
- liquidity,
- profitability,
- leverage & solvency,
- growth stability,
- drawdowns and price behavior.

It serves as a **high-level risk indicator**, allowing you to compare assets at a glance and identify positions that may require more caution.

---

### How It's Calculated
Portfolium builds the Risk Score from a **weighted combination** of the most relevant risk-related metrics.

To make the computation transparent, we express it using a generalized formula:

### **Composite Formula**

We define each normalized component on a $0–100$ scale:

- $V_{30}$ : 30-day volatility score  
- $V_{90}$ : 90-day volatility score  
- $\beta_s$ : beta score  
- $L_s$ : liquidity score  
- $M_s$ : margin & profitability score  
- $G_s$ : growth stability score  
- $D_s$ : drawdown & price-behavior score  
- $B_s$ : balance-sheet strength score  

Each of these is transformed into a risk contribution.

The **Risk Score** is then:

$$
\text{RiskScore} =
w_V \cdot \underbrace{\left(0.6 V_{90} + 0.4 V_{30}\right)}_{\text{Volatility}} +
w_\beta \cdot \beta_s +
w_L \cdot (100 - L_s) +
w_M \cdot M_s +
w_G \cdot G_s +
w_D \cdot D_s +
w_B \cdot B_s
$$

Where:

- $w_V, w_\beta, w_L, w_M, w_G, w_D, w_B$ are normalized weights that sum to 1.
- Volatility uses a blend of short-term and medium-term instability.
- Liquidity reduces risk (illiquid = risky), hence $100 - L_s$.
- All other components increase the score when conditions deteriorate.

A typical weight allocation is:

| Component | Weight |
|----------|--------|
| Volatility | $w_V = 0.35$ |
| Beta | $w_\beta = 0.15$ |
| Liquidity | $w_L = 0.15$ |
| Margins & Profitability | $w_M = 0.10$ |
| Growth Stability | $w_G = 0.10$ |
| Drawdowns | $w_D = 0.10$ |
| Balance Sheet | $w_B = 0.05$ |

This produces a final value in the $[0, 100]$ range:

$$
\text{RiskScore}_{\text{final}} = \min\left(100,\ \max\left(0,\ \text{RiskScore}\right)\right)
$$

---

### Example

#### Example 1 — Risky Growth Stock

- $V_{30} = 55$ means high short-term volatility
- $V_{90} = 72$ means very high medium-term volatility
- $\beta_s = 80$ indicates strong market sensitivity
- $L_s = 30$ means low liquidity
- $M_s = 60$ indicates moderate profitability
- $G_s = 40$ means unstable growth
- $D_s = 70$ means significant drawdowns
- $B_s = 50$ indicates moderate balance-sheet strength

Plugging values:

$$
\text{Volatility} = 0.6(72) + 0.4(55) = 65.8
$$

$$
\text{RiskScore} =
0.35(65.8) +
0.15(80) +
0.15(100 - 30) +
0.10(60) +
0.10(40) +
0.10(70) +
0.05(50)
$$

$$
\text{RiskScore} = 81.1
$$

→ **High Risk (80–100)**

---

#### Example 2 — Stable Blue-Chip

- $V_{30} = 12$ means low short-term volatility
- $V_{90} = 18$ means low medium-term volatility
- $\beta_s = 25$ indicates low market sensitivity
- $L_s = 90$ means high liquidity
- $M_s = 15$ indicates strong profitability
- $G_s = 20$ means stable growth
- $D_s = 10$ means minimal drawdowns
- $B_s = 15$ indicates strong balance-sheet strength

Plugging values:

$$
\text{Volatility} = 0.6(18) + 0.4(12) = 15.6
$$

$$
\text{RiskScore} =
0.35(15.6) +
0.15(25) +
0.15(100 - 90) +
0.10(15) +
0.10(20) +
0.10(10) +
0.05(15)
$$

$$
\text{RiskScore} \approx 23.3
$$

→ **Low Risk (20–39)**

---

### When To Use It
The risk score is especially useful when you want to:

- quickly compare high-risk vs low-risk assets,
- identify dangerous outliers in your portfolio,
- avoid overweighting very volatile or leveraged stocks,
- evaluate whether a new position fits your risk tolerance.

It is most important during:

- portfolio rebalancing,
- screening speculative assets,
- market downturns,
- diversification planning.

---

### Notes & Limitations

- **Not predictive**  
  It does *not* forecast future crashes or rallies, only measures statistical and financial risk characteristics.

- **Data-dependent**  
  Missing or outdated fundamentals reduce score precision.

- **Best used comparatively**  
  Absolute values are less relevant than relative ranking between assets.

- **Backward-looking**  
  Uses historical volatility, margins, and fundamentals.

The Risk Score is a **powerful synthetic indicator**, but it should always be considered **alongside the individual metrics** that feed into it.
