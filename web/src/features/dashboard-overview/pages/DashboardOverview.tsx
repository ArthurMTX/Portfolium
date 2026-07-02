import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BanknoteArrowDown,
  CircleDollarSign,
  ReceiptText,
  Shuffle,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import api, {
  type BatchPriceDTO,
  type DistributionItemDTO,
  type PortfolioGoalDTO,
  type PortfolioHistoryPointDTO,
  type PositionDTO,
  type ThemeDistributionItemDTO,
} from '@/api'
import { useDashboardBatch } from '@/features/dashboard/hooks/useDashboardBatch'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import AssetLogo from '@/shared/components/AssetLogo'
import { formatCurrency, formatQuantity } from '@/shared/lib/formatUtils'
import PortfolioTrajectory from '@/features/dashboard-overview/components/PortfolioTrajectory'
import ExposureFingerprint from '@/features/dashboard-overview/components/ExposureFingerprint'
import {
  buildDailyAttribution,
  buildExposure,
  calculateConcentration,
  calculatePositionDailyImpact,
  calculateTotalGain,
  calculateTransactionAmount,
  numberValue,
} from '@/features/dashboard-overview/lib/dashboardOverviewCalculations'
import type {
  DashboardPeriod,
  DashboardOverviewBatchData,
  DashboardOverviewMetrics,
  DashboardOverviewTransaction,
  ExposureDimension,
} from '@/features/dashboard-overview/types'
import {
  PageAsideColumn,
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
import { PageStateSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import '@/shared/design/pages/dashboard-overview.css'

const DASHBOARD_WIDGETS = [
  'total-value',
  'daily-gain',
  'unrealized-pnl',
  'realized-pnl',
  'dividends',
  'positions',
  'asset-allocation',
  'theme-allocation',
  'performance-metrics',
  'recent-transactions',
]

const PERIODS: DashboardPeriod[] = ['1W', '1M', 'YTD', '1Y']
const EXPOSURE_DIMENSIONS: { key: ExposureDimension; label: string }[] = [
  { key: 'sector', label: 'Sector' },
  { key: 'theme', label: 'Theme' },
  { key: 'type', label: 'Asset type' },
  { key: 'country', label: 'Country' },
]

function signedCurrency(value: number, currency: string, locale: string) {
  const formatted = formatCurrency(Math.abs(value), currency, locale)
  if (value > 0) return `+${formatted}`
  if (value < 0) return `−${formatted}`
  return formatted
}

function signedPercentage(value: number | null | undefined) {
  const normalized = numberValue(value)
  if (normalized > 0) return `+${normalized.toFixed(2)}%`
  if (normalized < 0) return `−${Math.abs(normalized).toFixed(2)}%`
  return '0.00%'
}

function valueTone(value: number) {
  if (value > 0) return 'dashboard-overview__value--positive'
  if (value < 0) return 'dashboard-overview__value--negative'
  return 'dashboard-overview__value--neutral'
}

interface TransactionVisual {
  Icon: LucideIcon
  label: string
  tone: string
}

function getTransactionVisual(type: string): TransactionVisual {
  switch (type.toUpperCase()) {
    case 'BUY':
      return { Icon: ArrowDownToLine, label: 'Buy', tone: 'buy' }
    case 'SELL':
      return { Icon: ArrowUpFromLine, label: 'Sell', tone: 'sell' }
    case 'DIVIDEND':
      return { Icon: CircleDollarSign, label: 'Dividend', tone: 'dividend' }
    case 'SPLIT':
      return { Icon: Shuffle, label: 'Split', tone: 'split' }
    case 'FEE':
      return { Icon: ReceiptText, label: 'Fee', tone: 'fee' }
    case 'TRANSFER_IN':
      return { Icon: BanknoteArrowDown, label: 'Transfer in', tone: 'inflow' }
    case 'TRANSFER_OUT':
      return { Icon: ArrowUpFromLine, label: 'Transfer out', tone: 'outflow' }
    case 'CONVERSION_IN':
      return { Icon: ArrowLeftRight, label: 'Conversion in', tone: 'inflow' }
    case 'CONVERSION_OUT':
      return { Icon: ArrowLeftRight, label: 'Conversion out', tone: 'outflow' }
    default:
      return { Icon: ArrowLeftRight, label: type, tone: 'neutral' }
  }
}

function formatTimestamp(value: string | undefined, locale: string) {
  if (!value) return 'valuation time unavailable'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'valuation time unavailable'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}


export default function DashboardOverview() {
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()
  const [period, setPeriod] = useState<DashboardPeriod>('1M')
  const [exposureDimension, setExposureDimension] = useState<ExposureDimension>('sector')
  const locale = navigator.language || 'en-US'

  const { data: portfoliosData, isLoading: portfoliosLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  useEffect(() => {
    if (!portfoliosData) return
    setPortfolios(portfoliosData)
    if (portfoliosData.length > 0 && !activePortfolioId) {
      setActivePortfolio(portfoliosData[0].id)
    }
  }, [activePortfolioId, portfoliosData, setActivePortfolio, setPortfolios])

  const batchQuery = useDashboardBatch({
    portfolioId: activePortfolioId || 0,
    visibleWidgets: DASHBOARD_WIDGETS,
    enabled: Boolean(activePortfolioId),
  })

  const batchPricesQuery = useQuery({
    queryKey: ['batchPrices', activePortfolioId],
    queryFn: () => api.getBatchPrices(activePortfolioId!),
    enabled: Boolean(activePortfolioId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const goalsQuery = useQuery<PortfolioGoalDTO[]>({
    queryKey: ['portfolio-goals', activePortfolioId, true],
    queryFn: () => api.getPortfolioGoals(activePortfolioId!, true),
    enabled: Boolean(activePortfolioId),
    staleTime: 5 * 60 * 1000,
  })

  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId)
  const batch = batchQuery.data?.data as DashboardOverviewBatchData | undefined
  const metrics = batch?.metrics as DashboardOverviewMetrics | undefined
  const positions = useMemo(
    () => (batch?.positions ?? []) as PositionDTO[],
    [batch?.positions],
  )
  const displayPositions = useMemo(() => {
    const priceUpdates = batchPricesQuery.data?.prices
    if (!priceUpdates) return positions

    return positions.map((position) => {
      const update = priceUpdates.find(
        (price: BatchPriceDTO) => price.asset_id === position.asset_id,
      )
      if (!update) return position

      const marketValue =
        update.current_price !== null
          ? update.current_price * position.quantity
          : position.market_value
      const unrealizedPnl =
        marketValue !== null ? marketValue - position.cost_basis : position.unrealized_pnl

      return {
        ...position,
        current_price: update.current_price ?? position.current_price,
        market_value: marketValue,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct:
          unrealizedPnl !== null && position.cost_basis > 0
            ? (unrealizedPnl / position.cost_basis) * 100
            : position.unrealized_pnl_pct,
        daily_change_pct: update.daily_change_pct ?? position.daily_change_pct,
        last_updated: update.last_updated ?? position.last_updated,
      }
    })
  }, [batchPricesQuery.data?.prices, positions])
  const transactions = useMemo(
    () => (batch?.transactions ?? []) as DashboardOverviewTransaction[],
    [batch?.transactions],
  )
  const history = batch?.performance_history?.[period] ?? []
  const currency = activePortfolio?.base_currency || 'EUR'
  const totalGain = metrics ? calculateTotalGain(metrics) : 0
  const hasDailyChange = metrics?.daily_change_value !== null && metrics?.daily_change_value !== undefined
  const dailyChange = numberValue(metrics?.daily_change_value)
  const dailyAttribution = useMemo(
    () => (hasDailyChange ? buildDailyAttribution(displayPositions, dailyChange, 5) : []),
    [dailyChange, displayPositions, hasDailyChange],
  )
  const concentration = useMemo(
    () => calculateConcentration(displayPositions),
    [displayPositions],
  )
  const sortedPositions = useMemo(
    () =>
      [...displayPositions].sort(
        (a, b) => numberValue(b.market_value) - numberValue(a.market_value),
      ),
    [displayPositions],
  )

  const typedHistory = history as PortfolioHistoryPointDTO[]
  const latestHistoryPoint = typedHistory[typedHistory.length - 1]
  const sinceInceptionPercentage = latestHistoryPoint?.gain_pct
  const largestMove = dailyAttribution
    .filter((item) => item.key !== 'remainder')
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]
  const attributionIsLoading =
    hasDailyChange && !largestMove && batchPricesQuery.isLoading
  const attributionIsUnavailable =
    hasDailyChange && !largestMove && !batchPricesQuery.isLoading

  const exposureSource = useMemo(() => {
    switch (exposureDimension) {
      case 'theme':
        return buildExposure(
          batch?.theme_allocation as ThemeDistributionItemDTO[] | undefined,
          'theme',
        )
      case 'type':
        return buildExposure(
          batch?.asset_allocation as DistributionItemDTO[] | undefined,
          'standard',
        )
      case 'country':
        return buildExposure(
          batch?.country_allocation as DistributionItemDTO[] | undefined,
          'standard',
        )
      case 'sector':
      default:
        return buildExposure(
          batch?.sector_allocation as DistributionItemDTO[] | undefined,
          'standard',
        )
    }
  }, [batch, exposureDimension])

  const activeGoal = goalsQuery.data?.[0]
  const goalTarget = numberValue(activeGoal?.target_amount)
  const goalProgress =
    activeGoal && metrics && goalTarget > 0
      ? Math.min(100, (numberValue(metrics.total_value) / goalTarget) * 100)
      : 0

  if (portfoliosLoading || (activePortfolioId && batchQuery.isLoading)) {
    return <PageStateSkeleton label="Loading dashboard" className="dashboard-overview" />
  }

  if (!portfoliosLoading && portfolios.length === 0) {
    return (
      <PageShell className="dashboard-overview">
        <StateBlock
          eyebrow="Dashboard"
          title="Your portfolio is the beginning of this screen."
          description="Create a portfolio and record capital activity before Portfolium attempts to explain performance."
        >
          <Link to="/portfolios" className="pf-button pf-button--primary">
            Create a portfolio
          </Link>
        </StateBlock>
      </PageShell>
    )
  }

  if (batchQuery.isError || !metrics || !activePortfolio) {
    return (
      <PageShell className="dashboard-overview">
        <StateBlock
          tone="error"
          eyebrow="Dashboard"
          title="Portfolium cannot establish a reliable valuation."
          description="The existing portfolio data remains unchanged. Retry the shared dashboard request before making a financial decision."
          actionLabel="Retry valuation"
          onAction={() => batchQuery.refetch()}
        >
          <Link to="/dashboard" className="pf-button pf-button--secondary">Return to Dashboard</Link>
        </StateBlock>
      </PageShell>
    )
  }

  return (
    <PageShell className="dashboard-overview">
      <PageHeader>
        <PageTitleBlock
          kicker="Portfolio"
          title={activePortfolio.name}
          description={
            <>
              Valued {formatTimestamp(batchQuery.data?.timestamp, locale)}
              {batchQuery.data?.cached ? ' · cached valuation' : ' · current valuation'}
            </>
          }
        />
        <PageSummaryPanel
          lead={formatCurrency(metrics.total_value, currency, locale)}
          description={!hasDailyChange
            ? 'Portfolium cannot attribute today’s movement until a reliable portfolio total is available.'
            : attributionIsLoading
              ? 'Calculating which positions explain today’s movement.'
              : attributionIsUnavailable
                ? 'Position-level market movement is unavailable, so today’s change cannot be attributed reliably.'
            : largestMove
              ? `${largestMove.label} had the largest estimated effect on today’s movement.`
              : 'Today’s movement has no material position-level contributor.'}
          actions={
            <button
              type="button"
              className="pf-button pf-button--secondary"
              onClick={() => {
                void batchQuery.refetch()
                void batchPricesQuery.refetch()
              }}
              disabled={batchQuery.isRefetching || batchPricesQuery.isRefetching}
            >
              {batchQuery.isRefetching || batchPricesQuery.isRefetching
                ? 'Updating…'
                : 'Refresh'}
            </button>
          }
        />
      </PageHeader>

      <PageMetricStrip label="Portfolio performance context">
        <PageMetric
          label="Today"
          value={hasDailyChange ? signedCurrency(dailyChange, currency, locale) : '—'}
          detail={hasDailyChange ? signedPercentage(metrics.daily_change_pct) : 'Unavailable'}
          tone={hasDailyChange ? (dailyChange > 0 ? 'positive' : dailyChange < 0 ? 'negative' : 'neutral') : 'neutral'}
        />
        <PageMetric
          label="Since inception"
          value={signedCurrency(totalGain, currency, locale)}
          detail={sinceInceptionPercentage !== undefined ? signedPercentage(sinceInceptionPercentage) : undefined}
          tone={totalGain > 0 ? 'positive' : totalGain < 0 ? 'negative' : 'neutral'}
        />
        <PageMetric
          label="Realized"
          value={formatCurrency(metrics.total_realized_pnl, currency, locale)}
        />
        <PageMetric
          label="Unrealized"
          value={formatCurrency(metrics.total_unrealized_pnl, currency, locale)}
        />
      </PageMetricStrip>

      <PageControls
        label="Trajectory period"
        start={
          <PageTabs label="Trajectory period">
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
          </PageTabs>
        }
      />

      <PageMainGrid>
        <PageMainColumn>
          <PortfolioTrajectory
            points={history as PortfolioHistoryPointDTO[]}
            currency={currency}
            locale={locale}
          />
        </PageMainColumn>

        <PageAsideColumn className="dashboard-overview__attribution" aria-labelledby="what-changed-heading">
          <p className="pf-section-kicker">Cause</p>
          <h2 id="what-changed-heading" className="pf-section-title">What changed</h2>
          {hasDailyChange && !attributionIsLoading && !attributionIsUnavailable ? (
            <>
              <p className="dashboard-overview__attribution-summary">
                The portfolio {dailyChange < 0 ? 'lost' : dailyChange > 0 ? 'gained' : 'moved'}{' '}
                <strong>{formatCurrency(Math.abs(dailyChange), currency, locale)}</strong> today.
              </p>
              <ol>
                {dailyAttribution.map((item) => (
                  <li key={item.key}>
                    <span className="dashboard-overview__attribution-identity">
                      {item.key !== 'remainder' && (
                        <AssetLogo
                          symbol={item.label}
                          assetType={item.assetType}
                          assetName={item.assetName}
                          className="dashboard-overview__attribution-logo"
                          alt=""
                        />
                      )}
                      <span>
                        {item.label}
                        {item.estimated && <small>estimated</small>}
                      </span>
                    </span>
                    <strong className={valueTone(item.value)}>
                      {signedCurrency(item.value, currency, locale)}
                    </strong>
                  </li>
                ))}
              </ol>
              <div className="dashboard-overview__reconciliation">
                <span>Authoritative total</span>
                <strong className={valueTone(dailyChange)}>
                  {signedCurrency(dailyChange, currency, locale)}
                </strong>
              </div>
              <Link to="/insights">Inspect today’s movement →</Link>
            </>
          ) : attributionIsLoading ? (
            <div className="dashboard-overview__quiet-state" aria-live="polite">
              Calculating position-level attribution…
            </div>
          ) : (
            <div className="dashboard-overview__quiet-state">
              {hasDailyChange
                ? 'Position-level attribution is unavailable. The portfolio total remains authoritative.'
                : 'Daily attribution is withheld because the portfolio-level movement is unavailable.'}
            </div>
          )}
        </PageAsideColumn>
      </PageMainGrid>

      <PageSection className="dashboard-overview__return" aria-labelledby="return-heading">
        <div>
          <p className="pf-section-kicker">Reconciliation</p>
          <h2 id="return-heading" className="pf-section-title">Your return</h2>
          <p className={`dashboard-overview__return-total ${valueTone(totalGain)}`}>
            {signedCurrency(totalGain, currency, locale)} total gain
          </p>
          <p className="dashboard-overview__financial-sentence">
            Return is shown as an equation so every aggregate remains traceable.
          </p>
        </div>
        <div className="dashboard-overview__equation" aria-label="Return calculation">
          <span>
            <b>=</b> {formatCurrency(metrics.total_unrealized_pnl, currency, locale)}
            <small>unrealized</small>
          </span>
          <span>
            <b>+</b> {formatCurrency(metrics.total_realized_pnl, currency, locale)}
            <small>realized</small>
          </span>
          <span>
            <b>+</b> {formatCurrency(metrics.total_dividends, currency, locale)}
            <small>dividends</small>
          </span>
          <span>
            <b>−</b> {formatCurrency(metrics.total_fees, currency, locale)}
            <small>fees</small>
          </span>
        </div>
      </PageSection>

      <PageSection className="dashboard-overview__ledger-section" aria-labelledby="holdings-heading">
        <PageSectionHeader
          kicker="Ownership"
          title="Holdings"
          titleId="holdings-heading"
          description={`${displayPositions.length} positions ordered by the amount of your capital they control.`}
          aside={<Link to="/assets">Inspect all holdings →</Link>}
        />

        <div className="dashboard-overview__ledger-scroll">
          <table className="dashboard-overview__ledger">
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Value</th>
                <th scope="col">Portfolio</th>
                <th scope="col">Today · estimated</th>
                <th scope="col">Total return</th>
              </tr>
            </thead>
            <tbody>
              {sortedPositions.slice(0, 8).map((position) => {
                const marketValue = numberValue(position.market_value)
                const weight =
                  numberValue(metrics.total_value) > 0
                    ? (marketValue / numberValue(metrics.total_value)) * 100
                    : 0
                const dailyImpact = calculatePositionDailyImpact(position)
                const unrealized = numberValue(position.unrealized_pnl)

                return (
                  <tr key={position.asset_id}>
                    <td>
                      <Link
                        to={`/assets/${encodeURIComponent(position.symbol)}/research`}
                      >
                        <AssetLogo
                          symbol={position.symbol}
                          assetType={position.asset_type}
                          assetName={position.name}
                          className="dashboard-overview__asset-logo"
                          alt=""
                        />
                        <span className="dashboard-overview__holding-identity">
                          <strong>{position.symbol}</strong>
                          <small>{position.name || 'Unnamed asset'}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <strong>{formatCurrency(marketValue, currency, locale)}</strong>
                      <small>{formatQuantity(position.quantity)} units</small>
                    </td>
                    <td>
                      <strong>{weight.toFixed(1)}%</strong>
                      <small>of portfolio</small>
                    </td>
                    <td>
                      <strong className={valueTone(dailyImpact)}>
                        {signedCurrency(dailyImpact, currency, locale)}
                      </strong>
                      <small>{signedPercentage(position.daily_change_pct)}</small>
                    </td>
                    <td>
                      <strong className={valueTone(unrealized)}>
                        {signedCurrency(unrealized, currency, locale)}
                      </strong>
                      <small>{signedPercentage(position.unrealized_pnl_pct)}</small>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection className="dashboard-overview__exposure-section" aria-labelledby="exposure-heading">
        <PageSectionHeader
          kicker="Structure"
          title="Exposure fingerprint"
          titleId="exposure-heading"
          description="One question at a time: where your capital is actually concentrated."
        />
        <PageMainGrid>
          <PageMainColumn className="dashboard-overview__exposure-main">
            <div className="pf-tabs dashboard-overview__tabs" aria-label="Exposure dimension">
              {EXPOSURE_DIMENSIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={exposureDimension === item.key ? 'is-active' : ''}
                  aria-pressed={exposureDimension === item.key}
                  onClick={() => setExposureDimension(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <ExposureFingerprint
              exposure={exposureSource}
              dimension={exposureDimension}
              currency={currency}
              locale={locale}
            />
          </PageMainColumn>

          <PageAsideColumn className="dashboard-overview__attention" aria-labelledby="attention-heading">
            <p className="pf-section-kicker">Consequence</p>
            <h2 id="attention-heading" className="pf-section-title">What deserves attention</h2>
          {concentration.largest ? (
            <>
              <p className="dashboard-overview__attention-number">
                {concentration.topThreeWeight.toFixed(1)}%
              </p>
              <p className="dashboard-overview__financial-sentence">
                Your three largest holdings control this share of the portfolio.
              </p>
              <dl>
                <div>
                  <dt>Largest position</dt>
                  <dd>
                    {concentration.largest.symbol} · {concentration.largestWeight.toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt>If it fell 10%</dt>
                  <dd className="dashboard-overview__value--negative">
                    −{formatCurrency(
                      numberValue(concentration.largest.market_value) * 0.1,
                      currency,
                      locale,
                    )}
                  </dd>
                </div>
              </dl>
              <p className="dashboard-overview__confidence-note">
                Mechanical scenario, not a forecast. Other positions are held constant.
              </p>
            </>
          ) : (
            <div className="dashboard-overview__quiet-state">No owned positions to evaluate.</div>
          )}
          </PageAsideColumn>
        </PageMainGrid>
      </PageSection>

      {activeGoal && (
        <PageSection className="dashboard-overview__goal" aria-labelledby="goal-heading">
          <div>
            <p className="pf-section-kicker">Direction</p>
            <h2 id="goal-heading" className="pf-section-title">{activeGoal.title}</h2>
            <p className="dashboard-overview__goal-progress">{goalProgress.toFixed(1)}% funded</p>
          </div>
          <div className="dashboard-overview__goal-track" aria-label={`${goalProgress.toFixed(1)} percent funded`}>
            <span style={{ width: `${goalProgress}%` }} />
          </div>
          <div className="dashboard-overview__goal-detail">
            <p>
              {formatCurrency(metrics.total_value, currency, locale)} of{' '}
              {formatCurrency(activeGoal.target_amount, currency, locale)}
            </p>
            <p>
              {formatCurrency(
                Math.max(0, numberValue(activeGoal.target_amount) - numberValue(metrics.total_value)),
                currency,
                locale,
              )}{' '}
              remains
            </p>
            <Link to="/portfolios">Review goal →</Link>
          </div>
        </PageSection>
      )}

      <PageSection className="dashboard-overview__activity" aria-labelledby="activity-heading">
        <PageSectionHeader
          kicker="Evidence"
          title="Recent capital activity"
          titleId="activity-heading"
          description="Transactions are shown as events that changed ownership, cash, or return."
          aside={<Link to="/transactions">Open activity ledger →</Link>}
        />

        {transactions.length > 0 ? (
          <ol className="dashboard-overview__activity-list">
            {transactions.slice(0, 5).map((transaction) => {
              const { Icon, label, tone } = getTransactionVisual(transaction.type)
              return (
                <li key={transaction.id}>
                  <time dateTime={transaction.tx_date}>
                    {new Intl.DateTimeFormat(locale, {
                      day: '2-digit',
                      month: 'short',
                    }).format(new Date(transaction.tx_date))}
                  </time>
                  <span
                    className={`dashboard-overview__activity-type dashboard-overview__activity-type--${tone}`}
                  >
                    <Icon size={15} strokeWidth={2} aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                  <span className="dashboard-overview__activity-asset">
                    {transaction.asset?.symbol ? (
                      <AssetLogo
                        symbol={transaction.asset.symbol}
                        assetType={transaction.asset.asset_type}
                        assetName={transaction.asset.name}
                        className="dashboard-overview__activity-logo"
                        alt=""
                      />
                    ) : (
                      <span className="dashboard-overview__activity-cash-logo" aria-hidden="true">
                        <Wallet size={16} strokeWidth={1.8} />
                      </span>
                    )}
                    <span>
                      <strong>{transaction.asset?.symbol || 'Cash'}</strong>
                      <small>
                        {transaction.asset?.name ||
                          transaction.notes ||
                          'Portfolio activity'}
                      </small>
                    </span>
                  </span>
                  <span className="dashboard-overview__activity-amount">
                    <strong>
                      {formatCurrency(
                        calculateTransactionAmount(transaction),
                        currency,
                        locale,
                      )}
                    </strong>
                    <small>
                      {formatQuantity(transaction.quantity)} ×{' '}
                      {formatCurrency(transaction.price, currency, locale)}
                    </small>
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="dashboard-overview__quiet-state">
            No capital activity has been recorded for this portfolio.
          </div>
        )}
      </PageSection>
    </PageShell>
  )
}
