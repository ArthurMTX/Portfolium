## Current Ratio

### What It Shows
The **Current Ratio** measures a company's ability to **meet its short-term financial obligations** using its **short-term assets**.

In other words:

> "Can the company pay its bills over the next 12 months?"

It is a measure of **short-term liquidity** and **financial health**, especially important for evaluating operational stability, cash management, and bankruptcy risk.

Portfolium categorizes Current Ratio into:

- **Very Strong**
- **Healthy**
- **Tight**
- **Weak**

based on the company's liquidity position.

---

### How It's Calculated

Portfolium fetches the value from the yfinance field `currentRatio`.  
The underlying accounting formula is:

$$
\text{Current Ratio} =
\frac{\text{Current Assets}}{\text{Current Liabilities}}
$$

Where:

- **Current Assets** include cash, receivables, inventory, etc.
- **Current Liabilities** include accounts payable, short-term debt, taxes owed, etc.

Portfolium interprets the value using the following thresholds:

- **Very Strong:** $\text{CR} > 2$
- **Healthy:** $1 \le \text{CR} \le 2$
- **Tight:** $0.8 \le \text{CR} < 1$
- **Weak:** $\text{CR} < 0.8$

These categories generate the descriptive conclusion beneath the metric card.

---

### Examples

#### Example 1 — Very Strong Liquidity

- Current Assets: $\$10B$  
- Current Liabilities: $\$4B$  

$$
\frac{10}{4} = 2.5
$$

Portfolium classifies this as **Very Strong**.

---

#### Example 2 — Healthy Liquidity

- Current Assets: $\$6B$  
- Current Liabilities: $\$5B$  

$$
\frac{6}{5} = 1.2
$$

Portfolium classifies this as **Healthy**.

---

#### Example 3 — Tight Liquidity

- Current Assets: $\$8B$      
- Current Liabilities: $\$9B$  

$$
\frac{8}{9} \approx 0.89
$$

Portfolium classifies this as **Tight**.

---

#### Example 4 — Weak Liquidity

- Current Assets: $\$3B$  
- Current Liabilities: $\$5B$  

$$
\frac{3}{5} = 0.6
$$

Portfolium classifies this as **Weak**.

---

### When To Use It

Use the Current Ratio to:

- **Evaluate short-term financial stability**
- **Identify liquidity risks**
- **Compare companies within the same industry**
- **Assess whether a company can survive a downturn**
- **Analyze creditworthiness**, especially for dividend safety or debt repayment

It is particularly useful when analyzing:

- retailers (where inventory levels matter),
- manufacturing companies,
- highly seasonal businesses,
- companies with large working-capital cycles.

---

### Notes & Limitations

- **Industry-specific**  
  "Good" ratio levels vary by sector. Retailers often operate with lower ratios due to fast inventory turnover, while tech companies may hold more cash.
- **Too high is not always good**  
  A very high current ratio may indicate **inefficient asset use** (e.g., too much idle cash or bloated inventory).
- **Includes inventory**, which may not be liquid  
  Slow-moving inventory can inflate Current Assets artificially.
- **Point-in-time snapshot**  
  Liquidity changes quickly. Quarterly data may miss temporary risks.
- **Better when combined with Quick Ratio**  
  The Quick Ratio removes inventory to measure only *highly liquid* assets.

Use the Current Ratio together with:

- **Quick Ratio**
- **Net Cash Position**
- **Debt-to-Equity**
- **Operating Cash Flow**

for a more complete picture of short-term financial strength.
