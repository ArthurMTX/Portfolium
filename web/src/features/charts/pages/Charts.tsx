import { useEffect, useState } from 'react'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import api, { type PortfolioHistoryPointDTO } from '@/api'
import PortfolioHistoryChart from '@/features/charts/components/PortfolioHistoryChart'
import InvestmentPerformanceChart from '@/features/charts/components/InvestmentPerformanceChart'
import PortfolioHeatmap from '@/features/charts/components/PortfolioHeatmap'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '@/features/transactions/components/EmptyTransactionsPrompt'
import { PageStateSkeleton } from '@/shared/components/StatePrimitives'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageShell,
  PageSummaryPanel,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { getCurrencySymbol } from '@/features/charts/components/chartUtils'
import { useTranslation } from 'react-i18next'
import '@/shared/design/pages/charts.css'

type ChartTab = 'heatmap' | 'history' | 'performance'

const TAB_PURPOSES: Record<ChartTab, string> = {
  heatmap: 'Position map of the portfolio, colored by daily movement.',
  history: 'Portfolio value over the selected period.',
  performance: 'Investment performance measured against invested capital.',
}

function metricTone(value: number | null | undefined): 'positive' | 'negative' | 'neutral' {
  if (value === null || value === undefined || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}

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
  const [heroHistory, setHeroHistory] = useState<PortfolioHistoryPointDTO[]>([])

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

  useEffect(() => {
    let canceled = false
    const loadHeroHistory = async () => {
      if (!activePortfolioId) return
      try {
        const history = await api.getPortfolioHistory(activePortfolioId, 'ALL')
        if (!canceled) setHeroHistory(history)
      } catch (err) {
        console.error('Failed to load chart hero history:', err)
        if (!canceled) setHeroHistory([])
      }
    }
    loadHeroHistory()
    return () => { canceled = true }
  }, [activePortfolioId])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="charts" />
  }

  if (checkingTransactions) {
    return <PageStateSkeleton label={t('charts.loadingMessage')} className="charts" />
  }

  if (hasTransactions === false) {
    const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
    return <EmptyTransactionsPrompt pageType="charts" portfolioName={activePortfolio?.name} />
  }

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const currency = activePortfolio?.base_currency || 'EUR'
  const currencySymbol = getCurrencySymbol(currency)
  const latestPoint = heroHistory[heroHistory.length - 1]
  const firstInvestmentPoint = heroHistory.find((point) => (point.value || 0) > 0 || (point.invested || 0) > 0)
  const totalReturn = latestPoint && latestPoint.invested !== undefined ? latestPoint.value - latestPoint.invested : null
  const totalReturnPct = latestPoint?.gain_pct

  return (
    <PageShell className="charts">
      <PageHeader>
        <PageTitleBlock kicker="Charts" title="Portfolio history" />
        <PageSummaryPanel
          lead={activePortfolio?.name || 'Active portfolio'}
          description={TAB_PURPOSES[activeTab]}
        />
      </PageHeader>

      <PageMetricStrip label="Portfolio chart context">
        <PageMetric
          label="Current value"
          value={latestPoint ? `${currencySymbol}${latestPoint.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        />
        <PageMetric
          label="Total return"
          tone={metricTone(totalReturn)}
          value={totalReturn !== null ? `${totalReturn >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(totalReturn).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          detail={totalReturnPct !== undefined && totalReturnPct !== null
            ? `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}%`
            : undefined}
          detailTone={metricTone(totalReturnPct)}
        />
        <PageMetric label="Selected period" value="All time" />
        <PageMetric
          label="First investment"
          value={firstInvestmentPoint ? new Date(firstInvestmentPoint.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'}
        />
      </PageMetricStrip>

      <PageControls
        label="Chart views"
        start={
          <PageTabs label="Chart views">
            <button
              type="button"
              onClick={() => setActiveTab('heatmap')}
              className={activeTab === 'heatmap' ? 'is-active' : ''}
            >
              {t('charts.heatmap')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={activeTab === 'history' ? 'is-active' : ''}
            >
              {t('charts.history')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={activeTab === 'performance' ? 'is-active' : ''}
            >
              {t('charts.performance')}
            </button>
          </PageTabs>
        }
      />

      <PageMainGrid single>
        <PageMainColumn className="charts__content">
          {activeTab === 'heatmap' && (
            <PortfolioHeatmap portfolioId={activePortfolioId} />
          )}
          {activeTab === 'history' && (
            <PortfolioHistoryChart portfolioId={activePortfolioId} />
          )}
          {activeTab === 'performance' && (
            <InvestmentPerformanceChart portfolioId={activePortfolioId} />
          )}
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}
