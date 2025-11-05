import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Trash2, ExternalLink, Clock } from 'lucide-react'
import { useNotificationStore } from '../store/useNotificationStore'
import { formatDistanceToNow } from 'date-fns'
import { getNotificationIcon } from '../lib/notificationUtils'
import { useTranslation } from 'react-i18next'
import { translateNotification } from '../lib/notificationTranslation'

interface NotificationDropdownProps {
  onClose: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export default function NotificationDropdown({ onClose, onMouseEnter, onMouseLeave }: NotificationDropdownProps) {
  const navigate = useNavigate()
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore()
  const { t } = useTranslation()

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleNotificationClick = async (notificationId: number, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId)
    }
  }

  const handleViewAll = () => {
    onClose()
    navigate('/notifications')
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
  }

  const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation()
    await deleteNotification(notificationId)
  }

  const recentNotifications = notifications.slice(0, 5)

  return (
    <div 
      className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:w-96 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 max-h-[600px] flex flex-col"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('notifications.title')}</h3>
        <div className="flex items-center gap-2">
          {notifications.some(n => !n.is_read) && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
              title="Mark all as read"
            >
              <CheckCheck size={14} />
              {t('notifications.markAllAsRead')}
            </button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
            {t('notifications.loadingNotifications')}
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
            <Clock size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          <div>
            {recentNotifications.map((notification) => {
              const { title, message } = translateNotification(notification, t)
              
              return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                className={`px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer transition-colors ${
                  !notification.is_read ? 'bg-pink-50/50 dark:bg-pink-950/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0">
                    {getNotificationIcon(notification.type, 16)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {title}
                      </h4>
                      <button
                        onClick={(e) => handleDelete(e, notification.id)}
                        className="flex-shrink-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                      {message}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-pink-600 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Footer */}
      {recentNotifications.length > 0 && (
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={handleViewAll}
            className="w-full text-center text-sm text-pink-600 dark:text-pink-400 hover:underline flex items-center justify-center gap-1"
          >
            {t('notifications.viewAll')}
            <ExternalLink size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
