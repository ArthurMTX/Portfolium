import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../../../../lib/api'
import { getAssetLogoUrl, handleLogoError } from '../../../../lib/logoUtils'
import { formatCurrency } from '../../../../lib/formatUtils'
import { useTranslation } from 'react-i18next'
import { useWidgetVisibility } from '@/contexts/DashboardContext'
import { BaseWidget } from '../base/BaseWidget'
import { BaseWidgetProps } from '../../types'

interface WatchlistItem {
  id: number
  symbol: string
  name: string | null
  current_price: number | null
  daily_change_pct: number | null
  currency: string
  asset_type: string | null
}

interface WatchlistWidgetProps extends BaseWidgetProps {
  batchData?: { watchlist?: unknown }
}

// Mock watchlist for preview mode
const mockWatchlist: WatchlistItem[] = [
  {
    id: 1,
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    current_price: 145.80,
    daily_change_pct: 2.34,
    currency: 'EUR',
    asset_type: 'STOCK',
  },
  {
    id: 2,
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    current_price: 325.60,
    daily_change_pct: -1.22,
    currency: 'EUR',
    asset_type: 'STOCK',
  },
  {
    id: 3,
    symbol: 'NFLX',
    name: 'Netflix Inc.',
    current_price: 465.90,
    daily_change_pct: 3.78,
    currency: 'EUR',
    asset_type: 'STOCK',
  },
]

export default function WatchlistWidget({ isPreview = false, batchData }: WatchlistWidgetProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const shouldLoad = useWidgetVisibility('watchlist')

  // Get data from batch if available
  const hasBatchData = !!batchData?.watchlist

  // React Query with caching and deduplication (only if no batch data)
  const { data: queryData, isLoading: queryLoading } = useQuery({
    queryKey: ['watchlist-widget'],
    queryFn: async () => {
      const data = await api.getWatchlist()
      // Take only first 5 items and ensure asset_type exists
      return data.slice(0, 5).map(item => ({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        current_price: item.current_price,
        daily_change_pct: item.daily_change_pct,
        currency: item.currency,
        asset_type: 'STOCK' as string | null
      })) as WatchlistItem[]
    },
    enabled: !isPreview && shouldLoad && !hasBatchData,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
  })

  // Process batch data to match expected format
  const batchWatchlistData = hasBatchData 
    ? (batchData.watchlist as any[]).slice(0, 5).map(item => ({
        id: item.id,
        symbol: item.asset?.symbol || item.symbol,
        name: item.asset?.name || item.name,
        current_price: item.current_price ?? null,
        daily_change_pct: item.daily_change_pct ?? null,
        currency: item.asset?.currency || item.currency || 'USD',
        asset_type: item.asset?.asset_type || item.asset_type || 'STOCK'
      })) as WatchlistItem[]
    : undefined

  // Use batch data if available, otherwise use query data
  const data = hasBatchData ? batchWatchlistData : queryData
  const isLoading = queryLoading && !isPreview && !hasBatchData

  // Use mock data for preview, real data otherwise
  const watchlist = isPreview ? mockWatchlist : data ?? []
  const loading = isLoading && !isPreview

  const handleViewAll = () => {
    navigate('/watchlist')
  }

  // View all action button
  const viewAllAction = watchlist.length > 0 && !isPreview ? (
    <button
      onClick={handleViewAll}
      className="text-xs text-fuchsia-600 dark:text-fuchsia-400 hover:underline flex items-center gap-1"
    >
      {t('watchlist.viewAll')}
      <ExternalLink size={12} />
    </button>
  ) : null

  return (
    <BaseWidget
      title="dashboard.widgets.watchlist.name"
      icon={Eye}
      iconColor="text-fuchsia-600 dark:text-fuchsia-400"
      iconBgColor="bg-fuchsia-50 dark:bg-fuchsia-900/20"
      isLoading={loading && !isPreview}
      isEmpty={watchlist.length === 0}
      emptyMessage="watchlist.noWatchlistItems"
      emptyIcon={Eye}
      actions={viewAllAction}
      scrollable={false}
    >
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {watchlist.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                onClick={() => navigate('/watchlist')}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getAssetLogoUrl(item.symbol, item.asset_type || 'STOCK')}
                    alt={item.symbol}
                    className="w-8 h-8 rounded object-contain bg-white dark:bg-neutral-900"
                    onError={(e) => handleLogoError(e, item.symbol, item.name, item.asset_type)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                          {item.symbol}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {item.name || item.symbol}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {item.current_price !== null ? (
                          <>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                              {formatCurrency(item.current_price, item.currency)}
                            </p>
                            {item.daily_change_pct !== null && (
                              <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${
                                Number(item.daily_change_pct) >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}>
                                {Number(item.daily_change_pct) >= 0 ? (
                                  <TrendingUp size={12} />
                                ) : (
                                  <TrendingDown size={12} />
                                )}
                                {Number(item.daily_change_pct) >= 0 ? '+' : ''}
                                {Number(item.daily_change_pct).toFixed(2)}%
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-neutral-400">N/A</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </BaseWidget>
  )
}
