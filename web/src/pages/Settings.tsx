import { useState, useEffect } from 'react'
import { Zap, AlertTriangle, Shield, Settings as SettingsIcon, Bell } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

type SettingsTab = 'general' | 'notifications' | 'validation' | 'danger';

export default function Settings() {
  const { user, refreshUser } = useAuth()
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

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationThreshold, setNotificationThreshold] = useState('5.0')
  const [transactionNotificationsEnabled, setTransactionNotificationsEnabled] = useState(true)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

    // Load notification settings from user
    if (user) {
      setNotificationsEnabled(user.daily_change_notifications_enabled ?? true)
      setNotificationThreshold(String(user.daily_change_threshold_pct ?? 5.0))
      setTransactionNotificationsEnabled(user.transaction_notifications_enabled ?? true)
    }
  }, [user])

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

  const handleUpdateNotificationSettings = async () => {
    if (!user) return
    setSavingNotifications(true)
    setNotificationMessage(null)
    try {
      const threshold = parseFloat(notificationThreshold)
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        setNotificationMessage({ type: 'error', text: 'Threshold must be between 0 and 100' })
        return
      }

      await api.updateCurrentUser({
        daily_change_notifications_enabled: notificationsEnabled,
        daily_change_threshold_pct: threshold,
        transaction_notifications_enabled: transactionNotificationsEnabled
      })
      await refreshUser()
      setNotificationMessage({ type: 'success', text: 'Notification settings updated successfully' })
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Failed to update notification settings'
      setNotificationMessage({ type: 'error', text })
    } finally {
      setSavingNotifications(false)
      setTimeout(() => setNotificationMessage(null), 4000)
    }
  }

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

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <SettingsIcon className="text-pink-600" size={28} />
            Settings
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Configure your application preferences and options
          </p>
        </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto scrollbar-hide">
        <nav className="flex gap-2 sm:gap-4 min-w-max">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Zap size={14} className="inline mr-1" />
            General
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Bell size={14} className="inline mr-1" />
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'validation'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Shield size={14} className="inline mr-1" />
            Validation
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'danger'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <AlertTriangle size={14} className="inline mr-1" />
            Danger
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

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <>
          {/* Daily Change Notifications */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
              <Bell size={20} className="text-pink-600 dark:text-pink-400" />
              Daily Change Notifications
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              Get notified when your holdings experience significant daily price movements
            </p>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    disabled={savingNotifications}
                    className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Enable daily change notifications
                  </span>
                </label>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-6">
                  Receive notifications when any of your holdings moves up or down significantly
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Notification Threshold
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={notificationThreshold}
                    onChange={(e) => setNotificationThreshold(e.target.value)}
                    min="0"
                    max="100"
                    step="0.5"
                    disabled={!notificationsEnabled || savingNotifications}
                    className="input w-32"
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">%</span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Get notified when a holding's daily change exceeds this percentage (positive or negative)
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>How it works:</strong> Every day at 9:00 AM, the system checks your holdings for significant price changes. 
                  You'll receive notifications for both upside movements 📈 (gains) and downside movements 📉 (losses) that exceed your threshold.
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Notifications */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
              <Bell size={20} className="text-pink-600 dark:text-pink-400" />
              Transaction Notifications
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              Get notified about transaction activity in your portfolios
            </p>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transactionNotificationsEnabled}
                    onChange={(e) => setTransactionNotificationsEnabled(e.target.checked)}
                    disabled={savingNotifications}
                    className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Enable transaction notifications
                  </span>
                </label>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-6">
                  Receive notifications when you create, update, or delete transactions
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Transaction notifications help you track all portfolio activity, 
                  including new purchases, sales, dividends, and any modifications to existing transactions.
                </p>
              </div>
            </div>
          </div>

          {/* Save Button and Messages */}
          {notificationMessage && (
            <div className={`p-3 rounded-lg ${
              notificationMessage.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            }`}>
              <p className="text-sm">{notificationMessage.text}</p>
            </div>
          )}

          <div className="flex justify-start">
            <button
              onClick={handleUpdateNotificationSettings}
              disabled={savingNotifications}
              className="btn-primary"
            >
              {savingNotifications ? 'Saving...' : 'Save Notification Settings'}
            </button>
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