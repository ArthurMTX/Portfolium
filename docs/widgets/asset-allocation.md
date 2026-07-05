## Asset Allocation

### What It Shows

Asset Allocation shows **where your money actually sits** — broken down by sector, asset type, or country — so you can spot concentration or diversification at a glance.

The widget has three tabs:

- **Sector** — industry sector (Technology, Healthcare, Energy, Financials, etc.)
- **Type** — asset type (Stocks, ETFs, Crypto, and other categories present in your portfolio)
- **Country** — country or market of listing (USA, France, Japan, etc.)

For whichever tab is active, you get a chart (donut, pie, or horizontal bar — switchable without reloading data) plus a legend showing each category's share of your portfolio, colored to match the chart. Hovering any slice or bar shows the exact percentage.

Each slice answers:

> "What percentage of my portfolio's value sits in this sector / type / country?"

---

### How It's Built

For each category in the active tab, Portfolium aggregates all your positions (including sold ones, when available, for historical context) that fall into that category, and computes:

- total market value held in that category,
- cost basis and unrealized P&L for that category,
- number of assets held in that category.

The allocation percentage is then:

$$
\text{Allocation (\%)} = \frac{\text{Category market value}}{\text{Total portfolio market value}} \times 100
$$

If current market values aren't available for some reason, the widget falls back to a simple count-based share instead:

$$
\text{Allocation (\%)} = \frac{\text{Number of assets in category}}{\text{Total number of assets}} \times 100
$$

so you still get a rough diversification picture rather than nothing.

The legend shows up to the top $5$ categories, with percentage precision that scales with size — very small slices (under $0.1\%$) get two decimals, small slices (under $1\%$) get one decimal, and everything else is rounded to a whole number.

Sector labels follow the standard GICS sector classification.

---

### Example

**Sector tab:**

| Sector | Allocation |
|---|---|
| Technology | $38\%$ |
| Healthcare | $18\%$ |
| Financials | $15\%$ |
| Consumer Discretionary | $12\%$ |
| Energy | $7\%$ |

**Type tab:**

| Type | Allocation |
|---|---|
| Stocks | $70\%$ |
| ETFs | $20\%$ |
| Crypto | $8\%$ |
| Other | $2\%$ |

A glance at either view tells you immediately whether you're overexposed to one sector, one region, or one kind of asset.

---

### When To Use It

Use Asset Allocation when you want to:

- check your diversification across sectors, asset types, and geographies in one place;
- spot over-concentration before it becomes a problem (e.g., "I'm $60\%$ US Tech");
- confirm your portfolio still matches your intended strategy after a run of trades;
- prepare for a portfolio review or rebalancing decision.

It pairs well with [Concentration Risk](concentration-risk.md) for a position-level view of the same underlying question.

---

### Notes & Limitations

- **Market-value based when possible** — allocation reflects current value, not what you originally paid, so a big winner will show up as a larger slice than it was at purchase.
- **Falls back to a count-based view** if market values aren't available — still directionally useful, but less precise.
- **Empty portfolios** show a friendly empty state instead of a blank chart.
- The chart type (donut, pie, bar) is purely a display preference — switching it does not change the underlying numbers.
- For a risk-focused view of concentration in individual holdings rather than categories, see [Concentration Risk](concentration-risk.md).
