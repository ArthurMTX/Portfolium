import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, PieChart, BarChart3, Activity, Shield, Award, Target, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api'
import { getSectorIcon, getSectorColor } from '../lib/sectorIndustryUtils'
import { getTranslatedSector } from '../lib/translationUtils'
import { getCountryCode } from '../lib/countryUtils'
import usePortfolioStore from '../store/usePortfolioStore'
import { Line } from 'react-chartjs-2'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '../components/EmptyTransactionsPrompt'
import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  BarElement
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  BarElement
)

interface PortfolioInsights {
  portfolio_id: number
  portfolio_name: string
  as_of_date: string
  period: string
  asset_allocation: AssetAllocation[]
  sector_allocation: SectorAllocation[]
  geographic_allocation: GeographicAllocation[]
  performance: PerformanceMetrics
  risk: RiskMetrics
  benchmark_comparison: BenchmarkComparison
  top_performers: TopPerformer[]
  worst_performers: TopPerformer[]
  total_value: number
  total_cost: number
  total_return: number
  total_return_pct: number
  diversification_score: number
}

interface AssetAllocation {
  symbol: string
  name: string
  percentage: number
  value: number
  quantity: number
  asset_type: string
}

interface SectorAllocation {
  sector: string
  percentage: number
  value: number
  count: number
}

interface GeographicAllocation {
  country: string
  percentage: number
  value: number
  count: number
}

interface PerformanceMetrics {
  period: string
  total_return: number
  total_return_pct: number
  annualized_return: number
  start_value: number
  end_value: number
  total_invested: number
  total_withdrawn: number
  best_day: number | null
  best_day_date: string | null
  worst_day: number | null
  worst_day_date: string | null
  positive_days: number
  negative_days: number
  win_rate: number
}

interface RiskMetrics {
  period: string
  volatility: number
  sharpe_ratio: number | null
  max_drawdown: number
  max_drawdown_date: string | null
  beta: number | null
  var_95: number | null
  downside_deviation: number
}

interface BenchmarkComparison {
  benchmark_symbol: string
  benchmark_name: string
  period: string
  portfolio_return: number
  benchmark_return: number
  alpha: number
  portfolio_series: TimeSeriesPoint[]
  benchmark_series: TimeSeriesPoint[]
  correlation: number | null
}

interface TimeSeriesPoint {
  date: string
  value: number
}

interface TopPerformer {
  symbol: string
  name: string | null
  return_pct: number
  value: number
  unrealized_pnl: number
  period: string
  asset_type?: string | null
}


