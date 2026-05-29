import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpenText,
  Building2,
  CalendarDays,
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
import api, { AssetInvestmentNoteDTO, AssetResearchDTO } from '../lib/api'
import AssetPriceChart from '../components/AssetPriceChart'
import AssetInvestmentNoteModal from '../components/AssetInvestmentNoteModal'
import AssetInvestmentNoteSummary from '../components/AssetInvestmentNoteSummary'
import DataFreshnessIndicator from '../components/DataFreshnessIndicator'
import { getAssetLogoUrl, handleLogoError, validateLogoImage } from '../lib/logoUtils'
import { formatAssetType, formatCurrency, formatLargeNumber, formatNumber, formatWithSeparators } from '../lib/formatUtils'
import { getCountryCode } from '../lib/countryUtils'
import { getIndustryColor, getIndustryIcon, getSectorColor, getSectorIcon } from '../lib/sectorIndustryUtils'
import { getThemeColor, getThemeHexColor, getThemeIcon } from '../lib/themeUtils'
import {
  getAnalystConsensusConclusion,
  getDebtToEquityConclusion,
  getEarningsGrowthConclusion,
  getEpsConclusion,
  getImpliedUpsideConclusion,
  getLiquidityScoreConclusion,
  getMarketCapConclusion,
  getNetCashConclusion,
  getNetMarginConclusion,
  getOperatingMarginConclusion,
  getPEConclusion,
  getRevenueGrowthConclusion,
  getRiskScoreConclusion,
  getRoeConclusion,
  getVolatilityConclusion,
  getVolumeConclusion,
} from '../lib/conclusionUtils'
import { useTranslation } from 'react-i18next'

type TabId = 'overview' | 'fundamentals' | 'performance' | 'risk' | 'analyst'

interface MetricConfig {
  label: string
  value: string
  color?: string
  subtitle?: string
  icon?: React.ReactNode
}

interface TickerSearchResult {
  symbol: string
  name: string
  type?: string
  exchange?: string
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'fundamentals', label: 'Fundamentals' },
  { id: 'performance', label: 'Performance' },
  { id: 'risk', label: 'Risk' },
  { id: 'analyst', label: 'Analyst / Valuation' },
]

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

function hasAny(values: Array<unknown>): boolean {
  return values.some((value) => value !== null && value !== undefined)
}

function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '-'
  return `${value >= 0 ? '+' : ''}${formatNumber(value, decimals)}%`
}

function formatRatio(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : formatNumber(value, 2)
}

