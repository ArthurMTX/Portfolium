import { Layout } from 'react-grid-layout'
import { WidgetConfig } from '../types'
import { getCategoryLabel } from '../widgets/registry/categories'
import { WidgetCard } from './WidgetCard'
import { useTranslation } from 'react-i18next'

type ViewMode = 'grid' | 'list'

interface WidgetGalleryProps {
  widgets: Record<string, WidgetConfig[]>
  currentLayout: Layout[]
  onAddWidget: (widget: WidgetConfig) => void
  onRemoveWidget: (instanceId: string) => void
  viewMode: ViewMode
  onWidgetSelect: (widget: WidgetConfig) => void
  selectedWidgetId?: string
}

/**
 * Grid of widgets grouped by category
 */
export function WidgetGallery({
  widgets,
  currentLayout,
  onAddWidget,
  onRemoveWidget,
  viewMode,
  onWidgetSelect,
  selectedWidgetId,
}: WidgetGalleryProps) {
  const { t } = useTranslation()
  
  const gridClass = viewMode === 'grid' 
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
    : 'flex flex-col gap-3'
  
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {Object.entries(widgets).map(([category, categoryWidgets]) => (
        <div key={category} className="mb-8 last:mb-0">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            {t(getCategoryLabel(category))}
            <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
              ({categoryWidgets.length})
            </span>
          </h3>
          <div className={gridClass}>
            {categoryWidgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                currentLayout={currentLayout}
                onAdd={onAddWidget}
                onRemove={onRemoveWidget}
                viewMode={viewMode}
                onSelect={onWidgetSelect}
                isSelected={selectedWidgetId === widget.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
