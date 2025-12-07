## Net Cash Position

### What It Shows
**Net Cash Position** indicates whether a company has more **cash** than **debt**, or vice-versa.

It answers a simple but crucial question:

> "If the company paid off all its debt today using its cash, what would be left?"

This metric is a direct measure of **financial strength**, **risk**, and **balance-sheet resilience**.

Portfolium classifies companies into:

- **Net Cash** → financially strong, flexible  
- **Neutral** → cash ≈ debt  
- **Net Debt** → leveraged, higher risk  

A positive net cash position generally signals stability, while a large net debt position can increase risk, especially during downturns.

---

### How It's Calculated

Portfolium uses the fundamental fields `totalCash` and `totalDebt` retrieved from yfinance.

The formula is:

$$
\text{Net Cash} = \text{Total Cash} - \text{Total Debt}
$$

This can result in:

- **Positive value** → excess cash (net cash)  
- **Zero** → equal cash and debt  
- **Negative value** → more debt than cash (net debt)

Portfolium classifies the result using:

- **Net Cash**: $\text{Net Cash} > 0$  
- **Neutral**: $\text{Net Cash} = 0$
- **Net Debt**: $\text{Net Cash} < 0$

This classification generates the interpretation text shown under the metric card.

---

### Example

#### Example 1 — Net Cash

- Total Cash: $\$12B$  
- Total Debt: $\$7B$  

$$
12 - 7 = 5\,\text{B}
$$

Result: **+5B → Net Cash**  
The company is financially strong with liquidity reserves.

---

#### Example 2 — Neutral Position

- Total Cash: $\$3.1B$  
- Total Debt: $\$3.1B$  

$$
3.1 - 3.1 = 0
$$

Result: **0 → Neutral**  
Cash perfectly offsets debt.

---

#### Example 3 — Net Debt

- Total Cash: $\$2B$  
- Total Debt: $\$9B$  

$$
2 - 9 = -7\,\text{B}
$$

Result: **–7B → Net Debt**  
This company carries significant leverage.

---

### When To Use It

Net Cash Position is useful for:

- **Evaluating financial risk**  
  Net debt often increases vulnerability during recessions or rising interest rates.
- **Comparing companies in the same industry**  
  Capital-intensive sectors (airlines, automakers) often operate with net debt; software companies often have net cash.
- **Assessing dividend and buyback safety**  
  Net-cash companies have more flexibility to return capital.
- **Understanding liquidity during stress**  
  Cash-rich companies survive downturns more easily.

Use it especially when:
- analyzing long-term resilience,
- studying balance-sheet quality,
- screening for safe/unsafe investments,
- reviewing companies with declining earnings (where cash reserves become critical).

---

### Notes & Limitations

- **Not a profitability metric**  
  Net cash doesn't reflect whether the business is profitable—only its financial structure.
- **Cash can fluctuate heavily**  
  Seasonal businesses may show temporarily inflated or depressed cash levels.
- **Debt maturity matters**  
  A company with large long-term debt may be safer than one with smaller but near-term debt.
- **Large cash piles are not always good**  
  Excess cash may indicate underinvestment or inefficient capital allocation.
- **Depends on data accuracy**  
  Portfolium relies on yfinance, which pulls from company filings and may lag slightly behind real-time updates.

Net Cash is most powerful when paired with:

- **Debt-to-Equity**,  
- **Current Ratio**,  
- **Quick Ratio**,  
- **Free Cash Flow**,  
- **Operating Margins**,  
- **Earnings Growth**.
