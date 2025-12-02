import { Notification } from '../store/useNotificationStore'

type TFunction = (key: string, options?: Record<string, unknown>) => string

/**
 * Translates notification title and message based on type and metadata
 */
export function translateNotification(notification: Notification, t: TFunction): { title: string; message: string } {
  const { type, metadata } = notification

  switch (type) {
    case 'TRANSACTION_CREATED':
    case 'TRANSACTION_UPDATED':
    case 'TRANSACTION_DELETED': {
      const transactionType = metadata.type as string
      const symbol = metadata.symbol as string
      const name = (metadata.name as string) || symbol
      const quantity = metadata.quantity as number
      const price = metadata.price as number
      const action = metadata.action as string

      let title: string
      if (action === 'created') {
        title = t('notifications.templates.transactionCreated', { type: transactionType })
      } else if (action === 'updated') {
        title = t('notifications.templates.transactionUpdated')
      } else if (action === 'deleted') {
        title = t('notifications.templates.transactionDeleted')
      } else {
        title = notification.title
      }

      let message: string
      if (transactionType === 'BUY' || transactionType === 'SELL' || transactionType === 'CONVERSION_IN' || transactionType === 'CONVERSION_OUT') {
        message = t('notifications.templates.transactionBuySell', {
          type: transactionType,
          quantity: quantity.toFixed(4),
          name,
          symbol,
          price: price.toFixed(2)
        })
      } else if (transactionType === 'DIVIDEND') {
        message = t('notifications.templates.transactionDividend', {
          amount: price.toFixed(2),
          name,
          symbol
        })
      } else if (transactionType === 'FEE') {
        const fees = metadata.fees as number
        message = t('notifications.templates.transactionFee', {
          amount: fees.toFixed(2),
          name,
          symbol
        })
      } else {
        message = t('notifications.templates.transactionGeneric', {
          type: transactionType,
          name,
          symbol
        })
      }

      return { title, message }
    }

    case 'LOGIN': {
      const ip = (metadata.ip_address as string) || 'unknown IP'
      return {
        title: t('notifications.templates.loginDetected'),
        message: t('notifications.templates.loginMessage', { ip })
      }
    }

    case 'PRICE_ALERT': {
      const symbol = metadata.symbol as string
      const name = (metadata.name as string) || symbol
      const currentPrice = (metadata.current_price as number).toFixed(2)
      const targetPrice = (metadata.target_price as number).toFixed(2)
      const direction = metadata.direction as string
      const directionText = direction === 'above' 
        ? t('notifications.templates.priceAlertAbove')
        : t('notifications.templates.priceAlertBelow')

      return {
        title: t('notifications.templates.priceAlertTitle', { symbol }),
        message: t('notifications.templates.priceAlertMessage', {
          name,
          symbol,
          currentPrice,
          targetPrice,
          direction: directionText
        })
      }
    }

    case 'DAILY_CHANGE_UP':
    case 'DAILY_CHANGE_DOWN': {
      const symbol = metadata.symbol as string
      const name = (metadata.name as string) || symbol
      const dailyChangePct = metadata.daily_change_pct as number
      const currentPrice = (metadata.current_price as number).toFixed(2)
      const quantity = (metadata.quantity as number).toFixed(4)
      const changeAmount = Math.abs(metadata.change_amount as number).toFixed(2)
      const isUpside = dailyChangePct > 0
      const direction = isUpside 
        ? t('notifications.templates.dailyChangeUp')
        : t('notifications.templates.dailyChangeDown')
      const emoji = isUpside ? '📈' : '📉'

      return {
        title: t('notifications.templates.dailyChangeTitle', {
          emoji,
          symbol,
          direction,
          sign: isUpside ? '+' : '',
          change: Math.abs(dailyChangePct).toFixed(2)
        }),
        message: t('notifications.templates.dailyChangeMessage', {
          name,
          direction,
          sign: isUpside ? '+' : '',
          change: Math.abs(dailyChangePct).toFixed(2),
          quantity,
          price: currentPrice,
          changeAmount,
          interpolation: { escapeValue: false }
        })
      }
    }

    case 'DAILY_REPORT': {
      const date = metadata.report_date as string || new Date().toISOString().split('T')[0]
      return {
        title: t('notifications.templates.dailyReportTitle'),
        message: t('notifications.templates.dailyReportMessage', { date })
      }
    }

    case 'SYSTEM':
    default:
      // For system notifications or unknown types, use the original title/message
      return {
        title: notification.title,
        message: notification.message
      }
  }
}

/**
 * Translates notification type badge text
 */
export function translateNotificationType(type: string, t: TFunction): string {
  const typeKey = `notifications.types.${type}`
  const translated = t(typeKey)
  
  // If translation doesn't exist, fallback to formatted type
  if (translated === typeKey) {
    return type.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')
  }
  
  return translated
}
