import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Layers, 
  Search, 
  Grid3x3,
  List,
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react'
import { getAllWidgets, getWidgetsGroupedByCategory } from '../components/dashboard/widgets/registry'
import { WidgetConfig, WidgetCategory } from '../components/dashboard/types'
import { PositionDTO } from '../lib/api'

// Mock data for widget preview
const mockMetrics = {
  total_value: 125430.50,
  daily_change_value: 2340.75,
  daily_change_pct: 1.9,
  total_unrealized_pnl: 15420.30,
  total_unrealized_pnl_pct: 14.5,
  total_realized_pnl: 8750.20,
  total_dividends: 1250.00,
  total_fees: 85.50,
}

const mockPositions: PositionDTO[] = [
  {
    asset_id: 1,
    symbol: 'AAPL',
    name: 'Apple Inc.',
    asset_type: 'stock',
    quantity: 50,
    avg_cost: 150.00,
    current_price: 175.50,
    market_value: 8775.00,
    cost_basis: 7500.00,
    unrealized_pnl: 1275.00,
    unrealized_pnl_pct: 17.00,
    daily_change_pct: 1.45,
    currency: 'USD',
    last_updated: new Date().toISOString(),
  },
  {
    asset_id: 2,
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    asset_type: 'stock',
    quantity: 30,
    avg_cost: 280.00,
    current_price: 320.75,
    market_value: 9622.50,
    cost_basis: 8400.00,
    unrealized_pnl: 1222.50,
    unrealized_pnl_pct: 14.55,
    daily_change_pct: 1.01,
    currency: 'USD',
    last_updated: new Date().toISOString(),
  },
  {
    asset_id: 3,
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    asset_type: 'stock',
    quantity: 20,
    avg_cost: 250.00,
    current_price: 220.00,
    market_value: 4400.00,
    cost_basis: 5000.00,
    unrealized_pnl: -600.00,
    unrealized_pnl_pct: -12.00,
    daily_change_pct: -1.96,
    currency: 'USD',
    last_updated: new Date().toISOString(),
  },
]

const mockContext = {
  widgetId: 'preview',
  baseWidgetId: 'preview',
  metrics: mockMetrics,
  positions: mockPositions,
  soldPositions: [],
  soldPositionsLoading: false,
  portfolioCurrency: 'USD',
  portfolioId: 1,
  userId: 1,
  isPreview: true,
}

type ViewMode = 'grid' | 'list'
type CategoryFilter = WidgetCategory | 'all'

