## Revenue Growth

### What It Shows
**Revenue Growth** measures how quickly a company's total sales are increasing (or decreasing) over time.

It answers the question: 
> "Is the company growing its top-line revenue?"

In Portfolium, it helps you understand:

- whether the company is expanding its business,  
- if demand for its products/services is rising,  
- whether it behaves like a mature slow-growth firm or a high-growth disruptor,  
- the long-term sustainability of its business model.

Revenue growth is a **top-line metric**, it focuses purely on the company's ability to generate more sales, before costs or profits.

---

### How It's Calculated

Portfolium retrieves the `revenueGrowth` value directly from the data provider (yfinance), which already computes growth based on reported financial statements.

The general formula behind revenue growth is:

$$
\text{Revenue Growth (\%)} = 
\frac{\text{Revenue}_{t} - \text{Revenue}_{t-1}}
     {\text{Revenue}_{t-1}} \times 100
$$

Where:

- $\text{Revenue}_{t}$ = most recent annual or quarterly revenue  
- $\text{Revenue}_{t-1}$ = prior revenue period

Portfolium multiplies this value by 100 to convert it into a percentage.

To generate conclusions under the metric card, Portfolium classifies the growth rate into categories:

- **Hyper Growth**: $> 30\%$  
- **Strong Growth**: $> 15\%$  
- **Moderate Growth**: $> 5\%$  
- **Low Growth**: $> 0\%$  
- **Declining**: $\le 0\%$

---

### Example

#### Example 1 — Strong Revenue Growth

- Last year revenue: $\$10B$  
- This year revenue: $\$12.2B$  

$$
\frac{12.2 - 10}{10} \times 100 = 22\%
$$

Portfolium classifies this as **Strong Growth**.

---

#### Example 2 — Declining Revenue

- Last year: $\$800M$  
- This year: $\$760M$  

$$
\frac{760 - 800}{800} \times 100 = -5\%
$$

Portfolium classifies this as **Declining**.

---

### When To Use It

Revenue growth is especially useful when:

- analysing **tech, SaaS, or high-growth companies**,  
- comparing companies in **fast-evolving markets**,  
- identifying early-stage companies transitioning toward profitability,  
- checking whether a company's business is expanding or stagnating.

Use it to:

- confirm long-term growth trends,  
- filter companies with accelerating or decelerating sales,  
- compare growth dynamics inside a sector,  
- assess the company's ability to gain market share.

It's particularly valuable for:

- growth investors,  
- momentum traders,  
- sector rotation strategies.

---

### Notes & Limitations

- **Revenue growth does not mean profit growth**  
  A company can grow sales while still losing money.
- **Quarterly growth can be volatile**  
  Seasonality, one-off events, and product launches can distort the trend.
- **Negative revenue growth is not always bad**  
  Restructuring, divestitures, or currency effects may cause temporary declines.
- **Industry context matters**  
  A 5% growth rate might be amazing in utilities but weak in cloud computing.
- **Depends on external data (yfinance)**  
  Missing or delayed fundamentals may cause temporary gaps.

Revenue Growth is best used as a **directional growth indicator** alongside profitability and margin metrics.
