import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import type { AssetLookupResult, PositionDTO } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import AssetLogo from '@/shared/components/AssetLogo'
import { ListSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import {
  PageAsideColumn,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageShell,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import '@/shared/design/pages/asset-research-search.css'

type ResearchAssetResult = AssetLookupResult
type MarketMoverTab = 'trending' | 'gainers' | 'losers'

interface WatchlistResearchItem {
  asset_id: number
  symbol: string
  name: string | null
  currency: string
  asset_type: string | null
}

interface AssetEnrichment {
  displayName: string
  assetType: string | null
  country: string | null
  countryCode: string | null
  currency: string | null
  isin: string | null
  sector: string | null
  statusLine: string | null
  statusLabel: string | null
  statusTone: 'owned' | 'watchlist' | null
}

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const RECENT_SEARCHES_KEY = 'portfolium.research.recentSearches'
const MAX_RECENT_SEARCHES = 8

const MARKET_MOVER_TABS: Array<{ key: MarketMoverTab; labelKey: string }> = [
  { key: 'trending', labelKey: 'assets.searchResearchMoversTrending' },
  { key: 'gainers', labelKey: 'assets.searchResearchMoversGainers' },
  { key: 'losers', labelKey: 'assets.searchResearchMoversLosers' },
]

const COUNTRY_BY_SUFFIX: Record<string, { code: string; name: string; currency?: string }> = {
  AS: { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  PA: { code: 'FR', name: 'France', currency: 'EUR' },
  DE: { code: 'DE', name: 'Germany', currency: 'EUR' },
  MI: { code: 'IT', name: 'Italy', currency: 'EUR' },
  MC: { code: 'ES', name: 'Spain', currency: 'EUR' },
  L: { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  TO: { code: 'CA', name: 'Canada', currency: 'CAD' },
  SW: { code: 'CH', name: 'Switzerland', currency: 'CHF' },
}

const COUNTRY_BY_EXCHANGE: Record<string, { code: string; name: string; currency?: string }> = {
  NMS: { code: 'US', name: 'United States', currency: 'USD' },
  NYQ: { code: 'US', name: 'United States', currency: 'USD' },
  NAS: { code: 'US', name: 'United States', currency: 'USD' },
  PCX: { code: 'US', name: 'United States', currency: 'USD' },
  PAR: { code: 'FR', name: 'France', currency: 'EUR' },
  AMS: { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  GER: { code: 'DE', name: 'Germany', currency: 'EUR' },
  LSE: { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  TOR: { code: 'CA', name: 'Canada', currency: 'CAD' },
}

function normalizeSymbol(symbol: string | null | undefined) {
  return (symbol || '').trim().toUpperCase()
}

function compactAssetType(type: string | null | undefined) {
  const normalized = (type || '').replace(/_/g, ' ').trim().toUpperCase()
  if (!normalized) return null
  const labels: Record<string, string> = {
    EQUITY: 'Equity',
    STOCK: 'Equity',
    ETF: 'ETF',
    FUND: 'Fund',
    MUTUALFUND: 'Fund',
    'MUTUAL FUND': 'Fund',
    CRYPTO: 'Crypto',
    CRYPTOCURRENCY: 'Crypto',
    INDEX: 'Index',
    CURRENCY: 'Currency',
  }
  return labels[normalized] || normalized.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function inferMarket(symbol: string, exchange: string | null | undefined) {
  const exchangeKey = (exchange || '').trim().toUpperCase()
  if (exchangeKey && COUNTRY_BY_EXCHANGE[exchangeKey]) return COUNTRY_BY_EXCHANGE[exchangeKey]

  const suffix = symbol.includes('.') ? symbol.split('.').pop()?.toUpperCase() : null
  if (suffix && COUNTRY_BY_SUFFIX[suffix]) return COUNTRY_BY_SUFFIX[suffix]

  if (/^[A-Z]{1,5}$/.test(symbol)) return COUNTRY_BY_EXCHANGE.NMS
  return null
}

function loadRecentSearches(): ResearchAssetResult[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is ResearchAssetResult => {
      return Boolean(entry && typeof entry.symbol === 'string')
    })
  } catch {
    return []
  }
}

function metadataParts(item: ResearchAssetResult, enrichment: AssetEnrichment): ReactNode[] {
  const parts: ReactNode[] = []
  const typeLabel = compactAssetType(enrichment.assetType)
  const flagUrl = getFlagUrl(enrichment.countryCode || enrichment.country, 'w20')

  if (typeLabel) parts.push(typeLabel)
  if (enrichment.country) {
    parts.push(
      <span className="asset-research-search__country">
        {flagUrl && <img src={flagUrl} alt="" loading="lazy" />}
        {enrichment.country}
      </span>
    )
  }
  if (enrichment.currency) parts.push(enrichment.currency)
  if (enrichment.isin) parts.push(enrichment.isin)
  if (parts.length === 0 && item.exchange) parts.push(item.exchange)

  return parts
}

function parseDailyMove(value: ResearchAssetResult['daily_change_pct']) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function AssetResultRow({
  item,
  enrichment,
  onSelect,
  showDailyMove = false,
}: {
  item: ResearchAssetResult
  enrichment: AssetEnrichment
  onSelect: (item: ResearchAssetResult) => void
  showDailyMove?: boolean
}) {
  const parts = metadataParts(item, enrichment)
  const symbol = normalizeSymbol(item.symbol)
  const dailyMove = showDailyMove ? parseDailyMove(item.daily_change_pct) : null

  return (
    <li>
      <button type="button" className="asset-research-search__row" onClick={() => onSelect(item)}>
        <AssetLogo
          symbol={symbol}
          assetName={enrichment.displayName}
          assetType={enrichment.assetType}
          logoLightUrl={item.logo_light_url}
          logoDarkUrl={item.logo_dark_url}
          logoUrl={item.logo_url}
          className="asset-research-search__logo"
          alt=""
        />
        <span className="asset-research-search__body">
          <span className="asset-research-search__title-line">
            <strong>{symbol}</strong>
            {enrichment.statusTone && (
              <span className={`asset-research-search__status-pill is-${enrichment.statusTone}`}>
                {enrichment.statusLabel}
              </span>
            )}
            {dailyMove !== null && (
              <span className={`asset-research-search__move ${dailyMove < 0 ? 'is-negative' : 'is-positive'}`}>
                {dailyMove > 0 ? '+' : ''}
                {dailyMove.toFixed(2)}%
              </span>
            )}
          </span>
          <span className="asset-research-search__name">{enrichment.displayName || symbol}</span>
          {parts.length > 0 && (
            <span className="asset-research-search__meta-line">
              {parts.map((part, index) => (
                <span key={index} className="asset-research-search__meta-part">
                  {part}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

export default function AssetResearchSearch() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResearchAssetResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<ResearchAssetResult[]>(() => loadRecentSearches())
  const [activeMoverTab, setActiveMoverTab] = useState<MarketMoverTab>('trending')
  const requestIdRef = useRef(0)

  const portfoliosQuery = useQuery({
    queryKey: ['research-portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 5 * 60 * 1000,
  })

  const portfolios = portfoliosQuery.data ?? []
  const researchPortfolioId = activePortfolioId ?? portfolios[0]?.id ?? null
  const researchPortfolio = portfolios.find((portfolio) => portfolio.id === researchPortfolioId) ?? null

  const positionsQuery = useQuery({
    queryKey: ['research-positions', researchPortfolioId],
    queryFn: () => api.getPortfolioPositions(researchPortfolioId!),
    enabled: Boolean(researchPortfolioId),
    staleTime: 60 * 1000,
  })

  const watchlistQuery = useQuery({
    queryKey: ['research-watchlist'],
    queryFn: () => api.getWatchlist(),
    staleTime: 60 * 1000,
  })

  const marketMoversQuery = useQuery({
    queryKey: ['market-movers'],
    queryFn: () => api.getMarketMovers(),
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      requestIdRef.current += 1
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    const timer = setTimeout(() => {
      api
        .searchTicker(trimmed)
        .then((data) => {
          if (requestIdRef.current === requestId) setResults(data)
        })
        .catch((err) => {
          if (requestIdRef.current !== requestId) return
          setError(err instanceof Error ? err.message : t('assets.searchResearchError'))
          setResults([])
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, t])

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data])
  const watchlist = useMemo(() => (watchlistQuery.data ?? []) as WatchlistResearchItem[], [watchlistQuery.data])
  const portfolioValue = useMemo(
    () => positions.reduce((sum, position) => sum + (Number(position.market_value) || 0), 0),
    [positions]
  )
  const positionsBySymbol = useMemo(() => {
    const map = new Map<string, PositionDTO>()
    positions.forEach((position) => map.set(normalizeSymbol(position.symbol), position))
    return map
  }, [positions])
  const watchlistBySymbol = useMemo(() => {
    const map = new Map<string, WatchlistResearchItem>()
    watchlist.forEach((item) => map.set(normalizeSymbol(item.symbol), item))
    return map
  }, [watchlist])

  const enrichAsset = useCallback(
    (item: ResearchAssetResult): AssetEnrichment => {
      const symbol = normalizeSymbol(item.symbol)
      const position = positionsBySymbol.get(symbol)
      const watchlistItem = watchlistBySymbol.get(symbol)
      const market = inferMarket(symbol, item.exchange)
      const assetType = position?.asset_type || watchlistItem?.asset_type || item.asset_type || item.type || null
      const country = item.country || position?.effective_country || position?.country || market?.name || null
      const countryCode = item.country_code || market?.code || null
      const currency = item.currency || position?.currency || watchlistItem?.currency || market?.currency || null
      const name = item.name || position?.name || watchlistItem?.name || symbol
      const sector = position?.effective_sector || position?.sector || null
      const isin = item.isin || null

      if (position) {
        const weight = portfolioValue > 0 && position.market_value !== null
          ? (Number(position.market_value) / portfolioValue) * 100
          : null
        const portfolioName = researchPortfolio?.name || t('assets.searchResearchPortfolio')
        return {
          displayName: name,
          assetType,
          country,
          countryCode,
          currency,
          isin,
          sector,
          statusLine: weight !== null
            ? t('assets.searchResearchOwnedWeight', { weight: weight.toFixed(1), portfolio: portfolioName })
            : t('assets.searchResearchOwned'),
          statusLabel: t('assets.searchResearchOwned'),
          statusTone: 'owned',
        }
      }

      if (watchlistItem) {
        return {
          displayName: name,
          assetType,
          country,
          countryCode,
          currency,
          isin,
          sector,
          statusLine: t('assets.searchResearchWatchlist'),
          statusLabel: t('assets.searchResearchWatchlist'),
          statusTone: 'watchlist',
        }
      }

      return {
        displayName: name,
        assetType,
        country,
        countryCode,
        currency,
        isin,
        sector,
        statusLine: sector || currency ? [sector, currency].filter(Boolean).join(' · ') : null,
        statusLabel: null,
        statusTone: null,
      }
    },
    [portfolioValue, positionsBySymbol, researchPortfolio?.name, t, watchlistBySymbol]
  )

  function rememberSearch(item: ResearchAssetResult) {
    const nextItem = {
      ...item,
      symbol: normalizeSymbol(item.symbol),
      name: item.name || normalizeSymbol(item.symbol),
    }
    const next = [nextItem, ...recent.filter((entry) => normalizeSymbol(entry.symbol) !== nextItem.symbol)].slice(
      0,
      MAX_RECENT_SEARCHES
    )

    setRecent(next)

    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage failures; recents are a convenience, not critical.
    }
  }

  function clearRecentSearches() {
    setRecent([])
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // Ignore storage failures.
    }
  }

  function openResearch(item: ResearchAssetResult | string) {
    const resolved: ResearchAssetResult =
      typeof item === 'string' ? { symbol: item.trim().toUpperCase(), name: item.trim().toUpperCase() } : item
    resolved.symbol = normalizeSymbol(resolved.symbol)
    if (!resolved.symbol) return
    rememberSearch(resolved)
    navigate(`/assets/${encodeURIComponent(resolved.symbol)}/research`)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (results.length > 0) {
      openResearch(results[0])
    } else if (query.trim()) {
      openResearch(query)
    }
  }

  const isIdle = query.trim().length < MIN_QUERY_LENGTH
  const isEmpty = !isIdle && !loading && !error && results.length === 0
  const recentItems = recent
  const marketMovers = useMemo(
    () => marketMoversQuery.data ?? { trending: [], gainers: [], losers: [] },
    [marketMoversQuery.data]
  )
  const availableMoverTabs = useMemo(
    () => MARKET_MOVER_TABS.filter((tab) => marketMovers[tab.key].length > 0),
    [marketMovers]
  )
  const activeMovers = marketMovers[activeMoverTab] ?? []
  const isMoversEmpty = !marketMoversQuery.isLoading && !marketMoversQuery.isError && availableMoverTabs.length === 0

  useEffect(() => {
    if (availableMoverTabs.length > 0 && !availableMoverTabs.some((tab) => tab.key === activeMoverTab)) {
      setActiveMoverTab(availableMoverTabs[0].key)
    }
  }, [activeMoverTab, availableMoverTabs])

  return (
    <PageShell className="asset-research-search">
      <PageHeader>
        <PageTitleBlock
          kicker={t('assets.research')}
          title={t('assets.searchResearch')}
        />
      </PageHeader>

      <PageMainGrid className="asset-research-search__hero-grid">
        <PageMainColumn className="asset-research-search__search-column">
          <form className="pf-search asset-research-search__form" onSubmit={handleSubmit} role="search">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('assets.searchResearchPlaceholder')}
              aria-label={t('assets.searchResearchPlaceholder')}
              autoFocus
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear')}>
                <X size={14} />
              </button>
            )}
          </form>

          <div className="asset-research-search__panel">
            {isIdle ? (
              <>
                <div className="asset-research-search__panel-header">
                  <div>
                    <h2 className="pf-section-title">{t('assets.searchResearchRecent')}</h2>
                  </div>
                  {recentItems.length > 0 && (
                    <button type="button" className="asset-research-search__clear-recent" onClick={clearRecentSearches}>
                      {t('assets.searchResearchClearRecent')}
                    </button>
                  )}
                </div>
                {recentItems.length > 0 ? (
                  <ul className="asset-research-search__list">
                    {recentItems.map((item) => (
                      <AssetResultRow
                        key={`recent-${item.symbol}`}
                        item={item}
                        enrichment={enrichAsset(item)}
                        onSelect={openResearch}
                      />
                    ))}
                  </ul>
                ) : (
                  <StateBlock
                    tone="empty"
                    className="asset-research-search__empty-state"
                    title={t('assets.searchResearchRecentEmpty')}
                    description={t('assets.searchResearchRecentEmptyDescription')}
                  />
                )}
              </>
            ) : (
              <div className="asset-research-search__results">
                <h2 className="pf-section-title">{t('assets.searchResearchResults')}</h2>

                {loading && <ListSkeleton rows={5} label={t('assets.searchResearchResultsLoading')} />}

                {!loading && error && (
                  <StateBlock tone="error" title={t('assets.searchResearchError')} description={error} />
                )}

                {isEmpty && <StateBlock tone="empty" title={t('assets.searchResearchNoResults')} />}

                {!loading && !error && results.length > 0 && (
                  <ul className="asset-research-search__list">
                    {results.map((item) => (
                      <AssetResultRow
                        key={`${item.symbol}-${item.type || item.asset_type || ''}`}
                        item={item}
                        enrichment={enrichAsset(item)}
                        onSelect={openResearch}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </PageMainColumn>

        <PageAsideColumn className="asset-research-search__panel">
          <h2 className="pf-section-title">{t('assets.searchResearchMovers')}</h2>

          {marketMoversQuery.isLoading && <ListSkeleton rows={6} label={t('assets.searchResearchMoversLoading')} />}

          {!marketMoversQuery.isLoading && marketMoversQuery.isError && (
            <StateBlock
              tone="error"
              title={t('assets.searchResearchMoversError')}
              description={marketMoversQuery.error instanceof Error ? marketMoversQuery.error.message : undefined}
            />
          )}

          {isMoversEmpty && (
            <StateBlock
              tone="empty"
              title={t('assets.searchResearchMoversEmpty')}
              description={t('assets.searchResearchMoversEmptyDescription')}
            />
          )}

          {!marketMoversQuery.isLoading && !marketMoversQuery.isError && availableMoverTabs.length > 0 && (
            <>
              <PageTabs className="asset-research-search__tabs" label={t('assets.searchResearchMovers')}>
                {availableMoverTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={activeMoverTab === tab.key ? 'is-active' : undefined}
                    onClick={() => setActiveMoverTab(tab.key)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </PageTabs>

              <ul className="asset-research-search__list asset-research-search__list--market-movers">
                {activeMovers.map((item) => (
                  <AssetResultRow
                    key={`${activeMoverTab}-${item.symbol}`}
                    item={item}
                    enrichment={enrichAsset(item)}
                    onSelect={openResearch}
                    showDailyMove
                  />
                ))}
              </ul>
            </>
          )}
        </PageAsideColumn>
      </PageMainGrid>
    </PageShell>
  )
}
