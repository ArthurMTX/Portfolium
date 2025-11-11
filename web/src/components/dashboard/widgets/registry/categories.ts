import { CategoryConfig } from '../types'

/**
 * Widget category configurations
 */
export const widgetCategories: CategoryConfig[] = [
  {
    id: 'metrics',
    label: 'dashboard.widgets.categories.metrics.label',
    description: 'dashboard.widgets.categories.metrics.description',
  },
  {
    id: 'data',
    label: 'dashboard.widgets.categories.data.label',
    description: 'dashboard.widgets.categories.data.description',
  },
  {
    id: 'insights',
    label: 'dashboard.widgets.categories.insights.label',
    description: 'dashboard.widgets.categories.insights.description',
  },
]

export function getCategoryLabel(categoryId: string): string {
  const category = widgetCategories.find(c => c.id === categoryId)
  return category?.label || categoryId
}
