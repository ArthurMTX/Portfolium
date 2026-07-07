import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  Check,
  CircleDollarSign,
  Plus,
  ReceiptText,
  Shuffle,
  type LucideIcon,
} from 'lucide-react'
import api, {
  type AssetInvestmentNoteDTO,
  type AssetResearchBusinessDTO,
  type AssetResearchFundamentalsDTO,
  type AssetResearchSummaryDTO,
  type AssetThemeDTO,
  type PositionDTO,
} from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import AssetInvestmentNoteModal from '@/features/assets/components/AssetInvestmentNoteModal'
import {
  buildAnalystMetrics,
  buildBalanceSheetMetrics,
  buildFundamentalsMetrics,
  buildGrowthMetrics,
  buildRelativeMetric,
  buildRiskMetrics,
  formatResearchPercent,
  type AssetResearchMetric,
} from '@/features/assets/lib/assetResearchMetricBuilders'
import {
  formatAssetType,
  formatCurrency,
  formatLargeNumber,
  formatNumber,
  formatQuantity,
  formatWithSeparators,
} from '@/shared/lib/formatUtils'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import { getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'
import { PageStateSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
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
import { useTranslation } from 'react-i18next'
import AssetResearchPriceChart from '@/features/asset-research/components/AssetResearchPriceChart'
import { useAssetResearchView } from '@/features/asset-research/hooks/useAssetResearchView'
import {
  calculatePortfolioWeight,
  calculatePositionDailyContribution,
  calculatePositionTotalReturn,
  calculatePriceChangeAmount,
  calculateTransactionAmount,
  researchNumber,
  sumTransactionType,
} from '@/features/asset-research/lib/assetResearchViewCalculations'
import type {
  AssetResearchViewTab,
  AssetResearchViewTransaction,
} from '@/features/asset-research/types'
import '@/shared/design/pages/asset-research.css'

function getTabs(t: (key: string) => string): Array<{ id: AssetResearchViewTab; label: string; object: 'asset' | 'position' }> {
  return [
    { id: 'overview', label: t('assetResearchView.tabs.overview'), object: 'asset' },
    { id: 'financials', label: t('assetResearchView.tabs.financials'), object: 'asset' },
    { id: 'valuation', label: t('assetResearchView.tabs.valuation'), object: 'asset' },
    { id: 'risk', label: t('assetResearchView.tabs.risk'), object: 'asset' },
    { id: 'position', label: t('assetResearchView.tabs.position'), object: 'position' },
  ]
}

interface TransactionVisual {
  Icon: LucideIcon
  label: string
  tone: string
}

function getTransactionVisual(type: string, t: (key: string) => string): TransactionVisual {
  switch (type.toUpperCase()) {
    case 'BUY':
      return { Icon: ArrowDownToLine, label: t('assetResearchView.transactionKinds.buy'), tone: 'positive' }
    case 'SELL':
      return { Icon: ArrowUpFromLine, label: t('assetResearchView.transactionKinds.sell'), tone: 'negative' }
    case 'DIVIDEND':
      return { Icon: CircleDollarSign, label: t('assetResearchView.transactionKinds.dividend'), tone: 'income' }
    case 'SPLIT':
      return { Icon: Shuffle, label: t('assetResearchView.transactionKinds.split'), tone: 'structure' }
    case 'FEE':
      return { Icon: ReceiptText, label: t('assetResearchView.transactionKinds.fee'), tone: 'negative' }
    case 'TRANSFER_IN':
      return { Icon: ArrowDownToLine, label: t('assetResearchView.transactionKinds.transferIn'), tone: 'positive' }
    case 'TRANSFER_OUT':
      return { Icon: ArrowUpFromLine, label: t('assetResearchView.transactionKinds.transferOut'), tone: 'negative' }
    case 'CONVERSION_IN':
      return { Icon: ArrowLeftRight, label: t('assetResearchView.transactionKinds.conversionIn'), tone: 'structure' }
    case 'CONVERSION_OUT':
      return { Icon: ArrowLeftRight, label: t('assetResearchView.transactionKinds.conversionOut'), tone: 'structure' }
    default:
      return { Icon: ArrowLeftRight, label: type, tone: 'neutral' }
  }
}

function signedCurrency(value: number, currency: string, locale: string) {
  const formatted = formatCurrency(Math.abs(value), currency, locale)
  if (value > 0) return `+${formatted}`
  if (value < 0) return `−${formatted}`
  return formatted
}

function signedPercent(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined) return '-'
  const normalized = researchNumber(value)
  if (normalized > 0) return `+${formatNumber(normalized, decimals)}%`
  if (normalized < 0) return `−${formatNumber(Math.abs(normalized), decimals)}%`
  return `${formatNumber(0, decimals)}%`
}

function gainNeededToBreakeven(position: PositionDTO) {
  if (position.unrealized_pnl === null || position.unrealized_pnl >= 0) return null
  if (position.breakeven_gain_pct !== null && position.breakeven_gain_pct !== undefined) {
    return researchNumber(position.breakeven_gain_pct)
  }
  if (!position.current_price || position.current_price <= 0 || position.avg_cost <= position.current_price) {
    return null
  }
  return ((position.avg_cost - position.current_price) / position.current_price) * 100
}

function valueTone(value: number | null | undefined) {
  const normalized = researchNumber(value)
  if (normalized > 0) return 'asset-research__value--positive'
  if (normalized < 0) return 'asset-research__value--negative'
  return 'asset-research__value--neutral'
}

function metricTone(metric: AssetResearchMetric) {
  if (metric.color?.includes('green')) return 'asset-research__value--positive'
  if (metric.color?.includes('red')) return 'asset-research__value--negative'
  if (metric.color?.includes('orange') || metric.color?.includes('amber')) {
    return 'asset-research__value--warning'
  }
  return ''
}

function hasNoteContent(note: AssetInvestmentNoteDTO | null | undefined) {
  return Boolean(
    note?.thesis ||
      note?.conviction ||
      note?.risks ||
      note?.target_price ||
      note?.target_text ||
      note?.invalidation_thesis ||
      note?.horizon ||
      note?.horizon_date,
  )
}

export default function AssetResearchView() {
  const { symbol = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const TABS = useMemo(() => getTabs(t), [t])
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<AssetResearchViewTab>('overview')
  const [noteOpen, setNoteOpen] = useState(false)
  const [localNote, setLocalNote] = useState<AssetInvestmentNoteDTO | null>(null)
  const locale = navigator.language || 'en-US'
  const research = useAssetResearchView(symbol)

  const summary = research.summaryQuery.data
  const asset = summary?.asset
  const quote = summary?.quote
  const metadata = research.metadataQuery.data ?? summary?.metadata
  const fundamentals = research.fundamentalsQuery.data
  const business = research.businessQuery.data
  const risk = research.riskQuery.data
  const relative = research.performanceQuery.data
  const themes = research.themesQuery.data?.themes ?? []
  const position = research.positionQuery.data
  const portfolioMetrics = research.portfolioMetricsQuery.data
  const transactions = research.transactionsQuery.data ?? []
  const activePortfolio = research.activePortfolio
  const note = localNote ?? research.noteQuery.data ?? null

  useEffect(() => {
    setActiveTab('overview')
    setLocalNote(null)
  }, [asset?.id])

  useEffect(() => {
    if (research.noteQuery.data !== undefined) {
      setLocalNote(research.noteQuery.data)
    }
  }, [research.noteQuery.data])

  const addToWatchlistMutation = useMutation({
    mutationFn: () => api.addToWatchlist({ symbol: research.normalizedSymbol }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['watchlist-item-by-asset', asset?.id],
      })
    },
  })

  const quoteCurrency =
    metadata?.asset_currency || quote?.currency || asset?.currency || 'USD'
  const currentPrice = quote ? researchNumber(quote.price) : null
  const dailyPercentage =
    quote?.daily_change_pct === null || quote?.daily_change_pct === undefined
      ? null
      : researchNumber(quote.daily_change_pct)
  const dailyAmount = calculatePriceChangeAmount(quote?.price, quote?.daily_change_pct)
  const portfolioWeight = calculatePortfolioWeight(position, portfolioMetrics?.total_value)
  const totalReturn = calculatePositionTotalReturn(position)
  const dailyContribution = calculatePositionDailyContribution(position)
  const hasTransactions = transactions.length > 0
  const hasRelationship = Boolean(position || hasTransactions)
  const ownsAsset = Boolean(position && position.quantity > 0)
  const dividends = sumTransactionType(transactions, 'DIVIDEND')
  const dividendCount = transactions.filter((transaction) => transaction.type === 'DIVIDEND').length
  const portfolioCurrency = position?.currency || activePortfolio?.base_currency || 'EUR'
  const partialFailures = [
    research.fundamentalsQuery.isError ? t('assetResearchView.partialFailures.fundamentals') : null,
    research.businessQuery.isError ? t('assetResearchView.partialFailures.businessProfile') : null,
    research.themesQuery.isError ? t('assetResearchView.partialFailures.themeClassification') : null,
    research.riskQuery.isError ? t('assetResearchView.partialFailures.riskEvidence') : null,
    research.performanceQuery.isError ? t('assetResearchView.partialFailures.relativePerformance') : null,
    research.metadataQuery.isError ? t('assetResearchView.partialFailures.marketMetadata') : null,
    research.positionQuery.isError ? t('assetResearchView.partialFailures.positionRelationship') : null,
    research.transactionsQuery.isError ? t('assetResearchView.partialFailures.transactionHistory') : null,
  ].filter((item): item is string => item !== null)

  const financialGroups = useMemo(() => {
    if (!fundamentals) return null
    return {
      fundamentals: buildFundamentalsMetrics(fundamentals, quoteCurrency, t),
      growth: buildGrowthMetrics(fundamentals, t),
      balanceSheet: buildBalanceSheetMetrics(fundamentals, quoteCurrency, t),
      analyst: buildAnalystMetrics(fundamentals, quoteCurrency, t),
    }
  }, [fundamentals, quoteCurrency, t])

  const riskMetrics = useMemo(
    () => (risk ? buildRiskMetrics(risk, t) : []),
    [risk, t],
  )

  const relativeMetrics = useMemo(() => {
    if (!relative || !asset) return []
    return [
      buildRelativeMetric(
        '1M',
        relative.relative_perf_30d,
        relative.asset_perf_30d,
        relative.etf_perf_30d,
        asset.symbol,
        relative.sector_etf,
      ),
      buildRelativeMetric(
        '3M',
        relative.relative_perf_90d,
        relative.asset_perf_90d,
        relative.etf_perf_90d,
        asset.symbol,
        relative.sector_etf,
      ),
      buildRelativeMetric(
        'YTD',
        relative.relative_perf_ytd,
        relative.asset_perf_ytd,
        relative.etf_perf_ytd,
        asset.symbol,
        relative.sector_etf,
      ),
      buildRelativeMetric(
        '1Y',
        relative.relative_perf_1y,
        relative.asset_perf_1y,
        relative.etf_perf_1y,
        asset.symbol,
        relative.sector_etf,
      ),
    ].filter((metric): metric is AssetResearchMetric => metric !== null)
  }, [asset, relative])

  if (research.summaryQuery.isLoading) {
    return <AssetResearchViewSkeleton />
  }

  if (research.summaryQuery.isError || !summary || !asset) {
    return (
      <PageShell className="asset-research">
        <StateBlock
          tone="error"
          className="asset-research__error"
          eyebrow={t('assetResearchView.errorEyebrow')}
          title={t('assetResearchView.errorTitle')}
          description={t('assetResearchView.errorDescription')}
          actionLabel={t('assetResearchView.retryResearch')}
          onAction={() => research.summaryQuery.refetch()}
        />
      </PageShell>
    )
  }

  const countryFlag = getFlagUrl(asset.country, 'w40')
  const marketState =
    research.marketStatusQuery.data?.market_status || t('assetResearchView.marketStateUnavailable')
  const quoteTimestamp = quote?.asof
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(quote.asof))
    : t('assetResearchView.quoteTimeUnavailable')

  return (
    <PageShell className="asset-research">
      <div className="asset-research__topline">
        <button type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} aria-hidden="true" />
          {t('assetResearchView.back')}
        </button>
      </div>

      <PageHeader>
        <PageTitleBlock kicker={t('assetResearchView.kicker')}>
          <div className="asset-research__identity">
            <AssetLogo
              symbol={asset.symbol}
              assetType={asset.asset_type}
              assetName={asset.name}
              logoLightUrl={asset.logo_light_url}
              logoDarkUrl={asset.logo_dark_url}
              logoUrl={asset.logo_url}
              className="asset-research__logo"
              alt=""
            />
            <div>
              <h1 className="pf-page-title pf-page-title--hero">{asset.name || asset.symbol}</h1>
              <p>
                <strong>{asset.symbol}</strong>
                {asset.isin && (
                  <>
                    <span>·</span>
                    <span>{asset.isin}</span>
                  </>
                )}
                <span>·</span>
                <span>{formatAssetType(asset.asset_type || asset.class)}</span>
                {asset.country && (
                  <>
                    <span>·</span>
                    <span className="asset-research__country">
                      {countryFlag && <img src={countryFlag} alt="" />}
                      {asset.country}
                    </span>
                  </>
                )}
                <span>·</span>
                <span>{quoteCurrency}</span>
              </p>
            </div>
          </div>
        </PageTitleBlock>

        <PageSummaryPanel
          lead={currentPrice === null
            ? t('assetResearchView.priceUnavailable')
            : formatCurrency(currentPrice, quoteCurrency, locale)}
          description={
            <>
              {dailyPercentage !== null && dailyAmount !== null ? (
                <span className={`asset-research__daily ${valueTone(dailyAmount)}`}>
                  {dailyAmount < 0 ? t('assetResearchView.down') : dailyAmount > 0 ? t('assetResearchView.up') : t('assetResearchView.unchanged')}{' '}
                  {formatCurrency(Math.abs(dailyAmount), quoteCurrency, locale)} ·{' '}
                  {formatResearchPercent(dailyPercentage)} {t('assetResearchView.today')}
                </span>
              ) : (
                <span className="asset-research__daily asset-research__value--neutral">
                  {t('assetResearchView.dailyMovementUnavailable')}
                </span>
              )}
              <span className="asset-research__market-state">
                {t('assetResearchView.quoteObserved', { timestamp: quoteTimestamp, marketState })}
              </span>
            </>
          }
          actions={
            <div className="pf-page-actions asset-research__hero-actions">
              <button
                type="button"
                onClick={() => addToWatchlistMutation.mutate()}
                disabled={
                  research.watchlistQuery.isLoading ||
                  Boolean(research.watchlistQuery.data) ||
                  addToWatchlistMutation.isPending
                }
              >
                {research.watchlistQuery.data ? <Check size={15} /> : <Plus size={15} />}
                {research.watchlistQuery.data
                  ? t('assetResearchView.inWatchlist')
                  : addToWatchlistMutation.isPending
                    ? t('assetResearchView.adding')
                    : t('assetResearchView.addToWatchlist')}
              </button>
              <Link to={`/transactions?symbol=${encodeURIComponent(asset.symbol)}`}>
                {t('assetResearchView.recordTransaction')}
              </Link>
            </div>
          }
        >
          {addToWatchlistMutation.isError && (
            <p className="asset-research__action-error" role="alert">
              {t('assetResearchView.watchlistUpdateError')}
            </p>
          )}
        </PageSummaryPanel>
      </PageHeader>

      <section
        className={`asset-research__relationship ${
          hasRelationship ? '' : 'asset-research__relationship--empty'
        }`}
        aria-labelledby="relationship-heading"
      >
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.myRelationship')}</p>
          <h2 id="relationship-heading">
            {ownsAsset
              ? t('assetResearchView.youOwn', { amount: formatCurrency(position?.market_value ?? 0, portfolioCurrency, locale), symbol: asset.symbol })
              : hasTransactions
                ? t('assetResearchView.haveHistoricalActivity', { symbol: asset.symbol })
                : t('assetResearchView.doNotOwn')}
          </h2>
          {ownsAsset && position ? (
            <>
              <p className="asset-research__relationship-equation">
                = {t('assetResearchView.sharesOf', { quantity: formatQuantity(position.quantity) })}
                {portfolioWeight !== null
                  ? t('assetResearchView.percentOfPortfolio', { percent: portfolioWeight.toFixed(1), portfolio: activePortfolio?.name || t('assetResearchView.yourPortfolio') })
                  : ''}
              </p>
              {totalReturn !== null && (
                <p className={valueTone(totalReturn)}>
                  {t('assetResearchView.lifetimePnlSinceFirstBuy', { amount: signedCurrency(totalReturn, portfolioCurrency, locale) })}
                </p>
              )}
            </>
          ) : !hasTransactions ? (
            <p>
              {t('assetResearchView.addToWatchlistOrRecord')}
            </p>
          ) : (
            <p>
              {t('assetResearchView.positionClosedHistory')}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setActiveTab('position')}>
          {hasRelationship ? t('assetResearchView.inspectMyPosition') : t('assetResearchView.reviewRelationship')}
        </button>
      </section>

      <PageMetricStrip label={t('assetResearchView.positionContext')}>
        <PageMetric
          label={t('assetResearchView.positionValue')}
          value={position ? formatCurrency(position.market_value ?? 0, portfolioCurrency, locale) : '—'}
        />
        <PageMetric
          label={t('assetResearchView.portfolioWeight')}
          value={portfolioWeight !== null ? `${portfolioWeight.toFixed(1)}%` : '—'}
          detail={activePortfolio?.name ? t('assetResearchView.ofPortfolioName', { name: activePortfolio.name }) : undefined}
        />
        <PageMetric
          label={t('assetResearchView.lifetimePnl')}
          value={totalReturn !== null ? signedCurrency(totalReturn, portfolioCurrency, locale) : '—'}
          tone={totalReturn !== null ? (totalReturn > 0 ? 'positive' : totalReturn < 0 ? 'negative' : 'neutral') : 'neutral'}
        />
        <PageMetric
          label={t('assetResearchView.classification')}
          value={asset.sector || formatAssetType(asset.asset_type || asset.class)}
          detail={asset.industry || undefined}
        />
      </PageMetricStrip>

      <PageControls
        label={t('assetResearchView.sectionsLabel')}
        start={
          <PageTabs className="asset-research__tabs" label={t('assetResearchView.sectionsLabel')}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`${activeTab === tab.id ? 'is-active' : ''} ${
                  tab.object === 'position' ? 'is-position' : ''
                }`}
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </PageTabs>
        }
      />

      <PageMainGrid single>
      <PageMainColumn className="asset-research__content">
        {partialFailures.length > 0 && (
          <div className="asset-research__partial-error" role="status">
            {t('assetResearchView.partialFailuresNotice', { items: partialFailures.join(', ') })}
          </div>
        )}
        {activeTab === 'overview' && (
          <OverviewSection
            asset={asset}
            business={business}
            fundamentals={fundamentals}
            currency={quoteCurrency}
            themes={themes}
            themesLoading={research.themesQuery.isLoading}
            loading={
              research.businessQuery.isLoading ||
              research.fundamentalsQuery.isLoading ||
              research.themesQuery.isLoading
            }
          >
            <AssetResearchPriceChart
              assetId={asset.id}
              symbol={asset.symbol}
              currency={quoteCurrency}
              locale={locale}
              portfolioId={research.activePortfolioId}
              transactions={transactions}
              currentAverageCost={position?.avg_cost ?? null}
              currentAverageCostCurrency={position?.currency ?? null}
            />
          </OverviewSection>
        )}

        {activeTab === 'financials' && (
          <div className="asset-research__question-stack">
            <EvidenceQuestion
              eyebrow={t('assetResearchView.financialQuality')}
              title={t('assetResearchView.isBusinessGrowingProfitably')}
              metrics={financialGroups?.growth ?? []}
              loading={research.fundamentalsQuery.isLoading}
            />
            <EvidenceQuestion
              eyebrow={t('assetResearchView.balanceSheet')}
              title={t('assetResearchView.canFinanceObligations')}
              metrics={financialGroups?.balanceSheet ?? []}
              loading={research.fundamentalsQuery.isLoading}
            />
            <EvidenceQuestion
              eyebrow={t('assetResearchView.marketScale')}
              title={t('assetResearchView.howLargeAndLiquid')}
              metrics={financialGroups?.fundamentals ?? []}
              loading={research.fundamentalsQuery.isLoading}
            />
          </div>
        )}

        {activeTab === 'valuation' && (
          <div className="asset-research__question-stack">
            <EvidenceQuestion
              eyebrow={t('assetResearchView.observedValuation')}
              title={t('assetResearchView.whatMarketPayingFor')}
              metrics={(financialGroups?.fundamentals ?? []).filter((metric) =>
                ['P/E Ratio', 'EPS', 'Market Cap'].includes(metric.label),
              )}
              loading={research.fundamentalsQuery.isLoading}
            />
            <EvidenceQuestion
              eyebrow={t('assetResearchView.analystEstimate')}
              title={t('assetResearchView.whatMarketExpects')}
              metrics={financialGroups?.analyst ?? []}
              loading={research.fundamentalsQuery.isLoading}
            />
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="asset-research__question-stack">
            <EvidenceQuestion
              eyebrow={t('assetResearchView.marketRisk')}
              title={t('assetResearchView.howUnstable')}
              metrics={riskMetrics}
              loading={research.riskQuery.isLoading}
            />
            <EvidenceQuestion
              eyebrow={t('assetResearchView.relativeEvidence')}
              title={t('assetResearchView.behavedAgainstSector', { symbol: asset.symbol })}
              metrics={relativeMetrics}
              loading={research.performanceQuery.isLoading}
            />
          </div>
        )}

        {activeTab === 'position' && (
          <MyPositionSection
            asset={asset}
            position={position}
            portfolioName={activePortfolio?.name}
            portfolioCurrency={portfolioCurrency}
            portfolioWeight={portfolioWeight}
            totalReturn={totalReturn}
            dailyContribution={dailyContribution}
            transactions={transactions}
            dividends={dividends}
            dividendCount={dividendCount}
            note={note}
            loading={
              research.positionQuery.isLoading ||
              research.transactionsQuery.isLoading ||
              research.noteQuery.isLoading
            }
            locale={locale}
            onEditNote={() => setNoteOpen(true)}
            onRecordTransaction={() =>
              navigate(`/transactions?symbol=${encodeURIComponent(asset.symbol)}`)
            }
          />
        )}
      </PageMainColumn>
      </PageMainGrid>

      <AssetInvestmentNoteModal
        assetId={asset.id}
        symbol={asset.symbol}
        note={note}
        isOpen={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSaved={(savedNote) => {
          setLocalNote(savedNote)
          setNoteOpen(false)
        }}
      />
    </PageShell>
  )
}

