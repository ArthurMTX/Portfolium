import { PositionDTO, AssetThemeDTO } from '@/api'
import {
  getAnalystConsensusConclusion,
  getBetaConclusion,
  getCurrentRatioConclusion,
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
  getPerformanceConclusion,
  getQuickRatioConclusion,
  getRevenueGrowthConclusion,
  getRiskScoreConclusion,
  getRoeConclusion,
  getVolatilityConclusion,
  getVolumeConclusion,
} from '@/features/assets/lib/conclusionUtils'
import { formatCurrency, formatLargeNumber, formatNumber, formatQuantity, formatWithSeparators } from '@/shared/lib/formatUtils'

type Translate = (key: string, params?: Record<string, unknown>) => string

export type MetricIcon =
  | 'activity'
  | 'alertTriangle'
  | 'arrowUpCircle'
  | 'barChart3'
  | 'clock'
  | 'dollarSign'
  | 'mountain'
  | 'target'
  | 'trendingDown'
  | 'trendingUp'
  | 'users'
  | 'zap'

export interface DetailedMetrics {
  distance_to_ath_pct: number | null
  avg_buy_zone_pct: number | null
  personal_drawdown_pct: number | null
  local_ath_price: number | null
  local_ath_date: string | null
  cost_to_average_down: number | null
  volatility_30d: number | null
  volatility_90d: number | null
  beta: number | null
  beta_benchmark: string | null
  relative_perf_30d: number | null
  relative_perf_90d: number | null
  relative_perf_ytd: number | null
  relative_perf_1y: number | null
  asset_perf_30d: number | null
  asset_perf_90d: number | null
  asset_perf_ytd: number | null
  asset_perf_1y: number | null
  etf_perf_30d: number | null
  etf_perf_90d: number | null
  etf_perf_ytd: number | null
  etf_perf_1y: number | null
  sector_etf: string | null
  risk_score: number | null
  market_cap: number | null
  volume: number | null
  avg_volume: number | null
  pe_ratio: number | null
  eps: number | null
  liquidity_score: number | null
  asset_currency: string | null
  revenue_growth: number | null
  earnings_growth: number | null
  profit_margins: number | null
  operating_margins: number | null
  return_on_equity: number | null
  net_cash: number | null
  debt_to_equity: number | null
  current_ratio: number | null
  quick_ratio: number | null
  recommendation_key: string | null
  recommendation_mean: number | null
  num_analysts: number | null
  target_mean: number | null
  target_high: number | null
  target_low: number | null
  implied_upside_pct: number | null
  themes?: AssetThemeDTO[]
}

export interface MetricCardModel {
  kind: 'metric'
  key: string
  label: string
  value: string
  percentage?: string
  color?: string
  icon?: MetricIcon
  subtitle?: string
  conclusion?: string
}

export interface EmptyMetricModel {
  kind: 'empty'
  key: string
  label: string
  message: string
}

export type MetricGridItem = MetricCardModel | EmptyMetricModel

export interface InfoRowModel {
  key: string
  label: string
  value: string
}

const neutralText = 'text-neutral-900 dark:text-neutral-100'
const mutedText = 'text-neutral-600 dark:text-neutral-400'
const positiveText = 'text-green-600 dark:text-green-400'
const negativeText = 'text-red-600 dark:text-red-400'
const warningText = 'text-amber-600 dark:text-amber-400'
const orangeText = 'text-orange-600 dark:text-orange-400'

const hasValue = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined

const signedPercent = (value: number, decimals = 2) => `${value >= 0 ? '+' : ''}${formatNumber(value, decimals)}%`

const metric = (config: Omit<MetricCardModel, 'kind'>): MetricCardModel => ({
  kind: 'metric',
  ...config,
})

const getPnlColor = (pnlValue: number) => (pnlValue >= 0 ? positiveText : negativeText)

