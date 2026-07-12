import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { ArrowUpDown, ChevronUp, ChevronDown, BarChart3, LineChart as LineChartIcon, Table2 } from 'lucide-react'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import api from '@/api'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '@/features/transactions/components/EmptyTransactionsPrompt'
import AssetLogo from '@/shared/components/AssetLogo'
import SharedSortIcon from '@/shared/components/SortIcon'
import { ChartSkeleton, TableSkeleton } from '@/shared/components/StatePrimitives'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageSection,
  PageSectionHeader,
  PageShell,
  PageSummaryPanel,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { useTranslation } from 'react-i18next'
import '@/shared/design/pages/transaction-metrics.css'

type GroupingType = 'monthly' | 'yearly'
type SortKey = 'period' | 'tx_count' | 'buy_sum' | 'buy_count' | 'buy_avg' | 'buy_fees' | 'sell_sum' | 'sell_count' | 'sell_avg' | 'sell_fees' | 'diff'
type SortDir = 'asc' | 'desc'
type TxSortKey = 'date' | 'asset' | 'type' | 'quantity' | 'price' | 'fees' | 'total'

interface Transaction {
  id: number
  asset_id: number
  asset: {
    symbol: string
    name: string | null
    asset_type?: string
  }
  tx_date: string
  type: string
  quantity: number | string
  price: number | string
  fees: number | string
  currency: string
  notes: string | null
}

interface MetricData {
  month?: number
  year: number
  buy_sum_total_price: number
  buy_count: number
  buy_max_total_price: number
  buy_min_total_price: number
  buy_avg_total_price: number
  buy_sum_fees: number
  sell_sum_total_price: number
  sell_count: number
  sell_max_total_price: number
  sell_min_total_price: number
  sell_avg_total_price: number
  sell_sum_fees: number
  diff_buy_sell: number
}

interface MetricsResponse {
  grouping: string
  currency: string
  metrics: MetricData[]
}

