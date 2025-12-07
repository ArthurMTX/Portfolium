# Worst Performers

The **Worst Performers** widget highlights the positions that contribute most to your portfolio's losses.  
It shows which assets have the **lowest percentage return** based on their current unrealized P&L.

---

## What It Shows

For each worst performer, the widget displays:

- **Rank** (#1, #2, #3, …)  
- **Logo**, **Symbol**, and **Name** of the asset  
- **Return (%)** - unrealized P&L percentage for that position  
- **Position value** - current market value of that position in your portfolio currency  

The list is limited to a small number of assets (typically the **bottom 5**) so you can see your biggest losers at a glance.

Only positions you **still hold** are included. Closed positions belong to **Realized P&L**, not Worst Performers.

---

## How It's Calculated

For each open position, the widget uses the **unrealized P&L percentage**:

$$
\text{Return (\%)} =
\frac{\text{Current Value} - \text{Cost Basis}}{\text{Cost Basis}} \times 100
$$

Then:

1. All positions with valid unrealized P&L are collected.  
2. They are **sorted from lowest to highest return (%)**.  
3. The top few positions (e.g. 5) are shown in the widget.

Displayed value for each asset:

- **Return (%)** - rounded to two decimals, with a leading `+` when positive or `-` when negative
- **Position value** - current value of the position (quantity × current price), formatted in your portfolio currency  

---

## Example

Imagine you hold:

| Symbol | Cost Basis | Current Value | Unrealized P&L (%) |
|--------|------------|---------------|--------------------|
| NVDA   | $5,000     | $9,250        | +85.00%            |
| AAPL   | $4,000     | $5,000        | +25.00%            |
| TSLA   | $7,000     | $7,500        | +7.14%             |
| AMZN   | $3,000     | $2,700        | -10.00%            |
| MSFT   | $6,000     | $8,400        | +40.00%            |
| META   | $2,000     | $1,800        | -15.00%            |
| GME    | $1,500     | $1,200        | -20.00%            |

The Worst Performers widget might display:

- **#1 GME** - **-20.00%**, position value **$1,200.00**  
- **#2 META** - **-15.00%**, position value **$1,800.00**  
- **#3 AMZN** - **-10.00%**, position value **$2,700.00**  

This makes it immediately clear which assets are driving your losses.

---

## When To Use It

The Worst Performers widget is useful for:

- Seeing **which positions contribute most** to your current losses  
- Spotting **big losers** that might justify taking partial profits or rebalancing  
- Understanding how your portfolio performance is distributed across assets  
- Complementing other widgets such as **Unrealized P&L**, **Positions**, and **Concentration Risk**

---

## Notes

- Only **open positions** with a valid unrealized P&L are included 
- Returns are based on the **latest available market data** and your recorded **cost basis**
- Currency formatting follows your **portfolio base currency**
- The widget can show positive returns if your worst positions are currently at a gain
