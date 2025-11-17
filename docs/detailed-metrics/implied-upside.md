## Implied Upside

### What It Shows
Implied Upside estimates **how much a stock could increase (or decrease)** based on analysts' average price targets.

It represents the **potential future return** implied by Wall Street forecasts.

In Portfolium, this gives you a clear idea of:

- whether analysts expect the stock to **rise**, **stay flat**, or **fall**,
- how optimistic or pessimistic the market consensus is,
- how a stock's current price compares to its estimated fair value.

It is an **expectation-based metric**, not a guarantee.

---

### How It's Calculated

Portfolium retrieves two values from the data provider (yfinance):

- `currentPrice`
- `targetMeanPrice` (average analyst price target)

The formula:

$$
\text{Implied Upside (\%)} =
\frac{\text{Target Mean Price} - \text{Current Price}}
     {\text{Current Price}}
\times 100
$$

Interpretation:

- **Positive value** → analysts expect the stock to go **up**.
- **Near zero** → analysts expect it to stay **flat**.
- **Negative value** → analysts expect it to **fall**.

Portfolium classifies the result using these bands:

- **High Upside:** $v > 30\%$
- **Moderate Upside:** $10\% < v \le 30\%$  
- **Limited Upside:** $0\% < v \le 10\%$  
- **Downside Expected:** $v \le 0\%$

Where `v` is the calculated Implied Upside percentage.

If the target price or current price is missing, the metric is marked **"Insufficient Data."**

---

### Examples

#### Example 1 — High Upside
- Current price: $\$100$  
- Target mean price: $\$140$  

$$
\frac{140 - 100}{100} \times 100 = 40\%
$$

Portfolium classifies this as **High Upside**.

---

#### Example 2 — Limited Upside
- Current price: $\$50$  
- Target mean price: $\$53$ 

$$
\frac{53 - 50}{50} \times 100 = 6\%
$$

Portfolium classifies this as **Limited Upside**.

---

#### Example 3 — Downside Expected
- Current price: $\$80$  
- Target mean price: $\$70$  

$$
\frac{70 - 80}{80} \times 100 = -12.5\%
$$

Portfolium classifies this as **Downside Expected**.

---

### When To Use It

Use implied upside when you want to:

- **Compare market expectations** across multiple stocks  
- **Check if analysts see growth potential** before buying  
- **Evaluate whether a stock is already "priced in"**  
- **Verify if your personal thesis aligns with external forecasts**  
- **Identify contrarian opportunities**  
  (e.g., strong fundamentals but negative analyst sentiment)

Implied upside is particularly helpful:

- when screening new opportunities,
- during valuation research,
- when reviewing whether a stock still fits your return expectations.

---

### Notes & Limitations

- **Based on analyst predictions**  
  These are opinions, not guarantees. Analysts can be biased or late.
- **Target prices change frequently**  
  After earnings or major news, price targets can shift overnight.
- **Does not reflect risk**  
  A stock with +50% upside may also carry very high volatility or business uncertainty.
- **Coverage varies**  
  Many small caps or foreign companies have few (or zero) analysts.
- **Short-term bias**  
  Analysts usually publish 12-month targets, not long-term intrinsic value.

Implied Upside is best used as **one input among many**, not a standalone investment decision driver.
