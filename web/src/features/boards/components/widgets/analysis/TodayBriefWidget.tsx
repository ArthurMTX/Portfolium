import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Bell, CalendarDays, Clock3, Info, PiggyBank, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api, { type TodayBriefItemDTO } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { BaseWidgetProps } from '@/features/boards/components/types'

interface TodayBriefWidgetProps extends BaseWidgetProps {}

const severityStyles: Record<TodayBriefItemDTO['severity'], { pill: string; icon: string }> = {
  positive: {
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  negative: {
    pill: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/30',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  neutral: {
    pill: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
    icon: 'text-neutral-500 dark:text-neutral-400',
  },
  warning: {
    pill: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30',
    icon: 'text-amber-600 dark:text-amber-400',
  },
}

const calmNoteStyles = {
  pill: 'bg-transparent text-neutral-500 border-neutral-200 dark:text-neutral-400 dark:border-neutral-700',
  icon: 'text-neutral-400 dark:text-neutral-500',
}

function getItemIcon(type: string, severity: TodayBriefItemDTO['severity']) {
  const className = type === 'delayed_data' ? calmNoteStyles.icon : severityStyles[severity].icon
  if (type === 'portfolio_performance' || type === 'holding_best_mover' || type === 'watchlist_move') {
    return <ArrowUpRight size={14} className={className} />
  }
  if (type === 'holding_worst_mover') {
    return <ArrowDownRight size={14} className={className} />
  }
  if (type === 'delayed_data') {
    return <Info size={13} className={className} />
  }
  if (type === 'pending_dividends') {
    return <PiggyBank size={14} className={className} />
  }
  if (type === 'earnings_soon') {
    return <CalendarDays size={14} className={className} />
  }
  if (type === 'ath' || type === 'atl') {
    return <Sparkles size={14} className={className} />
  }
  if (type === 'price_alert') {
    return <Bell size={14} className={className} />
  }
  return <Clock3 size={14} className={className} />
}

function isPrimaryItem(type: string): boolean {
  return ['portfolio_performance', 'holding_best_mover', 'holding_worst_mover', 'earnings_soon'].includes(type)
}

function isSubtleItem(type: string): boolean {
  return ['delayed_data', 'pending_dividends'].includes(type)
}

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getRelativeDateLabel(value: string | null | undefined, t: (key: string) => string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const today = toDateOnly(new Date())
  const target = toDateOnly(date)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  if (diffDays === 0) return t('dashboard.widgets.todayBrief.relativeDates.today')
  if (diffDays === 1) return t('dashboard.widgets.todayBrief.relativeDates.tomorrow')
  if (diffDays > 1 && diffDays <= 6) return t('dashboard.widgets.todayBrief.relativeDates.thisWeek')
  if (diffDays < 0 && diffDays >= -3) return t('dashboard.widgets.todayBrief.relativeDates.recently')
  if (diffDays < -3) return null

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getDisplayTitle(
  item: TodayBriefItemDTO,
  marketStatus: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (item.type === 'delayed_data') {
    if (marketStatus === 'closed' || marketStatus === 'afterhours') {
      return t('dashboard.widgets.todayBrief.freshness.marketClosed')
    }
    if (marketStatus === 'premarket') {
      return t('dashboard.widgets.todayBrief.freshness.recent')
    }
    return t('dashboard.widgets.todayBrief.freshness.mayBeDelayed')
  }

  if (item.type === 'pending_dividends') {
    if (item.description) {
      return t('dashboard.widgets.todayBrief.dividends.expectedSoon', { amount: item.description })
    }
    return t('dashboard.widgets.todayBrief.dividends.upcoming')
  }

  return item.title
}

function getDisplayDescription(
  item: TodayBriefItemDTO,
  t: (key: string) => string
): string | null | undefined {
  if (item.type === 'delayed_data') {
    return t('dashboard.widgets.todayBrief.freshness.secondary')
  }

  if (item.type === 'pending_dividends') {
    return item.value ? t('dashboard.widgets.todayBrief.dividends.secondary') : null
  }

  return item.description
}

function getDisplayValue(item: TodayBriefItemDTO): string | null | undefined {
  if (isSubtleItem(item.type)) return null
  return item.value
}

function getItemTooltip(item: TodayBriefItemDTO, t: (key: string, options?: Record<string, unknown>) => string): string | undefined {
  if (item.type === 'delayed_data' && item.value) {
    return t('dashboard.widgets.todayBrief.freshness.tooltip', { count: item.value })
  }

  if (item.type === 'pending_dividends' && item.value) {
    return t('dashboard.widgets.todayBrief.dividends.tooltip', { count: item.value })
  }

  return undefined
}

export default function TodayBriefWidget({ isPreview = false }: TodayBriefWidgetProps) {
  const { t } = useTranslation()
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const shouldLoad = useWidgetVisibility('today-brief')

  const { data, isLoading } = useQuery({
    queryKey: ['today-brief', activePortfolioId],
    queryFn: () => api.getTodayBrief(activePortfolioId!),
    enabled: !isPreview && !!activePortfolioId && shouldLoad,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.healthCheck(),
    enabled: !isPreview && shouldLoad,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })

  const mockItems: TodayBriefItemDTO[] = [
    {
      id: 'portfolio-performance',
      type: 'portfolio_performance',
      severity: 'positive',
      title: 'Portfolio +1.8% today',
      description: '+$312.40',
      value: '+1.8%',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'earnings-soon',
      type: 'earnings_soon',
      severity: 'neutral',
      title: '2 earnings tomorrow',
      description: 'NVDA, ASML',
      value: '2',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'pending-dividends',
      type: 'pending_dividends',
      severity: 'neutral',
      title: '1 pending dividend',
      description: '$18.40 awaiting review',
      value: '1',
      timestamp: new Date().toISOString(),
    },
  ]

  const items = isPreview ? mockItems : data?.items ?? []
  const loading = isLoading && !isPreview

  return (
    <BaseWidget
      title="dashboard.widgets.todayBrief.name"
      icon={Sparkles}
      iconColor="text-fuchsia-600 dark:text-fuchsia-400"
      iconBgColor="bg-fuchsia-50 dark:bg-fuchsia-900/20"
      isLoading={loading}
      isEmpty={items.length === 0}
      emptyMessage="dashboard.widgets.todayBrief.emptyState"
      emptyIcon={Clock3}
      scrollable={false}
    >
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {items.slice(0, 7).map((item: TodayBriefItemDTO) => {
          const styles = item.type === 'delayed_data' ? calmNoteStyles : severityStyles[item.severity]
          const primary = isPrimaryItem(item.type)
          const subtle = isSubtleItem(item.type)
          const timestampLabel = subtle ? null : getRelativeDateLabel(item.timestamp, t)
          const title = getDisplayTitle(item, health?.market_status, t)
          const description = getDisplayDescription(item, t)
          const value = getDisplayValue(item)
          const tooltip = getItemTooltip(item, t)

          return (
            <div
              key={item.id}
              className={`${primary ? 'px-5 py-3.5' : 'px-5 py-2.5'} ${subtle ? 'bg-neutral-50/40 dark:bg-neutral-900/20' : ''}`}
              title={tooltip}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex items-center justify-center rounded-md border ${primary ? 'h-7 w-7' : 'h-6 w-6'} ${styles.pill}`}>
                  {getItemIcon(item.type, item.severity)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`min-w-0 flex-1 truncate ${primary ? 'text-sm font-semibold text-neutral-950 dark:text-neutral-50' : 'text-xs font-medium text-neutral-600 dark:text-neutral-300'}`}>
                      {title}
                    </p>
                    {value && (
                      <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles.pill}`}>
                        {value}
                      </span>
                    )}
                  </div>
                  <div className={`mt-1 flex items-center gap-2 text-xs ${subtle ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {item.symbol && <span className="font-semibold text-neutral-600 dark:text-neutral-300">{item.symbol}</span>}
                    {description && <span className="truncate">{description}</span>}
                    {timestampLabel && <span className="flex-shrink-0">{timestampLabel}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </BaseWidget>
  )
}
