# Total Value

The **Total Value** widget displays the current market value of all the assets you still hold in your portfolio.  
It provides an instant overview of what your portfolio is worth right now based on the latest market prices.

---

## What It Shows

- The **current value** of all open positions  
- Displayed in your portfolio's currency 
- Updated dynamically as market prices change  

This metric answers the question:  
> "What is the total worth of my portfolio if I sell everything now?"

---

## How It's Calculated

**Formula**

$$
\text{Total Value} = \sum_{i=1}^{n} \left( Q_i \times P_i \right)
$$

Where:  
- \( Q_i \) = quantity of asset *i*  
- \( P_i \) = current price of asset *i*  

Additional notes:

- Only **active positions** are included  
- Sold positions are **not** part of this calculation  
- Prices update based on your refresh settings (auto or manual)  

---

## Example

| Asset | Quantity | Current Price | Value |
|-------|----------|----------------|--------|
| AAPL  | 10       | \$190          | \$1,900 |
| MSFT  | 5        | \$420          | \$2,100 |

$$
\text{Total Value} = 1\,900 + 2\,100 = 4\,000
$$

The widget would display:

- **$4,000.00** (or € depending on your portfolio settings)

---

## When To Use It

The Total Value widget is useful for:

- Monitoring the overall size of your portfolio  
- Tracking how your total wealth evolves over time  
- Assessing market exposure at a glance  
- Comparing your portfolio value to targets or benchmarks  

---

## Notes

- If market prices are temporarily unavailable, the widget may show **N/A** until the next refresh
- Currency formatting follows your portfolio settings
- Total Value reflects only **open positions** (not realized gains)
