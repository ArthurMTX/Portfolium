import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
import { useDashboardBatch } from '@/features/boards/hooks/useDashboardBatch'
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

const PERIODS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All Time' },
]

function getExposureDimensions(t: TFunction): { key: ExposureDimension; label: string }[] {
  return [
    { key: 'sector', label: t('dashboardOverview.exposureDimensions.sector') },
    { key: 'theme', label: t('dashboardOverview.exposureDimensions.theme') },
    { key: 'type', label: t('dashboardOverview.exposureDimensions.type') },
    { key: 'country', label: t('dashboardOverview.exposureDimensions.country') },
  ]
}

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

function getTransactionVisual(type: string, t: TFunction): TransactionVisual {
  switch (type.toUpperCase()) {
    case 'BUY':
      return { Icon: ArrowDownToLine, label: t('dashboardOverview.transactionTypes.buy'), tone: 'buy' }
    case 'SELL':
      return { Icon: ArrowUpFromLine, label: t('dashboardOverview.transactionTypes.sell'), tone: 'sell' }
    case 'DIVIDEND':
      return { Icon: CircleDollarSign, label: t('dashboardOverview.transactionTypes.dividend'), tone: 'dividend' }
    case 'SPLIT':
      return { Icon: Shuffle, label: t('dashboardOverview.transactionTypes.split'), tone: 'split' }
    case 'FEE':
      return { Icon: ReceiptText, label: t('dashboardOverview.transactionTypes.fee'), tone: 'fee' }
    case 'TRANSFER_IN':
      return { Icon: BanknoteArrowDown, label: t('dashboardOverview.transactionTypes.transferIn'), tone: 'inflow' }
    case 'TRANSFER_OUT':
      return { Icon: ArrowUpFromLine, label: t('dashboardOverview.transactionTypes.transferOut'), tone: 'outflow' }
    case 'CONVERSION_IN':
      return { Icon: ArrowLeftRight, label: t('dashboardOverview.transactionTypes.conversionIn'), tone: 'inflow' }
    case 'CONVERSION_OUT':
      return { Icon: ArrowLeftRight, label: t('dashboardOverview.transactionTypes.conversionOut'), tone: 'outflow' }
    default:
      return { Icon: ArrowLeftRight, label: type, tone: 'neutral' }
  }
}

function formatTimestamp(value: string | undefined, locale: string, t: TFunction) {
  if (!value) return t('dashboardOverview.valuationTimeUnavailable')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return t('dashboardOverview.valuationTimeUnavailable')
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}


