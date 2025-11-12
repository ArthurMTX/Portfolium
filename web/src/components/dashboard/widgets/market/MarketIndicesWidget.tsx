import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getMarketIndices } from '@/lib/api'
import { getFlagUrl } from '@/lib/countryUtils'
import { useWidgetVisibility } from '@/contexts/DashboardContext'
import { BaseWidgetProps } from '../../types'
import { useTranslation } from 'react-i18next'

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

interface MarketIndicesWidgetProps extends BaseWidgetProps {}

export default function MarketIndicesWidget({ isPreview = false }: MarketIndicesWidgetProps) {
  const shouldLoad = useWidgetVisibility('market-indices')
  const { t } = useTranslation()

  const { data: indices, isLoading, error } = useQuery({
    queryKey: ['market-indices'],
    queryFn: () => getMarketIndices(),
    refetchInterval: isPreview ? false : 60000, // Refetch every minute (disabled in preview)
    retry: 2,
    enabled: isPreview || shouldLoad, // In preview mode, MockDataProvider intercepts
  })

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

  // Group indices by region (using regionKey for grouping, will translate when rendering)
  const groupedIndices = marketIndices.reduce((acc, index) => {
    const regionKey = index.regionKey
    if (!acc[regionKey]) {
      acc[regionKey] = []
    }
    acc[regionKey].push(index)
    return acc
  }, {} as Record<string, MarketIndex[]>)

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('dashboard.widgets.marketIndices.name')}
        </h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8 flex-1">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('dashboard.widgets.marketIndices.failedToLoad')}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      ) : (
        <div className="space-y-4 flex-1 overflow-y-auto scrollbar-hide">
          {Object.entries(groupedIndices).map(([regionKey, regionIndices]) => (
            <div key={regionKey}>
              <h4 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-2 uppercase tracking-wider">
                {t(regionKey)}
              </h4>
              <div className="space-y-2">
                {regionIndices.map((index) => {
                  const data = indices?.[index.symbol]
                  // Use current_price if available, fallback to price
                  const price = data?.current_price ?? data?.price
                  const change = data?.percent_change ?? data?.daily_change_pct
                  
                  return (
                    <div
                      key={index.symbol}
                      className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img 
                          src={getFlagUrl(index.country, 'w40') || ''} 
                          alt={index.country}
                          className="w-5 h-4 object-cover rounded-sm flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">
                            {index.name}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {formatPrice(price)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 ml-2">
                        {getChangeIcon(change)}
                        <span className={`text-sm font-semibold ${getChangeColor(change)}`}>
                          {formatChange(change)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
