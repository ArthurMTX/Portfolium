import type { TFunction } from 'i18next'
import type { AssetResearchDTO } from '@/api'
import {
  getAnalystConsensusConclusion,
  getDebtToEquityConclusion,
  getEarningsGrowthConclusion,
  getEpsConclusion,
  getImpliedUpsideConclusion,
  getLiquidityScoreConclusion,
  getMarketCapConclusion,
  getNetCashConclusion,
  getNetMarginConclusion,
  getOperatingMarginConclusion,
  getPEConclusion,
  getRevenueGrowthConclusion,
  getRiskScoreConclusion,
  getRoeConclusion,
  getVolatilityConclusion,
  getVolumeConclusion,
} from '@/features/assets/lib/conclusionUtils'
import {
  formatCurrency,
  formatLargeNumber,
  formatNumber,
  formatWithSeparators,
} from '@/shared/lib/formatUtils'

export type AssetResearchMetricIcon =
  | 'activity'
  | 'alertTriangle'
  | 'barChart3'
  | 'dollarSign'
  | 'lineChart'
  | 'shield'
  | 'target'
  | 'trendingDown'
  | 'trendingUp'
  | 'users'

export interface AssetResearchMetric {
  label: string
  value: string
  color?: string
  subtitle?: string
  icon?: AssetResearchMetricIcon
}

export interface AssetResearchMetrics {
  currency: string
  dailyChange: number | null
  price: number | null
  overview: AssetResearchMetric[]
  fundamentals: AssetResearchMetric[]
  growth: AssetResearchMetric[]
  balanceSheet: AssetResearchMetric[]
  risk: AssetResearchMetric[]
  analyst: AssetResearchMetric[]
  relative: AssetResearchDTO['relative_performance']
}

function toResearchNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeAssetType(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase()
}

function compactMetrics(metrics: Array<AssetResearchMetric | null>): AssetResearchMetric[] {
  return metrics.filter((metric): metric is AssetResearchMetric => metric !== null)
}

function formatRatio(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : formatNumber(value, 2)
}

function formatRecommendation(value: string | null | undefined): string {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '-'
}

function hasAny(values: Array<unknown>): boolean {
  return values.some((value) => value !== null && value !== undefined)
}

export function isEtfAsset(asset: AssetResearchDTO['asset']): boolean {
  return normalizeAssetType(asset.asset_type) === 'ETF' || (asset.class || '').trim().toLowerCase() === 'etf'
}

export function isEquityAsset(asset: AssetResearchDTO['asset']): boolean {
  const assetType = normalizeAssetType(asset.asset_type)
  if (assetType) return assetType === 'EQUITY' || assetType === 'STOCK'
  return (asset.class || '').trim().toLowerCase() === 'stock'
}

export function formatResearchPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '-'
  return `${value >= 0 ? '+' : ''}${formatNumber(value, decimals)}%`
}

export function formatAllocationPercent(weight: number, decimals = 1): string {
  return `${formatNumber(weight * 100, decimals)}%`
}

export function clampAllocationPercent(weight: number): number {
  return Math.max(0, Math.min(100, weight * 100))
}

export function buildRelativeMetric(
  label: string,
  relative: number | null,
  assetPerf: number | null,
  benchmarkPerf: number | null,
  symbol: string,
  benchmark: string | null,
): AssetResearchMetric | null {
  if (relative === null) return null
  return {
    label,
    value: formatResearchPercent(relative),
    color: relative >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
    subtitle: `${symbol}: ${formatResearchPercent(assetPerf)} | ${benchmark || 'Benchmark'}: ${formatResearchPercent(benchmarkPerf)}`,
    icon: relative >= 0 ? 'trendingUp' : 'trendingDown',
  }
}

export function buildOverviewMetrics(
  research: AssetResearchDTO,
  t: TFunction,
): AssetResearchMetric[] {
  const currency = research.metadata.asset_currency || research.asset.currency || research.quote?.currency || 'USD'
  const dailyChange = toResearchNumber(research.quote?.daily_change_pct)
  const price = toResearchNumber(research.quote?.price)
  const marketCap = toResearchNumber(research.fundamentals.market_cap)

  return compactMetrics([
    {
      label: 'Current Price',
      value: formatCurrency(price, currency),
      color: 'text-neutral-900 dark:text-neutral-100',
      icon: 'dollarSign',
    },
    dailyChange !== null ? {
      label: 'Daily Change',
      value: formatResearchPercent(dailyChange),
      color: dailyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      icon: dailyChange >= 0 ? 'trendingUp' : 'trendingDown',
    } : null,
    research.risk.risk_score !== null ? {
      label: 'Risk Score',
      value: formatNumber(research.risk.risk_score, 1),
      color: 'text-orange-600 dark:text-orange-400',
      subtitle: getRiskScoreConclusion(research.risk.risk_score, t),
      icon: 'alertTriangle',
    } : null,
    marketCap !== null && marketCap > 0 ? {
      label: 'Market Cap',
      value: `${formatLargeNumber(marketCap, 2)} ${currency}`,
      subtitle: getMarketCapConclusion(marketCap, t),
      icon: 'barChart3',
    } : null,
  ])
}

