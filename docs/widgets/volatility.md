# Volatility

The **Volatility** widget measures how much your portfolio's value fluctuates over time.  
It represents the **annualized standard deviation of daily returns**, showing how "risky" or "unstable" your portfolio is.

Higher volatility means larger price swings — both upward and downward.

---

## What It Shows

The widget displays:

- Your portfolio's **annualized volatility (%)** over the selected period (default: **1 year**)  
- A single numeric value, e.g., **18.50%**  
- Higher values indicate **greater fluctuations** in daily performance

Rule-of-thumb interpretation:

- **< 10%** – low volatility  
- **10–20%** – moderate volatility  
- **> 20%** – high volatility  

This metric answers the question:  
> "How much does my portfolio typically move day to day?"

---

## How It's Calculated

Volatility is computed using the **standard deviation of daily returns**, then annualized.

**Steps in Portfolium:**

1. Compute daily returns from daily portfolio values  
   $$
   r_t = \frac{V_t - V_{t-1}}{V_{t-1}}
   $$
2. Calculate the variance of daily returns  
3. Take the square root to obtain **daily volatility**  
4. Annualize using 252 trading days  

**Formula**

$$
\sigma_{\text{annual}} = \sqrt{\frac{1}{N}\sum_{t=1}^{N}(r_t - \bar{r})^2} \times \sqrt{252}
$$

Where:

- $r_t$ = daily return  
- $\bar{r}$ = average daily return  
- $N$ = number of trading days in the period  

Additional notes:

- If daily return history is insufficient, the widget shows **N/A**

---

## Example

Assume your portfolio had the following over the last year:

- Standard deviation of daily returns: **1.16%**  
- Annualization factor: $\sqrt{252} \approx 15.87$

Annualized volatility:

$$
\sigma_{\text{annual}} = 0.0116 \times 15.87 \approx 0.184
$$

Displayed as:

- **18.40%**

---

## When To Use It

The Volatility widget is useful for:

- Understanding how stable or unstable your portfolio is  
- Comparing risk levels across different portfolios or strategies  
- Deciding your tolerance for drawdowns and fluctuations  
- Complementing metrics like **Sharpe Ratio**, **Max Drawdown**, and **Beta**

---

## Notes
  
- Expressed as a **percentage**, annualized  
- Higher volatility does **not** necessarily mean worse performance—only higher variability  
- Formatting follows your portfolio's display settings  
