# Market Status

The **Market Status** widget shows whether the main stock markets around the world are currently **open or closed**.  
It helps you quickly see if it's a good time to expect **live price updates** or if markets are already shut.

---

## What It Shows

For each major region, the widget displays:

- A **colored status dot**:

    - 🟢 Green → **Open**
    - 🟠 Amber → **Pre-market / After-hours** (US only)
    - 🔴 Red → **Closed**
    - ⚪ Grey → **Unknown** (no data)

- The **region name**:

    - USA  
    - Europe  
    - Asia  
    - Oceania

- A **status label**, such as:

    - **Open**
    - **Pre-market** / **After-hours** (only for US)
    - **Closed**
    - **Unknown**  

This gives you, at a glance, the trading status of the main time zones that affect your portfolio.

---

## How It Works

The widget uses your backend's market health endpoint to determine, for each region:

- **USA**:
    - Uses **New York time** and official US market hours
    - Supports 4 detailed states:
        - **Pre-market** (between 4:00 AM and 9:30 AM ET)
        - **Open** (regular session between 9:30 AM and 4:00 PM ET)
        - **After-hours** (between 4:00 PM and 8:00 PM ET)
        - **Closed** (outside all trading sessions or weekend/day off)

- **Europe**:
    - Uses **London time** and typical European market hours
    - Supports 2 states:
        - **Open** (between 8:00 AM and 4:30 PM GMT)
        - **Closed** (outside these hours or weekend/day off)

- **Asia**:
    - Uses **Tokyo time** and typical Asian market hours
    - Supports 2 states:
        - **Open** (between 9:00 AM and 3:00 PM JST, with a lunch break from 11:30 AM to 12:30 PM)
        - **Closed** (outside these hours or weekend/day off)

- **Oceania**:
    - Uses **Sydney time** and typical Australian market hours
    - Supports 2 states:
        - **Open** (between 10:00 AM and 4:00 PM AEST)
        - **Closed** (outside these hours or weekend/day off)

The widget:

- **Automatically refreshes every 60 seconds** (outside preview mode)  
- Uses **translations** for labels (`Open`, `Closed`, etc.) based on your interface language  
- Works even in preview mode (using mocked or intercepted data by the app)

---

## Example

When you open the Dashboard, you might see:

- **USA** – 🟢 **Open**  
- **Europe** – 🔴 **Closed**  
- **Asia** – 🔴 **Closed**  
- **Oceania** – 🔴 **Closed**

This means:

- US markets are currently trading  
- European, Asian, and Oceania markets are outside regular trading hours

During early US trading you might see:

- **USA** – 🟠 **Pre-market**  
- Other regions marked as **Open** or **Closed** depending on their local session.

---

## When To Use It

The Market Status widget is useful for:

- Knowing whether **live price moves** are likely right now  
- Understanding **why prices don't seem to move** (because markets are closed)  
- Timing your **orders, rebalancing, or monitoring** around market sessions  
- Getting a quick global view of **which regions are active** at the moment

---

## Notes

- Statuses are based on **local time zones** and typical **regular market hours**  
- Some special sessions, holidays, or half-days may not be reflected perfectly  
- The widget only shows **high-level session status**, not index performance or sentiment  
- Labels and region names follow your **language settings** (via translations)