export const getVisibleThemes = (
  detailedMetrics: DetailedMetrics | null,
  positionThemes: AssetThemeDTO[] | undefined
) => detailedMetrics?.themes?.length ? detailedMetrics.themes : positionThemes || []

export const hasFundamentalMetrics = (metrics: DetailedMetrics) => (
  metrics.market_cap !== null ||
  metrics.volume !== null ||
  metrics.avg_volume !== null ||
  metrics.pe_ratio !== null ||
  metrics.eps !== null
)

export const hasGrowthMetrics = (metrics: DetailedMetrics) => (
  metrics.revenue_growth !== null ||
  metrics.earnings_growth !== null ||
  metrics.profit_margins !== null ||
  metrics.operating_margins !== null ||
  metrics.return_on_equity !== null
)

export const hasBalanceSheetMetrics = (metrics: DetailedMetrics) => (
  metrics.net_cash !== null ||
  metrics.debt_to_equity !== null ||
  metrics.current_ratio !== null ||
  metrics.quick_ratio !== null
)

export const hasAnalystMetrics = (metrics: DetailedMetrics) => (
  metrics.recommendation_key !== null ||
  metrics.num_analysts !== null ||
  metrics.target_mean !== null ||
  metrics.implied_upside_pct !== null
)

export const hasRelativePerformanceMetrics = (metrics: DetailedMetrics, position: PositionDTO) => Boolean(
  (position.sector || metrics.sector_etf) &&
  (
    metrics.relative_perf_30d !== null ||
    metrics.relative_perf_90d !== null ||
    metrics.relative_perf_ytd !== null ||
    metrics.relative_perf_1y !== null
  )
)

export const hasRiskMetrics = (metrics: DetailedMetrics | null, position: PositionDTO) => (
  position.vol_contribution_pct !== null && position.vol_contribution_pct !== undefined
) || Boolean(metrics && (
  metrics.volatility_30d !== null ||
  metrics.volatility_90d !== null
))

export const buildFundamentalMetrics = (metrics: DetailedMetrics, t: Translate): MetricCardModel[] => {
  const items: MetricCardModel[] = []
  const currency = metrics.asset_currency || 'USD'

  if (hasValue(metrics.market_cap) && metrics.market_cap > 0) {
    items.push(metric({
      key: 'market-cap',
      label: t('dashboard.positionDetail.marketCap'),
      value: `${formatLargeNumber(metrics.market_cap, 2)} ${currency}`,
      color: neutralText,
      subtitle: getMarketCapConclusion(metrics.market_cap, t),
      icon: 'dollarSign',
    }))
  }

  if (hasValue(metrics.volume)) {
    items.push(metric({
      key: 'volume',
      label: t('dashboard.positionDetail.volume'),
      value: formatWithSeparators(metrics.volume),
      color: neutralText,
      subtitle: metrics.avg_volume ? getVolumeConclusion(metrics.volume, metrics.avg_volume, t) : undefined,
      icon: 'barChart3',
    }))
  }

  if (hasValue(metrics.pe_ratio)) {
    items.push(metric({
      key: 'pe-ratio',
      label: t('dashboard.positionDetail.peRatio'),
      value: formatNumber(metrics.pe_ratio, 2),
      color: neutralText,
      subtitle: getPEConclusion(metrics.pe_ratio, t),
      icon: 'activity',
    }))
  }

  if (hasValue(metrics.eps)) {
    items.push(metric({
      key: 'eps',
      label: t('dashboard.positionDetail.eps'),
      value: formatCurrency(metrics.eps, currency),
      color: neutralText,
      subtitle: getEpsConclusion(metrics.eps, t),
      icon: 'trendingUp',
    }))
  }

  if (hasValue(metrics.liquidity_score)) {
    items.push(metric({
      key: 'liquidity-score',
      label: t('dashboard.positionDetail.liquidityScore'),
      value: formatNumber(metrics.liquidity_score, 2),
      color: neutralText,
      subtitle: getLiquidityScoreConclusion(metrics.liquidity_score, t),
      icon: 'trendingUp',
    }))
  }

  return items
}