export default function TransactionMetrics() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const currentPortfolio = portfolios.find((p) => p.id === activePortfolioId)
  
  const [grouping, setGrouping] = useState<GroupingType>('monthly')
  const [metricsData, setMetricsData] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('period')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [periodTransactions, setPeriodTransactions] = useState<Map<string, Transaction[]>>(new Map())
  const [txSortKeys, setTxSortKeys] = useState<Map<string, TxSortKey>>(new Map())
  const [txSortDirs, setTxSortDirs] = useState<Map<string, SortDir>>(new Map())
  const { t, i18n } = useTranslation()

  // Get the current locale for date formatting
  const currentLocale = i18n.language || 'en-US'

  useEffect(() => {
    // Clear metrics data immediately when portfolio changes
    setMetricsData(null)
    
    const fetchMetrics = async () => {
      if (!activePortfolioId) return
      
      setLoading(true)
      try {
        const data = await api.getTransactionMetrics(activePortfolioId, grouping)
        setMetricsData(data)
      } catch (error) {
        console.error('Failed to fetch transaction metrics:', error)
        setMetricsData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [activePortfolioId, grouping])

  const formatCurrency = (value: number) => {
    const currency = metricsData?.currency || 'USD'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPeriod = useMemo(() => {
    return (metric: MetricData) => {
      if (grouping === 'yearly') {
        return metric.year.toString()
      }
      // Use locale-aware month formatting
      const date = new Date(metric.year, (metric.month || 1) - 1, 1)
      const monthName = date.toLocaleDateString(currentLocale, { month: 'short' })
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
      return `${capitalizedMonth} ${metric.year}`
    }
  }, [grouping, currentLocale])

  const sortedMetrics = useMemo(() => {
    if (!metricsData?.metrics) return []
    
    const sorted = [...metricsData.metrics].sort((a, b) => {
      let compareValue = 0
      
      switch (sortKey) {
        case 'period':
          if (grouping === 'yearly') {
            compareValue = a.year - b.year
          } else {
            compareValue = (a.year * 100 + (a.month || 0)) - (b.year * 100 + (b.month || 0))
          }
          break
        case 'tx_count':
          compareValue = (a.buy_count + a.sell_count) - (b.buy_count + b.sell_count)
          break
        case 'buy_sum':
          compareValue = a.buy_sum_total_price - b.buy_sum_total_price
          break
        case 'buy_count':
          compareValue = a.buy_count - b.buy_count
          break
        case 'buy_avg':
          compareValue = a.buy_avg_total_price - b.buy_avg_total_price
          break
        case 'buy_fees':
          compareValue = a.buy_sum_fees - b.buy_sum_fees
          break
        case 'sell_sum':
          compareValue = a.sell_sum_total_price - b.sell_sum_total_price
          break
        case 'sell_count':
          compareValue = a.sell_count - b.sell_count
          break
        case 'sell_avg':
          compareValue = a.sell_avg_total_price - b.sell_avg_total_price
          break
        case 'sell_fees':
          compareValue = a.sell_sum_fees - b.sell_sum_fees
          break
        case 'diff':
          compareValue = a.diff_buy_sell - b.diff_buy_sell
          break
      }
      
      return sortDir === 'asc' ? compareValue : -compareValue
    })
    
    return sorted
  }, [metricsData, sortKey, sortDir, grouping])

  const chartData = useMemo(() => {
    if (!metricsData?.metrics) return []
    
    // Sort by period for charts (chronological)
    const sorted = [...metricsData.metrics].sort((a, b) => {
      if (grouping === 'yearly') {
        return a.year - b.year
      }
      return (a.year * 100 + (a.month || 0)) - (b.year * 100 + (b.month || 0))
    })
    
    return sorted.map(metric => {
      let period: string
      if (grouping === 'yearly') {
        period = metric.year.toString()
      } else {
        // Use locale-aware month formatting
        const date = new Date(metric.year, (metric.month || 1) - 1, 1)
        const monthName = date.toLocaleDateString(currentLocale, { month: 'short' })
        // Capitalize first letter
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
        period = `${capitalizedMonth} ${metric.year}`
      }
      
      return {
        period,
        buyTotal: metric.buy_sum_total_price,
        sellTotal: metric.sell_sum_total_price,
        netDifference: metric.diff_buy_sell,
        buyCount: metric.buy_count,
        sellCount: metric.sell_count,
      }
    })
  }, [metricsData, grouping, currentLocale])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const toggleRow = async (metric: MetricData) => {
    const periodKey = grouping === 'yearly' 
      ? `${metric.year}` 
      : `${metric.year}-${metric.month}`
    
    const newExpanded = new Set(expandedRows)
    
    if (newExpanded.has(periodKey)) {
      newExpanded.delete(periodKey)
      setExpandedRows(newExpanded)
    } else {
      newExpanded.add(periodKey)
      setExpandedRows(newExpanded)
      
      // Fetch transactions for this period if not already loaded
      if (!periodTransactions.has(periodKey) && activePortfolioId) {
        try {
          // Build date filters based on grouping
          let date_from: string
          let date_to: string
          
          if (grouping === 'yearly') {
            date_from = `${metric.year}-01-01`
            date_to = `${metric.year}-12-31`
          } else {
            const month = (metric.month || 1).toString().padStart(2, '0')
            const lastDay = new Date(metric.year, metric.month || 1, 0).getDate()
            date_from = `${metric.year}-${month}-01`
            date_to = `${metric.year}-${month}-${lastDay}`
          }
          
          const transactions = await api.getTransactions(activePortfolioId, {
            date_from,
            date_to,
          })
          
          // Filter to only BUY and SELL transactions
          const filteredTransactions = transactions.filter(
            (tx: Transaction) => tx.type === 'BUY' || tx.type === 'SELL'
          )
          
          setPeriodTransactions(prev => new Map(prev).set(periodKey, filteredTransactions))
        } catch (error) {
          console.error('Failed to fetch transactions:', error)
        }
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(currentLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getTranslatedType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'BUY': t('transaction.types.buy'),
      'SELL': t('transaction.types.sell'),
      'DIVIDEND': t('transaction.types.dividend'),
      'FEE': t('transaction.types.fee'),
      'SPLIT': t('transaction.types.split'),
      'TRANSFER_IN': t('transaction.types.transferIn'),
      'TRANSFER_OUT': t('transaction.types.transferOut'),
      'CONVERSION_IN': t('transaction.types.conversionIn'),
      'CONVERSION_OUT': t('transaction.types.conversionOut'),
    }
    return typeMap[type.toUpperCase()] || type
  }

  const formatQuantity = (value: number | string | null) => {
    if (value === null || value === undefined) return '-'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    const formatted = numValue.toFixed(8)
    return formatted.replace(/\.?0+$/, '')
  }

  const handleTxSort = (periodKey: string, key: TxSortKey) => {
    const currentSortKey = txSortKeys.get(periodKey) || 'date'
    const currentSortDir = txSortDirs.get(periodKey) || 'desc'
    
    if (currentSortKey === key) {
      setTxSortDirs(prev => new Map(prev).set(periodKey, currentSortDir === 'asc' ? 'desc' : 'asc'))
    } else {
      setTxSortKeys(prev => new Map(prev).set(periodKey, key))
      setTxSortDirs(prev => new Map(prev).set(periodKey, 'asc'))
    }
  }

  const getSortedTransactions = (transactions: Transaction[], periodKey: string) => {
    const sortKey = txSortKeys.get(periodKey) || 'date'
    const sortDir = txSortDirs.get(periodKey) || 'desc'
    
    return [...transactions].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      
      switch (sortKey) {
        case 'date':
          aVal = new Date(a.tx_date).getTime()
          bVal = new Date(b.tx_date).getTime()
          break
        case 'asset':
          aVal = a.asset.symbol.toLowerCase()
          bVal = b.asset.symbol.toLowerCase()
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'quantity':
          aVal = typeof a.quantity === 'string' ? parseFloat(a.quantity) : a.quantity
          bVal = typeof b.quantity === 'string' ? parseFloat(b.quantity) : b.quantity
          break
        case 'price':
          aVal = typeof a.price === 'string' ? parseFloat(a.price) : a.price
          bVal = typeof b.price === 'string' ? parseFloat(b.price) : b.price
          break
        case 'fees':
          aVal = typeof a.fees === 'string' ? parseFloat(a.fees) : a.fees
          bVal = typeof b.fees === 'string' ? parseFloat(b.fees) : b.fees
          break
        case 'total': {
          const aQty = typeof a.quantity === 'string' ? parseFloat(a.quantity) : a.quantity
          const aPrice = typeof a.price === 'string' ? parseFloat(a.price) : a.price
          const aFees = typeof a.fees === 'string' ? parseFloat(a.fees) : a.fees
          aVal = a.type === 'SELL' ? (aQty * aPrice - aFees) : (aQty * aPrice + aFees)
          
          const bQty = typeof b.quantity === 'string' ? parseFloat(b.quantity) : b.quantity
          const bPrice = typeof b.price === 'string' ? parseFloat(b.price) : b.price
          const bFees = typeof b.fees === 'string' ? parseFloat(b.fees) : b.fees
          bVal = b.type === 'SELL' ? (bQty * bPrice - bFees) : (bQty * bPrice + bFees)
          break
        }
        default:
          return 0
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  const TxSortIcon = ({ periodKey, col }: { periodKey: string; col: TxSortKey }) => {
    const currentSortKey = txSortKeys.get(periodKey) || 'date'
    const currentSortDir = txSortDirs.get(periodKey) || 'desc'
    
    if (currentSortKey !== col) return <ArrowUpDown size={12} className="inline ml-1 opacity-40" />
    return currentSortDir === 'asc' ? (
      <ChevronUp size={12} className="inline ml-1 opacity-80" />
    ) : (
      <ChevronDown size={12} className="inline ml-1 opacity-80" />
    )
  }

  // Calculate totals
  const totals = useMemo(() => {
    if (!metricsData?.metrics || metricsData.metrics.length === 0) {
      return {
        totalBuySum: 0,
        totalBuyCount: 0,
        totalSellSum: 0,
        totalSellCount: 0,
        netDifference: 0,
        totalBuyFees: 0,
        totalSellFees: 0,
        totalFees: 0,
        feePercentage: 0,
        buyVsSellRatio: 0,
        avgTransactionsPerPeriod: 0,
        numberOfPeriods: 0,
      }
    }
    
    const calculated = metricsData.metrics.reduce((acc, metric) => ({
      totalBuySum: acc.totalBuySum + metric.buy_sum_total_price,
      totalBuyCount: acc.totalBuyCount + metric.buy_count,
      totalSellSum: acc.totalSellSum + metric.sell_sum_total_price,
      totalSellCount: acc.totalSellCount + metric.sell_count,
      netDifference: acc.netDifference + metric.diff_buy_sell,
      totalBuyFees: acc.totalBuyFees + metric.buy_sum_fees,
      totalSellFees: acc.totalSellFees + metric.sell_sum_fees,
      totalFees: acc.totalFees + metric.buy_sum_fees + metric.sell_sum_fees,
    }), {
      totalBuySum: 0,
      totalBuyCount: 0,
      totalSellSum: 0,
      totalSellCount: 0,
      netDifference: 0,
      totalBuyFees: 0,
      totalSellFees: 0,
      totalFees: 0,
    })

    const totalVolume = calculated.totalBuySum + calculated.totalSellSum
    const feePercentage = totalVolume > 0 ? (calculated.totalFees / totalVolume) * 100 : 0
    const buyVsSellRatio = calculated.totalSellSum > 0 ? calculated.totalBuySum / calculated.totalSellSum : calculated.totalBuySum > 0 ? 999 : 0
    const totalTransactionCount = calculated.totalBuyCount + calculated.totalSellCount
    const numberOfPeriods = metricsData.metrics.length
    const avgTransactionsPerPeriod = numberOfPeriods > 0 ? totalTransactionCount / numberOfPeriods : 0

    return {
      ...calculated,
      feePercentage,
      buyVsSellRatio,
      avgTransactionsPerPeriod,
      numberOfPeriods,
    }
  }, [metricsData])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="transactions" />
  }

  if (metricsData && metricsData.metrics.length === 0) {
    return (
      <EmptyTransactionsPrompt
        pageType="metrics"
        portfolioName={currentPortfolio?.name || 'your portfolio'}
      />
    )
  }

  return (
    <PageShell className="transaction-metrics-page">
      <PageHeader>
        <PageTitleBlock
          kicker={t('transactionMetrics.kicker')}
          title={
            <span className="transaction-metrics-title">
              {t('transactionMetrics.title')}
            </span>
          }
        />
        <PageSummaryPanel
          lead={t('transactionMetrics.netDifferenceLead', { amount: `${totals.netDifference >= 0 ? '+' : ''}${formatCurrency(totals.netDifference)}` })}
          description={t('transactionMetrics.description')}
        />
      </PageHeader>

      <PageMetricStrip className="transaction-metrics-headline-metrics" label={t('transactionMetrics.contextLabel')}>
        <PageMetric
          label={t('transactionMetrics.totalPurchases')}
          value={formatCurrency(totals.totalBuySum)}
          detail={`${totals.totalBuyCount} ${t('transactionMetrics.transactions')}`}
        />
        <PageMetric
          label={t('transactionMetrics.totalSales')}
          value={formatCurrency(totals.totalSellSum)}
          detail={`${totals.totalSellCount} ${t('transactionMetrics.transactions')}`}
        />

        <PageMetric
          label={t('transactionMetrics.netDifference')}
          value={`${totals.netDifference >= 0 ? '+' : ''}${formatCurrency(totals.netDifference)}`}
          detail={t('transactionMetrics.buyMinusSell')}
          tone={totals.netDifference >= 0 ? 'positive' : 'negative'}
        />
        <PageMetric
          label={t('transactionMetrics.totalFees')}
          value={formatCurrency(totals.totalFees)}
          detail={`${t('transaction.types.buy')}: ${formatCurrency(totals.totalBuyFees)} · ${t('transaction.types.sell')}: ${formatCurrency(totals.totalSellFees)}`}
        />
      </PageMetricStrip>

      <section className="transaction-metrics-supporting-metrics" aria-label={t('transactionMetrics.contextLabel')}>
        <div>
          <span>{t('transactionMetrics.avgPurchase')}</span>
          <strong>{formatCurrency(totals.totalBuyCount > 0 ? totals.totalBuySum / totals.totalBuyCount : 0)}</strong>
          <em>{t('transactionMetrics.perTransaction')}</em>
        </div>
        <div>
          <span>{t('transactionMetrics.avgSale')}</span>
          <strong>{formatCurrency(totals.totalSellCount > 0 ? totals.totalSellSum / totals.totalSellCount : 0)}</strong>
          <em>{t('transactionMetrics.perTransaction')}</em>
        </div>
        <div>
          <span>{t('transactionMetrics.feeEfficiency')}</span>
          <strong>{totals.feePercentage.toFixed(2)}%</strong>
          <em>{t('transactionMetrics.ofTotalVolume')}</em>
        </div>
        <div>
          <span>{t('transactionMetrics.buySellRatio')}</span>
          <strong>{totals.totalSellSum === 0 ? t('transactionMetrics.noSales') : totals.buyVsSellRatio.toFixed(2)}</strong>
          <em>
            {totals.totalSellSum === 0
              ? t('transactionMetrics.onlyBuying')
              : totals.buyVsSellRatio > 1
                ? t('transactionMetrics.netAccumulating')
                : t('transactionMetrics.netDistributing')}
          </em>
        </div>
        <div>
          <span>{t('transactionMetrics.avgFrequency')}</span>
          <strong>{totals.avgTransactionsPerPeriod.toFixed(1)}</strong>
          <em>{t('transactionMetrics.transactionsPer', { period: grouping === 'monthly' ? t('transactionMetrics.periods.month') : t('transactionMetrics.periods.year') })}</em>
        </div>
      </section>

      <PageControls
        label={t('transactionMetrics.controlsLabel')}
        start={
          <PageTabs label={t('transactionMetrics.controlsLabel')} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={grouping === 'monthly'}
              className={grouping === 'monthly' ? 'is-active' : undefined}
              onClick={() => setGrouping('monthly')}
            >
              {t('transactionMetrics.viewModes.monthly')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={grouping === 'yearly'}
              className={grouping === 'yearly' ? 'is-active' : undefined}
              onClick={() => setGrouping('yearly')}
            >
              {t('transactionMetrics.viewModes.yearly')}
            </button>
          </PageTabs>
        }
      />

      <PageMainGrid single>
      <PageMainColumn className="transaction-metrics-charts-column">
      <div className="transaction-metrics-charts">
        {/* Buy vs Sell Chart */}
        <PageSection className="transaction-metrics-chart-card">
          <PageSectionHeader
            title={
              <span className="transaction-metrics-section-title">
                <BarChart3 size={20} />
                {t('transactionMetrics.buyVsSellVolume')}
              </span>
            }
          />
          {loading ? (
            <ChartSkeleton label={t('transactionMetrics.loadingMessage')} />
          ) : chartData.length === 0 ? (
            <div className="transaction-metrics-chart-empty">
              {t('transactionMetrics.empty.noTransactionData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
                <XAxis 
                  dataKey="period" 
                  className="text-xs fill-neutral-600 dark:fill-neutral-400"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  className="text-xs fill-neutral-600 dark:fill-neutral-400"
                  label={{ 
                    value: `${t('transactionMetrics.amount')} (${metricsData?.currency || 'USD'})`, 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                  itemStyle={{
                    color: '#f9fafb',
                  }}
                  labelStyle={{
                    color: '#f9fafb',
                    fontWeight: 600,
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Bar dataKey="buyTotal" name={t('transactionMetrics.buyTotal')} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sellTotal" name={t('transactionMetrics.sellTotal')} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PageSection>

        {/* Net Difference Chart */}
        <PageSection className="transaction-metrics-chart-card">
          <PageSectionHeader
            title={
              <span className="transaction-metrics-section-title">
                <LineChartIcon size={20} />
                {t('transactionMetrics.netDifferenceTrend')}
              </span>
            }
          />
          {loading ? (
            <ChartSkeleton label={t('transactionMetrics.loadingMessage')} />
          ) : chartData.length === 0 ? (
            <div className="transaction-metrics-chart-empty">
              {t('transactionMetrics.empty.noTransactionData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
                <XAxis
                  dataKey="period"
                  className="text-xs fill-neutral-600 dark:fill-neutral-400"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  className="text-xs fill-neutral-600 dark:fill-neutral-400"
                  label={{
                    value: `${t('transactionMetrics.amount')} (${metricsData?.currency || 'USD'})`,
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                  itemStyle={{
                    color: '#f9fafb',
                  }}
                  labelStyle={{
                    color: '#f9fafb',
                    fontWeight: 600,
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="netDifference"
                  name={t('transactionMetrics.netDifference')}
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={{ fill: '#ec4899', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </PageSection>
      </div>
      </PageMainColumn>

      <PageSection className="transaction-metrics-table-section">
        <PageSectionHeader
          title={
            <span className="transaction-metrics-section-title">
              <Table2 size={20} />
              {t('transactionMetrics.detailedBreakdown')}
            </span>
          }
        />

        <div className="transaction-metrics-table-scroll transaction-metrics-ledger-scroll">
          {loading ? (
            <TableSkeleton rows={5} columns={8} label={t('transactionMetrics.loadingMessage')} />
          ) : sortedMetrics.length === 0 ? (
            <div className="transaction-metrics-table-empty">
              <p>{t('transactionMetrics.empty.noTransactionData')}</p>
              <p>{t('transactionMetrics.empty.startAddingTransactions')}</p>
            </div>
          ) : (
            <table className="transaction-metrics-ledger">
              <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th onClick={() => handleSort('period')} className="is-left">
                    {t('insights.period')} <SharedSortIcon column="period" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('tx_count')} className="is-center">
                    {t('transactionMetrics.txCount')} <SharedSortIcon column="tx_count" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('buy_sum')} className="is-right has-divider">
                    {t('transactionMetrics.buySum')} <SharedSortIcon column="buy_sum" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('buy_count')} className="is-center">
                    {t('transactionMetrics.buyCount')} <SharedSortIcon column="buy_count" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('buy_avg')} className="is-right">
                    {t('transactionMetrics.buyAvg')} <SharedSortIcon column="buy_avg" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('buy_fees')} className="is-right">
                    {t('transactionMetrics.buyFees')} <SharedSortIcon column="buy_fees" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('sell_sum')} className="is-right has-divider">
                    {t('transactionMetrics.sellSum')} <SharedSortIcon column="sell_sum" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('sell_count')} className="is-center">
                    {t('transactionMetrics.sellCount')} <SharedSortIcon column="sell_count" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('sell_avg')} className="is-right">
                    {t('transactionMetrics.sellAvg')} <SharedSortIcon column="sell_avg" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('sell_fees')} className="is-right">
                    {t('transactionMetrics.sellFees')} <SharedSortIcon column="sell_fees" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th onClick={() => handleSort('diff')} className="is-right has-divider">
                    {t('transactionMetrics.difference')} <SharedSortIcon column="diff" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th className="is-center">
                    {t('transactionMetrics.details')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMetrics.map((metric, idx) => {
                  const periodKey = grouping === 'yearly'
                    ? `${metric.year}`
                    : `${metric.year}-${metric.month}`
                  const isExpanded = expandedRows.has(periodKey)
                  const transactions = periodTransactions.get(periodKey) || []

                  return (
                    <React.Fragment key={idx}>
                      <tr>
                        <td className="is-left is-emphasis">
                          {formatPeriod(metric)}
                        </td>
                        <td className="is-center">
                          {metric.buy_count + metric.sell_count}
                        </td>
                        <td className="is-right is-positive has-divider">
                          {formatCurrency(metric.buy_sum_total_price)}
                        </td>
                        <td className="is-center">
                          {metric.buy_count}
                        </td>
                        <td className="is-right is-muted">
                          {formatCurrency(metric.buy_avg_total_price)}
                        </td>
                        <td className="is-right is-fee">
                          {formatCurrency(metric.buy_sum_fees)}
                        </td>
                        <td className="is-right is-negative has-divider">
                          {formatCurrency(metric.sell_sum_total_price)}
                        </td>
                        <td className="is-center">
                          {metric.sell_count}
                        </td>
                        <td className="is-right is-muted">
                          {formatCurrency(metric.sell_avg_total_price)}
                        </td>
                        <td className="is-right is-fee">
                          {formatCurrency(metric.sell_sum_fees)}
                        </td>
                        <td className={`is-right is-emphasis has-divider ${metric.diff_buy_sell >= 0 ? 'is-positive' : 'is-negative'}`}>
                          {metric.diff_buy_sell >= 0 ? '+' : ''}{formatCurrency(metric.diff_buy_sell)}
                        </td>
                        <td className="is-center">
                          <button
                            type="button"
                            className="transaction-metrics-expand-button"
                            onClick={() => toggleRow(metric)}
                            aria-label={t('transactionMetrics.details')}
                          >
                            {isExpanded ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${idx}-details`} className="transaction-metrics-expanded-row">
                          <td colSpan={12}>
                            <div className="transaction-metrics-expanded">
                              <h4>
                                {t('transactionMetrics.transactionsIn', { period: formatPeriod(metric) })}
                              </h4>
                              {transactions.length === 0 ? (
                                <p className="transaction-metrics-expanded-empty">
                                  {t('transactionMetrics.loadingMessage')}
                                </p>
                              ) : (
                                <div className="transaction-metrics-table-scroll">
                                  <table className="transaction-metrics-tx-table">
                                    <thead>
                                      <tr>
                                        <th
                                          onClick={() => handleTxSort(periodKey, 'date')}
                                          className="is-left"
                                        >
                                          {t('fields.date')} <TxSortIcon periodKey={periodKey} col="date" />
                                        </th>
                                        <th
                                          onClick={() => handleTxSort(periodKey, 'asset')}
                                          className="is-left"
                                        >
                                          {t('fields.asset')} <TxSortIcon periodKey={periodKey} col="asset" />
                                        </th>
                                        <th
                                          onClick={() => handleTxSort(periodKey, 'type')}
                                          className="is-left"
                                        >
                                          {t('fields.type')} <TxSortIcon periodKey={periodKey} col="type" />
                                        </th>
                                        <th
                                          onClick={() => handleTxSort(periodKey, 'quantity')}
                                          className="is-right"
                                        >
                                          {t('fields.quantity')} <TxSortIcon periodKey={periodKey} col="quantity" />
                                        </th>
                                        <th
                                          onClick={() => handleTxSort(periodKey, 'price')}
                                          className="is-right"
                                        >
                                          {t('fields.price')} <TxSortIcon periodKey={periodKey} col="price" />
                                        </th>
                                        <th
                                          onClick={() => handleTxSort(periodKey, 'fees')}
                                          className="is-right"
                                        >
                                          {t('fields.fees')} <TxSortIcon periodKey={periodKey} col="fees" />
                                        </th>
                                        <th
                                          onClick={() => handleTxSort(periodKey, 'total')}
                                          className="is-right"
                                        >
                                          {t('fields.total')} <TxSortIcon periodKey={periodKey} col="total" />
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {getSortedTransactions(transactions, periodKey).map((tx) => {
                                        const quantity = typeof tx.quantity === 'string' ? parseFloat(tx.quantity) : tx.quantity
                                        const price = typeof tx.price === 'string' ? parseFloat(tx.price) : tx.price
                                        const fees = typeof tx.fees === 'string' ? parseFloat(tx.fees) : tx.fees
                                        const total = tx.type === 'SELL' ? (quantity * price - fees) : (quantity * price + fees)

                                        return (
                                          <tr key={tx.id}>
                                            <td className="is-left">
                                              {formatDate(tx.tx_date)}
                                            </td>
                                            <td className="is-left">
                                              <div className="transaction-metrics-tx-asset">
                                                <AssetLogo
                                                  symbol={tx.asset.symbol}
                                                  assetType={tx.asset.asset_type}
                                                  assetName={tx.asset.name}
                                                  alt={`${tx.asset.symbol} logo`}
                                                  className="transaction-metrics-tx-logo"
                                                />
                                                <div>
                                                  <div className="transaction-metrics-tx-symbol">
                                                    {tx.asset.symbol}
                                                  </div>
                                                  {tx.asset.name && (
                                                    <div className="transaction-metrics-tx-name">
                                                      {tx.asset.name}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="is-left">
                                              <span className={`transaction-metrics-tx-type ${tx.type === 'BUY' ? 'is-buy' : 'is-sell'}`}>
                                                {getTranslatedType(tx.type)}
                                              </span>
                                            </td>
                                            <td className="is-right">
                                              {formatQuantity(tx.quantity)}
                                            </td>
                                            <td className="is-right">
                                              {formatCurrency(price)}
                                            </td>
                                            <td className="is-right is-muted">
                                              {formatCurrency(fees)}
                                            </td>
                                            <td className="is-right is-emphasis">
                                              {formatCurrency(total)}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </PageSection>
      </PageMainGrid>
    </PageShell>
  )
}
