import { useState, useEffect } from 'react'
import { Target, TrendingUp, Calendar, DollarSign } from 'lucide-react'
import { BaseWidgetProps } from '../../types'
import usePortfolioStore from '@/store/usePortfolioStore'
import { formatCurrency } from '@/lib/formatUtils'
import { useTranslation } from 'react-i18next'

interface GoalTrackerWidgetProps extends BaseWidgetProps {
  metrics: {
    total_value: number
  } | null
}

export default function GoalTrackerWidget({ metrics, isPreview = false }: GoalTrackerWidgetProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'
  const { t } = useTranslation()

  // Load goal from localStorage (or use default in preview mode)
  const [goalAmount, setGoalAmount] = useState<number>(() => {
    if (isPreview) return 15000 // Mock goal for preview
    const stored = localStorage.getItem(`portfolio-goal-${activePortfolioId}`)
    return stored ? parseFloat(stored) : 100000
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(goalAmount.toString())

  // Save goal to localStorage when it changes (skip in preview mode)
  useEffect(() => {
    if (!isPreview && activePortfolioId) {
      localStorage.setItem(`portfolio-goal-${activePortfolioId}`, goalAmount.toString())
    }
  }, [goalAmount, activePortfolioId, isPreview])

  const currentValue = metrics?.total_value || 0
  const progress = goalAmount > 0 ? Math.min((currentValue / goalAmount) * 100, 100) : 0
  const remaining = Math.max(goalAmount - currentValue, 0)
  const isGoalReached = currentValue >= goalAmount

  const handleSaveGoal = () => {
    const newGoal = parseFloat(editValue)
    if (!isNaN(newGoal) && newGoal > 0) {
      setGoalAmount(newGoal)
    } else {
      setEditValue(goalAmount.toString())
    }
    setIsEditing(false)
  }

  // Calculate estimated time to goal (simplified - assumes linear growth)
  const getTimeToGoal = () => {
    if (isGoalReached || currentValue <= 0 || remaining <= 0) return null
    
    // Assume 8% annual growth (conservative market average)
    const annualGrowthRate = 0.08
    const yearsToGoal = Math.log(goalAmount / currentValue) / Math.log(1 + annualGrowthRate)
    
    if (yearsToGoal < 1) {
      return `${Math.ceil(yearsToGoal * 12)} months`
    } else {
      const years = Math.floor(yearsToGoal)
      const months = Math.ceil((yearsToGoal - years) * 12)
      return months > 0 ? `${years}y ${months}m` : `${years} years`
    }
  }

  const timeToGoal = getTimeToGoal()

  return (
    <div className="card h-full flex flex-col p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Target className="text-emerald-600 dark:text-emerald-400" size={18} />
          </div>
          <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t('dashboard.widgets.goalTracker.name')}
          </h3>
        </div>
        {!isEditing && (
          <button
            onClick={() => {
              setIsEditing(true)
              setEditValue(goalAmount.toString())
            }}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {t('dashboard.widgets.goalTracker.editGoal')}
          </button>
        )}
      </div>

      {/* Goal Input */}
      {isEditing ? (
        <div className="mb-4">
          <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
            {t('dashboard.widgets.goalTracker.targetAmount')}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
              placeholder={t('dashboard.widgets.goalTracker.amountPlaceholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveGoal()
                if (e.key === 'Escape') setIsEditing(false)
              }}
            />
            <button
              onClick={handleSaveGoal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Progress Circle */}
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <div className="relative w-32 h-32 mb-4">
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-neutral-200 dark:text-neutral-700"
            />
            {/* Progress Circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
              className={`${
                isGoalReached
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : 'text-emerald-500 dark:text-emerald-600'
              } transition-all duration-500`}
              strokeLinecap="round"
            />
          </svg>
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {progress.toFixed(0)}%
            </span>
            {isGoalReached && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {t('dashboard.widgets.goalTracker.goalReached')}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="w-full space-y-3">
          {/* Current Value */}
          <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-neutral-500" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">{t('dashboard.widgets.goalTracker.current')}</span>
            </div>
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(currentValue, portfolioCurrency)}
            </span>
          </div>

          {/* Goal Amount */}
          <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-emerald-700 dark:text-emerald-400">{t('dashboard.widgets.goalTracker.goal')}</span>
            </div>
            <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {formatCurrency(goalAmount, portfolioCurrency)}
            </span>
          </div>

          {!isGoalReached && (
            <>
              {/* Remaining */}
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-400">{t('dashboard.widgets.goalTracker.toGo')}</span>
                </div>
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {formatCurrency(remaining, portfolioCurrency)}
                </span>
              </div>

              {/* Time Estimate */}
              {timeToGoal && (
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-xs text-purple-700 dark:text-purple-400">{t('dashboard.widgets.goalTracker.estTime')}</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    {timeToGoal}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
          {isGoalReached
            ? t('dashboard.widgets.goalTracker.congratulations')
            : timeToGoal
            ? t('dashboard.widgets.goalTracker.estimates8PercentReturn')
            : t('dashboard.widgets.goalTracker.setARealisticGoal')}
        </p>
      </div>
    </div>
  )
}