export const buildGrowthMetrics = (metrics: DetailedMetrics, t: Translate): MetricCardModel[] => {
  const items: MetricCardModel[] = []

  if (hasValue(metrics.revenue_growth)) {
    const value = metrics.revenue_growth * 100
    items.push(metric({
      key: 'revenue-growth',
      label: t('dashboard.positionDetail.revenueGrowth'),
      value: signedPercent(value),
      color: metrics.revenue_growth >= 0 ? positiveText : negativeText,
      subtitle: getRevenueGrowthConclusion(value, t),
      icon: metrics.revenue_growth >= 0 ? 'trendingUp' : 'trendingDown',
    }))
  }

  if (hasValue(metrics.earnings_growth)) {
    const value = metrics.earnings_growth * 100
    items.push(metric({
      key: 'earnings-growth',
      label: t('dashboard.positionDetail.earningsGrowth'),
      value: signedPercent(value),
      color: metrics.earnings_growth >= 0 ? positiveText : negativeText,
      subtitle: getEarningsGrowthConclusion(value, t),
      icon: metrics.earnings_growth >= 0 ? 'trendingUp' : 'trendingDown',
    }))
  }

  if (hasValue(metrics.profit_margins)) {
    const value = metrics.profit_margins * 100
    items.push(metric({
      key: 'profit-margins',
      label: t('dashboard.positionDetail.netMargin'),
      value: `${formatNumber(value, 2)}%`,
      color: neutralText,
      subtitle: getNetMarginConclusion(value, t),
      icon: 'activity',
    }))
  }

  if (hasValue(metrics.operating_margins)) {
    const value = metrics.operating_margins * 100
    items.push(metric({
      key: 'operating-margins',
      label: t('dashboard.positionDetail.operatingMargin'),
      value: `${formatNumber(value, 2)}%`,
      color: neutralText,
      subtitle: getOperatingMarginConclusion(value, t),
      icon: 'activity',
    }))
  }

  if (hasValue(metrics.return_on_equity)) {
    const value = metrics.return_on_equity * 100
    items.push(metric({
      key: 'return-on-equity',
      label: t('dashboard.positionDetail.roe'),
      value: `${formatNumber(value, 2)}%`,
      color: neutralText,
      subtitle: getRoeConclusion(value, t),
      icon: 'trendingUp',
    }))
  }

  return items
}

export const buildBalanceSheetMetrics = (metrics: DetailedMetrics, t: Translate): MetricCardModel[] => {
  const items: MetricCardModel[] = []
  const currency = metrics.asset_currency || 'USD'

  if (hasValue(metrics.net_cash)) {
    items.push(metric({
      key: 'net-cash',
      label: t('dashboard.positionDetail.netCashPosition'),
      value: `${formatLargeNumber(metrics.net_cash, 2)} ${currency}`,
      color: metrics.net_cash > 0 ? positiveText : negativeText,
      subtitle: getNetCashConclusion(metrics.net_cash, t),
      icon: 'dollarSign',
    }))
  }

  if (hasValue(metrics.debt_to_equity)) {
    items.push(metric({
      key: 'debt-to-equity',
      label: t('dashboard.positionDetail.debtToEquity'),
      value: formatNumber(metrics.debt_to_equity, 2),
      color: neutralText,
      subtitle: getDebtToEquityConclusion(metrics.debt_to_equity, t),
      icon: 'activity',
    }))
  }

  if (hasValue(metrics.current_ratio)) {
    items.push(metric({
      key: 'current-ratio',
      label: t('dashboard.positionDetail.currentRatio'),
      value: formatNumber(metrics.current_ratio, 2),
      color: metrics.current_ratio >= 1.5 ? positiveText : metrics.current_ratio >= 1 ? warningText : negativeText,
      subtitle: getCurrentRatioConclusion(metrics.current_ratio, t),
      icon: 'activity',
    }))
  }

  if (hasValue(metrics.quick_ratio)) {
    items.push(metric({
      key: 'quick-ratio',
      label: t('dashboard.positionDetail.quickRatio'),
      value: formatNumber(metrics.quick_ratio, 2),
      color: metrics.quick_ratio >= 1 ? positiveText : warningText,
      subtitle: getQuickRatioConclusion(metrics.quick_ratio, t),
      icon: 'activity',
    }))
  }

  return items
}

