import assert from 'node:assert/strict'
import {
  getTransactionSummary,
  getTransactionWarnings,
  type PriceSource,
  type TransactionSummary,
} from '../../src/features/transactions/lib/transactionDerivedState'

const translate = (key: string, options?: Record<string, unknown>) => (
  options ? `${key}:${JSON.stringify(options)}` : key
)

const translatedType = (type: string) => `type:${type}`

const summaryFor = (overrides: Partial<Parameters<typeof getTransactionSummary>[0]> = {}) => getTransactionSummary({
  txType: 'BUY',
  quantity: '2',
  price: '10',
  fees: '1',
  txDate: '2024-01-15',
  assetCurrency: null,
  portfolioCurrency: 'EUR',
  selectedTickerSymbol: 'AAPL',
  ticker: 'AAPL',
  editingTransactionSymbol: undefined,
  unknownAssetLabel: 'Unknown',
  priceSource: 'manual',
  splitRatio: '',
  getTranslatedType: translatedType,
  ...overrides,
})

const warningKeys = (summary: TransactionSummary, overrides: Partial<Parameters<typeof getTransactionWarnings>[0]> = {}) => getTransactionWarnings({
  summary,
  txType: 'BUY',
  txDate: summary.date,
  priceFetchFailed: false,
  modalMode: 'add',
  sellAvailableQuantity: null,
  priceInfo: null,
  portfolioCurrency: 'EUR',
  translate,
  ...overrides,
}).map((warning) => warning.key)

assert.deepEqual(summaryFor({ txType: 'BUY' }), {
  action: 'type:BUY',
  asset: 'AAPL',
  date: '2024-01-15',
  currency: 'EUR',
  quantity: 2,
  price: 10,
  fees: 1,
  grossTotal: 20,
  netTotal: 21,
  impact: 2,
  priceSource: 'manual',
  isSplit: false,
})

assert.deepEqual(summaryFor({ txType: 'SELL' }), {
  action: 'type:SELL',
  asset: 'AAPL',
  date: '2024-01-15',
  currency: 'EUR',
  quantity: 2,
  price: 10,
  fees: 1,
  grossTotal: 20,
  netTotal: 19,
  impact: -2,
  priceSource: 'manual',
  isSplit: false,
})

assert.deepEqual(summaryFor({
  txType: 'DIVIDEND',
  quantity: '8',
  price: '0.5',
  fees: '0.75',
  assetCurrency: 'USD',
  portfolioCurrency: 'EUR',
}), {
  action: 'type:DIVIDEND',
  asset: 'AAPL',
  date: '2024-01-15',
  currency: 'USD',
  quantity: 8,
  price: 0.5,
  fees: 0.75,
  grossTotal: 4,
  netTotal: 3.25,
  impact: 0,
  priceSource: 'manual',
  isSplit: false,
})

assert.deepEqual(summaryFor({
  txType: 'FEE',
  quantity: '',
  price: '3',
  fees: '0',
}), {
  action: 'type:FEE',
  asset: 'AAPL',
  date: '2024-01-15',
  currency: 'EUR',
  quantity: 0,
  price: 3,
  fees: 0,
  grossTotal: 3,
  netTotal: -3,
  impact: 0,
  priceSource: 'manual',
  isSplit: false,
})

assert.deepEqual(summaryFor({
  txType: 'SPLIT',
  quantity: '20',
  price: '30',
  fees: '4',
  splitRatio: '2:1',
  priceSource: 'empty' as PriceSource,
}), {
  action: 'type:SPLIT',
  asset: 'AAPL',
  date: '2024-01-15',
  currency: 'EUR',
  quantity: 0,
  price: 0,
  fees: 0,
  grossTotal: 0,
  netTotal: 0,
  impact: 0,
  priceSource: 'empty',
  splitRatio: '2:1',
  isSplit: true,
})

assert.deepEqual(summaryFor({
  quantity: 'not-a-number',
  price: '',
  fees: 'bad-fees',
  selectedTickerSymbol: undefined,
  ticker: '',
  editingTransactionSymbol: 'EDITED',
  priceSource: 'empty',
}), {
  action: 'type:BUY',
  asset: 'EDITED',
  date: '2024-01-15',
  currency: 'EUR',
  quantity: 0,
  price: 0,
  fees: 0,
  grossTotal: 0,
  netTotal: 0,
  impact: 0,
  priceSource: 'empty',
  isSplit: false,
})

const futureSummary = summaryFor({ txDate: '2999-01-01' })
assert.ok(warningKeys(futureSummary).includes('future-date'))

