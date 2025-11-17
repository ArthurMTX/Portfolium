# Market Indices

The **Market Indices** widget shows the **main stock indices around the world** and how they are performing **today**.  
It gives you a quick global snapshot of whether markets are **up or down** at index level.

---

## What It Shows

The widget is organized **by region** (e.g. US, Europe, Asia) and, for each index, displays:

- The **index name** (e.g. S&P 500, CAC 40, Nikkei 225)  
- A **country flag** for quick visual context  
- The **latest index level** (current price)  
- The **daily percentage change** (vs previous close)  
- A small **trend icon**, color-coded:

    - **Green + arrow up** → index is up on the day  
    - **Red + arrow down** → index is down on the day  
    - **Grey dash** → no change or data unavailable  

This makes it easy to see at a glance **which regions are rising and which are falling**.

The widget currently tracks (non-exhaustive list):

- **USA & North America**

    - S&P 500 (**^GSPC**)
    - Dow Jones (**^DJI**)
    - Nasdaq (**^IXIC**)
    - TSX (**^GSPTSE**)

- **Europe**

    - FTSE 100 (**^FTSE**)
    - DAX (**^GDAXI**)
    - CAC 40 (**^FCHI**)
    - FTSE MIB (**FTSEMIB.MI**)

- **Asia / Oceania**

    - Nikkei 225 (**^N225**)
    - Hang Seng (**^HSI**)
    - SSE Composite (**000001.SS**)
    - ASX 200 (**^AXJO**)

---

## How It Works

Behind the scenes, the widget:

1. **Requests index data** from the pricing API for a fixed list of symbols  
2. For each index, receives:
    - A **current price** (latest index level)
    - A **daily change percentage** (vs previous close)  
3. Normalizes the data so it can display:
    - The **level** (formatted with two decimals)
    - The **change (%)** with a leading `+` when positive or `−` when negative 
4. Chooses:
    - A **trend icon**:
        - Up arrow if daily change > 0  
        - Down arrow if daily change < 0  
        - Dash if daily change = 0 or missing  
    - A **color**:
        - Green for positive
        - Red for negative
        - Grey for neutral / missing

If the API is still loading or temporarily fails:

- A **loading spinner** is shown while fetching data  
- A **friendly error message** is displayed if the request fails  

Indices are grouped by **region label** (e.g. "US", "Europe", "Asia"), using translations so names follow your UI language.

---

## Example

On a typical day, you might see:

**US**

- **S&P 500** — `4,750.32` — **+0.85%** ✅  
- **Dow Jones** — `38,120.10` — **+0.40%** ✅  
- **Nasdaq** — `15,220.55` — **+1.30%** ✅  

**Europe**

- **CAC 40** — `7,250.20` — **−0.25%** 🔻  
- **DAX** — `15,950.80` — **−0.10%** 🔻  

**Asia**

- **Nikkei 225** — `33,100.50` — **+0.20%** ✅  
- **Hang Seng** — `17,950.00` — **−1.10%** 🔻  

At a glance, you can tell:

- US and Japan are **up**  
- France, Germany and Hong Kong are **down**  
- The exact daily move for each index in **%**  

---

## When To Use It

The Market Indices widget is useful for:

- Getting a **macro view** of global markets without leaving your dashboard  
- Checking whether **risk-on / risk-off** sentiment dominates the day  
- Quickly seeing if your portfolio's moves are aligned with **major indices**  
- Tracking which regions are **leading or lagging** in performance  

It works especially well combined with:

- **Market Status** (to know which regions are actually trading)  
- **Total Value / Daily Gain / Performance Metrics** (to compare your portfolio vs markets)  

---

## Notes

- Price and change data are based on the **latest available quotes** from Yahoo Finance  
- Percent changes are **relative to the previous close** for each index  
- Some indices may occasionally show `—` when:
    - Data is temporarily unavailable  
    - The API does not return a valid price/change  
- The list of tracked indices is **fixed** in the current version, but can be extended in future releases
