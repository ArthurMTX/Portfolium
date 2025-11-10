import { Plus, Trash2 } from 'lucide-react'
import { Layout } from 'react-grid-layout'
import { useTranslation } from 'react-i18next'
import { WidgetConfig } from '../types'
import { isWidgetInstance } from '../utils/widgetUtils'
import { WidgetPreview } from '../widgets/base/WidgetPreview'

interface WidgetCardProps {
  widget: WidgetConfig
  currentLayout: Layout[]
  onAdd: (widget: WidgetConfig) => void
  onRemove: (instanceId: string) => void
}

/**
 * Individual widget card in the library
 */
export function WidgetCard({ widget, currentLayout, onAdd, onRemove }: WidgetCardProps) {
  const { t } = useTranslation()
  
  // Get all instances of this widget currently on dashboard
  const instances = currentLayout.filter(item => isWidgetInstance(item.i, widget.id))
  const isOnDashboard = instances.length > 0

  return (
    <div className="group relative border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-fuchsia-400 dark:hover:border-fuchsia-500 transition-all hover:shadow-lg">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 ${widget.iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <widget.icon className={widget.iconColor} size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {t(widget.name)}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {widget.description}
            </p>
          </div>
        </div>

        {/* Preview - Scaled down widget */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg mb-3 flex items-center justify-center p-3 min-h-[160px]">
          <WidgetPreview widget={widget} scale={0.65} />
        </div>

        {/* Size indicator */}
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
          <span>Size: {widget.defaultSize.w}x{widget.defaultSize.h}</span>
          {widget.allowMultiple && (
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              Can add multiple
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onAdd(widget)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={16} />
            Add
          </button>

          {isOnDashboard && (
            <div className="flex gap-1">
              {instances.map((instance) => (
                <button
                  key={instance.i}
                  onClick={() => onRemove(instance.i)}
                  className="px-2 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                  title={`Remove ${instance.i}`}
                >
                  <Trash2 size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active indicator badge */}
      {isOnDashboard && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          {instances.length}
        </div>
      )}
    </div>
  )
}
