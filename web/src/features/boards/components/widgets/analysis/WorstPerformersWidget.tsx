import { TrendingDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getTopPerformers } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useTranslation } from 'react-i18next'
import PerformerListWidget from '@/features/boards/components/widgets/analysis/PerformerListWidget'

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
    <PerformerListWidget
      icon={TrendingDown}
      iconBgClass="bg-rose-50 dark:bg-rose-900/20"
      iconClass="text-rose-600 dark:text-rose-400"
      title={t('dashboard.widgets.worstPerformers.name')}
      emptyText={t('dashboard.widgets.worstPerformers.noPerformanceData')}
      performers={performers}
      portfolioCurrency={portfolioCurrency}
    />
  )
}
