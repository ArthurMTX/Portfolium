import { useMemo, useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BaseWidgetProps } from '../../types'
import api from '@/lib/api'

interface TNXWidgetProps extends BaseWidgetProps {
  title: string
  subtitle?: string
}

export default function TNXWidget({
  title,
  subtitle,
  isPreview = false,
}: TNXWidgetProps) {
  const { t } = useTranslation()
  const [tnxPrice, setTnxPrice] = useState<number | null>(null)
  const [tnxChange, setTnxChange] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isPreview) {
      // Mock data for preview
      setTnxPrice(4.25)
      setTnxChange(0.3)
      return
    }

    const fetchTnxData = async () => {
      setLoading(true)
      try {
        const data = await api.getTNXIndex()
        
        setTnxPrice(data.price)
        setTnxChange(data.change_pct)
      } catch (error) {
        console.error('Failed to fetch TNX data:', error)
        setTnxPrice(null)
        setTnxChange(null)
      } finally {
        setLoading(false)
      }
    }

    fetchTnxData()
  }, [isPreview])

  const { yieldLevel, yieldColor, bgColor, iconColor } = useMemo(() => {
    if (tnxPrice === null) {
      return {
        yieldLevel: 'Unknown',
        yieldColor: 'text-neutral-600 dark:text-neutral-400',
        bgColor: 'bg-neutral-50 dark:bg-neutral-900/20',
        iconColor: 'text-neutral-600 dark:text-neutral-400',
      }
    }

    // TNX (10-Year Treasury) interpretation:
    // < 2%: Very Low
    // 2-3%: Low
    // 3-4%: Normal
    // 4-5%: Elevated
    // > 5%: High
    let yieldLevel = ''
    let yieldColor = ''
    let bgColor = ''
    let iconColor = ''

    if (tnxPrice < 2) {
      yieldLevel = 'Very Low'
      yieldColor = 'text-blue-600 dark:text-blue-400'
      bgColor = 'bg-blue-50 dark:bg-blue-900/20'
      iconColor = 'text-blue-600 dark:text-blue-400'
    } else if (tnxPrice < 3) {
      yieldLevel = 'Low'
      yieldColor = 'text-green-600 dark:text-green-400'
      bgColor = 'bg-green-50 dark:bg-green-900/20'
      iconColor = 'text-green-600 dark:text-green-400'
    } else if (tnxPrice < 4) {
      yieldLevel = 'Normal'
      yieldColor = 'text-neutral-600 dark:text-neutral-400'
      bgColor = 'bg-neutral-50 dark:bg-neutral-900/20'
      iconColor = 'text-neutral-600 dark:text-neutral-400'
    } else if (tnxPrice < 5) {
      yieldLevel = 'Elevated'
      yieldColor = 'text-orange-600 dark:text-orange-400'
      bgColor = 'bg-orange-50 dark:bg-orange-900/20'
      iconColor = 'text-orange-600 dark:text-orange-400'
    } else {
      yieldLevel = 'High'
      yieldColor = 'text-red-600 dark:text-red-400'
      bgColor = 'bg-red-50 dark:bg-red-900/20'
      iconColor = 'text-red-600 dark:text-red-400'
    }

    return { yieldLevel, yieldColor, bgColor, iconColor }
  }, [tnxPrice])

  return (
    <div className="card h-full flex flex-col p-5">
      <div className="flex items-start gap-2.5 mb-4">
        <div className={`w-9 h-9 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <TrendingUp className={iconColor} size={18} />
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
              <p className={`text-3xl font-bold ${yieldColor}`}>
                {tnxPrice !== null ? `${tnxPrice.toFixed(2)}%` : 'N/A'}
              </p>
              {tnxChange !== null && (
                <span
                  className={`text-xs font-medium ${
                    tnxChange >= 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {tnxChange >= 0 ? '+' : ''}{tnxChange.toFixed(2)}%
                </span>
              )}
            </div>
            <p className={`text-sm font-semibold mt-1 ${yieldColor}`}>
              {yieldLevel} Yield
            </p>
          </>
        )}
      </div>
    </div>
  )
}