function formatRecommendation(value: string | null | undefined): string {
  if (!value) return '-'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatOwnershipPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${formatNumber(value * 100, 1)}%`
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
  const [loading, setLoading] = useState(Boolean(routeSymbol))
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [watchlistMessage, setWatchlistMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [addingToWatchlist, setAddingToWatchlist] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAssetResearch() {
      if (!routeSymbol) {
        setAssetResearch(null)
        setError(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        setDescriptionExpanded(false)
        const data = await api.getAssetResearch(routeSymbol.toUpperCase())
        if (!cancelled) {
          setAssetResearch(data)
          setInvestmentNoteLoading(true)
          api.getAssetInvestmentNote(data.asset.id)
            .then((note) => {
              if (!cancelled) setInvestmentNote(note)
            })
            .catch(() => {
              if (!cancelled) setInvestmentNote(null)
            })
            .finally(() => {
              if (!cancelled) setInvestmentNoteLoading(false)
            })
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load asset research'
          setError(message)
          setInvestmentNote(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAssetResearch()

    return () => {
      cancelled = true
    }
  }, [routeSymbol])

  const metrics = useMemo(() => {
    if (!assetResearch) return null
    const fundamentals = assetResearch.fundamentals
    const risk = assetResearch.risk
    const relative = assetResearch.relative_performance
    const quote = assetResearch.quote
    const currency = assetResearch.metadata.asset_currency || assetResearch.asset.currency || quote?.currency || 'USD'
    const dailyChange = toNumber(quote?.daily_change_pct)
    const price = toNumber(quote?.price)

    return {
      currency,
      dailyChange,
      price,
      overview: [
        {
          label: 'Current Price',
          value: formatCurrency(price, currency),
          color: 'text-neutral-900 dark:text-neutral-100',
          icon: <DollarSign size={16} />,
        },
        dailyChange !== null
          ? {
              label: 'Daily Change',
              value: formatPercent(dailyChange),
              color: dailyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              icon: dailyChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
            }
          : null,
        risk.risk_score !== null
          ? {
              label: 'Risk Score',
              value: formatNumber(risk.risk_score, 1),
              color: 'text-orange-600 dark:text-orange-400',
              subtitle: getRiskScoreConclusion(risk.risk_score, t),
              icon: <AlertTriangle size={16} />,
            }
          : null,
        fundamentals.market_cap !== null
          ? {
              label: 'Market Cap',
              value: `${formatLargeNumber(fundamentals.market_cap, 2)} ${currency}`,
              subtitle: getMarketCapConclusion(fundamentals.market_cap, t),
              icon: <BarChart3 size={16} />,
            }
          : null,
      ].filter(Boolean) as MetricConfig[],
      fundamentals: [
        fundamentals.market_cap !== null ? {
          label: 'Market Cap',
          value: `${formatLargeNumber(fundamentals.market_cap, 2)} ${currency}`,
          subtitle: getMarketCapConclusion(fundamentals.market_cap, t),
          icon: <DollarSign size={16} />,
        } : null,
        fundamentals.volume !== null ? {
          label: 'Volume',
          value: formatWithSeparators(fundamentals.volume),
          subtitle: fundamentals.avg_volume ? getVolumeConclusion(fundamentals.volume, fundamentals.avg_volume, t) : undefined,
          icon: <BarChart3 size={16} />,
        } : null,
        fundamentals.pe_ratio !== null ? {
          label: 'P/E Ratio',
          value: formatRatio(fundamentals.pe_ratio),
          subtitle: getPEConclusion(fundamentals.pe_ratio, t),
          icon: <Activity size={16} />,
        } : null,
        fundamentals.eps !== null ? {
          label: 'EPS',
          value: formatCurrency(fundamentals.eps, currency),
          subtitle: getEpsConclusion(fundamentals.eps, t),
          icon: <TrendingUp size={16} />,
        } : null,
        fundamentals.liquidity_score !== null ? {
          label: 'Liquidity Score',
          value: formatNumber(fundamentals.liquidity_score, 1),
          subtitle: getLiquidityScoreConclusion(fundamentals.liquidity_score, t),
          icon: <LineChart size={16} />,
        } : null,
      ].filter(Boolean) as MetricConfig[],
      growth: [
        fundamentals.revenue_growth !== null ? {
          label: 'Revenue Growth',
          value: formatPercent(fundamentals.revenue_growth * 100),
          color: fundamentals.revenue_growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          subtitle: getRevenueGrowthConclusion(fundamentals.revenue_growth * 100, t),
          icon: fundamentals.revenue_growth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
        } : null,
        fundamentals.earnings_growth !== null ? {
          label: 'Earnings Growth',
          value: formatPercent(fundamentals.earnings_growth * 100),
          color: fundamentals.earnings_growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          subtitle: getEarningsGrowthConclusion(fundamentals.earnings_growth * 100, t),
          icon: fundamentals.earnings_growth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
        } : null,
        fundamentals.profit_margins !== null ? {
          label: 'Net Margin',
          value: formatPercent(fundamentals.profit_margins * 100),
          subtitle: getNetMarginConclusion(fundamentals.profit_margins * 100, t),
          icon: <Activity size={16} />,
        } : null,
        fundamentals.operating_margins !== null ? {
          label: 'Operating Margin',
          value: formatPercent(fundamentals.operating_margins * 100),
          subtitle: getOperatingMarginConclusion(fundamentals.operating_margins * 100, t),
          icon: <Activity size={16} />,
        } : null,
        fundamentals.return_on_equity !== null ? {
          label: 'ROE',
          value: formatPercent(fundamentals.return_on_equity * 100),
          subtitle: getRoeConclusion(fundamentals.return_on_equity * 100, t),
          icon: <TrendingUp size={16} />,
        } : null,
      ].filter(Boolean) as MetricConfig[],
      balanceSheet: [
        fundamentals.net_cash !== null ? {
          label: 'Net Cash',
          value: `${formatLargeNumber(fundamentals.net_cash, 2)} ${currency}`,
          color: fundamentals.net_cash >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          subtitle: getNetCashConclusion(fundamentals.net_cash, t),
          icon: <DollarSign size={16} />,
        } : null,
        fundamentals.debt_to_equity !== null ? {
          label: 'Debt / Equity',
          value: formatRatio(fundamentals.debt_to_equity),
          subtitle: getDebtToEquityConclusion(fundamentals.debt_to_equity, t),
          icon: <Activity size={16} />,
        } : null,
        fundamentals.current_ratio !== null ? {
          label: 'Current Ratio',
          value: formatRatio(fundamentals.current_ratio),
          icon: <Shield size={16} />,
        } : null,
        fundamentals.quick_ratio !== null ? {
          label: 'Quick Ratio',
          value: formatRatio(fundamentals.quick_ratio),
          icon: <Shield size={16} />,
        } : null,
      ].filter(Boolean) as MetricConfig[],
      risk: [
        risk.volatility_30d !== null ? {
          label: '30D Volatility',
          value: `${formatNumber(risk.volatility_30d, 2)}%`,
          color: 'text-orange-600 dark:text-orange-400',
          subtitle: getVolatilityConclusion(risk.volatility_30d, t),
          icon: <Activity size={16} />,
        } : null,
        risk.volatility_90d !== null ? {
          label: '90D Volatility',
          value: `${formatNumber(risk.volatility_90d, 2)}%`,
          color: 'text-orange-600 dark:text-orange-400',
          subtitle: getVolatilityConclusion(risk.volatility_90d, t),
          icon: <Activity size={16} />,
        } : null,
        risk.beta !== null ? {
          label: 'Beta',
          value: formatNumber(risk.beta, 2),
          color: 'text-orange-600 dark:text-orange-400',
          subtitle: risk.beta_benchmark ? `vs ${risk.beta_benchmark}` : undefined,
          icon: <TrendingUp size={16} />,
        } : null,
        risk.distance_to_ath_pct !== null ? {
          label: 'Distance to ATH',
          value: formatPercent(risk.distance_to_ath_pct),
          color: risk.distance_to_ath_pct >= -10 ? 'text-green-600 dark:text-green-400' : risk.distance_to_ath_pct >= -30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
          icon: <Target size={16} />,
        } : null,
      ].filter(Boolean) as MetricConfig[],
      analyst: [
        fundamentals.recommendation_key !== null ? {
          label: 'Consensus',
          value: formatRecommendation(fundamentals.recommendation_key),
          color: fundamentals.recommendation_key.includes('buy') ? 'text-green-600 dark:text-green-400' : fundamentals.recommendation_key.includes('hold') ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
          subtitle: getAnalystConsensusConclusion(fundamentals.recommendation_mean, t) || undefined,
          icon: <Users size={16} />,
        } : null,
        fundamentals.num_analysts !== null ? {
          label: 'Analysts',
          value: formatNumber(fundamentals.num_analysts, 0),
          icon: <Users size={16} />,
        } : null,
        fundamentals.target_mean !== null ? {
          label: 'Target Mean',
          value: formatCurrency(fundamentals.target_mean, currency),
          subtitle: hasAny([fundamentals.target_low, fundamentals.target_high])
            ? `Range: ${formatCurrency(fundamentals.target_low, currency)} - ${formatCurrency(fundamentals.target_high, currency)}`
            : undefined,
          icon: <Target size={16} />,
        } : null,
        fundamentals.implied_upside_pct !== null ? {
          label: 'Implied Upside',
          value: formatPercent(fundamentals.implied_upside_pct),
          color: fundamentals.implied_upside_pct >= 20 ? 'text-green-600 dark:text-green-400' : fundamentals.implied_upside_pct >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
          subtitle: getImpliedUpsideConclusion(fundamentals.implied_upside_pct, t),
          icon: fundamentals.implied_upside_pct >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
        } : null,
      ].filter(Boolean) as MetricConfig[],
      relative,
    }
  }, [assetResearch, t])

  async function handleAddToWatchlist() {
    if (!assetResearch) return
    try {
      setAddingToWatchlist(true)
      setWatchlistMessage(null)
      await api.addToWatchlist({ symbol: assetResearch.asset.symbol })
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-24 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />

        <div className="card p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-16 h-16 flex-shrink-0 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              <div className="min-w-0 flex-1">
                <div className="h-8 w-32 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="mt-3 h-4 w-64 max-w-full rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="mt-4 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="h-7 w-28 rounded-md bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3 lg:text-right">
              <div className="h-9 w-36 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse lg:ml-auto" />
              <div className="h-4 w-20 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse lg:ml-auto" />
              <div className="flex gap-2">
                <div className="h-10 w-36 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="h-10 w-36 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-11 w-28 rounded-t bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="card p-5">
              <div className="h-4 w-24 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              <div className="mt-4 h-8 w-32 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              <div className="mt-4 h-4 w-full rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
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
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</p>
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
            <img
              src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
              alt={`${asset.symbol} logo`}
              className="w-16 h-16 flex-shrink-0 object-cover"
              style={{ borderRadius: 0 }}
              onLoad={(event) => {
                const image = event.currentTarget as HTMLImageElement
                if (!validateLogoImage(image)) image.dispatchEvent(new Event('error'))
              }}
              onError={(event) => handleLogoError(event, asset.symbol, asset.name, asset.asset_type)}
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
                {metrics.dailyChange === null ? '-' : formatPercent(metrics.dailyChange)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              <button
                onClick={handleAddToWatchlist}
                disabled={addingToWatchlist}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} />
                {addingToWatchlist ? 'Adding...' : 'Add to watchlist'}
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
          <AssetInvestmentNoteSummary
            note={investmentNote}
            currency={metrics.currency}
            loading={investmentNoteLoading}
            onEdit={() => setInvestmentNoteOpen(true)}
          />
          <ThemeSection themes={asset.themes || []} />
          <BusinessSection
            business={assetResearch.business}
            asset={asset}
            descriptionExpanded={descriptionExpanded}
            onToggleDescription={() => setDescriptionExpanded((expanded) => !expanded)}
          />
          <OwnershipSection ownership={assetResearch.ownership} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard label="ATH" value={formatCurrency(metadata.ath_price, metrics.currency)} />
              <InfoCard label="ATH Date" value={metadata.ath_date ? new Date(metadata.ath_date).toLocaleDateString() : '-'} />
              <InfoCard label="ATL" value={formatCurrency(metadata.atl_price, metrics.currency)} />
              <InfoCard label="ATL Date" value={metadata.atl_date ? new Date(metadata.atl_date).toLocaleDateString() : '-'} />
            </div>
          </Section>
        </div>
      )}

      {activeTab === 'fundamentals' && (
        <div className="space-y-6">
          <MaybeSection title="Fundamentals & Liquidity" metrics={metrics.fundamentals} icon={<DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />} />
          <MaybeSection title="Growth & Profitability" metrics={metrics.growth} icon={<LineChart size={20} className="text-green-600 dark:text-green-400" />} />
          <MaybeSection title="Balance Sheet" metrics={metrics.balanceSheet} icon={<Shield size={20} className="text-cyan-600 dark:text-cyan-400" />} />
        </div>
      )}

      {activeTab === 'performance' && (
        <Section title={`Relative Performance${metrics.relative.sector_etf ? ` vs ${metrics.relative.sector_etf}` : ''}`} icon={<BarChart3 size={20} className="text-indigo-600 dark:text-indigo-400" />}>
          <MetricGrid
            metrics={[
              buildRelativeMetric('1M', metrics.relative.relative_perf_30d, metrics.relative.asset_perf_30d, metrics.relative.etf_perf_30d, asset.symbol, metrics.relative.sector_etf),
              buildRelativeMetric('3M', metrics.relative.relative_perf_90d, metrics.relative.asset_perf_90d, metrics.relative.etf_perf_90d, asset.symbol, metrics.relative.sector_etf),
              buildRelativeMetric('YTD', metrics.relative.relative_perf_ytd, metrics.relative.asset_perf_ytd, metrics.relative.etf_perf_ytd, asset.symbol, metrics.relative.sector_etf),
              buildRelativeMetric('1Y', metrics.relative.relative_perf_1y, metrics.relative.asset_perf_1y, metrics.relative.etf_perf_1y, asset.symbol, metrics.relative.sector_etf),
            ].filter((metric): metric is MetricConfig => metric !== null)}
            emptyMessage="No relative performance data available yet."
          />
        </Section>
      )}

      {activeTab === 'risk' && (
        <MaybeSection title="Risk Metrics" metrics={metrics.risk} icon={<AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />} />
      )}

      {activeTab === 'analyst' && (
        <MaybeSection title="Analyst View & Valuation" metrics={metrics.analyst} icon={<Users size={20} className="text-violet-600 dark:text-violet-400" />} />
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

function buildRelativeMetric(
  label: string,
  relative: number | null,
  assetPerf: number | null,
  benchmarkPerf: number | null,
  symbol: string,
  benchmark: string | null,
): MetricConfig | null {
  if (relative === null) return null
  return {
    label,
    value: formatPercent(relative),
    color: relative >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
    subtitle: `${symbol}: ${formatPercent(assetPerf)} | ${benchmark || 'Benchmark'}: ${formatPercent(benchmarkPerf)}`,
    icon: relative >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
  }
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

function MaybeSection({ title, icon, metrics }: { title: string; icon: React.ReactNode; metrics: MetricConfig[] }) {
  if (metrics.length === 0) return null
  return (
    <Section title={title} icon={icon}>
      <MetricGrid metrics={metrics} />
    </Section>
  )
}

function ThemeSection({ themes }: { themes: AssetResearchDTO['asset']['themes'] }) {
  if (!themes || themes.length === 0) return null

  return (
    <Section title="Themes & Exposures" icon={<Tags size={20} className="text-neutral-600 dark:text-neutral-400" />}>
      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => (
          (() => {
            const ThemeIcon = getThemeIcon(theme.label)
            const themeColor = getThemeColor(theme.label)
            const themeHex = getThemeHexColor(theme.label)

            return (
              <span
                key={theme.label}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors dark:shadow-none"
                style={{ borderColor: `${themeHex}40`, backgroundColor: `${themeHex}12` }}
                title={theme.evidence?.length ? theme.evidence.join(', ') : undefined}
              >
                <ThemeIcon size={14} className={themeColor} />
                <span className={themeColor}>{theme.label}</span>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {Math.round(theme.confidence * 100)}%
                </span>
              </span>
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

function MetricGrid({ metrics, emptyMessage = 'No data available.' }: { metrics: MetricConfig[]; emptyMessage?: string }) {
  if (metrics.length === 0) {
    return (
      <div className="card p-6 text-center text-neutral-500 dark:text-neutral-400">
        {emptyMessage}
      </div>
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

function MetricCard({ label, value, color, subtitle, icon }: MetricConfig) {
  return (
    <div className="card p-5 bg-neutral-50 dark:bg-neutral-800/50">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-neutral-900 dark:text-neutral-100'} flex items-center gap-2 min-w-0`}>
        {icon}
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
