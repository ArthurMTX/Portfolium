import { Fragment, useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Edit,
  LineChart,
  NotebookPen,
  RefreshCw,
  Search,
  Shuffle,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api, { AssetInvestmentNoteDTO, AssetThemeDTO, type PositionDTO } from '@/api'
import AssetLogo from '@/shared/components/AssetLogo'
import { getCountryCode } from '@/shared/lib/countryUtils'
import SplitHistory from '@/features/assets/components/SplitHistory'
import TransactionHistory from '@/features/assets/components/TransactionHistory'
import AssetPriceChart from '@/features/assets/components/AssetPriceChart'
import SortIcon from '@/shared/components/SortIcon'
import AssetPriceDebug from '@/features/assets/components/AssetPriceDebug'
import AssetMetadataEdit from '@/features/assets/components/AssetMetadataEdit'
import AssetInvestmentNoteModal from '@/features/assets/components/AssetInvestmentNoteModal'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import EmptyTransactionsPrompt from '@/features/transactions/components/EmptyTransactionsPrompt'
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
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { useTranslation } from 'react-i18next'
import {
  getTranslatedAssetClass,
  getTranslatedAssetType,
  getTranslatedIndustry,
  getTranslatedSector,
} from '@/shared/lib/translationUtils'
import { formatCurrency, formatQuantity } from '@/shared/lib/formatUtils'
import {
  calculatePositionDailyContribution,
  calculatePositionTotalReturn,
} from '@/features/asset-research/lib/assetResearchViewCalculations'
import '@/shared/design/pages/holdings.css'

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
  split_count?: number
  transaction_count?: number
  country: string | null
  effective_sector?: string | null
  effective_industry?: string | null
  effective_country?: string | null
  themes?: AssetThemeDTO[]
  created_at: string
  updated_at: string
}

const sortableColumns = [
  'market_value',
  'portfolio_weight',
  'daily_impact',
  'lifetime_return',
  'symbol',
  'name',
  'class',
  'country',
  'asset_type',
  'sector',
  'industry',
  'total_quantity',
  'portfolio_count',
] as const

type SortKey = typeof sortableColumns[number]
type SortDir = 'asc' | 'desc'

const numericSortKeys = new Set<SortKey>([
  'market_value',
  'portfolio_weight',
  'daily_impact',
  'lifetime_return',
  'total_quantity',
  'portfolio_count',
])

function normaliseNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return null
  return number
}

function signClass(value: number | string | null | undefined): string {
  const number = normaliseNumber(value)
  if (number === null || number === 0) return 'holdings-muted'
  return number > 0 ? 'holdings-positive' : 'holdings-negative'
}

function formatSignedCurrency(value: number | string | null | undefined, currency: string, locale?: string): string {
  const number = normaliseNumber(value)
  if (number === null) return '—'
  if (number === 0) return formatCurrency(0, currency, locale)
  return `${number > 0 ? '+' : '−'}${formatCurrency(Math.abs(number), currency, locale)}`
}

function formatPercent(value: number | string | null | undefined, decimals = 2, signed = false): string {
  const number = normaliseNumber(value)
  if (number === null) return '—'
  const prefix = signed && number > 0 ? '+' : number < 0 ? '−' : ''
  return `${prefix}${Math.abs(number).toFixed(decimals)}%`
}

function formatHoldingPeriod(startDate: string | null | undefined): string {
  if (!startDate) return '—'

  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return '—'

  const now = new Date()
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
  if (days < 30) return `${days || 1} ${days === 1 ? 'day' : 'days'}`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) return `${years} ${years === 1 ? 'year' : 'years'}`
  return `${years} ${years === 1 ? 'year' : 'years'} ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`
}

function getPositionValue(position: PositionDTO | null | undefined): number | null {
  if (!position) return null
  const marketValue = normaliseNumber(position.market_value)
  if (marketValue !== null) return marketValue
  const costBasis = normaliseNumber(position.cost_basis)
  if (costBasis !== null) return costBasis
  return null
}

