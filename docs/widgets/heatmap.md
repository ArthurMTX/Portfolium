# Portfolio Heatmap

The **Portfolio Heatmap** widget gives you a **visual map of your holdings**, where each tile represents a position in your portfolio.  
Tile **size** shows how big the position is in your portfolio, and **color** shows how it's performing today.

This makes it very easy to spot:

- Which positions dominate your portfolio  
- Which ones are **popping green** or **bleeding red** on the day  

---

## What It Shows

Each tile in the heatmap corresponds to **one position** and displays:

- **Logo** of the asset (fallback to background + symbol if no logo)  
- **Symbol** (always visible)  
- **Name** (shown on larger tiles)  
- **Weight in portfolio** - e.g. `Weight: 12.5%`  
- **Daily change (%)** - e.g. `+2.34%`  

Tiles are sized based on their **portfolio weight**:

- **Very large positions** (≥ 20%) → `col-span-3 row-span-2`  
- **Large positions** (≥ 10%) → `col-span-2 row-span-2`  
- **Medium positions** (≥ 5%) → `col-span-2 row-span-1`  
- **Smaller positions** (< 5%) → `col-span-1 row-span-1`  

The grid uses **4 columns** with adaptive row height so big positions visually stand out.

---

## Color Coding

Tile **color** reflects the **daily performance** of each position:

- **Strong green** – big positive day  
- **Light green** – modest positive day  
- **Light red** – small loss  
- **Deeper red** – bigger loss  
- **Neutral grey** – no daily data available  

More precisely:

- `> +3%` → darkest **emerald**  
- `+1% to +3%` → medium **emerald**  
- `0% to +1%` → lighter **emerald**  
- `0% to -1%` → lighter **red**  
- `-1% to -3%` → medium **red**  
- `< -3%` → darkest **red**  
- `null` daily change → neutral grey block  

Each tile also includes a **tooltip** with:

> `SYMBOL: +X.XX%` or `N/A` if the daily change is not available.

---

## How It Works

1. The widget loads **all positions** for the active portfolio  
2. It computes the **total portfolio value** as the sum of all market values  
3. For each position:
   - **Weight (%)** = $\frac{\text{Position market value}}{\text{Total portfolio value}} \times 100$
   - **Daily change (%)** = $\frac{\text{(Current price - Previous close price)}}{\text{Previous close price}} \times 100$  
   - Chooses a **grid span** (size) based on the weight  
   - Chooses a **color** based on daily performance  
4. Positions are **sorted by market value (descending)** so largest tiles appear first and feel more "dominant".

If there are **no positions** with value, the widget shows a **"No positions"** empty state instead of a blank grid.

If data is still loading, a **spinner** is displayed in the center.

---

## Example

If your portfolio looks like this:

- **NVDA** – 25% of portfolio, +4.20% today → **huge, dark green tile**  
- **MSFT** – 12% of portfolio, +0.80% today → large, medium green tile  
- **AAPL** – 7% of portfolio, -0.50% today → medium tile, light red  
- **Small fillers** (1–3% each) → small tiles, various red/green shades  

You can instantly see:

- Where your **biggest risks** are (largest blocks)  
- Which stocks are driving the **daily move** (brightest greens/reds)  

---

## When To Use It

The Portfolio Heatmap is useful for:

- Getting a **visual feel** for your portfolio in 2 seconds  
- Spotting **overexposed positions** at a glance  
- Checking **intraday risk** (who's bleeding vs who's pumping)  
- Complementing other widgets like **Largest Holdings**, **Concentration Risk**, or **Top Performers**

---

## Notes

- The heatmap uses **only positions with positive market value**, so closed or zeroed positions won't clutter the grid  
- Colors automatically adapt to **dark mode** while keeping the same logic (green = up, red = down)
- The heatmap is also available in the **Charts** section for any portfolio you view there