export function buildFundamentalsMetrics(
  fundamentals: AssetResearchDTO['fundamentals'],
  currency: string,
  t: TFunction,
): AssetResearchMetric[] {
  const marketCap = toResearchNumber(fundamentals.market_cap)

  return compactMetrics([
    marketCap !== null && marketCap > 0 ? {
      label: 'Market Cap',
      value: `${formatLargeNumber(marketCap, 2)} ${currency}`,
      subtitle: getMarketCapConclusion(marketCap, t),
      icon: 'dollarSign',
    } : null,
    fundamentals.volume !== null ? {
      label: 'Volume',
      value: formatWithSeparators(fundamentals.volume),
      subtitle: fundamentals.avg_volume ? getVolumeConclusion(fundamentals.volume, fundamentals.avg_volume, t) : undefined,
      icon: 'barChart3',
    } : null,
    fundamentals.pe_ratio !== null ? {
      label: 'P/E Ratio',
      value: formatRatio(fundamentals.pe_ratio),
      subtitle: getPEConclusion(fundamentals.pe_ratio, t),
      icon: 'activity',
    } : null,
    fundamentals.eps !== null ? {
      label: 'EPS',
      value: formatCurrency(fundamentals.eps, currency),
      subtitle: getEpsConclusion(fundamentals.eps, t),
      icon: 'trendingUp',
    } : null,
    fundamentals.liquidity_score !== null ? {
      label: 'Liquidity Score',
      value: formatNumber(fundamentals.liquidity_score, 1),
      subtitle: getLiquidityScoreConclusion(fundamentals.liquidity_score, t),
      icon: 'lineChart',
    } : null,
  ])
}

export function buildGrowthMetrics(
  fundamentals: AssetResearchDTO['fundamentals'],
  t: TFunction,
): AssetResearchMetric[] {
  return compactMetrics([
    fundamentals.revenue_growth !== null ? {
      label: 'Revenue Growth',
      value: formatResearchPercent(fundamentals.revenue_growth * 100),
      color: fundamentals.revenue_growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      subtitle: getRevenueGrowthConclusion(fundamentals.revenue_growth * 100, t),
      icon: fundamentals.revenue_growth >= 0 ? 'trendingUp' : 'trendingDown',
    } : null,
    fundamentals.earnings_growth !== null ? {
      label: 'Earnings Growth',
      value: formatResearchPercent(fundamentals.earnings_growth * 100),
      color: fundamentals.earnings_growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      subtitle: getEarningsGrowthConclusion(fundamentals.earnings_growth * 100, t),
      icon: fundamentals.earnings_growth >= 0 ? 'trendingUp' : 'trendingDown',
    } : null,
    fundamentals.profit_margins !== null ? {
      label: 'Net Margin',
      value: formatResearchPercent(fundamentals.profit_margins * 100),
      subtitle: getNetMarginConclusion(fundamentals.profit_margins * 100, t),
      icon: 'activity',
    } : null,
    fundamentals.operating_margins !== null ? {
      label: 'Operating Margin',
      value: formatResearchPercent(fundamentals.operating_margins * 100),
      subtitle: getOperatingMarginConclusion(fundamentals.operating_margins * 100, t),
      icon: 'activity',
    } : null,
    fundamentals.return_on_equity !== null ? {
      label: 'ROE',
      value: formatResearchPercent(fundamentals.return_on_equity * 100),
      subtitle: getRoeConclusion(fundamentals.return_on_equity * 100, t),
      icon: 'trendingUp',
    } : null,
  ])
}

export function buildBalanceSheetMetrics(
  fundamentals: AssetResearchDTO['fundamentals'],
  currency: string,
  t: TFunction,
): AssetResearchMetric[] {
  return compactMetrics([
    fundamentals.net_cash !== null ? {
      label: 'Net Cash',
      value: `${formatLargeNumber(fundamentals.net_cash, 2)} ${currency}`,
      color: fundamentals.net_cash >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      subtitle: getNetCashConclusion(fundamentals.net_cash, t),
      icon: 'dollarSign',
    } : null,
    fundamentals.debt_to_equity !== null ? {
      label: 'Debt / Equity',
      value: formatRatio(fundamentals.debt_to_equity),
      subtitle: getDebtToEquityConclusion(fundamentals.debt_to_equity, t),
      icon: 'activity',
    } : null,
    fundamentals.current_ratio !== null ? {
      label: 'Current Ratio',
      value: formatRatio(fundamentals.current_ratio),
      icon: 'shield',
    } : null,
    fundamentals.quick_ratio !== null ? {
      label: 'Quick Ratio',
      value: formatRatio(fundamentals.quick_ratio),
      icon: 'shield',
    } : null,
  ])
}

