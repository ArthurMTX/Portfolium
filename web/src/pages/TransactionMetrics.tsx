import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, DollarSign, ArrowUpDown, ChevronUp, ChevronDown, Receipt, BarChart3, LineChart as LineChartIcon, Table2, Percent, Scale, Activity } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '../components/EmptyTransactionsPrompt'
import { getAssetLogoUrl, handleLogoError } from '../lib/logoUtils'
import SharedSortIcon from '../components/SortIcon'

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
  const navigate = useNavigate()
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

  useEffect(() => {
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
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[(metric.month || 1) - 1]} ${metric.year}`
    }
  }, [grouping])

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
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    return sorted.map(metric => {
      const period = grouping === 'yearly' 
        ? metric.year.toString()
        : `${monthNames[(metric.month || 1) - 1]} ${metric.year}`
      
      return {
        period,
        'Buy Total': metric.buy_sum_total_price,
        'Sell Total': metric.sell_sum_total_price,
        'Net Difference': metric.diff_buy_sell,
        'Buy Count': metric.buy_count,
        'Sell Count': metric.sell_count,
      }
    })
  }, [metricsData, grouping])

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
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
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
          aVal = aQty * aPrice + aFees
          
          const bQty = typeof b.quantity === 'string' ? parseFloat(b.quantity) : b.quantity
          const bPrice = typeof b.price === 'string' ? parseFloat(b.price) : b.price
          const bFees = typeof b.fees === 'string' ? parseFloat(b.fees) : b.fees
          bVal = bQty * bPrice + bFees
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

  return (
    <div className="space-y-6">
      {/* Header - Only show if there are metrics */}
      {metricsData && metricsData.metrics.length > 0 && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate('/transactions')}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title="Back to Transactions"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Calendar className="text-pink-600" size={28} />
              Transaction Metrics
            </h1>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base ml-14">
            Analyze your buying and selling activity over time
          </p>
        </div>
        
        {/* Grouping Toggle */}
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setGrouping('monthly')}
            className={`px-4 py-2 rounded-md transition-all ${
              grouping === 'monthly'
                ? 'bg-white dark:bg-neutral-700 text-pink-600 dark:text-pink-400 shadow-sm font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setGrouping('yearly')}
            className={`px-4 py-2 rounded-md transition-all ${
              grouping === 'yearly'
                ? 'bg-white dark:bg-neutral-700 text-pink-600 dark:text-pink-400 shadow-sm font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>
      )}

      {/* Empty State */}
      {metricsData && metricsData.metrics.length === 0 ? (
        <EmptyTransactionsPrompt 
          pageType="metrics"
          portfolioName={currentPortfolio?.name || 'your portfolio'} 
        />
      ) : (
        <>
      {/* Summary Cards */}
      <div className="space-y-4">
        {/* Primary Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
              <span>Total Purchases</span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(totals.totalBuySum)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {totals.totalBuyCount} transactions
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
              <span>Total Sales</span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(totals.totalSellSum)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {totals.totalSellCount} transactions
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <DollarSign size={16} />
              <span>Net Difference</span>
            </div>
            <div className={`text-2xl font-bold ${
              totals.netDifference >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {totals.netDifference >= 0 ? '+' : ''}{formatCurrency(totals.netDifference)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Buy - Sell
            </div>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
              <span>Avg Purchase</span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(totals.totalBuyCount > 0 ? totals.totalBuySum / totals.totalBuyCount : 0)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Per transaction
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
              <span>Avg Sale</span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(totals.totalSellCount > 0 ? totals.totalSellSum / totals.totalSellCount : 0)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Per transaction
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <Receipt size={16} className="text-orange-600 dark:text-orange-400" />
              <span>Total Fees</span>
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(totals.totalFees)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Buy: {formatCurrency(totals.totalBuyFees)} · Sell: {formatCurrency(totals.totalSellFees)}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <Percent size={16} className="text-red-600 dark:text-red-400" />
              <span>Fee Efficiency</span>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {totals.feePercentage.toFixed(2)}%
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Of total volume
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <Scale size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span>Buy/Sell Ratio</span>
            </div>
            {totals.totalSellSum === 0 ? (
              <div className="flex flex-col justify-center h-[52px]">
                <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  No sales yet
                </div>
                <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                  Only buying activity
                </div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {totals.buyVsSellRatio.toFixed(2)}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {totals.buyVsSellRatio > 1 ? 'Net accumulating' : 'Net distributing'}
                </div>
              </>
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-1">
              <Activity size={16} className="text-cyan-600 dark:text-cyan-400" />
              <span>Avg Frequency</span>
            </div>
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {totals.avgTransactionsPerPeriod.toFixed(1)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Transactions per {grouping === 'monthly' ? 'month' : 'year'}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Buy vs Sell Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <BarChart3 size={20} className="text-pink-600 dark:text-pink-400" />
            Buy vs Sell Volume
          </h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse space-y-4 w-full">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4"></div>
                <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
              No transaction data available
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
                    value: `Amount (${metricsData?.currency || 'USD'})`, 
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
                <Bar dataKey="Buy Total" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sell Total" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Net Difference Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <LineChartIcon size={20} className="text-purple-600 dark:text-purple-400" />
            Net Difference Trend
          </h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse space-y-4 w-full">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4"></div>
                <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded"></div>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
              No transaction data available
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
                    value: `Amount (${metricsData?.currency || 'USD'})`, 
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
                  dataKey="Net Difference" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  dot={{ fill: '#ec4899', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card overflow-hidden">
        <div className="p-6 pb-0">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Table2 size={20} className="text-blue-600 dark:text-blue-400" />
            Detailed Breakdown
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Period</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Tx Count</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase border-l-2 border-neutral-300 dark:border-neutral-600">Buy Sum</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Buy Count</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Buy Avg</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Buy Fees</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase border-l-2 border-neutral-300 dark:border-neutral-600">Sell Sum</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Sell Count</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Sell Avg</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">Sell Fees</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase border-l-2 border-neutral-300 dark:border-neutral-600">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4 w-8 bg-neutral-200 dark:bg-neutral-700 rounded mx-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4 w-8 bg-neutral-200 dark:bg-neutral-700 rounded mx-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : sortedMetrics.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>No transaction data available</p>
              <p className="text-sm mt-2">Start adding transactions to see metrics</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th 
                    onClick={() => handleSort('period')}
                    className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Period <SharedSortIcon column="period" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('tx_count')}
                    className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Tx Count <SharedSortIcon column="tx_count" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('buy_sum')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 border-l-2 border-neutral-300 dark:border-neutral-600"
                  >
                    Buy Sum <SharedSortIcon column="buy_sum" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('buy_count')}
                    className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Buy Count <SharedSortIcon column="buy_count" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('buy_avg')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Buy Avg <SharedSortIcon column="buy_avg" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('buy_fees')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Buy Fees <SharedSortIcon column="buy_fees" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('sell_sum')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 border-l-2 border-neutral-300 dark:border-neutral-600"
                  >
                    Sell Sum <SharedSortIcon column="sell_sum" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('sell_count')}
                    className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Sell Count <SharedSortIcon column="sell_count" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('sell_avg')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Sell Avg <SharedSortIcon column="sell_avg" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('sell_fees')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Sell Fees <SharedSortIcon column="sell_fees" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th 
                    onClick={() => handleSort('diff')}
                    className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 border-l-2 border-neutral-300 dark:border-neutral-600"
                  >
                    Difference <SharedSortIcon column="diff" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sortedMetrics.map((metric, idx) => {
                  const periodKey = grouping === 'yearly' 
                    ? `${metric.year}` 
                    : `${metric.year}-${metric.month}`
                  const isExpanded = expandedRows.has(periodKey)
                  const transactions = periodTransactions.get(periodKey) || []
                  
                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {formatPeriod(metric)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-neutral-900 dark:text-neutral-100">
                          {metric.buy_count + metric.sell_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600 dark:text-green-400 border-l-2 border-neutral-200 dark:border-neutral-700">
                          {formatCurrency(metric.buy_sum_total_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-neutral-900 dark:text-neutral-100">
                          {metric.buy_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-600 dark:text-neutral-400">
                          {formatCurrency(metric.buy_avg_total_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-orange-600 dark:text-orange-400">
                          {formatCurrency(metric.buy_sum_fees)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-red-600 dark:text-red-400 border-l-2 border-neutral-200 dark:border-neutral-700">
                          {formatCurrency(metric.sell_sum_total_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-neutral-900 dark:text-neutral-100">
                          {metric.sell_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-neutral-600 dark:text-neutral-400">
                          {formatCurrency(metric.sell_avg_total_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-orange-600 dark:text-orange-400">
                          {formatCurrency(metric.sell_sum_fees)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold border-l-2 border-neutral-200 dark:border-neutral-700 ${
                          metric.diff_buy_sell >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {metric.diff_buy_sell >= 0 ? '+' : ''}{formatCurrency(metric.diff_buy_sell)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleRow(metric)}
                            className="text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors"
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
                        <tr key={`${idx}-details`}>
                          <td colSpan={12} className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50">
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                                Transactions in {formatPeriod(metric)}
                              </h4>
                              {transactions.length === 0 ? (
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                                  Loading transactions...
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full">
                                    <thead>
                                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                        <th 
                                          onClick={() => handleTxSort(periodKey, 'date')}
                                          className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                          Date <TxSortIcon periodKey={periodKey} col="date" />
                                        </th>
                                        <th 
                                          onClick={() => handleTxSort(periodKey, 'asset')}
                                          className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                          Asset <TxSortIcon periodKey={periodKey} col="asset" />
                                        </th>
                                        <th 
                                          onClick={() => handleTxSort(periodKey, 'type')}
                                          className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                          Type <TxSortIcon periodKey={periodKey} col="type" />
                                        </th>
                                        <th 
                                          onClick={() => handleTxSort(periodKey, 'quantity')}
                                          className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                          Quantity <TxSortIcon periodKey={periodKey} col="quantity" />
                                        </th>
                                        <th 
                                          onClick={() => handleTxSort(periodKey, 'price')}
                                          className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                          Price <TxSortIcon periodKey={periodKey} col="price" />
                                        </th>
                                        <th 
                                          onClick={() => handleTxSort(periodKey, 'fees')}
                                          className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                          Fees <TxSortIcon periodKey={periodKey} col="fees" />
                                        </th>
                                        <th 
                                          onClick={() => handleTxSort(periodKey, 'total')}
                                          className="px-3 py-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                        >
                                          Total <TxSortIcon periodKey={periodKey} col="total" />
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {getSortedTransactions(transactions, periodKey).map((tx) => {
                                        const quantity = typeof tx.quantity === 'string' ? parseFloat(tx.quantity) : tx.quantity
                                        const price = typeof tx.price === 'string' ? parseFloat(tx.price) : tx.price
                                        const fees = typeof tx.fees === 'string' ? parseFloat(tx.fees) : tx.fees
                                        const total = quantity * price + fees
                                        
                                        return (
                                          <tr key={tx.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-900 transition-colors">
                                            <td className="px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100">
                                              {formatDate(tx.tx_date)}
                                            </td>
                                            <td className="px-3 py-2">
                                              <div className="flex items-center gap-2">
                                                <img 
                                                  src={getAssetLogoUrl(tx.asset.symbol, tx.asset.asset_type, tx.asset.name)}
                                                  alt={`${tx.asset.symbol} logo`}
                                                  className="w-5 h-5 object-cover"
                                                  onError={(e) => handleLogoError(e, tx.asset.symbol, tx.asset.name, tx.asset.asset_type)}
                                                />
                                                <div>
                                                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                    {tx.asset.symbol}
                                                  </div>
                                                  {tx.asset.name && (
                                                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
                                                      {tx.asset.name}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className={`text-xs font-medium px-2 py-1 rounded ${
                                                tx.type === 'BUY' 
                                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                              }`}>
                                                {tx.type}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm text-neutral-900 dark:text-neutral-100">
                                              {formatQuantity(tx.quantity)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm text-neutral-900 dark:text-neutral-100">
                                              {formatCurrency(price)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm text-neutral-600 dark:text-neutral-400">
                                              {formatCurrency(fees)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-100">
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
      </div>
      </>
      )}
    </div>
  )
}
