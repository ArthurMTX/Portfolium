import { useEffect, useState } from 'react'
import { CheckCheck, Trash2, Filter, Clock, DollarSign, LogIn, Activity, Bell } from 'lucide-react'
import { useNotificationStore } from '../store/useNotificationStore'
import { formatDistanceToNow } from 'date-fns'

export default function Notifications() {
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    fetchNotifications(filter === 'unread')
  }, [filter, fetchNotifications])

  const handleMarkAsRead = async (notificationId: number) => {
    await markAsRead(notificationId)
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    // Refresh to show updated state
    fetchNotifications(filter === 'unread')
  }

  const handleDelete = async (notificationId: number) => {
    await deleteNotification(notificationId)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TRANSACTION_CREATED':
      case 'TRANSACTION_UPDATED':
      case 'TRANSACTION_DELETED':
        return <Activity size={20} className="text-blue-500" />
      case 'LOGIN':
        return <LogIn size={20} className="text-green-500" />
      case 'PRICE_ALERT':
        return <DollarSign size={20} className="text-amber-500" />
      default:
        return <Clock size={20} className="text-neutral-500" />
    }
  }

  const getNotificationBadge = (type: string) => {
    const colors: Record<string, string> = {
      'TRANSACTION_CREATED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'TRANSACTION_UPDATED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'TRANSACTION_DELETED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'LOGIN': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'PRICE_ALERT': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'SYSTEM': 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
    }
    
    return colors[type] || colors['SYSTEM']
  }

  const formatType = (type: string) => {
    return type.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
  }

  // Helper to safely convert unknown metadata values to strings for display
  const toDisplayString = (value: unknown): string => {
    return String(value)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Bell className="text-pink-600" size={28} />
            Notifications
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Stay updated with your portfolio activity
          </p>
        </div>
      </div>

      {/* Filter and actions bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-neutral-500" />
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-pink-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-pink-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
          >
            <CheckCheck size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <Bell size={48} className="mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              {filter === 'unread' 
                ? 'You\'re all caught up! Check back later for new updates.'
                : 'You\'ll see notifications here when you have portfolio activity.'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 transition-all hover:shadow-md ${
                !notification.is_read ? 'ring-2 ring-pink-200 dark:ring-pink-900' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-pink-600 rounded-full"></span>
                        )}
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getNotificationBadge(notification.type)}`}>
                        {formatType(notification.type)}
                      </span>
                    </div>
                    
                    {/* Time */}
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
                    {notification.message}
                  </p>

                  {/* Metadata */}
                  {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                    <div className="bg-neutral-50 dark:bg-neutral-900 rounded p-2 mb-3 text-xs">
                      {(notification.type === 'LOGIN' && notification.metadata.ip_address) ? (
                        <div className="text-neutral-600 dark:text-neutral-400">
                          <span className="font-medium">IP Address:</span> {toDisplayString(notification.metadata.ip_address)}
                        </div>
                      ) : null}
                      {notification.type.startsWith('TRANSACTION') && (
                        <div className="text-neutral-600 dark:text-neutral-400 space-y-0.5">
                          {notification.metadata.symbol ? (
                            <div><span className="font-medium">Asset:</span> {toDisplayString(notification.metadata.symbol)}</div>
                          ) : null}
                          {notification.metadata.tx_date ? (
                            <div><span className="font-medium">Date:</span> {toDisplayString(notification.metadata.tx_date)}</div>
                          ) : null}
                        </div>
                      )}
                      {(notification.type === 'PRICE_ALERT' && notification.metadata.target_price) ? (
                        <div className="text-neutral-600 dark:text-neutral-400">
                          <span className="font-medium">Target:</span> ${toDisplayString(notification.metadata.target_price)}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="text-xs text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
                      >
                        <CheckCheck size={14} />
                        Mark as read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
