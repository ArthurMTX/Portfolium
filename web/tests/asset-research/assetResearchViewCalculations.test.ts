import assert from 'node:assert/strict'
import type { PositionDTO } from '../../src/api'
import {
  calculatePortfolioWeight,
  calculatePositionDailyContribution,
  calculatePositionTotalReturn,
  calculatePriceChangeAmount,
  calculateTransactionAmount,
  researchNumber,
  sumTransactionType,
} from '../../src/features/asset-research/lib/assetResearchViewCalculations'

const position = (overrides: Partial<PositionDTO> = {}): PositionDTO => ({
  asset_id: 1,
  symbol: 'ACME',
  name: 'Acme',
  asset_type: 'STOCK',
  quantity: 5,
  avg_cost: 80,
  current_price: 100,
  market_value: 500,
  cost_basis: 400,
  unrealized_pnl: 100,
  unrealized_pnl_pct: 25,
  realized_pnl: 20,
  realized_pnl_percent: 10,
  realized_quantity: 2,
  realized_sell_count: 1,
  realized_cost_basis: 200,
  realized_sale_proceeds: 225,
  realized_fees: 5,
  lifetime_pnl: 120,
  total_quantity_bought: 7,
  average_sell_price: 112.5,
  daily_change_pct: -2,
  currency: 'EUR',
  last_updated: null,
  ...overrides,
})

assert.equal(researchNumber('12.5'), 12.5)
assert.equal(researchNumber('invalid'), 0)

const priceChange = calculatePriceChangeAmount(98, -2)
assert.ok(priceChange !== null)
assert.ok(Math.abs(priceChange + 2) < 0.0001)
assert.equal(calculatePriceChangeAmount(null, -2), null)

assert.equal(calculatePortfolioWeight(position(), 10_000), 5)
assert.equal(calculatePortfolioWeight(position(), 0), null)
assert.equal(calculatePositionDailyContribution(position()), -10)
assert.equal(calculatePositionTotalReturn(position()), 120)

const transactions = [
  {
    id: 1,
    asset_id: 1,
    tx_date: '2026-01-01',
    type: 'BUY',
    quantity: 2,
    price: 10,
    fees: 1,
    currency: 'EUR',
    notes: null,
  },
  {
    id: 2,
    asset_id: 1,
    tx_date: '2026-02-01',
    type: 'DIVIDEND',
    quantity: 5,
    price: 1,
    fees: 0.5,
    currency: 'EUR',
    notes: null,
  },
]

assert.equal(calculateTransactionAmount(transactions[0]), 21)
assert.equal(calculateTransactionAmount(transactions[1]), 4.5)
assert.equal(sumTransactionType(transactions, 'DIVIDEND'), 4.5)
