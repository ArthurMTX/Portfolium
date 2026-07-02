import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import annotationPlugin from 'chartjs-plugin-annotation'
import {
  CategoryScale,
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import api from '@/api'
import { ChartSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import type { AssetResearchViewTransaction } from '@/features/asset-research/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, annotationPlugin)

type PricePeriod = '1M' | '3M' | 'YTD' | '1Y' | 'ALL'
type TransactionIndicatorKind = 'buy' | 'sell' | 'conversion' | 'transfer' | 'split'
type FxRateMap = Record<string, number | null>

interface TransactionIndicatorVisual {
  label: string
  color: string
  radius: number
}

const PERIODS: PricePeriod[] = ['1M', '3M', 'YTD', '1Y', 'ALL']
const AVERAGE_COST_LABEL = 'Average cost'
const EMPTY_FX_RATES: FxRateMap = {}
const TRANSACTION_KIND_ORDER: TransactionIndicatorKind[] = [
  'buy',
  'sell',
  'conversion',
  'transfer',
  'split',
]
const TRANSACTION_INDICATORS: Record<TransactionIndicatorKind, TransactionIndicatorVisual> = {
  buy: {
    label: 'Buy',
    color: 'rgb(34,197,94)',
    radius: 3,
  },
  sell: {
    label: 'Sell',
    color: 'rgb(239,68,68)',
    radius: 3,
  },
  conversion: {
    label: 'Conversion',
    color: 'rgb(99,102,241)',
    radius: 3,
  },
  transfer: {
    label: 'Transfer',
    color: 'rgb(6,182,212)',
    radius: 3,
  },
  split: {
    label: 'Split',
    color: 'rgb(168,85,247)',
    radius: 3.5,
  },
}

interface AssetResearchPriceChartProps {
  assetId: number
  symbol: string
  currency: string
  locale: string
  portfolioId?: number | null
  transactions?: AssetResearchViewTransaction[]
  currentAverageCost?: number | null
  currentAverageCostCurrency?: string | null
}

export default function AssetResearchPriceChart({
  assetId,
  symbol,
  currency,
  locale,
  portfolioId = null,
  transactions = [],
  currentAverageCost = null,
  currentAverageCostCurrency = null,
}: AssetResearchPriceChartProps) {
  const [period, setPeriod] = useState<PricePeriod>('1Y')
  const [showAverageCost, setShowAverageCost] = useState(true)
  const [hiddenIndicatorKinds, setHiddenIndicatorKinds] = useState<TransactionIndicatorKind[]>([])
  const historyQuery = useQuery({
    queryKey: ['asset-price-history', assetId, period],
    queryFn: () => api.getAssetPriceHistory(assetId, period),
    staleTime: 5 * 60 * 1000,
  })

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    [currency, locale],
  )

  const points = useMemo(
    () => historyQuery.data?.prices ?? [],
    [historyQuery.data?.prices],
  )
  const visibleDateRange = useMemo(() => getVisibleDateRange(points), [points])
  const fxRequirements = useMemo(
    () =>
      buildFxRequirements(
        transactions,
        currency,
        currentAverageCostCurrency,
        points[points.length - 1]?.date,
      ),
    [currency, currentAverageCostCurrency, points, transactions],
  )
  const fxRatesQuery = useQuery({
    queryKey: ['asset-research-price-fx', portfolioId, fxRequirements],
    queryFn: async () => {
      const entries = await Promise.all(
        fxRequirements.map(async (item) => {
          try {
            const response = await api.getFxRateForDate(
              portfolioId!,
              item.from,
              item.to,
              item.date,
            )
            return [item.key, response.rate] as const
          } catch {
            return [item.key, null] as const
          }
        }),
      )
      return Object.fromEntries(entries) as FxRateMap
    },
    enabled: Boolean(portfolioId && fxRequirements.length > 0),
    staleTime: 24 * 60 * 60 * 1000,
  })
  const fxRates = fxRatesQuery.data ?? EMPTY_FX_RATES
  const transactionPointMap = useMemo(() => {
    const map = new Map<number, AssetResearchViewTransaction[]>()
    for (const transaction of transactions) {
      if (!isDateInVisibleRange(transaction.tx_date, visibleDateRange)) continue
      const priceIndex = findNearestPriceIndex(points, transaction.tx_date)
      if (priceIndex === -1) continue
      const existing = map.get(priceIndex) ?? []
      existing.push(transaction)
      map.set(priceIndex, existing)
    }
    return map
  }, [points, transactions, visibleDateRange])
  const periodChange = useMemo(() => {
    if (points.length < 2) return null
    const firstPrice = Number(points[0].price)
    const lastPrice = Number(points[points.length - 1].price)
    if (!Number.isFinite(firstPrice) || !Number.isFinite(lastPrice) || firstPrice <= 0) {
      return null
    }
    return ((lastPrice - firstPrice) / firstPrice) * 100
  }, [points])
  const averageCostSeries = useMemo(
    () =>
      buildAverageCostSeries(
        points,
        transactions,
        currentAverageCost,
        currentAverageCostCurrency,
        currency,
        fxRates,
      ),
    [currency, currentAverageCost, currentAverageCostCurrency, fxRates, points, transactions],
  )
  const hasAverageCostLine = averageCostSeries.some((value) => value !== null)
  const visibleTransactionKinds = useMemo(
    () => new Set(TRANSACTION_KIND_ORDER.filter((kind) => !hiddenIndicatorKinds.includes(kind))),
    [hiddenIndicatorKinds],
  )
  const data = useMemo(
    () => ({
      labels: points.map((point) =>
        new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          year: period === 'ALL' ? '2-digit' : undefined,
        }).format(new Date(point.date)),
      ),
      datasets: [
        {
          label: `${symbol} price`,
          data: points.map((point) => point.price),
          borderColor: '#b51f5e',
          borderWidth: 2.25,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 14,
          tension: 0.18,
        },
        ...(showAverageCost && hasAverageCostLine
          ? [
              {
                label: AVERAGE_COST_LABEL,
                data: averageCostSeries,
                borderColor: 'rgba(168, 162, 158, 0.62)',
                borderWidth: 1.15,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
                spanGaps: false,
                stepped: 'after' as const,
                tension: 0,
              },
            ]
          : []),
      ],
    }),
    [averageCostSeries, hasAverageCostLine, locale, period, points, showAverageCost, symbol],
  )
  const transactionAnnotations = useMemo(() => {
    const annotations: Record<string, TransactionAnnotation> = {}
    if (points.length === 0 || transactions.length === 0) return annotations

    transactions.forEach((transaction) => {
      if (!isDateInVisibleRange(transaction.tx_date, visibleDateRange)) return
      const priceIndex = findNearestPriceIndex(points, transaction.tx_date)
      if (priceIndex === -1) return
      const point = points[priceIndex]
      const priceValue = Number(point.price)
      if (!Number.isFinite(priceValue)) return

        const kind = getTransactionIndicatorKind(transaction.type)
        if (!kind) return
        if (!visibleTransactionKinds.has(kind)) return
        const visual = TRANSACTION_INDICATORS[kind]
        const transactionPrice = getChartCompatibleTransactionPrice(transaction, currency, fxRates)

        annotations[`tx-point-${transaction.id}`] = {
          type: 'point',
          xValue: priceIndex,
          yValue: transactionPrice ?? priceValue,
          backgroundColor: '#ffffff',
          borderColor: visual.color,
          borderWidth: 2,
          radius: visual.radius,
          drawTime: 'afterDatasetsDraw',
        }
    })

    return annotations
  }, [currency, fxRates, points, transactions, visibleDateRange, visibleTransactionKinds])
  const visibleIndicatorKinds = useMemo(() => {
    const kinds = new Set<TransactionIndicatorKind>()
    transactions.forEach((transaction) => {
      if (!isDateInVisibleRange(transaction.tx_date, visibleDateRange)) return
      if (findNearestPriceIndex(points, transaction.tx_date) === -1) return
      const kind = getTransactionIndicatorKind(transaction.type)
      if (kind) kinds.add(kind)
    })
    return Array.from(kinds)
  }, [points, transactions, visibleDateRange])

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 360, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          displayColors: false,
          padding: 12,
          callbacks: {
            label: (context) => {
              const value = Number(context.parsed.y)
              if (!Number.isFinite(value)) return ''
              if (context.dataset.label === AVERAGE_COST_LABEL) {
                return `${AVERAGE_COST_LABEL}: ${currencyFormatter.format(value)}`
              }
              return `Market close: ${currencyFormatter.format(value)}`
            },
            afterLabel: (context) => {
              if (context.dataset.label === AVERAGE_COST_LABEL) return []
              const transactionsOnDate = transactionPointMap.get(context.dataIndex) ?? []
              return transactionsOnDate
                .filter((transaction) => {
                  const kind = getTransactionIndicatorKind(transaction.type)
                  return Boolean(kind && visibleTransactionKinds.has(kind))
                })
                .map((transaction) => formatTransactionTooltipLine(transaction, currencyFormatter))
                .filter((line): line is string => Boolean(line))
            },
          },
        },
        annotation: {
          annotations: transactionAnnotations,
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: '#78716c',
            maxRotation: 0,
            maxTicksLimit: 6,
            font: { size: 11 },
          },
        },
        y: {
          position: 'right',
          border: { display: false },
          grid: { color: 'rgba(120, 113, 108, 0.14)' },
          ticks: {
            color: '#78716c',
            maxTicksLimit: 5,
            callback: (value) => currencyFormatter.format(Number(value)),
            font: { size: 11 },
          },
        },
      },
    }),
    [currencyFormatter, transactionAnnotations, transactionPointMap, visibleTransactionKinds],
  )
  const toggleIndicatorKind = (kind: TransactionIndicatorKind) => {
    setHiddenIndicatorKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    )
  }

  return (
    <section className="asset-research__trajectory" aria-labelledby="asset-trajectory-heading">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">Observed market data</p>
          <h2 id="asset-trajectory-heading">Price trajectory</h2>
          {periodChange !== null && (
            <p
              className={`asset-research__trajectory-return ${
                periodChange > 0
                  ? 'asset-research__value--positive'
                  : periodChange < 0
                    ? 'asset-research__value--negative'
                    : 'asset-research__value--neutral'
              }`}
            >
              {periodChange > 0 ? '+' : ''}
              {periodChange.toFixed(2)}% from the first to the latest price in {period}
            </p>
          )}
        </div>
        <div className="pf-tabs asset-research__periods" aria-label="Price period">
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              className={period === item ? 'is-active' : ''}
              aria-pressed={period === item}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {historyQuery.isLoading ? (
        <ChartSkeleton className="asset-research__chart-skeleton" label="Loading price history" />
      ) : historyQuery.isError ? (
        <StateBlock
          tone="error"
          className="asset-research__quiet-state"
          eyebrow="Price history"
          title="Price history could not be loaded."
          description="The current quote remains available above."
          actionLabel="Retry"
          onAction={() => historyQuery.refetch()}
        />
      ) : points.length < 2 ? (
        <StateBlock
          className="asset-research__quiet-state"
          eyebrow="No chart data"
          title="Not enough data to draw this chart."
          description="More dated prices are needed to establish a trajectory."
        />
      ) : (
        <div
          className="asset-research__chart"
          role="img"
          aria-label={`${symbol} price trajectory over ${period}`}
        >
          <Line data={data} options={options} />
        </div>
      )}
      {(hasAverageCostLine || visibleIndicatorKinds.length > 0) && (
        <div className="asset-research__transaction-indicators" aria-label="Transaction indicators">
          {hasAverageCostLine && (
            <button
              type="button"
              className={`asset-research__average-cost-indicator ${
                showAverageCost ? 'is-active' : 'is-muted'
              }`}
              aria-pressed={showAverageCost}
              onClick={() => setShowAverageCost((current) => !current)}
              style={{ '--indicator-color': 'rgba(168, 162, 158, 0.72)' } as CSSProperties}
            >
              <i aria-hidden="true" />
              Average cost
            </button>
          )}
          {visibleIndicatorKinds.map((kind) => {
            const visual = TRANSACTION_INDICATORS[kind]
            const isActive = visibleTransactionKinds.has(kind)
            return (
              <button
                key={kind}
                type="button"
                className={isActive ? 'is-active' : 'is-muted'}
                aria-pressed={isActive}
                onClick={() => toggleIndicatorKind(kind)}
                style={{ '--indicator-color': visual.color } as CSSProperties}
              >
                <i aria-hidden="true" />
                {visual.label}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

type TransactionAnnotation = {
  type: 'point'
  xValue?: number
  yValue?: number
  borderColor?: string
  backgroundColor?: string
  borderWidth?: number
  radius?: number
  drawTime?: 'afterDatasetsDraw'
}

interface AverageCostState {
  quantity: number
  costBasis: number
}

function buildAverageCostSeries(
  points: Array<{ date: string }>,
  transactions: AssetResearchViewTransaction[],
  currentAverageCost: number | null,
  currentAverageCostCurrency: string | null,
  chartCurrency: string,
  fxRates: FxRateMap,
) {
  const costTransactions = transactions.filter((transaction) =>
    canConvertTransaction(transaction, chartCurrency, fxRates),
  )

  if (costTransactions.length === 0) {
    const fallbackAverageCost = convertValue(
      currentAverageCost,
      currentAverageCostCurrency,
      chartCurrency,
      latestPointDate(points),
      fxRates,
    )
    return points.map(() =>
      fallbackAverageCost !== null && fallbackAverageCost > 0 ? fallbackAverageCost : null,
    )
  }

  const sortedTransactions = [...costTransactions].sort((a, b) => {
    const dateComparison = (toDateKey(a.tx_date) ?? '').localeCompare(toDateKey(b.tx_date) ?? '')
    if (dateComparison !== 0) return dateComparison
    return a.id - b.id
  })
  let transactionIndex = 0
  let state: AverageCostState = { quantity: 0, costBasis: 0 }

  return points.map((point) => {
    const pointDate = toDateKey(point.date)
    if (!pointDate) return null

    while (transactionIndex < sortedTransactions.length) {
      const transactionDate = toDateKey(sortedTransactions[transactionIndex].tx_date)
      if (!transactionDate || transactionDate > pointDate) break
      state = applyAverageCostTransaction(
        state,
        sortedTransactions[transactionIndex],
        chartCurrency,
        fxRates,
      )
      transactionIndex += 1
    }

    if (state.quantity > 0 && state.costBasis > 0) return state.costBasis / state.quantity
    const fallbackAverageCost = convertValue(
      currentAverageCost,
      currentAverageCostCurrency,
      chartCurrency,
      pointDate,
      fxRates,
    )
    return fallbackAverageCost !== null && fallbackAverageCost > 0 ? fallbackAverageCost : null
  })
}

function applyAverageCostTransaction(
  state: AverageCostState,
  transaction: AssetResearchViewTransaction,
  chartCurrency: string,
  fxRates: FxRateMap,
): AverageCostState {
  const type = transaction.type.toUpperCase()
  const quantity = toNumericValue(transaction.quantity)
  const price = convertValue(
    transaction.price,
    transaction.currency,
    chartCurrency,
    transaction.tx_date,
    fxRates,
  )
  if (quantity === null || quantity <= 0) return state
  const absoluteQuantity = Math.abs(quantity)

  if (type === 'SPLIT') {
    const multiplier = parseSplitMultiplier(transaction.metadata?.split)
    if (!multiplier || multiplier <= 0) return state
    return normalizeAverageCostState({
      quantity: state.quantity * multiplier,
      costBasis: state.costBasis,
    })
  }

  if (['BUY', 'CONVERSION_IN', 'TRANSFER_IN'].includes(type)) {
    if (price === null || price <= 0) return state
    return normalizeAverageCostState({
      quantity: state.quantity + absoluteQuantity,
      costBasis: state.costBasis + absoluteQuantity * price,
    })
  }

  if (['SELL', 'CONVERSION_OUT', 'TRANSFER_OUT'].includes(type)) {
    if (state.quantity <= 0 || state.costBasis <= 0) return state
    const averageCost = state.costBasis / state.quantity
    const exitQuantity = Math.min(absoluteQuantity, state.quantity)
    return normalizeAverageCostState({
      quantity: state.quantity - exitQuantity,
      costBasis: state.costBasis - averageCost * exitQuantity,
    })
  }

  return state
}

function findNearestPriceIndex(points: Array<{ date: string }>, transactionDateValue: string) {
  const transactionDate = toDateKey(transactionDateValue)
  if (!transactionDate) return -1
  const exactIndex = points.findIndex((point) => toDateKey(point.date) === transactionDate)
  if (exactIndex !== -1) return exactIndex
  const nextIndex = points.findIndex((point) => {
    const pointDate = toDateKey(point.date)
    return Boolean(pointDate && pointDate >= transactionDate)
  })
  return nextIndex
}

function getVisibleDateRange(points: Array<{ date: string }>) {
  const start = points[0]?.date ? toDateKey(points[0].date) : null
  const end = points[points.length - 1]?.date ? toDateKey(points[points.length - 1].date) : null
  return { start, end }
}

function isDateInVisibleRange(
  dateValue: string,
  range: { start: string | null; end: string | null },
) {
  const date = toDateKey(dateValue)
  if (!date || !range.start || !range.end) return false
  return date >= range.start && date <= range.end
}

function normalizeAverageCostState(state: AverageCostState): AverageCostState {
  if (state.quantity <= 0.0000001 || state.costBasis <= 0.0000001) {
    return { quantity: 0, costBasis: 0 }
  }
  return state
}

function getChartCompatibleTransactionPrice(
  transaction: AssetResearchViewTransaction,
  chartCurrency: string,
  fxRates: FxRateMap,
) {
  return convertValue(transaction.price, transaction.currency, chartCurrency, transaction.tx_date, fxRates)
}

function isSameCurrency(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false
  return left.toUpperCase() === right.toUpperCase()
}

function buildFxRequirements(
  transactions: AssetResearchViewTransaction[],
  chartCurrency: string,
  currentAverageCostCurrency: string | null | undefined,
  fallbackDateValue: string | undefined,
) {
  const requirements = new Map<string, { key: string; from: string; to: string; date: string }>()

  for (const transaction of transactions) {
    const from = normalizeCurrency(transaction.currency)
    const to = normalizeCurrency(chartCurrency)
    const date = toDateKey(transaction.tx_date)
    if (!from || !to || !date || from === to) continue
    const key = fxKey(from, to, date)
    requirements.set(key, { key, from, to, date })
  }

  const fallbackCurrency = normalizeCurrency(currentAverageCostCurrency)
  const chart = normalizeCurrency(chartCurrency)
  const fallbackDate = fallbackDateValue ? toDateKey(fallbackDateValue) : null
  if (fallbackCurrency && chart && fallbackDate && fallbackCurrency !== chart) {
    const key = fxKey(fallbackCurrency, chart, fallbackDate)
    requirements.set(key, { key, from: fallbackCurrency, to: chart, date: fallbackDate })
  }

  return Array.from(requirements.values())
}

function canConvertTransaction(
  transaction: AssetResearchViewTransaction,
  chartCurrency: string,
  fxRates: FxRateMap,
) {
  if (transaction.type.toUpperCase() === 'SPLIT') return true
  if (!isAverageCostEvent(transaction.type)) return false
  if (isSameCurrency(transaction.currency, chartCurrency)) return true
  const key = transactionFxKey(transaction, chartCurrency)
  return Boolean(key && typeof fxRates[key] === 'number')
}

function isAverageCostEvent(type: string) {
  return [
    'BUY',
    'SELL',
    'CONVERSION_IN',
    'CONVERSION_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'SPLIT',
  ].includes(type.toUpperCase())
}

function convertValue(
  value: number | string | null | undefined,
  fromCurrency: string | null | undefined,
  toCurrency: string,
  dateValue: string | null | undefined,
  fxRates: FxRateMap,
) {
  const numeric = toNumericValue(value)
  if (numeric === null || numeric <= 0) return null
  if (isSameCurrency(fromCurrency, toCurrency)) return numeric
  const from = normalizeCurrency(fromCurrency)
  const to = normalizeCurrency(toCurrency)
  const date = dateValue ? toDateKey(dateValue) : null
  if (!from || !to || !date) return null
  const rate = fxRates[fxKey(from, to, date)]
  return typeof rate === 'number' ? numeric * rate : null
}

function transactionFxKey(transaction: AssetResearchViewTransaction, chartCurrency: string) {
  const from = normalizeCurrency(transaction.currency)
  const to = normalizeCurrency(chartCurrency)
  const date = toDateKey(transaction.tx_date)
  return from && to && date ? fxKey(from, to, date) : null
}

function fxKey(from: string, to: string, date: string) {
  return `${from}|${to}|${date}`
}

function normalizeCurrency(currency: string | null | undefined) {
  return currency?.trim().toUpperCase() || null
}

function latestPointDate(points: Array<{ date: string }>) {
  const latest = points[points.length - 1]?.date
  return latest ? toDateKey(latest) : null
}

function parseSplitMultiplier(split: string | undefined) {
  if (!split) return null
  const [numerator, denominator] = split.split(':').map((part) => Number(part))
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null
  }
  return numerator / denominator
}

function toNumericValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function toDateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function getTransactionIndicatorKind(type: string): TransactionIndicatorKind | null {
  switch (type.toUpperCase()) {
    case 'BUY':
      return 'buy'
    case 'SELL':
      return 'sell'
    case 'CONVERSION_IN':
    case 'CONVERSION_OUT':
      return 'conversion'
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT':
      return 'transfer'
    case 'SPLIT':
      return 'split'
    default:
      return null
  }
}

function formatTransactionTooltipLine(
  transaction: AssetResearchViewTransaction,
  chartCurrencyFormatter: Intl.NumberFormat,
) {
  const kind = getTransactionIndicatorKind(transaction.type)
  if (!kind) return null
  const visual = TRANSACTION_INDICATORS[kind]
  const quantity = Number(transaction.quantity)
  const price = Number(transaction.price)
  const transactionCurrencyFormatter = new Intl.NumberFormat(chartCurrencyFormatter.resolvedOptions().locale, {
    style: 'currency',
    currency: transaction.currency,
    maximumFractionDigits: 2,
  })
  const quantityText = Number.isFinite(quantity) ? quantity.toLocaleString(undefined, { maximumFractionDigits: 6 }) : null
  const priceText = Number.isFinite(price) && price > 0 ? transactionCurrencyFormatter.format(price) : null

  if (transaction.type.toUpperCase() === 'SPLIT') {
    const split = transaction.metadata?.split
    return split ? `${visual.label}: ${split}` : visual.label
  }

  if (quantityText && priceText) return `${visual.label} price: ${quantityText} @ ${priceText}`
  if (quantityText) return `${visual.label}: ${quantityText}`
  return visual.label
}
