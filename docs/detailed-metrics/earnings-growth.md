## Earnings Growth

### What It Shows
**Earnings Growth** measures how quickly a company's *net income* (its actual profit) is increasing or decreasing over time.

While revenue tells you whether the company is selling more, **earnings show whether those sales are turning into real profits**.

It answers the question:
> "Is the company growing its bottom-line earnings?"

In Portfolium, Earnings Growth helps you understand:

- if profitability is accelerating or weakening,  
- whether the company is scaling efficiently,  
- how well management controls costs,  
- if the business model is becoming more or less profitable over time.

It is one of the most important forward-looking indicators of financial health.

---

### How It's Calculated

Portfolium retrieves the `earningsGrowth` field directly from yfinance, based on recent financial statements.

The underlying formula is:

$$
\text{Earnings Growth (\%)} = 
\frac{\text{Net Income}_{t} - \text{Net Income}_{t-1}}
     {\text{Net Income}_{t-1}} \times 100
$$

Where:

- $\text{Net Income}_{t}$ = latest earnings period (quarter or year)  
- $\text{Net Income}_{t-1}$ = prior period earnings  

Portfolium converts the value into a percentage and classifies it using the following thresholds:

- **Exceptional**: $> 30\%$  
- **Healthy**: $> 10\%$  
- **Mild**: $> 0\%$  
- **Declining**: $\le 0\%$

These categories generate the natural-language conclusion under the metric card.

---

### Example

#### Example 1 — Healthy Earnings Growth

- Last year earnings: $\$2.0B$  
- This year earnings: $\$2.3B$  

$$
\frac{2.3 - 2.0}{2.0} \times 100 = 15\%
$$

Portfolium classifies this as **Healthy**.

---

#### Example 2 — Declining Earnings

- Last year earnings: $\$500M$
- This year earnings: $\$350M$  

$$
\frac{350 - 500}{500} \times 100 = -30\%
$$

Portfolium classifies this as **Declining**.

---

### When To Use It

Earnings Growth is particularly useful when:

- evaluating **profitability trends** over time,  
- comparing companies in sectors where margins matter (software, finance, consumer brands),  
- spotting turnarounds (companies returning to profitability),  
- understanding whether rising revenue is translating into sustainable profits.

Use it for:

- **Long-term investing** — consistent positive earnings growth is a hallmark of strong businesses.  
- **Quality investing** — profitable companies with expanding margins tend to outperform.  
- **Fundamental screening** — to filter for fast-growing or stabilizing companies.  

---

### Notes & Limitations

- **Earnings can be more volatile than revenue**  
  One-time charges, tax changes, or accounting adjustments can distort results.
- **Declining earnings aren't always bad**  
  High-growth companies sometimes reinvest heavily, temporarily reducing profits.
- **Sector differences matter**  
  10% growth in banking is strong; in cloud software, it may be considered weak.
- **External data dependency**  
  Portfolium relies on yfinance. Missing or inconsistent earnings data can impact availability.

Earnings Growth is best interpreted together with revenue growth and margin metrics to get a full picture of a company's financial trajectory.
