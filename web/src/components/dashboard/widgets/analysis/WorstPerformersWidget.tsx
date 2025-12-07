import { TrendingDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getTopPerformers } from '../../../../lib/api'
import usePortfolioStore from '../../../../store/usePortfolioStore'
import { formatCurrency } from '../../../../lib/formatUtils'
import { getAssetLogoUrl, handleLogoError } from '@/lib/logoUtils'
import { useWidgetVisibility } from '@/contexts/DashboardContext'
import { BaseWidgetProps } from '../../types'
import { useTranslation } from 'react-i18next'

interface WorstPerformersWidgetProps extends BaseWidgetProps {}

export default function WorstPerformersWidget({ isPreview = false }: WorstPerformersWidgetProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'
  const shouldLoad = useWidgetVisibility('worst-performers')
  const { t } = useTranslation()

  const { data: allPerformers, isLoading } = useQuery({
    queryKey: ['worst-performers', activePortfolioId],
    queryFn: () => getTopPerformers(activePortfolioId!, '1y', 100), // Get all, we'll sort
    enabled: !isPreview && !!activePortfolioId && shouldLoad,
  })

  // Mock data for preview mode
  const mockPerformers = [
    { symbol: 'TSLA', name: 'Tesla Inc.', asset_type: 'stock', return_pct: -12.5, value: 4400.00 },
    { symbol: 'NFLX', name: 'Netflix Inc.', asset_type: 'stock', return_pct: -8.3, value: 3210.50 },
    { symbol: 'ARKK', name: 'ARK Innovation ETF', asset_type: 'etf', return_pct: -5.7, value: 2890.75 },
    { symbol: 'COIN', name: 'Coinbase Global Inc.', asset_type: 'stock', return_pct: -4.2, value: 1543.20 },
    { symbol: 'SQ', name: 'Block Inc.', asset_type: 'stock', return_pct: -2.8, value: 987.40 },
  ]

  // Get bottom 5 performers
  const performers = isPreview 
    ? mockPerformers
    : (allPerformers
      ? [...allPerformers].sort((a, b) => a.return_pct - b.return_pct).slice(0, 5)
      : [])

  if (!isPreview && isLoading) {
    return (
      <div className="card h-full flex items-center justify-center p-5">
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col p-5 overflow-y-auto scrollbar-hide">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-rose-50 dark:bg-rose-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingDown className="text-rose-600 dark:text-rose-400" size={18} />
        </div>
        <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('dashboard.widgets.worstPerformers.name')}
        </h3>
      </div>

      {performers.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400 text-sm text-center py-8">
          {t('dashboard.widgets.worstPerformers.noPerformanceData')}
        </p>
      ) : (
        <div className="space-y-3">
          {performers.map((performer, idx) => (
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
                <p className={`font-semibold ${Number(performer.return_pct) > 0 ? 'text-emerald-600 dark:text-emerald-400' : Number(performer.return_pct) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {Number(performer.return_pct) > 0 ? '+' : Number(performer.return_pct) < 0 ? '-' : ''}{Math.abs(Number(performer.return_pct)).toFixed(2)}%
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
