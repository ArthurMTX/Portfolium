# Daily Gain

The **Daily Gain** widget shows how much your portfolio has moved during the current trading day, both in currency and percentage.  
It gives you a quick view of whether today's market performance is positive or negative for your portfolio.

---

## What It Shows

- The **daily change** in your portfolio value (gain or loss)  
- Displayed in your portfolio's currency
- A **percentage change** for the day  
- Color-coded:

  - Green for gains
  - Red for losses
  - Neutral when data is missing  

This metric answers the question:  
> "How much has the total worth of my portfolio changed today? Is it up or down?"

---

## How It's Calculated

**Formula (Value)**

$$
\text{Daily Gain} = V_{\text{today}} - V_{\text{previous}}
$$

Where:  
- $V_{\text{today}}$ = current total portfolio value  
- $V_{\text{previous}}$ = total portfolio value at the previous market close  

**Formula (Percentage)**  

$$
\text{Daily Gain (\%)} = \frac{V_{\text{today}} - V_{\text{previous}}}{V_{\text{previous}}} \times 100
$$

Additional notes:

- Positive result = daily gain  
- Negative result = daily loss  
- If previous close data is unavailable, the widget may show **N/A**  

---

## Example

- $V_{\text{previous}} = \text{€} 12\,000$
- $V_{\text{today}} = \text{€} 12\,300$

$$
\text{Daily Gain} = 12\,300 - 12\,000 = \text{€} 300
$$

$$
\text{Daily Gain (\%)} = \frac{300}{12\,000} \times 100 = 2.50
$$

The widget would display:

- **+€300.00**  
- **+2.50%**

---

## When To Use It

The Daily Gain widget is useful for:

- Monitoring your **intraday performance**  
- Seeing whether your portfolio is up or down **today**  
- Tracking short-term volatility  
- Evaluating market impact during trading hours  

---

## Notes

- Daily Gain resets at each new trading day  
- Updates follow your refresh settings  
- Currency formatting follows your portfolio settings