export default function Assets() {
  const { portfolios, activePortfolioId, setPortfolios, setActivePortfolio } = usePortfolioStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [heldAssets, setHeldAssets] = useState<HeldAsset[]>([])
  const [soldAssets, setSoldAssets] = useState<HeldAsset[]>([])
  const [portfolioPositions, setPortfolioPositions] = useState<PositionDTO[]>([])
  const [soldPositions, setSoldPositions] = useState<PositionDTO[]>([])
  const [portfolioAssetIds, setPortfolioAssetIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('market_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showSold, setShowSold] = useState(() => {
    const saved = localStorage.getItem('assets-show-sold')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null)
  const [splitHistoryAsset, setSplitHistoryAsset] = useState<{ id: number; symbol: string } | null>(null)
  const [transactionHistoryAsset, setTransactionHistoryAsset] = useState<{ id: number; symbol: string } | null>(null)
  const [priceChartAsset, setPriceChartAsset] = useState<{ id: number; symbol: string; currency: string; assetType?: string | null; name?: string | null } | null>(null)
  const [debugAsset, setDebugAsset] = useState<{ id: number; symbol: string } | null>(null)
  const [editAsset, setEditAsset] = useState<HeldAsset | null>(null)
  const [investmentNoteAsset, setInvestmentNoteAsset] = useState<HeldAsset | null>(null)
  const [investmentNote, setInvestmentNote] = useState<AssetInvestmentNoteDTO | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'EUR'
  const locale = navigator.language

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true)
      setHeldAssets([])
      setSoldAssets([])
      setPortfolioPositions([])
      setSoldPositions([])
      setPortfolioAssetIds(new Set())

      let portfolioSource = portfolios
      if (portfolioSource.length === 0) {
        portfolioSource = await api.getPortfolios()
        setPortfolios(portfolioSource)
      }

      const resolvedPortfolioId = activePortfolioId ?? portfolioSource[0]?.id ?? null
      if (!activePortfolioId && resolvedPortfolioId) {
        setActivePortfolio(resolvedPortfolioId)
      }

      const portfolioIds = resolvedPortfolioId ? [resolvedPortfolioId] : portfolioSource.map((portfolio) => portfolio.id)
      const currentPositionsPromise = portfolioIds.length > 0
        ? Promise.all(portfolioIds.map((portfolioId) => api.getPortfolioPositions(portfolioId))).then((groups) => groups.flat())
        : Promise.resolve([] as PositionDTO[])
      const closedPositionsPromise = portfolioIds.length > 0
        ? Promise.all(portfolioIds.map((portfolioId) => api.getSoldPositions(portfolioId))).then((groups) => groups.flat())
        : Promise.resolve([] as PositionDTO[])

      const [held, sold, currentPositions, closedPositions] = await Promise.all([
        api.getHeldAssets(resolvedPortfolioId || undefined),
        api.getSoldAssets(resolvedPortfolioId || undefined),
        currentPositionsPromise,
        closedPositionsPromise,
      ])

      setHeldAssets(held)
      setSoldAssets(sold)
      setPortfolioPositions(currentPositions)
      setSoldPositions(closedPositions)

      if (activePortfolioId) {
        setPortfolioAssetIds(new Set([
          ...held.map((asset) => asset.id),
          ...sold.map((asset) => asset.id),
          ...currentPositions.map((position) => position.asset_id),
          ...closedPositions.map((position) => position.asset_id),
        ]))
      }

      setError(null)
    } catch (err) {
      setError('Failed to load holdings')
      console.error('Error loading holdings:', err)
    } finally {
      setLoading(false)
    }
  }, [activePortfolioId, portfolios, setActivePortfolio, setPortfolios])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  useEffect(() => {
    localStorage.setItem('assets-show-sold', JSON.stringify(showSold))
  }, [showSold])

  useEffect(() => {
    if (splitHistoryAsset || transactionHistoryAsset || priceChartAsset || debugAsset || editAsset || investmentNoteAsset) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [splitHistoryAsset, transactionHistoryAsset, priceChartAsset, debugAsset, editAsset, investmentNoteAsset])

  const positionsByAssetId = useMemo(() => {
    const map = new Map<number, PositionDTO>()
    const addPosition = (position: PositionDTO) => {
      const existing = map.get(position.asset_id)
      if (!existing) {
        map.set(position.asset_id, { ...position })
        return
      }

      const existingQuantity = normaliseNumber(existing.quantity) ?? 0
      const positionQuantity = normaliseNumber(position.quantity) ?? 0
      const quantity = existingQuantity + positionQuantity
      const marketValue = (getPositionValue(existing) ?? 0) + (getPositionValue(position) ?? 0)
      const costBasis = (normaliseNumber(existing.cost_basis) ?? 0) + (normaliseNumber(position.cost_basis) ?? 0)
      const unrealizedPnl = (normaliseNumber(existing.unrealized_pnl) ?? 0) + (normaliseNumber(position.unrealized_pnl) ?? 0)
      const dailyImpact =
        (calculatePositionDailyContribution(existing) ?? 0)
        + (calculatePositionDailyContribution(position) ?? 0)

      map.set(position.asset_id, {
        ...existing,
        quantity,
        avg_cost: quantity > 0 ? costBasis / quantity : existing.avg_cost,
        current_price: marketValue > 0 && quantity > 0 ? marketValue / quantity : existing.current_price,
        market_value: marketValue,
        cost_basis: costBasis,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct: costBasis > 0
          ? (unrealizedPnl / costBasis) * 100
          : existing.unrealized_pnl_pct,
        realized_pnl: (normaliseNumber(existing.realized_pnl) ?? 0) + (normaliseNumber(position.realized_pnl) ?? 0),
        realized_quantity: (normaliseNumber(existing.realized_quantity) ?? 0) + (normaliseNumber(position.realized_quantity) ?? 0),
        realized_sell_count: (normaliseNumber(existing.realized_sell_count) ?? 0) + (normaliseNumber(position.realized_sell_count) ?? 0),
        realized_cost_basis: (normaliseNumber(existing.realized_cost_basis) ?? 0) + (normaliseNumber(position.realized_cost_basis) ?? 0),
        realized_sale_proceeds: (normaliseNumber(existing.realized_sale_proceeds) ?? 0) + (normaliseNumber(position.realized_sale_proceeds) ?? 0),
        realized_fees: (normaliseNumber(existing.realized_fees) ?? 0) + (normaliseNumber(position.realized_fees) ?? 0),
        lifetime_pnl: (normaliseNumber(existing.lifetime_pnl) ?? 0) + (normaliseNumber(position.lifetime_pnl) ?? 0),
        total_quantity_bought: (normaliseNumber(existing.total_quantity_bought) ?? 0) + (normaliseNumber(position.total_quantity_bought) ?? 0),
        daily_change_pct: marketValue > 0 ? (dailyImpact / marketValue) * 100 : existing.daily_change_pct,
      })
    }

    soldPositions.forEach(addPosition)
    portfolioPositions.forEach(addPosition)
    return map
  }, [portfolioPositions, soldPositions])

  const totalPortfolioValue = useMemo(
    () => portfolioPositions.reduce((sum, position) => sum + (getPositionValue(position) ?? 0), 0),
    [portfolioPositions],
  )

  const heroSectors = useMemo(() => {
    return new Set(
      heldAssets
        .map((asset) => asset.effective_sector || asset.sector)
        .filter(Boolean),
    ).size
  }, [heldAssets])

  const heroCountries = useMemo(() => {
    return new Set(
      heldAssets
        .map((asset) => asset.effective_country || asset.country)
        .filter(Boolean),
    ).size
  }, [heldAssets])

  const openInvestmentNote = async (asset: HeldAsset) => {
    setInvestmentNoteAsset(asset)
    setInvestmentNote(null)
    try {
      const note = await api.getAssetInvestmentNote(asset.id)
      setInvestmentNote(note)
    } catch (err) {
      console.error('Failed to load investment note:', err)
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(['market_value', 'portfolio_weight', 'daily_impact', 'lifetime_return'].includes(key) ? 'desc' : 'asc')
    }
  }

  const getPosition = useCallback((asset: HeldAsset) => positionsByAssetId.get(asset.id) || null, [positionsByAssetId])

  const getPortfolioWeight = useCallback((asset: HeldAsset) => {
    const position = getPosition(asset)
    const positionValue = getPositionValue(position)
    if (positionValue === null || totalPortfolioValue <= 0) return null
    return (positionValue / totalPortfolioValue) * 100
  }, [getPosition, totalPortfolioValue])

  const getSortValue = useCallback((asset: HeldAsset, key: SortKey): string | number | null | undefined => {
    const position = getPosition(asset)
    if (key === 'market_value') return getPositionValue(position) ?? (asset.total_quantity > 0 ? asset.total_quantity : 0)
    if (key === 'portfolio_weight') return getPortfolioWeight(asset)
    if (key === 'daily_impact') return calculatePositionDailyContribution(position)
    if (key === 'lifetime_return') return calculatePositionTotalReturn(position)
    if (key === 'sector') return asset.effective_sector || asset.sector
    if (key === 'industry') return asset.effective_industry || asset.industry
    if (key === 'country') return asset.effective_country || asset.country
    return asset[key as keyof HeldAsset] as string | number | null | undefined
  }, [getPortfolioWeight, getPosition])

  const sortedAssets = useMemo(() => {
    let combined = [...heldAssets]
    if (showSold) {
      combined = [...heldAssets, ...soldAssets]
    }

    if (activePortfolioId && portfolioAssetIds.size > 0) {
      combined = combined.filter((asset) => portfolioAssetIds.has(asset.id))
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      combined = combined.filter((asset) => {
        const symbol = asset.symbol.toLowerCase()
        const name = (asset.name || '').toLowerCase()
        return symbol.includes(query) || name.includes(query)
      })
    }

    const dir = sortDir === 'asc' ? 1 : -1
    return combined.sort((a, b) => {
      const aVal = getSortValue(a, sortKey)
      const bVal = getSortValue(b, sortKey)
      const aNull = aVal === null || aVal === undefined
      const bNull = bVal === null || bVal === undefined

      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1
      if (numericSortKeys.has(sortKey)) {
        const na = normaliseNumber(aVal as number | string | null | undefined)
        const nb = normaliseNumber(bVal as number | string | null | undefined)
        if (na === null && nb === null) return 0
        if (na === null) return 1
        if (nb === null) return -1
        return (na - nb) * dir
      }
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        return String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase()) * dir
      }

      const na = Number(aVal)
      const nb = Number(bVal)
      if (Number.isNaN(na) && Number.isNaN(nb)) return 0
      if (Number.isNaN(na)) return 1
      if (Number.isNaN(nb)) return -1
      return (na - nb) * dir
    })
  }, [
    activePortfolioId,
    getSortValue,
    heldAssets,
    portfolioAssetIds,
    searchQuery,
    showSold,
    soldAssets,
    sortDir,
    sortKey,
  ])

  const handleEnrichAll = async () => {
    try {
      setEnriching(true)
      await api.enrichAllAssets()
      await loadAssets()
    } catch (err) {
      console.error('Error enriching holdings:', err)
    } finally {
      setEnriching(false)
    }
  }

  const openAssetResearch = (symbol: string) => {
    navigate(`/assets/${encodeURIComponent(symbol)}/research`)
  }

  const handleAssetResearchKeyDown = (event: KeyboardEvent<HTMLElement>, symbol: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAssetResearch(symbol)
    }
  }

  const isActive = (key: SortKey) => sortKey === key

  const getSortLabel = (key: SortKey): string => {
    const labels: Record<SortKey, string> = {
      market_value: 'Value',
      portfolio_weight: 'Portfolio weight',
      daily_impact: "Today's impact",
      lifetime_return: 'Lifetime return',
      symbol: 'Symbol',
      name: 'Name',
      class: 'Class',
      country: 'Country',
      asset_type: 'Type',
      sector: 'Sector',
      industry: 'Industry',
      total_quantity: 'Quantity',
      portfolio_count: 'Portfolios',
    }
    return labels[key]
  }

  const renderThemes = (themes?: AssetThemeDTO[]) => {
    if (!themes || themes.length === 0) return null
    const [primaryTheme, ...extraThemes] = themes
    return (
      <span className="holdings-themes">
        {primaryTheme.label}
        {extraThemes.length > 0 && <span>+{extraThemes.length}</span>}
      </span>
    )
  }

  const renderIdentity = (asset: HeldAsset) => {
    const sector = asset.effective_sector || asset.sector
    const country = asset.effective_country || asset.country
    const type = asset.asset_type || asset.class

    return (
      <div className="holdings-position">
        <AssetLogo
          symbol={asset.symbol}
          assetType={asset.asset_type}
          assetName={asset.name}
          alt=""
          loading="lazy"
          className="holdings-logo"
        />
        <div className="holdings-position-copy">
          <div className="holdings-symbol-line">
            <span>{asset.symbol}</span>
            {asset.total_quantity === 0 && <em>{t('assets.sold')}</em>}
          </div>
          <div className="holdings-name">{asset.name || 'Unknown asset'}</div>
          <div className="holdings-meta-line">
            {type && <span>{getTranslatedAssetType(type, t)}</span>}
            {sector && <span>{getTranslatedSector(sector, t)}</span>}
            {country && <span>{country}</span>}
          </div>
          {renderThemes(asset.themes)}
        </div>
      </div>
    )
  }

  const renderValueCell = (asset: HeldAsset) => {
    const position = getPosition(asset)
    return (
      <div className="holdings-number-cell">
        <strong>{getPositionValue(position) !== null
          ? formatCurrency(getPositionValue(position), portfolioCurrency, locale)
          : '—'}</strong>
        <span>{formatQuantity(position?.quantity ?? asset.total_quantity)} shares</span>
      </div>
    )
  }

  const renderWeightCell = (asset: HeldAsset) => {
    const weight = getPortfolioWeight(asset)
    const large = weight !== null && weight >= 10
    return (
      <div className={`holdings-number-cell ${large ? 'holdings-emphasis' : ''}`}>
        <strong>{formatPercent(weight, weight !== null && weight < 1 ? 2 : 1)}</strong>
        <span>of portfolio</span>
      </div>
    )
  }

  const renderDailyImpactCell = (asset: HeldAsset) => {
    const position = getPosition(asset)
    const impact = calculatePositionDailyContribution(position)
    return (
      <div className={`holdings-number-cell ${signClass(impact)}`}>
        <strong>{formatSignedCurrency(impact, portfolioCurrency, locale)}</strong>
        <span>{formatPercent(position?.daily_change_pct, 2, true)} today</span>
      </div>
    )
  }

  const renderLifetimeReturnCell = (asset: HeldAsset) => {
    const position = getPosition(asset)
    const returnValue = calculatePositionTotalReturn(position)
    const returnPct = position?.unrealized_pnl_pct ?? position?.realized_pnl_percent ?? null
    return (
      <div className={`holdings-number-cell ${signClass(returnValue)}`}>
        <strong>{formatSignedCurrency(returnValue, portfolioCurrency, locale)}</strong>
        <span>{formatPercent(returnPct, 2, true)} since first purchase</span>
      </div>
    )
  }

  const renderExpandedLedger = (asset: HeldAsset) => {
    const position = getPosition(asset)
    const country = asset.effective_country || asset.country
    const sector = asset.effective_sector || asset.sector
    const industry = asset.effective_industry || asset.industry

    return (
      <div className="holdings-expanded">
        <div className="holdings-expanded-section">
          <p className="holdings-expanded-kicker">Cost and price</p>
          <dl>
            <div>
              <dt>Average cost</dt>
              <dd>{formatCurrency(position?.avg_cost ?? null, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>Current price</dt>
              <dd>{formatCurrency(position?.current_price ?? null, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>Cost basis</dt>
              <dd>{formatCurrency(position?.cost_basis ?? null, portfolioCurrency, locale)}</dd>
            </div>
            <div>
              <dt>Quantity owned</dt>
              <dd>{formatQuantity(position?.quantity ?? asset.total_quantity)}</dd>
            </div>
          </dl>
        </div>

        <div className="holdings-expanded-section">
          <p className="holdings-expanded-kicker">Ownership record</p>
          <dl>
            <div>
              <dt>Transactions</dt>
              <dd>{asset.transaction_count ?? 0}</dd>
            </div>
            <div>
              <dt>Splits</dt>
              <dd>{asset.split_count ?? 0}</dd>
            </div>
            <div>
              <dt>Portfolios</dt>
              <dd>{asset.portfolio_count}</dd>
            </div>
            <div>
              <dt>Holding period</dt>
              <dd>{formatHoldingPeriod(asset.created_at)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{asset.total_quantity === 0 ? t('assets.sold') : 'Open'}</dd>
            </div>
          </dl>
        </div>

        <div className="holdings-expanded-section">
          <p className="holdings-expanded-kicker">Classification</p>
          <dl>
            <div>
              <dt>Class</dt>
              <dd>{getTranslatedAssetClass(asset.class, t)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{getTranslatedAssetType(asset.asset_type, t)}</dd>
            </div>
            <div>
              <dt>Sector</dt>
              <dd>{sector ? getTranslatedSector(sector, t) : '—'}</dd>
            </div>
            <div>
              <dt>Industry</dt>
              <dd>{industry ? getTranslatedIndustry(industry, t) : '—'}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd className="holdings-country">
                {country && getCountryCode(country) && (
                  <img
                    src={`https://flagcdn.com/w40/${getCountryCode(country)}.png`}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      const image = event.target as HTMLImageElement
                      image.style.display = 'none'
                    }}
                  />
                )}
                {country || '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="pf-dark-control-group holdings-expanded-actions" onClick={(event) => event.stopPropagation()}>
          {(asset.transaction_count ?? 0) > 0 && (
            <button onClick={() => setTransactionHistoryAsset({ id: asset.id, symbol: asset.symbol })}>
              <Activity size={15} />
              Transactions
            </button>
          )}
          {(asset.split_count ?? 0) > 0 && (
            <button onClick={() => setSplitHistoryAsset({ id: asset.id, symbol: asset.symbol })}>
              <Shuffle size={15} />
              Splits
            </button>
          )}
          <button onClick={() => setPriceChartAsset({ id: asset.id, symbol: asset.symbol, currency: asset.currency || 'USD', assetType: asset.asset_type, name: asset.name })}>
            <LineChart size={15} />
            Price chart
          </button>
          <button onClick={() => openAssetResearch(asset.symbol)}>
            <BookOpen size={15} />
            Asset research
          </button>
          <button onClick={() => openInvestmentNote(asset)}>
            <NotebookPen size={15} />
            Note
          </button>
          {(!asset.sector || !asset.industry || !asset.country) && (
            <button onClick={() => setEditAsset(asset)}>
              <Edit size={15} />
              Metadata
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return <PageStateSkeleton label="Loading holdings" className="holdings-page" />
  }

  if (portfolios.length === 0) {
    return <EmptyPortfolioPrompt pageType="assets" />
  }

  if (error) {
    return (
      <PageShell className="holdings-page">
        <StateBlock
          tone="error"
          className="holdings-error"
          eyebrow="Holdings"
          title="Could not load holdings."
          description="Portfolium could not refresh current and sold positions."
          detail={error}
          actionLabel={t('common.retry')}
          onAction={loadAssets}
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="holdings-page">
      {heldAssets.length === 0 && (!showSold || soldAssets.length === 0) ? (
        <EmptyTransactionsPrompt pageType="assets" />
      ) : (
        <>
          <PageHeader>
            <PageTitleBlock
              kicker="Holdings"
              title={`${heldAssets.length} ${heldAssets.length === 1 ? 'position' : 'positions'}`}
            />
            <PageSummaryPanel
              lead={formatCurrency(totalPortfolioValue, portfolioCurrency, locale)}
              description={totalPortfolioValue > 0 ? (
                <>
                  Invested across <strong>{heroSectors || '—'}</strong> sectors and <strong>{heroCountries || '—'}</strong> countries.
                </>
              ) : (
                <>Every position represents a portion of your capital.</>
              )}
            />
          </PageHeader>

          <PageMetricStrip label="Holdings context">
            <PageMetric label="Value" value={formatCurrency(totalPortfolioValue, portfolioCurrency, locale)} />
            <PageMetric label="Positions" value={heldAssets.length} />
            <PageMetric label="Sectors" value={heroSectors || '—'} />
            <PageMetric label="Countries" value={heroCountries || '—'} />
          </PageMetricStrip>

          <PageControls
            label="Holdings controls"
            start={
              <div className="pf-search">
                <Search size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by symbol or company"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>
            }
            end={
              <div className="pf-control-group pf-dark-control-group holdings-controls">
                <label>
                  Sort
                  <select value={sortKey} onChange={(event) => handleSort(event.target.value as SortKey)}>
                    {sortableColumns.map((option) => (
                      <option key={option} value={option}>{getSortLabel(option)}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                  aria-label={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
                >
                  {sortDir === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {sortDir === 'asc' ? 'Ascending' : 'Descending'}
                </button>
                <button onClick={() => setShowSold(!showSold)}>
                  <Archive size={16} />
                  {showSold ? t('assets.hideSold') : t('assets.showSold')}
                </button>
                <button
                  onClick={() => navigate('/allocation')}
                >
                  <BarChart3 size={16} />
                  Allocation
                </button>
                <button onClick={handleEnrichAll} disabled={enriching}>
                  <RefreshCw size={16} className={enriching ? 'animate-spin' : ''} />
                  {enriching ? t('assets.enriching') : t('assets.enrich')}
                </button>
              </div>
            }
          />

          <PageMainGrid single>
            <PageMainColumn className="holdings-ledger-shell" aria-label="Holdings ledger">
            <table className="holdings-ledger">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('symbol')}
                    aria-sort={isActive('symbol') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Position <SortIcon column="symbol" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('market_value')}
                    aria-sort={isActive('market_value') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Value <SortIcon column="market_value" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('portfolio_weight')}
                    aria-sort={isActive('portfolio_weight') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Portfolio weight <SortIcon column="portfolio_weight" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('daily_impact')}
                    aria-sort={isActive('daily_impact') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Today's impact <SortIcon column="daily_impact" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th
                    onClick={() => handleSort('lifetime_return')}
                    aria-sort={isActive('lifetime_return') ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Lifetime return <SortIcon column="lifetime_return" activeColumn={sortKey} direction={sortDir} />
                  </th>
                  <th>Ledger</th>
                </tr>
              </thead>
              <tbody>
                {sortedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <StateBlock
                        className="holdings-empty"
                        eyebrow="No results"
                        title={t('assets.empty.noAssetsMatch')}
                        description="Clear the search or filters to return to the full holdings list."
                      />
                    </td>
                  </tr>
                ) : (
                  sortedAssets.map((asset) => {
                    const expanded = expandedAssetId === asset.id
                    return (
                      <Fragment key={asset.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          onClick={() => openAssetResearch(asset.symbol)}
                          onKeyDown={(event) => handleAssetResearchKeyDown(event, asset.symbol)}
                          className={asset.total_quantity === 0 ? 'holdings-row-sold' : undefined}
                        >
                          <td data-label="Position">{renderIdentity(asset)}</td>
                          <td data-label="Value">{renderValueCell(asset)}</td>
                          <td data-label="Portfolio weight">{renderWeightCell(asset)}</td>
                          <td data-label="Today's impact">{renderDailyImpactCell(asset)}</td>
                          <td data-label="Lifetime return">{renderLifetimeReturnCell(asset)}</td>
                          <td data-label="Ledger" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                            <button
                              className="holdings-expand-button"
                              onClick={() => setExpandedAssetId(expanded ? null : asset.id)}
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Close' : 'Open'} ${asset.symbol} ledger`}
                            >
                              {expanded ? 'Close' : 'Open'}
                              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${asset.id}-expanded`} className="holdings-expanded-row">
                            <td colSpan={6}>{renderExpandedLedger(asset)}</td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
            </PageMainColumn>
          </PageMainGrid>
        </>
      )}

      {splitHistoryAsset && (
        <SplitHistory
          assetId={splitHistoryAsset.id}
          assetSymbol={splitHistoryAsset.symbol}
          portfolioId={activePortfolioId || undefined}
          onClose={() => setSplitHistoryAsset(null)}
        />
      )}

      {transactionHistoryAsset && (
        <TransactionHistory
          assetId={transactionHistoryAsset.id}
          assetSymbol={transactionHistoryAsset.symbol}
          portfolioId={activePortfolioId || undefined}
          portfolioCurrency={portfolioCurrency}
          onClose={() => setTransactionHistoryAsset(null)}
        />
      )}

      {priceChartAsset && (
        <div className="pf-modal-overlay">
          <div className="pf-modal-panel pf-modal-panel--chart" role="dialog" aria-modal="true">
            <div className="pf-modal-header sticky top-0 bg-neutral-950 z-10">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="pf-modal-title">
                    {priceChartAsset.symbol} {t('assets.priceChart')}
                  </h2>
                  <p className="pf-modal-description">
                    {t('assets.historicalPriceData')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDebugAsset({ id: priceChartAsset.id, symbol: priceChartAsset.symbol })}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                  title="Debug Price Data Health"
                >
                  <Activity size={20} />
                </button>
                <button
                  onClick={() => setPriceChartAsset(null)}
                  className="pf-modal-close"
                  aria-label={t('common.close')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="pf-modal-body pf-modal-body--chart">
              <AssetPriceChart
                assetId={priceChartAsset.id}
                symbol={priceChartAsset.symbol}
                currency={priceChartAsset.currency}
                portfolioId={activePortfolioId ?? undefined}
                assetType={priceChartAsset.assetType}
                assetName={priceChartAsset.name}
                chartHeight="min(46vh, 440px)"
              />
            </div>
          </div>
        </div>
      )}

      {debugAsset && (
        <AssetPriceDebug
          assetId={debugAsset.id}
          symbol={debugAsset.symbol}
          onClose={() => setDebugAsset(null)}
        />
      )}

      {editAsset && (
        <AssetMetadataEdit
          asset={editAsset}
          onClose={() => setEditAsset(null)}
          onSuccess={loadAssets}
        />
      )}

      {investmentNoteAsset && (
        <AssetInvestmentNoteModal
          assetId={investmentNoteAsset.id}
          symbol={investmentNoteAsset.symbol}
          note={investmentNote}
          isOpen={Boolean(investmentNoteAsset)}
          onClose={() => setInvestmentNoteAsset(null)}
          onSaved={setInvestmentNote}
        />
      )}
    </PageShell>
  )
}
