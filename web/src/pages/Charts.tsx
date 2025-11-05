import { useEffect, useState } from 'react'
import { LineChart, TrendingUp, Grid3x3, TrendingDown } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import PortfolioHistoryChart from '../components/PortfolioHistoryChart'
import InvestmentPerformanceChart from '../components/InvestmentPerformanceChart'
import PortfolioHeatmap from '../components/PortfolioHeatmap'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '../components/EmptyTransactionsPrompt'
import { useTranslation } from 'react-i18next'

type ChartTab = 'heatmap' | 'history' | 'performance'

export default function Charts() {
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()

  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ChartTab>('heatmap')
  const [hasTransactions, setHasTransactions] = useState<boolean | null>(null)
  const [checkingTransactions, setCheckingTransactions] = useState(false)

  useEffect(() => {
    let canceled = false
    const load = async () => {
      if (portfolios.length === 0) {
        const data = await api.getPortfolios()
        if (canceled) return
        setPortfolios(data)
        if (data.length > 0 && !activePortfolioId) setActivePortfolio(data[0].id)
      }
    }
    load()
    return () => { canceled = true }
  }, [portfolios.length, activePortfolioId, setActivePortfolio, setPortfolios])

  // Check if portfolio has transactions
  useEffect(() => {
    let canceled = false
    const checkTransactions = async () => {
      if (!activePortfolioId) return
      
      setCheckingTransactions(true)
      try {
        const transactions = await api.getTransactions(activePortfolioId)
        if (!canceled) {
          setHasTransactions(transactions.length > 0)
        }
      } catch (err) {
        console.error('Failed to check transactions:', err)
        if (!canceled) {
          setHasTransactions(false)
        }
      } finally {
        if (!canceled) {
          setCheckingTransactions(false)
        }
      }
    }
    checkTransactions()
    return () => { canceled = true }
  }, [activePortfolioId])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="charts" />
  }

  if (checkingTransactions) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <LineChart className="text-pink-600" size={32} />
              {t('charts.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {t('charts.loadingMessage')}
            </p>
          </div>
          <div className="h-10 w-36 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
        </div>

        {/* Tab Skeleton */}
        <div className="card">
          <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded-t-lg mb-4 animate-pulse"></div>
          <div className="p-6">
            <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded mb-4 animate-pulse"></div>
            <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (hasTransactions === false) {
    const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
    return <EmptyTransactionsPrompt pageType="charts" portfolioName={activePortfolio?.name} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LineChart className="text-pink-600" size={32} />
            {t('charts.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('charts.description')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex gap-1 px-2 pt-2">
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-colors font-medium ${
                activeTab === 'heatmap'
                  ? 'bg-white dark:bg-neutral-800 text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              }`}
            >
              <Grid3x3 size={18} />
              {t('charts.heatmap')}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-colors font-medium ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-neutral-800 text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              }`}
            >
              <TrendingUp size={18} />
              {t('charts.history')}
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-colors font-medium ${
                activeTab === 'performance'
                  ? 'bg-white dark:bg-neutral-800 text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              }`}
            >
              <TrendingDown size={18} />
              {t('charts.performance')}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'heatmap' && (
            <PortfolioHeatmap portfolioId={activePortfolioId} />
          )}
          {activeTab === 'history' && (
            <PortfolioHistoryChart portfolioId={activePortfolioId} />
          )}
          {activeTab === 'performance' && (
            <InvestmentPerformanceChart portfolioId={activePortfolioId} />
          )}
        </div>
      </div>
    </div>
  )
}