export const buildAnalystMetrics = (metrics: DetailedMetrics, t: Translate): MetricCardModel[] => {
  const items: MetricCardModel[] = []
  const currency = metrics.asset_currency || 'USD'

  if (hasValue(metrics.recommendation_key)) {
    const conclusion = getAnalystConsensusConclusion(metrics.recommendation_mean, t)
    const score = formatNumber(metrics.recommendation_mean, 2)
    items.push(metric({
      key: 'recommendation',
      label: t('dashboard.positionDetail.consensus'),
      value: metrics.recommendation_key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      color: metrics.recommendation_key.includes('buy') ? positiveText : metrics.recommendation_key.includes('hold') ? warningText : negativeText,
      subtitle: conclusion && score ? `${conclusion} · Score: ${score}` : conclusion || undefined,
      icon: 'users',
    }))
  }

  if (hasValue(metrics.num_analysts)) {
    items.push(metric({
      key: 'num-analysts',
      label: t('dashboard.positionDetail.analysts'),
      value: metrics.num_analysts.toString(),
      color: neutralText,
      subtitle: 'Covering',
      icon: 'users',
    }))
  }

  if (hasValue(metrics.target_mean)) {
    items.push(metric({
      key: 'target-mean',
      label: t('dashboard.positionDetail.targetMean'),
      value: formatCurrency(metrics.target_mean, currency),
      color: neutralText,
      subtitle: metrics.target_high && metrics.target_low
        ? `Range: ${formatCurrency(metrics.target_low, currency)} - ${formatCurrency(metrics.target_high, currency)}`
        : undefined,
      icon: 'target',
    }))
  }

  if (hasValue(metrics.implied_upside_pct)) {
    items.push(metric({
      key: 'implied-upside',
      label: t('dashboard.positionDetail.impliedUpside'),
      value: signedPercent(metrics.implied_upside_pct),
      color: metrics.implied_upside_pct >= 20 ? positiveText : metrics.implied_upside_pct >= 0 ? warningText : negativeText,
      subtitle: getImpliedUpsideConclusion(metrics.implied_upside_pct, t),
      icon: metrics.implied_upside_pct >= 0 ? 'trendingUp' : 'trendingDown',
    }))
  }

  return items
}

