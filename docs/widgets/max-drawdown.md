# Maximum Drawdown

The **Maximum Drawdown** widget measures the **largest peak-to-trough decline** your portfolio experienced during a selected period.  
It represents the worst percentage drop from a previous high before a new high was reached.

This metric highlights your **worst-case scenario** in terms of losses.

---

## What It Shows

The widget displays:

- The **maximum drawdown (%)** over the selected period (default: **1 year**)  
- Always expressed as a **negative percentage** (e.g., **-12.30%**)  
- Color-coded in red to emphasize downside risk  

It also internally tracks the **date** when the maximum drawdown occurred.

This metric answers:  
> "How much did my portfolio fall from its highest point during this period?"

---

## How It's Calculated

Maximum drawdown compares the highest portfolio value (peak) with the lowest value that follows it (trough).

**Formula**

$$
\text{Max Drawdown} =
\frac{\text{Peak Value} - \text{Trough Value}}{\text{Peak Value}} \times 100
$$

Calculation steps in Portfolium:

1. Scan all daily portfolio values  
2. Track the **highest value reached so far** (the peak)  
3. For each day, compute how much the portfolio has fallen from that peak  
4. Record the largest decline as the **maximum drawdown**  
5. Store the date on which it occurred  

Notes:

- The widget displays the percentage only; the date is not shown but stored internally  
- If insufficient history exists, the value appears as **N/A**

---

## Example

Imagine your portfolio values over time reached:

- **Peak:** €10,000  
- **Trough:** €8,700  

Maximum drawdown:

$$
\text{Max Drawdown} = 
\frac{10\,000 - 8\,700}{10\,000} \times 100
= 13\%
$$

Displayed as:

- **-13.00%**

---

## When To Use It

The Maximum Drawdown widget is useful for:

- Evaluating **downside risk** and resilience  
- Understanding the worst decline your portfolio suffered  
- Comparing strategies with similar returns but different risk profiles  
- Stress-testing your tolerance for losses  
- Complementing volatility, Sharpe ratio, and Value at Risk  

---

## Notes

- Always shown as a **negative percentage**  
- Based on your portfolio's **daily value history**  
- Large drawdowns indicate high downside exposure  
- Formatting follows your portfolio's display settings  
