import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Zap, ZapOff, Clock, LayoutDashboard, Grid3x3, Library, Save } from 'lucide-react'
import usePortfolioStore from '../store/usePortfolioStore'
import api, { PositionDTO, BatchPriceDTO } from '../lib/api'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import DashboardGrid from '../components/dashboard/core/DashboardGrid'
import WidgetLibrary from '../components/dashboard/core/WidgetLibrary'
import LayoutManager from '../components/dashboard/core/LayoutManager'
import { loadLayout, saveLayout } from '../components/dashboard/utils/defaultLayouts'
import { Layout } from 'react-grid-layout'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import type { DashboardLayoutDTO } from '../types/dashboard'
import { useDashboardBatch } from '../hooks/useDashboardBatch'

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
  
  // Force re-render for live countdown
  const [, forceUpdate] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    let counter = 0
    timerRef.current = setInterval(() => {
      counter++
      forceUpdate(counter)
    }, 1000)
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

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

  useEffect(() => {
    const id = setInterval(() => {
      setAutoRefreshSettings(getAutoRefreshSettings())
    }, 2000)
    return () => clearInterval(id)
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

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    if (!activePortfolioId) return
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-batch', activePortfolioId] }),
      queryClient.invalidateQueries({ queryKey: ['batchPrices', activePortfolioId] }),
    ])
    
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

  const formatLastUpdate = (timestamp: number) => {
    if (!timestamp) return t('common.never')
    const now = Date.now()
    const secondsAgo = Math.floor((now - timestamp) / 1000)
    if (secondsAgo < 0) return t('common.timeAgo', { time: '0s' })
    if (secondsAgo < 60) return t('common.timeAgo', { time: `${secondsAgo}s` })
    const minutesAgo = Math.floor(secondsAgo / 60)
    if (minutesAgo < 60) return t('common.timeAgo', { time: `${minutesAgo}m` })
    const hoursAgo = Math.floor(minutesAgo / 60)
    return t('common.timeAgo', { time: `${hoursAgo}h` })
  }

  const getNextRefreshIn = () => {
    if (!lastUpdate || !autoRefreshSettings.enabled) return null
    const now = Date.now()
    const elapsed = now - lastUpdate
    const remaining = autoRefreshSettings.interval - elapsed
    if (remaining <= 0) return null
    const seconds = Math.ceil(remaining / 1000)
    return seconds
  }


  const isAutoRefreshEnabled = autoRefreshSettings.enabled
  const isAnyRefreshing = isPriceRefetching || batchRefetching

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <LayoutDashboard className="text-pink-600" size={28} />
            {t('dashboard.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            {t('dashboard.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Market Status */}
          {marketStatus === 'premarket' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
              ● {t('market.status.premarket')}
            </span>
          )}
          {marketStatus === 'open' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
              ● {t('market.status.open')}
            </span>
          )}
          {marketStatus === 'afterhours' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded-full">
              ● {t('market.status.afterhours')}
            </span>
          )}
          {marketStatus === 'closed' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full">
              ● {t('market.status.closed')}
            </span>
          )}
          {marketStatus === 'unknown' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 rounded-full">
              ● {t('market.status.unknown')}
            </span>
          )}
          
          {/* Last Update */}
          {lastUpdate > 0 && (
            <div className="flex flex-col items-end gap-0.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                <Clock size={12} />
                <span className="font-medium">{formatLastUpdate(lastUpdate)}</span>
              </div>
              {autoRefreshSettings.enabled && getNextRefreshIn() !== null && getNextRefreshIn()! > 0 && (
                <div className="text-[10px] text-neutral-500 dark:text-neutral-500">
                  {t('common.next')}: {getNextRefreshIn()}s
                </div>
              )}
            </div>
          )}
          
          {/* Edit Mode Toggle */}
          <button
            onClick={toggleEditMode}
            className={`btn text-sm sm:text-base ${
              isEditMode
                ? 'bg-pink-600 hover:bg-pink-700 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            } flex items-center gap-2 px-3 py-2`}
            title={isEditMode ? t('dashboard.exitEditMode') : t('dashboard.customizeLayout')}
          >
            <Grid3x3 size={16} />
            <span className="hidden sm:inline">{isEditMode ? t('common.save') : t('common.edit')}</span>
          </button>
          
          {/* Widget Library Button - Only show in edit mode */}
          {isEditMode && (
            <button
              onClick={() => setIsWidgetLibraryOpen(true)}
              className="btn text-sm sm:text-base bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 flex items-center gap-2 px-3 py-2"
              title={t('dashboard.widgetsInfo')}
            >
              <Library size={16} />
              <span className="hidden sm:inline">{t('common.widgets')}</span>
            </button>
          )}
          
          {/* Layout Manager Button */}
          <button
            onClick={() => setIsLayoutManagerOpen(true)}
            className="btn text-sm sm:text-base bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 px-3 py-2"
            title={t('dashboard.layoutsInfo')}
          >
            <Save size={16} /> 
            <span className="hidden sm:inline">{t('common.layouts')}</span>
          </button>
          
          {/* Auto Refresh */}
          <button
            onClick={toggleAutoRefresh}
            className={`btn text-sm sm:text-base ${
              isAutoRefreshEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            } flex items-center gap-2 px-3 py-2`}
            title={isAutoRefreshEnabled ? t('dashboard.autoRefreshOn') : t('dashboard.autoRefreshOff')}
          >
            {isAutoRefreshEnabled ? <Zap size={16} /> : <ZapOff size={16} />}
            <span className="hidden sm:inline">{t('common.auto')}</span>
          </button>
          
          {/* Manual Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isAnyRefreshing}
            className="btn-primary flex items-center gap-2 text-sm sm:text-base px-3 py-2"
          >
            <RefreshCw size={16} className={isAnyRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
        </div>
      </div>

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
            <strong>{t('dashboard.editMode')}</strong> {t('dashboard.editModeInfo', { save: t('common.save') })}
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
