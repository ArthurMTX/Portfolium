import { TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getTopPerformers } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import { BaseWidgetProps } from '@/features/boards/components/types'
import { useTranslation } from 'react-i18next'
import PerformerListWidget from '@/features/boards/components/widgets/analysis/PerformerListWidget'

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
    <PerformerListWidget
      icon={TrendingUp}
      iconBgClass="bg-emerald-50 dark:bg-emerald-900/20"
      iconClass="text-emerald-600 dark:text-emerald-400"
      title={t('dashboard.widgets.topPerformers.name')}
      emptyText={t('dashboard.widgets.topPerformers.noPerformanceData')}
      performers={displayPerformers}
      portfolioCurrency={portfolioCurrency}
    />
  )
}
