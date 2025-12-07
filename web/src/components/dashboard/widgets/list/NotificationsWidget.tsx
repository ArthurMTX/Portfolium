import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ExternalLink, Clock, Trash2 } from 'lucide-react'
import { useNotificationStore } from '../../../../store/useNotificationStore'
import { formatDistanceToNow } from 'date-fns'
import { getNotificationIcon } from '../../../../lib/notificationUtils'
import { translateNotification } from '../../../../lib/notificationTranslation'
import { useTranslation } from 'react-i18next'
import { useWidgetVisibility } from '@/contexts/DashboardContext'
import { BaseWidget } from '../base/BaseWidget'
import { BaseWidgetProps } from '../../types'

interface NotificationsWidgetProps extends BaseWidgetProps {}

// Mock notifications for preview mode
const mockNotifications = [
  {
    id: 1,
    type: 'price_alert',
    title: 'AAPL Price Alert',
    message: 'Apple reached your target price of $175',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    is_read: false,
  },
  {
    id: 2,
    type: 'daily_change',
    title: 'Portfolio Up 3.46%',
    message: 'Your portfolio gained €373.98 today',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    is_read: false,
  },
  {
    id: 3,
    type: 'transaction',
    title: 'Dividend Received',
    message: 'MSFT paid dividend of €15.50',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    is_read: true,
  },
]

export default function NotificationsWidget({ isPreview = false }: NotificationsWidgetProps) {
  const navigate = useNavigate()
  const { notifications: storeNotifications, loading, fetchNotifications, markAsRead, deleteNotification } = useNotificationStore()
  const { t } = useTranslation()
  const shouldLoad = useWidgetVisibility('notifications')

  // Use mock data in preview mode, otherwise use store data
  const notifications = isPreview ? (mockNotifications as typeof storeNotifications) : storeNotifications

  useEffect(() => {
    // Skip loading in preview mode or if widget not visible
    if (isPreview || !shouldLoad) {
      return
    }

    fetchNotifications()
  }, [fetchNotifications, shouldLoad, isPreview])

  const handleNotificationClick = async (notificationId: number, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId)
    }
  }

  const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation()
    await deleteNotification(notificationId)
  }

  const handleViewAll = () => {
    navigate('/notifications')
  }

  const recentNotifications = notifications.slice(0, 5)

  // View all action button
  const viewAllAction = notifications.length > 0 && !isPreview ? (
    <button
      onClick={handleViewAll}
      className="text-xs text-fuchsia-600 dark:text-fuchsia-400 hover:underline flex items-center gap-1"
    >
      {t('notifications.viewAll')}
      <ExternalLink size={12} />
    </button>
  ) : null

  return (
    <BaseWidget
      title="notifications.title"
      icon={Bell}
      iconColor="text-sky-600 dark:text-sky-400"
      iconBgColor="bg-sky-50 dark:bg-sky-900/20"
      isLoading={loading && !isPreview}
      isEmpty={recentNotifications.length === 0}
      emptyMessage="notifications.noNotifications"
      emptyIcon={Clock}
      actions={viewAllAction}
    >
      <div>
            {recentNotifications.map((notification) => {
              const { title, message } = translateNotification(notification, t)
              
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                  className={`px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer transition-colors ${
                    !notification.is_read ? 'bg-fuchsia-50/30 dark:bg-fuchsia-950/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      {getNotificationIcon(notification.type, 14)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-medium text-neutral-900 dark:text-white truncate">
                          {title}
                        </h4>
                        <button
                          onClick={(e) => handleDelete(e, notification.id)}
                          className="flex-shrink-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
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
                      <div className="w-2 h-2 bg-fuchsia-600 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
            )
          })}
        </div>
    </BaseWidget>
  )
}
