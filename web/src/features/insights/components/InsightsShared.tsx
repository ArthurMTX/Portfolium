/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BadgeDollarSign, Building2, Coins, Globe2, HelpCircle, Info, RefreshCw } from 'lucide-react'
import type { ContributionItemDTO } from '@/api'
import { StateBlock, TableSkeleton } from '@/shared/components/StatePrimitives'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import { getAssetLogoUrl, handleLogoError } from '@/shared/lib/logoUtils'
import { getSectorColor, getSectorHexColor, getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeColor, getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'

export interface InsightsTabProps {
  portfolioId: number
  period: string
  benchmark: string
  currency: string
  currencySymbol: string
  locale: string
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatPercent(value: unknown, decimals = 2, signed = false): string {
  const numeric = toNumber(value)
  const prefix = signed && numeric > 0 ? '+' : ''
  return `${prefix}${numeric.toFixed(decimals)}%`
}

export function formatNumber(value: unknown, decimals = 2): string {
  return toNumber(value).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })
}

export function formatCurrencyValue(value: unknown, currency: string): string {
  const numeric = toNumber(value)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(numeric) >= 1000 ? 0 : 2,
    }).format(numeric)
  } catch {
    return `${currency} ${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }
}

export function valueColor(value: unknown): string {
  const numeric = toNumber(value)
  if (numeric > 0) return 'text-green-600 dark:text-green-400'
  if (numeric < 0) return 'text-red-600 dark:text-red-400'
  return 'text-neutral-700 dark:text-neutral-300'
}

export function periodLabel(period: string): string {
  const labels: Record<string, string> = {
    '1m': '1M',
    '3m': '3M',
    '6m': '6M',
    ytd: 'YTD',
    '1y': '1Y',
    all: 'All time',
  }
  return labels[period] || period.toUpperCase()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load this block.'
}

function InfoTooltip({
  children,
  label = 'More information',
  align = 'right',
}: {
  children: ReactNode
  label?: string
  align?: 'left' | 'right'
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:bg-neutral-100 focus:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus:bg-neutral-800 dark:focus:text-neutral-200"
      >
        <Info size={15} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-2 w-72 rounded-lg border border-neutral-200 bg-white p-3 text-left text-xs leading-5 text-neutral-700 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 ${
          align === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        {children}
      </span>
    </span>
  )
}

export function InsightBlock({
  title,
  scope,
  description,
  formula,
  isLoading,
  error,
  isEmpty,
  emptyMessage = 'No data available for this block.',
  onRetry,
  skeleton,
  children,
  className = '',
}: {
  title: string
  icon?: ReactNode
  scope?: string
  description?: ReactNode
  formula?: ReactNode
  isLoading: boolean
  error: unknown
  isEmpty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  skeleton: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`pf-section pf-section--spacious insights-block ${className ?? ''}`}>
      <div className="pf-section-header pf-section-header--spacious insights-block__header">
        <div>
          {scope && <p className="pf-section-kicker">{scope}</p>}
          <h2 className="pf-section-title">{title}</h2>
        </div>
        <div className="pf-section-header__aside insights-block__actions">
          {(description || formula) && (
            <InfoTooltip label={`${title} details`}>
              <div className="space-y-2">
                {description && <p>{description}</p>}
                {formula && (
                  <p>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">Formula: </span>
                    {formula}
                  </p>
                )}
              </div>
            </InfoTooltip>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="insights-icon-button"
              title="Refresh"
              aria-label={`Refresh ${title}`}
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        skeleton
      ) : error ? (
        <StateBlock
          tone="error"
          className="insights-error"
          eyebrow="Insight unavailable"
          title="This block could not load."
          detail={errorMessage(error)}
          actionLabel={onRetry ? 'Retry' : undefined}
          onAction={onRetry}
        />
      ) : isEmpty ? (
        <StateBlock
          className="insights-empty"
          eyebrow="No data"
          title={emptyMessage}
          description="This insight will appear when enough portfolio data is available."
        />
      ) : (
        children
      )}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  subtitle,
  tone = 'neutral',
  tooltip,
}: {
  label: string
  value: string
  subtitle?: string
  icon?: ReactNode
  tone?: 'neutral' | 'positive' | 'negative' | 'accent'
  tooltip?: ReactNode
}) {
  const toneClass = {
    neutral: undefined,
    positive: 'is-positive',
    negative: 'is-negative',
    accent: 'insights-metric-accent',
  }[tone]

  return (
    <div className="insights-metric">
      <span>
        {label}
        {tooltip && (
          <InfoTooltip label={`${label} details`} align="left">
            {tooltip}
          </InfoTooltip>
        )}
      </span>
      <strong className={toneClass}>{value}</strong>
      {subtitle && <em>{subtitle}</em>}
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="insights-metric is-loading">
      <span className="pf-skeleton" />
      <strong className="pf-skeleton" />
    </div>
  )
}

export function BarsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between">
            <div className="pf-skeleton h-4 w-32" />
            <div className="pf-skeleton h-4 w-14" />
          </div>
          <div className="pf-skeleton h-2 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function MiniTableSkeleton({ rows = 5 }: { rows?: number }) {
  return <TableSkeleton rows={rows} columns={3} label="Loading insight table" />
}

export function ContributionBars({
  items,
  valueLabel,
  maxRows = 8,
  kind = 'asset',
  barTone = 'category',
}: {
  items: ContributionItemDTO[]
  valueLabel: (item: ContributionItemDTO) => string
  maxRows?: number
  kind?: ContributionVisualKind
  barTone?: 'category' | 'value'
}) {
  const rows = items.slice(0, maxRows)
  const maxWeight = Math.max(...rows.map((item) => Math.abs(toNumber(item.portfolio_weight))), 1)

  return (
    <div className="space-y-4">
      {rows.map((item) => {
        const weight = Math.abs(toNumber(item.portfolio_weight))
        const barColor = barTone === 'value' ? valueBarColor(item.unrealized_pnl) : getContributionColor(kind, item.name || item.symbol)
        return (
          <div key={`${item.name}-${item.symbol || ''}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <ContributionIdentity item={item} kind={kind} />
              <div className="flex-shrink-0 text-right">
                <p className="font-semibold">{valueLabel(item)}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatPercent(item.portfolio_weight, 1)}</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: barColor,
                  width: `${Math.min((weight / maxWeight) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export type ContributionVisualKind = 'asset' | 'theme' | 'sector' | 'country' | 'currency' | 'marketCap' | 'generic'

export function ContributionIdentity({
  item,
  kind = 'asset',
  subtitle,
}: {
  item: ContributionItemDTO
  kind?: ContributionVisualKind
  subtitle?: string
}) {
  const primary = primaryLabel(item, kind)
  const secondary = subtitle ?? secondaryLabel(item, kind)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <ContributionVisual item={item} kind={kind} />
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">{primary}</p>
        {secondary && <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{secondary}</p>}
      </div>
    </div>
  )
}

export function ContributionVisual({ item, kind }: { item: ContributionItemDTO; kind: ContributionVisualKind }) {
  const label = item.name || item.symbol || 'Unknown'

  if (kind === 'asset') {
    const initials = initialsFor(item.symbol || item.name)
    return (
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white text-[10px] font-semibold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
        <span className="absolute inset-0 flex items-center justify-center">{initials}</span>
        {item.symbol && (
          <img
            src={getAssetLogoUrl(item.symbol, item.asset_type, item.name)}
            alt=""
            className="relative h-8 w-8 object-contain"
            onError={(event) => handleLogoError(event, item.symbol || '', item.name, item.asset_type)}
          />
        )}
      </div>
    )
  }

  if (kind === 'country') {
    const flagUrl = getFlagUrl(label, 'w40')
    if (flagUrl) {
      return (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <img src={flagUrl} alt="" className="h-5 w-7 rounded-sm object-cover" />
        </div>
      )
    }
    return <IconBadge icon={Globe2} colorClass="text-neutral-500 dark:text-neutral-400" />
  }

  if (kind === 'theme') {
    return <IconBadge icon={getThemeIcon(label)} colorClass={getThemeColor(label)} />
  }

  if (kind === 'sector') {
    return <IconBadge icon={getSectorIcon(label)} colorClass={getSectorColor(label)} />
  }

  if (kind === 'currency') {
    return <IconBadge icon={Coins} colorClass="text-blue-600 dark:text-blue-400" />
  }

  if (kind === 'marketCap') {
    return <IconBadge icon={label.includes('unavailable') ? HelpCircle : label.includes('ETF') ? Building2 : BadgeDollarSign} colorClass="text-indigo-600 dark:text-indigo-400" />
  }

  return <IconBadge icon={HelpCircle} colorClass="text-neutral-500 dark:text-neutral-400" />
}

function IconBadge({ icon: Icon, colorClass }: { icon: LucideIcon; colorClass: string }) {
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
      <Icon className={`h-5 w-5 ${colorClass}`} />
    </div>
  )
}

function primaryLabel(item: ContributionItemDTO, kind: ContributionVisualKind): string {
  if (kind === 'asset') return item.name || item.symbol || 'Unknown asset'
  return item.name || item.symbol || 'Unknown'
}

function secondaryLabel(item: ContributionItemDTO, kind: ContributionVisualKind): string | undefined {
  if (kind === 'asset') {
    const symbol = item.symbol || ''
    const name = item.name || ''
    return symbol && symbol !== name ? symbol : undefined
  }
  if (item.count > 1) return `${item.count} holdings`
  return undefined
}

function initialsFor(value?: string | null): string {
  const cleaned = (value || '?').replace(/[^A-Za-z0-9]/g, '')
  return (cleaned || '?').slice(0, 3).toUpperCase()
}

function valueBarColor(value: unknown): string {
  const numeric = toNumber(value)
  if (numeric > 0) return '#16a34a'
  if (numeric < 0) return '#dc2626'
  return '#737373'
}

export function getContributionColor(kind: ContributionVisualKind, label?: string | null): string {
  const safeLabel = label || 'Unknown'
  if (kind === 'theme') return getThemeHexColor(safeLabel)
  if (kind === 'sector') return getSectorHexColor(safeLabel)
  if (kind === 'marketCap') return marketCapColor(safeLabel)
  return paletteColor(safeLabel)
}

function marketCapColor(label: string): string {
  const colors: Record<string, string> = {
    'Mega Cap': '#4338ca',
    'Large Cap': '#2563eb',
    'Mid Cap': '#0891b2',
    'Small Cap': '#059669',
    'Micro Cap': '#ca8a04',
    'Funds / ETFs': '#7c3aed',
    'Crypto assets': '#f59e0b',
    'Market cap unavailable': '#737373',
  }
  return colors[label] || '#737373'
}

function paletteColor(label: string): string {
  const palette = ['#ec4899', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5']
  let hash = 0
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) % palette.length
  }
  return palette[Math.abs(hash) % palette.length]
}
