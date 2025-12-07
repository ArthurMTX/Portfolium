# R-Squared (R² vs Benchmark)

The **R-Squared (R²)** widget measures **how much of your portfolio's movements can be explained by the benchmark's movements**.  
It is based on the **correlation** between your portfolio and the benchmark (by default **SPY - S&P 500**) and expressed as a **percentage between 0% and 100%**.

A higher R² means your portfolio behaves more like the benchmark; a lower R² means it moves more independently.

---

## What It Shows

The widget displays:

- **R-Squared (%)** between your portfolio and the selected benchmark  
- A single value, e.g. **85.40%**  
- Calculated over the selected period (default: **1 year**)  
- A subtitle that explains the interpretation relative to the benchmark

Typical interpretation:

- **0–40%** – low relationship: portfolio is largely independent from the benchmark  
- **40–70%** – moderate relationship  
- **70–100%** – strong relationship: portfolio closely tracks the benchmark  

This metric answers the question:  
> "To what extent does the benchmark explain my portfolio's returns?"

---

## How It's Calculated

R-Squared is derived from the **correlation** between your portfolio and the benchmark:

1. Portfolium calculates **daily performance series** for:
   - Your **portfolio**
   - The **benchmark** (e.g. SPY)

2. It aligns both time series by date and computes the **correlation coefficient** $\rho$ between the two return series.

3. R-Squared is then:

$$
R^2 = \rho^2 \times 100
$$

Where:

- $\rho$ = correlation between portfolio and benchmark returns  
- $R^2$ is expressed as a **percentage** from 0 to 100  

Under the hood:

- If the correlation is `corr`, $R^2 = corr^2 \times 100$

If the correlation cannot be computed (e.g., insufficient data, zero variance):

- R-Squared is set to **0** or the widget may show **N/A** depending on data availability.

---

## Example

Imagine that, over the last year:

- The correlation between your portfolio and SPY is **0.92**

R-Squared:

$$
R^2 = 0.92^2 \times 100 = 0.8464 \times 100 = 84.64\%
$$

The widget would display:

- **84.64%**

Interpretation:

- About **85% of your portfolio's return variation** can be explained by movements in the benchmark (SPY).  
- Your portfolio behaves very similarly to the index.

---

## When To Use It

The R-Squared widget is useful for:

- Understanding how **benchmark-driven** your portfolio really is  
- Checking whether an allegedly "active" portfolio is actually just **closely tracking an index**  
- Evaluating diversification: a **low R²** can indicate more **idiosyncratic** or uncorrelated bets  
- Complementing **Alpha** and **Beta**:
    - High **alpha** with **high R²** → strong outperformance while still benchmark-like  
    - High **alpha** with **low R²** → outperformance coming from differentiated positions  

---

## Notes

- Default benchmark is **SPY (S&P 500)**, but the underlying system supports other symbols  
- R-Squared is based on **performance series**, not raw prices  
- Values range from **0%** (no linear relationship) to **100%** (perfect linear relationship)  
- A **high R²** does *not* mean good performance by itself, it only measures how closely you track the benchmark  
- Formatting follows your portfolio's display settings (percentage with two decimals)
