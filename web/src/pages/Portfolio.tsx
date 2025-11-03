import { useEffect, useState } from 'react'
import { LineChart } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api from '../lib/api'
import PortfolioHistoryChart from '../components/PortfolioHistoryChart'
import PortfolioHeatmap from '../components/PortfolioHeatmap'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '../components/EmptyTransactionsPrompt'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Portfolio() {
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()

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

  if (!activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="charts" />
  }

  if (checkingTransactions) {
    return (
      <div className="text-center py-12">
        <LoadingSpinner size="lg" className="mx-auto" />
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading...</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <LineChart className="text-pink-600" size={28} />
            Portfolio Charts
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Visualize your portfolio performance over time
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <PortfolioHeatmap portfolioId={activePortfolioId} />

      {/* Chart */}
      <PortfolioHistoryChart portfolioId={activePortfolioId} />
    </div>
  )
}