function OverviewSection({
  asset,
  business,
  fundamentals,
  currency,
  themes,
  themesLoading,
  loading,
  children,
}: {
  asset: AssetResearchSummaryDTO['asset']
  business?: AssetResearchBusinessDTO
  fundamentals?: AssetResearchFundamentalsDTO
  currency: string
  themes: AssetThemeDTO[]
  themesLoading: boolean
  loading: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="pf-main-grid asset-research__overview-grid">
      <div className="pf-main-col asset-research__overview-main">
        <section aria-labelledby="known-heading">
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.whatIsKnown')}</p>
          <h2 id="known-heading">{t('assetResearchView.whatIsThisAsset')}</h2>
          {loading && !business?.description ? (
            <EvidenceSkeleton rows={4} />
          ) : (
            <>
              <p className="asset-research__narrative">
                {business?.description ||
                  t('assetResearchView.classifiedAsDescription', {
                    name: asset.name || asset.symbol,
                    type: formatAssetType(asset.asset_type || asset.class),
                    sectorSuffix: asset.sector ? t('assetResearchView.inSector', { sector: asset.sector }) : '',
                  })}
              </p>
              <dl className="asset-research__asset-facts">
                <div>
                  <dt>{t('assetResearchView.founded')}</dt>
                  <dd>{business?.founded || t('assetResearchView.unknown')}</dd>
                </div>
                <div>
                  <dt>{t('assetResearchView.employees')}</dt>
                  <dd>
                    {business?.employees ? formatWithSeparators(business.employees) : t('assetResearchView.unknown')}
                  </dd>
                </div>
                <div>
                  <dt>{t('assetResearchView.headquarters')}</dt>
                  <dd>{business?.headquarters || t('assetResearchView.unknown')}</dd>
                </div>
                <div>
                  <dt>{t('assetResearchView.isin')}</dt>
                  <dd>{asset.isin || t('assetResearchView.unknown')}</dd>
                </div>
              </dl>
            </>
          )}
        </section>

        <div className="asset-research__evidence-grid">
          <EvidenceValue
            label={t('assetResearchView.marketCapitalisation')}
            value={
              fundamentals?.market_cap
                ? `${formatLargeNumber(fundamentals.market_cap, 2)} ${currency}`
                : t('assetResearchView.unavailable')
            }
          />
          <EvidenceValue
            label={t('assetResearchView.revenueGrowth')}
            value={
              fundamentals?.revenue_growth !== null &&
              fundamentals?.revenue_growth !== undefined
                ? formatResearchPercent(fundamentals.revenue_growth * 100)
                : t('assetResearchView.unavailable')
            }
            tone={valueTone(fundamentals?.revenue_growth)}
          />
          <EvidenceValue
            label={t('assetResearchView.netMargin')}
            value={
              fundamentals?.profit_margins !== null &&
              fundamentals?.profit_margins !== undefined
                ? formatResearchPercent(fundamentals.profit_margins * 100)
                : t('assetResearchView.unavailable')
            }
          />
          <EvidenceValue
            label={t('assetResearchView.peRatio')}
            value={
              fundamentals?.pe_ratio !== null && fundamentals?.pe_ratio !== undefined
                ? `${formatNumber(fundamentals.pe_ratio, 1)}×`
                : t('assetResearchView.unavailable')
            }
          />
          <EvidenceValue
            label={t('assetResearchView.analystTarget')}
            value={formatCurrency(fundamentals?.target_mean ?? null, currency)}
          />
          <EvidenceValue
            label={t('assetResearchView.impliedUpside')}
            value={
              fundamentals?.implied_upside_pct !== null &&
              fundamentals?.implied_upside_pct !== undefined
                ? formatResearchPercent(fundamentals.implied_upside_pct)
                : t('assetResearchView.unavailable')
            }
          />
        </div>

        {children}
      </div>

      <aside className="pf-aside-col asset-research__overview-context">
        <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.inferredClassification')}</p>
        <h2>{t('assetResearchView.howClassified')}</h2>
        {asset.sector && (
          <ClassificationLine kind="sector" label={asset.sector} />
        )}
        {asset.industry && <ClassificationLine kind="industry" label={asset.industry} />}
        {themesLoading && themes.length === 0 && (
          <StateBlock
            tone="info"
            title={t('assetResearchView.classificationLoading')}
            description={t('assetResearchView.classificationLoadingDescription')}
            className="mt-3"
          />
        )}
        {themes.length > 0 && <ThemeClassificationTree themes={themes} />}
        {!themesLoading && !asset.sector && !asset.industry && themes.length === 0 && (
          <div className="asset-research__quiet-state">
            {t('assetResearchView.classificationUnknown')}
          </div>
        )}
      </aside>
    </div>
  )
}

