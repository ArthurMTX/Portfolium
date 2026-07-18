# Cash Management

Portfolium can track the cash side of your portfolio — deposits, withdrawals,
multi-currency balances, interest, fees, taxes and Forex conversions — while
staying entirely optional. If you never enable it, nothing changes: purchases
still work without a prior deposit, exactly as before.

## Cash tracking modes

Every portfolio has a cash mode:

| Mode | Behavior |
|------|----------|
| **Untracked** (default) | The historical Portfolium behavior. No cash balance exists, purchases never require a deposit, and no cash appears in valuation or allocation. Transactions are never rejected because of insufficient cash. |
| **Tracked — warnings** | Cash is tracked per currency. Balances may go negative; Portfolium shows a warning instead of blocking the operation. Recommended when you enable tracking. |
| **Tracked — strict** | Operations that would push a currency balance below zero are rejected with a detailed error (currency, available, required, missing amounts). Validation runs against the balance at the transaction's date, not just today's. |

All portfolios created before cash tracking existed remain **untracked**, and
your values, performance and history stay exactly the same until you opt in.

## Enabling cash tracking

Open the **Cash** page and choose **Enable cash tracking**. Two starting
points are available:

- **Reconstruct from my transactions** (recommended) — Portfolium scans your
  entire transaction history automatically (no date to choose) and replays
  your buys, sells, dividends, fees and taxes into cash movements. Because
  historical deposits are usually not recorded, Portfolium infers them:
  cash starts at zero, and whenever a purchase (fees included) needs more
  cash than the reconstruction has available, an **estimated deposit** for
  the exact missing amount is added on that day. Money you received from
  sales or dividends stays available for later purchases, so only the
  minimum funding is ever inferred. The review step lists these estimated
  deposits, and nothing is applied without your explicit confirmation.
- **Start fresh from a date** — you pick an activation date and the opening
  balance of each currency. Transactions before that date never affect cash.

The review step shows projected balances per currency, the estimated
deposits (reconstruction only), the earliest negative dip if any, and how
many movements will be created. Activation is atomic: either everything is
applied or nothing is.

!!! note "Estimated deposits are an assumption, not a record"
    The reconstruction assumes you contributed **only the minimum amount
    needed** to execute each recorded transaction, exactly when it was
    needed, and never withdrew anything — your real deposit and withdrawal
    history was never recorded. Estimated deposits are labeled as such in
    the movement list so they are never confused with deposits you entered
    yourself. If your real funding history differed (for example you
    withdrew sale proceeds over the years), edit or replace the estimated
    deposits afterwards — editing one marks it as confirmed by you — or add
    an adjustment to match your broker's actual cash balance.

## What moves cash

Once tracking is enabled:

| Operation | Cash effect |
|-----------|-------------|
| Buy | debits quantity × price, plus fees |
| Sell | credits quantity × price, minus fees |
| Dividend (received) | credits the gross amount, debits the withholding tax |
| Standalone fee / tax | debit |
| Interest | credit |
| Deposit / withdrawal | external cash flow in / out |
| Forex conversion | debits the source currency, credits the target currency |
| Stock splits, transfers, crypto swaps | cash-neutral (a swap only debits its fee) |

Pending dividends never touch cash — only dividends you accept (which become
real transactions) do.

## Balances and valuation

Each currency keeps its own balance; Portfolium never merges them silently.
The Cash page shows every native balance plus its conversion into the
portfolio base currency using the current exchange rate. When a rate is
stale or unavailable, the balance is flagged and **excluded** from the
converted total — it is never assumed to convert 1:1.

For tracked portfolios, cash is part of the portfolio total value, of the
historical value chart (from the activation date onward) and of the
allocation view as an aggregate **Cash** category. Negative balances never
count as a positive allocation weight; they are listed separately.

## Cash and performance

A cash balance is not profit. Deposits and withdrawals are external flows:
depositing 10 000 EUR is not a 10 000 EUR gain, and the total-return figures
never interpret contributions as performance. Cash-related income (interest)
and costs (standalone fees, taxes) are reported in the cash summary. Fees
attached to buys and sells stay inside the asset cost basis and proceeds, as
they always have — they are not double-counted in the cash breakdown.

Forex P&L (the gain or loss from holding foreign currency itself) is **not
computed in this release**. The data needed for it is recorded with every
movement, and the API reports it as *unavailable* rather than showing an
approximate number.

## Forex conversions

Use **Convert currency** on the Cash page to move cash between currencies.
A conversion records two linked movements (debit source, credit target) plus
an optional fee in either currency, and stores the effective exchange rate
(target units per one source unit). Portfolium never converts currencies
automatically — buying a USD asset will not silently spend your EUR cash.
In strict mode the source currency must cover the conversion.

## Changing or disabling the mode

- **Warnings → Strict** requires the entire cash history to be non-negative;
  Portfolium checks it and tells you the earliest gap otherwise.
- **Strict → Warnings** is always allowed.
- **Disabling tracking** keeps your cash history — it is only excluded from
  valuation and validation. Re-enabling is possible as long as no transaction
  changed in the meantime; otherwise Portfolium asks you to wipe and
  re-activate so cash never silently drifts from your transactions.
- **Deleting the cash history** is a separate, explicit action, available
  only while tracking is disabled.

## CSV imports

Imports respect the cash mode:

- **Untracked** — unchanged behavior.
- **Warnings** — imported transactions generate their cash movements; the
  import report lists any projected negative balances.
- **Strict** — the whole file is validated first and imported atomically:
  if any row lacks cash (or fails to parse), nothing at all is imported.

The import preview shows projected cash warnings before you commit. CSV rows
for deposits, withdrawals or Forex conversions are not supported yet — record
those on the Cash page.

## Privacy

Publicly shared portfolios never expose cash balances or movements.
