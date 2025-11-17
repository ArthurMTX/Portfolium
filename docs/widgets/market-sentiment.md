# Market Sentiment

The **Market Sentiment** widget visualizes the current **fear vs. greed** level in the market on a **0–100 scale**.  
In its default configuration, it tracks **stock market sentiment** using the **CNN Fear & Greed Index**.

It is a contextual indicator: it does **not** depend on your portfolio, but on **overall market mood**.

---

## What It Shows

The widget displays:

- A **gauge from 0 to 100** showing the current sentiment score  
- A **text label** describing the sentiment (e.g. *Extreme Fear*, *Fear*, *Neutral*, *Greed*, *Extreme Greed*)  
- A **small change indicator** vs. the previous reading (e.g. `+2`, `-5`)  

Sentiment zones:

- **0–25** – *Extreme Fear*  
- **25–45** – *Fear*  
- **45–55** – *Neutral*  
- **55–75** – *Greed*  
- **75–100** – *Extreme Greed*  

Coloring on the gauge follows these zones, from red (**fear**) to green (**greed**).

This widget answers the question:  
> "Is the market currently fearful, neutral, or greedy?"

---

## How It Works

### Data source

For **stock** market sentiment, Portfolium uses the **CNN Fear & Greed Index** via an official data endpoint:

- The backend calls a CNN dataviz API for **today's data**
- A browser-like user agent and headers are used to ensure reliable access
- Results are cached server-side to avoid unnecessary external calls

The API returns:

- `score` – current sentiment score (0–100)  
- `rating` – textual rating (e.g. `extreme fear`, `fear`, `neutral`, `greed`, `extreme greed`)  
- `previous_close` – previous day's score  
- `timestamp` – when the data was recorded  

### Widget logic

On the frontend, the raw values are mapped to:

   - `score` – current index value (0–100)  
   - `rating` – used to compute a translated label (*Extreme Fear*, *Fear*, *Neutral*, *Greed*, *Extreme Greed*)  
   - `previousScore` – `previous_close` or `previous_value`  

The **change** vs. previous value is:

$$
\Delta = \text{Score}_{\text{today}} - \text{Score}_{\text{previous}}
$$

- If $\Delta > 0$ → change is shown as **`+Δ`** in green  
- If $\Delta < 0$ → change is shown as **`-Δ`** in red  
- If data is missing, no change indicator is shown  

---

## Example

Suppose today's CNN Fear & Greed data returns:

- `score = 72`  
- `rating = "greed"`  
- `previous_close = 68`  

The widget will show:

- Gauge pointer around **72** in the **"Greed"** (light green) zone  
- Text label: **Greed**  
- Change indicator: **`+4`** in green  

If the API cannot be reached or returns invalid data:

- The gauge falls back to **0**, and labels may show **Unknown**  
- The widget may appear without a change indicator or with degraded information, depending on available fields

---

## When To Use It

The Market Sentiment widget is useful for:

- Gauging overall **risk appetite** in the market at a glance  
- Providing macro context for **buying, selling, or hedging decisions**  
- Complementing metrics like **Volatility**, **Drawdown**, and **Beta**  
- Helping you avoid overreacting during **extreme fear** or **extreme greed** periods  

It's especially helpful when:

- You want to compare your portfolio behavior to **broader market mood**  
- You are considering adding risk during **fear** or reducing exposure during **greed**

---

## Notes

- By default, this widget is configured for the **stock market** using the CNN Fear & Greed Index  
- Data is **cached** and periodically refreshed to avoid excessive external requests  
- Values range from **0 (maximum fear)** to **100 (maximum greed)**  
- This widget is **informational** and does not directly interact with your positions or portfolio metrics  