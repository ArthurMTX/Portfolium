# Value at Risk (VaR 95%)

The **Value at Risk (VaR 95%)** widget estimates the **maximum expected loss** of your portfolio over the selected period, with **95% confidence**.  
It tells you how much your portfolio could lose on a **typical worst day** based on historical returns.

This metric highlights **tail risk**, the risk of large, infrequent losses.

---

## What It Shows

The widget displays:

- The **95% Value at Risk (%)**  
- A **negative percentage**, e.g. **-2.50%**  
- Calculated over the selected period (default: **1 year**)  
- Color-coded in red to emphasize downside risk  

Interpretation:

- **VaR = -2.50%** means:  
  > "On 95% of days, your portfolio should not lose more than **2.50%**."

This metric answers the question:  
> "How much could I lose on a bad day, but not the worst imaginable day?"

---

## How It's Calculated

Portfolium uses **historical simulation VaR**, based on actual daily returns of your portfolio.

**Steps:**

1. Compute daily returns from your portfolio's daily value history  
2. Sort the returns from **worst to best**  
3. Select the value at the **5th percentile**  
   - Because VaR 95% corresponds to the **worst 5% of outcomes**  
4. Convert the result to a percentage and display it as negative

**Formula (conceptual)**

$$
\text{VaR}_{95} = \text{5th percentile of daily returns}
$$

In code, this corresponds to selecting:

$$
r_{(0.05 \times N)}
$$

from the sorted list of returns.

Additional notes:

- If you don't have enough daily return data, VaR appears as **N/A**  
- VaR represents **normal bad days**, not extreme shocks (those are covered by CVaR, not VaR)

---

## Example

Assume your last 200 daily returns sorted from worst to best include:

- 5th percentile return: **-0.025** (–2.5%)

Value at Risk:

- **VaR 95% = –2.50%**

The widget would display:

- **-2.50%**

Interpretation:

- On 95% of days, your portfolio should not lose more than **2.5%**.

---

## When To Use It

The Value at Risk widget is useful for:

- Understanding **typical downside risk** under normal market conditions  
- Assessing whether your risk exposure matches your risk tolerance  
- Comparing the riskiness of different portfolios or strategies  
- Supporting portfolio optimization, hedging decisions, and scenario analysis  
- Complementing **Max Drawdown**, **Volatility**, and **Beta**

---

## Notes

- VaR is always shown as a **negative percentage**  
- Uses **historical daily returns**, not assumptions about return distributions  
- Represents "bad but normal" losses, not extreme tail events  
- Formatting follows your portfolio's display settings
