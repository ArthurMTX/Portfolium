import assert from 'node:assert/strict'
import { PositionDTO } from '../../src/api'
import {
  buildPerformanceMetrics,
  buildRelativePerformanceMetrics,
  buildTradingZoneMetrics,
  DetailedMetrics,
  hasRelativePerformanceMetrics,
} from '../../src/features/portfolios/lib/positionDetailMetricBuilders'

Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en-US' },
  configurable: true,
})

const translate = (key: string, options?: Record<string, unknown>) => (
  options ? `${key}:${JSON.stringify(options)}` : key
)

const basePosition: PositionDTO = {
  asset_id: 1,
  symbol: 'ACME',
  name: 'Acme Corp',
  asset_type: 'STOCK',
  quantity: 10,
  avg_cost: 100,
  current_price: 80,
  market_value: 800,
  cost_basis: 1000,
  unrealized_pnl: -200,
  unrealized_pnl_pct: -20,
  daily_change_pct: 1.5,
  breakeven_gain_pct: 25,
  breakeven_target_price: null,
  distance_to_ath_pct: null,
  avg_buy_zone_pct: null,
  personal_drawdown_pct: null,
  local_ath_price: null,
  local_ath_date: null,
  vol_contribution_pct: null,
  cost_to_average_down: null,
  ath_price: null,
  ath_price_native: null,
  ath_currency: null,
  ath_date: null,
  relative_perf_30d: null,
  relative_perf_90d: null,
  relative_perf_ytd: null,
  relative_perf_1y: null,
  sector: 'Technology',
  sector_etf: null,
  currency: 'USD',
  last_updated: null,
}

const emptyMetrics = (): DetailedMetrics => ({
  distance_to_ath_pct: null,
  avg_buy_zone_pct: null,
  personal_drawdown_pct: null,
  local_ath_price: null,
  local_ath_date: null,
  cost_to_average_down: null,
  volatility_30d: null,
  volatility_90d: null,
  beta: null,
  beta_benchmark: null,
  relative_perf_30d: null,
  relative_perf_90d: null,
  relative_perf_ytd: null,
  relative_perf_1y: null,
  asset_perf_30d: null,
  asset_perf_90d: null,
  asset_perf_ytd: null,
  asset_perf_1y: null,
  etf_perf_30d: null,
  etf_perf_90d: null,
  etf_perf_ytd: null,
  etf_perf_1y: null,
  sector_etf: null,
  risk_score: null,
  market_cap: null,
  volume: null,
  avg_volume: null,
  pe_ratio: null,
  eps: null,
  liquidity_score: null,
  asset_currency: null,
  revenue_growth: null,
  earnings_growth: null,
  profit_margins: null,
  operating_margins: null,
  return_on_equity: null,
  net_cash: null,
  debt_to_equity: null,
  current_ratio: null,
  quick_ratio: null,
  recommendation_key: null,
  recommendation_mean: null,
  num_analysts: null,
  target_mean: null,
  target_high: null,
  target_low: null,
  implied_upside_pct: null,
})

const performanceMetrics = buildPerformanceMetrics(basePosition, null, translate)
assert.deepEqual(performanceMetrics.map((item) => item.key), [
  'unrealized-pnl',
  'breakeven-gain',
  'daily-change',
])
assert.equal(performanceMetrics[0].color, 'text-red-600 dark:text-red-400')
assert.equal(performanceMetrics[1].value, '+25.00%')

const tradingZoneFallback = buildTradingZoneMetrics(basePosition, null, translate)
assert.deepEqual(tradingZoneFallback, [
  {
    kind: 'empty',
    key: 'distance-to-ath-empty',
    label: 'dashboard.positionDetail.distanceToATH',
    message: 'No data available',
  },
])

const tradingZoneMetrics = buildTradingZoneMetrics(basePosition, {
  ...emptyMetrics(),
  avg_buy_zone_pct: 4.25,
  distance_to_ath_pct: -12.5,
  local_ath_price: 120,
}, translate)
assert.deepEqual(tradingZoneMetrics.map((item) => item.key), [
  'avg-buy-zone',
  'distance-to-ath',
])
assert.equal(tradingZoneMetrics[0].kind, 'metric')
assert.equal(tradingZoneMetrics[0].color, 'text-green-600 dark:text-green-400')
assert.equal(tradingZoneMetrics[1].kind, 'metric')
assert.equal(tradingZoneMetrics[1].color, 'text-amber-600 dark:text-amber-400')

const relativeMetrics = {
  ...emptyMetrics(),
  sector_etf: 'XLK',
  relative_perf_30d: 3.5,
  asset_perf_30d: 8,
  etf_perf_30d: 4.5,
}
assert.equal(hasRelativePerformanceMetrics(relativeMetrics, basePosition), true)
assert.deepEqual(buildRelativePerformanceMetrics(basePosition, relativeMetrics, translate), [
  {
    kind: 'metric',
    key: 'relative-30d',
    label: 'charts.periods.1M',
    value: '+3.50%',
    color: 'text-green-600 dark:text-green-400',
    icon: 'trendingUp',
    subtitle: 'ACME: +8.00% | XLK: +4.50%',
    conclusion: 'dashboard.conclusions.performance.inLineWithBenchmark',
  },
])
