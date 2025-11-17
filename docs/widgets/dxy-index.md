# U.S. Dollar Index (DXY)

The **DXY Index** widget shows the current value of the **U.S. Dollar Index (DXY)**, a benchmark that tracks the USD against a basket of major currencies.  
It helps you understand whether the **U.S. dollar is weak, normal, or strong**, which can impact stocks, bonds, commodities, and international assets.

---

## What It Shows

The widget displays:

- The **current DXY level**, e.g. **106.25**  
- The **percentage change vs previous close**, e.g. **+0.15%**  
- A **strength label** describing the dollar environment, such as:
  - *Very weak*
  - *Weak*
  - *Normal*
  - *Strong*
  - *Very strong*

Visual cues:

- The main DXY value and icon background change color based on dollar strength:
  - **Red** – very weak (< 90)  
  - **Orange** – weak (90–95)  
  - **Neutral/grey** – normal (95–105)  
  - **Blue** – strong (105–115)  
  - **Green** – very strong (> 115)  

The daily change badge:

- **Green** when DXY is **up** (USD strengthening)  
- **Red** when DXY is **down** (USD weakening)

If no data is available, the widget shows:

- **N/A** and an **"Unknown"** strength label

This widget answers the question:  
> "How strong is the U.S. dollar right now, and is it getting stronger or weaker?"

---

## How It Works

### Data source

Portfolium fetches the **U.S. Dollar Index** using `yfinance`:

- Symbol: **`DX-Y.NYB`**  
- Data is cached on the backend for a few minutes to avoid repeated external requests

The backend returns:

- `price` – current DXY level  
- `change` – point change vs previous close  
- `change_pct` – percentage change vs previous close  
- `previous_close` – yesterday's DXY close  
- `timestamp` – when the data was collected  

If no current price is available, an error is raised and the widget falls back to an "Unknown" state.

### Calculations

Backend logic:

1. Retrieve `current_price` and `previous_close` from the ticker info  
2. If `previous_close > 0`, compute:

   - **Point change**  
     $$
     \Delta = \text{current\_price} - \text{previous\_close}
     $$
   - **Percentage change**  
     $$
     \Delta\% = \frac{\Delta}{\text{previous\_close}} \times 100
     $$

3. Round `price`, `change`, and `change_pct` to **two decimals**.

Dollar strength regimes:

- `< 90` → **Very weak** (red)  
- `90–95` → **Weak** (orange)  
- `95–105` → **Normal** (neutral grey)  
- `105–115` → **Strong** (blue)  
- `> 115` → **Very strong** (green)  

The label, text color, and background are chosen based on these ranges.

The change badge:

- **Green** if `dxyChange ≥ 0` → dollar strengthening  
- **Red** if `dxyChange < 0` → dollar weakening  

---

## Example

Assume the DXY data is:

- Current index level: **106.25**  
- Previous close: **106.09**

Point change:

$$
\Delta = 106.25 - 106.09 = 0.16
$$

Percentage change:

$$
\Delta\% = \frac{0.16}{106.09} \times 100 \approx 0.15\%
$$

The widget would display:

- Main value: **106.25**  
- Change badge: **+0.15%** (in green, USD getting stronger)  
- Strength label: **Strong** (since DXY is between 105 and 115)  
- Icon and label in **blue** to indicate a strong dollar environment

---

## When To Use It

The DXY Index widget is useful for:

- Understanding the **global currency backdrop** for your portfolio  
- Providing context for:
  - **International equities and ETFs** (USD strength can hurt non-USD assets)  
  - **Commodities** like gold and oil (often inversely related to USD strength)  
  - **Emerging markets**, which can be sensitive to a strong U.S. dollar  
- Interpreting moves in **multicurrency portfolios** and FX exposures  

It works particularly well alongside:

- **TNX Index** (interest rate regime)  
- **VIX Index** (volatility regime)  
- **Market Sentiment** and portfolio-level metrics (Volatility, Beta, Drawdown)

---

## Notes

- DXY tracks the dollar against a basket of major currencies (EUR, JPY, GBP, CAD, SEK, CHF)  
- Values are **index levels**, not percentages (e.g. **106.25**, not 106.25%)  
- Data is **cached and periodically refreshed** for efficiency  
- If the DXY data source is temporarily unavailable, the widget falls back to an **Unknown** state with **N/A**  
- This widget is **macro/contextual** and does not depend on your current positions
