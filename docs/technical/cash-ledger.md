# Cash Ledger

Technical reference for the optional per-portfolio cash tracking introduced
in v0.4.0. User-facing documentation lives in
[Cash Management](../user-guide/cash.md).

## Design

The accounting source of truth is the `portfolio.cash_movements` table — an
append-oriented ledger of signed movements. The balance of a
`(portfolio, currency)` pair is always `SUM(amount)` over its movements;
**no mutable balance column exists**, so nothing can silently diverge from
the ledger. There is deliberately no cached balance in v0.4.0: strict-mode
validation needs a full ledger sweep anyway and display balances are one
indexed aggregate query.

Backend layout:

| Module | Responsibility |
|--------|----------------|
| `app/models/cash.py` | `CashAccount`, `CashMovement` models |
| `app/crud/cash.py` | balance sums, ledger scans, account upserts, row locks |
| `app/services/cash/currencies.py` | currency policy (ISO 4217 + stablecoins) |
| `app/services/cash/ledger.py` | movement derivation, sweep validation, manual operations, FX conversions, transaction orchestration |
| `app/services/cash/activation.py` | activation preview/apply, mode transitions, wipe |
| `app/services/cash/valuation.py` | current valuation, cash PnL breakdown, history series |
| `app/routers/cash.py` | `/portfolios/{id}/cash/*` endpoints |

## Schema

`portfolio.cash_movements` columns (money is `Numeric(20, 8)`):

- `amount` — **signed**; the backend assigns the sign from the movement type.
  API payloads always carry positive amounts.
- `occurred_on` (`Date`) — the accounting date, aligned with the Date-based
  `transactions.tx_date` model. `created_at` is technical audit order only.
- `type` — PostgreSQL enum `portfolio.cash_movement_type`:
  `opening_balance, deposit, withdrawal, buy, sell, dividend, interest, fee,
  tax, fx_debit, fx_credit, adjustment`.
- `transaction_id` — set on movements derived from an asset transaction;
  such movements are immutable through the cash API and are deleted with
  their transaction (`ON DELETE CASCADE` plus explicit replace-on-edit).
- `conversion_id` — UUID linking the legs of one Forex conversion.
- `activation_id` — set on `opening_balance` movements created by an
  activation (reserved for that workflow).
- `base_exchange_rate` — portfolio base-currency units per **1 unit of the
  movement currency**, captured at write time with the historical rate of
  `occurred_on`; `base_currency_amount = amount × base_exchange_rate`. Both
  stay `NULL` when no historical rate is available — never a silent rate
  of 1. These fields are groundwork for future FX PnL.
- `conversion_rate` — target-currency units per **1 source-currency unit**,
  stored on both fx legs. This is the single rate convention used across
  Portfolium (matching `CurrencyService.get_exchange_rate`).

Constraints and indexes:

- `ix_cash_movements_portfolio_ccy_occurred (portfolio_id, currency,
  occurred_on, id)` — the workhorse for balance sums and sweeps;
- partial unique `uq_cash_movements_tx_type (transaction_id, type) WHERE
  transaction_id IS NOT NULL` — a transaction derives at most one movement
  per type, so retries can never duplicate derived movements;
- partial unique `uq_cash_movements_opening_activation (activation_id,
  currency) WHERE type = 'opening_balance'` — database-level idempotency
  backstop for activation;
- `CHECK (amount <> 0)`.

`portfolio.cash_accounts` holds one row per `(portfolio, currency)` and
exists as the row-level locking anchor (see Concurrency).

`portfolio.portfolios` gains: `cash_mode` (enum, default `untracked`),
`cash_tracking_started_on`, `cash_activation_id` (unique),
`cash_activation_meta` (JSON audit record), and the revision counters
described below.

## Accounting rules

**Ordering.** Accounting order is `(occurred_on ASC, id ASC)`, and balances
are only ever inspected at **date boundaries**: all movements sharing an
`occurred_on` apply together before the balance is checked. Consequences:

- a same-day sell funds a same-day buy;
- replace-on-edit (which reassigns ids) can never change any computed
  balance, because intra-day order is irrelevant by construction.

**Transaction → movement mapping** (settlement currency = the transaction's
`currency` column):

| Transaction | Movements |
|-------------|-----------|
| BUY | `buy` −(qty×price); `fee` −fees when fees > 0 |
| SELL | `sell` +(qty×price); `fee` −fees |
| DIVIDEND | `dividend` +(qty×price); `tax` −fees (the `fees` column holds the withholding tax on dividends) |
| FEE | `fee` −fees (falling back to qty×price) |
| CONVERSION_OUT | `fee` −fees (the asset swap itself is cash-neutral) |
| SPLIT, TRANSFER_IN/OUT, CONVERSION_IN | none |

Movements are regenerated with **replace-on-edit**: editing a transaction
deletes and re-derives its movements inside the same SQL transaction as the
row update; deleting a transaction removes them. This matches Portfolium's
mutable-transaction architecture (metrics are always recomputed from source
rows) rather than an append-only compensating-entry model; the audit trail
for asset transactions is the transactions table itself, and the
`(transaction_id, type)` unique index guarantees retries cannot duplicate
entries.

