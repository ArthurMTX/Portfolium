## Analyst Consensus

### What It Shows
Analyst Consensus summarizes how Wall Street analysts currently rate a stock.  
It gives you a **quick snapshot of the professional sentiment** surrounding the company.

It answers the question:
> "Based on expert opinions, is this stock expected to outperform, meet, or underperform the market?"

Portfolium expresses this using clear categories:

- **Strong Buy**
- **Buy**
- **Hold**
- **Sell**
- **Strong Sell**

These ratings are derived from analysts' collective evaluations of the stock's expected performance.

This metric is not about whether a company is "good," but about how **market experts** view its short-term and mid-term prospects.

---

### How It's Calculated

Portfolium fetches two key values from the data provider (`yfinance.info`):

- `recommendationKey` (text label)
- `recommendationMean` (numeric average rating)

The numeric rating is the core value used:

$$
\text{Analyst Rating Mean} = \frac{
\sum \text{Analyst Ratings}
}{
\text{Number of Analysts}
}
$$

Ratings follow the standard 1–5 scale:

| Numeric Value | Meaning |
|---------------|---------|
| 1.0 | Strong Buy |
| 2.0 | Buy |
| 3.0 | Hold |
| 4.0 | Sell |
| 5.0 | Strong Sell |

Portfolium uses **threshold bands** to convert `recommendationMean` into a readable conclusion:

- **Strong Buy:** $v \le 1.5$  
- **Buy:** $1.5 < v \le 2.5$  
- **Hold:** $2.5 < v \le 3.5$  
- **Sell:** $3.5 < v \le 4.5$  
- **Strong Sell:** $v > 4.5$  

Where `v` is the `recommendationMean` value.

If the value is missing or invalid, Portfolium displays **"Insufficient Data."**

---

### Examples

#### Example 1 — Strong Buy
- Ratings: $1, 1, 1, 2$  
- Mean: $\frac{1 + 1 + 1 + 2}{4} = 1.25$

Portfolium classifies this as **Strong Buy**.

---

#### Example 2 — Hold
- Ratings: 3, 3, 4$  
- Mean: $\frac{3 + 3 + 4}{3} = 3.33$

Portfolium classifies this as **Hold**.

---

#### Example 3 — Sell
- Ratings: $4, 5, 4, 3$  
- Mean: $\frac{4 + 5 + 4 + 3}{4} = 4.00$

Portfolium classifies this as **Sell**.

---

### When To Use It

Use Analyst Consensus to:

- **Gauge market sentiment** quickly  
  (Is the stock hyped? Neutral? Out of favor?)
- **Compare analyst views across your portfolio**
- **Spot contrarian opportunities**  
  (e.g., high-quality companies temporarily rated "Sell")
- **Understand the expected performance trend**
- **Identify stocks with strong institutional confidence**

This metric is particularly useful when:

- considering new positions,
- validating your thesis,
- checking if a stock's momentum aligns with professional expectations.

---

### Notes & Limitations

- **Not a prediction**  
  Analysts often revise ratings, and they frequently get things wrong.
- **Coverage varies**  
  Small caps and foreign stocks often have **few or zero analysts**, making the metric unreliable.
- **Herd behavior exists**  
  Analysts sometimes cluster around similar opinions to avoid standing out.
- **Lagging indicator**  
  Consensus often reacts *after* major news.
- **Should be combined with fundamentals**  
  Use it alongside:
  
  - earnings trends  
  - margins  
  - revenue growth  
  - valuation metrics  

Analyst Consensus is best treated as a **sentiment indicator**, not a standalone investment signal.
