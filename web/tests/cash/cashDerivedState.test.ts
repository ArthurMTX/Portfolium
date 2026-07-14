import assert from 'node:assert/strict'
import {
  conversionRate,
  findBalance,
  hasStaleRates,
  isDerivedMovement,
  manualMovementIssue,
  movementTone,
  parseCashErrorDetail,
  parseCashErrorFromMessage,
  projectedBalance,
  summarizeWarnings,
  toAmount,
} from '../../src/features/cash/lib/cashDerivedState'
import type { CashBalanceDTO, CashMovementDTO } from '../../src/api/types'

// toAmount: backend decimals arrive as strings
assert.equal(toAmount('1000.50000000'), 1000.5)
assert.equal(toAmount(-3), -3)
assert.equal(toAmount(null), 0)
assert.equal(toAmount('not-a-number'), 0)

// movementTone
assert.equal(movementTone({ amount: '25' }), 'positive')
assert.equal(movementTone({ amount: '-25' }), 'negative')

const baseMovement: CashMovementDTO = {
  id: 1,
  portfolio_id: 1,
  currency: 'USD',
  type: 'deposit',
  amount: '100',
  occurred_on: '2026-05-01',
  created_at: '',
  updated_at: '',
}

// isDerivedMovement: transaction/conversion/opening-balance rows are immutable
assert.equal(isDerivedMovement(baseMovement), false)
assert.equal(isDerivedMovement({ ...baseMovement, transaction_id: 7 }), true)
assert.equal(isDerivedMovement({ ...baseMovement, conversion_id: 'abc' }), true)
assert.equal(isDerivedMovement({ ...baseMovement, type: 'opening_balance' }), true)

// parseCashErrorDetail: wrapped and bare shapes
const detail = {
  code: 'insufficient_cash',
  message: 'Insufficient USD cash',
  context: { currency: 'USD', available: '100', required: '250', missing: '150' },
}
assert.deepEqual(parseCashErrorDetail({ detail }), detail)
assert.deepEqual(parseCashErrorDetail(detail), detail)
assert.equal(parseCashErrorDetail('plain string'), null)
assert.equal(parseCashErrorDetail({ detail: 'plain detail' }), null)

// parseCashErrorFromMessage: ApiRequestError stringifies dict details
assert.deepEqual(parseCashErrorFromMessage(JSON.stringify(detail)), detail)
assert.equal(parseCashErrorFromMessage('Portfolio 3 not found'), null)

// projectedBalance
assert.equal(projectedBalance(100, -30), 70)
assert.equal(projectedBalance(null, -30), null)
assert.equal(projectedBalance(undefined, -30), null)

// findBalance is case-insensitive
const balances: CashBalanceDTO[] = [
  { currency: 'USD', balance: '100', rate_stale: false, rate_unavailable: false },
  { currency: 'EUR', balance: '-80', rate_stale: true, rate_unavailable: false },
]
assert.equal(findBalance(balances, 'usd')?.currency, 'USD')
assert.equal(findBalance(balances, ' EUR ')?.currency, 'EUR')
assert.equal(findBalance(balances, 'JPY'), null)
assert.equal(findBalance(undefined, 'USD'), null)

// hasStaleRates
assert.equal(hasStaleRates(balances), true)
assert.equal(hasStaleRates([balances[0]]), false)

// conversionRate: target units per 1 source unit
assert.equal(conversionRate('950', '1002'), 1002 / 950)
assert.equal(conversionRate('0', '10'), null)
assert.equal(conversionRate('10', ''), null)

// manualMovementIssue: strict escalates to danger; credits never warn
assert.equal(manualMovementIssue(100, 50, true), null)
assert.equal(manualMovementIssue(100, -50, true), null)
assert.equal(manualMovementIssue(100, -150, false)?.level, 'warning')
assert.equal(manualMovementIssue(100, -150, true)?.level, 'danger')
assert.equal(manualMovementIssue(null, -150, true), null)

// summarizeWarnings keeps the earliest per currency, sorted
const summarized = summarizeWarnings([
  { code: 'negative_cash_balance', currency: 'USD', date: '2026-05-10', projected_balance: '-1' },
  { code: 'negative_cash_balance', currency: 'USD', date: '2026-05-01', projected_balance: '-5' },
  { code: 'negative_cash_balance', currency: 'EUR', date: '2026-06-01', projected_balance: '-2' },
])
assert.equal(summarized.length, 2)
assert.deepEqual(summarized.map((w) => [w.currency, w.date]), [
  ['EUR', '2026-06-01'],
  ['USD', '2026-05-01'],
])
assert.deepEqual(summarizeWarnings(undefined), [])

console.log('cashDerivedState tests passed')
