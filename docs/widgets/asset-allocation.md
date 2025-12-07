# Asset Allocation

The **Asset Allocation** widget shows **how your portfolio is distributed** across different **sectors**, **asset types**, and **countries**.  
It helps you quickly see where your money is concentrated and how diversified you really are.

---

## What It Shows

The widget has three tabs:

- **Sector** - allocation by **industry sector** (Technology, Healthcare, Energy, etc.)  
- **Type** - allocation by **asset type** (Stocks, ETFs, Crypto, etc.)  
- **Country** - allocation by **country/market** (USA, France, Japan, etc.)

For the selected tab, the widget displays:

- A **chart** (donut, pie, or horizontal bar) showing **percentage of portfolio** per category  
- A **legend** with:
    - The **label** (translated when possible, e.g. sectors and asset types)
    - A **color dot** matching the chart
    - The **allocation percentage** (with more precision for very small slices)

Each slice/bar represents:

> "What percentage of my portfolio value is in this sector / type / country?"

If detailed data is available, the allocation is based on **current market value** of your positions.  
Otherwise, it falls back to **asset count** (still useful for a rough diversification view).

---

## How It Works

### Tabs

Use the buttons at the top of the widget to switch between:

- **Sector**
- **Type** 
- **Country**  

The active tab is highlighted with a **purple pill**.

### Chart Types

On the right side of the header, a three-button toggle lets you change the chart:

- **Donut chart** - circular chart with a hole in the middle (default)  
- **Pie chart** - full circle slices  
- **Bar chart** - horizontal bars from 0% to 100%

You can switch chart type **without reloading the data**, it just changes the visualization.

### Data & Percentages

For each category (sector / type / country), the backend aggregates:

- **Total market value** (sum of positions in that category)  
- **Cost basis**  
- **Unrealized P&L** and **P&L %**  
- **Number of assets** in the category  

Then it computes:

  - If portfolio value is known:

    $\text{Allocation (\%)} = \frac{\text{Category total value}}{\text{Total portfolio value}} \times 100$

  - Otherwise:  

    $\text{Allocation (\%)} = \frac{\text{Number of assets in category}}{\text{Total number of assets}} \times 100$

The legend shows up to **5 main categories**, with:

- **Rounded percentages**:
  - `< 0.1%` → two decimals (e.g. `0.07%`)  
  - `< 1%` → one decimal (e.g. `0.8%`)  
  - `≥ 1%` → whole numbers (e.g. `12%`)  
- A **tooltip** on hover with the **full label + precise %**

On hover in the chart, the tooltip shows:

> `Label: XX.X%`

---

## Example

In the **Sector** tab, you might see:

- **Technology – 38%**  
- **Healthcare – 18%**  
- **Financials – 15%**  
- **Consumer Discretionary – 12%**  
- **Energy – 7%**  

In the **Type** tab:

- **Stocks – 70%**  
- **ETFs – 20%**  
- **Crypto – 8%**  
- **Cash / Other – 2%**  

In the **Country** tab:

- **USA – 55%**  
- **France – 20%**  
- **Germany – 10%**  
- **Japan – 8%**  
- **Other – 7%**  

By glancing at the chart and legend, you immediately see if you're:

- **Overexposed** to a single sector or country  
- Heavily tilted toward **equities vs ETFs vs crypto**, etc.

---

## When To Use It

The Asset Allocation widget is useful for:

- Checking your **diversification** across sectors, asset types, and countries  
- Spotting **over-concentration risk** (e.g. too much in Tech or one region)  
- Aligning your portfolio with your **risk profile** and **investment strategy**  
- Preparing for **risk discussions** (e.g. "I'm 60% US Tech")  
- Combining with other widgets like **Concentration Risk**, **Largest Holdings**, or **Top Performers** for deeper insights

---

## Notes

- The sectors are based on GICS classification
- When portfolio data changes (new trades, price updates), the widget **re-fetches distributions** to stay up to date  
- Percentage calculations include both **open** and **sold** positions for better historical context when backend data allows it 
- If no allocation data is available yet (e.g. empty portfolio), the widget shows a **friendly empty state** instead of a blank chart
