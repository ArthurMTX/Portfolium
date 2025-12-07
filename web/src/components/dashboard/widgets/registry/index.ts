import { WidgetConfig, WidgetCategory } from '../../types'
import { widgetDefinitions } from './widgetDefinitions'

/**
 * Widget Registry
 * Central registry for all dashboard widgets with helper functions
 */
class WidgetRegistry {
  private widgets: Map<string, WidgetConfig>

  constructor(definitions: WidgetConfig[]) {
    this.widgets = new Map(definitions.map(widget => [widget.id, widget]))
  }

  /**
   * Get a widget configuration by ID
   */
  getWidget(id: string): WidgetConfig | undefined {
    return this.widgets.get(id)
  }

  /**
   * Get all widget configurations
   */
  getAllWidgets(): WidgetConfig[] {
    return Array.from(this.widgets.values())
  }

  /**
   * Get widgets filtered by category
   */
  getWidgetsByCategory(category: WidgetCategory): WidgetConfig[] {
    return this.getAllWidgets().filter(widget => widget.category === category)
  }

  /**
   * Get widgets grouped by category
   */
  getWidgetsGroupedByCategory(): Record<string, WidgetConfig[]> {
    return this.getAllWidgets().reduce((acc, widget) => {
      if (!acc[widget.category]) {
        acc[widget.category] = []
      }
      acc[widget.category].push(widget)
      return acc
    }, {} as Record<string, WidgetConfig[]>)
  }

  /**
   * Check if a widget exists
   */
  hasWidget(id: string): boolean {
    return this.widgets.has(id)
  }

  /**
   * Get widget count
   */
  getWidgetCount(): number {
    return this.widgets.size
  }

  /**
   * Search widgets by name or description
   */
  searchWidgets(query: string): WidgetConfig[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllWidgets().filter(widget =>
      widget.name.toLowerCase().includes(lowerQuery) ||
      widget.description.toLowerCase().includes(lowerQuery)
    )
  }
}

// Create and export the singleton registry instance
export const widgetRegistry = new WidgetRegistry(widgetDefinitions)

// Export convenience functions
export const getWidget = (id: string) => widgetRegistry.getWidget(id)
export const getAllWidgets = () => widgetRegistry.getAllWidgets()
export const getWidgetsByCategory = (category: WidgetCategory) => 
  widgetRegistry.getWidgetsByCategory(category)
export const getWidgetsGroupedByCategory = () => 
  widgetRegistry.getWidgetsGroupedByCategory()
export const hasWidget = (id: string) => widgetRegistry.hasWidget(id)
export const searchWidgets = (query: string) => widgetRegistry.searchWidgets(query)