export const buildPerformanceMetrics = (
  position: PositionDTO,
  metrics: DetailedMetrics | null,
  t: Translate
): MetricCardModel[] => {
  const items: MetricCardModel[] = []

  if (position.quantity > 0 && hasValue(position.unrealized_pnl)) {
    const pnlValue = Number(position.unrealized_pnl)
    items.push(metric({
      key: 'unrealized-pnl',
      label: t('dashboard.unrealizedPnL'),
      value: formatCurrency(position.unrealized_pnl, position.currency),
      percentage: hasValue(position.unrealized_pnl_pct) ? signedPercent(position.unrealized_pnl_pct) : undefined,
      color: getPnlColor(pnlValue),
      icon: pnlValue >= 0 ? 'trendingUp' : 'trendingDown',
    }))
  }

  if (position.realized_quantity > 0) {
    items.push(metric({
      key: 'realized-pnl',
      label: t('dashboard.realizedPnL'),
      value: formatCurrency(position.realized_pnl, position.currency),
      percentage: hasValue(position.realized_pnl_percent) ? signedPercent(position.realized_pnl_percent) : undefined,
      color: getPnlColor(position.realized_pnl),
      icon: position.realized_pnl >= 0 ? 'trendingUp' : 'trendingDown',
    }))

    if (hasValue(position.lifetime_pnl)) {
      items.push(metric({
        key: 'lifetime-pnl',
        label: t('dashboard.lifetimePnL'),
        value: formatCurrency(position.lifetime_pnl, position.currency),
        color: getPnlColor(position.lifetime_pnl),
        icon: position.lifetime_pnl >= 0 ? 'trendingUp' : 'trendingDown',
      }))
    }

    items.push(
      metric({
        key: 'sold-quantity',
        label: t('dashboard.soldQuantity'),
        value: formatQuantity(position.realized_quantity),
        color: neutralText,
      }),
      metric({
        key: 'remaining-quantity',
        label: t('dashboard.remainingQuantity'),
        value: formatQuantity(position.quantity),
        color: neutralText,
      }),
    )

    if (hasValue(position.average_sell_price)) {
      items.push(metric({
        key: 'average-sell-price',
        label: t('dashboard.averageSellPrice'),
        value: formatCurrency(position.average_sell_price, position.currency),
        color: neutralText,
      }))
    }

    if (position.realized_cost_basis > 0) {
      items.push(metric({
        key: 'realized-cost-basis',
        label: t('dashboard.costBasisSold'),
        value: formatCurrency(position.realized_cost_basis, position.currency),
        color: neutralText,
      }))
    }

    if (position.realized_sale_proceeds > 0) {
      items.push(metric({
        key: 'sale-proceeds',
        label: t('dashboard.saleProceeds'),
        value: formatCurrency(position.realized_sale_proceeds, position.currency),
        color: neutralText,
      }))
    }

    if (position.realized_fees > 0) {
      items.push(metric({
        key: 'realized-fees',
        label: t('fields.fees'),
        value: formatCurrency(position.realized_fees, position.currency),
        color: negativeText,
      }))
    }

    items.push(metric({
      key: 'sell-count',
      label: t('dashboard.sellTransactionCount'),
      value: formatWithSeparators(position.realized_sell_count),
      color: neutralText,
    }))
  }

  if (position.breakeven_gain_pct && position.unrealized_pnl !== null && position.unrealized_pnl < 0) {
    items.push(metric({
      key: 'breakeven-gain',
      label: t('dashboard.breakeven.gainNeeded'),
      value: `+${formatNumber(position.breakeven_gain_pct, 2)}%`,
      color: warningText,
      icon: 'arrowUpCircle',
    }))
  }

  if (metrics && hasValue(metrics.personal_drawdown_pct)) {
    items.push(metric({
      key: 'personal-drawdown',
      label: t('dashboard.positionDetail.personalDrawdown'),
      value: `${formatNumber(metrics.personal_drawdown_pct, 2)}%`,
      color: metrics.personal_drawdown_pct >= 0 ? positiveText : negativeText,
      subtitle: metrics.local_ath_price
        ? `${formatCurrency(metrics.local_ath_price, position.currency)}${metrics.local_ath_date ? ` (${new Date(metrics.local_ath_date).toLocaleDateString()})` : ''}`
        : undefined,
      icon: metrics.personal_drawdown_pct >= 0 ? 'trendingUp' : 'trendingDown',
    }))
  }

  if (hasValue(position.daily_change_pct)) {
    items.push(metric({
      key: 'daily-change',
      label: t('dashboard.dailyChange'),
      value: `${formatNumber(position.daily_change_pct, 2)}%`,
      color: position.daily_change_pct >= 0 ? positiveText : negativeText,
      icon: 'clock',
    }))
  }

  return items
}

