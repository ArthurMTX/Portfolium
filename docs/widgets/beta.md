# Beta & Market Correlation

The **Beta & Market Correlation** widget measures how **sensitive your portfolio is to the overall market**.  
It shows how much your portfolio tends to move when the market (represented by **SPY – S&P 500 ETF**) moves.

A higher beta means your portfolio tends to amplify market moves; a lower beta means it is more defensive.

---

## What It Shows

The widget displays:

- Your portfolio's **beta value** versus the market benchmark (SPY)  
- A **single number** with two decimals (e.g. `0.95`, `1.20`, `-0.30`)  
- Calculated over the selected period (default: **1 year**)

Typical interpretation:

- **β ≈ 1.00** – moves in line with the market  
- **β > 1.00** – more volatile than the market (amplifies moves)  
- **0 < β < 1.00** – less volatile, more defensive than the market  
- **β < 0** – tends to move **inversely** to the market  

This metric answers the question:  
> "How closely does my portfolio move with the broader market, and how strong is that relationship?"

---

## How It's Calculated

Beta compares **portfolio returns** to **market returns** and measures how much the portfolio tends to move for a 1% move in the market.

**Mathematical definition**

$$
\beta = \frac{\text{Cov}(R_p, R_m)}{\text{Var}(R_m)}
$$

Where:

- $R_p$ = portfolio return  
- $R_m$ = market return (SPY)  
- $\text{Cov}(R_p, R_m)$ = covariance between portfolio and market returns  
- $\text{Var}(R_m)$ = variance of market returns  

**Steps in Portfolium:**

1. Use **SPY (SPDR S&P 500 ETF)** as the market benchmark  
2. Fetch historical prices for SPY between the selected start and end dates  
3. Compute **daily returns** for both your portfolio and SPY  
4. Align days where **both** portfolio and benchmark returns are available  
5. Calculate:
    - The **mean** of aligned portfolio returns and benchmark returns  
    - The **covariance** between aligned portfolio and benchmark returns  
    - The **variance** of benchmark returns  
6. Compute beta as:

$$
\beta = \frac{\sum (R_{p,t} - \bar{R}_p)(R_{m,t} - \bar{R}_m)}{\sum (R_{m,t} - \bar{R}_m)^2}
$$

Additional notes:

- If there are **not enough aligned data points**, beta is shown as **N/A**  
- If benchmark variance is zero (no movement), beta cannot be computed and is **N/A**  
- The value is rounded to **three decimals internally**, then displayed with **two decimals** in the widget

---

## Example

Assume that over a given period:

- When the market (SPY) **goes up by 1%**, your portfolio **goes up by 1.3% on average**  
- When the market **goes down by 1%**, your portfolio **goes down by 1.3% on average**

Calculated beta:

- $\beta \approx 1.30$

The widget would display:

- **1.30**

Interpretation:

- Your portfolio is **30% more volatile than the market**, moving more aggressively in both directions.

---

## When To Use It

The Beta & Market Correlation widget is useful for:

- Understanding how **exposed** you are to broad market moves  
- Comparing your portfolio's **systematic risk** versus benchmarks  
- Deciding if your portfolio is **too aggressive** or **too defensive**  
- Complementing other risk metrics such as **Volatility**, **Max Drawdown**, and **Sharpe Ratio**

---

## Notes

- Uses **SPY (S&P 500 ETF)** as the market proxy, regardless of your base currency  
- Based on **daily returns** over the selected period (default: 1y)  
- A high beta implies strong sensitivity to the market; a low or negative beta suggests diversification benefits  
- Formatting follows your portfolio's display settings
