import { CategoryConfig } from '../types'

/**
 * Widget category configurations
 */
export const widgetCategories: CategoryConfig[] = [
  {
    id: 'metrics',
    label: 'Key Metrics',
    description: 'Essential portfolio statistics and values',
  },
  {
    id: 'data',
    label: 'Data & Lists',
    description: 'Tabular data and list views',
  },
  {
    id: 'insights',
    label: 'Charts & Insights',
    description: 'Visual analytics and performance data',
  },
]

export function getCategoryLabel(categoryId: string): string {
  const category = widgetCategories.find(c => c.id === categoryId)
  return category?.label || categoryId
}
