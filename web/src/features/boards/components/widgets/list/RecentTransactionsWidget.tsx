import { Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getRecentTransactions } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { format, formatDistanceToNow } from 'date-fns'
import { enUS, fr } from 'date-fns/locale'
import AssetLogo from '@/shared/components/AssetLogo'
import { useWidgetVisibility } from '@/features/boards/context/BoardContext'
import { useTranslation } from 'react-i18next'
import { BaseWidget } from '@/features/boards/components/widgets/base/BaseWidget'
import { WidgetList } from '@/features/boards/components/widgets/base/WidgetList'
import { WidgetListItem } from '@/features/boards/components/widgets/base/WidgetListItem'

interface ApiTransaction {
  id: number
  portfolio_id: number
  asset_id: number
  type: string
  tx_date: string
  quantity: number
  price: number
  fees: number
  notes: string | null
  metadata?: {
    split?: string
    [key: string]: unknown
  } | null
  asset?: {
    symbol: string
    name: string | null
    asset_type?: string | null
  } | null
  created_at: string
}

import { BaseWidgetProps } from '@/features/boards/components/types'

interface RecentTransactionsWidgetProps extends BaseWidgetProps {
  batchData?: { transactions?: unknown }
}

export default function RecentTransactionsWidget({ isPreview = false, batchData }: RecentTransactionsWidgetProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'
  const shouldLoad = useWidgetVisibility('recent-transactions')
  const { t, i18n } = useTranslation()

  // Get the appropriate date-fns locale based on the current language
  const getDateLocale = () => {
    switch (i18n.language) {
      case 'fr':
        return fr
      case 'en':
      default:
        return enUS
    }
  }

  const { data: transactions, isLoading } = useQuery<ApiTransaction[]>({
    queryKey: ['recent-transactions', activePortfolioId],
    queryFn: async () => {
      // Use batch data if available
      if (batchData?.transactions) {
        return batchData.transactions as ApiTransaction[]
      }
      const data = await getRecentTransactions(activePortfolioId!, 5)
      return data as unknown as ApiTransaction[]
    },
    enabled: !isPreview && !!activePortfolioId && shouldLoad,
    // If we have batch data, use it immediately without fetching
    initialData: batchData?.transactions as ApiTransaction[] | undefined,
  })

  // Mock data for preview mode
  const mockTransactions: ApiTransaction[] = [
    {
      id: 1,
      portfolio_id: 1,
      asset_id: 1,
      type: 'BUY',
      tx_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 10,
      price: 175.50,
      fees: 2.50,
      notes: null,
      metadata: null,
      asset: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        asset_type: 'stock',
      },
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      portfolio_id: 1,
      asset_id: 2,
      type: 'DIVIDEND',
      tx_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 1,
      price: 125.00,
      fees: 0,
      notes: 'Quarterly dividend',
      metadata: null,
      asset: {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        asset_type: 'stock',
      },
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      portfolio_id: 1,
      asset_id: 3,
      type: 'SELL',
      tx_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 5,
      price: 220.00,
      fees: 1.50,
      notes: null,
      metadata: null,
      asset: {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        asset_type: 'stock',
      },
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      portfolio_id: 1,
      asset_id: 4,
      type: 'SPLIT',
      tx_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 0,
      price: 0,
      fees: 0,
      notes: '2-for-1 stock split',
      metadata: { split: '2:1' },
      asset: {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        asset_type: 'stock',
      },
      created_at: new Date().toISOString(),
    },
    {
      id: 5,
      portfolio_id: 1,
      asset_id: 5,
      type: 'BUY',
      tx_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 100,
      price: 42.80,
      fees: 5.00,
      notes: null,
      metadata: null,
      asset: {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        asset_type: 'stock',
      },
      created_at: new Date().toISOString(),
    },
  ]

  const displayTransactions = isPreview ? mockTransactions : (transactions || [])

  const getTypeLabel = (type: string | null | undefined) => {
    if (!type) return 'Unknown'
    
    switch (type.toLowerCase()) {
      case 'buy':
        return t('dashboard.widgets.recentTransactions.buy')
      case 'sell':
        return t('dashboard.widgets.recentTransactions.sell')
      case 'dividend':
        return t('dashboard.widgets.recentTransactions.dividend')
      case 'split':
        return t('dashboard.widgets.recentTransactions.split')
      case 'conversion_in':
        return t('dashboard.widgets.recentTransactions.conversionIn')
      case 'conversion_out':
        return t('dashboard.widgets.recentTransactions.conversionOut')
      case 'transfer_in':
        return t('dashboard.widgets.recentTransactions.transferIn')
      case 'transfer_out':
        return t('dashboard.widgets.recentTransactions.transferOut')
      default:
        return type
    }
  }

  const getTypeBgColor = (type: string | null | undefined) => {
    if (!type) return 'bg-neutral-100 dark:bg-neutral-800'
    
    switch (type.toUpperCase()) {
      case 'BUY':
        return 'bg-emerald-50 dark:bg-emerald-900/20'
      case 'SELL':
        return 'bg-rose-50 dark:bg-rose-900/20'
      case 'DIVIDEND':
        return 'bg-sky-50 dark:bg-sky-900/20'
      case 'SPLIT':
        return 'bg-violet-50 dark:bg-violet-900/20'
      case 'FEE':
        return 'bg-orange-50 dark:bg-orange-900/20'
      case 'CONVERSION_IN':
        return 'bg-indigo-50 dark:bg-indigo-900/20'
      case 'CONVERSION_OUT':
        return 'bg-indigo-50 dark:bg-indigo-900/20'
      case 'TRANSFER_IN':
        return 'bg-cyan-50 dark:bg-cyan-900/20'
      case 'TRANSFER_OUT':
        return 'bg-cyan-50 dark:bg-cyan-900/20'
      default:
        return 'bg-neutral-100 dark:bg-neutral-800'
    }
  }

  const getTypeTextColor = (type: string | null | undefined) => {
    if (!type) return 'text-neutral-700 dark:text-neutral-300'
    
    switch (type.toUpperCase()) {
      case 'BUY':
        return 'text-emerald-600 dark:text-emerald-400'
      case 'SELL':
        return 'text-rose-600 dark:text-rose-400'
      case 'DIVIDEND':
        return 'text-sky-600 dark:text-sky-400'
      case 'SPLIT':
        return 'text-violet-600 dark:text-violet-400'
      case 'FEE':
        return 'text-orange-600 dark:text-orange-400'
      case 'CONVERSION_IN':
        return 'text-indigo-600 dark:text-indigo-400'
      case 'CONVERSION_OUT':
        return 'text-indigo-600 dark:text-indigo-400'
      case 'TRANSFER_IN':
        return 'text-cyan-600 dark:text-cyan-400'
      case 'TRANSFER_OUT':
        return 'text-cyan-600 dark:text-cyan-400'
      default:
        return 'text-neutral-600 dark:text-neutral-400'
    }
  }

  return (
    <BaseWidget
      title="dashboard.widgets.recentTransactions.name"
      icon={Clock}
      iconColor="text-sky-600 dark:text-sky-400"
      iconBgColor="bg-sky-50 dark:bg-sky-900/20"
      isLoading={!isPreview && (isLoading || !transactions)}
      isEmpty={displayTransactions.length === 0}
      emptyMessage="dashboard.widgets.recentTransactions.noTransactions"
    >
      <WidgetList variant="cards">
        {displayTransactions.map((transaction) => (
          <WidgetListItem
            key={transaction.id}
            leading={
              <AssetLogo
                symbol={transaction.asset?.symbol || 'UNKNOWN'}
                assetType={transaction.asset?.asset_type || 'STOCK'}
                assetName={transaction.asset?.name}
                alt={transaction.asset?.symbol || 'Unknown'}
                className="w-10 h-10 object-contain flex-shrink-0"
              />
            }
          >
            <div className="flex-1 min-w-0">
              {/* Header: Symbol + Type Badge + Price */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                    {transaction.asset?.symbol || 'Unknown'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeBgColor(transaction.type)} ${getTypeTextColor(transaction.type)} font-medium flex-shrink-0`}>
                    {getTypeLabel(transaction.type)}
                  </span>
                </div>
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex-shrink-0">
                  {transaction.type.toUpperCase() === 'SPLIT'
                    ? (transaction.metadata?.split || '-')
                    : formatCurrency(transaction.quantity * transaction.price, portfolioCurrency)
                  }
                </span>
              </div>

              {/* Asset Name + Date */}
              <div className="flex items-center justify-between gap-2 mb-1">
                {transaction.asset?.name ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {transaction.asset.name}
                  </p>
                ) : (
                  <span></span>
                )}
                <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                  <Clock size={11} />
                  <span>
                    {transaction.tx_date
                      ? format(new Date(transaction.tx_date), 'MMM d')
                      : 'N/A'
                    }
                  </span>
                  <span>
                    -
                  </span>
                  <span>
                    {transaction.tx_date
                      ? formatDistanceToNow(new Date(transaction.tx_date), { addSuffix: true, locale: getDateLocale() })
                      : ''
                    }
                  </span>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {transaction.type.toUpperCase() === 'SPLIT'
                  ? (transaction.metadata?.split || 'Split ratio not available')
                  : `${Number(transaction.quantity).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 8
                    })} @ ${formatCurrency(transaction.price, portfolioCurrency)}`
                }
              </div>
            </div>
          </WidgetListItem>
        ))}
      </WidgetList>
    </BaseWidget>
  )
}
