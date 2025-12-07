import { Plus, Trash2, Eye } from 'lucide-react'
import { Layout } from 'react-grid-layout'
import { useTranslation } from 'react-i18next'
import { WidgetConfig } from '../types'
import { isWidgetInstance } from '../utils/widgetUtils'
import { WidgetPreview } from '../widgets/base/WidgetPreview'

type ViewMode = 'grid' | 'list'

interface WidgetCardProps {
  widget: WidgetConfig
  currentLayout: Layout[]
  onAdd: (widget: WidgetConfig) => void
  onRemove: (instanceId: string) => void
  viewMode: ViewMode
  onSelect: (widget: WidgetConfig) => void
  isSelected: boolean
}

/**
 * Individual widget card in the library
 */
export function WidgetCard({ 
  widget, 
  currentLayout, 
  onAdd, 
  onRemove,
  viewMode,
  onSelect,
  isSelected
}: WidgetCardProps) {
  const { t } = useTranslation()
  
  // Get all instances of this widget currently on dashboard
  const instances = currentLayout.filter(item => isWidgetInstance(item.i, widget.id))
  const isOnDashboard = instances.length > 0

  // Grid View
  if (viewMode === 'grid') {
    return (
      <div 
        className={`group relative border-2 rounded-lg transition-all cursor-pointer ${
          isSelected 
            ? 'border-fuchsia-500 shadow-xl ring-2 ring-fuchsia-500/50' 
            : 'border-neutral-200 dark:border-neutral-700 hover:border-fuchsia-400 dark:hover:border-fuchsia-500 hover:shadow-lg'
        }`}
        onClick={() => onSelect(widget)}
      >
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
              <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                {t(widget.description)}
              </p>
            </div>
          </div>

          {/* Preview - Scaled down widget */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg mb-3 flex items-center justify-center p-3 min-h-[140px]">
            <WidgetPreview widget={widget} scale={0.75} />
          </div>

          {/* Size indicator */}
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
            <span>{widget.defaultSize.w}×{widget.defaultSize.h}</span>
            {widget.allowMultiple && (
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                Multi
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAdd(widget)
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus size={16} />
              {t('common.add')}
            </button>

            {isOnDashboard && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(instances[0].i)
                }}
                className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                title={`${t('common.remove')}`}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Active indicator badge */}
        {isOnDashboard && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
            {instances.length}
          </div>
        )}
      </div>
    )
  }

  // List View
  return (
    <div 
      className={`group relative border-2 rounded-lg transition-all cursor-pointer ${
        isSelected 
          ? 'border-fuchsia-500 shadow-xl ring-2 ring-fuchsia-500/50' 
          : 'border-neutral-200 dark:border-neutral-700 hover:border-fuchsia-400 dark:hover:border-fuchsia-500 hover:shadow-lg'
      }`}
      onClick={() => onSelect(widget)}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Icon */}
        <div className={`w-14 h-14 ${widget.iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <widget.icon className={widget.iconColor} size={24} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            {t(widget.name)}
          </h4>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1">
            {t(widget.description)}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400 flex-shrink-0">
          <span>{widget.defaultSize.w}×{widget.defaultSize.h}</span>
          {widget.allowMultiple && (
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              Multiple
            </span>
          )}
          {isOnDashboard && (
            <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {instances.length}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect(widget)
            }}
            className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg transition-colors"
            title="Preview"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAdd(widget)
            }}
            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
          </button>
          {isOnDashboard && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(instances[0].i)
              }}
              className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"
              title={`${t('common.remove')}`}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
