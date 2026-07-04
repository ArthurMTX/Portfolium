import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, ExternalLink, Inbox, Trash2 } from 'lucide-react'
import { useNotificationStore } from '@/features/notifications/store/useNotificationStore'
import { formatDistanceToNow } from 'date-fns'
import { getNotificationIcon } from '@/features/notifications/lib/notificationUtils'
import { useTranslation } from 'react-i18next'
import { translateNotification, translateNotificationType } from '@/features/notifications/lib/notificationTranslation'
import { InlineLoading } from '@/shared/components/StatePrimitives'

interface NotificationDropdownProps {
  onClose: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export default function NotificationDropdown({ onClose, onMouseEnter, onMouseLeave }: NotificationDropdownProps) {
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore()
  const { t } = useTranslation()

  useEffect(() => {
    void fetchNotifications(false, { background: true })
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
  const showLoading = loading && recentNotifications.length === 0

  return (
    <div 
      className="pf-notification-menu fixed left-3 right-3 mt-2 sm:absolute sm:left-auto sm:right-0 sm:w-[26rem]"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="dialog"
      aria-label={t('notifications.title')}
    >
      <div className="pf-notification-menu__header">
        <div className="pf-page-title-block pf-notification-menu__title-block">
          <p className="pf-page-kicker">{t('notifications.unread')}</p>
          <h3 className="pf-section-title pf-notification-menu__title">{t('notifications.title')}</h3>
        </div>

        <div className="pf-page-context pf-summary-panel pf-notification-menu__summary-panel">
          <span className="pf-metric-label">{t('notifications.unread')}</span>
          <strong className="pf-metric-figure">
            {unreadCount > 99 ? '99+' : unreadCount}
          </strong>
        </div>
      </div>

      <div className="pf-page-controls pf-notification-menu__controls">
        <div className="pf-page-controls__start">
          <span className="pf-page-description pf-notification-menu__description">
            {unreadCount > 0 ? `${unreadCount} ${t('notifications.unread').toLowerCase()}` : t('notifications.noUnreadNotifications')}
          </span>
        </div>
        <div className="pf-page-controls__end">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="pf-button pf-button--secondary pf-notification-menu__mark-read"
              title={t('notifications.markAllAsRead')}
              aria-label={t('notifications.markAllAsRead')}
            >
              <CheckCheck aria-hidden="true" />
              <span>{t('notifications.markAllAsRead')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="pf-notification-menu__list">
        {showLoading ? (
          <div className="pf-notification-menu__state">
            <InlineLoading label={t('notifications.loadingNotifications')} />
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="pf-state pf-state--empty pf-notification-menu__state">
            <span className="pf-notification-menu__state-icon" aria-hidden="true">
              <Inbox size={20} />
            </span>
            <h2 className="pf-state__title">{t('notifications.noNotifications')}</h2>
          </div>
        ) : (
          <ul className="pf-content-stack pf-notification-menu__items">
            {recentNotifications.map((notification) => {
              const { title, message } = translateNotification(notification, t)
              const typeLabel = translateNotificationType(notification.type, t)
              
              return (
              <li
                key={notification.id}
                className={`pf-notification-menu__item ${!notification.is_read ? 'is-unread' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                  className="pf-notification-menu__item-main"
                >
                  <div className="pf-notification-menu__item-icon">
                    {getNotificationIcon(notification.type, 16)}
                  </div>

                  <div className="pf-notification-menu__item-body">
                    <div className="pf-notification-menu__meta">
                      <span className="pf-metric-label pf-notification-menu__type">
                        {typeLabel}
                      </span>
                      <span className="pf-notification-menu__time">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="pf-notification-menu__item-title-row">
                      <h4 className="pf-notification-menu__item-title">{title}</h4>
                    </div>

                    <p className="pf-notification-menu__message">{message}</p>
                  </div>

                  {!notification.is_read && (
                    <span className="pf-notification-menu__unread-dot" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleDelete(e, notification.id)}
                  className="pf-icon-action pf-notification-menu__delete"
                  title={t('notifications.delete')}
                  aria-label={t('notifications.delete')}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            )})}
          </ul>
        )}
      </div>

      {recentNotifications.length > 0 && (
        <div className="pf-notification-menu__footer">
          <button
            type="button"
            onClick={handleViewAll}
            className="pf-notification-menu__footer-action"
          >
            <span>{t('notifications.viewAll')}</span>
            <ExternalLink aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
