import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Zap, ZapOff, LayoutDashboard, Grid3x3, Library, Save, SlidersHorizontal, ChevronDown } from 'lucide-react'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import api, { PositionDTO, BatchPriceDTO } from '@/api'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import DashboardGrid from '@/features/dashboard/components/core/DashboardGrid'
import WidgetLibrary from '@/features/dashboard/components/core/WidgetLibrary'
import LayoutManager from '@/features/dashboard/components/core/LayoutManager'
import { loadLayout, saveLayout } from '@/features/dashboard/components/utils/defaultLayouts'
import { Layout } from 'react-grid-layout'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/providers/AuthContext'
import type { DashboardLayoutDTO } from '@/features/dashboard/types'
import { useDashboardBatch } from '@/features/dashboard/hooks/useDashboardBatch'
import DataFreshnessIndicator from '@/shared/components/DataFreshnessIndicator'

const ISO_WITHOUT_TIMEZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/

function parseApiDate(value: string): Date {
  return new Date(ISO_WITHOUT_TIMEZONE_RE.test(value) ? `${value}Z` : value)
}

interface AutoRefreshCountdownProps {
  enabled: boolean
  intervalMs: number
  lastUpdate: number
  label: string
}

function AutoRefreshCountdown({
  enabled,
  intervalMs,
  lastUpdate,
  label,
}: AutoRefreshCountdownProps) {
  const calculateSeconds = useCallback(() => {
    if (!enabled || !lastUpdate) return null
    const remaining = intervalMs - (Date.now() - lastUpdate)
    return remaining > 0 ? Math.ceil(remaining / 1000) : null
  }, [enabled, intervalMs, lastUpdate])
  const [seconds, setSeconds] = useState<number | null>(calculateSeconds)

  useEffect(() => {
    setSeconds(calculateSeconds())
    if (!enabled || !lastUpdate) return

    const interval = window.setInterval(() => {
      setSeconds(calculateSeconds())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [calculateSeconds, enabled, lastUpdate])

  if (seconds === null || seconds <= 0) return null

  return (
    <div className="px-3 pb-2 text-xs text-neutral-500 dark:text-neutral-400">
      {label}: {seconds}s
    </div>
  )
}

export default function Dashboard() {
  const {
    portfolios,
    activePortfolioId,
    setPortfolios,
    setActivePortfolio,
  } = usePortfolioStore()

  const { user } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isEditMode, setIsEditMode] = useState(false)
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false)
  const [isLayoutManagerOpen, setIsLayoutManagerOpen] = useState(false)
  const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false)
  const [currentLayout, setCurrentLayout] = useState<Layout[]>(loadLayout('lg', user?.id))
  const [currentBreakpoint, setCurrentBreakpoint] = useState<'lg' | 'md' | 'sm'>('lg')
  const [layoutVersion, setLayoutVersion] = useState(0) // Trigger re-renders
  const [currentLayouts, setCurrentLayouts] = useState<{lg: Layout[], md: Layout[], sm: Layout[]}>({
    lg: loadLayout('lg', user?.id),
    md: loadLayout('md', user?.id),
    sm: loadLayout('sm', user?.id),
  })
  
  // Get visible widgets from current layout
  const visibleWidgets = useMemo(() => {
    return currentLayout.map(item => item.i)
  }, [currentLayout])
  
  // Batch fetch all dashboard data with smart widget filtering
  const { 
    data: batchData, 
    isLoading: batchLoading,
    isRefetching: batchRefetching,
    error: batchError 
  } = useDashboardBatch({
    portfolioId: activePortfolioId || 0,
    visibleWidgets,
    includeSold: true,
    enabled: !!activePortfolioId && visibleWidgets.length > 0,
  })
  
  // Reload layout when widget library opens (to sync with any changes from DashboardGrid)
  useEffect(() => {
    if (isWidgetLibraryOpen) {
      setCurrentLayout(loadLayout(currentBreakpoint, user?.id))
    }
  }, [isWidgetLibraryOpen, currentBreakpoint, user?.id])
  
  // Update breakpoint based on window size
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      const newBreakpoint = width >= 1024 ? 'lg' : width >= 768 ? 'md' : 'sm'
      if (newBreakpoint !== currentBreakpoint) {
        setCurrentBreakpoint(newBreakpoint)
        setCurrentLayout(loadLayout(newBreakpoint, user?.id))
      }
    }

    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [currentBreakpoint, user?.id])
  
  // Load last update from localStorage
  const [lastUpdate, setLastUpdate] = useState<number>(() => {
    const stored = localStorage.getItem('dashboardLastUpdate')
    const timestamp = stored ? parseInt(stored, 10) : 0
    return timestamp
  })
  
  const customizeMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isCustomizeMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!customizeMenuRef.current?.contains(event.target as Node)) {
        setIsCustomizeMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCustomizeMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCustomizeMenuOpen])

  // Auto-refresh settings
  const getAutoRefreshSettings = useCallback(() => {
    const intervalStr = localStorage.getItem('autoRefreshInterval') || '60'
    const enabledStr = localStorage.getItem('autoRefreshEnabled')
    return {
      interval: Math.max(5, parseInt(intervalStr, 10)) * 1000,
      enabled: enabledStr === 'true',
    }
  }, [])

  const [autoRefreshSettings, setAutoRefreshSettings] = useState(getAutoRefreshSettings())

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'autoRefreshInterval' || e.key === 'autoRefreshEnabled') {
        setAutoRefreshSettings(getAutoRefreshSettings())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [getAutoRefreshSettings])

  // Load portfolios
  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  useEffect(() => {
    if (portfoliosData) {
      setPortfolios(portfoliosData)
      if (portfoliosData.length > 0 && !activePortfolioId) {
        setActivePortfolio(portfoliosData[0].id)
      }
    }
  }, [portfoliosData, activePortfolioId, setPortfolios, setActivePortfolio])

  // Extract data from batch response
  const positions = useMemo(() => batchData?.data.positions as PositionDTO[] | undefined, [batchData])
  const metrics = useMemo(() => batchData?.data.metrics, [batchData])
  const soldPositions = useMemo(() => batchData?.data.sold_positions as PositionDTO[] | undefined, [batchData])
  
  // Use batch loading state
  const positionsLoading = batchLoading
  const metricsLoading = batchLoading
  const soldPositionsLoading = batchLoading

  // Batch price updates
  const { data: batchPrices, isRefetching: isPriceRefetching, error: priceError } = useQuery({
    queryKey: ['batchPrices', activePortfolioId],
    queryFn: async () => {
      const data = await api.getBatchPrices(activePortfolioId!)
      const timestamp = Date.now()
      setLastUpdate(timestamp)
      localStorage.setItem('dashboardLastUpdate', timestamp.toString())
      return data
    },
    enabled: !!activePortfolioId && autoRefreshSettings.enabled,
    staleTime: 0,
    gcTime: 30 * 1000,
    refetchInterval: autoRefreshSettings.enabled ? autoRefreshSettings.interval : false,
    refetchIntervalInBackground: false, // Stop refetching when navigating away from dashboard
    refetchOnWindowFocus: true,
  })

  // Merge positions with live prices
  const displayPositions = useMemo(() => {
    if (!positions || !batchPrices?.prices) return positions || []

    return positions.map(pos => {
      const priceUpdate = batchPrices.prices.find((p: BatchPriceDTO) => p.asset_id === pos.asset_id)
      if (!priceUpdate) return pos

      const newMarketValue = priceUpdate.current_price 
        ? priceUpdate.current_price * pos.quantity 
        : pos.market_value

      const newUnrealizedPnl = newMarketValue !== null 
        ? newMarketValue - pos.cost_basis
        : pos.unrealized_pnl

      const newUnrealizedPnlPct = newUnrealizedPnl !== null && pos.cost_basis > 0
        ? (newUnrealizedPnl / pos.cost_basis) * 100
        : pos.unrealized_pnl_pct

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
      return parseApiDate(position.last_updated).getTime() < parseApiDate(oldest).getTime()
        ? position.last_updated
        : oldest
    }, null)
  }, [displayPositions])

  const freshnessTimestamp = batchPrices?.updated_at
    || batchData?.timestamp
    || (lastUpdate > 0 ? new Date(lastUpdate).toISOString() : null)

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    if (!activePortfolioId) return

    const [priceData] = await Promise.all([
      api.getBatchPrices(activePortfolioId, true),
      queryClient.invalidateQueries({ queryKey: ['dashboard-batch', activePortfolioId] }),
    ])
    
    queryClient.setQueryData(['batchPrices', activePortfolioId], priceData)
    
    const timestamp = Date.now()
    setLastUpdate(timestamp)
    localStorage.setItem('dashboardLastUpdate', timestamp.toString())
  }, [activePortfolioId, queryClient])

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    const newEnabled = !autoRefreshSettings.enabled
    localStorage.setItem('autoRefreshEnabled', String(newEnabled))
    setAutoRefreshSettings(prev => ({ ...prev, enabled: newEnabled }))
  }, [autoRefreshSettings.enabled])

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev)
  }, [])

  // Handle loading a saved layout
  const handleLoadLayout = useCallback((layout: DashboardLayoutDTO) => {
    const { lg, md, sm } = layout.layout_config
    setCurrentLayouts({ lg, md, sm })
    
    // Save to localStorage (layouts are now global across all portfolios)
    saveLayout(lg, 'lg', user?.id)
    saveLayout(md, 'md', user?.id)
    saveLayout(sm, 'sm', user?.id)
    
    // Update current layout based on breakpoint
    setCurrentLayout(layout.layout_config[currentBreakpoint])
    
    // Trigger re-render
    setLayoutVersion(v => v + 1)
    
    // Close the layout manager
    setIsLayoutManagerOpen(false)
  }, [user?.id, currentBreakpoint])

  const isAutoRefreshEnabled = autoRefreshSettings.enabled
  const isAnyRefreshing = isPriceRefetching || batchRefetching
  const autoRefreshIntervalSeconds = Math.round(autoRefreshSettings.interval / 1000)

  const [marketStatus, setMarketStatus] = useState<'premarket' | 'open' | 'afterhours' | 'closed' | 'unknown'>('unknown')

  useEffect(() => {
    const checkMarketStatus = async () => {
      try {
        const health = await api.healthCheck()
        setMarketStatus(health.market_status as 'premarket' | 'open' | 'afterhours' | 'closed')
      } catch {
        setMarketStatus('unknown')
      }
    }
    checkMarketStatus()
    const interval = setInterval(checkMarketStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="dashboard" />
  }

  return (
    <div className="pf-page pf-page-flow dashboard-widgets">
      <header className="pf-page-header dashboard-widgets__header">
        <div>
          <p className="pf-page-kicker">DASHBOARD</p>
          <h1 className="pf-page-title pf-page-title--compact flex items-center gap-3">
            <LayoutDashboard className="text-pink-600" size={28} />
            {t('dashboard.page.title')}
          </h1>
          <p className="pf-page-description mt-2">
            {t('dashboard.page.description')}
          </p>
        </div>
        <div className="pf-page-actions pf-summary-panel dashboard-widgets__actions">
          {/* Freshness */}
          {(freshnessTimestamp || visiblePriceTimestamp) && (
            <div className="flex items-center">
              <DataFreshnessIndicator
                variant="compact"
                timestamp={freshnessTimestamp}
                latestPriceTimestamp={visiblePriceTimestamp}
                marketStatus={marketStatus}
                isCached={batchData?.cached}
                showLabel={false}
                className="sm:hidden"
              />
              <DataFreshnessIndicator
                variant="compact"
                timestamp={freshnessTimestamp}
                latestPriceTimestamp={visiblePriceTimestamp}
                marketStatus={marketStatus}
                isCached={batchData?.cached}
                className="hidden sm:inline-flex"
              />
            </div>
          )}
          
          {/* Manual Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isAnyRefreshing}
            className="btn-primary flex items-center gap-2 text-sm sm:text-base px-3 py-2 shadow-sm"
          >
            <RefreshCw size={16} className={isAnyRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>

          {/* Customize Menu */}
          <div className="relative" ref={customizeMenuRef}>
            <button
              onClick={() => setIsCustomizeMenuOpen(prev => !prev)}
              className={`btn text-sm sm:text-base border flex items-center gap-2 px-3 py-2 shadow-sm ${
                isEditMode
                  ? 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100 dark:bg-pink-900/20 dark:border-pink-800 dark:text-pink-300'
                  : 'bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800'
              }`}
              aria-expanded={isCustomizeMenuOpen}
              aria-haspopup="menu"
              title={t('dashboard.page.customize')}
            >
              <SlidersHorizontal size={16} />
              <span>{t('dashboard.page.customize')}</span>
              <ChevronDown size={14} className={`transition-transform ${isCustomizeMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCustomizeMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    toggleEditMode()
                    setIsCustomizeMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Grid3x3 size={16} className={isEditMode ? 'text-pink-600 dark:text-pink-400' : 'text-neutral-500'} />
                  <span className="flex-1">{isEditMode ? t('dashboard.page.doneEditing') : t('dashboard.page.editDashboard')}</span>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setIsWidgetLibraryOpen(true)
                    setIsCustomizeMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Library size={16} className="text-neutral-500" />
                  <span className="flex-1">{t('common.widgets')}</span>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setIsLayoutManagerOpen(true)
                    setIsCustomizeMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Save size={16} className="text-neutral-500" />
                  <span className="flex-1">{t('common.layouts')}</span>
                </button>

                <div className="my-2 h-px bg-neutral-200 dark:bg-neutral-800" />

                <button
                  role="menuitem"
                  onClick={toggleAutoRefresh}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  {isAutoRefreshEnabled ? (
                    <Zap size={16} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ZapOff size={16} className="text-neutral-500" />
                  )}
                  <span className="flex-1">{t('dashboard.page.autoRefresh')}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isAutoRefreshEnabled ? t('dashboard.page.enabled') : t('dashboard.page.disabled')}
                  </span>
                </button>

                <div className="flex items-center gap-3 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <RefreshCw size={14} />
                  <span className="flex-1">{t('dashboard.page.refreshInterval')}</span>
                  <span>{autoRefreshIntervalSeconds}s</span>
                </div>

                <AutoRefreshCountdown
                  enabled={autoRefreshSettings.enabled}
                  intervalMs={autoRefreshSettings.interval}
                  lastUpdate={lastUpdate}
                  label={t('common.next')}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Batch Error Alert */}
      {batchError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>{t('common.error')}:</strong> {batchError.message || String(batchError)}
          </p>
        </div>
      )}
      
      {/* Price Error Alert */}
      {priceError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>{t('common.priceUpdateError')}:</strong> {priceError.message || String(priceError)}
          </p>
        </div>
      )}

      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
          <p className="text-sm text-pink-800 dark:text-pink-200">
            <strong>{t('dashboard.page.editMode')}</strong> {t('dashboard.page.editModeInfo', { save: t('common.save') })}
          </p>
        </div>
      )}

      {/* Dashboard Grid */}
      <DashboardGrid
        key={`dashboard-${layoutVersion}`}
        metrics={metrics || null}
        positions={displayPositions || []}
        soldPositions={soldPositions}
        soldPositionsLoading={soldPositionsLoading}
        isEditMode={isEditMode}
        isLoading={positionsLoading || metricsLoading}
        userId={user?.id}
        portfolioId={activePortfolioId || undefined}
        batchData={batchData?.data}
      />

      {/* Widget Library Modal */}
      <WidgetLibrary
        isOpen={isWidgetLibraryOpen}
        onClose={() => setIsWidgetLibraryOpen(false)}
        currentBreakpoint={currentBreakpoint}
        currentLayout={currentLayout}
        userId={user?.id}
        portfolioId={activePortfolioId || undefined}
        onLayoutChange={(newLayout: Layout[]) => {
          setCurrentLayout(newLayout)
          setLayoutVersion(v => v + 1) // Trigger DashboardGrid re-render
        }}
        onVisibilityChange={() => {
          // Refresh the dashboard grid
          setLayoutVersion(v => v + 1)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((window as any).__refreshDashboardVisibility) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__refreshDashboardVisibility()
          }
        }}
      />

      {/* Layout Manager Modal */}
      <LayoutManager
        isOpen={isLayoutManagerOpen}
        onClose={() => setIsLayoutManagerOpen(false)}
        currentLayout={currentLayouts}
        onLoadLayout={handleLoadLayout}
      />
    </div>
  )
}
