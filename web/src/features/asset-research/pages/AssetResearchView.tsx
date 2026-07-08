import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api, { type AssetInvestmentNoteDTO } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import AssetInvestmentNoteModal from '@/features/assets/components/AssetInvestmentNoteModal'
import {
  buildAnalystMetrics,
  buildBalanceSheetMetrics,
  buildFundamentalsMetrics,
  buildGrowthMetrics,
  buildRelativeMetric,
  buildRiskMetrics,
  type AssetResearchMetric,
} from '@/features/assets/lib/assetResearchMetricBuilders'
import {
  formatAssetType,
  formatCurrency,
  formatQuantity,
} from '@/shared/lib/formatUtils'
import { formatResearchPercent } from '@/features/assets/lib/assetResearchMetricBuilders'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import { StateBlock } from '@/shared/components/StatePrimitives'
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
import AssetResearchPriceChart from '@/features/asset-research/components/AssetResearchPriceChart'
import { AssetResearchViewSkeleton } from '@/features/asset-research/components/AssetResearchViewSkeleton'
import { EtfCompositionSection } from '@/features/asset-research/components/EtfCompositionSection'
import { EvidenceQuestion } from '@/features/asset-research/components/EvidencePrimitives'
import { MyPositionSection } from '@/features/asset-research/components/MyPositionSection'
import { OverviewSection } from '@/features/asset-research/components/OverviewSection'
import { useAssetResearchView } from '@/features/asset-research/hooks/useAssetResearchView'
import {
  calculatePortfolioWeight,
  calculatePositionDailyContribution,
  calculatePositionTotalReturn,
  calculatePositionTotalReturnPct,
  calculatePriceChangeAmount,
  researchNumber,
  sumTransactionType,
} from '@/features/asset-research/lib/assetResearchViewCalculations'
import {
  getTabs,
  signedCurrency,
  signedPercent,
  valueTone,
} from '@/features/asset-research/lib/assetResearchViewFormatting'
import type { AssetResearchViewTab } from '@/features/asset-research/types'
import '@/shared/design/pages/asset-research.css'

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
  const totalReturnPct = calculatePositionTotalReturnPct(position)
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
                className="asset-research__accent-button"
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
              <span className="asset-research__value--neutral">
                  ·
              </span>
              <Link className="asset-research__accent-button" to={`/transactions?symbol=${encodeURIComponent(asset.symbol)}`}>
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
          {hasRelationship ? (
            <>
              <h2 id="relationship-heading">
                {ownsAsset
                  ? t('assetResearchView.youOwn', { amount: formatCurrency(position?.market_value ?? 0, portfolioCurrency, locale), symbol: asset.symbol })
                  : t('assetResearchView.haveHistoricalActivity', { symbol: asset.symbol })}
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
              ) : (
                <p>
                  {t('assetResearchView.positionClosedHistory')}
                </p>
              )}
            </>
          ) : (
            <p id="relationship-heading" className="asset-research__relationship-empty-text">
              {t('assetResearchView.addToWatchlistOrRecord')}
            </p>
          )}
        </div>
        {hasRelationship && (
          <button type="button" onClick={() => setActiveTab('position')}>
            {t('assetResearchView.inspectMyPosition')}
          </button>
        )}
      </section>

      {hasRelationship && (
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
            label={t('assetResearchView.lifetimePnlPct')}
            value={totalReturnPct !== null ? signedPercent(totalReturnPct) : '—'}
            tone={totalReturnPct !== null ? (totalReturnPct > 0 ? 'positive' : totalReturnPct < 0 ? 'negative' : 'neutral') : 'neutral'}
          />
        </PageMetricStrip>
      )}

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
          <>
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
              {research.isEtf && (
                <EtfCompositionSection
                  data={research.etfCompositionQuery.data}
                  loading={research.etfCompositionQuery.isLoading}
                  error={research.etfCompositionQuery.error}
                  symbol={asset.symbol}
                />
              )}
            </OverviewSection>
          </>
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
