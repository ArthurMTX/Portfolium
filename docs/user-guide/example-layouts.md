# Dashboard Example Layouts

This guide provides custom dashboard layout examples for different user types and investment strategies. You can import these layouts directly or use them as inspiration for creating your own.

## 📊 Available Widgets

### Metrics (Core KPIs)
- **Total Value** - Your total portfolio value
- **Daily Gain** - Track daily portfolio changes
- **Unrealized P&L** - Unrealized profit and loss
- **Realized P&L** - Realized profit and loss from sold positions
- **Dividends & Fees** - Total dividends earned and fees paid

### Insights (Performance & Analysis)
- **Total Return** - Combined return calculation (unrealized + realized + dividends - fees)
- **Win Rate** - Percentage of positions currently in profit
- **Concentration Risk** - Allocation to top 3 positions with risk warning
- **Best/Worst Today** - Top gainer and loser positions for the day
- **Performance Metrics** - Week/Month/YTD performance overview
- **Top Performers** - Best 5 positions by return percentage
- **Worst Performers** - Worst 5 positions by return percentage
- **Largest Holdings** - Top 5 positions by market value with allocation
- **Market Status** - Current US market hours and status
- **Market Indices** - Major market indices (S&P 500, DAX, Nikkei, etc.)

### Data (Lists & Tables)
- **Positions Table** - All current and sold positions
- **Recent Transactions** - Last 5 transactions timeline
- **Recent Notifications** - Latest 5 notifications
- **Watchlist** - Top 5 watchlist items

---

## 🎯 Example Layouts by User Type

### 1. **The Quick Glancer** - Minimalist Layout
*Perfect for: Busy professionals who want a quick portfolio overview*

**Philosophy:** Less is more. Focus only on essential metrics without distractions.

**Widgets:**
- Total Value (large)
- Daily Gain (large)
- Unrealized P&L (medium)
- Positions Table (full width)

**Use Case:** Check portfolio value and daily changes in under 5 seconds before heading to meetings.

---

### 2. **The Day Trader** - Active Trading Layout
*Perfect for: Active traders who need real-time market insights*

**Philosophy:** Market status first, quick action data, top movers.

**Widgets:**
- Market Status (side panel)
- Market Indices (side panel)
- Daily Gain (prominent)
- Best/Worst Today (center)
- Top Performers (left)
- Worst Performers (right)
- Recent Transactions (bottom)
- Watchlist (compact)

**Use Case:** Monitor market hours, track intraday movements, quickly identify trading opportunities.

**Recommended Features:**
- Auto-refresh enabled (30-60 seconds)
- Market Status widget always visible
- Keep Best/Worst Today front and center

---

### 3. **The Long-Term Investor** - Buy & Hold Layout
*Perfect for: Warren Buffett disciples and dividend investors*

**Philosophy:** Focus on total return, dividends, and concentration risk.

**Widgets:**
- Total Return (large)
- Dividends & Fees (large)
- Performance Metrics (Week/Month/YTD)
- Concentration Risk (center)
- Largest Holdings (prominent)
- Realized P&L (medium)
- Positions Table (bottom, full width)

**Use Case:** Monitor long-term performance, ensure proper diversification, track passive income.

---

### 4. **The Risk Manager** - Diversification Focus
*Perfect for: Conservative investors concerned about portfolio balance*

**Philosophy:** Risk metrics and diversification monitoring.

**Widgets:**
- Total Value (medium)
- Concentration Risk (large, prominent)
- Largest Holdings (large)
- Win Rate (medium)
- Best/Worst Today (side panel)
- Unrealized P&L (medium)
- Realized P&L (medium)
- Positions Table (bottom)

**Use Case:** Ensure no single position is too large, monitor portfolio balance, track winners vs losers.

---

### 5. **The Performance Analyst** - Data-Driven Layout
*Perfect for: Quantitative investors and data enthusiasts*

**Philosophy:** Maximum data, multiple performance views, comprehensive analysis.

**Widgets:**
- Total Return (top)
- Performance Metrics (prominent)
- Win Rate (with chart)
- Top Performers (left column)
- Worst Performers (right column)
- Largest Holdings (center)
- Daily Gain (small)
- Unrealized P&L (small)
- Realized P&L (small)
- Positions Table (bottom)

**Use Case:** Deep dive into performance metrics, compare different time periods, identify patterns.

---

### 6. **The News Watcher** - Information Hub
*Perfect for: Investors who stay on top of market news and notifications*

**Philosophy:** Stay informed, track watchlist, monitor notifications.

**Widgets:**
- Market Status (top)
- Market Indices (side)
- Recent Notifications (prominent)
- Watchlist (prominent)
- Daily Gain (medium)
- Best/Worst Today (medium)
- Recent Transactions (bottom half)
- Positions Table (bottom half)

