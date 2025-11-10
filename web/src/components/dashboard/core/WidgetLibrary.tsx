import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { Layout } from 'react-grid-layout'
import { getWidgetsGroupedByCategory } from '../widgets/registry'
import { generateWidgetInstanceId } from '../utils/widgetUtils'
import { WidgetConfig } from '../types'
import { saveLayout, loadLayout } from '../utils/defaultLayouts'
import ConfirmModal from '../../ConfirmModal'
import { WidgetGallery } from './WidgetGallery'

interface WidgetLibraryNewProps {
  isOpen: boolean
  onClose: () => void
  currentBreakpoint: 'lg' | 'md' | 'sm'
  currentLayout: Layout[]
  onLayoutChange: (layout: Layout[]) => void
  onVisibilityChange: () => void
  userId?: number
  portfolioId?: number
}

/**
 * Simplified Widget Library using the widget registry
 */
export default function WidgetLibraryNew({
  isOpen,
  onClose,
  currentBreakpoint,
  currentLayout,
  onLayoutChange,
  onVisibilityChange,
  userId,
  portfolioId,
}: WidgetLibraryNewProps) {
  const [showResetModal, setShowResetModal] = useState(false)
  const [showAlreadyExistsModal, setShowAlreadyExistsModal] = useState(false)

  // Get widgets grouped by category from registry
  const groupedWidgets = getWidgetsGroupedByCategory()

  /**
   * Add a widget to the dashboard
   */
  const addWidget = (widget: WidgetConfig) => {
    // Check if single-instance widget already exists
    if (!widget.allowMultiple) {
      const exists = currentLayout.some(item => item.i === widget.id)
      if (exists) {
        setShowAlreadyExistsModal(true)
        return
      }
    }

    // Find the lowest y position to add widget at the bottom
    const maxY = currentLayout.reduce((max, item) => {
      return Math.max(max, item.y + item.h)
    }, 0)

    // Generate unique ID
    const existingIds = currentLayout.map(item => item.i)
    const widgetId = generateWidgetInstanceId(widget.id, existingIds)

    const newLayoutItem: Layout = {
      i: widgetId,
      x: 0,
      y: maxY,
      w: widget.defaultSize.w,
      h: widget.defaultSize.h,
      minW: widget.defaultSize.minW,
      minH: widget.defaultSize.minH,
      maxH: widget.defaultSize.maxH,
    }

    const newLayout = [...currentLayout, newLayoutItem]
    onLayoutChange(newLayout)
    saveLayout(newLayout, currentBreakpoint, userId, portfolioId)
    onVisibilityChange()
  }

  /**
   * Remove a widget from the dashboard
   */
  const removeWidget = (widgetId: string) => {
    const newLayout = currentLayout.filter(item => item.i !== widgetId)
    onLayoutChange(newLayout)
    saveLayout(newLayout, currentBreakpoint, userId, portfolioId)
    onVisibilityChange()
  }

  /**
   * Reset dashboard to default layout
   */
  const resetToDefault = () => {
    // Clear all layout and visibility data from localStorage
    if (userId && portfolioId) {
      localStorage.removeItem(`dashboard-layout-${userId}-${portfolioId}-lg`)
      localStorage.removeItem(`dashboard-layout-${userId}-${portfolioId}-md`)
      localStorage.removeItem(`dashboard-layout-${userId}-${portfolioId}-sm`)
    } else {
      localStorage.removeItem(`dashboard-layout-lg`)
      localStorage.removeItem(`dashboard-layout-md`)
      localStorage.removeItem(`dashboard-layout-sm`)
    }
    localStorage.removeItem('dashboard-widget-visibility')
    
    // Reload default layout for current breakpoint
    const defaultLayout = loadLayout(currentBreakpoint, userId, portfolioId)
    onLayoutChange(defaultLayout)
    onVisibilityChange()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Widget Library
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Click to add widgets to your dashboard • {currentLayout.length} widgets active
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Widget Gallery */}
        <WidgetGallery
          widgets={groupedWidgets}
          currentLayout={currentLayout}
          onAddWidget={addWidget}
          onRemoveWidget={removeWidget}
        />

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
          >
            <Trash2 size={16} />
            Reset to Default
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={resetToDefault}
        title="Reset Dashboard"
        message="Reset dashboard to default layout? This will remove all your customizations and widgets."
        confirmText="Reset"
        cancelText="Cancel"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showAlreadyExistsModal}
        onClose={() => setShowAlreadyExistsModal(false)}
        onConfirm={() => setShowAlreadyExistsModal(false)}
        title="Widget Already Exists"
        message="This widget is already on your dashboard. You can only add one instance of this widget type."
        confirmText="OK"
        cancelText=""
        variant="info"
      />
    </div>
  )
}
