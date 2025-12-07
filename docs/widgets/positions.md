# Positions

The **Positions** widget shows a detailed table of your portfolio holdings directly on the Dashboard.  
It lets you review both your **current positions** and your **sold positions** in one place, with sortable columns and quick access to more details.

---

## What It Shows

The widget is split into two tabs:

- **Current Positions** - all assets you still hold  
- **Sold Positions** - assets you have fully sold (closed positions)

For **current positions**, the table typically includes:

- **Logo** of the asset (or symbol if logo unavailable)
- **Symbol** and **Name** of the asset  
- **Quantity** held  
- **Average cost per share**  
- **Current price**  
- **Daily change (%)**  
- **Market value** (current value of the position)  
- **% of Wallet** (share of this position in your portfolio)  
- **P&L** and **P&L %** (unrealized profit and loss)

For **sold positions**, the table focuses on realized performance:

- **Logo** of the asset (or symbol if logo unavailable)
- **Symbol** and **Name**  
- **Average cost basis**  
- **Average proceeds** (average sale price)  
- **Realized P&L**  
- **Realized P&L %**

Each row gives you a compact summary of how a position is performing (or performed) and how important it is in your portfolio.

---

## How It Works

- Use the tabs at the top of the widget to switch between:
  - **Current Positions**
  - **Sold Positions**
- Each column can be **sorted** by clicking on its header (e.g. sort by symbol, market value, P&L, etc.).  
- Positive P&L values are shown in **green**; negative ones in **red**.
- On **desktop**, the widget appears as a full table.  
- On **mobile**, positions are displayed as **cards** with the most important information grouped together.

Clicking on a position opens a **detail modal**, where you can see more metrics for that asset (such as drawdown, breakeven information, contribution to volatility, etc.).

For current positions that are in loss, the widget also shows a **breakeven helper**:

- When unrealized P&L is **negative**, a small extra line appears under the P&L %  
- It shows the **percentage gain required to reach your average cost again** (e.g. `↗ +156.27%`)  
- This tells you how far the asset would need to climb from the current price to return to **breakeven**

If no positions are available for the selected tab, the widget shows an empty state with a short explanation.

---

## Example

In the **Current Positions** tab, an entry might look like:

- Symbol: **AAPL**  
- Quantity: **15**  
- Average Cost: **$150.00**  
- Current Price: **$190.00**  
- Market Value: **$2,850.00**  
- P&L: **+$600.00** (**+26.67%**)  
- % of Wallet: **12.50%**

In the **Sold Positions** tab, an entry might look like:

- Symbol: **TSLA**  
- Average Cost Basis: **€180.00**  
- Average Proceeds: **€230.00**  
- Realized P&L: **+€500.00**  
- Realized P&L %: **+27.78%**

This allows you to quickly see which positions are driving your current portfolio and which trades have contributed most to your realized performance.

---

## When To Use It

The Positions widget is useful for:

- Monitoring all your **active holdings** at a glance  
- Checking which assets take the largest share of your portfolio  
- Identifying positions with strong gains or deep losses  
- Reviewing how your **closed trades** have performed over time  
- Exploring position details without leaving the Dashboard

---

## Notes

- The data shown in the widget is based on your recorded **transactions** and the latest **market prices**.  
- P&L values match the definitions used in the **Unrealized P&L** and **Realized P&L** widgets.  
- Sorting and totals are specific to the **currently selected portfolio**.  
- For detailed analytics beyond the table, you can combine this widget with **Insights**, **Charts**, and other Dashboard widgets.
