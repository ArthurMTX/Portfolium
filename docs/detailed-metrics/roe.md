## Return on Equity (ROE)

### What It Shows
**Return on Equity (ROE)** measures how efficiently a company generates profit **from the shareholders' invested capital**.

It answers a fundamental question:

> "For every dollar of equity, how much profit does the company produce?"

ROE reflects:

- management efficiency,  
- business quality,  
- profitability relative to the company's size,  
- how effectively a company reinvests to grow.

It is one of the most widely used profitability metrics in finance.

---

### How It's Calculated

ROE uses **net income** and **shareholders' equity**:

$$
\text{ROE (\%)} = 
\frac{\text{Net Income}}{\text{Shareholders' Equity}} \times 100
$$

Where:

- *Net Income* = profit after taxes and all expenses  
- *Shareholders' Equity* = assets − liabilities  

Portfolium retrieves ROE from yfinance (`returnOnEquity`) and converts it into a percentage.

Classification used by Portfolium:

- **Excellent**: $> 20\%$  
- **Healthy**: $> 10\%$  
- **Moderate**: $> 5\%$  
- **Low**: $> 0\%$  
- **Negative**: $\le 0\%$

These categories generate the interpretation text under the card.

---

### Example

#### Example 1 — Excellent ROE

- Net Income: $\$3.2B$  
- Equity: $\$14B$  

$$
\frac{3.2}{14} \times 100 = 22.85\%
$$

Portfolium classifies this as **Excellent**.

---

#### Example 2 — Moderate ROE

- Net Income: $\$500M$  
- Equity: $\$8B$  

$$
\frac{0.5}{8} \times 100 = 6.25\%
$$

Portfolium classifies this as **Moderate**.

---

#### Example 3 — Negative ROE

- Net Income: -$\$400M$  
- Equity: $\$5B$  

$$
\frac{-0.4}{5} \times 100 = -8\%
$$

Portfolium classifies this as **Negative**.

---

### When To Use It

ROE is particularly valuable when:

- assessing **management execution** and capital efficiency,  
- comparing profitability between companies of very different sizes,  
- analyzing **long-term compounders** (high ROE + reinvestment capacity),  
- evaluating whether a company creates real shareholder value.  

Use ROE to answer:

- "Is this company efficient at turning equity into profit?"  
- "Is management allocating capital wisely?"  
- "Is this business a potential long-term compounder?"  

High and stable ROE is often a hallmark of strong brands, high-margin software, and durable competitive advantages.

---

### Notes & Limitations

- **Equity can be artificially low**  
  Companies with large buybacks may show inflated ROE due to reduced equity.
- **High ROE ≠ always good**  
  Excessive leverage can create high ROE while adding significant risk.
- **Not ideal for banks or financial institutions**  
  Their balance sheets behave differently and require additional context.
- **Depends on accounting practices**  
  Asset write-downs, goodwill, and intangible assets may distort equity values.

For best results, pair ROE with metrics like **Operating Margin**, **Net Margin**, **Debt-to-Equity**, and **Earnings Growth** to understand the full profitability picture.
