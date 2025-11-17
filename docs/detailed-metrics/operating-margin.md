## Operating Margin

### What It Shows
**Operating Margin** measures how much profit a company generates from its core operations **before interest, taxes, and non-operating items**.

It answers the question:
> "How efficiently does the company turn revenue into operating profit?"

It reflects:

- how efficiently the company runs its day-to-day business,  
- how strong its pricing power is,  
- how well it controls production, labor, and administrative costs.

Compared to Net Margin (which includes everything), Operating Margin focuses solely on **operational quality**, making it one of the best indicators of a company's real business strength.

---

### How It's Calculated

Operating Margin uses **operating income** (EBIT) rather than net income:

$$
\text{Operating Margin (\%)} =
\frac{\text{Operating Income}}{\text{Revenue}} \times 100
$$

Where:

- *Operating Income (EBIT)* = profit after operating expenses (cost of goods, salaries, SG&A, R&D, logistics, etc.)  
- *Revenue* = total sales  

Portfolium retrieves this metric from yfinance (`operatingMargins`) and classifies it according to:

- **Highly Efficient**: $> 25\%$  
- **Good**: $> 10\%$  
- **Low**: $> 0\%$  
- **Negative**: $\le 0\%$

These thresholds drive the natural-language explanation under the metric.

---

### Example

#### Example 1 — Highly Efficient

- Revenue: $\$8B$  
- Operating Income: $\$2.4B$  

$$
\frac{2.4}{8} \times 100 = 30\%
$$

Portfolium classifies this as **Highly Efficient**.

---

#### Example 2 — Good Margin

- Revenue: $\$6B$  
- Operating Income: $\$900M$  

$$
\frac{0.9}{6} \times 100 = 15\%
$$

Portfolium classifies this as **Good**.

---

#### Example 3 — Negative Margin (Unprofitable Core Business)

- Revenue: $\$3B$  
- Operating Income: -$\$150M$  

$$
\frac{-0.15}{3} \times 100 = -5\%
$$

Portfolium classifies this as **Negative**.

---

### When To Use It

Operating Margin is particularly useful when:

- analyzing **business efficiency** independently of taxes and financing,  
- comparing companies within the **same sector**,  
- evaluating **pricing power** (luxury or software companies often have high operating margins),  
- checking whether revenue growth is translating into **profitable growth**,  
- detecting cost-structure issues early.

Use it to answer questions like:

- "Is this company efficient at turning sales into operating profit?"  
- "Does this business scale well?"  
- "Is the company improving its cost discipline over time?"

---

### Notes & Limitations

- **Highly sector-dependent**  
  Software providers often exceed 25%+, while airlines and retail chains operate on thin margins.
- **Can be distorted by accounting choices**  
  Capitalization of R&D, depreciation schedules, or restructuring charges may affect comparability.
- **Does not include interest or taxes**  
  A company may have strong operations but still lose money due to debt.
- **Relies on reported data**  
  Portfolium depends on yfinance fundamentals, which may lag or omit information.

Operating Margin works best when combined with **Net Margin**, **Earnings Growth**, and **Return on Equity** for a full view of profitability and business quality.
