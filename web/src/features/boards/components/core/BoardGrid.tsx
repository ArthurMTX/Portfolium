import { useState, useEffect, useMemo } from 'react'
import GridLayout, { Layout, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripVertical, X } from 'lucide-react'
import BoardSkeleton from '@/features/boards/components/core/BoardSkeleton'
import ConfirmModal from '@/shared/components/ConfirmModal'
import { StateBlock } from '@/shared/components/StatePrimitives'
import { PositionDTO } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import { BoardProvider } from '@/features/boards/context/BoardContext'
import { getWidget } from '@/features/boards/components/widgets/registry'
import { extractBaseWidgetId } from '@/features/boards/components/utils/widgetUtils'
import { WidgetContext } from '@/features/boards/components/types'
import { cleanLayout } from '@/features/boards/components/utils/layoutCompaction'
import { WidgetErrorBoundary } from '@/features/boards/components/core/WidgetErrorBoundary'
import type { LayoutConfig } from '@/features/boards/types'

const ResponsiveGridLayout = WidthProvider(GridLayout)

type Breakpoint = 'lg' | 'md' | 'sm'

interface BoardGridProps {
  layoutConfig: LayoutConfig
  onLayoutChange: (breakpoint: Breakpoint, layout: Layout[]) => void
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
  userId?: number
  portfolioId?: number
  batchData?: unknown // Batch data from useDashboardBatch
}

export default function BoardGrid({
  layoutConfig,
  onLayoutChange,
  metrics,
  positions,
  soldPositions,
  soldPositionsLoading,
  isEditMode,
  isLoading = false,
  userId,
  portfolioId,
  batchData,
}: BoardGridProps) {
  // Initialize breakpoint based on current window size immediately
  const getInitialBreakpoint = (): Breakpoint => {
    if (typeof window === 'undefined') return 'lg'
    const width = window.innerWidth
    if (width >= 1024) return 'lg'
    if (width >= 768) return 'md'
    return 'sm'
  }

  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>(getInitialBreakpoint)
  const [deleteConfirmWidget, setDeleteConfirmWidget] = useState<string | null>(null)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'
  const { t } = useTranslation()

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
  const [liveLayout, setLiveLayout] = useState<Layout[] | null>(null)

  // Current layout based on breakpoint (backend-persisted config is the source of truth,
  // liveLayout is only used to smooth in-progress drag/resize before it's committed)
  const currentLayout = useMemo(() => {
    return liveLayout ?? layoutConfig[currentBreakpoint]
  }, [liveLayout, layoutConfig, currentBreakpoint])

  const handleGridLayoutChange = (layout: Layout[]) => {
    if (isEditMode && isDragging) {
      // Update the layout immediately so the widget resizes/moves smoothly;
      // we compact and persist when the drag/resize operation completes.
      setLiveLayout(layout)
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
      setLiveLayout(null)
      onLayoutChange(currentBreakpoint, cleanedLayout)

      setDraggedItem(null)
    }
  }

  const handleResizeStop = (layout: Layout[]) => {
    if (isEditMode) {
      setIsDragging(false)

      // Save layout as-is when resize operation completes
      // react-grid-layout's built-in compaction handles the positioning
      const cleanedLayout = cleanLayout(layout)
      setLiveLayout(null)
      onLayoutChange(currentBreakpoint, cleanedLayout)
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
      onLayoutChange(currentBreakpoint, newLayout)
      setDeleteConfirmWidget(null)
    }
  }

  /**
   * Keyboard-accessible alternative to dragging: nudges a widget one grid cell
   * in the given direction. Exposed as arrow buttons on each widget in edit mode.
   */
  const moveWidgetByKeyboard = (widgetId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const cols = currentBreakpoint === 'lg' ? 12 : currentBreakpoint === 'md' ? 8 : 4
    const newLayout = currentLayout.map(item => {
      if (item.i !== widgetId) return item
      const deltas: Record<typeof direction, [number, number]> = {
        up: [0, -1],
        down: [0, 1],
        left: [-1, 0],
        right: [1, 0],
      }
      const [dx, dy] = deltas[direction]
      return {
        ...item,
        x: Math.max(0, Math.min(cols - item.w, item.x + dx)),
        y: Math.max(0, item.y + dy),
      }
    })
    onLayoutChange(currentBreakpoint, cleanLayout(newLayout))
  }

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
      batchData, // Pass batch data to widgets
    }

    // Get widget props from config
    const widgetProps = widgetConfig.getProps ? widgetConfig.getProps(context) : {}

    // Render the widget component
    const WidgetComponent = widgetConfig.component
    return (
      <WidgetErrorBoundary widgetId={widgetId}>
        <WidgetComponent {...widgetProps} />
      </WidgetErrorBoundary>
    )
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
    <BoardProvider visibleWidgetIds={visibleWidgetIds}>
      <div className={isEditMode ? 'board-grid board-grid--edit' : 'board-grid'}>
        {isLoading ? (
          <BoardSkeleton
            layout={currentLayout.length > 0 ? currentLayout : defaultSkeletonLayout}
            cols={cols[currentBreakpoint]}
            rowHeight={rowHeight}
          />
        ) : currentLayout.length === 0 ? (
          <StateBlock
            tone="empty"
            eyebrow={t('boards.detail.emptyEyebrow')}
            title={t('boards.detail.emptyTitle')}
            description={t('boards.detail.emptyDescription')}
          />
        ) : (
          <ResponsiveGridLayout
            className="board-grid__layout"
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
            onLayoutChange={handleGridLayoutChange}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            onResizeStart={handleResizeStart}
            onResizeStop={handleResizeStop}
            draggableHandle=".board-widget__drag-handle"
            useCSSTransforms={false}
            resizeHandles={['s', 'e', 'se']}
            transformScale={1}
          >
            {currentLayout.map((item) => (
              <div key={item.i} className="board-widget-item">
                {isEditMode && (
                  <>
                    <button
                      type="button"
                      className="board-widget__drag-handle"
                      tabIndex={0}
                      aria-label={t('boards.detail.moveWidget')}
                    >
                      <GripVertical size={14} aria-hidden="true" />
                    </button>

                    <div
                      className="board-widget__move-controls"
                      role="group"
                      aria-label={t('boards.detail.moveWidget')}
                    >
                      <button
                        type="button"
                        onClick={() => moveWidgetByKeyboard(item.i, 'up')}
                        aria-label={t('boards.detail.moveWidgetUp')}
                      >
                        <ArrowUp size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidgetByKeyboard(item.i, 'down')}
                        aria-label={t('boards.detail.moveWidgetDown')}
                      >
                        <ArrowDown size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidgetByKeyboard(item.i, 'left')}
                        aria-label={t('boards.detail.moveWidgetLeft')}
                      >
                        <ArrowLeft size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidgetByKeyboard(item.i, 'right')}
                        aria-label={t('boards.detail.moveWidgetRight')}
                      >
                        <ArrowRight size={12} aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteWidget(item.i)}
                      className="board-widget__remove-button"
                      aria-label={t('boards.detail.removeWidget')}
                      title={t('boards.detail.removeWidget')}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </>
                )}
                {renderWidget(item.i)}
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmWidget !== null}
        onClose={() => setDeleteConfirmWidget(null)}
        onConfirm={confirmDeleteWidget}
        title={t('boards.detail.removeWidget')}
        message={t('boards.detail.removeWidgetMessage')}
        confirmText={t('common.remove')}
        cancelText={t('common.cancel')}
        variant="danger"
      />
    </BoardProvider>
  )
}
