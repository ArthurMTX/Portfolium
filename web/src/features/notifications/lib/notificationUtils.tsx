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
