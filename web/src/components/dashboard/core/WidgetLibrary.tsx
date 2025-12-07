import { useState, useMemo } from 'react'
import { X, Trash2, Search, Grid3x3, List, Info } from 'lucide-react'
import { Layout } from 'react-grid-layout'
import { getWidgetsGroupedByCategory } from '../widgets/registry'
import { generateWidgetInstanceId } from '../utils/widgetUtils'
import { WidgetConfig, WidgetCategory } from '../types'
import { saveLayout, loadLayout } from '../utils/defaultLayouts'
import ConfirmModal from '../../ConfirmModal'
import { WidgetGallery } from './WidgetGallery'
import { useTranslation } from 'react-i18next'
import { getCategoryLabel } from '../widgets/registry/categories'
import { MockDataProvider, mockMetrics, mockPositions } from '../utils/mockDataProvider'

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

type ViewMode = 'grid' | 'list'

/**
 * Enhanced Widget Library with search, filters, and preview
 */
export default function WidgetLibraryNew({
  isOpen,
  onClose,
  currentBreakpoint,
  currentLayout,
  onLayoutChange,
  onVisibilityChange,
  userId,
}: WidgetLibraryNewProps) {
  const [showResetModal, setShowResetModal] = useState(false)
  const [showAlreadyExistsModal, setShowAlreadyExistsModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedWidget, setSelectedWidget] = useState<WidgetConfig | null>(null)
  const { t } = useTranslation()

  // Get widgets grouped by category from registry
  const groupedWidgets = getWidgetsGroupedByCategory()
  
  // Get all categories
  const categories: WidgetCategory[] = ['metrics', 'data', 'insights']
  
  // Filter and search widgets
  const filteredWidgets = useMemo(() => {
    const allWidgets = Object.values(groupedWidgets).flat()
    
    let filtered = allWidgets
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(w => w.category === selectedCategory)
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(w => 
        t(w.name).toLowerCase().includes(query) ||
        t(w.description).toLowerCase().includes(query) ||
        w.id.toLowerCase().includes(query)
      )
    }
    
    // Group by category
    const grouped: Record<string, WidgetConfig[]> = {}
    filtered.forEach(widget => {
      if (!grouped[widget.category]) {
        grouped[widget.category] = []
      }
      grouped[widget.category].push(widget)
    })
    
    return grouped
  }, [groupedWidgets, selectedCategory, searchQuery, t])

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
    saveLayout(newLayout, currentBreakpoint, userId)
    onVisibilityChange()
  }

  /**
   * Remove a widget from the dashboard
   */
  const removeWidget = (widgetId: string) => {
    const newLayout = currentLayout.filter(item => item.i !== widgetId)
    onLayoutChange(newLayout)
    saveLayout(newLayout, currentBreakpoint, userId)
    onVisibilityChange()
  }

  /**
   * Reset dashboard to default layout
   */
  const resetToDefault = () => {
    // Clear all layout and visibility data from localStorage
    if (userId) {
      localStorage.removeItem(`dashboard-layout-${userId}-lg`)
      localStorage.removeItem(`dashboard-layout-${userId}-md`)
      localStorage.removeItem(`dashboard-layout-${userId}-sm`)
    } else {
      localStorage.removeItem(`dashboard-layout-lg`)
      localStorage.removeItem(`dashboard-layout-md`)
      localStorage.removeItem(`dashboard-layout-sm`)
    }
    localStorage.removeItem('dashboard-widget-visibility')
    
    // Reload default layout for current breakpoint
    const defaultLayout = loadLayout(currentBreakpoint, userId)
    onLayoutChange(defaultLayout)
    onVisibilityChange()
    onClose()
  }

  if (!isOpen) return null

  const totalWidgets = Object.values(groupedWidgets).flat().length
  const filteredCount = Object.values(filteredWidgets).flat().length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {t('dashboard.widgets.library.title')}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {filteredCount} of {totalWidgets} widgets • {currentLayout.length} active
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder={t('common.search') + ' widgets...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Category Tabs and View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-fuchsia-600 text-white shadow-lg'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t('common.all')} ({totalWidgets})
              </button>
              {categories.map((category) => {
                const count = groupedWidgets[category]?.length || 0
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                      selectedCategory === category
                        ? 'bg-fuchsia-600 text-white shadow-lg'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {t(getCategoryLabel(category))} ({count})
                  </button>
                )
              })}
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
                title="Grid View"
              >
                <Grid3x3 size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
                title="List View"
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Widget Gallery - Left Side */}
          <div className="flex-1 overflow-y-auto">
            <WidgetGallery
              widgets={filteredWidgets}
              currentLayout={currentLayout}
              onAddWidget={addWidget}
              onRemoveWidget={removeWidget}
              viewMode={viewMode}
              onWidgetSelect={setSelectedWidget}
              selectedWidgetId={selectedWidget?.id}
            />
            
            {/* Empty State */}
            {filteredCount === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Info size={64} className="text-neutral-300 dark:text-neutral-700 mb-4" />
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  {t('common.noResults')}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 max-w-md">
                  Try adjusting your search or filters to find widgets
                </p>
              </div>
            )}
          </div>

          {/* Preview Panel - Right Side */}
          {selectedWidget && (
            <div className="w-[400px] border-l border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 overflow-y-auto flex-shrink-0">
              <div className="p-6 space-y-6">
                {/* Widget Header */}
                <div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-16 h-16 ${selectedWidget.iconBgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <selectedWidget.icon className={selectedWidget.iconColor} size={28} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                        {t(selectedWidget.name)}
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {t(selectedWidget.description)}
                      </p>
                    </div>
                  </div>

                  {/* Widget Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-3">
                      <div className="text-neutral-500 dark:text-neutral-400 mb-1">Category</div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {t(getCategoryLabel(selectedWidget.category))}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-3">
                      <div className="text-neutral-500 dark:text-neutral-400 mb-1">Size</div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {selectedWidget.defaultSize.w} × {selectedWidget.defaultSize.h}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-3">
                      <div className="text-neutral-500 dark:text-neutral-400 mb-1">Multiple</div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {selectedWidget.allowMultiple ? t('common.yes') : t('common.no')}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-3">
                      <div className="text-neutral-500 dark:text-neutral-400 mb-1">Active</div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {currentLayout.filter(item => item.i.startsWith(selectedWidget.id)).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                    Preview
                  </h4>
                  <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border-2 border-neutral-200 dark:border-neutral-700">
                    <div className="transform scale-90 origin-top-left" style={{ width: '111%', height: '400px' }}>
                      <MockDataProvider>
                        {selectedWidget.previewComponent ? (
                          <selectedWidget.previewComponent 
                            {...(selectedWidget.getProps?.({
                              widgetId: selectedWidget.id,
                              baseWidgetId: selectedWidget.id,
                              metrics: mockMetrics,
                              positions: mockPositions,
                              soldPositions: [],
                              soldPositionsLoading: false,
                              portfolioCurrency: 'USD',
                              isPreview: true,
                            }) || {})}
                            isPreview={true}
                          />
                        ) : (
                          <selectedWidget.component 
                            {...(selectedWidget.getProps?.({
                              widgetId: selectedWidget.id,
                              baseWidgetId: selectedWidget.id,
                              metrics: mockMetrics,
                              positions: mockPositions,
                              soldPositions: [],
                              soldPositionsLoading: false,
                              portfolioCurrency: 'USD',
                              isPreview: true,
                            }) || {})}
                            isPreview={true}
                          />
                        )}
                      </MockDataProvider>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      addWidget(selectedWidget)
                      setSelectedWidget(null)
                    }}
                    className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
                  >
                    Add to Dashboard
                  </button>
                  {currentLayout.some(item => item.i.startsWith(selectedWidget.id)) && (
                    <button
                      onClick={() => setSelectedWidget(null)}
                      className="w-full py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-neutral-100 rounded-lg font-medium transition-colors"
                    >
                      Close Preview
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0 bg-neutral-50 dark:bg-neutral-800/50">
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
          >
            <Trash2 size={16} />
            {t('common.resetToDefault')}
          </button>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {searchQuery && `Showing ${filteredCount} of ${totalWidgets} widgets`}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700 transition-colors font-medium shadow-lg"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={resetToDefault}
        title={t('dashboard.widgets.library.resetDashboard')}
        message={t('dashboard.widgets.library.resetDashboardMessage')}
        confirmText={t('common.reset')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <ConfirmModal
        isOpen={showAlreadyExistsModal}
        onClose={() => setShowAlreadyExistsModal(false)}
        onConfirm={() => setShowAlreadyExistsModal(false)}
        title={t('dashboard.widgets.library.widgetAlreadyExists')}
        message={t('dashboard.widgets.library.widgetAlreadyExistsMessage')}
        confirmText={t('common.ok')}
        cancelText=""
        variant="info"
      />
    </div>
  )
}
