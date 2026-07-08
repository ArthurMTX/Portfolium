import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Copy,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import api, { PositionDTO, BatchPriceDTO } from '@/api'
import { useAuth } from '@/app/providers/AuthContext'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import ConfirmModal from '@/shared/components/ConfirmModal'
import DataFreshnessIndicator from '@/shared/components/DataFreshnessIndicator'
import { PageStateSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageShell,
  PageSummaryPanel,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import BoardGrid from '@/features/boards/components/core/BoardGrid'
import AddWidgetModal from '@/features/boards/components/core/AddWidgetModal'
import { useDashboardBatch } from '@/features/boards/hooks/useDashboardBatch'
import { starterLayouts } from '@/features/boards/components/utils/starterLayout'
import { cleanLayout } from '@/features/boards/components/utils/layoutCompaction'
import type { Layout } from 'react-grid-layout'
import type { LayoutConfig } from '@/features/boards/types'
import '@/shared/design/pages/boards.css'

const ISO_WITHOUT_TIMEZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
const EMPTY_LAYOUT_CONFIG: LayoutConfig = { lg: [], md: [], sm: [] }
type Breakpoint = 'lg' | 'md' | 'sm'

function parseApiDate(value: string): Date {
  return new Date(ISO_WITHOUT_TIMEZONE_RE.test(value) ? `${value}Z` : value)
}

function formatDateTime(dateString: string, locale?: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(locale || undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BoardDetail() {
  const { id } = useParams<{ id: string }>()
  const boardId = Number(id)
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios)
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio)

  const [isEditMode, setIsEditMode] = useState(false)
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [localLayoutConfig, setLocalLayoutConfig] = useState<LayoutConfig | null>(null)

  const isValidId = Number.isFinite(boardId) && boardId > 0

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
  }, [portfoliosData, activePortfolioId, setPortfolios, setActivePortfolio])

  const {
    data: board,
    isLoading: boardLoading,
    isError: boardError,
  } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => api.getDashboardLayout(boardId),
    enabled: isValidId,
  })

  useEffect(() => {
    setLocalLayoutConfig(null)
  }, [boardId])

  const layoutConfig = useMemo(() => {
    const source = localLayoutConfig ?? board?.layout_config ?? EMPTY_LAYOUT_CONFIG
    // Backend serializes unset minW/minH/maxW/maxH as null; react-grid-layout
    // requires those keys to be either a finite number or entirely absent.
    return {
      lg: cleanLayout(source.lg),
      md: cleanLayout(source.md),
      sm: cleanLayout(source.sm),
    }
  }, [localLayoutConfig, board?.layout_config])

  const updateMutation = useMutation({
    mutationFn: (nextLayoutConfig: LayoutConfig) =>
      api.updateDashboardLayout(boardId, { layout_config: nextLayoutConfig }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['board', boardId], updated)
      queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })

  const persistLayoutConfig = useCallback((nextLayoutConfig: LayoutConfig) => {
    setLocalLayoutConfig(nextLayoutConfig)
    updateMutation.mutate(nextLayoutConfig)
  }, [updateMutation])

  const handleBoardGridLayoutChange = useCallback((breakpoint: Breakpoint, newLayout: Layout[]) => {
    persistLayoutConfig({ ...layoutConfig, [breakpoint]: newLayout })
  }, [layoutConfig, persistLayoutConfig])

  const handleAddWidgetLayoutChange = useCallback((newLayout: Layout[]) => {
    persistLayoutConfig({ ...layoutConfig, lg: newLayout })
  }, [layoutConfig, persistLayoutConfig])

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteDashboardLayout(boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      navigate('/boards')
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: () => api.duplicateDashboardLayout(boardId, `${board?.name ?? 'Board'} (${t('common.copy')})`),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
      navigate(`/boards/${created.id}`)
    },
  })

  const visibleWidgets = useMemo(() => layoutConfig.lg.map((item) => item.i), [layoutConfig])

  const {
    data: batchData,
    isLoading: batchLoading,
    isRefetching: batchRefetching,
    error: batchError,
  } = useDashboardBatch({
    portfolioId: activePortfolioId || 0,
    visibleWidgets,
    includeSold: true,
    enabled: !!activePortfolioId && visibleWidgets.length > 0,
  })

  const [autoRefreshEnabled] = useState(() => localStorage.getItem('autoRefreshEnabled') === 'true')
  const [autoRefreshInterval] = useState(() => {
    const stored = localStorage.getItem('autoRefreshInterval')
    return Math.max(5, parseInt(stored || '60', 10)) * 1000
  })

  const { data: batchPrices, isRefetching: isPriceRefetching, error: priceError } = useQuery({
    queryKey: ['batchPrices', activePortfolioId],
    queryFn: () => api.getBatchPrices(activePortfolioId!),
    enabled: !!activePortfolioId && autoRefreshEnabled,
    staleTime: 0,
    gcTime: 30 * 1000,
    refetchInterval: autoRefreshEnabled ? autoRefreshInterval : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  const positions = useMemo(() => batchData?.data.positions as PositionDTO[] | undefined, [batchData])
  const metrics = useMemo(() => batchData?.data.metrics, [batchData])
  const soldPositions = useMemo(() => batchData?.data.sold_positions as PositionDTO[] | undefined, [batchData])

  const displayPositions = useMemo(() => {
    if (!positions || !batchPrices?.prices) return positions || []
    return positions.map((pos) => {
      const priceUpdate = batchPrices.prices.find((p: BatchPriceDTO) => p.asset_id === pos.asset_id)
      if (!priceUpdate) return pos
      const newMarketValue = priceUpdate.current_price ? priceUpdate.current_price * pos.quantity : pos.market_value
      const newUnrealizedPnl = newMarketValue !== null ? newMarketValue - pos.cost_basis : pos.unrealized_pnl
      const newUnrealizedPnlPct =
        newUnrealizedPnl !== null && pos.cost_basis > 0 ? (newUnrealizedPnl / pos.cost_basis) * 100 : pos.unrealized_pnl_pct
      return {
        ...pos,
        current_price: priceUpdate.current_price ?? pos.current_price,
        market_value: newMarketValue,
        unrealized_pnl: newUnrealizedPnl,
        unrealized_pnl_pct: newUnrealizedPnlPct,
        daily_change_pct: priceUpdate.daily_change_pct ?? pos.daily_change_pct,
        last_updated: priceUpdate.last_updated ?? pos.last_updated,
      }
    })
  }, [positions, batchPrices])

  const visiblePriceTimestamp = useMemo(() => {
    return displayPositions.reduce<string | null>((oldest, position) => {
      if (!position.last_updated) return oldest
      if (!oldest) return position.last_updated
      return parseApiDate(position.last_updated).getTime() < parseApiDate(oldest).getTime() ? position.last_updated : oldest
    }, null)
  }, [displayPositions])

  const freshnessTimestamp = batchPrices?.updated_at || batchData?.timestamp || null

  const [marketStatus, setMarketStatus] = useState<'premarket' | 'open' | 'afterhours' | 'closed' | 'unknown'>('unknown')
  useEffect(() => {
    let cancelled = false
    const checkMarketStatus = async () => {
      try {
        const health = await api.healthCheck()
        if (!cancelled) setMarketStatus(health.market_status as typeof marketStatus)
      } catch {
        if (!cancelled) setMarketStatus('unknown')
      }
    }
    checkMarketStatus()
    const interval = setInterval(checkMarketStatus, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const handleManualRefresh = useCallback(async () => {
    if (!activePortfolioId) return
    const [priceData] = await Promise.all([
      api.getBatchPrices(activePortfolioId, true),
      queryClient.invalidateQueries({ queryKey: ['dashboard-batch', activePortfolioId] }),
    ])
    queryClient.setQueryData(['batchPrices', activePortfolioId], priceData)
  }, [activePortfolioId, queryClient])

  const handleResetLayout = () => {
    persistLayoutConfig(starterLayouts)
    setResetConfirmOpen(false)
  }

  if (!portfoliosLoading && portfolios.length === 0) {
    return <EmptyPortfolioPrompt pageType="boards" />
  }

  if (!isValidId) {
    return (
      <PageShell>
        <StateBlock
          tone="error"
          title={t('boards.detail.notFoundTitle')}
          description={t('boards.detail.notFoundDescription')}
          actionLabel={t('boards.detail.backToBoards')}
          onAction={() => navigate('/boards')}
        />
      </PageShell>
    )
  }

  if (boardLoading) {
    return <PageStateSkeleton label={t('common.loading')} />
  }

  if (boardError || !board) {
    return (
      <PageShell>
        <StateBlock
          tone="error"
          title={t('boards.detail.notFoundTitle')}
          description={t('boards.detail.notFoundDescription')}
          actionLabel={t('boards.detail.backToBoards')}
          onAction={() => navigate('/boards')}
        />
      </PageShell>
    )
  }

  const isAnyRefreshing = isPriceRefetching || batchRefetching
  const widgetCount = layoutConfig.lg.length

  return (
    <PageShell className="board-detail">
      <PageHeader>
        <PageTitleBlock
          kicker={t('boards.detail.kicker')}
          title={
            <span className="board-detail__title">
              <LayoutGrid size={22} aria-hidden="true" />
              {board.name}
            </span>
          }
          description={board.description || undefined}
        />
        <PageSummaryPanel
          lead={`${widgetCount} ${t('boards.detail.widgetCount').toLowerCase()}`}
          description={`${t('boards.detail.lastSaved')}: ${formatDateTime(board.updated_at, i18n.language)}`}
          actions={
            <>
              {(freshnessTimestamp || visiblePriceTimestamp) && (
                <DataFreshnessIndicator
                  variant="compact"
                  timestamp={freshnessTimestamp}
                  latestPriceTimestamp={visiblePriceTimestamp}
                  marketStatus={marketStatus}
                  isCached={batchData?.cached}
                  showLabel={false}
                />
              )}
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isAnyRefreshing}
                className="pf-button pf-button--secondary"
                aria-label={t('common.refresh')}
              >
                <RefreshCw size={16} className={isAnyRefreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{t('common.refresh')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddWidgetOpen(true)}
                className="pf-button pf-button--primary"
              >
                <PlusCircle size={16} />
                {t('boards.detail.addWidget')}
              </button>
            </>
          }
        />
      </PageHeader>

      <PageControls
        start={
          <div className="board-detail__mode-toggle" role="group" aria-label={t('boards.detail.editMode')}>
            <button
              type="button"
              className={!isEditMode ? 'is-active' : ''}
              aria-pressed={!isEditMode}
              onClick={() => setIsEditMode(false)}
            >
              {t('boards.detail.viewMode')}
            </button>
            <button
              type="button"
              className={isEditMode ? 'is-active' : ''}
              aria-pressed={isEditMode}
              onClick={() => setIsEditMode(true)}
            >
              {t('boards.detail.editMode')}
            </button>
          </div>
        }
        end={
          <>
            <button
              type="button"
              className="pf-button pf-button--secondary"
              onClick={() => setResetConfirmOpen(true)}
            >
              <RotateCcw size={16} />
              {t('boards.detail.resetLayout')}
            </button>
            <button
              type="button"
              className="pf-button pf-button--secondary"
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
            >
              <Copy size={16} />
              {t('boards.detail.duplicateBoard')}
            </button>
            <div className="board-detail__more-menu">
              <button
                type="button"
                className="pf-button pf-button--secondary"
                aria-haspopup="menu"
                aria-expanded={isMoreMenuOpen}
                aria-label={t('boards.detail.moreActions')}
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              >
                <MoreHorizontal size={16} />
              </button>
              {isMoreMenuOpen && (
                <div role="menu" className="board-detail__more-menu-panel">
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false)
                      navigate('/boards')
                    }}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {t('boards.list.rename')}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      setIsMoreMenuOpen(false)
                      setDeleteConfirmOpen(true)
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t('boards.detail.deleteBoard')}
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      {batchError && (
        <StateBlock tone="error" title={t('common.error')} description={batchError.message || String(batchError)} />
      )}
      {priceError && (
        <StateBlock tone="error" title={t('common.priceUpdateError')} description={priceError.message || String(priceError)} />
      )}
      {isEditMode && (
        <p className="board-detail__edit-hint">{t('boards.detail.editModeHint')}</p>
      )}

      <PageMainGrid single>
        <PageMainColumn>
          <BoardGrid
            layoutConfig={layoutConfig}
            onLayoutChange={handleBoardGridLayoutChange}
            metrics={metrics || null}
            positions={displayPositions || []}
            soldPositions={soldPositions}
            soldPositionsLoading={batchLoading}
            isEditMode={isEditMode}
            isLoading={batchLoading}
            userId={user?.id}
            portfolioId={activePortfolioId || undefined}
            batchData={batchData?.data}
          />
        </PageMainColumn>
      </PageMainGrid>

      <AddWidgetModal
        isOpen={isAddWidgetOpen}
        onClose={() => setIsAddWidgetOpen(false)}
        currentLayout={layoutConfig.lg}
        onLayoutChange={handleAddWidgetLayoutChange}
      />

      <ConfirmModal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetLayout}
        title={t('boards.detail.resetLayoutConfirmTitle')}
        message={t('boards.detail.resetLayoutConfirmMessage')}
        confirmText={t('common.reset')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={t('boards.detail.deleteBoard')}
        message={t('boards.list.deleteConfirmMessage', { name: board.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </PageShell>
  )
}
