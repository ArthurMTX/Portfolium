import { TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getTopPerformers } from '../../../../lib/api'
import usePortfolioStore from '../../../../store/usePortfolioStore'
import { formatCurrency } from '../../../../lib/formatUtils'
import { getAssetLogoUrl, handleLogoError } from '@/lib/logoUtils'
import { useWidgetVisibility } from '@/contexts/DashboardContext'
import { BaseWidgetProps } from '../../types'
import { useTranslation } from 'react-i18next'

interface TopPerformersWidgetProps extends BaseWidgetProps {}

export default function TopPerformersWidget({ isPreview = false }: TopPerformersWidgetProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'
  const shouldLoad = useWidgetVisibility('top-performers')
  const { t } = useTranslation()

  const { data: performers, isLoading } = useQuery({
    queryKey: ['top-performers', activePortfolioId],
    queryFn: () => getTopPerformers(activePortfolioId!, '1y', 5),
    enabled: !isPreview && !!activePortfolioId && shouldLoad,
  })

  // Mock data for preview mode
  const mockPerformers = [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', asset_type: 'stock', return_pct: 85.5, value: 15420.30 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', asset_type: 'stock', return_pct: 42.8, value: 9622.50 },
    { symbol: 'AAPL', name: 'Apple Inc.', asset_type: 'stock', return_pct: 25.3, value: 8775.00 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', asset_type: 'stock', return_pct: 18.7, value: 6543.21 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', asset_type: 'stock', return_pct: 15.2, value: 5234.10 },
  ]

  const displayPerformers = isPreview ? mockPerformers : (performers || [])

  if (!isPreview && (isLoading || !performers)) {
    return (
      <div className="card h-full flex items-center justify-center p-5">
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col p-5 overflow-y-auto scrollbar-hide">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingUp className="text-emerald-600 dark:text-emerald-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('dashboard.widgets.topPerformers.name')}
        </h3>
      </div>

      {displayPerformers.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400 text-sm text-center py-8">
          {t('dashboard.widgets.topPerformers.noPerformanceData')}
        </p>
      ) : (
        <div className="space-y-3">
          {displayPerformers.map((performer, idx) => (
            <div
              key={performer.symbol}
              className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs font-semibold text-neutral-400 w-4">
                  #{idx + 1}
                </span>

                {/* Asset Logo */}
                <img
                  src={getAssetLogoUrl(
                    performer.symbol || 'UNKNOWN',
                    performer.asset_type || 'STOCK',
                    performer.name
                  )}
                  alt={performer.symbol || 'Unknown'}
                  className="w-10 h-10 object-contain bg-white dark:bg-neutral-900 flex-shrink-0"
                  onError={(e) => handleLogoError(
                    e,
                    performer.symbol || 'UNKNOWN',
                    performer.name,
                    performer.asset_type
                  )}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {performer.symbol}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {performer.name}
                  </p>
                </div>
              </div>
              <div className="text-right ml-3">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{Number(performer.return_pct).toFixed(2)}%
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatCurrency(performer.value, portfolioCurrency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
