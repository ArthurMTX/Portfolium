# Downside Deviation

The **Downside Deviation** widget measures how much your portfolio fluctuates **only on negative-return days**.  
Unlike standard volatility, which treats upside and downside equally, downside deviation focuses exclusively on **losses**, making it a more realistic measure of downside risk.

This metric shows how severe your portfolio's negative movements are.

---

## What It Shows

The widget displays:

- Your portfolio's **annualized downside deviation (%)**  
- A single numeric value, e.g. **12.10%**  
- Calculated over the selected period (default: **1 year**)  
- Expressed as a higher value when your portfolio experiences **large or frequent losses**

Interpretation:

- **Low downside deviation** → losses are mild and infrequent  
- **High downside deviation** → losses are large and volatile  
- Often used alongside the **Sortino Ratio** (not yet included)

This metric answers the question:  
> "How risky is my portfolio when things go wrong?"

---

## How It's Calculated

Downside deviation is computed by analyzing **only negative daily returns**, ignoring positive days entirely.

**Steps in Portfolium:**

1. Calculate daily portfolio returns  
2. Filter to keep **only negative returns**  
3. Compute the **variance** of these negative returns  
4. Take the square root to obtain daily downside volatility  
5. Annualize using 252 trading days  

**Formula**

$$
\sigma_{\text{down}} =
\sqrt{\frac{1}{N_{\text{neg}}} \sum_{r_t < 0} (r_t)^2} \times \sqrt{252}
$$

Where:

- $r_t$ = daily return (only negative ones are included)  
- $N_{\text{neg}}$ = number of negative-return days  

Additional notes:

- If your portfolio had **no negative-return days**, downside deviation = **0%**  
- If insufficient data exists, the widget shows **N/A**  

---

## Example

Assume over one year:

- You had **80 negative-return days**  
- The squared average of those returns produces a daily downside deviation of **0.0076**  
- Annualization factor: $\sqrt{252} \approx 15.87$

Annualized downside deviation:

$$
0.0076 \times 15.87 \approx 0.1207
$$

Displayed as:

- **12.07%**

---

## When To Use It

The Downside Deviation widget is useful for:

- Evaluating **real downside risk**, not just overall volatility  
- Comparing portfolios that have similar volatility but very different **loss profiles**  
- Understanding how your portfolio behaves in negative environments  
- Pairing with metrics like **VaR**, **Max Drawdown**, and **Volatility**

---

## Notes

- Focuses **only** on negative returns  
- Always annualized and expressed as **a percentage**  
- More realistic for risk-averse investors than general volatility  
- Formatting follows your portfolio's display settings
