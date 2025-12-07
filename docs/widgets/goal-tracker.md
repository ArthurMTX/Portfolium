# Goal Tracker

The **Goal Tracker** widget lets you set a **target portfolio value** and see how close you are to reaching it.  
It combines a **circular progress indicator**, key amounts (current, goal, remaining), and a **rough time estimate** based on assumed market returns.

---

## What It Shows

The widget focuses on a single portfolio-level goal:

- **Circular progress** toward your target value (in %)  
- **Current portfolio value** (based on **Total Value** from your metrics)  
- **Goal amount** (your target value, editable per portfolio)  
- **Amount remaining** to reach the goal  
- **Estimated time to goal** (in years/months, optional)  
- A short **info line** at the bottom (congratulations, estimate disclaimer, or hint to set a goal)

All amounts are displayed in your **portfolio's base currency**.

---

## Goal & Progress

- **Goal amount**  
    - One goal per portfolio, stored in the browser's localStorage.
    - Default:
        - **Preview mode**: `15,000` (mock target)
        - **Real mode**: `100,000` (until you change it)

- **Current value**  
    - Uses **Total Value** from the dashboard context.  
    - If metrics are missing, defaults to `0`.

- **Progress %**  
    - $\text{progress} = \min\left(\frac{\text{currentValue}}{\text{goalAmount}} \times 100, 100\right)$
    - Clamped at **100%** when you reach or exceed the goal.  
    - When $\text{currentValue} \geq \text{goalAmount}$, the widget displays a small **"Goal reached"** label inside the circle.

- **Remaining to goal**
    - $\text{remaining} = \max(\text{goalAmount} - \text{currentValue}, 0)$  
    - Only shown if the goal is **not yet reached**.

---

## Editing the Goal

You can update your target directly from the widget:

1. Click **"Edit goal"** (top-right).  
2. Enter a new amount in the input field.  
3. Press **Enter**, click **Save**, or hit **Escape** to cancel.

Validation:

- The new goal must be a **positive number**.  
- If the value is invalid, the widget **reverts** to the previous goal.

The goal is **saved per portfolio and per device** (because it's stored in localStorage with the portfolio ID).  
If you switch portfolio, the widget automatically uses the goal associated with that portfolio.

---

## Circular Progress Display

In the center of the widget, you get a **ring-style progress circle**:

- Grey background circle = 100% of the goal  
- Colored arc = current percentage of completion  
    - Default: emerald shades, slightly different if the goal is reached  
- Percentage is shown in **large text** in the middle (`0–100%`).  
- When the goal is reached, a small **"Goal reached"** text appears below the percentage.

This gives you an immediate visual sense of how far along you are.

---

## Time to Goal (Estimate)

Below the progress ring, the widget can show an **estimated time to reach the goal**:

- Only shown if:
    - The goal is **not reached**  
    - $\text{currentValue} > 0$
    - $\text{remaining} > 0$
- Uses a **simplified growth model** with a fixed **8% annual return assumption**.

The estimate is calculated by:

- Assuming **constant annual growth** at 8%  
- Solving: $\text{goalAmount} = \text{currentValue} \times (1 + 0.08)^{\text{years}}$  
- Then formatting the result as:
    - `<N> months` if less than 1 year
    - `Xy Ym` if multiple years and months  
    - `X years` if months round to 0  

A note at the bottom reminds you that this is a **rough estimate** based on an 8% return, not a guarantee.

---

## Info Messages

At the bottom of the widget, a **short message** adapts to your situation:

- If the goal is reached → **congratulatory message**  
- Else if time-to-goal is available → text explaining that the estimate assumes ~8% yearly returns  
- Else → a hint to **set or adjust** your goal to something realistic

---

## When To Use It

The Goal Tracker widget is useful for:

- Setting a **clear portfolio target** (e.g. 25k, 100k, 1M…)  
- Tracking your **long-term progress** rather than just daily P&L  
- Getting a **rough idea** of how long it might take to reach your number (assuming markets behave reasonably)  
- Motivating yourself with a **visual completion circle** that updates as your portfolio grows

---

## Notes

- This widget is WIP and may evolve over time based on user feedback.
- A lot of ameliorations could be made, such as:
    - More sophisticated growth models for the time estimate (rather than fixed 8%)
    - Additional goal types (e.g. percentage growth rather than absolute value)  
    - Syncing goals across devices via user accounts