**Use Case:** Track breaking market news, monitor watchlist for entry points, stay updated on portfolio events.

---

### 7. **The Mobile-First User** - Compact Layout
*Perfect for: Users primarily accessing via mobile/tablet*

**Philosophy:** Vertical stack, mobile-optimized, scrollable.

**Widgets (stacked vertically):**
1. Total Value
2. Daily Gain
3. Win Rate
4. Best/Worst Today
5. Largest Holdings
6. Recent Notifications
7. Positions Table (condensed)

**Use Case:** Quick mobile check-ins, thumb-friendly navigation.

---

### 8. **The Dividend Tracker** - Income Focus
*Perfect for: Income investors focused on passive income generation*

**Philosophy:** Dividends first, income-generating positions, realized gains.

**Widgets:**
- Dividends & Fees (large, prominent)
- Total Return (large)
- Realized P&L (medium)
- Performance Metrics (medium)
- Largest Holdings (prominent - to see dividend payers)
- Positions Table (filtered to show dividend-paying stocks)

**Use Case:** Track dividend income, monitor realized profits, ensure dividend-paying stocks are core holdings.

---

### 9. **The Comparison Tracker** - Benchmark Focus
*Perfect for: Investors who compare their performance vs market indices*

**Philosophy:** Compare portfolio vs market performance.

**Widgets:**
- Total Return (large)
- Performance Metrics (prominent)
- Market Indices (prominent - S&P 500, etc.)
- Daily Gain (medium)
- Win Rate (medium)
- Top Performers (side)
- Positions Table (bottom)

**Use Case:** See if you're beating the market, track alpha generation.

---

### 10. **The Beginner** - Learning Layout
*Perfect for: New investors learning the ropes*

**Philosophy:** Clear, simple, educational tooltips on everything.

**Widgets:**
- Total Value (large with explanation)
- Daily Gain (large)
- Unrealized P&L (medium with tooltip)
- Realized P&L (medium with tooltip)
- Win Rate (medium - encouraging metric)
- Positions Table (bottom - learn by doing)

**Use Case:** Understand basic concepts, see immediate impact of trades, build confidence.

---

## 🛠️ Suggested Additional Widgets

Based on different user needs, here are widget ideas that could enhance the dashboard:

### High Priority Additions

#### 1. **Asset Allocation Chart Widget**
- **Category:** Insights
- **Size:** 4-6 width, 6-8 height
- **Description:** Pie/donut chart showing allocation by sector, asset type, or geography
- **Use Cases:** Risk Manager, Long-Term Investor
- **Why:** Visual representation helps identify over-concentration quickly

#### 2. **Portfolio Heatmap Widget**
- **Category:** Insights
- **Size:** 12 width, 8-10 height
- **Description:** Treemap showing all positions with color-coded performance
- **Use Cases:** Performance Analyst, Day Trader
- **Why:** See entire portfolio at a glance, quickly spot winners/losers

#### 3. **Cost Basis Tracker Widget**
- **Category:** Insights
- **Size:** 4 width, 5-6 height
- **Description:** Shows positions by cost basis vs current price
- **Use Cases:** Risk Manager, Long-Term Investor
- **Why:** Tax-loss harvesting opportunities, rebalancing decisions

#### 4. **Sector Performance Widget**
- **Category:** Insights
- **Size:** 4-6 width, 6-7 height
- **Description:** Compare your sector allocation vs S&P 500 benchmarks
- **Use Cases:** Risk Manager, Performance Analyst
- **Why:** Identify sector tilts and diversification gaps

#### 5. **Upcoming Dividends Calendar Widget**
- **Category:** Data
- **Size:** 4 width, 6-8 height
- **Description:** Calendar view of expected dividend payments
- **Use Cases:** Dividend Tracker, Long-Term Investor
- **Why:** Plan cash flow, track passive income

#### 6. **Goal Progress Widget**
- **Category:** Metrics
- **Size:** 3-4 width, 4-5 height
- **Description:** Visual progress bar toward portfolio value goals
- **Use Cases:** Beginner, Long-Term Investor
- **Why:** Motivation, track progress toward retirement/savings goals

### Medium Priority Additions

#### 7. **Average Position Size Widget**
- **Category:** Metrics
- **Size:** 2-3 width, 2 height
- **Description:** Average dollar value per position
- **Use Cases:** Risk Manager
- **Why:** Ensure consistent position sizing

#### 8. **Idle Cash Tracker Widget**
- **Category:** Metrics
- **Size:** 2-3 width, 2 height
- **Description:** Shows uninvested cash amount
- **Use Cases:** Day Trader, Active Investor
- **Why:** Maximize capital deployment