export default function DashboardOverview() {
  const { t } = useTranslation()
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()
  const [period, setPeriod] = useState<DashboardPeriod>('1M')
  const [exposureDimension, setExposureDimension] = useState<ExposureDimension>('sector')
  const locale = navigator.language || 'en-US'
  const exposureDimensions = useMemo(() => getExposureDimensions(t), [t])

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
    () => (hasDailyChange ? buildDailyAttribution(displayPositions, dailyChange, t, 5) : []),
    [dailyChange, displayPositions, hasDailyChange, t],
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
          t,
        )
      case 'type':
        return buildExposure(
          batch?.asset_allocation as DistributionItemDTO[] | undefined,
          'standard',
          t,
        )
      case 'country':
        return buildExposure(
          batch?.country_allocation as DistributionItemDTO[] | undefined,
          'standard',
          t,
        )
      case 'sector':
      default:
        return buildExposure(
          batch?.sector_allocation as DistributionItemDTO[] | undefined,
          'standard',
          t,
        )
    }
  }, [batch, exposureDimension, t])

  const activeGoal = goalsQuery.data?.[0]
  const goalTarget = numberValue(activeGoal?.target_amount)
  const goalProgress =
    activeGoal && metrics && goalTarget > 0
      ? Math.min(100, (numberValue(metrics.total_value) / goalTarget) * 100)
      : 0

  if (portfoliosLoading || (activePortfolioId && batchQuery.isLoading)) {
    return <PageStateSkeleton label={t('dashboardOverview.loading')} className="dashboard-overview" />
  }

  if (!portfoliosLoading && portfolios.length === 0) {
    return (
      <PageShell className="dashboard-overview">
        <StateBlock
          eyebrow={t('navigation.dashboard')}
          title={t('dashboardOverview.emptyTitle')}
          description={t('dashboardOverview.emptyDescription')}
        >
          <Link to="/portfolios" className="pf-button pf-button--primary">
            {t('dashboardOverview.createPortfolio')}
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
          eyebrow={t('navigation.dashboard')}
          title={t('dashboardOverview.errorTitle')}
          description={t('dashboardOverview.errorDescription')}
          actionLabel={t('dashboardOverview.retryValuation')}
          onAction={() => batchQuery.refetch()}
        >
          <Link to="/dashboard" className="pf-button pf-button--secondary">{t('dashboardOverview.returnToDashboard')}</Link>
        </StateBlock>
      </PageShell>
    )
  }

  return (
    <PageShell className="dashboard-overview">
      <PageHeader>
        <PageTitleBlock
          kicker={t('dashboardOverview.kickerPortfolio')}
          title={activePortfolio.name}
          description={
            <>
              {t('dashboardOverview.valuedAt', { timestamp: formatTimestamp(batchQuery.data?.timestamp, locale, t) })}
              {' · '}
              {batchQuery.data?.cached ? t('dashboardOverview.cachedValuation') : t('dashboardOverview.currentValuation')}
            </>
          }
        />
        <PageSummaryPanel
          lead={formatCurrency(metrics.total_value, currency, locale)}
          description={!hasDailyChange
            ? t('dashboardOverview.attributionUnavailableNoTotal')
            : attributionIsLoading
              ? t('dashboardOverview.attributionCalculating')
              : attributionIsUnavailable
                ? t('dashboardOverview.attributionUnavailable')
            : largestMove
              ? t('dashboardOverview.attributionLargestMove', { label: largestMove.label })
              : t('dashboardOverview.attributionNoContributor')}
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
                ? t('dashboardOverview.updating')
                : t('dashboardOverview.refresh')}
            </button>
          }
        />
      </PageHeader>

      <PageMetricStrip label={t('dashboardOverview.trajectoryPeriod')}>
        <PageMetric
          label={t('dashboardOverview.metricToday')}
          value={hasDailyChange ? signedCurrency(dailyChange, currency, locale) : '—'}
          detail={hasDailyChange ? signedPercentage(metrics.daily_change_pct) : t('dashboardOverview.metricUnavailable')}
          tone={hasDailyChange ? (dailyChange > 0 ? 'positive' : dailyChange < 0 ? 'negative' : 'neutral') : 'neutral'}
        />
        <PageMetric
          label={t('dashboardOverview.metricSinceInception')}
          value={signedCurrency(totalGain, currency, locale)}
          detail={sinceInceptionPercentage !== undefined ? signedPercentage(sinceInceptionPercentage) : undefined}
          tone={totalGain > 0 ? 'positive' : totalGain < 0 ? 'negative' : 'neutral'}
        />
        <PageMetric
          label={t('dashboardOverview.metricRealized')}
          value={formatCurrency(metrics.total_realized_pnl, currency, locale)}
        />
        <PageMetric
          label={t('dashboardOverview.metricUnrealized')}
          value={formatCurrency(metrics.total_unrealized_pnl, currency, locale)}
        />
      </PageMetricStrip>

      <PageControls
        label={t('dashboardOverview.trajectoryPeriod')}
        start={
          <PageTabs label={t('dashboardOverview.trajectoryPeriod')}>
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={period === item.value ? 'is-active' : ''}
                aria-pressed={period === item.value}
                onClick={() => setPeriod(item.value)}
              >
                {item.label}
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
          <p className="pf-section-kicker">{t('dashboardOverview.cause')}</p>
          <h2 id="what-changed-heading" className="pf-section-title">{t('dashboardOverview.whatChanged')}</h2>
          {hasDailyChange && !attributionIsLoading && !attributionIsUnavailable ? (
            <>
              <p className="dashboard-overview__attribution-summary">
                <Trans
                  i18nKey="dashboardOverview.portfolioMovedToday"
                  values={{
                    verb: dailyChange < 0 ? t('dashboardOverview.portfolioMoved.lost') : dailyChange > 0 ? t('dashboardOverview.portfolioMoved.gained') : t('dashboardOverview.portfolioMoved.moved'),
                    amount: formatCurrency(Math.abs(dailyChange), currency, locale),
                  }}
                  components={{ strong: <strong /> }}
                />
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
                        {item.estimated && <small>{t('dashboardOverview.estimated')}</small>}
                      </span>
                    </span>
                    <strong className={valueTone(item.value)}>
                      {signedCurrency(item.value, currency, locale)}
                    </strong>
                  </li>
                ))}
              </ol>
              <div className="dashboard-overview__reconciliation">
                <span>{t('dashboardOverview.authoritativeTotal')}</span>
                <strong className={valueTone(dailyChange)}>
                  {signedCurrency(dailyChange, currency, locale)}
                </strong>
              </div>
              <Link to="/insights">{t('dashboardOverview.inspectTodaysMovement')}</Link>
            </>
          ) : attributionIsLoading ? (
            <div className="dashboard-overview__quiet-state" aria-live="polite">
              {t('dashboardOverview.calculatingAttribution')}
            </div>
          ) : (
            <div className="dashboard-overview__quiet-state">
              {hasDailyChange
                ? t('dashboardOverview.attributionUnavailableAuthoritative')
                : t('dashboardOverview.attributionWithheld')}
            </div>
          )}
        </PageAsideColumn>
      </PageMainGrid>

      <PageSection className="dashboard-overview__return" aria-labelledby="return-heading">
        <div>
          <p className="pf-section-kicker">{t('dashboardOverview.reconciliation')}</p>
          <h2 id="return-heading" className="pf-section-title">{t('dashboardOverview.yourReturn')}</h2>
          <p className={`dashboard-overview__return-total ${valueTone(totalGain)}`}>
            {signedCurrency(totalGain, currency, locale)} {t('dashboardOverview.totalGain')}
          </p>
          <p className="dashboard-overview__financial-sentence">
            {t('dashboardOverview.returnEquationNote')}
          </p>
        </div>
        <div className="dashboard-overview__equation" aria-label={t('dashboardOverview.returnCalculation')}>
          <span>
            <b>=</b> {formatCurrency(metrics.total_unrealized_pnl, currency, locale)}
            <small>{t('dashboardOverview.unrealized')}</small>
          </span>
          <span>
            <b>+</b> {formatCurrency(metrics.total_realized_pnl, currency, locale)}
            <small>{t('dashboardOverview.realized')}</small>
          </span>
          <span>
            <b>+</b> {formatCurrency(metrics.total_dividends, currency, locale)}
            <small>{t('dashboardOverview.dividends')}</small>
          </span>
          <span>
            <b>−</b> {formatCurrency(metrics.total_fees, currency, locale)}
            <small>{t('dashboardOverview.fees')}</small>
          </span>
        </div>
      </PageSection>

      <PageSection className="dashboard-overview__ledger-section" aria-labelledby="holdings-heading">
        <PageSectionHeader
          kicker={t('dashboardOverview.ownership')}
          title={t('dashboardOverview.holdings')}
          titleId="holdings-heading"
          description={t('dashboardOverview.holdingsDescription', { count: displayPositions.length })}
          aside={<Link to="/assets">{t('dashboardOverview.inspectAllHoldings')}</Link>}
        />

        <div className="dashboard-overview__ledger-scroll">
          <table className="dashboard-overview__ledger">
            <thead>
              <tr>
                <th scope="col">{t('dashboardOverview.columnPosition')}</th>
                <th scope="col">{t('dashboardOverview.columnValue')}</th>
                <th scope="col">{t('dashboardOverview.columnPortfolio')}</th>
                <th scope="col">{t('dashboardOverview.columnTodayEstimated')}</th>
                <th scope="col">{t('dashboardOverview.columnTotalReturn')}</th>
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
                          <small>{position.name || t('dashboardOverview.unnamedAsset')}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <strong>{formatCurrency(marketValue, currency, locale)}</strong>
                      <small>{formatQuantity(position.quantity)} {t('dashboardOverview.units')}</small>
                    </td>
                    <td>
                      <strong>{weight.toFixed(1)}%</strong>
                      <small>{t('dashboardOverview.ofPortfolio')}</small>
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
          kicker={t('dashboardOverview.structure')}
          title={t('dashboardOverview.exposureFingerprint')}
          titleId="exposure-heading"
          description={t('dashboardOverview.exposureDescription')}
          aside={<Link to="/allocation">{t('dashboardOverview.viewAllocation')}</Link>}
        />
        <PageMainGrid>
          <PageMainColumn className="dashboard-overview__exposure-main">
            <div className="pf-tabs dashboard-overview__tabs" aria-label={t('dashboardOverview.exposureDimensionLabel')}>
              {exposureDimensions.map((item) => (
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
            <p className="pf-section-kicker">{t('dashboardOverview.consequence')}</p>
            <h2 id="attention-heading" className="pf-section-title">{t('dashboardOverview.whatDeservesAttention')}</h2>
          {concentration.largest ? (
            <>
              <p className="dashboard-overview__attention-number">
                {concentration.topThreeWeight.toFixed(1)}%
              </p>
              <p className="dashboard-overview__financial-sentence">
                {t('dashboardOverview.largestHoldingsShare')}
              </p>
              <dl>
                <div>
                  <dt>{t('dashboardOverview.largestPosition')}</dt>
                  <dd>
                    {concentration.largest.symbol} · {concentration.largestWeight.toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt>{t('dashboardOverview.ifItFell10Percent')}</dt>
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
                {t('dashboardOverview.mechanicalScenarioNote')}
              </p>
            </>
          ) : (
            <div className="dashboard-overview__quiet-state">{t('dashboardOverview.noOwnedPositions')}</div>
          )}
          </PageAsideColumn>
        </PageMainGrid>
      </PageSection>

      {activeGoal && (
        <PageSection className="dashboard-overview__goal" aria-labelledby="goal-heading">
          <div>
            <p className="pf-section-kicker">{t('dashboardOverview.direction')}</p>
            <h2 id="goal-heading" className="pf-section-title">{activeGoal.title}</h2>
            <p className="dashboard-overview__goal-progress">{goalProgress.toFixed(1)}% {t('dashboardOverview.funded')}</p>
          </div>
          <div className="dashboard-overview__goal-track" aria-label={t('dashboardOverview.percentFunded', { percent: goalProgress.toFixed(1) })}>
            <span style={{ width: `${goalProgress}%` }} />
          </div>
          <div className="dashboard-overview__goal-detail">
            <p>
              {formatCurrency(metrics.total_value, currency, locale)} {t('dashboardOverview.of')}{' '}
              {formatCurrency(activeGoal.target_amount, currency, locale)}
            </p>
            <p>
              {formatCurrency(
                Math.max(0, numberValue(activeGoal.target_amount) - numberValue(metrics.total_value)),
                currency,
                locale,
              )}{' '}
              {t('dashboardOverview.remains')}
            </p>
            <Link to="/portfolios">{t('dashboardOverview.reviewGoal')}</Link>
          </div>
        </PageSection>
      )}

      <PageSection className="dashboard-overview__activity" aria-labelledby="activity-heading">
        <PageSectionHeader
          kicker={t('dashboardOverview.evidence')}
          title={t('dashboardOverview.recentCapitalActivity')}
          titleId="activity-heading"
          description={t('dashboardOverview.activityDescription')}
          aside={<Link to="/transactions">{t('dashboardOverview.openActivityLedger')}</Link>}
        />

        {transactions.length > 0 ? (
          <ol className="dashboard-overview__activity-list">
            {transactions.slice(0, 5).map((transaction) => {
              const { Icon, label, tone } = getTransactionVisual(transaction.type, t)
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
                      <strong>{transaction.asset?.symbol || t('dashboardOverview.cash')}</strong>
                      <small>
                        {transaction.asset?.name ||
                          transaction.notes ||
                          t('dashboardOverview.portfolioActivity')}
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
            {t('dashboardOverview.noCapitalActivity')}
          </div>
        )}
      </PageSection>
    </PageShell>
  )
}
