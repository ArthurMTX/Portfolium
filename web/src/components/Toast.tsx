import { useEffect } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

interface ToastProps {
  type: 'success' | 'error'
  message: string
  onClose: () => void
  duration?: number
}

export default function Toast({ type, message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`rounded-lg shadow-lg border p-4 flex items-start gap-3 min-w-[300px] max-w-md ${
        type === 'success' 
          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900' 
          : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900'
      }`}>
        {type === 'success' ? (
          <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={20} />
        ) : (
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
        )}
        <div className="flex-1">
          <p className={`text-sm font-medium ${
            type === 'success' 
              ? 'text-green-800 dark:text-green-200' 
              : 'text-red-800 dark:text-red-200'
          }`}>
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className={`flex-shrink-0 ${
            type === 'success'
              ? 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200'
              : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200'
          }`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
