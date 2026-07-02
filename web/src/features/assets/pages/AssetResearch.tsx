import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpenText,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  LineChart,
  MapPin,
  Plus,
  Search,
  Shield,
  ShoppingCart,
  Tags,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import api, {
  AssetInvestmentNoteDTO,
  AssetResearchDTO,
  AssetResearchFundamentalsDTO,
  AssetResearchMetadataDTO,
  AssetResearchRelativePerformanceDTO,
  AssetResearchRiskDTO,
  AssetThemeClassificationDTO,
} from '@/api'
import AssetPriceChart from '@/features/assets/components/AssetPriceChart'
import AssetInvestmentNoteModal from '@/features/assets/components/AssetInvestmentNoteModal'
import AssetInvestmentNoteSummary from '@/features/assets/components/AssetInvestmentNoteSummary'
import EtfCompositionSection from '@/features/assets/components/EtfCompositionSection'
import DataFreshnessIndicator from '@/shared/components/DataFreshnessIndicator'
import AssetLogo from '@/shared/components/AssetLogo'
import ThemeSubthemeBadges from '@/shared/components/ThemeSubthemeBadges'
import { InlineLoading, PageStateSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import { formatAssetType, formatCurrency, formatWithSeparators } from '@/shared/lib/formatUtils'
import { getCountryCode } from '@/shared/lib/countryUtils'
import { getIndustryColor, getIndustryIcon, getSectorColor, getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeColor, getThemeEvidenceTitle, getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import {
  AssetResearchMetric,
  AssetResearchMetricIcon,
  buildAssetResearchMetrics,
  buildRelativeMetric,
  formatOwnershipPercent,
  formatResearchPercent,
  isEquityAsset,
  isEtfAsset,
} from '@/features/assets/lib/assetResearchMetricBuilders'
import { buildTradingPerformanceMetrics } from '@/features/assets/lib/tradingPerformanceMetrics'
import { useTranslation } from 'react-i18next'

type TabId = 'overview' | 'fundamentals' | 'performance' | 'risk' | 'analyst'

interface TickerSearchResult {
  symbol: string
  name: string
  type?: string
  exchange?: string
}

type ResearchSection = 'fundamentals' | 'business' | 'ownership' | 'themes' | 'risk' | 'performance' | 'metadata'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'fundamentals', label: 'Fundamentals' },
  { id: 'performance', label: 'Performance' },
  { id: 'risk', label: 'Risk' },
  { id: 'analyst', label: 'Analyst / Valuation' },
]

const emptyFundamentals: AssetResearchFundamentalsDTO = {
  market_cap: null,
  volume: null,
  avg_volume: null,
  pe_ratio: null,
  eps: null,
  price: null,
  liquidity_score: null,
  revenue_growth: null,
  earnings_growth: null,
  profit_margins: null,
  operating_margins: null,
  return_on_equity: null,
  net_cash: null,
  debt_to_equity: null,
  current_ratio: null,
  quick_ratio: null,
  recommendation_key: null,
  recommendation_mean: null,
  num_analysts: null,
  target_mean: null,
  target_high: null,
  target_low: null,
  implied_upside_pct: null,
}

const emptyBusiness: AssetResearchDTO['business'] = {
  founded: null,
  employees: null,
  headquarters: null,
  country: null,
  sector: null,
  industry: null,
  description: null,
}

const emptyOwnership: AssetResearchDTO['ownership'] = {
  institutional_ownership: null,
  insider_ownership: null,
  short_interest: null,
}

const emptyRisk: AssetResearchRiskDTO = {
  volatility_30d: null,
  volatility_90d: null,
  beta: null,
  beta_benchmark: null,
  risk_score: null,
  distance_to_ath_pct: null,
}

const emptyRelativePerformance: AssetResearchRelativePerformanceDTO = {
  relative_perf_30d: null,
  relative_perf_90d: null,
  relative_perf_ytd: null,
  relative_perf_1y: null,
  asset_perf_30d: null,
  asset_perf_90d: null,
  asset_perf_ytd: null,
  asset_perf_1y: null,
  etf_perf_30d: null,
  etf_perf_90d: null,
  etf_perf_ytd: null,
  etf_perf_1y: null,
  sector_etf: null,
}

const emptySectionLoading: Record<ResearchSection, boolean> = {
  fundamentals: false,
  business: false,
  ownership: false,
  themes: false,
  risk: false,
  performance: false,
  metadata: false,
}

