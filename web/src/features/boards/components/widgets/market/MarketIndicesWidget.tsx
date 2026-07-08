import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react'
import { getMarketIndices } from '@/api'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useTranslation } from 'react-i18next'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetList } from '@/features/boards/components/widgets/base/WidgetList'
import { WidgetListItem } from '@/features/boards/components/widgets/base/WidgetListItem'

interface MarketIndex {
  symbol: string
  name: string
  regionKey: string
  country: string
}

const marketIndices: MarketIndex[] = [
  // America
  { symbol: '^GSPC', name: 'S&P 500', regionKey: 'dashboard.widgets.marketIndices.regions.us', country: 'US' },
  { symbol: '^DJI', name: 'Dow Jones', regionKey: 'dashboard.widgets.marketIndices.regions.us', country: 'US' },
  { symbol: '^IXIC', name: 'Nasdaq', regionKey: 'dashboard.widgets.marketIndices.regions.us', country: 'US' },
  { symbol: '^GSPTSE', name: 'TSX', regionKey: 'dashboard.widgets.marketIndices.regions.us', country: 'Canada' },

  // Europe
  { symbol: '^FTSE', name: 'FTSE 100', regionKey: 'dashboard.widgets.marketIndices.regions.europe', country: 'UK' },
  { symbol: '^GDAXI', name: 'DAX', regionKey: 'dashboard.widgets.marketIndices.regions.europe', country: 'Germany' },
  { symbol: '^FCHI', name: 'CAC 40', regionKey: 'dashboard.widgets.marketIndices.regions.europe', country: 'France' },
  { symbol: 'FTSEMIB.MI', name: 'FTSE MIB', regionKey: 'dashboard.widgets.marketIndices.regions.europe', country: 'Italy' },

  // Asia
  { symbol: '^N225', name: 'Nikkei 225', regionKey: 'dashboard.widgets.marketIndices.regions.asia', country: 'Japan' },
  { symbol: '^HSI', name: 'Hang Seng', regionKey: 'dashboard.widgets.marketIndices.regions.asia', country: 'Hong Kong' },
  { symbol: '000001.SS', name: 'SSE Composite', regionKey: 'dashboard.widgets.marketIndices.regions.asia', country: 'China' },
  { symbol: '^AXJO', name: 'ASX 200', regionKey: 'dashboard.widgets.marketIndices.regions.asia', country: 'Australia' },
]

const prioritySymbols = new Set(['^GSPC', '^IXIC', '^DJI', '^FTSE', '^GDAXI', '^N225'])

interface MarketIndicesWidgetProps extends BaseWidgetProps {
  batchData?: { market_indices?: unknown }
}

