import { Clock3, Info } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type FreshnessVariant = 'global' | 'compact' | 'tooltipOnly'
type FreshnessState = 'fresh' | 'delayed' | 'marketClosed'

interface DataFreshnessIndicatorProps {
  variant?: FreshnessVariant
  timestamp?: string | number | Date | null
  latestPriceTimestamp?: string | number | Date | null
  marketStatus?: 'premarket' | 'open' | 'afterhours' | 'closed' | 'unknown' | string
  isCached?: boolean
  estimated?: boolean
  tooltip?: ReactNode | false
  showLabel?: boolean
  label?: string
  children?: ReactNode
  className?: string
}

const DELAYED_AFTER_MS = 15 * 60 * 1000
const ISO_WITHOUT_TIMEZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/

function toDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  const normalizedValue = typeof value === 'string' && ISO_WITHOUT_TIMEZONE_RE.test(value)
    ? `${value}Z`
    : value
  const date = normalizedValue instanceof Date ? normalizedValue : new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatAge(date: Date | null, fallback: string): string {
  if (!date) return fallback
  const secondsAgo = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (secondsAgo < 60) return `${secondsAgo}s`
  const minutesAgo = Math.floor(secondsAgo / 60)
  if (minutesAgo < 60) return `${minutesAgo}m`
  const hoursAgo = Math.floor(minutesAgo / 60)
  if (hoursAgo < 48) return `${hoursAgo}h`
  return `${Math.floor(hoursAgo / 24)}d`
}

function formatTimestamp(date: Date | null, locale: string): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function DataFreshnessIndicator({
  variant = 'compact',
  timestamp,
  latestPriceTimestamp,
  marketStatus = 'unknown',
  estimated = false,
  tooltip: customTooltip,
  showLabel = true,
  label,
  children,
  className = '',
}: DataFreshnessIndicatorProps) {
  const { t, i18n } = useTranslation()
  const asOfDate = toDate(timestamp)
  const latestPriceDate = toDate(latestPriceTimestamp)
  const referenceDate = asOfDate || latestPriceDate
  const isMarketClosed = marketStatus === 'closed'
  const isDelayed = referenceDate ? Date.now() - referenceDate.getTime() > DELAYED_AFTER_MS : true

  const state: FreshnessState = isMarketClosed ? 'marketClosed' : isDelayed ? 'delayed' : 'fresh'
  const stateLabel = state === 'marketClosed'
    ? t('freshness.marketClosed')
    : state === 'delayed'
    ? t('freshness.delayed')
    : t('freshness.fresh')

  const age = formatAge(referenceDate, t('common.never'))
  const updatedAgo = t('freshness.updatedAgo', { time: age })
  const marketLabel = t(`market.status.${marketStatus}`, { defaultValue: marketStatus || t('common.unknown') })
  const tooltip = customTooltip === false ? null : customTooltip || [
    `${t('dashboard.marketStatus')}: ${marketLabel}`,
    `${t('freshness.asOf')}: ${formatTimestamp(asOfDate || referenceDate, i18n.language || 'en-US')}`,
    `${t('freshness.lastAvailable')}: ${formatTimestamp(latestPriceDate || asOfDate, i18n.language || 'en-US')}`,
    estimated ? t('freshness.estimated') : null,
  ].filter(Boolean).join('\n')

  const colors = state === 'fresh'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40'
    : state === 'delayed'
    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40'
    : 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700'

  const dot = state === 'fresh'
    ? 'bg-emerald-500'
    : state === 'delayed'
    ? 'bg-amber-500'
    : 'bg-neutral-400'

  const tooltipContent = tooltip ? (
    <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[320px] whitespace-pre-line rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-neutral-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
      {tooltip}
    </span>
  ) : null

  if (variant === 'tooltipOnly') {
    return (
      <span
        tabIndex={tooltip ? 0 : undefined}
        aria-label={typeof tooltip === 'string' ? tooltip : undefined}
        className={`${tooltip ? 'group relative cursor-help whitespace-pre-line' : ''} inline-flex items-center outline-none ${className}`}
      >
        {children || <Info size={13} className="inline text-neutral-400 dark:text-neutral-500" />}
        {tooltipContent}
      </span>
    )
  }

  if (variant === 'global') {
    return (
      <div
        tabIndex={tooltip ? 0 : undefined}
        aria-label={typeof tooltip === 'string' ? tooltip : undefined}
        className={`${tooltip ? 'group relative cursor-help' : ''} inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs outline-none ${colors} ${className}`}
      >
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="font-semibold whitespace-nowrap">{label || stateLabel}</span>
        <span className="hidden sm:inline text-current/75">·</span>
        <span className="hidden sm:inline whitespace-nowrap text-current/80">{updatedAgo}</span>
        <Clock3 size={13} className="sm:hidden" />
        {tooltipContent}
      </div>
    )
  }

  return (
    <span
      tabIndex={tooltip ? 0 : undefined}
      aria-label={typeof tooltip === 'string' ? tooltip : undefined}
      className={`${tooltip ? 'group relative cursor-help' : ''} inline-flex items-center gap-1.5 text-xs outline-none ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {showLabel && (
        <span className="text-neutral-500 dark:text-neutral-400">{label || (estimated ? t('freshness.estimated') : stateLabel)}</span>
      )}
      {tooltipContent}
    </span>
  )
}
