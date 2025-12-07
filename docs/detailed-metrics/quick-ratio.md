## Quick Ratio

### What It Shows
The **Quick Ratio** (also called the **Acid-Test Ratio**) measures a company's ability to meet its **short-term liabilities using only its most liquid assets**, *excluding inventory*.

In simple terms:

> "If the company had to pay all its upcoming bills **right now**, could it do so without selling inventory?"

It is a **stricter liquidity test** than the Current Ratio and is especially valuable for businesses where inventory is slow-moving or hard to convert into cash.

Portfolium classifies the Quick Ratio into:

- **Excellent**
- **Adequate**
- **Weak**
- **Very Weak**

based on the company's capacity to handle immediate financial pressure.

---

### How It's Calculated

Portfolium fetches the value directly from yfinance (`quickRatio`).  
The accounting formula behind it is:

$$
\text{Quick Ratio} =
\frac{
\text{Current Assets} - \text{Inventory}
}{
\text{Current Liabilities}
}
$$

This ratio focuses only on assets that can be converted to cash quickly:

- cash & cash equivalents  
- marketable securities  
- accounts receivable  

Portfolium interprets this value using the following bands:

- **Excellent:** $\text{QR} > 1.5$
- **Adequate:** $1 \le \text{QR} \le 1.5$
- **Weak:** $0.5 \le \text{QR} < 1$
- **Very Weak:** $\text{QR} < 0.5$

These thresholds are used to generate the liquidity conclusion displayed in the metric card.

---

### Examples

#### Example 1 — Excellent Liquidity

- Quick Assets (cash, receivables): $\$9B$  
- Current Liabilities: $\$5B$  

$$
\frac{9}{5} = 1.8
$$

Portfolium classifies this as **Excellent**.

---

#### Example 2 — Adequate Liquidity

- Quick Assets: $\$6B$  
- Current Liabilities: $\$5.5B$  

$$
\frac{6}{5.5} \approx 1.09
$$

Portfolium classifies this as **Adequate**.

---

#### Example 3 — Weak Liquidity

- Quick Assets: $\$4B$  
- Current Liabilities: $\$6B$  

$$
\frac{4}{6} \approx 0.67
$$

Portfolium classifies this as **Weak**.

---

#### Example 4 — Very Weak Liquidity

- Quick Assets: $\$1B$  
- Current Liabilities: $\$3B$  

$$
\frac{1}{3} \approx 0.33
$$

Portfolium classifies this as **Very Weak**.

---

### When To Use It

Use the Quick Ratio when you want to:

- **Assess true immediate liquidity**
- **Evaluate companies with large inventories**  
  (retailers, manufacturers, car dealers)
- **Understand short-term financial stress**
- **Compare liquidity between competitors**
- **Check for bankruptcy risk signals**
- **Validate dividend safety** (cash-rich companies are safer)

It is especially important in industries where inventory:

- takes long to sell,
- is expensive to store,
- can become obsolete (electronics, fashion).

---

### Notes & Limitations

- **More conservative than the Current Ratio**  
  Because it excludes inventory, it may look "too harsh" on some companies.
- **Industry differences matter**  
  A Quick Ratio of 0.7 is acceptable for some retailers but dangerous for tech companies.
- **Receivables quality varies**  
  High receivables don't always mean cash will actually come in.
- **One-time events distort the metric**  
  Temporary spikes in payables or seasonal inventory cycles may create misleading signals.
- **Should be paired with other metrics**  
  Best used with:
    - Current Ratio  
    - Net Cash Position  
    - Debt-to-Equity  
    - Operating CashFlow   

Together, they give a full picture of short-term financial resilience.
