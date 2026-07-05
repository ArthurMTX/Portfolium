## Portfolio Heatmap

### What It Shows

The Portfolio Heatmap turns your holdings into a grid of colored tiles you can read in a couple of seconds: **tile size shows how big a position is, tile color shows how it's doing today.**

Each tile displays:

- the asset's logo, symbol, and (on larger tiles) its name;
- its **weight** in the portfolio;
- its **daily change**, as a percentage, with an up or down arrow.

Bigger, more dominant positions get bigger tiles. Greener tiles are having a good day; redder tiles are having a bad one. Hovering a tile shows a tooltip with the exact daily change.

---

### How It's Built

**Tile size** is driven by the position's weight — its market value as a share of your total portfolio value:

$$
\text{weight} = \frac{\text{position market value}}{\text{total portfolio value}} \times 100
$$

The grid has $4$ columns, and each tile's span is chosen from its weight:

| Weight | Tile size |
|---|---|
| $\geq 20\%$ | largest (spans 3 columns, 2 rows) |
| $\geq 10\%$ | large (spans 2 columns, 2 rows) |
| $\geq 5\%$ | medium (spans 2 columns, 1 row) |
| $< 5\%$ | small (1 column, 1 row) |

**Tile color** is driven by the position's daily change percentage:

| Daily change | Color |
|---|---|
| $> +3\%$ | darkest green |
| $+1\%$ to $+3\%$ | medium green |
| $0\%$ to $+1\%$ | light green |
| $0\%$ to $-1\%$ | light red |
| $-1\%$ to $-3\%$ | medium red |
| $< -3\%$ | darkest red |
| no data | neutral grey |

Tiles are laid out sorted by market value, descending, so your largest positions cluster toward the top of the grid.

---

### Example

Picture a portfolio like this:

| Position | Weight | Daily change | Tile |
|---|---|---|---|
| NVDA | $25\%$ | $+4.20\%$ | Huge, darkest green |
| MSFT | $12\%$ | $+0.80\%$ | Large, light green |
| AAPL | $7\%$ | $-0.50\%$ | Medium, light red |
| Several smaller positions | $1$–$3\%$ each | mixed | Small tiles, various shades |

At a glance, you can immediately tell that NVDA both dominates the portfolio and is having the best day of anyone in it — without reading a single number.

---

### When To Use It

Use the Portfolio Heatmap when you want to:

- get an instant visual feel for your portfolio's shape and mood;
- spot which large positions are swinging the most on a given day;
- notice concentration risk — a handful of oversized tiles is a visual cue to check [Largest Holdings](largest-holdings.md) or your concentration metrics;
- do a quick daily check-in without reading a table.

---

### Notes & Limitations

- **Only positions with a positive market value are shown** — closed or zeroed-out positions don't appear, so the grid always reflects your current holdings.
- **Color reflects today only** — a bright green tile can belong to a position that's still down significantly overall. For total gain/loss, check [Top Performers](top-performers.md), [Worst Performers](worst-performers.md), or [Positions](positions.md).
- **Grey tiles mean missing data**, not necessarily "no change" — it shows up when a daily change figure isn't available yet.
- Colors adapt automatically to light and dark mode; the green-for-up, red-for-down logic stays the same either way.