#### 9. **Volatility Meter Widget**
- **Category:** Insights
- **Size:** 3 width, 3-4 height
- **Description:** Portfolio volatility/beta vs market
- **Use Cases:** Risk Manager, Performance Analyst
- **Why:** Understand portfolio risk profile

#### 10. **Holdings Timeline Widget**
- **Category:** Insights
- **Size:** 6-8 width, 5-6 height
- **Description:** Horizontal timeline showing position hold periods
- **Use Cases:** Long-Term Investor, Performance Analyst
- **Why:** Identify long-term holdings, visualize portfolio evolution

#### 11. **Tax Impact Summary Widget**
- **Category:** Metrics
- **Size:** 4 width, 4-5 height
- **Description:** Short vs long-term gains, estimated tax liability
- **Use Cases:** Performance Analyst, Risk Manager
- **Why:** Tax planning, optimize selling strategy

#### 12. **Portfolio Correlation Matrix Widget**
- **Category:** Insights
- **Size:** 6-8 width, 6-8 height
- **Description:** Correlation heatmap between holdings
- **Use Cases:** Performance Analyst, Risk Manager
- **Why:** Identify hidden concentration risk

### Nice to Have

#### 13. **News Feed Widget**
- **Category:** Data
- **Size:** 4-6 width, 8-10 height
- **Description:** Aggregated news for portfolio holdings
- **Use Cases:** News Watcher, Day Trader
- **Why:** Stay informed about portfolio companies

#### 14. **Quick Trade Widget**
- **Category:** Action
- **Size:** 4 width, 5-6 height
- **Description:** Quick trade entry for common positions
- **Use Cases:** Day Trader, Active Investor
- **Why:** Faster trade execution

#### 15. **Social Sentiment Widget**
- **Category:** Insights
- **Size:** 4 width, 6-7 height
- **Description:** Social media sentiment for holdings
- **Use Cases:** Day Trader, News Watcher
- **Why:** Alternative data source for decision-making

---

## 📥 How to Use Example Layouts

### Option 1: Import from Library
1. Click "Edit" mode on dashboard
2. Click "Layouts" button
3. Browse "Layout Library" tab
4. Click "Import" on your preferred layout
5. Customize to your needs

### Option 2: Manual Setup
1. Enable "Edit" mode
2. Click "Widgets" to add/remove widgets
3. Drag and resize widgets to match the layout
4. Click "Done" and save your layout

### Option 3: Export/Import JSON
1. Someone shares their layout JSON
2. Click "Layouts" → "Import Layout"
3. Paste JSON and click "Import"
4. Layout applies instantly

---

## 💡 Tips for Creating Your Own Layout

1. **Start with a template** - Use one of the examples as a base
2. **Prioritize by frequency** - Most-viewed widgets at the top
3. **Consider your device** - Mobile users need simpler layouts
4. **Use breakpoints** - Desktop and mobile can have different layouts
5. **Test and iterate** - Live with a layout for a week before deciding
6. **Multiple layouts** - Create different layouts for different scenarios
7. **Name meaningfully** - "Morning Check" vs "End of Day Review"
8. **Share with community** - Export and share great layouts!

---

## 🎨 Layout Design Principles

### Visual Hierarchy
- **Primary metrics** (3-4 width): Total Value, Daily Gain
- **Secondary metrics** (2-3 width): Other P&L metrics
- **Analysis widgets** (4-6 width): Charts and lists
- **Tables** (8-12 width): Full-width for data tables

### Common Patterns
```
┌─────────────────────────────────────┐
│  Large Metric  │  Large Metric  │..│  ← Row 1: Key metrics
├─────────────────────────────────────┤
│   Analysis     │   Analysis     │..│  ← Row 2: Insights
├─────────────────────────────────────┤
│  Full Width Table or Chart         │  ← Row 3: Detailed data
└─────────────────────────────────────┘
```

### Responsive Design
- **Desktop (lg)**: 12 columns - show everything
- **Tablet (md)**: 8 columns - prioritize key widgets
- **Mobile (sm)**: 4 columns - vertical stack only essentials

---

## 🚀 Next Steps

1. **Try an example layout** - Start with one that matches your investing style
2. **Customize** - Add/remove widgets based on your needs
3. **Create multiple layouts** - Morning check, deep analysis, quick glance
4. **Share** - Export your layout and share with the community
5. **Provide feedback** - Let us know what widgets you'd like to see added!

---

## 📚 Related Documentation

- [Dashboard Overview](dashboard.md) - Learn dashboard basics
- [Settings Guide](settings.md) - Customize your experience
