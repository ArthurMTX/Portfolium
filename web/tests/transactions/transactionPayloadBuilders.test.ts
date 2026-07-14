import assert from 'node:assert/strict'
import {
  buildAutoPricePayload,
  buildBuyPayload,
  buildCreateTransactionPayload,
  buildDividendPayload,
  buildFeePayload,
  buildSellPayload,
  buildSplitPayload,
  buildUpdatePayload,
  shouldUseAutoPriceTransaction,
  validateBuy,
  validateDividend,
  validateFee,
  validateSell,
  validateSplit,
  validateTransactionSubmit,
  type TransactionValidationResult,
} from '../../src/features/transactions/lib/transactionPayloadBuilders'

const validBase = {
  txDate: '2024-01-15',
  txType: 'BUY',
  quantity: '10',
  price: '25',
  fees: '2.5',
}

const payloadBase = {
  assetId: 42,
  txDate: '2024-01-15',
  txType: 'BUY',
  quantity: '10',
  price: '25',
  fees: '2.5',
  currency: 'EUR',
  notes: 'note',
}

const assertError = (
  result: TransactionValidationResult,
  code: Exclude<TransactionValidationResult, { ok: true }>,
) => {
  assert.deepEqual(result, code)
}

assert.equal(shouldUseAutoPriceTransaction('BUY', ''), true)
assert.equal(shouldUseAutoPriceTransaction('SELL', ''), true)
assert.equal(shouldUseAutoPriceTransaction('BUY', '12'), false)
assert.equal(shouldUseAutoPriceTransaction('DIVIDEND', ''), false)
assert.equal(shouldUseAutoPriceTransaction('FEE', ''), false)
assert.equal(shouldUseAutoPriceTransaction('SPLIT', ''), false)

assert.deepEqual(buildAutoPricePayload('AAPL', '2024-01-15', 'BUY', '3.5'), {
  symbol: 'AAPL',
  txDate: '2024-01-15',
  txType: 'BUY',
  quantity: 3.5,
})

assert.deepEqual(buildBuyPayload(payloadBase), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'BUY',
  quantity: 10,
  price: 25,
  fees: 2.5,
  currency: 'EUR',
  metadata: {},
  notes: 'note',
})

