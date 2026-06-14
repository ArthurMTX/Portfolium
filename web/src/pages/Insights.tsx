import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, BarChart3, Layers, Shield, Sparkles, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import usePortfolioStore from '../store/usePortfolioStore'
import { periodLabel, type InsightsTabProps } from '../components/insights/InsightsShared'

const PerformanceTab = lazy(() => import('../components/insights/PerformanceTab'))
const AttributionTab = lazy(() => import('../components/insights/AttributionTab'))
const ExposureTab = lazy(() => import('../components/insights/ExposureTab'))
const RiskTab = lazy(() => import('../components/insights/RiskTab'))
const AIInsightsTab = lazy(() => import('../components/insights/AIInsightsTab'))

type InsightsTabId = 'performance' | 'attribution' | 'exposure' | 'risk' | 'ai'

const tabs: Array<{ id: InsightsTabId; label: string; purpose: string; icon: ReactNode }> = [
  { id: 'performance', label: 'Performance', purpose: 'What happened?', icon: <TrendingUp size={16} /> },
  { id: 'attribution', label: 'Attribution', purpose: 'Why did it happen?', icon: <Activity size={16} /> },
  { id: 'exposure', label: 'Exposure', purpose: 'What am I exposed to?', icon: <Layers size={16} /> },
  { id: 'risk', label: 'Risk', purpose: 'What can go wrong?', icon: <Shield size={16} /> },
  { id: 'ai', label: 'AI Insights', purpose: 'Future', icon: <Sparkles size={16} /> },
]

export default function Insights() {
  const { activePortfolioId, portfolios } = usePortfolioStore()
  const { t, i18n } = useTranslation()
  const [period, setPeriod] = useState('1y')
  const [benchmark, setBenchmark] = useState('SPY')
  const [activeTab, setActiveTab] = useState<InsightsTabId>('performance')
  const stickySentinelRef = useRef<HTMLDivElement | null>(null)
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    const sentinel = stickySentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting)
      },
      {
        root: null,
        threshold: 0,
        rootMargin: '-57px 0px 0px 0px',
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="insights" />
  }

  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId)
  const currency = activePortfolio?.base_currency || 'EUR'
  const currencySymbol = getCurrencySymbol(currency)
  const locale = i18n.language || 'en-US'
  const tabProps: InsightsTabProps = {
    portfolioId: activePortfolioId,
    period,
    benchmark,
    currency,
    currencySymbol,
    locale,
  }

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BarChart3 className="text-pink-600" size={28} />
            {t('insights.title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 sm:text-base">
            {t('insights.description')}
          </p>
        </div>
      </div>
      <div ref={stickySentinelRef} className="h-px" />
      <div
        className={`sticky top-[57px] z-40 border border-neutral-200 bg-white/95 p-2 shadow-sm backdrop-blur transition-[border-radius] dark:border-neutral-800 dark:bg-neutral-950/95 ${
          isSticky ? 'rounded-b-lg rounded-t-none border-t-0' : 'rounded-lg'
        }`}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    selected
                      ? 'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
                  }`}
                  title={tab.purpose}
                  aria-pressed={selected}
                >
                  {tab.icon}
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {periodLabel(period)}
            </span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="Insights period"
            >
              <option value="1m">{t('insights.periods.1M')}</option>
              <option value="3m">{t('insights.periods.3M')}</option>
              <option value="6m">{t('insights.periods.6M')}</option>
              <option value="ytd">{t('insights.periods.YTD')}</option>
              <option value="1y">{t('insights.periods.1Y')}</option>
              <option value="all">{t('insights.periods.ALL')}</option>
            </select>

            <select
              value={benchmark}
              onChange={(event) => setBenchmark(event.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="Insights benchmark"
            >
              <option value="SPY">S&P 500</option>
              <option value="QQQ">Nasdaq 100</option>
              <option value="IWM">Russell 2000</option>
              <option value="DIA">Dow Jones</option>
              <option value="VTI">{t('insights.totalMarket')}</option>
            </select>
          </div>
        </div>
      </div>

      <Suspense fallback={<TabFallback />}>
        {activeTab === 'performance' && <PerformanceTab {...tabProps} />}
        {activeTab === 'attribution' && <AttributionTab {...tabProps} />}
        {activeTab === 'exposure' && <ExposureTab {...tabProps} />}
        {activeTab === 'risk' && <RiskTab {...tabProps} />}
        {activeTab === 'ai' && <AIInsightsTab />}
      </Suspense>
    </div>
  )
}

function TabFallback() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-5 animate-pulse">
            <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-3 h-8 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-3 h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
        ))}
      </div>
      <div className="card h-80 animate-pulse bg-neutral-100 dark:bg-neutral-800" />
    </div>
  )
}

function getCurrencySymbol(currencyCode: string) {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    CHF: 'CHF',
    CAD: 'C$',
    AUD: 'A$',
    NZD: 'NZ$',
    INR: '₹',
    BRL: 'R$',
    ZAR: 'R',
    RUB: '₽',
    KRW: '₩',
    SGD: 'S$',
    HKD: 'HK$',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    MXN: 'MX$',
    TRY: '₺',
  }
  return symbols[currencyCode] || currencyCode
}
