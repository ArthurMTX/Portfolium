import { useEffect, useState } from 'react'
import { CheckCheck, Trash2, Filter, Bell } from 'lucide-react'
import { useNotificationStore } from '../store/useNotificationStore'
import { formatDistanceToNow } from 'date-fns'
import { getNotificationIcon, getNotificationBadgeClass } from '../lib/notificationUtils'
import LoadingSpinner from '../components/LoadingSpinner'
import { useTranslation } from 'react-i18next'
import { translateNotification, translateNotificationType } from '../lib/notificationTranslation'

export default function Notifications() {
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { t } = useTranslation()

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

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Bell className="text-pink-600" size={28} />
            {t('notifications.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            {t('notifications.description')}
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
            {t('notifications.all')} ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-pink-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
          >
            {t('notifications.unread')} ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
          >
            <CheckCheck size={16} />
            {t('notifications.markAllAsRead')}
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">{t('notifications.loadingNotifications')}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <Bell size={48} className="mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
              {filter === 'unread' ? t('notifications.noUnreadNotifications') : t('notifications.noNotifications')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              {filter === 'unread'
                ? t('notifications.noUnreadNotificationsDescription')
                : t('notifications.noNotificationsDescription')}
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const { title, message } = translateNotification(notification, t)
            const typeLabel = translateNotificationType(notification.type, t)
            
            return (
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
                          {title}
                        </h3>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-pink-600 rounded-full"></span>
                        )}
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getNotificationBadgeClass(notification.type)}`}>
                        {typeLabel}
                      </span>
                    </div>
                    
                    {/* Time */}
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
                    {message}
                  </p>

                  {/* Metadata */}
                  {notification.metadata && Object.keys(notification.metadata).length > 0 && (() => {
                    const metadata = notification.metadata
                    
                    // Helper to safely get metadata values
                    const getMetadata = (key: string) => metadata[key]
                    const hasValue = (key: string) => Boolean(getMetadata(key))
                    
                    // Helper to safely convert unknown metadata values to strings for display
                    const toDisplayString = (value: unknown): string => {
                      return String(value)
                    }
                    
                    // Check if there's any displayable content before rendering the container
                    const hasLoginInfo = notification.type === 'LOGIN' && hasValue('ip_address')
                    const hasTransactionInfo = notification.type.startsWith('TRANSACTION') && 
                      (hasValue('symbol') || hasValue('tx_date'))
                    const hasPriceAlert = notification.type === 'PRICE_ALERT' && hasValue('target_price')
                    const hasDailyChangeInfo = (notification.type === 'DAILY_CHANGE_UP' || notification.type === 'DAILY_CHANGE_DOWN') &&
                      (hasValue('symbol') || hasValue('current_price') || hasValue('daily_change_pct'))
                    
                    if (!hasLoginInfo && !hasTransactionInfo && !hasPriceAlert && !hasDailyChangeInfo) {
                      return null
                    }
                    
                    return (
                      <div className="bg-neutral-50 dark:bg-neutral-900 rounded p-2 mb-3 text-xs">
                        {hasLoginInfo && (
                          <div className="text-neutral-600 dark:text-neutral-400">
                            <span className="font-medium">{t('notifications.ipAddress')}:</span> {toDisplayString(getMetadata('ip_address'))}
                          </div>
                        )}
                        {hasTransactionInfo && (
                          <div className="text-neutral-600 dark:text-neutral-400 space-y-0.5">
                            {hasValue('symbol') && (
                              <div><span className="font-medium">{t('notifications.asset')}:</span> {toDisplayString(getMetadata('symbol'))}</div>
                            )}
                            {hasValue('tx_date') && (
                              <div><span className="font-medium">{t('notifications.date')}:</span> {toDisplayString(getMetadata('tx_date'))}</div>
                            )}
                          </div>
                        )}
                        {hasPriceAlert && (
                          <div className="text-neutral-600 dark:text-neutral-400">
                            <span className="font-medium">{t('notifications.target')}:</span> ${toDisplayString(getMetadata('target_price'))}
                          </div>
                        )}
                        {hasDailyChangeInfo && (
                          <div className="text-neutral-600 dark:text-neutral-400 space-y-0.5">
                            {hasValue('symbol') && (
                              <div><span className="font-medium">{t('notifications.asset')}:</span> {toDisplayString(getMetadata('symbol'))}</div>
                            )}
                            {hasValue('current_price') && (
                              <div><span className="font-medium">{t('notifications.currentPrice')}:</span> ${toDisplayString(getMetadata('current_price'))}</div>
                            )}
                            {hasValue('daily_change_pct') && (
                              <div><span className="font-medium">{t('notifications.change')}:</span> {toDisplayString(getMetadata('daily_change_pct'))}%</div>
                            )}
                            {hasValue('quantity') && (
                              <div><span className="font-medium">{t('notifications.quantity')}:</span> {toDisplayString(getMetadata('quantity'))}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="text-xs text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
                      >
                        <CheckCheck size={14} />
                        {t('notifications.markAsRead')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      {t('notifications.delete')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )})
        )}
      </div>
    </div>
  )
}