export const buildTradingZoneMetrics = (
  position: PositionDTO,
  metrics: DetailedMetrics | null,
  t: Translate
): MetricGridItem[] => {
  const pnlValue = position.unrealized_pnl !== null ? Number(position.unrealized_pnl) : 0
  const isPositive = pnlValue >= 0
  const items: MetricGridItem[] = []

  if (metrics && hasValue(metrics.avg_buy_zone_pct)) {
    items.push(metric({
      key: 'avg-buy-zone',
      label: t('dashboard.positionDetail.avgBuyZone'),
      value: `${formatNumber(metrics.avg_buy_zone_pct, 2)}%`,
      color: metrics.avg_buy_zone_pct > 0 ? positiveText : mutedText,
      subtitle: metrics.avg_buy_zone_pct > 0 ? t('dashboard.positionDetail.opportunityToBuy') : t('dashboard.positionDetail.priceAboveAvg'),
      icon: 'target',
    }))
  }

  if (!isPositive && metrics && hasValue(metrics.cost_to_average_down)) {
    items.push(metric({
      key: 'cost-to-average-down',
      label: t('dashboard.positionDetail.costToAvgDown'),
      value: formatCurrency(metrics.cost_to_average_down, position.currency),
      color: neutralText,
      subtitle: t('dashboard.positionDetail.targetPRU5Pct'),
      icon: 'dollarSign',
    }))
  }

  if (metrics && hasValue(metrics.distance_to_ath_pct)) {
    const athPrice = position.ath_price || metrics.local_ath_price
    const athDate = position.ath_date || metrics.local_ath_date
    items.push(metric({
      key: 'distance-to-ath',
      label: t('dashboard.positionDetail.distanceToATH'),
      value: `${formatNumber(metrics.distance_to_ath_pct, 2)}%`,
      color: metrics.distance_to_ath_pct >= -10 ? positiveText : metrics.distance_to_ath_pct >= -30 ? warningText : negativeText,
      subtitle: athPrice ? `ATH: ${formatCurrency(athPrice, position.currency)}${athDate ? ` • ${new Date(athDate).toLocaleDateString()}` : ''}` : undefined,
      icon: 'mountain',
    }))
  } else {
    items.push({
      kind: 'empty',
      key: 'distance-to-ath-empty',
      label: t('dashboard.positionDetail.distanceToATH'),
      message: 'No data available',
    })
  }

  return items
}

const formatRelativeSubtitle = (
  position: PositionDTO,
  metrics: DetailedMetrics,
  assetPerf: number | null,
  etfPerf: number | null
) => (
  `${position.symbol}: ${hasValue(assetPerf) ? signedPercent(assetPerf) : 'N/A'} | ${metrics.sector_etf}: ${hasValue(etfPerf) ? signedPercent(etfPerf) : 'N/A'}`
)

export const buildRelativePerformanceMetrics = (
  position: PositionDTO,
  metrics: DetailedMetrics,
  t: Translate
): MetricCardModel[] => {
  const periods = [
    {
      key: 'relative-30d',
      label: t('charts.periods.1M'),
      period: '30d',
      relative: metrics.relative_perf_30d,
      asset: metrics.asset_perf_30d,
      etf: metrics.etf_perf_30d,
    },
    {
      key: 'relative-90d',
      label: t('charts.periods.3M'),
      period: '90d',
      relative: metrics.relative_perf_90d,
      asset: metrics.asset_perf_90d,
      etf: metrics.etf_perf_90d,
    },
    {
      key: 'relative-ytd',
      label: t('charts.periods.YTD'),
      period: 'ytd',
      relative: metrics.relative_perf_ytd,
      asset: metrics.asset_perf_ytd,
      etf: metrics.etf_perf_ytd,
    },
    {
      key: 'relative-1y',
      label: t('charts.periods.1Y'),
      period: '1y',
      relative: metrics.relative_perf_1y,
      asset: metrics.asset_perf_1y,
      etf: metrics.etf_perf_1y,
    },
  ]

  return periods.flatMap((period) => {
    if (!hasValue(period.relative)) return []

    return metric({
      key: period.key,
      label: period.label,
      value: signedPercent(period.relative),
      color: period.relative >= 0 ? positiveText : negativeText,
      icon: period.relative >= 0 ? 'trendingUp' : 'trendingDown',
      subtitle: formatRelativeSubtitle(position, metrics, period.asset, period.etf),
      conclusion: getPerformanceConclusion(period.relative, period.period, period.asset, t),
    })
  })
}

