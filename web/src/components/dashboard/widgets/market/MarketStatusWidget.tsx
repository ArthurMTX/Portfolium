import { useQuery } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { getMarketStatus } from '@/lib/api'
import { useWidgetVisibility } from '@/contexts/DashboardContext'
import { BaseWidgetProps } from '../../types'
import { useTranslation } from 'react-i18next'

interface MarketRegion {
  name: string
  key: 'us' | 'europe' | 'asia' | 'oceania'
}

const regions: MarketRegion[] = [
  { name: 'USA', key: 'us' },
  { name: 'Europe', key: 'europe' },
  { name: 'Asia', key: 'asia' },
  { name: 'Oceania', key: 'oceania' },
]

interface MarketStatusWidgetProps extends BaseWidgetProps {}

export default function MarketStatusWidget({ isPreview = false }: MarketStatusWidgetProps) {
  const shouldLoad = useWidgetVisibility('market-status')
  const { t } = useTranslation()

  const { data: health, isLoading } = useQuery({
    queryKey: ['market-status'],
    queryFn: () => getMarketStatus(),
    refetchInterval: isPreview ? false : 60000, // Refetch every minute (disabled in preview)
    enabled: isPreview || shouldLoad, // In preview mode, MockDataProvider intercepts
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500'
      case 'premarket':
      case 'afterhours':
        return 'bg-amber-500'
      case 'closed':
        return 'bg-rose-500'
      default:
        return 'bg-neutral-400'
    }
  }

  const getStatusLabel = (status: string, isUS: boolean = false) => {
    // For US markets, show detailed status
    if (isUS) {
      switch (status) {
        case 'open':
          return t('market.status.open')
        case 'premarket':
          return t('market.status.premarket')
        case 'afterhours':
          return t('market.status.afterhours')
        case 'closed':
          return t('market.status.closed')
        default:
          return t('market.status.unknown')
      }
    }
    
    // For other regions, simple open/closed
    switch (status) {
      case 'open':
        return t('market.status.open')
      case 'closed':
        return t('market.status.closed')
      default:
        return t('market.status.unknown')
    }
  }

  const getRegionStatus = (regionKey: 'us' | 'europe' | 'asia' | 'oceania') => {
    if (regionKey === 'us') {
      return health?.market_status || t('market.status.unknown')
    }
    return health?.market_statuses?.[regionKey] || t('market.status.unknown')
  }

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-sky-50 dark:bg-sky-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Globe className="text-sky-600 dark:text-sky-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('dashboard.marketStatus')}
        </h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto scrollbar-hide">
          {regions.map((region) => {
            const status = getRegionStatus(region.key)
            const isUS = region.key === 'us'
            
            return (
              <div 
                key={region.key}
                className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {t(`market.regions.${region.key}`)}
                  </span>
                </div>
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {getStatusLabel(status, isUS)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
