# Win Rate

The **Win Rate** widget shows the percentage of your **current positions** that are in profit.  
It gives you a quick sense of how many of your active trades are currently "winning".

---

## What It Shows

- The **percentage of positions in profit** (Win Rate)  
- The **number of profitable positions**  
- The **total number of positions** considered  
- Color-coded Win Rate:

    - Green when your win rate is **70% or higher**
    - Amber between **50% and 69%**
    - Red when **below 50%**

This widget answers the question:  
> "Out of all my open positions, how many are actually green right now?"

---

## How It's Calculated

Win Rate is based on the **unrealized P&L** of your current positions.

1. Count how many positions have **unrealized P&L > 0** (profitable)
2. Count how many positions have a **unrealized P&L** 
3. Compute the Win Rate as a percentage

**Formula**

$$
\text{Win Rate (\%)} =
\frac{\text{Number of positions with } P_{\text{unrealized}} > 0}
{\text{Number of positions } P_{\text{unrealized}}}
\times 100
$$

Additional notes:

- Only positions with a **defined** unrealized P&L are counted  
- Positions at exactly **0** P&L are treated as **non-winning** (not included in the numerator)  

---

## Example

Suppose your portfolio has:

- 8 positions with a defined unrealized P&L  
- Among them:

    - 5 positions are in profit (unrealized P&L > 0)  
    - 3 positions are at a loss or breakeven  

Win Rate:

$$
\text{Win Rate (\%)} = \frac{5}{8} \times 100 = 62.5
$$

The widget would display:

- **63%** (rounded to the nearest integer)  
- A line such as: "5 positions in profit out of 8"

Because the win rate is between 50% and 69%, the main value would be shown in **amber**.

---

## When To Use It

The Win Rate widget is useful for:

- Getting a **quick snapshot** of how many of your current trades are working  
- Tracking how your **position quality** evolves over time  
- Complementing P&L metrics with a **count-based** view of performance  
- Checking whether recent changes to your strategy improve the proportion of winning positions  

---

## Notes

- Win Rate is based on **current market prices**, so it changes throughout the day.  
- It does **not** consider position size: a small winning position and a large losing one both count as a single position.  
- For monetary impact, combine this widget with **Unrealized P&L** and **Total Return** metrics.