export const buildRiskMetrics = (
  position: PositionDTO,
  metrics: DetailedMetrics | null,
  t: Translate
): MetricCardModel[] => {
  const items: MetricCardModel[] = []

  if (hasValue(position.vol_contribution_pct)) {
    items.push(metric({
      key: 'vol-contribution',
      label: t('dashboard.positionDetail.volContribution'),
      value: `${formatNumber(position.vol_contribution_pct, 2)}%`,
      color: orangeText,
      subtitle: t('dashboard.positionDetail.portfolioVolatility'),
      icon: 'zap',
    }))
  }

  if (metrics && hasValue(metrics.volatility_30d)) {
    items.push(metric({
      key: 'volatility-30d',
      label: t('dashboard.positionDetail.30DayVolatility'),
      value: `${formatNumber(metrics.volatility_30d, 2)}%`,
      color: orangeText,
      subtitle: t('dashboard.positionDetail.30DayVolatilitySubtitle'),
      icon: 'activity',
      conclusion: getVolatilityConclusion(metrics.volatility_30d, t),
    }))
  }

  if (metrics && hasValue(metrics.volatility_90d)) {
    items.push(metric({
      key: 'volatility-90d',
      label: t('dashboard.positionDetail.90DayVolatility'),
      value: `${formatNumber(metrics.volatility_90d, 2)}%`,
      color: orangeText,
      subtitle: t('dashboard.positionDetail.90DayVolatilitySubtitle'),
      icon: 'activity',
      conclusion: getVolatilityConclusion(metrics.volatility_90d, t),
    }))
  }

  if (metrics && hasValue(metrics.beta)) {
    items.push(metric({
      key: 'beta',
      label: t('dashboard.positionDetail.beta'),
      value: formatNumber(metrics.beta, 2),
      color: orangeText,
      subtitle: metrics.beta_benchmark ? `vs ${metrics.beta_benchmark}` : t('dashboard.positionDetail.marketCorrelation'),
      icon: 'trendingUp',
      conclusion: getBetaConclusion(metrics.beta, t),
    }))
  }

  if (metrics && hasValue(metrics.risk_score)) {
    items.push(metric({
      key: 'risk-score',
      label: t('dashboard.positionDetail.riskScore'),
      value: formatNumber(metrics.risk_score, 1),
      color: orangeText,
      subtitle: t('dashboard.positionDetail.riskScoreSubtitle'),
      icon: 'alertTriangle',
      conclusion: getRiskScoreConclusion(metrics.risk_score, t),
    }))
  }

  return items
}

export const buildBasicInfoRows = (position: PositionDTO, t: Translate): InfoRowModel[] => [
  { key: 'quantity', label: t('fields.quantity'), value: formatNumber(position.quantity, 4) },
  { key: 'avg-cost', label: t('dashboard.avgCost'), value: formatCurrency(position.avg_cost, position.currency) },
  { key: 'current-price', label: t('dashboard.currentPrice'), value: formatCurrency(position.current_price, position.currency) },
  { key: 'market-value', label: t('dashboard.marketValue'), value: formatCurrency(position.market_value, position.currency) },
  { key: 'cost-basis', label: t('dashboard.positionDetail.costBasis'), value: formatCurrency(position.cost_basis, position.currency) },
  { key: 'asset-type', label: t('dashboard.positionDetail.assetType'), value: position.asset_type || '-' },
]
