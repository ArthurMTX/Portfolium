import { useEffect, useMemo, useState } from 'react'
import { CheckCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { useNotificationStore } from '@/features/notifications/store/useNotificationStore'
import type { Notification } from '@/features/notifications/store/useNotificationStore'
import { getNotificationIcon } from '@/features/notifications/lib/notificationUtils'
import { translateNotification, translateNotificationType } from '@/features/notifications/lib/notificationTranslation'
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
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { ListSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import '@/shared/design/pages/notifications.css'

type NotificationFilter = 'all' | 'unread'

interface NotificationMetadataProps {
  notification: Notification
  t: ReturnType<typeof useTranslation>['t']
}

function displayMetadataValue(value: unknown): string {
  return String(value)
}

function NotificationMetadata({ notification, t }: NotificationMetadataProps) {
  const metadata = notification.metadata

  if (!metadata || Object.keys(metadata).length === 0) {
    return null
  }

  const getMetadata = (key: string) => metadata[key]
  const hasValue = (key: string) => Boolean(getMetadata(key))
  const hasLoginInfo = notification.type === 'LOGIN' && hasValue('ip_address')
  const hasTransactionInfo = notification.type.startsWith('TRANSACTION') && (hasValue('symbol') || hasValue('tx_date'))
  const hasPriceAlert = notification.type === 'PRICE_ALERT' && hasValue('target_price')
  const hasDailyChangeInfo =
    (notification.type === 'DAILY_CHANGE_UP' || notification.type === 'DAILY_CHANGE_DOWN') &&
    (hasValue('symbol') || hasValue('current_price') || hasValue('daily_change_pct'))

  if (!hasLoginInfo && !hasTransactionInfo && !hasPriceAlert && !hasDailyChangeInfo) {
    return null
  }

  return (
    <dl className="notifications-page__metadata">
      {hasLoginInfo && (
        <div>
          <dt>{t('notifications.ipAddress')}</dt>
          <dd>{displayMetadataValue(getMetadata('ip_address'))}</dd>
        </div>
      )}

      {hasTransactionInfo && (
        <>
          {hasValue('symbol') && (
            <div>
              <dt>{t('notifications.asset')}</dt>
              <dd>{displayMetadataValue(getMetadata('symbol'))}</dd>
            </div>
          )}
          {hasValue('tx_date') && (
            <div>
              <dt>{t('notifications.date')}</dt>
              <dd>{displayMetadataValue(getMetadata('tx_date'))}</dd>
            </div>
          )}
        </>
      )}

      {hasPriceAlert && (
        <div>
          <dt>{t('notifications.target')}</dt>
          <dd>${displayMetadataValue(getMetadata('target_price'))}</dd>
        </div>
      )}

      {hasDailyChangeInfo && (
        <>
          {hasValue('symbol') && (
            <div>
              <dt>{t('notifications.asset')}</dt>
              <dd>{displayMetadataValue(getMetadata('symbol'))}</dd>
            </div>
          )}
          {hasValue('current_price') && (
            <div>
              <dt>{t('notifications.currentPrice')}</dt>
              <dd>${displayMetadataValue(getMetadata('current_price'))}</dd>
            </div>
          )}
          {hasValue('daily_change_pct') && (
            <div>
              <dt>{t('notifications.change')}</dt>
              <dd>{displayMetadataValue(getMetadata('daily_change_pct'))}%</dd>
            </div>
          )}
          {hasValue('quantity') && (
            <div>
              <dt>{t('notifications.quantity')}</dt>
              <dd>{displayMetadataValue(getMetadata('quantity'))}</dd>
            </div>
          )}
        </>
      )}
    </dl>
  )
}

export default function Notifications() {
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore()
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const { t } = useTranslation()

  useEffect(() => {
    void fetchNotifications(false)
  }, [fetchNotifications])

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.is_read).length, [notifications])
  const readCount = Math.max(0, notifications.length - unreadCount)
  const visibleNotifications = filter === 'unread'
    ? notifications.filter((notification) => !notification.is_read)
    : notifications

  const handleMarkAsRead = async (notificationId: number) => {
    await markAsRead(notificationId)
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
  }

  const handleDelete = async (notificationId: number) => {
    await deleteNotification(notificationId)
  }

  return (
    <PageShell className="notifications-page">
      <PageHeader>
        <PageTitleBlock
          kicker={t('notifications.title')}
          title={t('notifications.title')}
          description={t('notifications.description')}
        />
        <PageSummaryPanel
          lead={unreadCount > 0 ? `${unreadCount} ${t('notifications.unread').toLowerCase()}` : t('notifications.noUnreadNotifications')}
          description={t('notifications.noNotificationsDescription')}
        />
      </PageHeader>

      <PageMetricStrip label={t('notifications.title')}>
        <PageMetric label={t('notifications.all')} value={notifications.length} />
        <PageMetric label={t('notifications.unread')} value={unreadCount} tone={unreadCount > 0 ? 'negative' : 'neutral'} />
        <PageMetric label={t('notifications.read')} value={readCount} />
      </PageMetricStrip>

      <PageControls
        label={t('notifications.title')}
        start={
          <PageTabs label={t('notifications.title')}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'is-active' : undefined}
            >
              {t('notifications.all')}
              <span>{notifications.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={filter === 'unread' ? 'is-active' : undefined}
            >
              {t('notifications.unread')}
              <span>{unreadCount}</span>
            </button>
          </PageTabs>
        }
        end={
          unreadCount > 0 ? (
            <button type="button" className="pf-button pf-button--secondary" onClick={handleMarkAllRead}>
              <CheckCheck aria-hidden="true" />
              {t('notifications.markAllAsRead')}
            </button>
          ) : null
        }
      />

      <PageMainGrid single>
        <PageMainColumn>
          <PageSection className="notifications-page__section">
            <PageSectionHeader
              kicker={filter === 'unread' ? t('notifications.unread') : t('notifications.all')}
              title={t('notifications.title')}
              description={t('notifications.description')}
              aside={<span className="pf-metric-label">{visibleNotifications.length} {t('notifications.shown')}</span>}
            />

            {loading ? (
              <ListSkeleton rows={5} label={t('notifications.loadingNotifications')} />
            ) : visibleNotifications.length === 0 ? (
              <StateBlock
                tone="empty"
                title={filter === 'unread' ? t('notifications.noUnreadNotifications') : t('notifications.noNotifications')}
                description={
                  filter === 'unread'
                    ? t('notifications.noUnreadNotificationsDescription')
                    : t('notifications.noNotificationsDescription')
                }
              />
            ) : (
              <ul className="notifications-page__list">
                {visibleNotifications.map((notification) => {
                  const { title, message } = translateNotification(notification, t)
                  const typeLabel = translateNotificationType(notification.type, t)

                  return (
                    <li
                      key={notification.id}
                      className={`notifications-page__row ${!notification.is_read ? 'is-unread' : ''}`}
                    >
                      <div className="notifications-page__icon" aria-hidden="true">
                        {getNotificationIcon(notification.type, 20)}
                      </div>

                      <div className="notifications-page__body">
                        <div className="notifications-page__meta">
                          <span className="pf-metric-label notifications-page__type">{typeLabel}</span>
                          <time dateTime={notification.created_at}>
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </time>
                        </div>

                        <div className="notifications-page__title-line">
                          <h3>{title}</h3>
                          {!notification.is_read && <span aria-hidden="true" />}
                        </div>

                        <p>{message}</p>
                        <NotificationMetadata notification={notification} t={t} />
                      </div>

                      <div className="notifications-page__actions">
                        {!notification.is_read && (
                          <button type="button" className="pf-button pf-button--secondary" onClick={() => handleMarkAsRead(notification.id)}>
                            <CheckCheck aria-hidden="true" />
                            {t('notifications.markAsRead')}
                          </button>
                        )}
                        <button type="button" className="pf-icon-action notifications-page__delete" onClick={() => handleDelete(notification.id)} aria-label={t('notifications.delete')}>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </PageSection>
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}
