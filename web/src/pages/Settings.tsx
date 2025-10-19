import { useState, useEffect } from 'react'
import { Zap, AlertTriangle, Shield, FileText, Settings as SettingsIcon } from 'lucide-react'
import api from '../lib/api'
import axios from 'axios'

interface LogEntry {
  logs: string[];
  total: number;
  page: number;
  page_size: number;
}

const LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

type SettingsTab = 'general' | 'validation' | 'logs' | 'danger';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-refresh settings
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(
    localStorage.getItem('autoRefreshInterval') || '60'
  )
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(
    localStorage.getItem('autoRefreshEnabled') === 'true'
  )

  // Transaction validation settings
  const [validateSellQuantity, setValidateSellQuantity] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Logs state
  const [logs, setLogs] = useState<string[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsPageSize, setLogsPageSize] = useState(50)
  const [logsLevel, setLogsLevel] = useState<string>("")
  const [logsSearch, setLogsSearch] = useState("")
  const [logsLoading, setLogsLoading] = useState(false)

  const handleAutoRefreshSettingsChange = (interval: string, enabled: boolean) => {
    setAutoRefreshInterval(interval)
    setAutoRefreshEnabled(enabled)
    localStorage.setItem('autoRefreshInterval', interval)
    localStorage.setItem('autoRefreshEnabled', String(enabled))
  }

  // Load settings from API on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getSettings()
        setValidateSellQuantity(settings.validate_sell_quantity)
        setSettingsLoading(false)
      } catch (e) {
        console.error('Failed to load settings:', e)
        setSettingsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleValidateSellQuantityChange = async (enabled: boolean) => {
    setSettingsSaving(true)
    setSettingsMessage(null)
    try {
      const updated = await api.updateSettings({ validate_sell_quantity: enabled })
      setValidateSellQuantity(updated.validate_sell_quantity)
      setSettingsMessage({ 
        type: 'success', 
        text: `Sell quantity validation ${enabled ? 'enabled' : 'disabled'} successfully` 
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update settings'
      setSettingsMessage({ type: 'error', text: message })
      // Revert on error
      setValidateSellQuantity(!enabled)
    } finally {
      setSettingsSaving(false)
      // Clear message after 3 seconds
      setTimeout(() => setSettingsMessage(null), 3000)
    }
  }

  // Logs functions
  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const params: Record<string, string | number> = { page: logsPage, page_size: logsPageSize }
      if (logsLevel) params.level = logsLevel
      if (logsSearch) params.search = logsSearch
      const res = await axios.get<LogEntry>(`/api/logs/logs`, { params })
      console.log('Logs response:', res.data) // Debug log
      const logsArr = Array.isArray(res.data.logs) ? res.data.logs : []
      setLogs(logsArr)
      setLogsTotal(typeof res.data.total === 'number' ? res.data.total : 0)
    } catch (err) {
      console.error('Failed to fetch logs:', err) // Debug log
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch logs.'
      setLogs([`Error: ${errorMessage}`])
      setLogsTotal(0)
    }
    setLogsLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
    }
    // eslint-disable-next-line
  }, [logsPage, logsPageSize, logsLevel, activeTab])

  const handleDeleteAll = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await api.deleteAllData()
      setResult(
        `Deleted data successfully. Transactions: ${res.deleted?.transactions ?? 0}, Prices: ${res.deleted?.prices ?? 0}, Portfolios: ${res.deleted?.portfolios ?? 0}, Assets: ${res.deleted?.assets ?? 0}`
      )
      setConfirmText('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const canDelete = confirmText.toLowerCase().trim() === 'delete'
  const logsTotalPages = Math.ceil(logsTotal / logsPageSize)

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <SettingsIcon className="text-pink-600" size={32} />
            Settings
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Configure your application preferences and options
          </p>
        </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Zap size={16} className="inline mr-1" />
            General
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'validation'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Shield size={16} className="inline mr-1" />
            Validation
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <FileText size={16} className="inline mr-1" />
            Logs
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'danger'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <AlertTriangle size={16} className="inline mr-1" />
            Danger Zone
          </button>
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <>
          <div className="card p-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
          <Zap size={20} className="text-pink-600 dark:text-pink-400" />
          Auto-Refresh Settings
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Configure automatic price updates for your portfolio
        </p>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) =>
                  handleAutoRefreshSettingsChange(autoRefreshInterval, e.target.checked)
                }
                className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Enable automatic price refresh
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Refresh Interval
            </label>
            <select
              value={autoRefreshInterval}
              onChange={(e) =>
                handleAutoRefreshSettingsChange(e.target.value, autoRefreshEnabled)
              }
              className="input w-full max-w-xs"
              disabled={!autoRefreshEnabled}
            >
              <option value="15">Every 15 seconds (testing)</option>
              <option value="30">Every 30 seconds</option>
              <option value="60">Every 1 minute</option>
              <option value="120">Every 2 minutes</option>
              <option value="300">Every 5 minutes</option>
              <option value="600">Every 10 minutes</option>
            </select>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Shorter intervals may increase API usage
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Auto-refresh can be toggled on/off from the Dashboard using the
              lightning bolt button. Prices will also refresh automatically when you switch back to
              the tab.
            </p>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Validation Tab */}
      {activeTab === 'validation' && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
            <Shield size={20} className="text-pink-600 dark:text-pink-400" />
            Transaction Validation
          </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Control transaction validation rules
        </p>

        {settingsLoading ? (
          <div className="text-neutral-500 dark:text-neutral-400">Loading settings...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={validateSellQuantity}
                  onChange={(e) => handleValidateSellQuantityChange(e.target.checked)}
                  disabled={settingsSaving}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Validate sell quantity (prevent overselling)
                </span>
              </label>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-6">
                When enabled, you cannot sell more shares than you currently own. Disable this for historical data imports or short selling.
              </p>
            </div>

            {settingsMessage && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  settingsMessage.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}
              >
                {settingsMessage.text}
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> Changes to this setting take effect immediately but are not persisted across server restarts. To make permanent changes, update the <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">VALIDATE_SELL_QUANTITY</code> environment variable.
              </p>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileText size={20} className="text-pink-600 dark:text-pink-400" />
              API Logs
            </h2>
            <button
              className="btn btn-secondary text-sm"
              onClick={() => fetchLogs()}
              disabled={logsLoading}
            >
              {logsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              className="input text-sm"
              value={logsLevel}
              onChange={e => { setLogsLevel(e.target.value); setLogsPage(1); }}
            >
              <option value="">All Levels</option>
              {LOG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input
              className="input text-sm"
              placeholder="Search logs..."
              value={logsSearch}
              onChange={e => setLogsSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") fetchLogs(); }}
            />
            <button
              className="btn btn-primary text-sm"
              onClick={() => { setLogsPage(1); fetchLogs(); }}
            >
              Search
            </button>
            <select
              className="input text-sm"
              value={logsPageSize}
              onChange={e => { setLogsPageSize(Number(e.target.value)); setLogsPage(1); }}
            >
              {[25, 50, 100, 200, 500].map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          </div>
          
          <div className="bg-black text-green-200 font-mono text-xs rounded p-2 h-[600px] overflow-auto border border-neutral-700">
            {logsLoading ? (
              <div className="text-yellow-300">Loading logs...</div>
            ) : !Array.isArray(logs) || logs.length === 0 ? (
              <div>
                <div className="text-yellow-300">No logs found.</div>
                <div className="text-neutral-400 mt-2">
                  {logsTotal === 0 && 'The log file may be empty or does not exist yet.'}
                </div>
                <div className="text-neutral-400 mt-1">
                  Check the browser console for any errors.
                </div>
              </div>
            ) : (
              logs.map((log, idx) => <div key={idx}>{log}</div>)
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <button
              className="btn btn-secondary text-sm disabled:opacity-50"
              onClick={() => setLogsPage(p => Math.max(1, p - 1))}
              disabled={logsPage === 1}
            >
              Prev
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Page {logsPage} of {logsTotalPages || 1}
            </span>
            <button
              className="btn btn-secondary text-sm disabled:opacity-50"
              onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
              disabled={logsPage === logsTotalPages || logsTotalPages === 0}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="card p-6 border border-red-300/40 bg-red-50 dark:bg-red-950/30">
        <h2 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
          <AlertTriangle size={20} />
          Danger zone
        </h2>
        <p className="text-red-800 dark:text-red-200 mb-4">
          This will permanently delete all portfolios, transactions, prices, and assets. This action cannot be undone.
        </p>

        <label className="block text-sm text-red-800 dark:text-red-200 mb-2">
          Type "delete" to confirm
        </label>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete"
            className="input w-40 bg-white/70 dark:bg-neutral-900/50"
          />
          <button
            onClick={handleDeleteAll}
            disabled={!canDelete || loading}
            className={`btn ${canDelete ? 'btn-error' : 'btn-disabled'}`}
          >
            {loading ? 'Deleting…' : 'Delete all data'}
          </button>
        </div>

        {result && (
          <div className="mt-4 text-sm text-green-700 dark:text-green-300">
            {result}
          </div>
          )}
        {error && (
          <div className="mt-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        </div>
      )}
    </div>
  )
}