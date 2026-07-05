# Charts

Visualize your portfolio's value and performance over time with interactive charts and a position heatmap.

## Overview

The Charts page focuses on how your portfolio has moved: what it's worth today, how that value got there, and how your performance compares to the money you've put in. It's built around three views: a position heatmap, a portfolio value history chart, and an investment performance chart.

For a breakdown of what you're invested in (by sector, country, currency, theme, or market cap), see [Allocation](allocation.md) instead — Charts is about movement over time and at-a-glance position sizing, not composition analysis.

## Accessing Charts

1. Select a portfolio from the dropdown
2. Click **Charts** in the main navigation
3. Choose a view: **Heatmap**, **History**, or **Performance**

!!! note "Requires transaction data"
    Charts need at least one transaction in your portfolio. If you see an empty state, add a transaction first from the [Transactions](transactions.md) page.

At the top of the page you'll always see a quick context strip: your portfolio's current value, total return (in currency and percent), and the date of your first investment.

## Heatmap

The heatmap gives you an instant visual map of your open positions, sized by how much of your portfolio they represent and colored by how they've moved today.

**What it shows**

- Each tile is one position you currently hold
- Tile size is proportional to that position's share of your total portfolio value — bigger holdings get bigger tiles
- Tile color reflects the position's **daily** price change: green shades for a gain today, red shades for a loss today, gray for roughly flat
- Darker/more intense color means a bigger move; a soft green is a small gain, a deep green is a large one

**Reading the tiles**

Each tile shows the asset's logo, symbol, name, portfolio weight, and today's percentage change.

**Selected position panel**

Click any tile to see more detail about that position alongside the heatmap:

- Current weight in the portfolio
- Today's move
- Total unrealized return
- Portfolio contribution in currency
- Sector, country, and theme, when available

From there you can jump straight to that asset's research page.

!!! tip "Spotting concentration and movers at a glance"
    A heatmap with one or two oversized tiles is telling you your portfolio is concentrated in a few names. A heatmap that's mostly one color is telling you today was broadly good or bad for you; a mix of bright green and bright red in your biggest tiles tells you your winners and losers today were both meaningful.

## Portfolio Value History

Tracks your total portfolio value over time as a line chart, so you can see the actual trajectory of your money.

**What it shows**

- Total portfolio value on the vertical axis, date on the horizontal axis
- A smooth line with a gradient fill under it
- Markers for capital events — buys, sells, dividends, and stock splits — plotted directly on the timeline so you can see how specific transactions lined up with changes in value

**Time period controls**

Choose how far back to look: **1W**, **1M**, **3M**, **6M**, **YTD**, **1Y**, or **All** (since your first transaction). The chart rescales both axes to fit the selected range.

**Hovering for detail**

Hover anywhere on the line to see the exact portfolio value on that date. When you hover, the summary above the chart updates to show the value and change as of that specific point instead of the latest one.

**Below the chart**

A short summary of what happened during the period: how much you gained or lost, the highest and lowest points your portfolio reached, and your single largest daily gain and loss.

!!! note "Value reflects deposits and withdrawals too"
    This chart shows your total portfolio value, which moves both from market performance and from money you add or remove. A dip can mean the market fell, or that you withdrew cash — check the capital-event markers on the chart to tell them apart. For a view that isolates investment performance from your own deposits and withdrawals, use the Performance view instead.

## Investment Performance

Shows your portfolio's percentage return over time, separated from the effect of adding or withdrawing cash — so you can judge how your investments actually performed, not just how your balance changed.

**What it shows**

- Percentage return on the vertical axis, date on the horizontal axis
- The line and fill turn green when performance is positive and red when negative, with the color shifting right at the point where the line crosses zero
- For the **All** time range, the line shows your current unrealized gain or loss on today's holdings
- For shorter periods, the line shows a money-weighted return that adjusts for any deposits or withdrawals made during that window, so a large deposit mid-period doesn't distort the percentage

**Time period controls**

Same options as the History view: **1W**, **1M**, **3M**, **6M**, **YTD**, **1Y**, or **All**.

**Performance summary**

Below the chart you'll find your overall performance for the period, best and worst month, the number of positive months out of the total, and an annualized return figure (for the **All** range, this is your total return converted to a yearly rate).

!!! tip "History vs Performance: which to use"
    Use **History** when you want to know what your portfolio is worth and how that dollar value moved. Use **Performance** when you want to know how well your investments are actually doing, independent of how much money you've added or taken out.

## Troubleshooting

### Charts not loading

- Confirm a portfolio is selected — the page needs an active portfolio to load any chart.
- Charts require at least one transaction; if your portfolio is empty, add a transaction first. See [Transactions](transactions.md).
- Check your internet connection and refresh the page if a chart fails to appear.

### Gaps or missing points in the history chart

- Chart accuracy depends on historical price data being available for every asset you've held. If an asset is missing history for part of the period, the chart may show a gap or flat segment there.
- Newly added assets or very recently listed assets may not have long price histories yet.
- Delisted assets can have incomplete price history going forward.

### Heatmap looks empty or wrong

- The heatmap only shows currently held positions — fully sold-out assets won't appear.
- If a tile's weight or color looks off, check that all your buy and sell transactions are entered correctly and that current prices are up to date on the [Dashboard](dashboard.md).
- Unrecorded stock splits will distort both position size and today's percentage move — make sure splits are logged in [Transactions](transactions.md).

### Performance chart doesn't match History chart

- This is expected: History shows raw portfolio value (affected by deposits and withdrawals), while Performance isolates your actual investment return. A big deposit will move the History chart up without moving the Performance chart much, since the deposit itself isn't a gain.

### Unexpected drops in portfolio value

- Selling a position reduces portfolio value even if it wasn't a loss — look for a sell marker on the History chart around the date of the drop.
- A withdrawal of cash will also show as a drop in value without representing a loss.
- If neither explains it, check whether the affected asset has a pricing issue (a bad or missing price for that date).

## Next Steps

- [Dashboard](dashboard.md) for real-time metrics and position details
- [Allocation](allocation.md) to see how your portfolio is distributed by sector, country, and theme
- [Insights](insights.md) for advanced analytics, attribution, and risk metrics
- [Transactions](transactions.md) to keep your transaction history accurate
- [Assets](assets.md) to explore individual asset performance
