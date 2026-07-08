import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { useTranslation } from 'react-i18next'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { ViewAllButton } from '@/features/boards/components/widgets/base/ViewAllButton'
import { WidgetList } from '@/features/boards/components/widgets/base/WidgetList'
import { WidgetListItem } from '@/features/boards/components/widgets/base/WidgetListItem'
import { BaseWidgetProps } from '@/features/boards/components/types'

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

interface BatchWatchlistItem {
  id: number
  symbol?: string
  name?: string | null
  current_price?: number | null
  daily_change_pct?: number | null
  currency?: string
  asset_type?: string | null
  asset?: {
    symbol?: string
    name?: string | null
    currency?: string
    asset_type?: string | null
  }
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
    refetchIntervalInBackground: false,
    retry: 2,
  })

  // Process batch data to match expected format
  const batchWatchlistData = hasBatchData 
    ? (batchData.watchlist as BatchWatchlistItem[]).slice(0, 5).map(item => ({
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
    <ViewAllButton onClick={handleViewAll} label={t('watchlist.viewAll')} />
  ) : null

  return (
    <BaseWidget
      title="dashboard.widgets.watchlist.name"
      icon={Eye}
      iconColor="text-fuchsia-600 dark:text-fuchsia-400"
      iconBgColor="bg-fuchsia-50 dark:bg-fuchsia-900/20"
      isLoading={loading && !isPreview}
      isEmpty={watchlist.length === 0}
      emptyMessage="dashboard.widgets.watchlist.noWatchlistItems"
      emptyIconSlot={<Eye size={48} className="text-neutral-300 dark:text-neutral-700" />}
      actions={viewAllAction}
      scrollable={false}
    >
      <WidgetList variant="divide">
        {watchlist.map((item) => (
          <WidgetListItem
            key={item.id}
            onClick={() => navigate('/watchlist')}
            leading={
              <AssetLogo
                symbol={item.symbol}
                assetType={item.asset_type || 'STOCK'}
                assetName={item.name}
                alt={item.symbol}
                className="w-8 h-8 object-contain bg-white dark:bg-neutral-900"
              />
            }
            title={item.symbol}
            subtitle={item.name || item.symbol}
            trailing={
              item.current_price !== null ? (
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
              )
            }
          />
        ))}
      </WidgetList>
    </BaseWidget>
  )
}
