# Unrealized P&L

The **Unrealized P&L** widget shows the profit or loss on your **current open positions**.  
It tells you how much you are "up" or "down" on paper, based on current market prices, before selling anything.

---

## What It Shows

- The **total unrealized profit or loss** for all open positions  
- Displayed in your portfolio's currency
- A **percentage return** based on your total cost  
- Color-coded:

  - Green when your unrealized P&L is positive
  - Red when your unrealized P&L is negative  

This metric answers the question:  
> "If I sell everything now, how much would I gain or lose compared to what I paid?"

---

## How It's Calculated

Unrealized P&L compares your **current portfolio value** to your **total cost basis**.

**Formula (Value)**

$$
\text{Unrealized PNL} = V_{\text{current}} - C_{\text{total}}
$$

Where:  
- $V_{\text{current}}$ = current total value of all open positions  
- $C_{\text{total}}$ = total amount you originally invested in those positions (cost basis)  

**Formula (Percentage)**  

$$
\text{Unrealized PNL (\%)} = \frac{V_{\text{current}} - C_{\text{total}}}{C_{\text{total}}} \times 100
$$

Additional notes:

- Positive result = unrealized profit  
- Negative result = unrealized loss  
- Only positions you still hold are included (sold positions are part of **Realized P&L**, not Unrealized P&L)

---

## Example

- $C_{\text{total}} = \text{€} 10\,000$
- $V_{\text{current}} = \text{€} 11\,500$

$$
\text{Unrealized PNL} = 11\,500 - 10\,000 = 1\,500
$$

$$
\text{Unrealized PNL (\%)} = \frac{1\,500}{10\,000} \times 100 = 15.00
$$

The widget would display:

- **+€1,500.00**  
- **+15.00%**

---

## When To Use It

The Unrealized P&L widget is useful for:

- Tracking how profitable your **current** holdings are  
- Deciding whether it might be a good moment to take profits or cut losses  
- Comparing current performance to your initial investment  
- Monitoring risk exposure on open positions  

---

## Notes

- Unrealized P&L changes continuously with market prices
- Once you sell a position, its profit or loss moves from **Unrealized** to **Realized P&L**
- Currency and formatting follow your portfolio settings
