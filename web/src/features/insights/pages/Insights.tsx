import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { type InsightsTabProps } from '@/features/insights/components/InsightsShared'
import { ChartSkeleton, MetricSkeletonStrip } from '@/shared/components/StatePrimitives'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageShell,
  PageSummaryPanel,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import '@/shared/design/pages/insights.css'

const PerformanceTab = lazy(() => import('@/features/insights/components/PerformanceTab'))
const AttributionTab = lazy(() => import('@/features/insights/components/AttributionTab'))
const ExposureTab = lazy(() => import('@/features/insights/components/ExposureTab'))
const RiskTab = lazy(() => import('@/features/insights/components/RiskTab'))
const AIInsightsTab = lazy(() => import('@/features/insights/components/AIInsightsTab'))

type InsightsTabId = 'performance' | 'attribution' | 'exposure' | 'risk' | 'ai'

const tabs: Array<{ id: InsightsTabId; label: string; purpose: string }> = [
  { id: 'performance', label: 'Performance', purpose: 'What happened?' },
  { id: 'attribution', label: 'Attribution', purpose: 'Why did it happen?' },
  { id: 'exposure', label: 'Exposure', purpose: 'What am I exposed to?' },
  { id: 'risk', label: 'Risk', purpose: 'What can go wrong?' },
  { id: 'ai', label: 'AI Insights', purpose: 'Future' },
]

export default function Insights() {
  const { activePortfolioId, portfolios } = usePortfolioStore()
  const { t, i18n } = useTranslation()
  const [period, setPeriod] = useState('1y')
  const [benchmark, setBenchmark] = useState('SPY')
  const [activeTab, setActiveTab] = useState<InsightsTabId>('performance')

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
    <PageShell className="insights">
      <PageHeader>
        <PageTitleBlock kicker="Insights" title={t('insights.title')} />
        <PageSummaryPanel
          lead={tabs.find((tab) => tab.id === activeTab)?.purpose}
          description={t('insights.description')}
        />
      </PageHeader>

      <PageControls
        label="Insights controls"
        start={
          <PageTabs label="Insights sections">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={selected ? 'is-active' : ''}
                  title={tab.purpose}
                  aria-pressed={selected}
                >
                  {tab.label}
                </button>
              )
            })}
          </PageTabs>
        }
        end={
          <div className="pf-control-group insights__filters">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
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
              aria-label="Insights benchmark"
            >
              <option value="SPY">S&P 500</option>
              <option value="QQQ">Nasdaq 100</option>
              <option value="IWM">Russell 2000</option>
              <option value="DIA">Dow Jones</option>
              <option value="VTI">{t('insights.totalMarket')}</option>
            </select>
          </div>
        }
      />

      <PageMainGrid single>
        <PageMainColumn className="insights__content">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'performance' && <PerformanceTab {...tabProps} />}
            {activeTab === 'attribution' && <AttributionTab {...tabProps} />}
            {activeTab === 'exposure' && <ExposureTab {...tabProps} />}
            {activeTab === 'risk' && <RiskTab {...tabProps} />}
            {activeTab === 'ai' && <AIInsightsTab />}
          </Suspense>
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}

function TabFallback() {
  return (
    <div className="insights-tab-fallback">
      <MetricSkeletonStrip label="Loading insights metrics" />
      <ChartSkeleton className="insights-chart-loading" label="Loading insights chart" />
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
