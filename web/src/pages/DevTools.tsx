import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Wrench, 
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
  Flag
} from 'lucide-react'
import { api } from '../lib/api'

export default function DevTools() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    const baseClasses = "flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    
    const colorClasses: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800',
      green: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800',
      red: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800',
      amber: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800',
      neutral: 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600'
    }
    
    return `${baseClasses} ${colorClasses[color] || colorClasses.neutral}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wrench className="text-pink-600" size={28} />
            Developer Tools
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Testing utilities and development tools
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900' 
            : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={20} />
          ) : (
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              message.type === 'success' 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Icon Preview Link */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 rounded-lg shadow-sm border border-pink-200 dark:border-pink-900 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg">
              <Palette className="text-pink-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Icon Preview Tool
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                Preview all sector and industry icons without needing asset data
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/icon-preview')}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
          >
            <Palette size={16} />
            View Icons
          </button>
        </div>
      </div>

      {/* Flag Preview Link */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg shadow-sm border border-blue-200 dark:border-blue-900 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg">
              <Flag className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Country Flag Preview
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                Test all country flags displayed on Assets and Insights pages
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/flag-preview')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Flag size={16} />
            View Flags
          </button>
        </div>
      </div>

      {/* Notification Testing Section */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="text-pink-600" size={24} />
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Test Notifications
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
              Create test notifications to preview different types and states
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 pb-6 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => createTestNotifications()}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            Individual Types
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <div className="mt-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={16} />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">How it works</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>Test notifications are created for your account only</li>
                <li>They appear in your notification bell and notifications page</li>
                <li>Each notification includes realistic sample data and metadata</li>
                <li>Notifications are stored in the database but don't trigger emails</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Dev Tools Section (for future expansion) */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wrench className="text-neutral-600 dark:text-neutral-400" size={24} />
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Additional Tools
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
              More development and testing utilities coming soon
            </p>
          </div>
        </div>
        
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
          <Clock size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">More tools will be added here as needed</p>
        </div>
      </div>
    </div>
  )
}