function EvidenceQuestion({
  eyebrow,
  title,
  metrics,
  loading,
  confidence,
}: {
  eyebrow: string
  title: string
  metrics: AssetResearchMetric[]
  loading: boolean
  confidence?: string
}) {
  const { t } = useTranslation()
  return (
    <section className="asset-research__evidence-question">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {confidence && <span>{confidence}</span>}
      </div>
      {loading ? (
        <EvidenceSkeleton rows={4} />
      ) : metrics.length > 0 ? (
        <dl className="asset-research__metric-ledger">
          {metrics.map((metric) => (
            <div key={`${eyebrow}-${metric.label}`}>
              <dt>
                {metric.label}
                {metric.subtitle && <small>{metric.subtitle}</small>}
              </dt>
              <dd className={metricTone(metric)}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="asset-research__quiet-state">
          {t('assetResearchView.evidenceNotAvailable')}
        </div>
      )}
    </section>
  )
}

function MyPositionSection({
  asset,
  position,
  portfolioName,
  portfolioCurrency,
  portfolioWeight,
  totalReturn,
  dailyContribution,
  transactions,
  dividends,
  dividendCount,
  note,
  loading,
  locale,
  onEditNote,
  onRecordTransaction,
}: {
  asset: AssetResearchSummaryDTO['asset']
  position: PositionDTO | null | undefined
  portfolioName?: string
  portfolioCurrency: string
  portfolioWeight: number | null
  totalReturn: number | null
  dailyContribution: number | null
  transactions: AssetResearchViewTransaction[]
  dividends: number
  dividendCount: number
  note: AssetInvestmentNoteDTO | null
  loading: boolean
  locale: string
  onEditNote: () => void
  onRecordTransaction: () => void
}) {
  const { t } = useTranslation()
  if (loading) return <EvidenceSkeleton rows={10} />

  const hasRelationship = Boolean(position || transactions.length > 0)
  if (!hasRelationship) {
    return (
      <section className="asset-research__position-empty">
        <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.myPosition')}</p>
        <h2>{t('assetResearchView.doNotOwnTitle')}</h2>
        <p>
          {t('assetResearchView.addToWatchlistOrRecord')}
        </p>
        <button type="button" onClick={onRecordTransaction}>
          {t('assetResearchView.recordATransaction')}
        </button>
      </section>
    )
  }

  const breakevenGain = position ? gainNeededToBreakeven(position) : null
  const dividendCurrenciesMatchPortfolio =
    dividendCount > 0 &&
    transactions
      .filter((transaction) => transaction.type === 'DIVIDEND')
      .every(
        (transaction) =>
          transaction.currency.toUpperCase() === portfolioCurrency.toUpperCase(),
      )
  const hasRealizedHistory = Boolean(
    position &&
      (position.realized_quantity > 0 ||
        position.realized_sell_count > 0 ||
        position.realized_sale_proceeds > 0 ||
        position.realized_cost_basis > 0),
  )

  return (
    <div className="asset-research__position">
      <section className="asset-research__position-hero">
        <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.personalCapital')}</p>
        <h2>{t('assetResearchView.howHasAffectedMe', { symbol: asset.symbol })}</h2>
        {position?.quantity && position.quantity > 0 ? (
          <>
            <p className="asset-research__position-value">
              {formatCurrency(position.market_value, portfolioCurrency, locale)}
            </p>
            <p>
              {t('assetResearchView.sharesOf', { quantity: formatQuantity(position.quantity) })}
              {portfolioWeight !== null
                ? t('assetResearchView.percentOfPortfolioValue', { percent: portfolioWeight.toFixed(1), portfolio: portfolioName || t('assetResearchView.portfolioValueFallback') })
                : ''}
            </p>
            {position.unrealized_pnl !== null && (
              <p className={`asset-research__financial-sentence ${valueTone(position.unrealized_pnl)}`}>
                {signedCurrency(position.unrealized_pnl, portfolioCurrency, locale)}
                {' · '}
                {t('assetResearchView.unrealizedOnHoldings', { percent: signedPercent(position.unrealized_pnl_pct) })}
              </p>
            )}
          </>
        ) : (
          <p className="asset-research__financial-sentence">
            {t('assetResearchView.positionClosedFinancial')}
          </p>
        )}
      </section>

      {position && (
        <section className="asset-research__position-equation">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.returnEquation')}</p>
            <h2>
              {totalReturn === null
                ? t('assetResearchView.lifetimePnlUnavailable')
                : t('assetResearchView.lifetimePnlSuffix', { amount: signedCurrency(totalReturn, portfolioCurrency, locale) })}
            </h2>
          </div>
          <div className="asset-research__equation">
            {position.quantity > 0 && (
              <span>
                <b>=</b>
                <strong className={valueTone(position.unrealized_pnl)}>
                  {position.unrealized_pnl === null
                    ? '-'
                    : signedCurrency(position.unrealized_pnl, portfolioCurrency, locale)}
                </strong>
                <small>{t('assetResearchView.unrealizedSuffix', { percent: signedPercent(position.unrealized_pnl_pct) })}</small>
              </span>
            )}
            <span>
              <b>{position.quantity > 0 ? '+' : '='}</b>
              <strong className={valueTone(position.realized_pnl)}>
                {signedCurrency(position.realized_pnl, portfolioCurrency, locale)}
              </strong>
              <small>
                {position.realized_pnl_percent !== null
                  ? t('assetResearchView.realizedSuffix', { percent: signedPercent(position.realized_pnl_percent) })
                  : t('assetResearchView.realized')}
              </small>
            </span>
            {dividendCount > 0 && dividendCurrenciesMatchPortfolio && (
              <span>
                <b>+</b>
                <strong>{formatCurrency(dividends, portfolioCurrency, locale)}</strong>
                <small>{t('assetResearchView.dividendTransactions', { count: dividendCount })}</small>
              </span>
            )}
          </div>
          {position.realized_fees > 0 && (
            <p className="asset-research__confidence-note">
              {t('assetResearchView.realizedNetOfFees', { amount: formatCurrency(position.realized_fees, portfolioCurrency, locale) })}
            </p>
          )}
          {dividendCount > 0 && (
            <p className="asset-research__confidence-note">
              {dividendCurrenciesMatchPortfolio
                ? t('assetResearchView.dividendRecordedTotaling', { dividendLine: t('assetResearchView.dividendTransactions', { count: dividendCount }), amount: formatCurrency(dividends, portfolioCurrency, locale) })
                : t('assetResearchView.dividendRecordedDiffer', { dividendLine: t('assetResearchView.dividendTransactions', { count: dividendCount }) })}
            </p>
          )}
        </section>
      )}

      {position && (
        <section className="asset-research__position-anatomy">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.costAndBreakeven')}</p>
            <h2>{t('assetResearchView.whatPriceRelationship')}</h2>
          </div>
          <dl className="asset-research__position-ledger">
            <div>
              <dt>{t('assetResearchView.quantityOwned')}</dt>
              <dd>{formatQuantity(position.quantity)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.averageCost')}</dt>
              <dd>{formatCurrency(position.avg_cost, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.currentPrice')}</dt>
              <dd>{formatCurrency(position.current_price, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.costBasis')}</dt>
              <dd>{formatCurrency(position.cost_basis, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>{t('assetResearchView.marketValue')}</dt>
              <dd>{formatCurrency(position.market_value, portfolioCurrency, locale)}</dd>
            </div>
            {position.unrealized_pnl !== null && (
              <div>
                <dt>
                  {t('assetResearchView.unrealizedPnl')}
                  <small>{t('assetResearchView.openPositionOnly')}</small>
                </dt>
                <dd className={valueTone(position.unrealized_pnl)}>
                  {signedCurrency(position.unrealized_pnl, portfolioCurrency, locale)}
                  <small>{signedPercent(position.unrealized_pnl_pct)}</small>
                </dd>
              </div>
            )}
            {breakevenGain !== null && (
              <div>
                <dt>
                  {t('assetResearchView.gainNeededBreakeven')}
                  <small>{t('assetResearchView.shownOnlyNegative')}</small>
                </dt>
                <dd className="asset-research__value--warning">
                  +{formatNumber(breakevenGain, 2)}%
                  {position.breakeven_target_price !== null &&
                    position.breakeven_target_price !== undefined && (
                      <small>
                        {t('assetResearchView.atPrice', { price: formatCurrency(position.breakeven_target_price, portfolioCurrency, locale) })}
                      </small>
                    )}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {position && hasRealizedHistory && (
        <section className="asset-research__position-anatomy">
          <div>
            <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.realizedHistory')}</p>
            <h2>{t('assetResearchView.whatCrystallized')}</h2>
          </div>
          <dl className="asset-research__position-ledger">
            <div>
              <dt>{t('assetResearchView.quantitySold')}</dt>
              <dd>{formatQuantity(position.realized_quantity)}</dd>
            </div>
            {position.average_sell_price !== null && (
              <div>
                <dt>{t('assetResearchView.averageSellPrice')}</dt>
                <dd>{formatCurrency(position.average_sell_price, portfolioCurrency, locale)}</dd>
              </div>
            )}
            {position.realized_sale_proceeds > 0 && (
              <div>
                <dt>{t('assetResearchView.saleProceeds')}</dt>
                <dd>{formatCurrency(position.realized_sale_proceeds, portfolioCurrency, locale)}</dd>
              </div>
            )}
            {position.realized_cost_basis > 0 && (
              <div>
                <dt>{t('assetResearchView.costBasisSold')}</dt>
                <dd>{formatCurrency(position.realized_cost_basis, portfolioCurrency, locale)}</dd>
              </div>
            )}
            <div>
              <dt>{t('assetResearchView.realizedPnl')}</dt>
              <dd className={valueTone(position.realized_pnl)}>
                {signedCurrency(position.realized_pnl, portfolioCurrency, locale)}
                {position.realized_pnl_percent !== null && (
                  <small>{signedPercent(position.realized_pnl_percent)}</small>
                )}
              </dd>
            </div>
            {position.realized_fees > 0 && (
              <div>
                <dt>{t('assetResearchView.realizedFees')}</dt>
                <dd>{formatCurrency(position.realized_fees, portfolioCurrency, locale)}</dd>
              </div>
            )}
            {position.realized_sell_count > 0 && (
              <div>
                <dt>{t('assetResearchView.sellTransactions')}</dt>
                <dd>{formatWithSeparators(position.realized_sell_count)}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section className="asset-research__position-consequence">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.portfolioConsequence')}</p>
          <h2>{t('assetResearchView.whatContribute')}</h2>
        </div>
        <dl>
          {position?.market_value !== null && position?.market_value !== undefined && (
            <div>
              <dt>{t('assetResearchView.unknownSectorExposure', { sector: asset.sector || t('assetResearchView.unknownSector') })}</dt>
              <dd>{formatCurrency(position.market_value, portfolioCurrency, locale)}</dd>
            </div>
          )}
          {portfolioWeight !== null && (
            <div>
              <dt>{t('assetResearchView.concentrationContribution')}</dt>
              <dd>{t('assetResearchView.percentOfPortfolioValueDd', { percent: portfolioWeight.toFixed(1) })}</dd>
            </div>
          )}
          {dailyContribution !== null && (
            <div>
              <dt>{t('assetResearchView.estimatedEffectToday')}</dt>
              <dd className={valueTone(dailyContribution)}>
                {signedCurrency(dailyContribution, portfolioCurrency, locale)}
              </dd>
            </div>
          )}
          {position?.vol_contribution_pct !== null &&
            position?.vol_contribution_pct !== undefined && (
              <div>
                <dt>{t('assetResearchView.volatilityContribution')}</dt>
                <dd>{formatResearchPercent(position.vol_contribution_pct)}</dd>
              </div>
            )}
        </dl>
      </section>

      <PositionNote note={note} currency={portfolioCurrency} onEdit={onEditNote} />
      <PositionTransactions
        transactions={transactions}
        locale={locale}
        fallbackCurrency={portfolioCurrency}
        onRecordTransaction={onRecordTransaction}
      />
    </div>
  )
}

function PositionNote({
  note,
  currency,
  onEdit,
}: {
  note: AssetInvestmentNoteDTO | null
  currency: string
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const hasContent = hasNoteContent(note)
  return (
    <section className="asset-research__note">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.investmentRecord')}</p>
          <h2>{t('assetResearchView.myThesis')}</h2>
          <p>
            {t('assetResearchView.personalReasoningNote')}
          </p>
        </div>
        <button type="button" onClick={onEdit}>
          {hasContent ? t('assetResearchView.editThesis') : t('assetResearchView.addThesis')}
        </button>
      </div>
      {hasContent ? (
        <dl>
          {note?.thesis && (
            <div>
              <dt>{t('assetResearchView.whyIOwnIt')}</dt>
              <dd>{note.thesis}</dd>
            </div>
          )}
          {note?.risks && (
            <div>
              <dt>{t('assetResearchView.risksIAccept')}</dt>
              <dd>{note.risks}</dd>
            </div>
          )}
          {note?.invalidation_thesis && (
            <div>
              <dt>{t('assetResearchView.whatInvalidates')}</dt>
              <dd>{note.invalidation_thesis}</dd>
            </div>
          )}
          {(note?.target_price || note?.target_text) && (
            <div>
              <dt>{t('assetResearchView.target')}</dt>
              <dd>
                {[
                  note.target_price
                    ? formatCurrency(note.target_price, currency)
                    : null,
                  note.target_text,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="asset-research__quiet-state">
          {t('assetResearchView.noThesisRecorded')}
        </div>
      )}
    </section>
  )
}

function PositionTransactions({
  transactions,
  locale,
  fallbackCurrency,
  onRecordTransaction,
}: {
  transactions: AssetResearchViewTransaction[]
  locale: string
  fallbackCurrency: string
  onRecordTransaction: () => void
}) {
  const { t } = useTranslation()
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.tx_date).getTime() - new Date(a.tx_date).getTime(),
  )
  return (
    <section className="asset-research__transactions">
      <div className="pf-section-header asset-research__section-heading">
        <div>
          <p className="pf-section-kicker asset-research__section-label">{t('assetResearchView.ownershipHistory')}</p>
          <h2>{t('assetResearchView.transactions')}</h2>
        </div>
        <button type="button" onClick={onRecordTransaction}>
          {t('assetResearchView.recordTransaction')}
        </button>
      </div>
      {sorted.length > 0 ? (
        <div className="asset-research__ledger-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('assetResearchView.columnDate')}</th>
                <th>{t('assetResearchView.columnEvent')}</th>
                <th>{t('assetResearchView.columnQuantity')}</th>
                <th>{t('assetResearchView.columnPrice')}</th>
                <th>{t('assetResearchView.columnAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((transaction) => {
                const visual = getTransactionVisual(transaction.type, t)
                const currency = transaction.currency || fallbackCurrency
                return (
                  <tr key={transaction.id}>
                    <td>
                      {new Intl.DateTimeFormat(locale, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(transaction.tx_date))}
                    </td>
                    <td>
                      <span className={`asset-research__transaction-type is-${visual.tone}`}>
                        <visual.Icon size={15} strokeWidth={2} aria-hidden="true" />
                        {visual.label}
                      </span>
                    </td>
                    <td>{formatQuantity(transaction.quantity)}</td>
                    <td>{formatCurrency(transaction.price, currency, locale)}</td>
                    <td>
                      <strong>
                        {formatCurrency(
                          calculateTransactionAmount(transaction),
                          currency,
                          locale,
                        )}
                      </strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="asset-research__quiet-state">
          {t('assetResearchView.noTransactionsRecorded')}
        </div>
      )}
    </section>
  )
}

function ClassificationLine({
  kind,
  label,
}: {
  kind: 'sector' | 'industry' | 'theme'
  label: string
}) {
  const Icon = kind === 'theme' ? getThemeIcon(label) : getSectorIcon(label)
  return (
    <div className="asset-research__classification-line">
      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      <span>
        <small>{kind}</small>
        <strong>{label}</strong>
      </span>
    </div>
  )
}

function ThemeClassificationTree({ themes }: { themes: AssetThemeDTO[] }) {
  const { t } = useTranslation()
  return (
    <div className="asset-research__classification-themes">
      <p>{t('assetResearchView.themesAndSubthemes')}</p>
      <ol>
        {themes.map((theme) => {
          const ThemeIcon = getThemeIcon(theme.label)
          const themeColor = getThemeHexColor(theme.label)
          return (
            <li key={theme.label} className="asset-research__classification-theme">
              <div className="asset-research__classification-theme-main">
                <span
                  className="asset-research__classification-theme-icon"
                  style={{ color: themeColor, borderColor: themeColor }}
                >
                  <ThemeIcon size={16} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="asset-research__classification-theme-copy">
                  <strong>{theme.label}</strong>
                  <small>
                    {theme.confidence
                      ? t('assetResearchView.confidencePercent', { percent: Math.round(theme.confidence * 100) })
                      : t('assetResearchView.confidenceUnavailable')}
                    {theme.weight !== null && theme.weight !== undefined
                      ? t('assetResearchView.classificationWeight', { percent: (theme.weight * 100).toFixed(1) })
                      : ''}
                  </small>
                </span>
              </div>

              {(theme.children ?? []).length > 0 && (
                <ol className="asset-research__classification-subthemes">
                  {(theme.children ?? []).map((subtheme) => {
                    const SubthemeIcon = getThemeIcon(subtheme.label)
                    const subthemeColor = getThemeHexColor(subtheme.label)
                    return (
                      <li key={`${theme.label}-${subtheme.label}`}>
                        <span
                          className="asset-research__classification-subtheme-icon"
                          style={{ color: subthemeColor }}
                        >
                          <SubthemeIcon size={14} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{subtheme.label}</strong>
                          <small>
                            {subtheme.confidence
                              ? t('assetResearchView.confidencePercent', { percent: Math.round(subtheme.confidence * 100) })
                              : t('assetResearchView.confidenceUnavailable')}
                          </small>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function EvidenceValue({
  label,
  value,
  tone,
  confidence,
}: {
  label: string
  value: string
  tone?: string
  confidence?: string
}) {
  return (
    <div className="asset-research__evidence-value">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {confidence && <small>{confidence}</small>}
    </div>
  )
}

function EvidenceSkeleton({ rows }: { rows: number }) {
  const { t } = useTranslation()
  return (
    <div className="asset-research__skeleton-list" aria-label={t('assetResearchView.loadingEvidence')}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}

function AssetResearchViewSkeleton() {
  const { t } = useTranslation()
  return <PageStateSkeleton label={t('assetResearchView.loadingAssetResearch')} className="asset-research asset-research--loading" />
}