export function buildRiskMetrics(
  risk: AssetResearchDTO['risk'],
  t: TFunction,
): AssetResearchMetric[] {
  return compactMetrics([
    risk.volatility_30d !== null ? {
      label: '30D Volatility',
      value: `${formatNumber(risk.volatility_30d, 2)}%`,
      color: 'text-orange-600 dark:text-orange-400',
      subtitle: getVolatilityConclusion(risk.volatility_30d, t),
      icon: 'activity',
    } : null,
    risk.volatility_90d !== null ? {
      label: '90D Volatility',
      value: `${formatNumber(risk.volatility_90d, 2)}%`,
      color: 'text-orange-600 dark:text-orange-400',
      subtitle: getVolatilityConclusion(risk.volatility_90d, t),
      icon: 'activity',
    } : null,
    risk.beta !== null ? {
      label: 'Beta',
      value: formatNumber(risk.beta, 2),
      color: 'text-orange-600 dark:text-orange-400',
      subtitle: risk.beta_benchmark ? `vs ${risk.beta_benchmark}` : undefined,
      icon: 'trendingUp',
    } : null,
    risk.distance_to_ath_pct !== null ? {
      label: 'Distance to ATH',
      value: formatResearchPercent(risk.distance_to_ath_pct),
      color: risk.distance_to_ath_pct >= -10 ? 'text-green-600 dark:text-green-400' : risk.distance_to_ath_pct >= -30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
      icon: 'target',
    } : null,
  ])
}

export function buildAnalystMetrics(
  fundamentals: AssetResearchDTO['fundamentals'],
  currency: string,
  t: TFunction,
): AssetResearchMetric[] {
  return compactMetrics([
    fundamentals.recommendation_key !== null ? {
      label: 'Consensus',
      value: formatRecommendation(fundamentals.recommendation_key),
      color: fundamentals.recommendation_key.includes('buy') ? 'text-green-600 dark:text-green-400' : fundamentals.recommendation_key.includes('hold') ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
      subtitle: getAnalystConsensusConclusion(fundamentals.recommendation_mean, t) || undefined,
      icon: 'users',
    } : null,
    fundamentals.num_analysts !== null ? {
      label: 'Analysts',
      value: formatNumber(fundamentals.num_analysts, 0),
      icon: 'users',
    } : null,
    fundamentals.target_mean !== null ? {
      label: 'Target Mean',
      value: formatCurrency(fundamentals.target_mean, currency),
      subtitle: hasAny([fundamentals.target_low, fundamentals.target_high])
        ? `Range: ${formatCurrency(fundamentals.target_low, currency)} - ${formatCurrency(fundamentals.target_high, currency)}`
        : undefined,
      icon: 'target',
    } : null,
    fundamentals.implied_upside_pct !== null ? {
      label: 'Implied Upside',
      value: formatResearchPercent(fundamentals.implied_upside_pct),
      color: fundamentals.implied_upside_pct >= 20 ? 'text-green-600 dark:text-green-400' : fundamentals.implied_upside_pct >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
      subtitle: getImpliedUpsideConclusion(fundamentals.implied_upside_pct, t),
      icon: fundamentals.implied_upside_pct >= 0 ? 'trendingUp' : 'trendingDown',
    } : null,
  ])
}

export function buildAssetResearchMetrics(
  research: AssetResearchDTO,
  t: TFunction,
): AssetResearchMetrics {
  const quote = research.quote
  const currency = research.metadata.asset_currency || research.asset.currency || quote?.currency || 'USD'

  return {
    currency,
    dailyChange: toResearchNumber(quote?.daily_change_pct),
    price: toResearchNumber(quote?.price),
    overview: buildOverviewMetrics(research, t),
    fundamentals: buildFundamentalsMetrics(research.fundamentals, currency, t),
    growth: buildGrowthMetrics(research.fundamentals, t),
    balanceSheet: buildBalanceSheetMetrics(research.fundamentals, currency, t),
    risk: buildRiskMetrics(research.risk, t),
    analyst: buildAnalystMetrics(research.fundamentals, currency, t),
    relative: research.relative_performance,
  }
}
