import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import api from '@/api'
import {
  ChartPeriodButtons,
  PortfolioChartSkeleton,
} from '@/features/charts/components/chartShared'
import {
  CHART_GRID_COLOR,
  CHART_TICK_COLOR,
  CHART_TOOLTIP_BASE,
  createCategoryXAxis,
  createChartHoverHandler,
  createTooltipTitleCallback,
  formatChartDateLabel,
  getCurrencySymbol,
} from '@/features/charts/components/chartUtils'
import { usePortfolioHistoryChart } from '@/features/charts/hooks/usePortfolioHistoryChart'

Chart.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

interface Props {
  portfolioId: number
}

interface ChartTransactionEvent {
  id: number
  tx_date: string
  type: string
  quantity?: number | string | null
  asset?: {
    symbol?: string | null
    name?: string | null
  } | null
}

export default function PortfolioHistoryChart({ portfolioId }: Props) {
  const { t, i18n } = useTranslation()
  const { period, setPeriod, loading, history, hoveredIndex, setHoveredIndex, currentLocale, currency } =
    usePortfolioHistoryChart(portfolioId, i18n.language)
  const currencySymbol = getCurrencySymbol(currency)
  const [transactions, setTransactions] = useState<ChartTransactionEvent[]>([])

  useEffect(() => {
    let canceled = false
    const loadTransactions = async () => {
      try {
        const data = await api.getTransactions(portfolioId)
        if (!canceled) setTransactions(data as ChartTransactionEvent[])
      } catch (err) {
        console.error('Failed to load chart transaction events:', err)
        if (!canceled) setTransactions([])
      }
    }
    loadTransactions()
    return () => { canceled = true }
  }, [portfolioId])

  const transactionEventsByIndex = useMemo(() => {
    const events = new Map<number, ChartTransactionEvent[]>()
    if (history.length === 0 || transactions.length === 0) return events

    const firstDate = toDateKey(history[0].date)
    const lastDate = toDateKey(history[history.length - 1].date)
    if (!firstDate || !lastDate) return events

    for (const transaction of transactions) {
      const transactionDate = toDateKey(transaction.tx_date)
      if (!transactionDate || transactionDate < firstDate || transactionDate > lastDate) continue

      const exactIndex = history.findIndex((point) => toDateKey(point.date) === transactionDate)
      const fallbackIndex = exactIndex >= 0
        ? exactIndex
        : history.findIndex((point) => {
            const pointDate = toDateKey(point.date)
            return Boolean(pointDate && pointDate >= transactionDate)
          })
      if (fallbackIndex < 0) continue

      const existing = events.get(fallbackIndex) ?? []
      existing.push(transaction)
      events.set(fallbackIndex, existing)
    }

    return events
  }, [history, transactions])

  const transactionMarkerData = useMemo(
    () => history.map((point, index) => transactionEventsByIndex.has(index) ? point.value : null),
    [history, transactionEventsByIndex],
  )

  const transactionMarkerColors = useMemo(
    () => history.map((_, index) => {
      const event = transactionEventsByIndex.get(index)?.[0]
      return getTransactionMarkerColor(event?.type)
    }),
    [history, transactionEventsByIndex],
  )

  const summary = (() => {
    if (history.length === 0) return null
    const firstPoint = history[0]
    const lastPoint = history[history.length - 1]
    const highPoint = history.reduce((max, point) => point.value > max.value ? point : max, firstPoint)
    const lowPoint = history.reduce((min, point) => point.value < min.value ? point : min, firstPoint)
    let largestGain: { value: number; date: string } | null = null
    let largestLoss: { value: number; date: string } | null = null
    for (let index = 1; index < history.length; index += 1) {
      const change = history[index].value - history[index - 1].value
      if (!largestGain || change > largestGain.value) largestGain = { value: change, date: history[index].date }
      if (!largestLoss || change < largestLoss.value) largestLoss = { value: change, date: history[index].date }
    }
    return {
      gained: lastPoint.value - firstPoint.value,
      highPoint,
      lowPoint,
      largestGain,
      largestLoss,
    }
  })()

  const chartData = {
    labels: history.map(h => {
      const date = new Date(h.date)
      return formatChartDateLabel(date, period, currentLocale)
    }),
    datasets: [
      {
        label: t('portfolioHistoryChart.portfolioValueDataset'),
        data: history.map(h => h.value),
        borderColor: 'rgb(236,72,153)',
        backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
          const chart = ctx.chart
          const {ctx: c, chartArea} = chart || {}
          if (!chartArea) return 'rgba(236,72,153,0.1)'
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(236,72,153,0.25)')
          gradient.addColorStop(1, 'rgba(236,72,153,0.02)')
          return gradient
        },
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgb(236,72,153)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      },
      {
        label: t('portfolioHistoryChart.capitalEvents'),
        data: transactionMarkerData,
        borderColor: transactionMarkerColors,
        backgroundColor: transactionMarkerColors,
        pointBackgroundColor: transactionMarkerColors,
        pointBorderColor: '#050505',
        pointBorderWidth: 1,
        pointRadius: (ctx: { dataIndex: number }) => transactionEventsByIndex.has(ctx.dataIndex) ? 3 : 0,
        pointHoverRadius: (ctx: { dataIndex: number }) => transactionEventsByIndex.has(ctx.dataIndex) ? 5 : 0,
        showLine: false,
        fill: false,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...CHART_TOOLTIP_BASE,
        callbacks: {
          title: createTooltipTitleCallback(history, currentLocale),
          label: (context: { parsed: { y: number | null }; dataIndex: number; dataset: { label?: string } }) => {
            if (context.dataset.label === t('portfolioHistoryChart.capitalEvents')) {
              const events = transactionEventsByIndex.get(context.dataIndex) ?? []
              return events.map((event) => formatTransactionEvent(event, t))
            }
            const value = context.parsed.y
            if (value === null) return ''
            return `${t('fields.value')}: ${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
        }
      },
    },
    scales: {
      x: createCategoryXAxis(period),
      y: {
        title: { 
          display: true, 
          text: `${t('charts.portfolioValue')} (${currency})`,
          color: CHART_TICK_COLOR,
          font: { size: 12 }
        },
        grid: { color: CHART_GRID_COLOR },
        ticks: { 
          color: CHART_TICK_COLOR,
          font: { size: 11 },
          callback: (value: string | number) => {
            return `${currencySymbol}${Number(value).toLocaleString()}`
          }
        },
      },
    },
    interaction: { mode: 'nearest' as const, intersect: false },
    maintainAspectRatio: false,
    animation: {
      duration: 400,
      easing: 'easeInOutQuart' as const,
    },
    onHover: createChartHoverHandler(setHoveredIndex),
  }

  return (
    <section className="pf-section pf-section--spacious charts-section">
      <div className="pf-section-header pf-section-header--grid pf-section-header--spacious charts-section__header">
        <div>
          <p className="pf-section-kicker">{t('portfolioHistoryChart.visualHistoryKicker')}</p>
          <h2 className="pf-section-title">{t('charts.portfolioValueLabel')}</h2>
        </div>
        <span className="pf-section-description">{t('portfolioHistoryChart.everyValuationPointNote')}</span>
      </div>
      <div className="charts-chart-panel">
        {loading ? (
          <PortfolioChartSkeleton metricWidthClass="w-32">
            <path
              d="M 0,40 L 10,38 L 20,35 L 30,36 L 40,32 L 50,28 L 60,30 L 70,25 L 80,22 L 90,20 L 100,18"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-pink-400"
            />
            <path
              d="M 0,40 L 10,38 L 20,35 L 30,36 L 40,32 L 50,28 L 60,30 L 70,25 L 80,22 L 90,20 L 100,18 L 100,50 L 0,50 Z"
              fill="currentColor"
              className="text-pink-200 dark:text-pink-900 opacity-20"
            />
          </PortfolioChartSkeleton>
        ) : history.length === 0 ? (
          <div className="charts-empty">
            <p className="font-semibold mb-2">{t('charts.noPortfolioHistory')}</p>
            <p className="text-sm">{t('charts.noPortfolioHistoryInfo')}</p>
          </div>
        ) : (
          <div>
            <div className="charts-chart-heading">
              <h3>{t('charts.portfolioValueLabel')}</h3>
              {history.length > 0 && (() => {
                // Determine which point to display (hovered or last)
                const displayIndex = hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < history.length 
                  ? hoveredIndex 
                  : history.length - 1
                const displayPoint = history[displayIndex]
                
                const firstPoint = history[0]
                const hasZeroStartingPoint = firstPoint.value === 0 && firstPoint.invested === 0 && history.length > 1
                
                // For period gain calculations, skip zero starting point
                const effectiveFirstPoint = hasZeroStartingPoint ? history[1] : firstPoint
                
                // If hovering over the zero point, use the effective first point for display
                const isHoveringZeroPoint = displayIndex === 0 && hasZeroStartingPoint
                const effectiveDisplayPoint = isHoveringZeroPoint ? effectiveFirstPoint : displayPoint
                const displayValue = effectiveDisplayPoint.value
                
                // For "in period" change display:
                // - If there's a zero starting point: show change from 0 (total growth)
                // - Otherwise: show change from first point
                const changeFromValue = hasZeroStartingPoint ? 0 : firstPoint.value
                const absoluteChange = displayValue - changeFromValue
                const isPositive = absoluteChange >= 0
                
                // Calculate TRUE investment gain for the period
                // Gain = (End Value - End Invested) - (Start Value - Start Invested)
                // This excludes the effect of deposits/withdrawals during the period
                // Always use effective first point (skipping zero) for percentage calculations
                let periodGainPct = null
                if (effectiveFirstPoint.invested && effectiveDisplayPoint.invested && effectiveFirstPoint.invested > 0 && effectiveFirstPoint.value > 0) {
                  const startGain = effectiveFirstPoint.value - effectiveFirstPoint.invested
                  const endGain = displayValue - effectiveDisplayPoint.invested
                  const actualGain = endGain - startGain
                  // Calculate % based on the value at start of period
                  periodGainPct = (actualGain / effectiveFirstPoint.value) * 100
                }
                
                return (
                  <div className="charts-chart-metric">
                    <p>
                      {currencySymbol}{displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div>
                      <p className={`text-sm font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isPositive ? '+' : ''}{currencySymbol}{Math.abs(absoluteChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('charts.inPeriod')}
                      </p>
                      {periodGainPct !== null && (
                        <p className={`text-xs font-semibold ${periodGainPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {periodGainPct >= 0 ? '+' : ''}{periodGainPct.toFixed(2)}% {t('charts.inPeriod')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div 
              className="charts-chart-canvas"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Line data={chartData} options={chartOptions} />
            </div>
            <ChartPeriodButtons period={period} onChange={setPeriod} t={t} />
            {summary && (
              <div className="charts-observations">
                <p>{t('portfolioHistoryChart.duringThisPeriod')}</p>
                <dl>
                  <div>
                    <dt>{t('portfolioHistoryChart.gained')}</dt>
                    <dd className={summary.gained >= 0 ? 'is-positive' : 'is-negative'}>{summary.gained >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(summary.gained).toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div>
                    <dt>{t('portfolioHistoryChart.reachedHigh')}</dt>
                    <dd className="is-positive">{currencySymbol}{summary.highPoint.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div>
                    <dt>{t('portfolioHistoryChart.reachedLow')}</dt>
                    <dd className="is-negative">{currencySymbol}{summary.lowPoint.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div>
                    <dt>{t('portfolioHistoryChart.largestDailyGain')}</dt>
                    <dd className="is-positive">{summary.largestGain ? `+${currencySymbol}${Math.abs(summary.largestGain.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('portfolioHistoryChart.largestDailyLoss')}</dt>
                    <dd className="is-negative">{summary.largestLoss ? `-${currencySymbol}${Math.abs(summary.largestLoss.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</dd>
                  </div>
                </dl>
              </div>
            )}
            {transactionEventsByIndex.size > 0 && (
              <div className="charts-event-legend" aria-label={t('portfolioHistoryChart.capitalEventMarkersLabel')}>
                <span><i className="is-buy" />{t('portfolioHistoryChart.buy')}</span>
                <span><i className="is-sell" />{t('portfolioHistoryChart.sell')}</span>
                <span><i className="is-dividend" />{t('portfolioHistoryChart.dividend')}</span>
                <span><i className="is-split" />{t('portfolioHistoryChart.split')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function getTransactionMarkerColor(type: string | null | undefined): string {
  const normalized = (type || '').toUpperCase()
  if (normalized.includes('BUY') || normalized === 'TRANSFER_IN' || normalized === 'CONVERSION_IN') return '#20c997'
  if (normalized.includes('SELL') || normalized === 'TRANSFER_OUT' || normalized === 'CONVERSION_OUT') return '#f87171'
  if (normalized === 'DIVIDEND') return '#f0a0c5'
  if (normalized === 'SPLIT') return '#a78bfa'
  return '#aaa3ad'
}

function formatTransactionEvent(event: ChartTransactionEvent, t: TFunction): string {
  const typeKeyMap: Record<string, string> = {
    BUY: 'transaction.types.buy',
    SELL: 'transaction.types.sell',
    DIVIDEND: 'transaction.types.dividend',
    FEE: 'transaction.types.fee',
    SPLIT: 'transaction.types.split',
    TRANSFER_IN: 'transaction.types.transferIn',
    TRANSFER_OUT: 'transaction.types.transferOut',
    CONVERSION_IN: 'transaction.types.conversionIn',
    CONVERSION_OUT: 'transaction.types.conversionOut',
  }
  const key = typeKeyMap[event.type.toUpperCase()]
  const label = key ? t(key) : event.type
  const symbol = event.asset?.symbol ? ` · ${event.asset.symbol}` : ''
  const quantity = event.quantity !== null && event.quantity !== undefined && Number(event.quantity) > 0
    ? ` · ${Number(event.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t('assetsPage.shares')}`
    : ''
  return `${label}${symbol}${quantity}`
}
