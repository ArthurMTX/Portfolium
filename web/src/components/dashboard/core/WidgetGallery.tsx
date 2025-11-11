import { Layout } from 'react-grid-layout'
import { WidgetConfig } from '../types'
import { getCategoryLabel } from '../widgets/registry/categories'
import { WidgetCard } from './WidgetCard'
import { useTranslation } from 'react-i18next'

interface WidgetGalleryProps {
  widgets: Record<string, WidgetConfig[]>
  currentLayout: Layout[]
  onAddWidget: (widget: WidgetConfig) => void
  onRemoveWidget: (instanceId: string) => void
}

/**
 * Grid of widgets grouped by category
 */
export function WidgetGallery({
  widgets,
  currentLayout,
  onAddWidget,
  onRemoveWidget,
}: WidgetGalleryProps) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {Object.entries(widgets).map(([category, categoryWidgets]) => (
        <div key={category} className="mb-8 last:mb-0">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            {t(getCategoryLabel(category))}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryWidgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                currentLayout={currentLayout}
                onAdd={onAddWidget}
                onRemove={onRemoveWidget}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
