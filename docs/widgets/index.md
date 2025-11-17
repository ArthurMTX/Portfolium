# Widgets Overview

Portfolium's dashboard is built around modular, customizable **widgets**.  
Each widget provides a specific function—such as performance metrics, tables, watchlists, or system indicators—and can be freely arranged on your Dashboard.

This section documents every widget available in Portfolium and explains how each one works.

---

## What Are Widgets?

Widgets are independent UI blocks that you can:

- add or remove  
- move anywhere on the grid  
- resize freely  
- reorder at any time  

Each widget updates dynamically based on:

- market data  
- your portfolio state  
- refresh settings  
- user preferences  

Portfolium automatically saves your custom layout and restores it when you return to the Dashboard.

---

## Widget Categories

### Key & Metrics

Widgets that display simple numeric values and performance indicators.

Examples:

- Total Value  
- Daily Gain
- Goal Tracker
- Market Sentiment
- VIX Index

---

### Data & Lists

Widgets that focus on tabular data and lists.

Examples:

- Recent Notifications
- Watchlist
- Positions Table

---

### Charts & Insights

Widgets that show graphical data visualizations and analytics.

Examples:

- Concentration Risk
- Largest Holdings
- Market Status
- Heatmap

---

## Widget Anatomy

Each widget in Portfolium has a common structure:

- **ID** — unique string used internally (e.g. `total-value`, `daily-gain`, `watchlist`)  
- **Layout defaults** — default size and minimum size on the grid (`w`, `h`, `minW`, `minH`)  
- **Data sources** — portfolio, transactions, live prices, cached data, or user settings  
- **Refresh behavior** — whether it participates in auto-refresh, manual refresh only, or lazy loading  
- **Interactions** — clicks, navigation to detail pages, sorting, or filters (where applicable)

Individual widget pages describe these aspects in more detail.

---

## List of Widgets

Each widget has its own documentation page with detailed information.
You can find links to each widget's documentation in the sidebar.

---

## Related Documentation

For more information on how the Dashboard and layout system work:

- [Dashboard](../user-guide/dashboard.md) – overall Dashboard behavior
- [Example Layouts](../user-guide/example-layouts.md) – sample widget arrangements
