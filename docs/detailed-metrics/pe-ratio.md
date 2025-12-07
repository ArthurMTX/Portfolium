## P/E Ratio (Price-to-Earnings)

### What It Shows
The **P/E Ratio** compares a company's share price to its earnings per share (EPS).  
It answers the question:
> "How much are investors willing to pay for 1 dollar of this company's earnings?"

In Portfolium, the P/E Ratio helps you quickly understand:

- whether the stock is **expensive or cheap relative to its earnings**,
- how the market **values the company compared to peers**,  
- whether the business is **profit-generating or unprofitable**.

It is a **valuation metric**, not a measure of growth or financial health.

---

### How It's Calculated

Portfolium fetches the P/E Ratio directly from the data provider (`trailingPE` or `forwardPE` from yfinance).  
The underlying formula is:

$$
\text{P/E Ratio} = 
\frac{\text{Share Price}}{\text{Earnings Per Share (EPS)}}
$$

Where:

- **Share Price** = current market price  
- **EPS** = earnings per share (usually trailing 12 months, "TTM")

If earnings are positive:

- higher P/E ⇒ market expects more growth  
- lower P/E ⇒ priced cheaply relative to earnings

If earnings are negative:

- EPS < 0 ⇒ P/E becomes negative  
- Portfolium interprets this as **non-profitable**.

#### How Portfolium Interprets It

- $P/E < 0$ → The company is losing money (**Non-profitable**)  
- $P/E \ge 0$ → The company is making money (**Profitable**)

Portfolium does *not* attempt to judge whether a P/E is "too high" or "too low" across sectors, it only determines if the business is profitable.

---

### Examples

#### Example 1 — Profitable Company

- Share price: $150\$$
- EPS (trailing): $5\$$

$$
\text{P/E} = \frac{150}{5} = 30
$$

Portfolium classifies this as **Profitable**.

---

#### Example 2 — Loss-Making Company

- Share price: $20\$$
- EPS (trailing): $-2\$$

$$
\text{P/E} = \frac{20}{-2} = -10
$$

Portfolium classifies this as **Non-profitable**.

---

### When To Use It

The P/E Ratio is helpful when you want to:

- **Compare valuation** between similar companies in the same sector  
  (e.g., two semiconductor companies).
- **Gauge investor expectations**  
  High P/E often implies expected future growth.
- **Filter out non-profitable companies** for risk management.
- **Quickly sanity-check a stock** before diving deeper.

It is especially useful when:
- building value- or growth-focused portfolios,
- comparing multiple candidates for investment,
- analyzing earnings-based valuation.

---

### Notes & Limitations

- **P/E depends on earnings accounting**  
  EPS can fluctuate due to write-downs, tax adjustments, or one-time events.
- **Not meaningful for unprofitable companies**  
  Negative P/E offers no valuation insight beyond "the company is losing money."
- **Sector-dependent**  
  High-growth sectors naturally have higher P/Es; utilities often have lower ones.
- **Forward vs trailing P/E**  
  Portfolium uses whatever the provider offers; sometimes it will be forward-looking, sometimes trailing.

The P/E Ratio is best used as a **comparison tool**, not a standalone indicator of whether a stock is cheap or expensive.
