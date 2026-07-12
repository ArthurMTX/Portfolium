import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { 
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
import { getAllWidgets, getWidgetsGroupedByCategory } from '@/features/boards/components/widgets/registry'
import { WidgetConfig, WidgetCategory } from '@/features/boards/components/types'
import { PositionDTO } from '@/api'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageSection,
  PageSectionHeader,
  PageShell,
  PageSummaryPanel,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import '@/shared/design/pages/devtools.css'

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
    realized_pnl: 0,
    realized_pnl_percent: null,
    realized_quantity: 0,
    realized_sell_count: 0,
    realized_cost_basis: 0,
    realized_sale_proceeds: 0,
    realized_fees: 0,
    lifetime_pnl: 1275.00,
    total_quantity_bought: 50,
    average_sell_price: null,
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
    realized_pnl: 0,
    realized_pnl_percent: null,
    realized_quantity: 0,
    realized_sell_count: 0,
    realized_cost_basis: 0,
    realized_sale_proceeds: 0,
    realized_fees: 0,
    lifetime_pnl: 1222.50,
    total_quantity_bought: 30,
    average_sell_price: null,
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
    realized_pnl: 0,
    realized_pnl_percent: null,
    realized_quantity: 0,
    realized_sell_count: 0,
    realized_cost_basis: 0,
    realized_sale_proceeds: 0,
    realized_fees: 0,
    lifetime_pnl: -600.00,
    total_quantity_bought: 20,
    average_sell_price: null,
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
    <PageShell className="devtools-page">
      <PageHeader>
        <PageTitleBlock
          kicker="Developer Tools"
          title="Widget Debugger"
          description="Test all dashboard widgets with translations, mock data, and configuration details."
        />
        <PageSummaryPanel
          lead={`${filteredWidgets.length} widgets`}
          description={`Current language: ${i18n.language.toUpperCase()}`}
        />
      </PageHeader>

      <PageMetricStrip label="Widget registry totals">
        <PageMetric label="All Widgets" value={allWidgets.length} />
        <PageMetric label="Metrics" value={widgetsByCategory.metrics?.length || 0} />
        <PageMetric label="Data" value={widgetsByCategory.data?.length || 0} />
        <PageMetric label="Insights" value={widgetsByCategory.insights?.length || 0} />
      </PageMetricStrip>

      {/* Info Box */}
      <div className="devtools-page__message is-info">
        <Info aria-hidden="true" size={20} />
        <div>
          <strong>About this tool</strong>
          <ul>
              <li>All widgets are rendered with mock data in preview mode</li>
              <li>Check translations, layouts, and visual appearance</li>
              <li>Current language: <strong>{i18n.language.toUpperCase()}</strong></li>
              <li>Switch languages in Settings to test translations</li>
            </ul>
          </div>
        </div>

      <PageControls
        label="Widget debugger controls"
        start={
          <>
            <label className="pf-search devtools-page__search">
              <Search aria-hidden="true" size={18} />
            <input
              type="text"
              placeholder="Search widgets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            </label>
            <div className="devtools-page__filter-row">
            <button
                type="button"
              onClick={() => setViewMode('grid')}
                className={`devtools-page__segment ${viewMode === 'grid' ? 'is-active' : ''}`}
            >
              <Grid3x3 size={20} />
            </button>
            <button
                type="button"
              onClick={() => setViewMode('list')}
                className={`devtools-page__segment ${viewMode === 'list' ? 'is-active' : ''}`}
            >
              <List size={20} />
            </button>
          </div>
          </>
        }
        end={
          <>
            <Filter size={16} />
          {categoryOptions.map((option) => (
            <button
                type="button"
              key={option.value}
              onClick={() => setCategoryFilter(option.value)}
                className={`devtools-page__segment ${categoryFilter === option.value ? 'is-active' : ''}`}
            >
              {option.label} ({option.count})
            </button>
          ))}
          </>
        }
      />

      <PageControls
        label="Widget debugger actions"
        start={
          <>
          <button
              type="button"
            onClick={() => setShowTranslationKeys(!showTranslationKeys)}
              className={`devtools-page__segment ${showTranslationKeys ? 'is-active' : ''}`}
          >
            {showTranslationKeys ? <Eye size={16} /> : <EyeOff size={16} />}
            Show Translation Keys
          </button>
          <button
              type="button"
            onClick={expandAll}
              className="devtools-page__segment"
          >
            <ChevronDown size={16} />
            Expand All
          </button>
          <button
              type="button"
            onClick={collapseAll}
              className="devtools-page__segment"
          >
            <ChevronUp size={16} />
            Collapse All
          </button>
          </>
        }
      />

      <PageMainGrid single>
        <PageMainColumn>
          <PageSection>
            <PageSectionHeader
              title="Widget Display"
              description="Expand a widget to inspect translation keys, configuration, and live preview."
              aside={`${filteredWidgets.length} results`}
            />
            {filteredWidgets.length === 0 ? (
              <div className="pf-empty-state">
                <Clock size={48} />
                <h3>No widgets found</h3>
                <p>Try adjusting your search or filter criteria</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="devtools-page__wide-card-grid">
                {filteredWidgets.map((widget) => renderWidgetInfo(widget))}
              </div>
            ) : (
              <div className="devtools-page__tool-grid">
                {filteredWidgets.map((widget) => renderWidgetInfo(widget))}
              </div>
            )}
          </PageSection>
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}
