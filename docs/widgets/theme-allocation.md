## Theme Allocation

### What It Shows

Theme Allocation answers a question sectors and countries can't: **what investment story is your money actually exposed to?** A theme is a real-world narrative or trend — things like "AI Infrastructure," "Data Centers," "Defense Tech," or "Space" — that Portfolium assigns to your stock holdings based on what the underlying company actually does.

For each theme, the widget shows:

- the theme name;
- its **percentage** of your total portfolio value;
- its **value** in your portfolio's base currency.

Clicking a theme opens a detail view listing which specific holdings contribute to it, and how much each one contributes. This matters because the same holding can feed into more than one theme — NVIDIA, for example, might contribute to both "AI Infrastructure" and "Data Centers" at once, each with its own share.

---

### How It's Calculated

Themes are assigned to stocks and equities using an AI-based classification pipeline, not manual tagging — an asset can carry multiple themes simultaneously, each with its own weight reflecting how central that theme is to the business.

To build the allocation:

1. For every current holding with a market value greater than $0$, look at its assigned themes and their weights.
   - If every theme on a holding has a stored weight, those weights are used directly.
   - If weights are missing, the holding's value is instead split **equally** across its themes.
   - If a holding has no themes at all, its full value goes to an **"Unclassified"** bucket.
2. For each theme, sum the weighted market value contributed by every holding that carries it:

$$
\text{theme value} = \sum_{\text{holdings with this theme}} (\text{holding market value} \times \text{theme weight})
$$

3. Compute each theme's percentage of the total portfolio value:

$$
\text{theme \%} = \frac{\text{theme value}}{\text{total portfolio value}} \times 100
$$

4. Sort themes by value, descending.

Because weights are applied per holding, a single stock's value can be split across several themes — the percentages across all themes will generally **not** sum to a clean $100\%$ per holding, but the theme totals still add up to your full portfolio value once every theme (including "Unclassified") is counted.

---

### Example

| Theme | Value | % of Portfolio | Key Contributors |
|---|---|---|---|
| AI Infrastructure | $\$12{,}453$ | $18.4\%$ | NVDA, NBIS, PLTR, AMD |
| Data Centers | $\$9{,}622$ | $14.2\%$ | NVDA, MSFT, AMZN |
| Defense Tech | $\$6{,}583$ | $9.7\%$ | PLTR, LMT |
| Space | $\$4{,}138$ | $6.1\%$ | RKLB, PLTR |

Notice NVDA and PLTR each appear under more than one theme — that's expected, since a single company can be exposed to several trends at once.

---

### When To Use It

Use Theme Allocation when you want to:

- understand your **thematic exposure** beyond traditional sector labels — two "Technology" stocks can represent completely different bets;
- spot concentration in a narrative you didn't realize you were leaning on (e.g. discovering half your "diversified" tech holdings are all really an AI bet);
- check what's actually driving a theme by clicking through to see the contributing assets;
- complement [Portfolio Heatmap](portfolio-heatmap.md) and [Largest Holdings](largest-holdings.md), which group by position rather than by underlying story.

---

### Notes & Limitations

- **Stocks and equities only** — classification currently applies to equity holdings; other asset types won't contribute themes and, if present, would fall under "Unclassified" if included in the totals.
- **"Unclassified" is normal** — a holding without a confident theme match is grouped there rather than force-fit into an unrelated theme.
- **AI-assisted, not guaranteed exact** — theme assignment comes from an automated classification process and reflects Portfolium's best current read of what a company does; it can be revised as the classification improves.
- **Themes can overlap by design** — this is a "what am I exposed to" view, not a strict partition of your portfolio like sector or country allocation.
- Only shown once at least one classified or unclassified holding has value; an entirely empty portfolio shows an empty state.