const oldSummary = summaryFor({ txDate: '1989-12-31' })
assert.ok(warningKeys(oldSummary).includes('old-date'))

const riskySellSummary = summaryFor({ txType: 'SELL', quantity: '10' })
assert.ok(warningKeys(riskySellSummary, {
  txType: 'SELL',
  sellAvailableQuantity: 5,
}).includes('sell-too-large'))

const highTaxDividendSummary = summaryFor({
  txType: 'DIVIDEND',
  quantity: '10',
  price: '1',
  fees: '11',
})
assert.ok(warningKeys(highTaxDividendSummary, { txType: 'DIVIDEND' }).includes('high-fees'))

const missingDividendSharesSummary = summaryFor({
  txType: 'DIVIDEND',
  quantity: '',
  price: '1',
})
assert.ok(warningKeys(missingDividendSharesSummary, { txType: 'DIVIDEND' }).includes('quantity'))

const invalidDividendPerShareSummary = summaryFor({
  txType: 'DIVIDEND',
  quantity: '10',
  price: '',
})
assert.equal(warningKeys(invalidDividendPerShareSummary, { txType: 'DIVIDEND' }).includes('price'), false)

const missingBuyAmountsSummary = summaryFor({
  quantity: '',
  price: '',
})
assert.deepEqual(warningKeys(missingBuyAmountsSummary), ['quantity', 'price'])

const convertedPriceSummary = summaryFor()
assert.ok(warningKeys(convertedPriceSummary, {
  priceInfo: { converted: true, asset_currency: 'USD' },
}).includes('converted-price'))

const foreignDividendSummary = summaryFor({
  txType: 'DIVIDEND',
  assetCurrency: 'USD',
  portfolioCurrency: 'EUR',
})
assert.ok(warningKeys(foreignDividendSummary, { txType: 'DIVIDEND' }).includes('dividend-currency'))

// --- Cash tracking warnings ---
import { getTransactionCashDelta, getTransactionWarnings as getWarningsFull } from '../../src/features/transactions/lib/transactionDerivedState'

const cashWarnings = (
  summary: TransactionSummary,
  overrides: Partial<Parameters<typeof getWarningsFull>[0]> = {},
) => getWarningsFull({
  summary,
  txType: 'BUY',
  txDate: summary.date,
  priceFetchFailed: false,
  modalMode: 'add',
  sellAvailableQuantity: null,
  priceInfo: null,
  portfolioCurrency: 'EUR',
  translate,
  ...overrides,
})

// Cash delta mirrors backend derivation
const buySummary = summaryFor({ quantity: '10', price: '100', fees: '2' })
assert.equal(getTransactionCashDelta(buySummary, 'BUY'), -1002)
assert.equal(getTransactionCashDelta(buySummary, 'SELL'), 998)
assert.equal(getTransactionCashDelta(buySummary, 'DIVIDEND'), 998)
assert.equal(getTransactionCashDelta(buySummary, 'FEE'), -2)
assert.equal(getTransactionCashDelta(buySummary, 'SPLIT'), 0)
assert.equal(getTransactionCashDelta(buySummary, 'TRANSFER_IN'), 0)

// Untracked portfolios never get cash warnings
const untrackedWarnings = cashWarnings(buySummary, { cashMode: 'untracked', availableCash: 0 })
assert.equal(untrackedWarnings.some((w) => w.key === 'cash-insufficient'), false)

// Warn mode: over-budget buy produces a warning-level entry
const warnEntry = cashWarnings(buySummary, { cashMode: 'tracked_warn', availableCash: 500 })
  .find((w) => w.key === 'cash-insufficient')
assert.ok(warnEntry)
assert.equal(warnEntry?.level, 'warning')

// Strict mode escalates to danger (the API will reject)
const strictEntry = cashWarnings(buySummary, { cashMode: 'tracked_strict', availableCash: 500 })
  .find((w) => w.key === 'cash-insufficient')
assert.equal(strictEntry?.level, 'danger')

// Covered buys and credit-side transactions never warn
assert.equal(
  cashWarnings(buySummary, { cashMode: 'tracked_strict', availableCash: 5000 })
    .some((w) => w.key === 'cash-insufficient'),
  false,
)
assert.equal(
  cashWarnings(buySummary, { txType: 'SELL', cashMode: 'tracked_strict', availableCash: 0 })
    .some((w) => w.key === 'cash-insufficient'),
  false,
)

// Unknown balance (still loading): no speculative warning
assert.equal(
  cashWarnings(buySummary, { cashMode: 'tracked_strict', availableCash: null })
    .some((w) => w.key === 'cash-insufficient'),
  false,
)

console.log('transactionDerivedState cash tests passed')
