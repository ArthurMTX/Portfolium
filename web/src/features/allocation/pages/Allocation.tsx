import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import api, {
  type AssetThemeDTO,
  type DistributionItemDTO,
  type PortfolioMetricsDTO,
  type PositionDTO,
  type ThemeDistributionItemDTO,
} from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import { getAssetLogoUrl, handleLogoError } from '@/shared/lib/logoUtils'
import { getFlagUrl } from '@/shared/lib/countryUtils'
import { getSectorHexColor, getSectorIcon } from '@/shared/lib/sectorIndustryUtils'
import { getThemeHexColor, getThemeIcon } from '@/shared/lib/themeUtils'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { getTranslatedAssetType, getTranslatedSector } from '@/shared/lib/translationUtils'
import { ListSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
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
import { useTranslation } from 'react-i18next'
import '@/shared/design/pages/allocation.css'

interface HeldAsset {
  id: number
  symbol: string
  name: string
  currency: string
  class: string
  sector: string | null
  industry: string | null
  asset_type: string | null
  total_quantity: number
  portfolio_count: number
  country?: string | null
  effective_sector?: string | null
  effective_country?: string | null
  themes?: AssetThemeDTO[]
  created_at: string
  updated_at: string
}

type AllocationLens = 'sector' | 'country' | 'assetClass' | 'currency' | 'theme' | 'marketCap'

interface AllocationItem {
  key: string
  label: string
  value: number
  percentage: number
  count: number
  assetIds: number[]
}

const lenses: Array<{ id: AllocationLens; label: string }> = [
  { id: 'sector', label: 'Sector' },
  { id: 'country', label: 'Country' },
  { id: 'assetClass', label: 'Asset class' },
  { id: 'currency', label: 'Currency' },
  { id: 'theme', label: 'Theme' },
  { id: 'marketCap', label: 'Market cap' },
]

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function positionValue(position: PositionDTO | null | undefined): number {
  if (!position) return 0
  return toNumber(position.market_value) || toNumber(position.cost_basis)
}

function isUnknownLabel(label: string): boolean {
  const normalized = label.toLowerCase()
  return normalized.includes('unknown')
    || normalized.includes('unavailable')
    || normalized.includes('uncategorized')
    || normalized.includes('missing')
    || normalized === '-'
}

function fromDistributionItems(items: DistributionItemDTO[], labelMapper: (label: string) => string = (label) => label): AllocationItem[] {
  return items.map((item) => ({
    key: item.name,
    label: labelMapper(item.name),
    value: toNumber(item.total_value),
    percentage: toNumber(item.percentage),
    count: item.count,
    assetIds: item.asset_ids || [],
  }))
}

function hasAllocationMark(lens: AllocationLens): boolean {
  return lens === 'sector' || lens === 'country' || lens === 'theme'
}

function AllocationMark({
  lens,
  item,
  size = 'row',
}: {
  lens: AllocationLens
  item: AllocationItem
  size?: 'row' | 'hero'
}) {
  if (lens === 'country') {
    const flagUrl = getFlagUrl(item.key, 'w40') || getFlagUrl(item.label, 'w40')

    return (
      <span
        className={`allocation-mark allocation-mark-${size} ${flagUrl ? 'is-flag' : 'is-fallback'}`}
        aria-hidden="true"
      >
        {flagUrl ? <img src={flagUrl} alt="" loading="lazy" /> : item.label.slice(0, 2).toUpperCase()}
      </span>
    )
  }

  if (lens === 'sector' || lens === 'theme') {
    const Icon = lens === 'sector' ? getSectorIcon(item.key) : getThemeIcon(item.key)
    const color = lens === 'sector' ? getSectorHexColor(item.key) : getThemeHexColor(item.key)

    return (
      <span
        className={`allocation-mark allocation-mark-${size} is-icon`}
        style={{ '--allocation-mark-color': color } as CSSProperties}
        aria-hidden="true"
      >
        <Icon size={size === 'hero' ? 24 : 18} strokeWidth={2.2} />
      </span>
    )
  }

  return null
}

export default function Allocation() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = i18n.language || navigator.language
  const { portfolios, activePortfolioId, setPortfolios, setActivePortfolio } = usePortfolioStore()
  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'EUR'

  const [activeLens, setActiveLens] = useState<AllocationLens>('sector')
  const [expandedAllocationKey, setExpandedAllocationKey] = useState<string | null>(null)
  const [heldAssets, setHeldAssets] = useState<HeldAsset[]>([])
  const [positions, setPositions] = useState<PositionDTO[]>([])
  const [metrics, setMetrics] = useState<PortfolioMetricsDTO | null>(null)
  const [sectorItems, setSectorItems] = useState<DistributionItemDTO[]>([])
  const [countryItems, setCountryItems] = useState<DistributionItemDTO[]>([])
  const [assetClassItems, setAssetClassItems] = useState<DistributionItemDTO[]>([])
  const [marketCapItems, setMarketCapItems] = useState<DistributionItemDTO[]>([])
  const [themeItems, setThemeItems] = useState<ThemeDistributionItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAllocation = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let portfolioSource = portfolios
      if (portfolioSource.length === 0) {
        portfolioSource = await api.getPortfolios()
        setPortfolios(portfolioSource)
      }

      const resolvedPortfolioId = activePortfolioId ?? portfolioSource[0]?.id ?? null
      if (!activePortfolioId && resolvedPortfolioId) {
        setActivePortfolio(resolvedPortfolioId)
      }

      if (!resolvedPortfolioId) {
        setHeldAssets([])
        setPositions([])
        return
      }

      const [
        held,
        portfolioPositions,
        portfolioMetrics,
        sectors,
        countries,
        types,
        marketCaps,
        themes,
      ] = await Promise.all([
        api.getHeldAssets(resolvedPortfolioId),
        api.getPortfolioPositions(resolvedPortfolioId),
        api.getPortfolioMetrics(resolvedPortfolioId),
        api.getSectorsDistribution(resolvedPortfolioId),
        api.getCountriesDistribution(resolvedPortfolioId),
        api.getTypesDistribution(resolvedPortfolioId),
        api.getMarketCapsDistribution(resolvedPortfolioId),
        api.getThemesDistribution(resolvedPortfolioId).catch(() => [] as ThemeDistributionItemDTO[]),
      ])

      setHeldAssets(held)
      setPositions(portfolioPositions)
      setMetrics(portfolioMetrics)
      setSectorItems(sectors)
      setCountryItems(countries)
      setAssetClassItems(types)
      setMarketCapItems(marketCaps)
      setThemeItems(themes)
    } catch (err) {
      console.error('Failed to load allocation:', err)
      setError('Failed to load allocation')
    } finally {
      setLoading(false)
    }
  }, [activePortfolioId, portfolios, setActivePortfolio, setPortfolios])

  useEffect(() => {
    loadAllocation()
  }, [loadAllocation])

  const assetById = useMemo(() => new Map(heldAssets.map((asset) => [asset.id, asset])), [heldAssets])
  const assetBySymbol = useMemo(() => new Map(heldAssets.map((asset) => [asset.symbol, asset])), [heldAssets])
  const positionByAssetId = useMemo(() => new Map(positions.map((position) => [position.asset_id, position])), [positions])

  const totalValue = useMemo(
    () => toNumber(metrics?.total_value) || positions.reduce((sum, position) => sum + positionValue(position), 0),
    [metrics?.total_value, positions],
  )

  const currencyItems = useMemo(() => {
    const byCurrency = new Map<string, AllocationItem>()

    for (const asset of heldAssets) {
      const value = positionValue(positionByAssetId.get(asset.id))
      const currency = asset.currency || portfolioCurrency
      const current = byCurrency.get(currency) || {
        key: currency,
        label: currency,
        value: 0,
        percentage: 0,
        count: 0,
        assetIds: [],
      }

      current.value += value
      current.count += 1
      current.assetIds.push(asset.id)
      byCurrency.set(currency, current)
    }

    return Array.from(byCurrency.values()).map((item) => ({
      ...item,
      percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
    }))
  }, [heldAssets, portfolioCurrency, positionByAssetId, totalValue])

  const themeAllocationItems = useMemo(() => themeItems.map((theme) => ({
    key: theme.theme,
    label: theme.theme,
    value: toNumber(theme.value),
    percentage: toNumber(theme.percentage),
    count: theme.assets.length,
    assetIds: theme.assets
      .map((asset) => assetBySymbol.get(asset.symbol)?.id)
      .filter((id): id is number => id !== undefined),
  })), [assetBySymbol, themeItems])

  const allocationByLens = useMemo<Record<AllocationLens, AllocationItem[]>>(() => ({
    sector: fromDistributionItems(sectorItems, (label) => getTranslatedSector(label, t)),
    country: fromDistributionItems(countryItems),
    assetClass: fromDistributionItems(assetClassItems, (label) => getTranslatedAssetType(label, t)),
    currency: currencyItems,
    theme: themeAllocationItems,
    marketCap: fromDistributionItems(marketCapItems, (label) => t(`assetsDistribution.marketCapBuckets.${label}`, label)),
  }), [assetClassItems, countryItems, currencyItems, marketCapItems, sectorItems, t, themeAllocationItems])

  const activeItems = useMemo(
    () => [...allocationByLens[activeLens]].sort((a, b) => b.value - a.value),
    [activeLens, allocationByLens],
  )

  const selectedAllocation = activeItems.find((item) => item.key === expandedAllocationKey) || activeItems[0] || null
  const selectedAssets = useMemo(() => {
    if (!selectedAllocation) return []
    return selectedAllocation.assetIds
      .map((assetId) => assetById.get(assetId))
      .filter((asset): asset is HeldAsset => Boolean(asset))
      .sort((a, b) => positionValue(positionByAssetId.get(b.id)) - positionValue(positionByAssetId.get(a.id)))
  }, [assetById, positionByAssetId, selectedAllocation])

  const topPositions = useMemo(
    () => [...positions].sort((a, b) => positionValue(b) - positionValue(a)),
    [positions],
  )
  const topHolding = topPositions[0] || null
  const topThreeValue = topPositions.slice(0, 3).reduce((sum, position) => sum + positionValue(position), 0)
  const topTenValue = topPositions.slice(0, 10).reduce((sum, position) => sum + positionValue(position), 0)
  const largestSector = [...allocationByLens.sector].sort((a, b) => b.value - a.value)[0] || null
  const largestCountry = [...allocationByLens.country].sort((a, b) => b.value - a.value)[0] || null

  const unknownItems = useMemo(() => {
    const unknowns: Array<{ lens: string; item: AllocationItem }> = []
    for (const lens of lenses) {
      if (lens.id === 'currency') continue
      for (const item of allocationByLens[lens.id]) {
        if (isUnknownLabel(item.label) || isUnknownLabel(item.key)) {
          unknowns.push({ lens: lens.label, item })
        }
      }
    }
    return unknowns.sort((a, b) => b.item.value - a.item.value)
  }, [allocationByLens])

  const sectorsCount = allocationByLens.sector.filter((item) => item.value > 0 && !isUnknownLabel(item.label)).length
  const countriesCount = allocationByLens.country.filter((item) => item.value > 0 && !isUnknownLabel(item.label)).length
  const currenciesCount = allocationByLens.currency.filter((item) => item.value > 0).length
  const etfCount = heldAssets.filter((asset) => (asset.asset_type || asset.class || '').toLowerCase().includes('etf')).length

  if (portfolios.length === 0 && !loading) {
    return <EmptyPortfolioPrompt pageType="assets" />
  }

  if (error) {
    return (
      <PageShell className="allocation-page">
        <StateBlock
          tone="error"
          className="allocation-empty"
          eyebrow="Allocation"
          title="Could not load allocation."
          description="Portfolio distribution data could not be refreshed."
          detail={error}
          actionLabel={t('common.retry')}
          onAction={loadAllocation}
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="allocation-page">
      <PageHeader>
        <PageTitleBlock
          kicker="Allocation"
          title={`${formatCurrency(totalValue, portfolioCurrency, locale)} deployed.`}
        />
        <PageSummaryPanel
          lead={`${heldAssets.length} ${heldAssets.length === 1 ? 'position' : 'positions'} across the active portfolio.`}
        >
          <div className="allocation-hero-facts">
            <span>{sectorsCount} sectors.</span>
            <span>{countriesCount} countries.</span>
            <span>{currenciesCount} currencies.</span>
          </div>
        </PageSummaryPanel>
      </PageHeader>

      <PageMetricStrip label="Concentration">
        <PageMetric
          label="Top holding"
          value={topHolding ? `${((positionValue(topHolding) / totalValue) * 100).toFixed(1)}%` : '—'}
          detail={topHolding?.symbol || 'No position'}
        />
        <PageMetric
          label="Top 3"
          value={totalValue > 0 ? `${((topThreeValue / totalValue) * 100).toFixed(1)}%` : '—'}
          detail={formatCurrency(topThreeValue, portfolioCurrency, locale)}
        />
        <PageMetric
          label="Top 10"
          value={totalValue > 0 ? `${((topTenValue / totalValue) * 100).toFixed(1)}%` : '—'}
          detail={formatCurrency(topTenValue, portfolioCurrency, locale)}
        />
        <PageMetric
          label="Largest country"
          value={largestCountry?.label || '—'}
          detail={largestCountry ? `${largestCountry.percentage.toFixed(1)}%` : '—'}
        />
        <PageMetric
          label="Largest sector"
          value={largestSector?.label || '—'}
          detail={largestSector ? `${largestSector.percentage.toFixed(1)}%` : '—'}
        />
      </PageMetricStrip>

      <PageControls
        label="Allocation lens"
        start={
          <PageTabs label="Allocation lens" role="tablist">
            {lenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                role="tab"
                aria-selected={activeLens === lens.id}
                className={activeLens === lens.id ? 'is-active' : undefined}
                onClick={() => {
                  setActiveLens(lens.id)
                  setExpandedAllocationKey(null)
                }}
              >
                {lens.label}
              </button>
            ))}
          </PageTabs>
        }
      />

      <PageSection className="allocation-section">
        <PageSectionHeader
          kicker="Where your capital lives"
          title="Which parts of the portfolio own your money?"
        />

        {loading ? (
          <ListSkeleton className="allocation-loading" rows={5} label="Loading allocation" />
        ) : activeItems.length === 0 ? (
          <StateBlock
            className="allocation-empty"
            eyebrow="No allocation data"
            title="No allocation data for this lens yet."
            description="Classification data is missing or portfolio values are unavailable."
          />
        ) : (
          <PageMainGrid>
            <PageMainColumn className="allocation-ranking">
              {activeItems.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  className={[
                    selectedAllocation?.key === item.key ? 'is-selected' : '',
                    hasAllocationMark(activeLens) ? 'has-mark' : 'has-no-mark',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setExpandedAllocationKey(selectedAllocation?.key === item.key ? null : item.key)}
                >
                  <span className="allocation-rank">{String(index + 1).padStart(2, '0')}</span>
                  {hasAllocationMark(activeLens) && <AllocationMark lens={activeLens} item={item} />}
                  <span className="allocation-rank-name">{item.label}</span>
                  <strong>{formatCurrency(item.value, portfolioCurrency, locale)}</strong>
                  <em>{item.percentage.toFixed(1)}%</em>
                  <i style={{ inlineSize: `${Math.min(100, item.percentage)}%` }} />
                </button>
              ))}
            </PageMainColumn>

            <PageAsideColumn className="allocation-explainer">
              {selectedAllocation && (
                <>
                  <p className="allocation-explainer-label">
                    <AllocationMark lens={activeLens} item={selectedAllocation} size="hero" />
                    <span>{selectedAllocation.label}</span>
                  </p>
                  <h3>{formatCurrency(selectedAllocation.value, portfolioCurrency, locale)}</h3>
                  <strong>{selectedAllocation.percentage.toFixed(1)}% of portfolio capital</strong>
                  <span>
                    {selectedAllocation.count} {selectedAllocation.count === 1 ? 'position' : 'positions'} explain this allocation.
                  </span>
                  <div className="allocation-holdings">
                    {selectedAssets.slice(0, 8).map((asset) => {
                      const position = positionByAssetId.get(asset.id)
                      const value = positionValue(position)
                      const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0
                      return (
                        <button
                          key={asset.id}
                          onClick={() => navigate(`/assets/${encodeURIComponent(asset.symbol)}/research`)}
                        >
                          <img
                            src={getAssetLogoUrl(asset.symbol, asset.asset_type, asset.name)}
                            alt=""
                            loading="lazy"
                            onError={(event) => handleLogoError(event, asset.symbol, asset.name, asset.asset_type)}
                          />
                          <span>
                            <strong>{asset.symbol}</strong>
                            <em>{asset.name}</em>
                          </span>
                          <b>{formatCurrency(value, portfolioCurrency, locale)}</b>
                          <small>{percentage.toFixed(1)}%</small>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </PageAsideColumn>
          </PageMainGrid>
        )}
      </PageSection>

      <PageSection className="allocation-section">
        <PageSectionHeader
          kicker="Unknown exposure"
          title="What capital still lacks classification?"
        />
        {unknownItems.length > 0 ? (
          <div className="allocation-unknown">
            <h3>{formatCurrency(unknownItems[0].item.value, portfolioCurrency, locale)}</h3>
            <p>
              {unknownItems[0].item.percentage.toFixed(1)}% of your capital is currently unclassified in {unknownItems[0].lens.toLowerCase()}.
            </p>
            <div>
              {unknownItems.slice(0, 5).map(({ lens, item }) => (
                <span key={`${lens}-${item.key}`}>
                  {lens}: {formatCurrency(item.value, portfolioCurrency, locale)} · {item.percentage.toFixed(1)}%
                </span>
              ))}
            </div>
            <button onClick={() => navigate('/assets')}>Review classifications →</button>
          </div>
        ) : (
          <div className="allocation-unknown is-clear">
            <h3>No major unknown allocation bucket.</h3>
            <p>Your current capital has usable classification data across the main lenses.</p>
          </div>
        )}
      </PageSection>

      <PageSection className="allocation-section">
        <PageSectionHeader
          kicker="Diversification"
          title="Your portfolio spans capital, not scores."
        />
        <div className="allocation-story">
          <p>
            Your portfolio spans <strong>{countriesCount} countries</strong>, <strong>{sectorsCount} sectors</strong> and{' '}
            <strong>{heldAssets.length} companies or funds</strong>.
          </p>
          {largestSector && (
            <p>
              However, <strong>{largestSector.percentage.toFixed(1)}%</strong> remains concentrated in{' '}
              <strong>{largestSector.label}</strong>.
            </p>
          )}
          {largestCountry && (
            <p>
              Geographically, <strong>{largestCountry.label}</strong> is the largest home for your capital at{' '}
              <strong>{largestCountry.percentage.toFixed(1)}%</strong>.
            </p>
          )}
        </div>
      </PageSection>

      {etfCount > 0 && (
        <PageSection className="allocation-section">
          <PageSectionHeader
            kicker="Look through"
            title="ETF ownership needs underlying exposure."
          />
          <div className="allocation-future">
            <p>You own {etfCount} ETF {etfCount === 1 ? 'position' : 'positions'}.</p>
            <span>Underlying constituent exposure is not available yet. This section is reserved for ETF overlap and look-through analysis.</span>
          </div>
        </PageSection>
      )}

      <PageSection className="allocation-section">
        <PageSectionHeader
          kicker="Changes over time"
          title="Allocation history appears only when it explains something."
        />
        <div className="allocation-future">
          <p>Not enough allocation history is available yet.</p>
          <span>When meaningful changes emerge, this section will show movements such as Technology 41% → 58% without turning into a chart wall.</span>
        </div>
      </PageSection>
    </PageShell>
  )
}
