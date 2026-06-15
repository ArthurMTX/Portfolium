import { Activity, LogIn, DollarSign, Clock, Coins } from 'lucide-react'

export const getNotificationIcon = (type: string, size: number = 20) => {
  switch (type) {
    case 'TRANSACTION_CREATED':
    case 'TRANSACTION_UPDATED':
    case 'TRANSACTION_DELETED':
      return <Activity size={size} className="text-blue-500" />
    case 'LOGIN':
      return <LogIn size={size} className="text-green-500" />
    case 'PRICE_ALERT':
      return <DollarSign size={size} className="text-amber-500" />
    case 'DAILY_CHANGE_UP':
      return <Activity size={size} className="text-green-500" />
    case 'DAILY_CHANGE_DOWN':
      return <Activity size={size} className="text-red-500" />
    case 'PENDING_DIVIDEND':
      return <Coins size={size} className="text-purple-500" />
    default:
      return <Clock size={size} className="text-neutral-500" />
  }
}

export const getNotificationBadgeClass = (type: string): string => {
  const colors: Record<string, string> = {
    'TRANSACTION_CREATED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'TRANSACTION_UPDATED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'TRANSACTION_DELETED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'LOGIN': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'PRICE_ALERT': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    'DAILY_CHANGE_UP': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'DAILY_CHANGE_DOWN': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'PENDING_DIVIDEND': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'SYSTEM': 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
  }
  
  return colors[type] || colors['SYSTEM']
}
