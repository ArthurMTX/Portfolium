## Net Margin

### What It Shows
**Net Margin** (also known as *Net Profit Margin*) measures how much **actual profit** a company keeps from each dollar of revenue **after all expenses** have been paid.

It answers the question:
> "How much profit does the company make for every dollar of sales?"

It tells you:

- how efficiently the company converts sales into profit,  
- whether the business model is high-margin (software, luxury brands) or low-margin (retail, airlines),  
- how well management controls costs over time.

In Portfolium, Net Margin helps you quickly understand the **profitability quality** of a company, not just whether it grows.

---

### How It's Calculated

Net Margin is the ratio of **net income** to **total revenue**:

$$
\text{Net Margin (\%)} =
\frac{\text{Net Income}}{\text{Revenue}} \times 100
$$

Where:

- *Revenue* = total money earned from sales  
- *Net Income* = remaining profit after taxes, salaries, interest, depreciation, and all other expenses  

Portfolium retrieves the value directly from yfinance (`profitMargins`), then applies its conclusion scale:

- **Excellent**: $> 20\%$  
- **Good**: $> 10\%$  
- **Moderate**: $> 5\%$  
- **Low**: $> 0\%$  
- **Negative**: $\le 0\%$

These thresholds power the natural-language insight shown in the metric card.

---

### Example

#### Example 1 — High Net Margin (Excellent)

- Revenue: $\$10B$  
- Net Income: $\$2.5B$  

$$
\frac{2.5}{10} \times 100 = 25\%
$$

Portfolium classifies this as **Excellent**.

---

#### Example 2 — Low Net Margin (Low)

- Revenue: $\$5B$  
- Net Income: $\$50M$  

$$
\frac{0.05}{5} \times 100 = 1\%
$$

Portfolium classifies this as **Low**.

---

#### Example 3 — Negative Net Margin (Unprofitable)

- Revenue: $\$2B$  
- Net Income: -$\$200M$  

$$
\frac{-0.2}{2} \times 100 = -10\%
$$

Portfolium classifies this as **Negative**.

---

### When To Use It

Net Margin is useful when:

- comparing **profitability across similar companies**,  
- evaluating whether a company is **scalable** (margins rising over time),  
- understanding competitiveness within a **specific industry**,  
- analyzing **earnings quality**, not just growth.

Use it for:

- **Stock screening** — high-margin companies often enjoy durable advantages.  
- **Sector analysis** — software and pharma have higher margins; retail and airlines lower ones.  
- **Trend analysis** — growing margins often signal improving cost control or pricing power.

---

### Notes & Limitations

- **Industry-dependent**  
  A "low" margin may be normal in grocery stores but terrible in software.
- **Easily distorted**  
  One-off charges, asset write-downs, or tax adjustments can temporarily crash margins.
- **Revenue fluctuations matter**  
  If revenue suddenly drops while costs stay fixed, net margin can look much worse.
- **Provider-dependent**  
  Portfolium relies on yfinance. Missing or outdated financials may cause this metric to be unavailable.

Net Margin is most powerful when combined with **Operating Margin** and **Earnings Growth** to form a full picture of profitability quality.
