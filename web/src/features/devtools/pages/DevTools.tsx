import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Activity,
  DollarSign,
  LogIn,
  Clock,
  ArrowUp,
  ArrowDown,
  Settings,
  Palette,
  Flag,
  Database,
  RefreshCw,
  Search,
  Download
} from 'lucide-react'
import { api } from '@/api'
import {
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

interface AssetHealthData {
  asset_id: number
  symbol: string
  name: string | null
  currency: string
  asset_type: string | null
  first_transaction_date: string | null
  price_count: number
  expected_trading_days: number
  coverage_pct: number
  missing_days: number
  needs_backfill: boolean
}

interface HealthCheckResult {
  total_assets: number
  assets_needing_backfill: number
  min_coverage_threshold: number
  assets: AssetHealthData[]
  summary: {
    excellent: number
    good: number
    fair: number
    poor: number
  }
}

export default function DevTools() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Asset health check state
  const [healthCheckLoading, setHealthCheckLoading] = useState(false)
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null)
  const [minCoverage, setMinCoverage] = useState(90)


  const createTestNotifications = async (types?: string[]) => {
    setLoading(true)
    setMessage(null)
    
    try {
      const payload = types ? { notification_types: types } : {}
      const response = await api.createTestNotifications(payload)
      
      setMessage({
        type: 'success',
        text: response.message || 'Test notifications created successfully!'
      })
      
      // Refresh notifications after a short delay
      setTimeout(() => {
        window.dispatchEvent(new Event('refreshNotifications'))
      }, 500)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create test notifications'
      })
    } finally {
      setLoading(false)
    }
  }

  const notificationButtons = [
    {
      type: 'TRANSACTION_CREATED',
      label: 'Transaction Created',
      icon: <Activity size={16} />,
      color: 'blue'
    },
    {
      type: 'TRANSACTION_UPDATED',
      label: 'Transaction Updated',
      icon: <Activity size={16} />,
      color: 'blue'
    },
    {
      type: 'TRANSACTION_DELETED',
      label: 'Transaction Deleted',
      icon: <Activity size={16} />,
      color: 'red'
    },
    {
      type: 'LOGIN',
      label: 'Login Alert',
      icon: <LogIn size={16} />,
      color: 'green'
    },
    {
      type: 'PRICE_ALERT',
      label: 'Price Alert',
      icon: <DollarSign size={16} />,
      color: 'amber'
    },
    {
      type: 'DAILY_CHANGE_UP',
      label: 'Daily Change Up',
      icon: <ArrowUp size={16} />,
      color: 'green'
    },
    {
      type: 'DAILY_CHANGE_DOWN',
      label: 'Daily Change Down',
      icon: <ArrowDown size={16} />,
      color: 'red'
    },
    {
      type: 'SYSTEM',
      label: 'System Notice',
      icon: <Settings size={16} />,
      color: 'neutral'
    }
  ]

  const getButtonClasses = (color: string) => {
    return `pf-button pf-button--secondary devtools-page__tone-action is-${color}`
  }

  return (
    <PageShell className="devtools-page">
      <PageHeader>
        <PageTitleBlock
          kicker="Admin"
          title="Developer Tools"
          description="Testing utilities, debug surfaces, and maintenance operations for local development."
        />
        <PageSummaryPanel
          lead="Development Console"
          description="Preview UI primitives, inspect assets, generate notifications, and run price-data checks."
        />
      </PageHeader>

      <PageMetricStrip label="Developer tool summary">
        <PageMetric label="Tools" value={5} />
        <PageMetric label="Notification Types" value={notificationButtons.length} />
        <PageMetric label="Health Threshold" value={`${minCoverage}%`} />
        <PageMetric label="Backfill Needed" value={healthCheckResult?.assets_needing_backfill ?? '-'} />
      </PageMetricStrip>

      {message && (
        <div className={`devtools-page__message is-${message.type}`}>
          {message.type === 'success' ? (
            <CheckCircle aria-hidden="true" size={20} />
          ) : (
            <AlertCircle aria-hidden="true" size={20} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <PageMainGrid single>
        <PageMainColumn>
          <PageSection>
            <PageSectionHeader
              title="Debug Surfaces"
              description="Open focused tools for visual previews, asset inspection, and dashboard widgets."
            />

            <div className="devtools-page__tool-grid">
              <ToolCard
                icon={<Palette size={22} />}
                title="Icon Preview Tool"
                description="Preview all sector, industry, theme, and subtheme icons without needing asset data."
                action="View Icons"
                onClick={() => navigate('/icon-preview')}
              />
              <ToolCard
                icon={<Flag size={22} />}
                title="Country Flag Preview"
                description="Test all country flags displayed on Assets and Insights pages."
                action="View Flags"
                onClick={() => navigate('/flag-preview')}
              />
              <ToolCard
                icon={<Palette size={22} />}
                title="Widget Debugger"
                description="Test dashboard widgets with translations, mock data, and configuration details."
                action="Debug Widgets"
                onClick={() => navigate('/dev/widgets')}
              />
              <ToolCard
                icon={<Database size={22} />}
                title="Asset Debugger"
                description="Deep dive into asset data, transactions, prices, and health metrics."
                action="Debug Assets"
                onClick={() => navigate('/dev/assets')}
              />
              <ToolCard
                icon={<Database size={22} />}
                title="Assets Database List"
                description="Browse all database assets with filtering, search, and cleanup helpers."
                action="View List"
                onClick={() => navigate('/dev/assets-list')}
              />
            </div>
          </PageSection>

          <PageSection>
            <PageSectionHeader
              title="Test Notifications"
              description="Create test notifications to preview different types and states."
              aside={<Bell aria-hidden="true" size={22} />}
            />

        {/* Quick Actions */}
            <div className="devtools-page__panel">
          <h3 className="devtools-page__panel-title">
            Quick Actions
          </h3>
              <div className="devtools-page__action-grid">
            <button
              onClick={() => createTestNotifications()}
              disabled={loading}
                  className="pf-button pf-button--primary"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Bell size={16} />
                  Create All Types
                </>
              )}
            </button>
            
            <button
              onClick={() => createTestNotifications(['TRANSACTION_CREATED', 'TRANSACTION_UPDATED', 'TRANSACTION_DELETED'])}
              disabled={loading}
              className={getButtonClasses('blue')}
            >
              <Activity size={16} />
              All Transactions
            </button>
            
            <button
              onClick={() => createTestNotifications(['DAILY_CHANGE_UP', 'DAILY_CHANGE_DOWN'])}
              disabled={loading}
              className={getButtonClasses('green')}
            >
              <Activity size={16} />
              Daily Changes
            </button>
            
            <button
              onClick={() => createTestNotifications(['LOGIN', 'PRICE_ALERT', 'SYSTEM'])}
              disabled={loading}
              className={getButtonClasses('neutral')}
            >
              <Clock size={16} />
              Alerts & System
            </button>
          </div>
            </div>

        {/* Individual Notification Types */}
            <div className="devtools-page__panel">
              <h3 className="devtools-page__panel-title">
            Individual Types
          </h3>
              <div className="devtools-page__action-grid">
            {notificationButtons.map((button) => (
              <button
                key={button.type}
                onClick={() => createTestNotifications([button.type])}
                disabled={loading}
                className={getButtonClasses(button.color)}
              >
                {button.icon}
                {button.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info Box */}
            <div className="devtools-page__message is-info">
              <AlertCircle aria-hidden="true" size={16} />
              <div>
                <strong>How it works</strong>
                <ul>
                <li>Test notifications are created for your account only</li>
                <li>They appear in your notification bell and notifications page</li>
                <li>Each notification includes realistic sample data and metadata</li>
                <li>Notifications are stored in the database but don't trigger emails</li>
              </ul>
            </div>
          </div>
          </PageSection>

          <PageSection>
            <PageSectionHeader
              title="Asset Health Check & Backfill"
              description="Check price data coverage for all assets and backfill missing history."
              aside={<Database aria-hidden="true" size={22} />}
            />

        {/* Controls */}
            <div className="devtools-page__panel">
              <div className="devtools-page__controls">
                <label className="pf-field">
                  <span className="pf-field-label">
              Min Coverage %
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={minCoverage}
                    onChange={(e) => setMinCoverage(Number(e.target.value))}
                    className="pf-input"
                  />
                </label>
          
          <button
            onClick={async () => {
              setHealthCheckLoading(true)
              setMessage(null)
              try {
                const result = await api.checkAllAssetsHealth(minCoverage)
                setHealthCheckResult(result)
                setMessage({
                  type: 'success',
                  text: `Checked ${result.total_assets} assets. ${result.assets_needing_backfill} need backfill.`
                })
              } catch (error) {
                setMessage({
                  type: 'error',
                  text: error instanceof Error ? error.message : 'Failed to check assets'
                })
              } finally {
                setHealthCheckLoading(false)
              }
            }}
            disabled={healthCheckLoading || backfillLoading}
                  className="pf-button pf-button--primary"
          >
            {healthCheckLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Search size={16} />
                Check All Assets
              </>
            )}
          </button>
          
          <button
            onClick={async () => {
              setBackfillLoading(true)
              setMessage(null)
              try {
                const result = await api.backfillAllAssets(minCoverage, 365)
                setMessage({
                  type: 'success',
                  text: result.message
                })
                // Refresh health check after backfill
                const updated = await api.checkAllAssetsHealth(minCoverage)
                setHealthCheckResult(updated)
              } catch (error) {
                setMessage({
                  type: 'error',
                  text: error instanceof Error ? error.message : 'Failed to backfill assets'
                })
              } finally {
                setBackfillLoading(false)
              }
            }}
            disabled={healthCheckLoading || backfillLoading || !healthCheckResult || healthCheckResult.assets_needing_backfill === 0}
                  className="pf-button pf-button--secondary"
          >
            {backfillLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Backfilling...
              </>
            ) : (
              <>
                <Download size={16} />
                Backfill All ({healthCheckResult?.assets_needing_backfill || 0})
              </>
            )}
          </button>
              </div>
        </div>

        {/* Summary Cards */}
        {healthCheckResult && (
              <div className="devtools-page__panel">
                <div className="devtools-page__metric-grid">
                  <div className="devtools-page__metric">
                    <strong>
                  {healthCheckResult.summary.excellent}
                    </strong>
                    <span>Excellent (≥95%)</span>
              </div>
                  <div className="devtools-page__metric">
                    <strong>
                  {healthCheckResult.summary.good}
                    </strong>
                    <span>Good (80-94%)</span>
              </div>
                  <div className="devtools-page__metric">
                    <strong>
                  {healthCheckResult.summary.fair}
                    </strong>
                    <span>Fair (50-79%)</span>
              </div>
                  <div className="devtools-page__metric">
                    <strong>
                  {healthCheckResult.summary.poor}
                    </strong>
                    <span>Poor (&lt;50%)</span>
              </div>
            </div>

            {/* Asset Table */}
                <div className="devtools-page__table-wrap">
                  <table className="pf-table">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Symbol</th>
                    <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Name</th>
                    <th className="text-left py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Type</th>
                    <th className="text-right py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Prices</th>
                    <th className="text-right py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Expected</th>
                    <th className="text-right py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Coverage</th>
                    <th className="text-center py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {healthCheckResult.assets.map((asset) => (
                    <tr 
                      key={asset.asset_id} 
                      className={`border-b border-neutral-100 dark:border-neutral-800 ${
                        asset.needs_backfill ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-medium text-neutral-900 dark:text-white">
                        {asset.symbol}
                      </td>
                      <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate">
                        {asset.name || '-'}
                      </td>
                      <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">
                        {asset.asset_type || '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-neutral-900 dark:text-white">
                        {asset.price_count}
                      </td>
                      <td className="py-2 px-3 text-right text-neutral-600 dark:text-neutral-400">
                        {asset.expected_trading_days}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-medium ${
                          asset.coverage_pct >= 95 ? 'text-green-600 dark:text-green-400' :
                          asset.coverage_pct >= 80 ? 'text-blue-600 dark:text-blue-400' :
                          asset.coverage_pct >= 50 ? 'text-amber-600 dark:text-amber-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {asset.coverage_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {asset.needs_backfill ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            Needs Backfill
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle size={12} />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Box */}
            <div className="devtools-page__message is-info">
              <AlertCircle aria-hidden="true" size={16} />
              <div>
                <strong>How it works</strong>
                <ul>
                <li>Check scans all assets with transactions for price data coverage</li>
                <li>Coverage is calculated based on expected trading days vs actual price records</li>
                <li>Backfill fetches missing historical prices from Yahoo Finance</li>
                <li>Only assets below the minimum coverage threshold will be backfilled</li>
              </ul>
            </div>
          </div>
          </PageSection>
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}

function ToolCard({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <article className="devtools-page__tool-card">
      <div className="devtools-page__tool-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button type="button" onClick={onClick} className="pf-button pf-button--secondary">
        {action}
      </button>
    </article>
  )
}
