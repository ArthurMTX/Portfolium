import { TrendingUp, TrendingDown } from 'lucide-react'
import MetricWidget from './MetricWidget'
import { formatCurrency } from '../../../../lib/formatUtils'
import { BaseWidgetProps } from '../../types'
import { useTranslation } from 'react-i18next'
import usePortfolioStore from '../../../../store/usePortfolioStore'

interface TotalReturnWidgetProps extends BaseWidgetProps {
  metrics: {
    total_unrealized_pnl: number | string
    total_realized_pnl: number | string
    total_dividends: number | string
    total_fees: number | string
  } | null
}

export default function TotalReturnWidget({ metrics, isPreview = false }: TotalReturnWidgetProps) {
  const { t } = useTranslation()
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'
  
  if (!metrics) {
    return (
      <MetricWidget
        title={t('dashboard.widgets.totalReturn.title')}
        value="N/A"
        icon={TrendingUp}
        iconBgColor="bg-indigo-100 dark:bg-indigo-900/30"
        iconColor="text-indigo-600 dark:text-indigo-400"
        isPreview={isPreview}
      />
    )
  }

  // Total Return = Unrealized + Realized + Dividends - Fees
  // Convert strings to numbers (API returns high-precision decimals as strings)
  const totalReturn =
    parseFloat(String(metrics.total_unrealized_pnl || 0)) +
    parseFloat(String(metrics.total_realized_pnl || 0)) +
    parseFloat(String(metrics.total_dividends || 0)) -
    parseFloat(String(metrics.total_fees || 0))

  const isPositive = totalReturn >= 0
  const icon = isPositive ? TrendingUp : TrendingDown
  const iconBgColor = isPositive
    ? 'bg-emerald-50 dark:bg-emerald-900/20'
    : 'bg-rose-50 dark:bg-rose-900/20'
  const iconColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400'
  const valueColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400'

  return (
    <MetricWidget
      title={t('dashboard.widgets.totalReturn.name')}
      value={formatCurrency(totalReturn, portfolioCurrency)}
      subtitle={t('dashboard.widgets.totalReturn.subtitle')}
      icon={icon}
      iconBgColor={iconBgColor}
      iconColor={iconColor}
      valueColor={valueColor}
      isPreview={isPreview}
    />
  )
}
