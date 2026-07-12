import { useState, useMemo } from 'react'
import { X, Search, Grid3x3, List, Info } from 'lucide-react'
import { Layout } from 'react-grid-layout'
import { getWidgetsGroupedByCategory } from '@/features/boards/components/widgets/registry'
import { generateWidgetInstanceId } from '@/features/boards/components/utils/widgetUtils'
import { WidgetConfig, WidgetCategory } from '@/features/boards/components/types'
import ConfirmModal from '@/shared/components/ConfirmModal'
import { WidgetGallery } from '@/features/boards/components/core/WidgetGallery'
import { useTranslation } from 'react-i18next'
import { getCategoryLabel } from '@/features/boards/components/widgets/registry/categories'
import { MockDataProvider, mockMetrics, mockPositions } from '@/features/boards/components/utils/mockDataProvider'

interface AddWidgetModalProps {
  isOpen: boolean
  onClose: () => void
  currentLayout: Layout[]
  onLayoutChange: (layout: Layout[]) => void
}

type ViewMode = 'grid' | 'list'

/**
 * Add Widget flow: browse the registry, search/filter by category, preview
 * with mock data, and add to the current board's layout.
 */
export default function AddWidgetModal({
  isOpen,
  onClose,
  currentLayout,
  onLayoutChange,
}: AddWidgetModalProps) {
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
   * Add a widget to the board's layout, placed at the next free row.
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
      ...(widget.defaultSize.minW !== undefined && { minW: widget.defaultSize.minW }),
      ...(widget.defaultSize.minH !== undefined && { minH: widget.defaultSize.minH }),
      ...(widget.defaultSize.maxH !== undefined && { maxH: widget.defaultSize.maxH }),
    }

    onLayoutChange([...currentLayout, newLayoutItem])
  }

  /**
   * Remove a widget from the board's layout.
   */
  const removeWidget = (widgetId: string) => {
    onLayoutChange(currentLayout.filter(item => item.i !== widgetId))
  }

  if (!isOpen) return null

  const totalWidgets = Object.values(groupedWidgets).flat().length
  const filteredCount = Object.values(filteredWidgets).flat().length

  return (
    <div className="pf-modal-overlay">
      <div className="pf-modal-panel w-full max-w-[95vw] h-[95vh] flex flex-col" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="pf-modal-header flex-shrink-0">
          <div>
            <h2 className="pf-modal-title">
              {t('boards.addWidget.title')}
            </h2>
            <p className="pf-modal-description">
              {t('boards.addWidget.countSummary', { filtered: filteredCount, total: totalWidgets, active: currentLayout.length })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="pf-modal-close"
            aria-label={t('common.close')}
          >
            <X size={24} />
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="board-add-widget__filters flex-shrink-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="board-add-widget__search-icon" size={20} aria-hidden="true" />
            <label htmlFor="board-widget-search" className="sr-only">
              {t('boards.addWidget.searchLabel')}
            </label>
            <input
              id="board-widget-search"
              type="text"
              placeholder={t('boards.addWidget.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="board-add-widget__search-input"
            />
          </div>

          {/* Category Tabs and View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="board-add-widget__categories" role="tablist" aria-label={t('boards.addWidget.categoriesLabel')}>
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === 'all'}
                onClick={() => setSelectedCategory('all')}
                className={`board-add-widget__category-tab ${selectedCategory === 'all' ? 'is-active' : ''}`}
              >
                {t('common.all')} ({totalWidgets})
              </button>
              {categories.map((category) => {
                const count = groupedWidgets[category]?.length || 0
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                    className={`board-add-widget__category-tab ${selectedCategory === category ? 'is-active' : ''}`}
                  >
                    {t(getCategoryLabel(category))} ({count})
                  </button>
                )
              })}
            </div>

            {/* View Mode Toggle */}
            <div className="board-add-widget__view-toggle" role="group" aria-label={t('boards.addWidget.viewModeLabel')}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`board-add-widget__view-button ${viewMode === 'grid' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'grid'}
                title={t('boards.addWidget.gridView')}
                aria-label={t('boards.addWidget.gridView')}
              >
                <Grid3x3 size={20} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`board-add-widget__view-button ${viewMode === 'list' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'list'}
                title={t('boards.addWidget.listView')}
                aria-label={t('boards.addWidget.listView')}
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
                  {t('boards.addWidget.noResultsHint')}
                </p>
              </div>
            )}
          </div>

          {/* Preview Panel - Right Side */}
          {selectedWidget && (
            <div className="board-add-widget__preview-panel">
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
                    <div className="board-add-widget__detail-card">
                      <div className="board-add-widget__detail-label">{t('common.category')}</div>
                      <div className="board-add-widget__detail-value">
                        {t(getCategoryLabel(selectedWidget.category))}
                      </div>
                    </div>
                    <div className="board-add-widget__detail-card">
                      <div className="board-add-widget__detail-label">{t('common.size')}</div>
                      <div className="board-add-widget__detail-value">
                        {selectedWidget.defaultSize.w} × {selectedWidget.defaultSize.h}
                      </div>
                    </div>
                    <div className="board-add-widget__detail-card">
                      <div className="board-add-widget__detail-label">{t('common.canAddMultiple')}</div>
                      <div className="board-add-widget__detail-value">
                        {selectedWidget.allowMultiple ? t('common.yes') : t('common.no')}
                      </div>
                    </div>
                    <div className="board-add-widget__detail-card">
                      <div className="board-add-widget__detail-label">{t('common.active')}</div>
                      <div className="board-add-widget__detail-value">
                        {currentLayout.filter(item => item.i.startsWith(selectedWidget.id)).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                    {t('boards.addWidget.preview')}
                  </h4>
                  <div className="board-add-widget__preview-frame">
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
                    type="button"
                    onClick={() => {
                      addWidget(selectedWidget)
                      setSelectedWidget(null)
                    }}
                    className="pf-button pf-button--primary w-full justify-center"
                  >
                    {t('boards.addWidget.addToBoard')}
                  </button>
                  {currentLayout.some(item => item.i.startsWith(selectedWidget.id)) && (
                    <button
                      type="button"
                      onClick={() => setSelectedWidget(null)}
                      className="pf-button pf-button--secondary w-full justify-center"
                    >
                      {t('boards.addWidget.closePreview')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="board-add-widget__footer">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {searchQuery && t('boards.addWidget.filteredSummary', { filtered: filteredCount, total: totalWidgets })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pf-button pf-button--primary"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* Already-exists modal */}
      <ConfirmModal
        isOpen={showAlreadyExistsModal}
        onClose={() => setShowAlreadyExistsModal(false)}
        onConfirm={() => setShowAlreadyExistsModal(false)}
        title={t('boards.addWidget.widgetAlreadyExists')}
        message={t('boards.addWidget.widgetAlreadyExistsMessage')}
        confirmText={t('common.ok')}
        cancelText=""
        variant="info"
      />
    </div>
  )
}
