import type { DistributionItemDTO, PositionDTO, ThemeDistributionItemDTO } from '@/api'
import type {
  AttributionItem,
  DashboardOverviewMetrics,
  DashboardOverviewTransaction,
  ExposureItem,
  ExposureResult,
} from '@/features/dashboard-overview/types'

export function numberValue(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateTotalGain(metrics: DashboardOverviewMetrics): number {
  return (
    numberValue(metrics.total_unrealized_pnl) +
    numberValue(metrics.total_realized_pnl) +
    numberValue(metrics.total_dividends) -
    numberValue(metrics.total_fees)
  )
}

export function calculatePositionDailyImpact(position: PositionDTO): number {
  const value = numberValue(position.market_value)
  const percentage = numberValue(position.daily_change_pct)
  const denominator = 1 + percentage / 100

  if (!value || !percentage || denominator <= 0) return 0

  return value - value / denominator
}

export function buildDailyAttribution(
  positions: PositionDTO[],
  authoritativeTotal: number,
  visibleCount = 3,
): AttributionItem[] {
  const ranked: AttributionItem[] = positions
    .map((position) => ({
      key: String(position.asset_id),
      label: position.symbol,
      value: calculatePositionDailyImpact(position),
      estimated: true,
      assetType: position.asset_type,
      assetName: position.name,
    }))
    .filter((item) => Math.abs(item.value) >= 0.005)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  const visible = ranked.slice(0, visibleCount)
  const visibleTotal = visible.reduce((sum, item) => sum + item.value, 0)
  const remainder = authoritativeTotal - visibleTotal

  if (ranked.length > visibleCount || Math.abs(remainder) >= 0.005) {
    visible.push({
      key: 'remainder',
      label: 'Other positions and market effects',
      value: remainder,
      estimated: true,
    })
  }

  return visible
}

function fromDistribution(items: DistributionItemDTO[] = []): ExposureItem[] {
  return items.map((item, index) => ({
    key: `${item.name}-${index}`,
    label: item.name || 'Unknown',
    value: numberValue(item.total_value),
    percentage: numberValue(item.percentage),
    count: item.count,
  }))
}

function fromThemes(items: ThemeDistributionItemDTO[] = []): ExposureItem[] {
  return items.map((item, index) => ({
    key: `${item.theme}-${index}`,
    label: item.theme || 'Unknown',
    value: numberValue(item.value),
    percentage: numberValue(item.percentage),
    count: item.assets?.length,
  }))
}

export function buildExposure(
  items: DistributionItemDTO[] | ThemeDistributionItemDTO[] | undefined,
  dimension: 'theme' | 'standard',
): ExposureResult {
  const normalized =
    dimension === 'theme'
      ? fromThemes((items ?? []) as ThemeDistributionItemDTO[])
      : fromDistribution((items ?? []) as DistributionItemDTO[])

  const sorted = normalized
    .filter((item) => item.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage)
  const totalPercentage = sorted.reduce((sum, item) => sum + item.percentage, 0)
  const isCompleteWhole = totalPercentage >= 99 && totalPercentage <= 101

  return { items: sorted, isCompleteWhole, totalPercentage }
}

export function calculateConcentration(positions: PositionDTO[]) {
  const totalValue = positions.reduce(
    (sum, position) => sum + numberValue(position.market_value),
    0,
  )
  const ranked = [...positions].sort(
    (a, b) => numberValue(b.market_value) - numberValue(a.market_value),
  )
  const largest = ranked[0] ?? null
  const topThreeValue = ranked
    .slice(0, 3)
    .reduce((sum, position) => sum + numberValue(position.market_value), 0)

  return {
    totalValue,
    largest,
    largestWeight:
      largest && totalValue > 0 ? (numberValue(largest.market_value) / totalValue) * 100 : 0,
    topThreeWeight: totalValue > 0 ? (topThreeValue / totalValue) * 100 : 0,
  }
}

export function calculateTransactionAmount(transaction: DashboardOverviewTransaction): number {
  return numberValue(transaction.quantity) * numberValue(transaction.price)
}
