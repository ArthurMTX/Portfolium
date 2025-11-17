# Largest Holdings

The **Largest Holdings** widget highlights the positions that take up the **biggest share** of your portfolio.  
It helps you see at a glance where most of your capital is concentrated.

---

## What It Shows

For each of your largest positions, the widget displays:

- **Rank** (#1, #2, #3, …)  
- **Logo**, **Symbol**, and **Name** of the asset  
- **Allocation (%)** – how much of your portfolio this position represents  
- **Position value** – current market value of the position, in your portfolio currency  
- A **horizontal bar** showing the allocation visually (longer bar = larger share)

By default, the widget shows the **top 5 holdings**.

---

## How It's Calculated

For each position, the widget uses the **current market value**:

- **Market value** = Quantity × Current Price  
- **Total portfolio value** = Sum of market value of all open positions  

Then, for each asset:

$$
\text{Allocation (\%)} =
\frac{\text{Market value of the position}}{\text{Total portfolio value}} \times 100
$$

The list is sorted from **largest allocation to smallest**.

Displayed values:

- **Allocation (%)** – rounded to one decimal place  
- **Position value** – formatted in your portfolio's base currency  

---

## Example

Suppose your portfolio looks like this:

| Symbol | Market Value |
|--------|--------------|
| AAPL   | €8,000       |
| MSFT   | €6,000       |
| NVDA   | €4,000       |
| Other  | €12,000      |

Total portfolio value:

- **€8,000 + €6,000 + €4,000 + €12,000 = €30,000**

Allocations:

- AAPL: $\frac{8\,000}{30\,000} \times 100 = 26.7\%$
- MSFT: $\frac{6\,000}{30\,000} \times 100 = 20.0\%$
- NVDA: $\frac{4\,000}{30\,000} \times 100 = 13.3\%$

The **Largest Holdings** widget might display:

- **#1 AAPL – 26.7% — €8,000**  
- **#2 MSFT – 20.0% — €6,000**  
- **#3 NVDA – 13.3% — €4,000**  
- (up to the top 5 positions)

Each line includes a purple bar whose length matches the allocation.

---

## When To Use It

The Largest Holdings widget is useful for:

- Checking if your portfolio is **too concentrated** in a few names  
- Seeing which assets dominate your allocation before rebalancing  
- Comparing the size of positions relative to each other  
- Combining with **Concentration Risk** and **Positions** to manage risk exposure

---

## Notes

- Only **open positions** with a non-zero market value are included  
- Allocation is based on the **latest market prices** and may change during the day  
- Currency formatting follows your **portfolio base currency**  
- This widget complements other risk-oriented widgets like **Concentration Risk** and **Positions**.
