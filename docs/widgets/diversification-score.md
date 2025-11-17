# Diversification Score

The **Diversification Score** widget summarizes **how concentrated or diversified your portfolio is**.  
It turns your position weights into a **0–100 score**, where **higher = more diversified** and **lower = more concentrated**.

---

## What It Shows

The widget displays:

- A **Diversification Score** from **0 to 100**, formatted like **75/100**  
- A subtitle such as:  
  > "Based on X position(s)"

Color logic:

- **Green** (good diversification) when score **≥ 70**  
- **Amber** (moderate diversification) when **40 ≤ score < 70**  
- **Red** (poor diversification) when score **< 40**  

If there are **no positions** or the total market value is zero, the widget shows:

- **N/A** and a specific "no positions" subtitle

This metric answers the question:  
> "How diversified is my portfolio right now?"

---

## How It's Calculated

The Diversification Score is based on how your portfolio’s value is distributed across positions, using the **Herfindahl–Hirschman Index (HHI)**.

### 1. Total portfolio value

For each position:

- `market_value` is converted to a number  
- If `market_value` is `null` or `undefined`, it is treated as **0**  

Total value:

$$
\text{Total Value} = \sum_{i=1}^{n} \text{market\_value}_i
$$

If total value is **0**, the score is **null** → widget shows **N/A**.

### 2. Position weights and HHI

For each position *i*:

$$
w_i = \frac{\text{market\_value}_i}{\text{Total Value}}
$$

Then the **Herfindahl–Hirschman Index (HHI)** is:

$$
\text{HHI} = \sum_{i=1}^{n} w_i^2
$$

Properties:

- **Perfect diversification** (all positions equal): $\text{HHI} = \frac{1}{n}$
- **Maximum concentration** (single position): $\text{HHI} = 1$

### 3. Convert HHI to a 0–100 score

The widget inverts and rescales HHI so that:

- **0** = worst (fully concentrated)  
- **100** = best (perfectly equal weights)

Let:

- $\text{maxHHI} = 1$  
- $\text{minHHI} = \frac{1}{n}$

Diversification Score:

$$
\text{Score} =
\frac{\text{maxHHI} - \text{HHI}}{\text{maxHHI} - \text{minHHI}} \times 100
$$

The result is then **clamped** between **0** and **100**.

---

## Example

Imagine a portfolio with 4 positions:

| Position | Market Value |
|----------|--------------|
| A        | €4,000       |
| B        | €3,000       |
| C        | €2,000       |
| D        | €1,000       |

Total value:

$\text{Total} = 4\,000 + 3\,000 + 2\,000 + 1\,000 = 10\,000$

Weights:

- $w_A = 4\,000 / 10\,000 = 0.40$  
- $w_B = 3\,000 / 10\,000 = 0.30$
- $w_C = 2\,000 / 10\,000 = 0.20$
- $w_D = 1\,000 / 10\,000 = 0.10$

HHI:

$$
\text{HHI} = 0.40^2 + 0.30^2 + 0.20^2 + 0.10^2
= 0.16 + 0.09 + 0.04 + 0.01 = 0.30
$$

For 4 positions:

- $\text{minHHI} = 1/4 = 0.25$  
- $\text{maxHHI} = 1$

Diversification Score:

$$
\text{Score} =
\frac{1 - 0.30}{1 - 0.25} \times 100
= \frac{0.70}{0.75} \times 100 \approx 93.3
$$

The widget would display:

- **93/100**  
- Subtitle like: **"Based on 4 positions"**  
- Value colored **green** (high diversification)

---

## When To Use It

The Diversification Score widget is useful for:

- Quickly assessing whether your portfolio is **too concentrated**  
- Comparing diversification across different portfolios or strategies  
- Checking if new trades increase or reduce concentration  
- Complementing metrics like **Concentration Risk**, **Top Positions**, and **Sector Breakdown**

---

## Notes

- Only positions with **non-zero market value** contribute materially to the score  
- Positions with missing `market_value` are treated as **0**  
- More positions does **not** always mean better diversification, what matters is how value is **distributed**  
- The score is **relative** to your current number of positions, scaled to 0–100  
- Color coding (green / amber / red) helps you read the score at a glance