const emptySectionErrors: Record<ResearchSection, string | null> = {
  fundamentals: null,
  business: null,
  ownership: null,
  themes: null,
  risk: null,
  performance: null,
  metadata: null,
}

export default function AssetResearch() {
  const { symbol = '' } = useParams()
  const routeSymbol = symbol.trim()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [assetResearch, setAssetResearch] = useState<AssetResearchDTO | null>(null)
  const [investmentNote, setInvestmentNote] = useState<AssetInvestmentNoteDTO | null>(null)
  const [investmentNoteLoading, setInvestmentNoteLoading] = useState(false)
  const [investmentNoteOpen, setInvestmentNoteOpen] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(Boolean(routeSymbol))
  const [sectionLoading, setSectionLoading] = useState<Record<ResearchSection, boolean>>(emptySectionLoading)
  const [sectionErrors, setSectionErrors] = useState<Record<ResearchSection, string | null>>(emptySectionErrors)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [watchlistMessage, setWatchlistMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [addingToWatchlist, setAddingToWatchlist] = useState(false)
  const [watchlistItemId, setWatchlistItemId] = useState<number | null>(null)
  const [watchlistStatusLoading, setWatchlistStatusLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolioDataVersion = usePortfolioStore((state) => state.dataVersion)
  const isResearchEtf = assetResearch ? isEtfAsset(assetResearch.asset) : false

  const etfCompositionQuery = useQuery({
    queryKey: ['asset-etf-composition', routeSymbol.toUpperCase(), activePortfolioId, portfolioDataVersion],
    queryFn: () => api.getAssetEtfComposition(routeSymbol.toUpperCase(), activePortfolioId),
    enabled: Boolean(routeSymbol) && isResearchEtf,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const tradingPerformanceQuery = useQuery({
    queryKey: ['asset-trading-performance', activePortfolioId, assetResearch?.asset.id, portfolioDataVersion],
    queryFn: () => api.getPortfolioPosition(activePortfolioId!, assetResearch!.asset.id),
    enabled: Boolean(activePortfolioId && assetResearch?.asset.id),
    staleTime: 60 * 1000,
  })

  useEffect(() => {
    let cancelled = false

    async function loadAssetResearch() {
      if (!routeSymbol) {
        setAssetResearch(null)
        setError(null)
        setSummaryLoading(false)
        setSectionLoading(emptySectionLoading)
        setSectionErrors(emptySectionErrors)
        setWatchlistItemId(null)
        setWatchlistStatusLoading(false)
        return
      }

      try {
        const normalizedSymbol = routeSymbol.toUpperCase()
        setSummaryLoading(true)
        setSectionLoading(emptySectionLoading)
        setSectionErrors(emptySectionErrors)
        setError(null)
        setAssetResearch(null)
        setInvestmentNote(null)
        setWatchlistItemId(null)
        setWatchlistStatusLoading(false)
        setWatchlistMessage(null)
        setDescriptionExpanded(false)
        const summary = await api.getAssetResearchSummary(normalizedSymbol)
        const shouldLoadProfileSections = !isEtfAsset(summary.asset)
        const shouldLoadThemes = isEquityAsset(summary.asset)
        if (!cancelled) {
          setAssetResearch({
            asset: shouldLoadThemes ? summary.asset : { ...summary.asset, themes: [] },
            quote: summary.quote,
            metadata: summary.metadata,
            fundamentals: emptyFundamentals,
            business: emptyBusiness,
            ownership: emptyOwnership,
            risk: emptyRisk,
            relative_performance: emptyRelativePerformance,
          })
          setInvestmentNoteLoading(true)
          api.getAssetInvestmentNote(summary.asset.id)
            .then((note) => {
              if (!cancelled) setInvestmentNote(note)
            })
            .catch(() => {
              if (!cancelled) setInvestmentNote(null)
            })
            .finally(() => {
              if (!cancelled) setInvestmentNoteLoading(false)
            })

          setWatchlistStatusLoading(true)
          api.getWatchlistItemByAsset(summary.asset.id)
            .then((item) => {
              if (!cancelled) setWatchlistItemId(item?.id ?? null)
            })
            .catch(() => {
              if (!cancelled) setWatchlistItemId(null)
            })
            .finally(() => {
              if (!cancelled) setWatchlistStatusLoading(false)
            })
        }

        const loadSection = async <T,>(
          section: ResearchSection,
          request: Promise<T>,
          applyData: (current: AssetResearchDTO, data: T) => AssetResearchDTO,
        ) => {
          if (!cancelled) {
            setSectionLoading((current) => ({ ...current, [section]: true }))
            setSectionErrors((current) => ({ ...current, [section]: null }))
          }

          try {
            const data = await request
            if (!cancelled) {
              setAssetResearch((current) => current ? applyData(current, data) : current)
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : `Failed to load ${section}`
            if (!cancelled) {
              setSectionErrors((current) => ({ ...current, [section]: message }))
            }
          } finally {
            if (!cancelled) {
              setSectionLoading((current) => ({ ...current, [section]: false }))
            }
          }
        }

        void loadSection(
          'fundamentals',
          api.getAssetResearchFundamentals(normalizedSymbol),
          (current, fundamentals) => ({ ...current, fundamentals }),
        )
        if (shouldLoadProfileSections) {
          void loadSection(
            'business',
            api.getAssetResearchBusiness(normalizedSymbol),
            (current, business) => ({ ...current, business }),
          )
          void loadSection(
            'ownership',
            api.getAssetResearchOwnership(normalizedSymbol),
            (current, ownership) => ({ ...current, ownership }),
          )
        }
        if (shouldLoadThemes) {
          void loadSection(
            'themes',
            api.getAssetResearchThemes(normalizedSymbol),
            (current, classification: AssetThemeClassificationDTO) => ({
              ...current,
              asset: {
                ...current.asset,
                themes: classification.themes,
              },
            }),
          )
        } else if (!cancelled) {
          setAssetResearch((current) => current ? {
            ...current,
            asset: {
              ...current.asset,
              themes: [],
            },
          } : current)
        }
        void loadSection(
          'risk',
          api.getAssetResearchRisk(normalizedSymbol),
          (current, risk) => ({ ...current, risk }),
        )
        void loadSection(
          'performance',
          api.getAssetResearchPerformance(normalizedSymbol),
          (current, relative_performance) => ({ ...current, relative_performance }),
        )
        void loadSection(
          'metadata',
          api.getAssetResearchMetadata(normalizedSymbol),
          (current, metadata: AssetResearchMetadataDTO) => ({ ...current, metadata }),
        )
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load asset research'
          setError(message)
          setInvestmentNote(null)
        }
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }

    loadAssetResearch()

    return () => {
      cancelled = true
    }
  }, [routeSymbol])

  const metrics = useMemo(
    () => assetResearch ? buildAssetResearchMetrics(assetResearch, t) : null,
    [assetResearch, t],
  )

  async function handleAddToWatchlist() {
    if (!assetResearch || watchlistItemId !== null) return
    try {
      setAddingToWatchlist(true)
      setWatchlistMessage(null)
      const item = await api.addToWatchlist({ symbol: assetResearch.asset.symbol })
      setWatchlistItemId(item.id)
      setWatchlistMessage({ type: 'success', text: `${assetResearch.asset.symbol} added to watchlist.` })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add to watchlist'
      setWatchlistMessage({ type: 'error', text: message })
    } finally {
      setAddingToWatchlist(false)
    }
  }

  async function handleSearchChange(value: string) {
    setSearchQuery(value)
    setSearchError(null)

    if (value.trim().length <= 1) {
      setSearchResults([])
      return
    }

    try {
      setSearchLoading(true)
      const data = await api.searchTicker(value)
      setSearchResults(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search tickers'
      setSearchError(message)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  function openResearchForSymbol(nextSymbol: string) {
    const normalized = nextSymbol.trim().toUpperCase()
    if (!normalized) return
    navigate(`/assets/${encodeURIComponent(normalized)}`)
  }

  function handleResearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    openResearchForSymbol(searchQuery)
  }

  if (summaryLoading) {
    return <PageStateSkeleton label="Loading asset research" />
  }

  if (!routeSymbol) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate(-1)} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="card p-5 sm:p-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {t('assets.searchResearch')}
            </h1>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              {t('assets.searchResearchDescription')}
            </p>

            <form onSubmit={handleResearchSubmit} className="mt-5 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={t('assets.searchResearchPlaceholder')}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2">
                <Search size={16} />
                {t('assets.research')}
              </button>
            </form>

            {searchLoading && (
              <p className="mt-3"><InlineLoading label={t('common.loading')} /></p>
            )}

            {searchError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{searchError}</p>
            )}

            {searchResults.length > 0 && (
              <div className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                {searchResults.map((item) => (
                  <button
                    key={`${item.symbol}-${item.type || ''}`}
                    type="button"
                    onClick={() => openResearchForSymbol(item.symbol)}
                    className="w-full px-4 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-indigo-700 dark:text-indigo-300">{item.symbol}</div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{item.name || '-'}</div>
                      </div>
                      {item.type && (
                        <span className="text-xs px-2 py-1 rounded bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {item.type}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (error || !assetResearch || !metrics) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-red-500" />
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Asset research unavailable</h1>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">{error || 'No data returned for this asset.'}</p>
        </div>
      </div>
    )
  }

  const { asset, quote, metadata } = assetResearch
  const showProfileSections = !isEtfAsset(asset)
  const showThemeSection = isEquityAsset(asset)
  const dailyChangeColor = metrics.dailyChange === null
    ? 'text-neutral-500 dark:text-neutral-400'
    : metrics.dailyChange >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn-secondary inline-flex items-center gap-2">
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <AssetLogo
              symbol={asset.symbol}
              assetType={asset.asset_type}
              assetName={asset.name}
              alt={`${asset.symbol} logo`}
              className="w-16 h-16 flex-shrink-0 object-cover"
              style={{ borderRadius: 0 }}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">{asset.symbol}</h1>
                {quote?.asof && (
                  <DataFreshnessIndicator
                    timestamp={quote.asof}
                    latestPriceTimestamp={quote.asof}
                    marketStatus="unknown"
                  />
                )}
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 truncate">{asset.name || asset.symbol}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <AssetTypePill value={formatAssetType(asset.asset_type)} />
                <SectorPill value={asset.sector} />
                <IndustryPill value={asset.industry} />
                <CountryPill value={asset.country} />
                <CurrencyPill value={metrics.currency} />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-end gap-3">
            <div className="text-left sm:text-right">
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(metrics.price, metrics.currency)}
              </div>
              <div className={`text-sm font-semibold ${dailyChangeColor}`}>
                {metrics.dailyChange === null ? '-' : formatResearchPercent(metrics.dailyChange)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              <button
                onClick={handleAddToWatchlist}
                disabled={addingToWatchlist || watchlistStatusLoading || watchlistItemId !== null}
                className={`${watchlistItemId !== null ? 'btn-secondary' : 'btn-primary'} inline-flex items-center gap-2`}
              >
                {watchlistItemId !== null ? <Check size={16} /> : <Plus size={16} />}
                {watchlistStatusLoading
                  ? 'Checking...'
                  : watchlistItemId !== null
                    ? 'In watchlist'
                    : addingToWatchlist
                      ? 'Adding...'
                      : 'Add to watchlist'}
              </button>
              <button
                onClick={() => navigate(`/transactions?symbol=${encodeURIComponent(asset.symbol)}`)}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <ShoppingCart size={16} />
                Add transaction
              </button>
            </div>
          </div>
        </div>

        {watchlistMessage && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            watchlistMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
          }`}>
            {watchlistMessage.text}
          </div>
        )}
      </div>

      <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <MetricGrid metrics={metrics.overview} />
          {(sectionLoading.fundamentals || sectionLoading.risk) && <MetricSkeletonGrid count={2} />}
          <SectionErrorBanner message={sectionErrors.fundamentals || sectionErrors.risk} />
          <AssetInvestmentNoteSummary
            note={investmentNote}
            currency={metrics.currency}
            loading={investmentNoteLoading}
            onEdit={() => setInvestmentNoteOpen(true)}
          />
          {tradingPerformanceQuery.isLoading ? (
            <Section title="Trading Performance" icon={<Activity size={20} className="text-blue-600 dark:text-blue-400" />}>
              <MetricSkeletonGrid count={4} />
            </Section>
          ) : tradingPerformanceQuery.data ? (
            <Section title="Trading Performance" icon={<Activity size={20} className="text-blue-600 dark:text-blue-400" />}>
              <MetricGrid metrics={buildTradingPerformanceMetrics(tradingPerformanceQuery.data)} />
            </Section>
          ) : null}
          {showThemeSection && (
            <>
              {sectionLoading.themes ? (
                <Section title="Themes & Exposures" icon={<Tags size={20} className="text-neutral-600 dark:text-neutral-400" />}>
                  <CardSkeleton rows={4} />
                </Section>
              ) : (
                <ThemeSection themes={asset.themes || []} />
              )}
              <SectionErrorBanner message={sectionErrors.themes} />
            </>
          )}
          {showProfileSections && (
            <>
              {sectionLoading.business ? (
                <Section title="Business" icon={<Building2 size={20} className="text-neutral-600 dark:text-neutral-400" />}>
                  <CardSkeleton rows={6} />
                </Section>
              ) : (
                <BusinessSection
                  business={assetResearch.business}
                  asset={asset}
                  descriptionExpanded={descriptionExpanded}
                  onToggleDescription={() => setDescriptionExpanded((expanded) => !expanded)}
                />
              )}
              <SectionErrorBanner message={sectionErrors.business} />
              {sectionLoading.ownership ? (
                <Section title="Ownership" icon={<Users size={20} className="text-neutral-600 dark:text-neutral-400" />}>
                  <MetricSkeletonGrid count={3} />
                </Section>
              ) : (
                <OwnershipSection ownership={assetResearch.ownership} />
              )}
              <SectionErrorBanner message={sectionErrors.ownership} />
            </>
          )}
          <EtfCompositionSection
            query={etfCompositionQuery}
            enabled={isResearchEtf}
            symbol={asset.symbol}
          />
          <AssetPriceChart
            assetId={asset.id}
            symbol={asset.symbol}
            currency={metrics.currency}
            assetType={asset.asset_type}
            assetName={asset.name}
            initialPeriod="ALL"
            ensureAllTimeHistory
          />
          <Section title="Market Metadata" icon={<BarChart3 size={20} className="text-neutral-600 dark:text-neutral-400" />}>
            {sectionLoading.metadata ? (
              <MetricSkeletonGrid count={4} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard label="ATH" value={formatCurrency(metadata.ath_price, metrics.currency)} />
                <InfoCard label="ATH Date" value={metadata.ath_date ? new Date(metadata.ath_date).toLocaleDateString() : '-'} />
                <InfoCard label="ATL" value={formatCurrency(metadata.atl_price, metrics.currency)} />
                <InfoCard label="ATL Date" value={metadata.atl_date ? new Date(metadata.atl_date).toLocaleDateString() : '-'} />
              </div>
            )}
            <SectionErrorBanner message={sectionErrors.metadata} />
          </Section>
        </div>
      )}

      {activeTab === 'fundamentals' && (
        <div className="space-y-6">
          {sectionLoading.fundamentals ? (
            <>
              <Section title="Fundamentals & Liquidity" icon={<DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />}>
                <MetricSkeletonGrid />
              </Section>
              <Section title="Growth & Profitability" icon={<LineChart size={20} className="text-green-600 dark:text-green-400" />}>
                <MetricSkeletonGrid />
              </Section>
            </>
          ) : (
            <>
              <MaybeSection title="Fundamentals & Liquidity" metrics={metrics.fundamentals} icon={<DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />} />
              <MaybeSection title="Growth & Profitability" metrics={metrics.growth} icon={<LineChart size={20} className="text-green-600 dark:text-green-400" />} />
              <MaybeSection title="Balance Sheet" metrics={metrics.balanceSheet} icon={<Shield size={20} className="text-cyan-600 dark:text-cyan-400" />} />
            </>
          )}
          <SectionErrorBanner message={sectionErrors.fundamentals} />
        </div>
      )}

      {activeTab === 'performance' && (
        <Section title={`Relative Performance${metrics.relative.sector_etf ? ` vs ${metrics.relative.sector_etf}` : ''}`} icon={<BarChart3 size={20} className="text-indigo-600 dark:text-indigo-400" />}>
          {sectionLoading.performance ? (
            <MetricSkeletonGrid />
          ) : (
            <MetricGrid
              metrics={[
                buildRelativeMetric('1M', metrics.relative.relative_perf_30d, metrics.relative.asset_perf_30d, metrics.relative.etf_perf_30d, asset.symbol, metrics.relative.sector_etf),
                buildRelativeMetric('3M', metrics.relative.relative_perf_90d, metrics.relative.asset_perf_90d, metrics.relative.etf_perf_90d, asset.symbol, metrics.relative.sector_etf),
                buildRelativeMetric('YTD', metrics.relative.relative_perf_ytd, metrics.relative.asset_perf_ytd, metrics.relative.etf_perf_ytd, asset.symbol, metrics.relative.sector_etf),
                buildRelativeMetric('1Y', metrics.relative.relative_perf_1y, metrics.relative.asset_perf_1y, metrics.relative.etf_perf_1y, asset.symbol, metrics.relative.sector_etf),
              ].filter((metric): metric is AssetResearchMetric => metric !== null)}
              emptyMessage="No relative performance data available yet."
            />
          )}
          <SectionErrorBanner message={sectionErrors.performance} />
        </Section>
      )}

      {activeTab === 'risk' && (
        <Section title="Risk Metrics" icon={<AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />}>
          {sectionLoading.risk ? (
            <MetricSkeletonGrid />
          ) : (
            <MetricGrid metrics={metrics.risk} />
          )}
          <SectionErrorBanner message={sectionErrors.risk} />
        </Section>
      )}

      {activeTab === 'analyst' && (
        <Section title="Analyst View & Valuation" icon={<Users size={20} className="text-violet-600 dark:text-violet-400" />}>
          {sectionLoading.fundamentals ? (
            <MetricSkeletonGrid />
          ) : (
            <MetricGrid metrics={metrics.analyst} />
          )}
          <SectionErrorBanner message={sectionErrors.fundamentals} />
        </Section>
      )}

      <AssetInvestmentNoteModal
        assetId={asset.id}
        symbol={asset.symbol}
        note={investmentNote}
        isOpen={investmentNoteOpen}
        onClose={() => setInvestmentNoteOpen(false)}
        onSaved={setInvestmentNote}
      />
    </div>
  )
}

function Pill({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      title={title}
    >
      {children}
    </span>
  )
}

function AssetTypePill({ value }: { value: string }) {
  return (
    <Pill>
      <BarChart3 size={13} className="text-neutral-500 dark:text-neutral-400" />
      <span>{value}</span>
    </Pill>
  )
}

function SectorPill({ value }: { value: string | null | undefined }) {
  const label = value || 'Unknown sector'
  const Icon = getSectorIcon(value)
  return (
    <Pill title={label}>
      <Icon size={13} className={getSectorColor(value)} />
      <span>{label}</span>
    </Pill>
  )
}

function IndustryPill({ value }: { value: string | null | undefined }) {
  const label = value || 'Unknown industry'
  const Icon = getIndustryIcon(value)
  return (
    <Pill title={label}>
      <Icon size={13} className={getIndustryColor(value)} />
      <span>{label}</span>
    </Pill>
  )
}

function CountryPill({ value }: { value: string | null | undefined }) {
  const label = value || 'Unknown country'
  const countryCode = getCountryCode(value)
  return (
    <Pill title={label}>
      {countryCode ? (
        <img
          src={`https://flagcdn.com/w40/${countryCode}.png`}
          alt=""
          loading="lazy"
          className="h-3.5 w-5 rounded-sm object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <span className="h-3.5 w-5 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
      )}
      <span>{label}</span>
    </Pill>
  )
}

function CurrencyPill({ value }: { value: string }) {
  return (
    <Pill>
      <DollarSign size={13} className="text-emerald-600 dark:text-emerald-400" />
      <span>{value}</span>
    </Pill>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function MaybeSection({ title, icon, metrics }: { title: string; icon: React.ReactNode; metrics: AssetResearchMetric[] }) {
  if (metrics.length === 0) return null
  return (
    <Section title={title} icon={icon}>
      <MetricGrid metrics={metrics} />
    </Section>
  )
}

function MetricSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card p-5 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="mt-4 h-8 w-32 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="mt-4 h-4 w-full rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
              <div className="mt-2 h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
      {message}
    </div>
  )
}

function ThemeSection({ themes }: { themes: AssetResearchDTO['asset']['themes'] }) {
  if (!themes || themes.length === 0) return null

  return (
    <Section title="Themes & Exposures" icon={<Tags size={20} className="text-neutral-600 dark:text-neutral-400" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        {themes.map((theme) => (
          (() => {
            const ThemeIcon = getThemeIcon(theme.label)
            const themeColor = getThemeColor(theme.label)
            const themeHex = getThemeHexColor(theme.label)
            return (
              <div
                key={theme.label}
                className="rounded-md border px-3 py-2 shadow-sm transition-colors dark:shadow-none"
                style={{ borderColor: `${themeHex}40`, backgroundColor: `${themeHex}12` }}
                title={getThemeEvidenceTitle(theme)}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ThemeIcon size={14} className={themeColor} />
                  <span className={themeColor}>{theme.label}</span>
                  <span className="ml-auto text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {Math.round(theme.confidence * 100)}%
                  </span>
                </div>
                <ThemeSubthemeBadges parentLabel={theme.label} subthemes={theme.children} />
              </div>
            )
          })()
        ))}
      </div>
    </Section>
  )
}

function BusinessSection({
  business,
  asset,
  descriptionExpanded,
  onToggleDescription,
}: {
  business: AssetResearchDTO['business']
  asset: AssetResearchDTO['asset']
  descriptionExpanded: boolean
  onToggleDescription: () => void
}) {
  const description = business.description?.trim()
  const businessItems = [
    {
      label: 'Founded',
      value: business.founded ? String(business.founded) : '-',
      icon: <CalendarDays size={16} className="text-neutral-500 dark:text-neutral-400" />,
    },
    {
      label: 'Employees',
      value: business.employees ? formatWithSeparators(business.employees) : '-',
      icon: <Users size={16} className="text-neutral-500 dark:text-neutral-400" />,
    },
    {
      label: 'Headquarters',
      value: business.headquarters || '-',
      icon: <MapPin size={16} className="text-neutral-500 dark:text-neutral-400" />,
    },
    {
      label: 'Country',
      value: business.country || asset.country || '-',
      icon: <MapPin size={16} className="text-neutral-500 dark:text-neutral-400" />,
    },
    {
      label: 'Sector',
      value: business.sector || asset.sector || '-',
      icon: <Building2 size={16} className="text-neutral-500 dark:text-neutral-400" />,
    },
    {
      label: 'Industry',
      value: business.industry || asset.industry || '-',
      icon: <Building2 size={16} className="text-neutral-500 dark:text-neutral-400" />,
    },
  ]

  return (
    <Section title="Business" icon={<Building2 size={20} className="text-neutral-600 dark:text-neutral-400" />}>
      <div className="card p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
          {businessItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                {item.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">{item.label}</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 break-words">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {description && (
          <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <BookOpenText size={16} className="text-neutral-500 dark:text-neutral-400" />
              Company Description
            </div>
            <p className={`text-sm leading-6 text-neutral-600 dark:text-neutral-400 ${descriptionExpanded ? '' : 'max-h-24 overflow-hidden'}`}>
              {description}
            </p>
            <button
              type="button"
              onClick={onToggleDescription}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {descriptionExpanded ? (
                <>
                  <ChevronUp size={16} />
                  Hide full company description
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Show full company description
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Section>
  )
}

function OwnershipSection({ ownership }: { ownership: AssetResearchDTO['ownership'] }) {
  return (
    <Section title="Ownership" icon={<Users size={20} className="text-neutral-600 dark:text-neutral-400" />}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InfoCard label="Institutional Ownership" value={formatOwnershipPercent(ownership.institutional_ownership)} />
        <InfoCard label="Insider Ownership" value={formatOwnershipPercent(ownership.insider_ownership)} />
        <InfoCard label="Short Interest" value={formatOwnershipPercent(ownership.short_interest)} />
      </div>
    </Section>
  )
}

function MetricGrid({ metrics, emptyMessage = 'No data available.' }: { metrics: AssetResearchMetric[]; emptyMessage?: string }) {
  if (metrics.length === 0) {
    return (
      <StateBlock
        eyebrow="No data"
        title={emptyMessage}
        description="This research section will populate when market data is available."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  )
}

const metricIcons: Record<AssetResearchMetricIcon, React.ReactNode> = {
  activity: <Activity size={16} />,
  alertTriangle: <AlertTriangle size={16} />,
  barChart3: <BarChart3 size={16} />,
  dollarSign: <DollarSign size={16} />,
  lineChart: <LineChart size={16} />,
  shield: <Shield size={16} />,
  target: <Target size={16} />,
  trendingDown: <TrendingDown size={16} />,
  trendingUp: <TrendingUp size={16} />,
  users: <Users size={16} />,
}

function MetricCard({ label, value, color, subtitle, icon }: AssetResearchMetric) {
  return (
    <div className="card p-5 bg-neutral-50 dark:bg-neutral-800/50">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-neutral-900 dark:text-neutral-100'} flex items-center gap-2 min-w-0`}>
        {icon ? metricIcons[icon] : null}
        <span className="break-words">{value}</span>
      </div>
      {subtitle && (
        <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">{subtitle}</div>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800/50">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{label}</div>
      <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{value}</div>
    </div>
  )
}