export default function WidgetDebug() {
  const { t, i18n } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [expandedWidgets, setExpandedWidgets] = useState<Set<string>>(new Set())
  const [showTranslationKeys, setShowTranslationKeys] = useState(false)

  const allWidgets = getAllWidgets()
  const widgetsByCategory = getWidgetsGroupedByCategory()

  // Filter widgets based on search and category
  const filteredWidgets = useMemo(() => {
    let widgets = allWidgets

    // Apply category filter
    if (categoryFilter !== 'all') {
      widgets = widgets.filter(w => w.category === categoryFilter)
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      widgets = widgets.filter(w => {
        const translatedName = t(w.name).toLowerCase()
        const translatedDesc = t(w.description).toLowerCase()
        return (
          w.id.toLowerCase().includes(query) ||
          translatedName.includes(query) ||
          translatedDesc.includes(query) ||
          w.category.toLowerCase().includes(query)
        )
      })
    }

    return widgets
  }, [allWidgets, searchQuery, categoryFilter, t])

  const toggleWidget = (widgetId: string) => {
    const newExpanded = new Set(expandedWidgets)
    if (newExpanded.has(widgetId)) {
      newExpanded.delete(widgetId)
    } else {
      newExpanded.add(widgetId)
    }
    setExpandedWidgets(newExpanded)
  }

  const expandAll = () => {
    setExpandedWidgets(new Set(filteredWidgets.map(w => w.id)))
  }

  const collapseAll = () => {
    setExpandedWidgets(new Set())
  }

  const renderWidgetPreview = (widget: WidgetConfig) => {
    const Component = widget.component
    const props = widget.getProps ? widget.getProps(mockContext) : { isPreview: true }

    try {
      return (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-800">
          <Component {...props} />
        </div>
      )
    } catch (error) {
      return (
        <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-950">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle size={20} />
            <span className="font-medium">Render Error</span>
          </div>
          <p className="text-sm text-red-500 dark:text-red-400 mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )
    }
  }

  const renderWidgetInfo = (widget: WidgetConfig) => {
    const isExpanded = expandedWidgets.has(widget.id)
    const Icon = widget.icon

    return (
      <div
        key={widget.id}
        className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden"
      >
        {/* Header */}
        <button
          onClick={() => toggleWidget(widget.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${widget.iconBgColor}`}>
              <Icon className={widget.iconColor} size={20} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {showTranslationKeys ? widget.name : t(widget.name)}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {widget.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              widget.category === 'metrics' 
                ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300'
                : widget.category === 'data'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            }`}>
              {widget.category}
            </span>
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            {/* Description */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Description
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {showTranslationKeys ? widget.description : t(widget.description)}
              </p>
            </div>

            {/* Translation Keys */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Translation Keys
              </h4>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Name:</span>
                  <span className="text-neutral-900 dark:text-white">{widget.name}</span>
                </div>
                <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Description:</span>
                  <span className="text-neutral-900 dark:text-white">{widget.description}</span>
                </div>
              </div>
            </div>

            {/* Translated Values */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Translations ({i18n.language})
              </h4>
              <div className="space-y-1 text-xs">
                <div className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Name: </span>
                  <span className="text-neutral-900 dark:text-white">{t(widget.name)}</span>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Description: </span>
                  <span className="text-neutral-900 dark:text-white">{t(widget.description)}</span>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Configuration
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Width: </span>
                  <span className="text-neutral-900 dark:text-white">{widget.defaultSize.w}</span>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Height: </span>
                  <span className="text-neutral-900 dark:text-white">{widget.defaultSize.h}</span>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Min Width: </span>
                  <span className="text-neutral-900 dark:text-white">{widget.defaultSize.minW || 'N/A'}</span>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded">
                  <span className="text-neutral-600 dark:text-neutral-400">Min Height: </span>
                  <span className="text-neutral-900 dark:text-white">{widget.defaultSize.minH || 'N/A'}</span>
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded col-span-2">
                  <span className="text-neutral-600 dark:text-neutral-400">Multiple Instances: </span>
                  <span className="text-neutral-900 dark:text-white">
                    {widget.allowMultiple ? (
                      <CheckCircle className="inline text-green-600 dark:text-green-400" size={14} />
                    ) : (
                      <XCircle className="inline text-red-600 dark:text-red-400" size={14} />
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Widget Preview
              </h4>
              {renderWidgetPreview(widget)}
            </div>
          </div>
        )}
      </div>
    )
  }

  const categoryOptions: { value: CategoryFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All Categories', count: allWidgets.length },
    { value: 'metrics', label: 'Metrics', count: widgetsByCategory.metrics?.length || 0 },
    { value: 'data', label: 'Data', count: widgetsByCategory.data?.length || 0 },
    { value: 'insights', label: 'Insights', count: widgetsByCategory.insights?.length || 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Layers className="text-purple-600" size={28} />
            Widget Debugger
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Test all dashboard widgets with translations and mock data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {filteredWidgets.length} widgets
          </span>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">About this tool</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>All widgets are rendered with mock data in preview mode</li>
              <li>Check translations, layouts, and visual appearance</li>
              <li>Current language: <strong>{i18n.language.toUpperCase()}</strong></li>
              <li>Switch languages in Settings to test translations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-4">
        {/* Search and View Mode */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search widgets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
              }`}
            >
              <Grid3x3 size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
              }`}
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-neutral-600 dark:text-neutral-400" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Filter:
            </span>
          </div>
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setCategoryFilter(option.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                categoryFilter === option.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        {/* Toggle Options */}
        <div className="flex flex-wrap gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setShowTranslationKeys(!showTranslationKeys)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showTranslationKeys
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
          >
            {showTranslationKeys ? <Eye size={16} /> : <EyeOff size={16} />}
            Show Translation Keys
          </button>
          <button
            onClick={expandAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            <ChevronDown size={16} />
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            <ChevronUp size={16} />
            Collapse All
          </button>
        </div>
      </div>

      {/* Widget Display */}
      {filteredWidgets.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-8 text-center">
          <Clock size={48} className="mx-auto text-neutral-400 mb-3" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
            No widgets found
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredWidgets.map((widget) => renderWidgetInfo(widget))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWidgets.map((widget) => renderWidgetInfo(widget))}
        </div>
      )}
    </div>
  )
}
