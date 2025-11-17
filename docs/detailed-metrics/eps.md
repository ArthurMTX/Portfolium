## Earnings Per Share (EPS)

### What It Shows
**Earnings Per Share (EPS)** represents how much **profit the company generates for each outstanding share**.  
It answers the question:
> "If the company distributed all its profits equally, how much would each share receive?"

In Portfolium, EPS helps you quickly understand:

- whether the company is **profitable**,  
- how stable or volatile its earnings might be,  
- how healthy its core business operations are.

EPS is a **profitability metric**, not a valuation metric.

---

### How It's Calculated

EPS is computed by dividing the company's net earnings by the number of shares outstanding:

$$
\text{EPS} = \frac{\text{Net Income}}{\text{Shares Outstanding}}
$$

A higher EPS generally indicates stronger profitability.

Portfolium does **not** compute EPS manually.  
It pulls the value directly from the data provider (`trailingEps` when available).

#### How Portfolium Interprets It

Based on your EPS value, Portfolium classifies the stock into profitability buckets:

- $EPS > 0.5$ → **Profitable**  
- $-0.5 \le EPS \le 0.5$ → **Break-even / neutral**  
- $-10 < EPS < -0.5$ → **Negative earnings**  
- $-50 < EPS \le -10$ → **Heavy loss**  
- $EPS \le -50$ → **Severe loss**
This classification powers the conclusion shown under the card.

---

### Examples

#### Example 1 — Strongly Profitable
- Net income: $4\,\text{B}$  
- Shares outstanding: $1\,\text{B}$

$$
\text{EPS} = \frac{4\,\text{B}}{1\,\text{B}} = 4
$$

Portfolium classifies this as **Profitable**.

---

#### Example 2 — Break-Even
- Net income: $120\,\text{M}$  
- Shares outstanding: $300\,\text{M}$

$$
\text{EPS} = \frac{120\,\text{M}}{300\,\text{M}} = 0.4
$$

Portfolium classifies this as **Break-even**.

---

#### Example 3 — Heavy Loss
- Net income: $-3\,\text{B}$  
- Shares outstanding: $100\,\text{M}$

$$
\text{EPS} = \frac{-3\,\text{B}}{100\,\text{M}} = -30
$$

Portfolium classifies this as **Heavy loss**.

---

### When To Use It

EPS is helpful for:

- **Assessing profitability** at a glance.  
- **Comparing earning power** of companies within the same sector.  
- **Detecting deteriorating or improving earnings trends.**  
- **Understanding whether a valuation ratio (like P/E) makes sense.**

It is especially useful when:

- screening for profitable businesses,  
- analyzing earnings-based metrics (P/E, PEG),  
- evaluating how efficiently a company turns revenue into profit.

---

### Notes & Limitations

- **Heavily affected by accounting rules**  
  EPS can change due to tax adjustments, write-offs, or one-time charges.
- **Share count changes affect EPS**  
  Buybacks increase EPS; dilution decreases it.
- **Not comparable across sectors**  
  Capital-intensive industries naturally have different EPS profiles than software companies.
- **EPS doesn't show cash flow health**  
  A company may report positive EPS but still have weak cash flow.

EPS is best used as a **profitability indicator**, ideally combined with other metrics such as margins, revenue growth, or return on equity.
