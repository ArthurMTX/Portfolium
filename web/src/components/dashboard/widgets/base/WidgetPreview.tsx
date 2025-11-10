import { WidgetConfig, WidgetContext } from '../../types'
import { MockDataProvider, mockPositions, mockMetrics } from '../../utils/mockDataProvider'

interface WidgetPreviewProps {
  widget: WidgetConfig
  scale?: number
}

/**
 * Renders a widget preview with appropriate mock data and scaling
 */
export function WidgetPreview({ widget, scale = 0.6 }: WidgetPreviewProps) {
  const WidgetComponent = widget.component

  // Calculate container dimensions based on widget size
  // Grid column width ≈ 80px, row height ≈ 50px (approximate)
  const containerWidth = widget.defaultSize.w * 80
  const containerHeight = widget.defaultSize.h * 50
  
  // Scaled dimensions for the preview container
  const previewWidth = containerWidth * scale
  const previewHeight = containerHeight * scale

  // If widget doesn't have getProps, show placeholder
  if (!widget.getProps) {
    return (
      <div 
        className="flex items-center justify-center bg-neutral-100 dark:bg-neutral-800/30 rounded"
        style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
      >
        <div className="text-center text-neutral-400 dark:text-neutral-500">
          <widget.icon size={24} className="mx-auto mb-1 opacity-50" />
          <p className="text-xs">Preview</p>
        </div>
      </div>
    )
  }

  // Create mock context with appropriate data
  const mockContext: WidgetContext = {
    widgetId: `preview-${widget.id}`,
    baseWidgetId: widget.id,
    metrics: mockMetrics,
    positions: mockPositions,
    soldPositions: [],
    soldPositionsLoading: false,
    portfolioCurrency: 'EUR',
    portfolioId: 1,
    userId: 1,
    isPreview: true,
  }

  let widgetProps
  try {
    widgetProps = widget.getProps(mockContext)
  } catch (error) {
    console.error(`Error getting props for widget ${widget.id}:`, error)
    return (
      <div 
        className="flex items-center justify-center bg-neutral-100 dark:bg-neutral-800/30 rounded"
        style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
      >
        <div className="text-center text-neutral-400 dark:text-neutral-500">
          <widget.icon size={24} className="mx-auto mb-1 opacity-50" />
          <p className="text-xs">Preview Error</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="overflow-hidden rounded"
      style={{ 
        width: `${previewWidth}px`, 
        height: `${previewHeight}px`,
      }}
    >
      <MockDataProvider>
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${scale})`,
            width: `${containerWidth}px`,
            height: `${containerHeight}px`,
            pointerEvents: 'none',
          }}
        >
          <WidgetComponent {...widgetProps} />
        </div>
      </MockDataProvider>
    </div>
  )
}
