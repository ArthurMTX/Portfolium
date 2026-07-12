import assert from 'node:assert/strict'
import type { TFunction } from 'i18next'
import type { AssetResearchDTO, AssetThemeDTO } from '../../src/api'
import {
  buildAnalystMetrics,
  buildAssetResearchMetrics,
  buildBalanceSheetMetrics,
  buildFundamentalsMetrics,
  buildGrowthMetrics,
  buildOverviewMetrics,
  buildRelativeMetric,
  buildRiskMetrics,
  clampAllocationPercent,
  formatAllocationPercent,
  isEquityAsset,
  isEtfAsset,
} from '../../src/features/assets/lib/assetResearchMetricBuilders'
import { getThemeEvidenceTitle } from '../../src/shared/lib/themeUtils'

Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en-US' },
  configurable: true,
})

const translate = ((key: string) => key) as TFunction

const research = (overrides: Partial<AssetResearchDTO> = {}): AssetResearchDTO => ({
  asset: {
    id: 1,
    symbol: 'ACME',
    name: 'Acme Corp',
    currency: 'USD',
    class: 'stock',
    sector: 'Technology',
    industry: 'Software',
    asset_type: 'STOCK',
    country: 'United States',
    market_cap: null,
    market_cap_currency: null,
    market_cap_usd: null,
    market_cap_fetched_at: null,
    themes: [],
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  quote: {
    symbol: 'ACME',
    price: '125.50',
    asof: '2024-01-01',
    currency: 'USD',
    daily_change_pct: '2.5',
  },
  fundamentals: {
    market_cap: 1_000_000_000,
    volume: 2_000_000,
    avg_volume: 1_000_000,
    pe_ratio: 20,
    eps: 4,
    price: 125.5,
    liquidity_score: 8,
    revenue_growth: 0.12,
    earnings_growth: -0.05,
    profit_margins: 0.2,
    operating_margins: 0.18,
    return_on_equity: 0.25,
    net_cash: 500_000_000,
    debt_to_equity: 0.4,
    current_ratio: 1.5,
    quick_ratio: 1.2,
    recommendation_key: 'strong_buy',
    recommendation_mean: 1.5,
    num_analysts: 12,
    target_mean: 150,
    target_high: 175,
    target_low: 130,
    implied_upside_pct: 19.5,
  },
  business: {
    founded: null,
    employees: null,
    headquarters: null,
    country: null,
    sector: null,
    industry: null,
    description: null,
  },
  ownership: {
    institutional_ownership: null,
    insider_ownership: null,
    short_interest: null,
  },
  risk: {
    volatility_30d: 20,
    volatility_90d: 25,
    beta: 1.1,
    beta_benchmark: 'SPY',
    risk_score: 6,
    distance_to_ath_pct: -12,
  },
  relative_performance: {
    relative_perf_30d: 3,
    relative_perf_90d: null,
    relative_perf_ytd: null,
    relative_perf_1y: null,
    asset_perf_30d: 5,
    asset_perf_90d: null,
    asset_perf_ytd: null,
    asset_perf_1y: null,
    etf_perf_30d: 2,
    etf_perf_90d: null,
    etf_perf_ytd: null,
    etf_perf_1y: null,
    sector_etf: 'XLK',
  },
  metadata: {
    ath_price: null,
    ath_date: null,
    atl_price: null,
    atl_date: null,
    asset_currency: 'USD',
  },
  ...overrides,
})

const stock = research()
const metrics = buildAssetResearchMetrics(stock, translate)
assert.equal(metrics.currency, 'USD')
assert.equal(metrics.price, 125.5)
assert.deepEqual(metrics.overview.map(({ label }) => label), [
  'Current Price',
  'Daily Change',
  'Risk Score',
  'Market Cap',
])
assert.equal(metrics.growth.find(({ label }) => label === 'Revenue Growth')?.value, '+12.00%')
assert.equal(metrics.analyst.find(({ label }) => label === 'Consensus')?.value, 'Strong Buy')
assert.deepEqual(buildOverviewMetrics(stock, translate), metrics.overview)
assert.deepEqual(buildFundamentalsMetrics(stock.fundamentals, 'USD', translate), metrics.fundamentals)
assert.deepEqual(buildGrowthMetrics(stock.fundamentals, translate), metrics.growth)
assert.deepEqual(buildBalanceSheetMetrics(stock.fundamentals, 'USD', translate), metrics.balanceSheet)
assert.deepEqual(buildRiskMetrics(stock.risk, translate), metrics.risk)
assert.deepEqual(buildAnalystMetrics(stock.fundamentals, 'USD', translate), metrics.analyst)
assert.equal(isEquityAsset(stock.asset), true)
assert.equal(isEtfAsset(stock.asset), false)

const missing = buildAssetResearchMetrics(research({
  quote: null,
  fundamentals: {
    ...stock.fundamentals,
    market_cap: null,
    volume: null,
    pe_ratio: null,
    eps: null,
    liquidity_score: null,
  },
  risk: {
    volatility_30d: null,
    volatility_90d: null,
    beta: null,
    beta_benchmark: null,
    risk_score: null,
    distance_to_ath_pct: null,
  },
}), translate)
assert.deepEqual(missing.overview.map(({ label }) => label), ['Current Price'])
assert.equal(missing.overview[0].value, '-')
assert.equal(missing.fundamentals.length, 0)
assert.equal(missing.risk.length, 0)
assert.equal(buildFundamentalsMetrics(missingResearchFundamentals(), 'USD', translate).length, 0)
assert.equal(buildGrowthMetrics(missingResearchFundamentals(), translate).length, 0)
assert.equal(buildBalanceSheetMetrics(missingResearchFundamentals(), 'USD', translate).length, 0)
assert.equal(buildAnalystMetrics(missingResearchFundamentals(), 'USD', translate).length, 0)
assert.equal(buildRiskMetrics({
  volatility_30d: null,
  volatility_90d: null,
  beta: null,
  beta_benchmark: null,
  risk_score: null,
  distance_to_ath_pct: null,
}, translate).length, 0)

const etfAsset = { ...stock.asset, asset_type: 'ETF', class: 'etf' }
assert.equal(isEtfAsset(etfAsset), true)
assert.equal(isEquityAsset(etfAsset), false)

const cryptoAsset = { ...stock.asset, asset_type: 'CRYPTO', class: 'crypto' }
assert.equal(isEtfAsset(cryptoAsset), false)
assert.equal(isEquityAsset(cryptoAsset), false)
assert.equal(buildAssetResearchMetrics(research({ asset: cryptoAsset }), translate).overview[0].label, 'Current Price')

assert.equal(formatAllocationPercent(0.1234), '12.3%')
assert.equal(clampAllocationPercent(1.5), 100)
assert.equal(clampAllocationPercent(-0.2), 0)

assert.deepEqual(buildRelativeMetric('1M', 3, 5, 2, 'ACME', 'XLK'), {
  label: '1M',
  value: '+3.00%',
  color: 'text-green-600 dark:text-green-400',
  subtitle: 'ACME: +5.00% | XLK: +2.00%',
  icon: 'trendingUp',
})
assert.equal(buildRelativeMetric('1M', null, null, null, 'ACME', null), null)

const theme: AssetThemeDTO = {
  label: 'Artificial Intelligence',
  confidence: 0.9,
  evidence: ['AI products'],
  children: [{
    label: 'Semiconductors',
    confidence: 0.8,
    evidence: ['GPU revenue'],
  }],
}
assert.equal(
  getThemeEvidenceTitle(theme),
  'Theme: AI products\nSemiconductors: GPU revenue',
)
assert.equal(getThemeEvidenceTitle({ ...theme, evidence: [], children: [] }), undefined)

function missingResearchFundamentals(): AssetResearchDTO['fundamentals'] {
  return Object.fromEntries(
    Object.keys(stock.fundamentals).map((key) => [key, null]),
  ) as unknown as AssetResearchDTO['fundamentals']
}