**PnL.** Deposits, withdrawals and opening balances are external flows and
never P&L. Fee/tax movements derived from asset transactions affect cash
only — they are already inside cost basis (buy fees), net proceeds (sell
fees) or the dividend metric (withholding tax), so the cash PnL breakdown
reports only *standalone* fee/tax movements plus interest income. FX PnL is
deferred: `fx_pnl` is always `null` with `fx_pnl_status: "unavailable"`.

**Precision.** Amounts and rates are `Numeric(20, 8)`; derived values are
quantized to 8 decimal places with `ROUND_HALF_UP`.

## Currency policy

Cash currencies are validated against a vendored, frozen ISO 4217 code set
plus an explicit supplemental set `{USDT, USDC}` (stablecoin settlement
units that legitimately appear as crypto settlement currencies). Codes are
normalized to uppercase. `GBX`/pence quotations are rejected with a
dedicated message (record cash in GBP) — dividing by 100 silently would be
an undisclosed conversion. Crypto coins (BTC, ETH, …) are assets, not cash.

For valuation, `CurrencyService` gained a narrowly scoped fallback: when
both `{FROM}{TO}=X` forex pairs fail **and** one side is a supplemental
code, the crypto pair symbol (`USDT-EUR`) is tried. Anything still missing
surfaces as `rate_unavailable` — excluded from converted totals, flagged in
the API, never assumed 1:1.

## Validation and concurrency

Every cash-affecting write follows the same protocol:

1. compute the proposed signed movement set (and, for edits/deletes, the
   set of replaced movement ids);
2. upsert the `cash_accounts` rows of the affected currencies
   (`ON CONFLICT DO NOTHING`);
3. lock them with `SELECT … FOR UPDATE` **in sorted currency order**
   (deadlock-free when conversions touch two currencies; scope is
   portfolio + currency, never a global lock; Redis plays no part in
   accounting correctness);
4. run the date-boundary sweep per currency over the existing ledger with
   the proposal merged in: the merged balance must stay ≥ 0 at the proposed
   debit's own date **and every later boundary** (so a backdated purchase is
   validated against the historical balance, and an insert can never strand
   already-recorded later spending);
5. `tracked_strict`: a violation raises the structured
   `insufficient_cash` error (409) and the whole SQL transaction rolls
   back, releasing the locks with nothing persisted. `tracked_warn`:
   violations become warnings on the response;
6. persist the transaction row and its movements, update the revision
   counters, and commit once.

On SQLite (the offline test suite) `FOR UPDATE` degrades to a plain
`SELECT`; SQLite serializes writers anyway. Lock semantics are covered by
three layers of tests: a compile-level assertion that the statement emits
`FOR UPDATE` on the PostgreSQL dialect, lock-ordering spies on every write
path, and an opt-in **real PostgreSQL race test**
(`tests/test_cash_concurrency.py`, enabled by `CASH_PG_TEST_URL`) in which
two threads fight over the same balance and exactly one wins. The CI
migrations job runs it against its PostgreSQL service.

## Ledger staleness detection

`portfolios.tx_change_seq` is a monotonic counter bumped inside the same
SQL transaction as **every** transaction create/update/delete, in every
cash mode. While a portfolio is tracked, each cash-aware mutation also sets
`cash_ledger_synced_seq = tx_change_seq`. Disabling tracking keeps the
ledger; if any transaction is then created, edited, deleted or backdated,
the counters diverge and re-enabling fails with `cash_ledger_stale` —
the user must wipe and re-activate. This detects every mutation kind
uniformly (deletes included) without per-row bookkeeping.

## Activation

`POST /cash/activation/preview` is a pure dry-run; `POST /cash/activation`
applies atomically in one SQL transaction (portfolio row locked). The
`replay` strategy computes, per currency, the running minimum of the
replayed history and proposes `max(0, −minimum)` as the opening balance —
one opening movement per currency, never a synthetic deposit per purchase.
Apply is idempotent through the client-generated `activation_id`:
re-POSTing the same id returns the stored result, a different id while
tracked is a 409 conflict, and the partial unique index backstops races.
A strict target mode re-runs the full sweep and rejects activation while
any dip remains.

Unsupported settlement currencies on historical transactions are reported
as blocking issues in the preview and reject the apply — cash effects are
never silently dropped.

## Valuation integration

`MetricsService.get_metrics` adds a `cash` summary and includes the
convertible converted total in `total_value` for tracked portfolios
(negative balances included — debt reduces value). Daily gain intentionally
remains an asset-only metric. `get_portfolio_history` adds a per-day cash
series (historical FX per day, memoized) to the chart `value` and exposes
it as `cash_value`; `gain_pct`/`unrealized_pnl_pct` stay asset-only so a
deposit never reads as performance. Untracked portfolios execute none of
this — their metrics code path is unchanged.

Analytics caching: every cash mutation invalidates the portfolio's caches
(the same block as transaction writes), and the analytics fingerprint
accepts an optional `cash_state` component for future cash-dependent
analytics. Public sharing exposes no cash data.

## Testing

All cash tests run offline and deterministically (`tests/test_cash_*.py`):
ledger derivation, balance math, strict/warn sweeps, manual movements, FX
conversions, activation and transitions, valuation integration, CSV import
matrix, untracked-compatibility regression, and the concurrency suite
described above. FX providers are monkeypatched; no test relies on live
rates.
