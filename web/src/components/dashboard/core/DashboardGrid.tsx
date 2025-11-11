import { useState, useEffect, useMemo, useCallback } from 'react'
import GridLayout, { Layout, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(GridLayout)
import { Trash2 } from 'lucide-react'
import DashboardSkeleton from './DashboardSkeleton'
import ConfirmModal from '../../ConfirmModal'
import { loadLayout, saveLayout } from '../utils/defaultLayouts'
import { PositionDTO } from '../../../lib/api'
import usePortfolioStore from '@/store/usePortfolioStore'
import { DashboardProvider } from '@/contexts/DashboardContext'
import { getWidget } from '../widgets/registry'
import { extractBaseWidgetId } from '../utils/widgetUtils'
import { WidgetContext } from '../types'

interface DashboardGridProps {
  metrics: {
    total_value: number
    daily_change_value?: number | null
    daily_change_pct?: number | null
    total_unrealized_pnl: number
    total_unrealized_pnl_pct: number
    total_realized_pnl: number
    total_dividends: number
    total_fees: number
  } | null
  positions: PositionDTO[]
  soldPositions?: PositionDTO[]
  soldPositionsLoading?: boolean
  isEditMode: boolean
  isLoading?: boolean
  onRefreshVisibility?: () => void
  userId?: number
  portfolioId?: number
}

export default function DashboardGrid({ 
  metrics, 
  positions,
  soldPositions,
  soldPositionsLoading,
  isEditMode,
  isLoading = false,
  onRefreshVisibility,
  userId,
  portfolioId,
}: DashboardGridProps) {
  // Initialize breakpoint based on current window size immediately
  const getInitialBreakpoint = (): 'lg' | 'md' | 'sm' => {
    if (typeof window === 'undefined') return 'lg'
    const width = window.innerWidth
    if (width >= 1024) return 'lg'
    if (width >= 768) return 'md'
    return 'sm'
  }

  const [currentBreakpoint, setCurrentBreakpoint] = useState<'lg' | 'md' | 'sm'>(getInitialBreakpoint)
  const [layouts, setLayouts] = useState<Record<string, Layout[]>>({
    lg: loadLayout('lg', userId, portfolioId),
    md: loadLayout('md', userId, portfolioId),
    sm: loadLayout('sm', userId, portfolioId),
  })
  const [deleteConfirmWidget, setDeleteConfirmWidget] = useState<string | null>(null)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'

  /**
   * Compact layout vertically - removes gaps between widgets
   * This ensures widgets are tightly packed without empty spaces
   */
  // Clean layout utility - removes invalid properties
  const cleanLayout = useCallback((layout: Layout[]): Layout[] => {
    return layout.map(item => {
      const cleaned: Layout = {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }
      
      // Only include minW/minH if they're valid numbers
      if (typeof item.minW === 'number' && isFinite(item.minW)) {
        cleaned.minW = item.minW
      }
      if (typeof item.minH === 'number' && isFinite(item.minH)) {
        cleaned.minH = item.minH
      }
      
      // Only include maxW/maxH if they're valid numbers (not Infinity)
      if (typeof item.maxW === 'number' && isFinite(item.maxW)) {
        cleaned.maxW = item.maxW
      }
      if (typeof item.maxH === 'number' && isFinite(item.maxH)) {
        cleaned.maxH = item.maxH
      }
      
      return cleaned
    })
  }, [])

  const compactLayoutUtil = useCallback((layout: Layout[], breakpoint: 'lg' | 'md' | 'sm'): Layout[] => {
    if (!layout || layout.length === 0) {
      return layout
    }
    
    // Clean the layout first to remove any invalid properties
    const cleanedLayout = cleanLayout(layout)
    
    // Sort by y position, then x position
    const sorted = [...cleanedLayout].sort((a, b) => {
      if (a.y === b.y) return a.x - b.x
      return a.y - b.y
    })
    
    // Track occupied spaces using a grid
    const cols = breakpoint === 'lg' ? 12 : breakpoint === 'md' ? 8 : 4
    const grid: boolean[][] = []
    
    // Initialize grid helper function
    const ensureGridRow = (row: number) => {
      if (!grid[row]) grid[row] = Array(cols).fill(false)
    }
    
    // Check if a position is available
    const isPositionAvailable = (x: number, y: number, w: number, h: number): boolean => {
      for (let dy = 0; dy < h; dy++) {
        const row = y + dy
        ensureGridRow(row)
        for (let dx = 0; dx < w; dx++) {
          const col = x + dx
          if (col >= cols || grid[row][col]) {
            return false
          }
        }
      }
      return true
    }
    
    // Mark position as occupied
    const markOccupied = (x: number, y: number, w: number, h: number) => {
      for (let dy = 0; dy < h; dy++) {
        const row = y + dy
        ensureGridRow(row)
        for (let dx = 0; dx < w; dx++) {
          const col = x + dx
          if (col < cols) {
            grid[row][col] = true
          }
        }
      }
    }
    
    // Place each widget in the next available position
    const compacted = sorted.map(item => {
      // Start from y=0 and find the first available position
      let targetY = 0
      
      // Keep moving down until we find a spot where this widget fits
      while (targetY < 1000) { // Safety limit
        if (isPositionAvailable(item.x, targetY, item.w, item.h)) {
          // Found a valid position!
          break
        }
        targetY++
      }
      
      // Mark this space as occupied
      markOccupied(item.x, targetY, item.w, item.h)
      
      return {
        ...item,
        y: targetY
      }
    })
    
    return compacted
  }, [cleanLayout])

  // Reload layouts when userId or portfolioId changes
  useEffect(() => {
    const loadedLayouts = {
      lg: compactLayoutUtil(loadLayout('lg', userId, portfolioId), 'lg'),
      md: compactLayoutUtil(loadLayout('md', userId, portfolioId), 'md'),
      sm: compactLayoutUtil(loadLayout('sm', userId, portfolioId), 'sm'),
    }
    setLayouts(loadedLayouts)
    
    // Save the compacted layouts back to localStorage
    saveLayout(loadedLayouts.lg, 'lg', userId, portfolioId)
    saveLayout(loadedLayouts.md, 'md', userId, portfolioId)
    saveLayout(loadedLayouts.sm, 'sm', userId, portfolioId)
  }, [userId, portfolioId, compactLayoutUtil])

  // Reload layouts when requested
  useEffect(() => {
    if (onRefreshVisibility) {
      const handleRefresh = () => {
        const loadedLayouts = {
          lg: compactLayoutUtil(loadLayout('lg', userId, portfolioId), 'lg'),
          md: compactLayoutUtil(loadLayout('md', userId, portfolioId), 'md'),
          sm: compactLayoutUtil(loadLayout('sm', userId, portfolioId), 'sm'),
        }
        setLayouts(loadedLayouts)
        
        // Save the compacted layouts back to localStorage
        saveLayout(loadedLayouts.lg, 'lg', userId, portfolioId)
        saveLayout(loadedLayouts.md, 'md', userId, portfolioId)
        saveLayout(loadedLayouts.sm, 'sm', userId, portfolioId)
      }
      // Store the handler so parent can call it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__refreshDashboardVisibility = handleRefresh
    }
  }, [onRefreshVisibility, userId, portfolioId, compactLayoutUtil])

  // Determine breakpoint based on window width
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width >= 1024) {
        setCurrentBreakpoint('lg')
      } else if (width >= 768) {
        setCurrentBreakpoint('md')
      } else {
        setCurrentBreakpoint('sm')
      }
    }

    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])

  // Auto-scroll when dragging near edges
  useEffect(() => {
    if (!isEditMode) return

    let scrollInterval: NodeJS.Timeout | null = null
    const scrollSpeed = 10
    const scrollZone = 100 // pixels from edge

    const handleMouseMove = (e: MouseEvent) => {
      const dragging = document.querySelector('.react-draggable-dragging')
      if (!dragging) {
        if (scrollInterval) {
          clearInterval(scrollInterval)
          scrollInterval = null
        }
        return
      }

      const { clientY } = e
      const windowHeight = window.innerHeight
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop

      // Clear existing interval
      if (scrollInterval) {
        clearInterval(scrollInterval)
        scrollInterval = null
      }

      // Scroll up
      if (clientY < scrollZone && scrollTop > 0) {
        scrollInterval = setInterval(() => {
          window.scrollBy({ top: -scrollSpeed, behavior: 'auto' })
        }, 16)
      }
      // Scroll down
      else if (clientY > windowHeight - scrollZone) {
        scrollInterval = setInterval(() => {
          window.scrollBy({ top: scrollSpeed, behavior: 'auto' })
        }, 16)
      }
    }

    const handleMouseUp = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval)
        scrollInterval = null
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (scrollInterval) {
        clearInterval(scrollInterval)
      }
    }
  }, [isEditMode])

  // Track if user is currently dragging or resizing
  const [isDragging, setIsDragging] = useState(false)
  const [draggedItem, setDraggedItem] = useState<Layout | null>(null)

  const handleLayoutChange = (layout: Layout[]) => {
    if (isEditMode && isDragging) {
      // Update the layout immediately so the widget resizes/moves smoothly
      // We'll compact it when the operation completes
      setLayouts(prev => ({
        ...prev,
        [currentBreakpoint]: layout
      }))
    }
  }

  /**
   * Find the widget that the dragged item is mostly overlapping with
   */
  const findSwapTarget = (draggedItem: Layout, layout: Layout[]): Layout | null => {
    let maxOverlap = 0
    let swapTarget: Layout | null = null

    for (const item of layout) {
      if (item.i === draggedItem.i) continue

      // Calculate overlap area
      const overlapX = Math.max(0, Math.min(draggedItem.x + draggedItem.w, item.x + item.w) - Math.max(draggedItem.x, item.x))
      const overlapY = Math.max(0, Math.min(draggedItem.y + draggedItem.h, item.y + item.h) - Math.max(draggedItem.y, item.y))
      const overlapArea = overlapX * overlapY

      if (overlapArea > maxOverlap) {
        maxOverlap = overlapArea
        swapTarget = item
      }
    }

    // Only swap if there's significant overlap (at least 25% of dragged item's area)
    const draggedArea = draggedItem.w * draggedItem.h
    if (maxOverlap > draggedArea * 0.25) {
      return swapTarget
    }

    return null
  }

  const handleDragStop = (layout: Layout[], _oldItem: Layout, newItem: Layout) => {
    if (isEditMode) {
      setIsDragging(false)
      
      // Check if we should swap with another widget
      const swapTarget = findSwapTarget(newItem, layout)
      
      let finalLayout = layout
      
      if (swapTarget && draggedItem) {
        // Swap positions of the two widgets
        finalLayout = layout.map(item => {
          if (item.i === newItem.i) {
            // Move dragged item to target's position
            return {
              ...item,
              x: swapTarget.x,
              y: swapTarget.y,
            }
          } else if (item.i === swapTarget.i) {
            // Move target to dragged item's original position
            return {
              ...item,
              x: draggedItem.x,
              y: draggedItem.y,
            }
          }
          return item
        })
      }
      
      // Save layout as-is when drag operation completes
      // react-grid-layout's built-in compaction handles the positioning
      const cleanedLayout = cleanLayout(finalLayout)
      setLayouts(prev => ({
        ...prev,
        [currentBreakpoint]: cleanedLayout
      }))
      saveLayout(cleanedLayout, currentBreakpoint, userId, portfolioId)
      
      setDraggedItem(null)
    }
  }

  const handleResizeStop = (layout: Layout[]) => {
    if (isEditMode) {
      setIsDragging(false)
      
      // Save layout as-is when resize operation completes
      // react-grid-layout's built-in compaction handles the positioning
      const cleanedLayout = cleanLayout(layout)
      setLayouts(prev => ({
        ...prev,
        [currentBreakpoint]: cleanedLayout
      }))
      saveLayout(cleanedLayout, currentBreakpoint, userId, portfolioId)
    }
  }

  const handleDragStart = (_layout: Layout[], oldItem: Layout) => {
    setIsDragging(true)
    setDraggedItem(oldItem)
  }

  const handleResizeStart = () => {
    setIsDragging(true)
  }

  const handleDeleteWidget = (widgetId: string) => {
    setDeleteConfirmWidget(widgetId)
  }

  const confirmDeleteWidget = () => {
    if (deleteConfirmWidget) {
      const newLayout = currentLayout.filter(item => item.i !== deleteConfirmWidget)
      setLayouts(prev => ({
        ...prev,
        [currentBreakpoint]: newLayout
      }))
      saveLayout(newLayout, currentBreakpoint, userId, portfolioId)
      setDeleteConfirmWidget(null)
    }
  }

  // Get current layout based on breakpoint
  const currentLayout = useMemo(() => {
    return layouts[currentBreakpoint]
  }, [layouts, currentBreakpoint])

  // Create a set of visible widget IDs for the context
  const visibleWidgetIds = useMemo(() => {
    return new Set(currentLayout.map(item => item.i))
  }, [currentLayout])

  /**
   * Render a widget using the widget registry
   * This replaces the large switch statement with a clean registry-based lookup
   */
  const renderWidget = (widgetId: string) => {
    // Extract base widget ID (handle multiple instances like "total-value-2")
    const baseWidgetId = extractBaseWidgetId(widgetId)
    
    // Get widget configuration from registry
    const widgetConfig = getWidget(baseWidgetId)
    
    if (!widgetConfig) {
      console.warn(`Widget not found in registry: ${baseWidgetId}`)
      return null
    }
    
    // Create widget context
    const context: WidgetContext = {
      widgetId,
      baseWidgetId,
      metrics,
      positions,
      soldPositions: soldPositions || [],
      soldPositionsLoading: soldPositionsLoading || false,
      portfolioCurrency,
      portfolioId,
      userId,
      isPreview: false,
    }
    
    // Get widget props from config
    const widgetProps = widgetConfig.getProps ? widgetConfig.getProps(context) : {}
    
    // Render the widget component
    const WidgetComponent = widgetConfig.component
    return <WidgetComponent {...widgetProps} />
  }

  // Calculate grid width based on container
  const cols = { lg: 12, md: 8, sm: 4 }
  const rowHeight = 50 // Reduced to allow finer height adjustments (0.5 increments)

  // Default skeleton layout for when there are no widgets configured
  const defaultSkeletonLayout: Layout[] = [
    { i: 'skeleton-1', x: 0, y: 0, w: 3, h: 2 },
    { i: 'skeleton-2', x: 3, y: 0, w: 3, h: 2 },
    { i: 'skeleton-3', x: 6, y: 0, w: 2, h: 2 },
    { i: 'skeleton-4', x: 8, y: 0, w: 2, h: 2 },
    { i: 'skeleton-5', x: 10, y: 0, w: 2, h: 2 },
  ]

  return (
    <DashboardProvider visibleWidgetIds={visibleWidgetIds}>
      <div className={isEditMode ? 'dashboard-edit-mode' : ''}>
        {isLoading ? (
          <DashboardSkeleton 
            layout={currentLayout.length > 0 ? currentLayout : defaultSkeletonLayout}
            cols={cols[currentBreakpoint]}
            rowHeight={rowHeight}
          />
        ) : currentLayout.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Your dashboard is feeling lonely!
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md">
            It's like a pizza without toppings. Click the "Edit" and "Add Widget" button to spice things up!
          </p>
          <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-900/30 rounded-lg p-4 max-w-sm">
            <p className="text-sm text-pink-700 dark:text-pink-400">
              💡 <strong>Pro tip:</strong> You can use the default layouts as a starting point!
            </p>
          </div>
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layout={currentLayout}
          cols={cols[currentBreakpoint]}
          rowHeight={rowHeight}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          compactType="vertical"
          preventCollision={false}
          allowOverlap={false}
          margin={[20, 20]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          draggableHandle=".widget-drag-handle"
          useCSSTransforms={false}
          resizeHandles={['s', 'e', 'se']}
          transformScale={1}
        >
          {currentLayout.map((item) => (
            <div key={item.i} className="relative widget-item">
              {isEditMode && (
                <>
                  {/* Drag Handle */}
                  <div className="widget-drag-handle absolute top-0 left-0 right-12 h-8 bg-neutral-100 dark:bg-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center z-10 rounded-tl-lg select-none">
                    <div className="flex gap-1 pointer-events-none">
                      <div className="w-1 h-1 bg-neutral-400 rounded-full"></div>
                      <div className="w-1 h-1 bg-neutral-400 rounded-full"></div>
                      <div className="w-1 h-1 bg-neutral-400 rounded-full"></div>
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteWidget(item.i)}
                    className="absolute top-0 right-0 h-8 w-12 bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-20 rounded-tr-lg select-none"
                    title="Remove widget"
                  >
                    <Trash2 size={16} className="pointer-events-none" />
                  </button>
                </>
              )}
              {renderWidget(item.i)}
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {/* Custom styles for edit mode */}
      <style>{`
        .layout {
          width: 100% !important;
        }
        
        /* Prevent text selection during drag */
        .dashboard-edit-mode * {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
        
        /* Allow text selection in non-edit mode */
        .dashboard-edit-mode.react-grid-item:not(.react-draggable-dragging) * {
          user-select: auto;
          -webkit-user-select: auto;
        }
        
        /* Disable text selection while dragging */
        .react-draggable-dragging,
        .react-draggable-dragging * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          cursor: grabbing !important;
        }
        
        /* Drag handle cursor */
        .widget-drag-handle {
          cursor: grab;
        }
        
        .widget-drag-handle:active {
          cursor: grabbing;
        }
        
        .widget-item:hover .widget-drag-handle,
        .widget-item:hover button[title="Remove widget"] {
          opacity: 1 !important;
        }
        
        .dashboard-edit-mode .react-grid-item {
          transition: all 200ms ease;
          border: 2px dashed transparent;
        }
        
        .dashboard-edit-mode .react-grid-item:hover {
          border-color: rgb(217, 70, 239);
        }
        
        .dashboard-edit-mode .react-grid-item.react-grid-placeholder {
          background: rgb(217, 70, 239);
          opacity: 0.15;
          transition-duration: 100ms;
          z-index: 2;
          border-radius: 0.5rem;
        }
        
        .react-grid-item > .react-resizable-handle::after {
          border-right: 2px solid rgb(217, 70, 239) !important;
          border-bottom: 2px solid rgb(217, 70, 239) !important;
        }
        
        .react-grid-item {
          transition: none;
        }
        
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 100;
          opacity: 0.8;
        }
        
        .react-grid-item.resizing {
          transition: none;
          z-index: 100;
        }
      `}</style>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmWidget !== null}
        onClose={() => setDeleteConfirmWidget(null)}
        onConfirm={confirmDeleteWidget}
        title="Remove Widget"
        message="Are you sure you want to remove this widget from your dashboard?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
      </div>
    </DashboardProvider>
  )
}
