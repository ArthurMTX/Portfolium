# Concentration Risk

The **Concentration Risk** widget shows how much of your portfolio is concentrated in your **top three positions**.  
It helps you see if a small number of assets represent a large share of your total portfolio value.

---

## What It Shows

- The **combined percentage** of your portfolio held in your **3 largest positions** (by market value)  
- A visual risk indicator:

    - **Green shield** if concentration is **60% or below**
    - **Orange warning icon** if concentration is **above 60%** (high concentration risk)

- A small list of your **Top 3 positions**, each with:

    - Logo (when available)
    - Symbol and name
    - Individual **% of portfolio** for that position

This widget answers the question:  
> "How much of my portfolio depends on just a few positions?"

---

## How It's Calculated

1. For each current position, compute its **market value** (quantity × current price).  
2. Sum all market values to get the **total portfolio value**.  
3. Sort positions by market value and take the **top 3**.  
4. Sum the market values of these top 3 positions.  
5. Divide by the total portfolio value and convert to a percentage.

**Formula**

Let:

- $V_{\text{total}}$ = total portfolio market value (sum of all positions' market values)
- $V_1, V_2, V_3$ = market values of the three largest positions  

Then:

$$
\text{Concentration Risk (\%)} =
\frac{V_1 + V_2 + V_3}{V_{\text{total}}} \times 100
$$

Risk level:

- If Concentration Risk **> 60%** → **High concentration** (orange warning)  
- Otherwise → **Moderate / diversified** (green shield)

Additional notes:

- Only positions with **positive market value** are included.  
- If you have fewer than 3 positions, the widget uses whatever is available (1 or 2).

---

## Example

Suppose your portfolio looks like this:

- Position A: €6,000  
- Position B: €3,000  
- Position C: €1,000  
- Position D: €2,000  

Total portfolio value:

$$
V_{\text{total}} = 6\,000 + 3\,000 + 1\,000 + 2\,000 = 12\,000
$$

Top 3 positions by value: A, B, D  

$$
V_1 + V_2 + V_3 = 6\,000 + 3\,000 + 2\,000 = 11\,000
$$

Concentration Risk:

$$
\text{Concentration Risk (\%)} = \frac{11\,000}{12\,000} \times 100 \approx 91.7
$$

The widget would display:

- **91.7%** (in orange, high risk)  
- A list of the top 3 positions with their individual shares, e.g.:

    - A: 50.0%  
    - B: 25.0%  
    - D: 16.7%

---

## When To Use It

The Concentration Risk widget is useful for:

- Checking if your portfolio is **overexposed** to a few names  
- Identifying positions that may need **trimming** for diversification  
- Monitoring how new trades affect your **overall risk profile**  
- Complementing other risk tools (volatility, drawdown, sector exposure, etc.)

---

## Notes

- The widget focuses on **position size**, not performance: a losing but large position still increases concentration risk
- Results change with **price movements** and **position size** (buys/sells) 
- Concentration is calculated per **active portfolio**; switching portfolio changes the values
