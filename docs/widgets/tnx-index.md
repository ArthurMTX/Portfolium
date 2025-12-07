# 10-Year Treasury Yield (TNX Index)

The **TNX Index** widget shows the current yield on the **US 10-Year Treasury Note** (symbol: **^TNX**).  
This rate is a key benchmark for **global interest rates**, risk-free returns, and overall market conditions.

It helps you understand the **interest rate environment** your portfolio is operating in.

---

## What It Shows

The widget displays:

- The **current 10-Year Treasury yield**, as a percentage (e.g. **4.25%**)  
- The **percentage change vs previous close**, e.g. **+0.30%**  
- A **yield level label**, such as:
    - *Very low*
    - *Low*
    - *Normal*
    - *Elevated*
    - *High*

Visual cues:

- The main yield and icon background change color based on the yield regime:
    - **Blue** – very low yields (< 2%)  
    - **Green** – low yields (2–3%)  
    - **Neutral/grey** – normal yields (3–4%)  
    - **Orange** – elevated yields (4–5%)  
    - **Red** – high yields (> 5%)  
- The change badge is:
    - **Red** when yields are **up** (rates rising)  
    - **Green** when yields are **down** (rates falling)

If data is not available, the widget shows:

- **N/A** and an **"Unknown"** yield level

This widget answers the question:  
> "Where are long-term interest rates right now, and are they moving up or down?"

---

## How It Works

### Data source

Portfolium uses **`yfinance`** to fetch the official **10-Year Treasury Note Yield**:

- Symbol: **`^TNX`**  
- Backend fetches live data and caches it for a few minutes to avoid repeated external calls

The API response is processed into:

- `price` – current 10-Year yield (in %)  
- `change` – point change vs previous close  
- `change_pct` – percentage change vs previous close  
- `previous_close` – previous day's yield  
- `timestamp` – time of data collection  

If no current price is available, an error is raised and the widget falls back to an unknown state.

### Calculations

Backend logic:

1. Retrieve `current_price` and `previous_close` from the ticker info  
2. If both are available and `previous_close > 0`, compute:

   - **Point change**  
     $$
     \Delta = \text{current\_price} - \text{previous\_close}
     $$
   - **Percentage change**  
     $$
     \Delta\% = \frac{\Delta}{\text{previous\_close}} \times 100
     $$

3. Round `price`, `change`, and `change_pct` to **two decimals**.

Yield regimes:

- `< 2%` → **Very low**  
- `2–3%` → **Low**  
- `3–4%` → **Normal**  
- `4–5%` → **Elevated**  
- `> 5%` → **High**  

The label and colors (text, background, icon) are chosen based on these ranges.

The change badge:

- **Red** if `tnxChange ≥ 0` (yields rising → tighter conditions)  
- **Green** if `tnxChange < 0` (yields falling → looser conditions)

---

## Example

Assume the TNX data is:

- Current yield: **4.25%**  
- Previous close: **3.95%**

Point change:

$$
\Delta = 4.25 - 3.95 = 0.30
$$

Percentage change:

$$
\Delta\% = \frac{0.30}{3.95} \times 100 \approx 7.59\%
$$

The widget would display:

- Main value: **4.25%**  
- Change badge: **+7.59%** (in red, indicating yields increased)  
- Yield level: **Elevated** (since yield is between 4% and 5%)  
- Icon and label in **orange** to signal elevated rate conditions

---

## When To Use It

The 10-Year Treasury Yield widget is useful for:

- Understanding the **macro interest rate backdrop** for your investments  
- Assessing the attractiveness of **risk-free yields** vs. risk assets  
- Providing context for:
    - **Equity valuations** (higher yields often pressure growth stocks)  
    - **Bond prices** (yields up → prices down)  
    - **Discount rates** used in valuation models  

It works especially well alongside:

- **VIX Index** (volatility regime)  
- **Market Sentiment** (fear/greed context)  
- Portfolio-level metrics like **Volatility**, **Beta**, and **Drawdown**

---

## Notes

- TNX reflects the **nominal** yield on US 10-Year Treasuries, not adjusted for inflation  
- Values are shown directly as percentages (e.g. **4.25%**), not annualized transformations  
- Data is **cached and refreshed periodically** to balance freshness and performance  
- If the TNX data source is unavailable, the widget falls back to an **Unknown** state with **N/A** for the value  
- This widget provides **macro context** and does not depend on your holdings or portfolio structure
