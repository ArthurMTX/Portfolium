import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CircleDollarSign,
  ReceiptText,
  Shuffle,
  type LucideIcon,
} from 'lucide-react'
import type { AssetInvestmentNoteDTO, PositionDTO } from '@/api'
import type { AssetResearchMetric } from '@/features/assets/lib/assetResearchMetricBuilders'
import { formatCurrency, formatNumber } from '@/shared/lib/formatUtils'
import { researchNumber } from '@/features/asset-research/lib/assetResearchViewCalculations'
import type { AssetResearchViewTab } from '@/features/asset-research/types'

export function getTabs(
  t: (key: string) => string,
): Array<{ id: AssetResearchViewTab; label: string; object: 'asset' | 'position' }> {
  return [
    { id: 'overview', label: t('assetResearchView.tabs.overview'), object: 'asset' },
    { id: 'financials', label: t('assetResearchView.tabs.financials'), object: 'asset' },
    { id: 'valuation', label: t('assetResearchView.tabs.valuation'), object: 'asset' },
    { id: 'risk', label: t('assetResearchView.tabs.risk'), object: 'asset' },
    { id: 'position', label: t('assetResearchView.tabs.position'), object: 'position' },
  ]
}

export interface TransactionVisual {
  Icon: LucideIcon
  label: string
  tone: string
}

export function getTransactionVisual(type: string, t: (key: string) => string): TransactionVisual {
  switch (type.toUpperCase()) {
    case 'BUY':
      return { Icon: ArrowDownToLine, label: t('assetResearchView.transactionKinds.buy'), tone: 'positive' }
    case 'SELL':
      return { Icon: ArrowUpFromLine, label: t('assetResearchView.transactionKinds.sell'), tone: 'negative' }
    case 'DIVIDEND':
      return { Icon: CircleDollarSign, label: t('assetResearchView.transactionKinds.dividend'), tone: 'income' }
    case 'SPLIT':
      return { Icon: Shuffle, label: t('assetResearchView.transactionKinds.split'), tone: 'structure' }
    case 'FEE':
      return { Icon: ReceiptText, label: t('assetResearchView.transactionKinds.fee'), tone: 'negative' }
    case 'TRANSFER_IN':
      return { Icon: ArrowDownToLine, label: t('assetResearchView.transactionKinds.transferIn'), tone: 'positive' }
    case 'TRANSFER_OUT':
      return { Icon: ArrowUpFromLine, label: t('assetResearchView.transactionKinds.transferOut'), tone: 'negative' }
    case 'CONVERSION_IN':
      return { Icon: ArrowLeftRight, label: t('assetResearchView.transactionKinds.conversionIn'), tone: 'structure' }
    case 'CONVERSION_OUT':
      return { Icon: ArrowLeftRight, label: t('assetResearchView.transactionKinds.conversionOut'), tone: 'structure' }
    default:
      return { Icon: ArrowLeftRight, label: type, tone: 'neutral' }
  }
}

export function signedCurrency(value: number, currency: string, locale: string) {
  const formatted = formatCurrency(Math.abs(value), currency, locale)
  if (value > 0) return `+${formatted}`
  if (value < 0) return `−${formatted}`
  return formatted
}

export function signedPercent(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined) return '-'
  const normalized = researchNumber(value)
  if (normalized > 0) return `+${formatNumber(normalized, decimals)}%`
  if (normalized < 0) return `−${formatNumber(Math.abs(normalized), decimals)}%`
  return `${formatNumber(0, decimals)}%`
}

export function gainNeededToBreakeven(position: PositionDTO) {
  if (position.unrealized_pnl === null || position.unrealized_pnl >= 0) return null
  if (position.breakeven_gain_pct !== null && position.breakeven_gain_pct !== undefined) {
    return researchNumber(position.breakeven_gain_pct)
  }
  if (!position.current_price || position.current_price <= 0 || position.avg_cost <= position.current_price) {
    return null
  }
  return ((position.avg_cost - position.current_price) / position.current_price) * 100
}

export function valueTone(value: number | null | undefined) {
  const normalized = researchNumber(value)
  if (normalized > 0) return 'asset-research__value--positive'
  if (normalized < 0) return 'asset-research__value--negative'
  return 'asset-research__value--neutral'
}

export function metricTone(metric: AssetResearchMetric) {
  if (metric.color?.includes('green')) return 'asset-research__value--positive'
  if (metric.color?.includes('red')) return 'asset-research__value--negative'
  if (metric.color?.includes('orange') || metric.color?.includes('amber')) {
    return 'asset-research__value--warning'
  }
  return ''
}

export function hasNoteContent(note: AssetInvestmentNoteDTO | null | undefined) {
  return Boolean(
    note?.thesis ||
      note?.conviction ||
      note?.risks ||
      note?.target_price ||
      note?.target_text ||
      note?.invalidation_thesis ||
      note?.horizon ||
      note?.horizon_date,
  )
}

export function clampWeightPercent(weight: number): number {
  return Math.max(0, Math.min(100, weight * 100))
}
