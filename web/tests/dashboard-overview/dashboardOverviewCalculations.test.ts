import assert from 'node:assert/strict'
import type { TFunction } from 'i18next'
import type { DistributionItemDTO, PositionDTO, ThemeDistributionItemDTO } from '../../src/api'
import {
  buildDailyAttribution,
  buildExposure,
  calculateConcentration,
  calculatePositionDailyImpact,
  calculateTotalGain,
  calculateTransactionAmount,
  numberValue,
} from '../../src/features/dashboard-overview/lib/dashboardOverviewCalculations'

const translate = ((key: string) => key) as TFunction

const position = (overrides: Partial<PositionDTO> = {}): PositionDTO => ({
  asset_id: 1,
  symbol: 'ACME',
  name: 'Acme',
  asset_type: 'STOCK',
  quantity: 10,
  avg_cost: 90,
  current_price: 100,
  market_value: 1000,
  cost_basis: 900,
  unrealized_pnl: 100,
  unrealized_pnl_pct: 11.11,
  realized_pnl: 0,
  realized_pnl_percent: null,
  realized_quantity: 0,
  realized_sell_count: 0,
  realized_cost_basis: 0,
  realized_sale_proceeds: 0,
  realized_fees: 0,
  lifetime_pnl: 100,
  total_quantity_bought: 10,
  average_sell_price: null,
  daily_change_pct: 10,
  currency: 'EUR',
  last_updated: null,
  ...overrides,
})

assert.equal(numberValue('12.5'), 12.5)
assert.equal(numberValue('invalid'), 0)

assert.equal(calculateTotalGain({
  total_value: 1000,
  total_unrealized_pnl: 100,
  total_unrealized_pnl_pct: 10,
  total_realized_pnl: 25,
  total_dividends: 15,
  total_fees: 5,
}), 135)

assert.ok(Math.abs(calculatePositionDailyImpact(position()) - 90.9090909) < 0.0001)

const attribution = buildDailyAttribution(
  [
    position({ asset_id: 1, symbol: 'AAA', market_value: 1000, daily_change_pct: 10 }),
    position({ asset_id: 2, symbol: 'BBB', market_value: 500, daily_change_pct: -5 }),
  ],
  70,
  translate,
  1,
)
assert.equal(attribution[0].label, 'AAA')
assert.equal(attribution[1].label, 'dashboardOverview.otherPositionsAndMarketEffects')
assert.ok(Math.abs(attribution.reduce((sum, item) => sum + item.value, 0) - 70) < 0.0001)

const standardExposure: DistributionItemDTO[] = [
  {
    name: 'Technology',
    count: 2,
    percentage: 60,
    total_value: 600,
    cost_basis: 500,
    unrealized_pnl: 100,
    unrealized_pnl_pct: 20,
    asset_ids: [1, 2],
  },
  {
    name: 'Cash',
    count: 1,
    percentage: 40,
    total_value: 400,
    cost_basis: 400,
    unrealized_pnl: 0,
    unrealized_pnl_pct: 0,
    asset_ids: [3],
  },
]
assert.equal(buildExposure(standardExposure, 'standard', translate).isCompleteWhole, true)

const overlappingThemes: ThemeDistributionItemDTO[] = [
  {
    theme: 'AI',
    value: 700,
    percentage: 70,
    cost_basis: 600,
    unrealized_pnl: 100,
    unrealized_pnl_pct: 16.67,
    assets: [],
  },
  {
    theme: 'Cloud',
    value: 600,
    percentage: 60,
    cost_basis: 500,
    unrealized_pnl: 100,
    unrealized_pnl_pct: 20,
    assets: [],
  },
]
assert.equal(buildExposure(overlappingThemes, 'theme', translate).isCompleteWhole, false)

const concentration = calculateConcentration([
  position({ asset_id: 1, symbol: 'AAA', market_value: 600 }),
  position({ asset_id: 2, symbol: 'BBB', market_value: 300 }),
  position({ asset_id: 3, symbol: 'CCC', market_value: 100 }),
])
assert.equal(concentration.largest?.symbol, 'AAA')
assert.equal(concentration.largestWeight, 60)
assert.equal(concentration.topThreeWeight, 100)

assert.equal(calculateTransactionAmount({
  id: 1,
  type: 'BUY',
  tx_date: '2026-06-22',
  quantity: 4,
  price: 25,
  fees: 1,
}), 100)
