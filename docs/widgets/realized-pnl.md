# Realized P&L

The **Realized P&L** widget shows the profit or loss you have already locked in by **selling positions**.  
It represents the total gains or losses from completed trades, based on the difference between your sale price and your cost basis.

---

## What It Shows

- The **total realized profit or loss** from all closed positions  
- Displayed in your portfolio's currency  
- Color-coded:

  - Green when your realized P&L is positive
  - Red when your realized P&L is negative  

This metric answers the question:  
> "How much money have I actually made or lost from the trades I already completed?"

---

## How It's Calculated

Realized P&L compares, for every closed position, the **proceeds from your sales** to your **original cost basis**.

**Formula (Value)**

$$
\text{Realized PNL} = \sum_{i=1}^{n} \left( S_i - C_i \right)
$$

Where:  
- $S_i$ = total sale proceeds for asset *i*  
- $C_i$ = total cost basis for asset *i*  

Additional notes:

- Only **fully closed positions** contribute to Realized P&L  
- Gains and losses are final, they do **not** change with market prices  
- Partial sells contribute proportionally (the cost basis is adjusted accordingly)

---

## Example

Suppose you sold the following positions:

- Asset A: $S_1 = \text{€} 2\,400$, $C_1 = \text{€} 2\,000$  
- Asset B: $S_2 = \text{€} 1\,300$, $C_2 = \text{€} 1\,500$  

Total Realized P&L:

$$
\text{Realized PNL} = (2\,400 - 2\,000) + (1\,300 - 1\,500)
$$

$$
\text{Realized PNL} = 400 - 200 = 200
$$

The widget would display:

- **+€200.00**

---

## When To Use It

The Realized P&L widget is useful for:

- Reviewing the results of trades you have already completed  
- Tracking long-term performance separate from open positions  
- Supporting tax reporting and fiscal optimisation  
- Understanding which trades contributed most to your actual gains or losses  

---

## Notes

- Realized P&L does **not** change with current market prices
- Only closed positions appear in Realized P&L; open ones remain in **Unrealized P&L**  
- Currency and formatting follow your portfolio settings
