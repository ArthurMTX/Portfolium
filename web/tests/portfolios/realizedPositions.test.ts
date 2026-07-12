import assert from 'node:assert/strict'
import { PositionDTO } from '../../src/api'
import { getRealizedPositions } from '../../src/features/portfolios/lib/realizedPositions'

Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en-US' },
  configurable: true,
})

const position = (overrides: Partial<PositionDTO>): PositionDTO => ({
  asset_id: 1,
  symbol: 'ACME',
  name: 'Acme',
  quantity: 10,
  avg_cost: 100,
  current_price: 120,
  market_value: 1200,
  cost_basis: 1000,
  unrealized_pnl: 200,
  unrealized_pnl_pct: 20,
  realized_pnl: 0,
  realized_pnl_percent: null,
  realized_quantity: 0,
  realized_sell_count: 0,
  realized_cost_basis: 0,
  realized_sale_proceeds: 0,
  realized_fees: 0,
  lifetime_pnl: 200,
  total_quantity_bought: 10,
  average_sell_price: null,
  daily_change_pct: null,
  currency: 'USD',
  last_updated: null,
  ...overrides,
})

const partial = position({
  asset_id: 2,
  symbol: 'PART',
  realized_pnl: 95,
  realized_pnl_percent: 19,
  realized_quantity: 5,
  realized_sell_count: 1,
  realized_cost_basis: 500,
  realized_sale_proceeds: 600,
  realized_fees: 5,
  lifetime_pnl: 295,
  total_quantity_bought: 15,
  average_sell_price: 120,
})
const closed = position({
  asset_id: 3,
  symbol: 'DONE',
  quantity: 0,
  current_price: 130,
  market_value: 0,
  cost_basis: 1000,
  unrealized_pnl: 300,
  unrealized_pnl_pct: 30,
  realized_pnl: 300,
  realized_pnl_percent: 30,
  realized_quantity: 10,
  realized_sell_count: 2,
  realized_cost_basis: 1000,
  realized_sale_proceeds: 1310,
  realized_fees: 10,
  lifetime_pnl: 300,
  average_sell_price: 131,
})

assert.deepEqual(
  getRealizedPositions([position({}), partial, closed]).map(({ symbol }) => symbol),
  ['PART'],
)
