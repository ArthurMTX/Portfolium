import assert from 'node:assert/strict'
import {
  formatTransactionQuantity,
  isFutureDate,
  isVeryOldDate,
  parseAmount,
  parseDateOnly,
} from '../../src/features/transactions/lib/transactionFormUtils'

assert.equal(formatTransactionQuantity(null), '-')
assert.equal(formatTransactionQuantity(undefined), '-')
assert.equal(formatTransactionQuantity(12), '12')
assert.equal(formatTransactionQuantity('12.34000000'), '12.34')
assert.equal(formatTransactionQuantity(0.00000001), '0.00000001')

assert.equal(parseAmount(''), 0)
assert.equal(parseAmount(null, 7), 7)
assert.equal(parseAmount('not-a-number', 4), 4)
assert.equal(parseAmount('15.25'), 15.25)
assert.equal(parseAmount(3.5), 3.5)

assert.equal(parseDateOnly('not-a-date'), null)
assert.equal(parseDateOnly('2024-05-10')?.getFullYear(), 2024)
assert.equal(isFutureDate('2999-01-01'), true)
assert.equal(isFutureDate('1999-01-01'), false)
assert.equal(isVeryOldDate('1989-12-31'), true)
assert.equal(isVeryOldDate('1990-01-01'), false)
