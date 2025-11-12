import { useMemo, useState, useEffect } from 'react'
import { DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'

interface DXYWidgetProps extends BaseWidgetProps {
  title: string
  subtitle?: string
}

export default function DXYWidget({
  title,
  subtitle,
  isPreview = false,
}: DXYWidgetProps) {
  const { t } = useTranslation()
  const [dxyPrice, setDxyPrice] = useState<number | null>(null)
  const [dxyChange, setDxyChange] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isPreview) {
      // Mock data for preview
      setDxyPrice(106.25)
      setDxyChange(0.15)
      return
    }

    const fetchDxyData = async () => {
      setLoading(true)
      try {
        const data = await api.getDXYIndex()
        
        setDxyPrice(data.price)
        setDxyChange(data.change_pct)
      } catch (error) {
        console.error('Failed to fetch DXY data:', error)
        setDxyPrice(null)
        setDxyChange(null)
      } finally {
        setLoading(false)
      }
    }

    fetchDxyData()
  }, [isPreview])

  const { strengthLevel, strengthColor, bgColor, iconColor } = useMemo(() => {
    if (dxyPrice === null) {
      return {
        strengthLevel: 'Unknown',
        strengthColor: 'text-neutral-600 dark:text-neutral-400',
        bgColor: 'bg-neutral-50 dark:bg-neutral-900/20',
        iconColor: 'text-neutral-600 dark:text-neutral-400',
      }
    }

    // DXY (U.S. Dollar Index) interpretation:
    // < 90: Very Weak
    // 90-95: Weak
    // 95-105: Normal
    // 105-115: Strong
    // > 115: Very Strong
    let strengthLevel = ''
    let strengthColor = ''
    let bgColor = ''
    let iconColor = ''

    if (dxyPrice < 90) {
      strengthLevel = 'Very Weak'
      strengthColor = 'text-red-600 dark:text-red-400'
      bgColor = 'bg-red-50 dark:bg-red-900/20'
      iconColor = 'text-red-600 dark:text-red-400'
    } else if (dxyPrice < 95) {
      strengthLevel = 'Weak'
      strengthColor = 'text-orange-600 dark:text-orange-400'
      bgColor = 'bg-orange-50 dark:bg-orange-900/20'
      iconColor = 'text-orange-600 dark:text-orange-400'
    } else if (dxyPrice < 105) {
      strengthLevel = 'Normal'
      strengthColor = 'text-neutral-600 dark:text-neutral-400'
      bgColor = 'bg-neutral-50 dark:bg-neutral-900/20'
      iconColor = 'text-neutral-600 dark:text-neutral-400'
    } else if (dxyPrice < 115) {
      strengthLevel = 'Strong'
      strengthColor = 'text-blue-600 dark:text-blue-400'
      bgColor = 'bg-blue-50 dark:bg-blue-900/20'
      iconColor = 'text-blue-600 dark:text-blue-400'
    } else {
      strengthLevel = 'Very Strong'
      strengthColor = 'text-green-600 dark:text-green-400'
      bgColor = 'bg-green-50 dark:bg-green-900/20'
      iconColor = 'text-green-600 dark:text-green-400'
    }

    return { strengthLevel, strengthColor, bgColor, iconColor }
  }, [dxyPrice])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <DollarSign className={iconColor} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t(title)}
          </h3>
          {subtitle && (
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center -mt-2">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-bold ${strengthColor}`}>
                {dxyPrice !== null ? dxyPrice.toFixed(2) : 'N/A'}
              </p>
              {dxyChange !== null && (
                <span
                  className={`text-xs font-medium ${
                    dxyChange >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {dxyChange >= 0 ? '+' : ''}{dxyChange.toFixed(2)}%
                </span>
              )}
            </div>
            <p className={`text-sm font-semibold mt-1 ${strengthColor}`}>
              {strengthLevel} Dollar
            </p>
          </>
        )}
      </div>
    </div>
  )
}