export default function MarketIndicesWidget({ isPreview = false, batchData }: MarketIndicesWidgetProps) {
  const shouldLoad = useWidgetVisibility('market-indices')
  const { t } = useTranslation()
  const [showAllMarkets, setShowAllMarkets] = useState(false)

  // Get data from batch if available
  const hasBatchData = !!batchData?.market_indices

  const { data: queryData, isLoading: queryLoading, error, refetch } = useQuery({
    queryKey: ['market-indices'],
    queryFn: () => getMarketIndices(),
    refetchInterval: isPreview ? false : 60000,
    retry: 2,
    enabled: (isPreview || shouldLoad) && !hasBatchData,
  })

  // Use batch data if available, otherwise use query data
  const indices = (hasBatchData ? batchData.market_indices : queryData) as Record<string, { current_price?: number; price?: number; percent_change?: number; daily_change_pct?: number }> | undefined
  const isLoading = queryLoading && !isPreview && !hasBatchData

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return '—'
    // Convert to number in case it's a Decimal/string from backend
    const numPrice = typeof price === 'number' ? price : Number(price)
    if (isNaN(numPrice)) return '—'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numPrice)
  }

  const formatChange = (change?: number) => {
    if (change === undefined || change === null) return '—'
    // Convert to number in case it's a Decimal/string from backend
    const numChange = typeof change === 'number' ? change : Number(change)
    if (isNaN(numChange)) return '—'
    const sign = numChange >= 0 ? '+' : ''
    return `${sign}${numChange.toFixed(2)}%`
  }

  const getChangeIcon = (change?: number) => {
    if (change === undefined || change === null) return <Minus size={14} className="text-neutral-400" />
    const numChange = typeof change === 'number' ? change : Number(change)
    if (isNaN(numChange) || numChange === 0) return <Minus size={14} className="text-neutral-400" />
    if (numChange > 0) return <TrendingUp size={14} className="text-emerald-500" />
    if (numChange < 0) return <TrendingDown size={14} className="text-rose-500" />
    return <Minus size={14} className="text-neutral-400" />
  }

  const getChangeColor = (change?: number) => {
    if (change === undefined || change === null) return 'text-neutral-400'
    const numChange = typeof change === 'number' ? change : Number(change)
    if (isNaN(numChange) || numChange === 0) return 'text-neutral-400'
    if (numChange > 0) return 'text-emerald-500'
    if (numChange < 0) return 'text-rose-500'
    return 'text-neutral-400'
  }

  const priorityIndices = marketIndices.filter(index => prioritySymbols.has(index.symbol))
  const secondaryIndices = marketIndices.filter(index => !prioritySymbols.has(index.symbol))

  // Group secondary indices by region (using regionKey for grouping, will translate when rendering)
  const groupedSecondaryIndices = secondaryIndices.reduce((acc, index) => {
    const regionKey = index.regionKey
    if (!acc[regionKey]) {
      acc[regionKey] = []
    }
    acc[regionKey].push(index)
    return acc
  }, {} as Record<string, MarketIndex[]>)

  const renderIndexRow = (index: MarketIndex) => {
    const data = indices?.[index.symbol]
    const price = data?.current_price ?? data?.price
    const change = data?.percent_change ?? data?.daily_change_pct

    return (
      <WidgetListItem
        key={index.symbol}
        leading={
          <img
            src={getFlagUrl(index.country, 'w40') || ''}
            alt={index.country}
            className="h-3.5 w-5 flex-shrink-0 rounded-sm object-cover"
          />
        }
        title={index.name}
        subtitle={formatPrice(price)}
        trailing={
          <span className="flex items-center gap-1.5">
            {getChangeIcon(change)}
            <span className={`text-sm font-semibold ${getChangeColor(change)}`}>
              {formatChange(change)}
            </span>
          </span>
        }
      />
    )
  }

  return (
    <BaseWidget
      title="dashboard.widgets.marketIndices.name"
      icon={TrendingUp}
      iconColor="text-indigo-600 dark:text-indigo-400"
      iconBgColor="bg-indigo-50 dark:bg-indigo-900/20"
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      onRetry={() => refetch()}
    >
      <div className="space-y-3">
        <div>
          <h4 className="mb-2 px-5 text-xs font-semibold uppercase text-neutral-400 dark:text-neutral-500">
            {t('dashboard.widgets.marketIndices.keyMarkets')}
          </h4>
          <WidgetList variant="compact">
            {priorityIndices.map(renderIndexRow)}
          </WidgetList>
        </div>

        <button
          onClick={() => setShowAllMarkets(prev => !prev)}
          className="flex w-full items-center justify-between px-5 py-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <span>
            {showAllMarkets
              ? t('dashboard.widgets.marketIndices.hideMoreMarkets')
              : t('dashboard.widgets.marketIndices.showMoreMarkets', { count: secondaryIndices.length })}
          </span>
          <ChevronDown size={14} className={`transition-transform ${showAllMarkets ? 'rotate-180' : ''}`} />
        </button>

        {showAllMarkets && Object.entries(groupedSecondaryIndices).map(([regionKey, regionIndices]) => (
          <div key={regionKey}>
            <h4 className="mb-2 px-5 text-xs font-semibold uppercase text-neutral-400 dark:text-neutral-500">
              {t(regionKey)}
            </h4>
            <WidgetList variant="compact">
              {regionIndices.map(renderIndexRow)}
            </WidgetList>
          </div>
        ))}
      </div>
    </BaseWidget>
  )
}
