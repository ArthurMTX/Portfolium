# VIX Index

The **VIX Index** widget shows the current level of **implied volatility** in the US stock market, using the **CBOE Volatility Index (VIX)**.  
The VIX is often called the market’s **"fear gauge"**: higher values mean traders expect larger price swings in the near term.

This widget gives macro context for the **overall risk environment**, independent of your portfolio.

---

## What It Shows

The widget displays:

- The **current VIX value**, e.g. **17.28**  
- The **percentage change vs previous close**, e.g. **-0.50%**  
- A **volatility label** based on the VIX level:
    - *Low volatility*
    - *Normal volatility*
    - *Elevated volatility*
    - *High volatility*

Visual cues:

- The main value and icon background change color depending on volatility:
    - **Green** – low volatility  
    - **Blue** – normal volatility  
    - **Orange** – elevated volatility  
    - **Red** – high volatility  
- The percentage change is:
    - **Red** when VIX is **up** (volatility increasing)  
    - **Green** when VIX is **down** (volatility easing)  

If no data is available, the widget shows:

- **N/A** and an **“Unknown”** volatility label

This widget answers the question:  
> "How nervous or calm is the equity market right now?"

---

## How It Works

### Data source

Portfolium fetches the official **CBOE VIX Index** via `yfinance`:

- Symbol: **`^VIX`**  
- Uses live market data (with caching on the backend for a few minutes)

The backend returns:

- `price` – current VIX value  
- `change` – point change vs previous close  
- `change_pct` – percentage change vs previous close  
- `previous_close` – yesterday’s VIX close  
- `timestamp` – when the data was collected  

If data cannot be fetched, an error is raised and the widget falls back to a safe display.

### Calculations

Backend logic:

1. Get `current_price` (regular market price)  
2. Get `previous_close` (previous day’s close)  
3. Compute:

   - **Point change**  
     $$
     \Delta = \text{current\_price} - \text{previous\_close}
     $$
   - **Percentage change**  
     $$
     \Delta\% = \frac{\Delta}{\text{previous\_close}} \times 100
     $$

4. Round values to **two decimals**.

Frontend logic:

- Determines **volatility level** from `vixPrice`:

  - `< 12` → **Low volatility**  
  - `12–20` → **Normal volatility**  
  - `20–30` → **Elevated volatility**  
  - `> 30` → **High volatility**  

- Colors the label and icon accordingly.
- Colors `change_pct`:
  - **Red** if `change_pct ≥ 0` (volatility rising)  
  - **Green** if `change_pct < 0` (volatility falling)

---

## Example

Assume the VIX data is:

- Current price: **21.40**  
- Previous close: **19.00**

Point change:

$$
\Delta = 21.40 - 19.00 = 2.40
$$

Percentage change:

$$
\Delta\% = \frac{2.40}{19.00} \times 100 \approx 12.63\%
$$

The widget would display:

- Main value: **21.40**  
- Change badge: **+12.63%** (in red, because volatility increased)  
- Volatility label: **Elevated volatility** (since VIX is between 20 and 30)  
- Icon and label in **orange** to reflect elevated risk

In preview mode, it might display:

- **17.28** with **-0.50%** (in green)  
- Volatility label: **Normal volatility** (since 12–20)

---

## When To Use It

The VIX Index widget is useful for:

- Assessing the **overall risk and fear level** in the US equity market  
- Deciding whether the environment is **calm** (low VIX) or **stressed** (high VIX)  
- Providing context for your portfolio moves:
  - High VIX → expect larger swings, wider spreads, higher implied options premiums  
  - Low VIX → calmer markets, but also potential complacency  
- Complementing metrics like **Market Sentiment**, **Volatility**, and **Drawdown**

It’s particularly helpful when:

- You manage **equities or equity-linked products**  
- You want to align risk-taking with the **macro volatility regime**

---

## Notes

- The VIX measures **implied volatility** of S&P 500 options, not your portfolio’s own volatility  
- Values are **not** percentages; VIX ≈ 20 roughly implies a 20% annualized volatility expectation  
- Data is **cached** and refreshed periodically to reduce external API calls  
- If the VIX data source is temporarily unavailable, the widget may show **N/A** or an “Unknown” state  
- This widget is for **contextual insight** and does not interact directly with your positions