assert.deepEqual(buildBuyPayload({
  ...payloadBase,
  price: '15',
  fees: '0',
  currency: 'USD',
  notes: '',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'BUY',
  quantity: 10,
  price: 15,
  fees: 0,
  currency: 'USD',
  metadata: {},
  notes: null,
})

// Empty fields must serialize as 0, never NaN (JSON null -> API 422)
assert.deepEqual(buildBuyPayload({
  ...payloadBase,
  fees: '',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'BUY',
  quantity: 10,
  price: 25,
  fees: 0,
  currency: 'EUR',
  metadata: {},
  notes: 'note',
})

assert.deepEqual(buildFeePayload({
  ...payloadBase,
  txType: 'FEE',
  quantity: '',
  price: '',
  fees: '12',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'FEE',
  quantity: 0,
  price: 0,
  fees: 12,
  currency: 'EUR',
  metadata: {},
  notes: 'note',
})

assert.deepEqual(buildSellPayload({
  ...payloadBase,
  txType: 'SELL',
  quantity: '4',
  price: '30',
  fees: '1',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'SELL',
  quantity: 4,
  price: 30,
  fees: 1,
  currency: 'EUR',
  metadata: {},
  notes: 'note',
})

assert.deepEqual(buildSellPayload({
  ...payloadBase,
  txType: 'SELL',
  quantity: '10',
  price: '30',
  fees: '0',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'SELL',
  quantity: 10,
  price: 30,
  fees: 0,
  currency: 'EUR',
  metadata: {},
  notes: 'note',
})

assert.deepEqual(buildDividendPayload({
  ...payloadBase,
  txType: 'DIVIDEND',
  quantity: '8',
  price: '0.5',
  fees: '0.75',
  currency: 'USD',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'DIVIDEND',
  quantity: 8,
  price: 0.5,
  fees: 0.75,
  currency: 'USD',
  metadata: {},
  notes: 'note',
})

assert.deepEqual(buildFeePayload({
  ...payloadBase,
  txType: 'FEE',
  quantity: '',
  price: '7',
  fees: '0',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'FEE',
  quantity: 0,
  price: 7,
  fees: 0,
  currency: 'EUR',
  metadata: {},
  notes: 'note',
})

assert.deepEqual(buildSplitPayload({
  ...payloadBase,
  txType: 'SPLIT',
  splitRatio: '2:1',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'SPLIT',
  quantity: 0,
  price: 0,
  fees: 0,
  currency: 'EUR',
  metadata: { split: '2:1' },
  notes: 'note',
})

assert.deepEqual(buildCreateTransactionPayload({
  ...payloadBase,
  txType: 'SPLIT',
  splitRatio: '3:2',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'SPLIT',
  quantity: 0,
  price: 0,
  fees: 0,
  currency: 'EUR',
  metadata: { split: '3:2' },
  notes: 'note',
})

assert.deepEqual(buildUpdatePayload({
  ...payloadBase,
  txType: 'BUY',
  existingMetadata: { source: 'import' },
  splitRatio: '',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'BUY',
  quantity: 10,
  price: 25,
  fees: 2.5,
  currency: 'EUR',
  metadata: { source: 'import' },
  notes: 'note',
})

assert.deepEqual(buildUpdatePayload({
  ...payloadBase,
  txType: 'SPLIT',
  existingMetadata: { source: 'ignored' },
  splitRatio: '4:1',
}), {
  asset_id: 42,
  tx_date: '2024-01-15',
  type: 'SPLIT',
  quantity: 0,
  price: 0,
  fees: 0,
  currency: 'EUR',
  metadata: { split: '4:1' },
  notes: 'note',
})

assert.deepEqual(validateBuy(validBase), { ok: true })
assert.deepEqual(validateBuy({ ...validBase, price: '' }), { ok: true })
assertError(validateBuy({ ...validBase, price: '', modalMode: 'edit' }), {
  ok: false,
  action: 'show-error',
  code: 'price-must-be-positive',
})
assertError(validateBuy({ ...validBase, txDate: '' }), {
  ok: false,
  action: 'show-error',
  code: 'invalid-date',
})
assertError(validateBuy({ ...validBase, txDate: '2999-01-01' }), {
  ok: false,
  action: 'show-error',
  code: 'future-date',
})
assertError(validateBuy({ ...validBase, quantity: '0' }), {
  ok: false,
  action: 'show-error',
  code: 'quantity-must-be-positive',
})
assertError(validateBuy({ ...validBase, fees: '-1' }), {
  ok: false,
  action: 'show-error',
  code: 'fees-must-be-positive',
})
assertError(validateBuy({ ...validBase, price: '0' }), {
  ok: false,
  action: 'show-error',
  code: 'price-must-be-positive',
})

assert.deepEqual(validateSell({
  ...validBase,
  txType: 'SELL',
  quantity: '5',
  sellAvailableQuantity: 10,
  riskAcknowledged: false,
  sellQuantityLoading: false,
}), { ok: true })
assert.deepEqual(validateSell({
  ...validBase,
  txType: 'SELL',
  quantity: '10',
  sellAvailableQuantity: 10,
  riskAcknowledged: false,
  sellQuantityLoading: false,
}), { ok: true })
assertError(validateSell({
  ...validBase,
  txType: 'SELL',
  quantity: '11',
  sellAvailableQuantity: 10,
  riskAcknowledged: false,
  sellQuantityLoading: false,
}), { ok: false, action: 'confirm-risk' })
assert.deepEqual(validateSell({
  ...validBase,
  txType: 'SELL',
  quantity: '11',
  sellAvailableQuantity: 10,
  riskAcknowledged: true,
  sellQuantityLoading: false,
}), { ok: true })
assertError(validateSell({
  ...validBase,
  txType: 'SELL',
  sellAvailableQuantity: null,
  riskAcknowledged: false,
  sellQuantityLoading: true,
}), { ok: false, action: 'show-error', code: 'checking-position' })

assert.deepEqual(validateDividend({
  ...validBase,
  txType: 'DIVIDEND',
  quantity: '8',
  price: '0.5',
  fees: '0.75',
}), { ok: true })
assertError(validateDividend({
  ...validBase,
  txType: 'DIVIDEND',
  quantity: '0',
}), { ok: false, action: 'show-error', code: 'quantity-must-be-positive' })
assertError(validateDividend({
  ...validBase,
  txType: 'DIVIDEND',
  price: '',
}), { ok: false, action: 'show-error', code: 'dividend-per-share-must-be-positive' })
assertError(validateDividend({
  ...validBase,
  txType: 'DIVIDEND',
  quantity: '10',
  price: '1',
  fees: '10.000000002',
}), { ok: false, action: 'show-error', code: 'tax-cannot-exceed-gross' })

assert.deepEqual(validateFee({
  ...validBase,
  txType: 'FEE',
  quantity: '',
  price: '',
  fees: '5',
}), { ok: true })
assertError(validateFee({
  ...validBase,
  txType: 'FEE',
  fees: '-0.01',
}), { ok: false, action: 'show-error', code: 'fees-must-be-positive' })

assert.deepEqual(validateSplit({
  ...validBase,
  txType: 'SPLIT',
  quantity: '',
  price: '',
  fees: '0',
}), { ok: true })
assertError(validateSplit({
  ...validBase,
  txType: 'SPLIT',
  fees: '-1',
}), { ok: false, action: 'show-error', code: 'fees-must-be-positive' })

assertError(validateTransactionSubmit({
  ...validBase,
  activePortfolioId: null,
  hasSelectedTicker: true,
  modalMode: 'add',
  sellQuantityLoading: false,
  riskAcknowledged: false,
  sellAvailableQuantity: null,
}), { ok: false, action: 'show-error', code: 'portfolio-required' })

assertError(validateTransactionSubmit({
  ...validBase,
  activePortfolioId: 1,
  hasSelectedTicker: false,
  modalMode: 'add',
  sellQuantityLoading: false,
  riskAcknowledged: false,
  sellAvailableQuantity: null,
}), { ok: false, action: 'show-error', code: 'ticker-required' })

assertError(validateTransactionSubmit({
  ...validBase,
  activePortfolioId: 1,
  hasSelectedTicker: true,
  modalMode: 'add',
  txType: 'SELL',
  quantity: '11',
  sellQuantityLoading: false,
  riskAcknowledged: false,
  sellAvailableQuantity: 10,
}), { ok: false, action: 'confirm-risk' })