export default function Insights() {
  const { activePortfolioId, portfolios } = usePortfolioStore()
  const [insights, setInsights] = useState<PortfolioInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('1y')
  const [benchmark, setBenchmark] = useState('SPY')
  const [performersSortBy, setPerformersSortBy] = useState<'percentage' | 'currency'>('percentage')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { t, i18n } = useTranslation()

  // Get the current locale for date formatting
  const currentLocale = i18n.language || 'en-US'

  // Get portfolio currency
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const currency = activePortfolio?.base_currency || 'EUR'
  
  // Get currency symbol
  const getCurrencySymbol = (currencyCode: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'CHF': 'CHF',
      'CAD': 'C$',
      'AUD': 'A$',
      'NZD': 'NZ$',
      'INR': '₹',
      'BRL': 'R$',
      'ZAR': 'R',
      'RUB': '₽',
      'KRW': '₩',
      'SGD': 'S$',
      'HKD': 'HK$',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PLN': 'zł',
      'MXN': 'MX$',
      'TRY': '₺',
    }
    return symbols[currencyCode] || currencyCode
  }
  const currencySymbol = getCurrencySymbol(currency)

  const loadInsights = useCallback(async (signal?: AbortSignal) => {
    if (!activePortfolioId) return

    setLoading(true)
    setError('')
    try {
      const data = await api.getPortfolioInsights(activePortfolioId, period, benchmark, signal)
      
      // Convert string decimals to numbers (Python Decimal serializes as strings)
      const normalizedData: PortfolioInsights = {
        ...data,
        total_value: Number(data.total_value),
        total_cost: Number(data.total_cost),
        total_return: Number(data.total_return),
        total_return_pct: Number(data.total_return_pct),
        diversification_score: data.diversification_score ? Number(data.diversification_score) : 0,
        asset_allocation: data.asset_allocation.map((a: AssetAllocation) => ({
          ...a,
          percentage: Number(a.percentage),
          value: Number(a.value),
          quantity: Number(a.quantity)
        })),
        sector_allocation: data.sector_allocation.map((s: SectorAllocation) => ({
          ...s,
          percentage: Number(s.percentage),
          value: Number(s.value)
        })),
        geographic_allocation: data.geographic_allocation.map((g: GeographicAllocation) => ({
          ...g,
          percentage: Number(g.percentage),
          value: Number(g.value)
        })),
        performance: {
          ...data.performance,
          total_return: Number(data.performance.total_return),
          total_return_pct: Number(data.performance.total_return_pct),
          annualized_return: Number(data.performance.annualized_return),
          start_value: Number(data.performance.start_value),
          end_value: Number(data.performance.end_value),
          total_invested: Number(data.performance.total_invested),
          total_withdrawn: Number(data.performance.total_withdrawn),
          best_day: data.performance.best_day ? Number(data.performance.best_day) : null,
          worst_day: data.performance.worst_day ? Number(data.performance.worst_day) : null,
          win_rate: Number(data.performance.win_rate)
        },
        risk: {
          ...data.risk,
          volatility: Number(data.risk.volatility),
          sharpe_ratio: data.risk.sharpe_ratio ? Number(data.risk.sharpe_ratio) : null,
          max_drawdown: Number(data.risk.max_drawdown),
          beta: data.risk.beta ? Number(data.risk.beta) : null,
          var_95: data.risk.var_95 ? Number(data.risk.var_95) : null,
          downside_deviation: Number(data.risk.downside_deviation)
        },
        benchmark_comparison: {
          ...data.benchmark_comparison,
          portfolio_return: Number(data.benchmark_comparison.portfolio_return),
          benchmark_return: Number(data.benchmark_comparison.benchmark_return),
          alpha: Number(data.benchmark_comparison.alpha),
          correlation: data.benchmark_comparison.correlation ? Number(data.benchmark_comparison.correlation) : null,
          portfolio_series: data.benchmark_comparison.portfolio_series.map((p: TimeSeriesPoint) => ({
            date: p.date,
            value: Number(p.value)
          })),
          benchmark_series: data.benchmark_comparison.benchmark_series.map((b: TimeSeriesPoint) => ({
            date: b.date,
            value: Number(b.value)
          }))
        },
        top_performers: data.top_performers.map((p: TopPerformer) => ({
          ...p,
          return_pct: Number(p.return_pct),
          value: Number(p.value),
          unrealized_pnl: Number(p.unrealized_pnl)
        })),
        worst_performers: data.worst_performers.map((p: TopPerformer) => ({
          ...p,
          return_pct: Number(p.return_pct),
          value: Number(p.value),
          unrealized_pnl: Number(p.unrealized_pnl)
        }))
      }
      
      setInsights(normalizedData)
    } catch (err) {
      // Ignore abort errors (user navigated away)
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      
      console.error('Failed to load insights:', err)
      const error = err as Error
      setError(error.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [activePortfolioId, period, benchmark])

  useEffect(() => {
    const abortController = new AbortController()
    
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Debounce the load to prevent rapid-fire requests when changing filters
    debounceTimerRef.current = setTimeout(() => {
      loadInsights(abortController.signal)
    }, 300)
    
    return () => {
      abortController.abort()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [loadInsights])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="insights" />
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="text-pink-600" size={28} />
              {t('insights.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
              {t('insights.loadingMessage')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="h-10 w-28 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
            <div className="h-10 w-32 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-3 flex-1">
                  <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                  <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                  <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                </div>
                <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Benchmark Chart Skeleton */}
        <div className="card p-6">
          <div className="h-6 w-64 bg-neutral-200 dark:bg-neutral-700 rounded mb-4 animate-pulse"></div>
          <div className="h-80 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"></div>
        </div>

        {/* Risk Metrics Skeleton */}
        <div className="card p-6">
          <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-700 rounded mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                <div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Performers Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="card p-6">
              <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-700 rounded mb-4 animate-pulse"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                      <div className="space-y-2">
                        <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                        <div className="h-3 w-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div>
                      <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700 rounded ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    // Check if error is about no transactions/data
    if (error.includes('No portfolio data available') || error.includes('No transactions') || error.includes('No positions found')) {
      return <EmptyTransactionsPrompt pageType="insights" portfolioName={insights?.portfolio_name} />
    }
    
    return (
      <div className="space-y-4">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">{t('common.error')}</h3>
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
        
        <button
          onClick={() => loadInsights()}
          className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (!insights) {
    return null
  }

  // Prepare benchmark comparison chart data
  // Backend now returns performance percentages directly, no need to normalize
  const portfolioSeries = insights.benchmark_comparison.portfolio_series
  const benchmarkSeries = insights.benchmark_comparison.benchmark_series
  
  const benchmarkChartData = {
    labels: portfolioSeries.map(p => 
      new Date(p.date).toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: insights.portfolio_name,
        data: portfolioSeries.map(p => p.value),
        borderColor: 'rgb(236, 72, 153)',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        fill: true,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2
      },
      {
        label: insights.benchmark_comparison.benchmark_name,
        data: benchmarkSeries.map(b => b.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: document.documentElement.classList.contains('dark') ? '#e5e5e5' : '#171717'
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: { dataset: { label?: string }, parsed: { y: number | null } }) {
            let label = context.dataset.label || ''
            if (label) {
              label += ': '
            }
            if (context.parsed.y !== null) {
              label += `${context.parsed.y >= 0 ? '+' : ''}${context.parsed.y.toFixed(2)}%`
            }
            return label
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#a3a3a3' : '#525252'
        },
        grid: {
          color: document.documentElement.classList.contains('dark') ? '#262626' : '#f5f5f5'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Performance (%)',
          color: document.documentElement.classList.contains('dark') ? '#a3a3a3' : '#525252',
          font: { size: 12 }
        },
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#a3a3a3' : '#525252',
          callback: function(value: string | number) {
            return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(0)}%`
          }
        },
        grid: {
          color: (context: { tick: { value: number } }) => {
            // Highlight the zero line
            return context.tick.value === 0 
              ? document.documentElement.classList.contains('dark') ? 'rgba(163,163,163,0.3)' : 'rgba(82,82,82,0.3)'
              : document.documentElement.classList.contains('dark') ? '#262626' : '#f5f5f5'
          },
          lineWidth: (context: { tick: { value: number } }) => {
            return context.tick.value === 0 ? 2 : 1
          }
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="text-pink-600" size={28} />
            {t('insights.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            {t('insights.description')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/* Period selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          >
            <option value="1m">{t('insights.periods.1M')}</option>
            <option value="3m">{t('insights.periods.3M')}</option>
            <option value="6m">{t('insights.periods.6M')}</option>
            <option value="ytd">{t('insights.periods.YTD')}</option>
            <option value="1y">{t('insights.periods.1Y')}</option>
            <option value="all">{t('insights.periods.ALL')}</option>
          </select>

          {/* Benchmark selector */}
          <select
            value={benchmark}
            onChange={(e) => setBenchmark(e.target.value)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          >
            <option value="SPY">S&P 500</option>
            <option value="QQQ">Nasdaq 100</option>
            <option value="IWM">Russell 2000</option>
            <option value="DIA">Dow Jones</option>
            <option value="VTI">{t('insights.totalMarket')}</option>
          </select>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('insights.totalReturn')}
              </p>
              <p className={`mt-2 text-2xl font-bold ${
                insights.total_return >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {insights.total_return >= 0 ? '+' : ''}
                {insights.total_return_pct.toFixed(2)}%
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {currencySymbol}{insights.total_return.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
              <Activity className="text-pink-600 dark:text-pink-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('insights.annualizedReturn')}
              </p>
              <p className={`mt-2 text-2xl font-bold ${
                insights.performance.annualized_return >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {insights.performance.annualized_return >= 0 ? '+' : ''}
                {insights.performance.annualized_return.toFixed(2)}%
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {t('insights.period')}: {period.toUpperCase()}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <TrendingUp className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('insights.sharpeRatio')}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {insights.risk.sharpe_ratio ? insights.risk.sharpe_ratio.toFixed(2) : 'N/A'}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {t('insights.riskAdjustedReturn')}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <Shield className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                vs {insights.benchmark_comparison.benchmark_name}
              </p>
              <p className={`mt-2 text-2xl font-bold ${
                insights.benchmark_comparison.alpha >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {insights.benchmark_comparison.alpha >= 0 ? '+' : ''}
                {insights.benchmark_comparison.alpha.toFixed(2)}%
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {t('insights.alpha')} ({t('insights.outperformance')})
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Target className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark Comparison Chart */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-pink-600" />
          {t('insights.performanceVsBenchmark')}
        </h2>
        <div className="h-80">
          <Line key={`${period}-${benchmark}`} data={benchmarkChartData} options={chartOptions} />
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-neutral-600 dark:text-neutral-400">{t('insights.portfolioReturn')}</p>
            <p className={`font-semibold ${
              insights.benchmark_comparison.portfolio_return >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {insights.benchmark_comparison.portfolio_return >= 0 ? '+' : ''}
              {insights.benchmark_comparison.portfolio_return.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-neutral-600 dark:text-neutral-400">{t('insights.benchmarkReturn')}</p>
            <p className={`font-semibold ${
              insights.benchmark_comparison.benchmark_return >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {insights.benchmark_comparison.benchmark_return >= 0 ? '+' : ''}
              {insights.benchmark_comparison.benchmark_return.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-neutral-600 dark:text-neutral-400">{t('insights.correlation')}</p>
            <p className="font-semibold">
              {insights.benchmark_comparison.correlation 
                ? insights.benchmark_comparison.correlation.toFixed(2) 
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-neutral-600 dark:text-neutral-400">{t('insights.winRate')}</p>
            <p className="font-semibold">{insights.performance.win_rate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-pink-600" />
          {t('insights.riskAnalysis')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.volatility')} ({t('insights.annual')})</p>
            <p className="text-xl font-bold text-orange-600">
              {insights.risk.volatility.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.maxDrawdown')}</p>
            <p className="text-xl font-bold text-red-600">
              -{insights.risk.max_drawdown.toFixed(2)}%
            </p>
            {insights.risk.max_drawdown_date && (
              <p className="text-xs text-neutral-500">
                {new Date(insights.risk.max_drawdown_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.downsideDeviation')}</p>
            <p className="text-xl font-bold text-amber-600">
              {insights.risk.downside_deviation.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.valueAtRisk')} (95%)</p>
            <p className="text-xl font-bold text-purple-600">
              {insights.risk.var_95 ? `${insights.risk.var_95.toFixed(2)}%` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-pink-600" />
          {t('insights.performanceStatistics')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.bestDay')}</p>
            <p className="text-xl font-bold text-green-600">
              {insights.performance.best_day ? `+${insights.performance.best_day.toFixed(2)}%` : 'N/A'}
            </p>
            {insights.performance.best_day_date && (
              <p className="text-xs text-neutral-500">
                {new Date(insights.performance.best_day_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.worstDay')}</p>
            <p className="text-xl font-bold text-red-600">
              {insights.performance.worst_day ? `${insights.performance.worst_day.toFixed(2)}%` : 'N/A'}
            </p>
            {insights.performance.worst_day_date && (
              <p className="text-xs text-neutral-500">
                {new Date(insights.performance.worst_day_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.positiveDays')}</p>
            <p className="text-xl font-bold text-green-600">
              {insights.performance.positive_days}
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.negativeDays')}</p>
            <p className="text-xl font-bold text-red-600">
              {insights.performance.negative_days}
            </p>
          </div>
        </div>
      </div>

      {/* Top & Worst Performers */}
      <div className="space-y-4">
        {/* Toggle for sorting method */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('insights.topAndWorstPerformers')}</h2>
          <div className="flex gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setPerformersSortBy('percentage')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                performersSortBy === 'percentage'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-medium shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {t('common.by').charAt(0).toUpperCase() + t('common.by').slice(1)} %
            </button>
            <button
              onClick={() => setPerformersSortBy('currency')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                performersSortBy === 'currency'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-medium shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {t('common.by').charAt(0).toUpperCase() + t('common.by').slice(1)} {currencySymbol}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              {t('insights.topPerformers')}
            </h2>
            <div className="space-y-3">
              {[...insights.top_performers]
                .sort((a, b) => 
                  performersSortBy === 'percentage' 
                    ? b.return_pct - a.return_pct 
                    : b.unrealized_pnl - a.unrealized_pnl
                )
                .map((performer) => (
                <div key={`top-${performer.symbol}-${performersSortBy}`} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img
                      src="/placeholder-logo.png"
                      alt={`${performer.symbol} logo`}
                      className="w-10 h-10 rounded object-contain"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement
                        if (!img.dataset.resolverTried) {
                          img.dataset.resolverTried = 'true'
                          const params = new URLSearchParams()
                          if (performer.name) params.set('name', performer.name)
                          if (performer.asset_type) params.set('asset_type', performer.asset_type)
                          fetch(`/api/assets/logo/${performer.symbol}?${params.toString()}`, { redirect: 'follow' })
                            .then((res) => {
                              if (res.redirected) {
                                img.src = res.url
                              } else if (res.ok) {
                                return res.blob().then((blob) => {
                                  img.src = URL.createObjectURL(blob)
                                })
                              } else {
                                img.style.display = 'none'
                              }
                            })
                            .catch(() => {
                              img.style.display = 'none'
                            })
                        } else {
                          img.style.display = 'none'
                        }
                      }}
                    />
                    <div>
                      <p className="font-semibold">{performer.symbol}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {performer.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {performersSortBy === 'percentage' ? (
                        <>+{performer.return_pct.toFixed(2)}%</>
                      ) : (
                        <>{currencySymbol}{performer.unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                      )}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {performersSortBy === 'percentage' ? (
                        <>{currencySymbol}{performer.unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                      ) : (
                        <>+{performer.return_pct.toFixed(2)}%</>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Worst Performers */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {t('insights.worstPerformers')}
            </h2>
            <div className="space-y-3">
              {[...insights.worst_performers]
                .sort((a, b) => 
                  performersSortBy === 'percentage' 
                    ? a.return_pct - b.return_pct 
                    : a.unrealized_pnl - b.unrealized_pnl
                )
                .map((performer) => (
                <div key={`worst-${performer.symbol}-${performersSortBy}`} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img
                      src="/placeholder-logo.png"
                      alt={`${performer.symbol} logo`}
                      className="w-10 h-10 rounded object-contain"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement
                        if (!img.dataset.resolverTried) {
                          img.dataset.resolverTried = 'true'
                          const params = new URLSearchParams()
                          if (performer.name) params.set('name', performer.name)
                          if (performer.asset_type) params.set('asset_type', performer.asset_type)
                          fetch(`/api/assets/logo/${performer.symbol}?${params.toString()}`, { redirect: 'follow' })
                            .then((res) => {
                              if (res.redirected) {
                                img.src = res.url
                              } else if (res.ok) {
                                return res.blob().then((blob) => {
                                  img.src = URL.createObjectURL(blob)
                                })
                              } else {
                                img.style.display = 'none'
                              }
                            })
                            .catch(() => {
                              img.style.display = 'none'
                            })
                        } else {
                          img.style.display = 'none'
                        }
                      }}
                    />
                    <div>
                      <p className="font-semibold">{performer.symbol}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {performer.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">
                      {performersSortBy === 'percentage' ? (
                        <>{performer.return_pct.toFixed(2)}%</>
                      ) : (
                        <>{currencySymbol}{performer.unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                      )}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {performersSortBy === 'percentage' ? (
                        <>{currencySymbol}{performer.unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</>
                      ) : (
                        <>{performer.return_pct.toFixed(2)}%</>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Allocation */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-pink-600" />
            {t('insights.sectorAllocation')}
          </h2>
          <div className="space-y-3">
            {insights.sector_allocation.map((sector, idx) => (
              <div key={idx}>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const SectorIcon = getSectorIcon(sector.sector);
                      return <SectorIcon size={16} className={getSectorColor(sector.sector)} />;
                    })()}
                    <span className="text-sm font-medium">{getTranslatedSector(sector.sector, t)}</span>
                  </div>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {sector.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className="bg-pink-600 h-2 rounded-full transition-all"
                    style={{ width: `${sector.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {currencySymbol}{sector.value.toLocaleString()} • {sector.count} {t('insights.assets')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Allocation */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-pink-600" />
            {t('insights.geographicAllocation')}
          </h2>
          <div className="space-y-3">
            {insights.geographic_allocation.map((geo, idx) => (
              <div key={idx}>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {geo.country === 'Unknown' ? (
                      <span className="text-lg">🌍</span>
                    ) : getCountryCode(geo.country) ? (
                      <img
                        src={`https://flagcdn.com/w40/${getCountryCode(geo.country)}.png`}
                        alt={`${geo.country} flag`}
                        className="w-5 h-4 object-cover rounded"
                      />
                    ) : (
                      <span className="text-lg">🌍</span>
                    )}
                    <span className="text-sm font-medium">{geo.country}</span>
                  </div>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {geo.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${geo.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {currencySymbol}{geo.value.toLocaleString()} • {geo.count} {t('insights.assets')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Diversification Score */}
      <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 rounded-lg p-6 border border-pink-200 dark:border-pink-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-pink-600" />
              {t('insights.diversificationScore')}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {t('insights.diversificationDescription')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-pink-600">
              {insights.diversification_score?.toFixed(0) || 'N/A'}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('insights.outOf100')}</p>
          </div>
        </div>
        <div className="mt-4 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-pink-600 to-purple-600 h-3 rounded-full transition-all"
            style={{ width: `${insights.diversification_score || 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
