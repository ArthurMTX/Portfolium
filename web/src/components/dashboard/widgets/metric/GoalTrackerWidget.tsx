import { useState, useEffect } from 'react'
import { Target, TrendingUp, Calendar, DollarSign, Plus, Home, GraduationCap, Palmtree, Heart, Sparkles, Edit2, Trash2, ChevronLeft, ChevronRight, Loader2, TrendingDown, Zap, AlertTriangle } from 'lucide-react'
import { BaseWidgetProps } from '../../types'
import usePortfolioStore from '@/store/usePortfolioStore'
import { formatCurrency } from '@/lib/formatUtils'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'

interface Goal {
  id: number
  title: string
  targetAmount: number
  targetDate: string | null
  monthlyContribution: number
  category: 'retirement' | 'house' | 'education' | 'vacation' | 'emergency' | 'other'
  color: string
  createdAt: string
}

interface GoalProjections {
  scenarios: {
    label: 'Pessimistic' | 'Median' | 'Optimistic'
    return_rate: number
    projected_months: number
    projected_amount: number
    quantile: number
    color: string
  }[]
  milestones: {
    percentage: number
    amount: number
    achieved: boolean
    label: string
  }[]
  probability: number
  historical_performance: {
    annual_return: number
    annual_volatility: number
  }
  is_past_target_date?: boolean
  warning?: string
}

interface GoalTrackerWidgetProps extends BaseWidgetProps {
  metrics: {
    total_value: number
  } | null
}

const GOAL_CATEGORIES = [
  { id: 'retirement' as const, icon: Target, label: 'Retirement', color: 'emerald' },
  { id: 'house' as const, icon: Home, label: 'House', color: 'blue' },
  { id: 'education' as const, icon: GraduationCap, label: 'Education', color: 'purple' },
  { id: 'vacation' as const, icon: Palmtree, label: 'Vacation', color: 'amber' },
  { id: 'emergency' as const, icon: Heart, label: 'Emergency Fund', color: 'red' },
  { id: 'other' as const, icon: Sparkles, label: 'Other', color: 'neutral' },
]

const getCategoryConfig = (category: string) => {
  return GOAL_CATEGORIES.find(c => c.id === category) || GOAL_CATEGORIES[5]
}

export default function GoalTrackerWidget({ metrics, isPreview = false }: GoalTrackerWidgetProps) {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const portfolioCurrency = activePortfolio?.base_currency || 'USD'
  const { t } = useTranslation()

  // State
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [goalProjections, setGoalProjections] = useState<GoalProjections | null>(null)
  const [isLoadingProjections, setIsLoadingProjections] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formTargetAmount, setFormTargetAmount] = useState('')
  const [formTargetDate, setFormTargetDate] = useState('')
  const [formMonthlyContribution, setFormMonthlyContribution] = useState('')
  const [formCategory, setFormCategory] = useState<Goal['category']>('other')

  // Load goals from backend (or use mock data in preview mode)
  useEffect(() => {
    if (isPreview) {
      setGoals([
        {
          id: 1,
          title: 'Retirement Fund',
          targetAmount: 100000,
          targetDate: '2035-12-31',
          monthlyContribution: 500,
          category: 'retirement',
          color: 'emerald',
          createdAt: new Date().toISOString(),
        },
      ])
      setIsLoading(false)
      return
    }

    if (!activePortfolioId) {
      setIsLoading(false)
      return
    }

    const loadGoals = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Try to load from backend
        const apiGoals = await api.getPortfolioGoals(activePortfolioId, false)
        const mappedGoals: Goal[] = apiGoals.map(g => ({
          id: g.id,
          title: g.title,
          targetAmount: g.target_amount,
          targetDate: g.target_date,
          monthlyContribution: g.monthly_contribution,
          category: g.category,
          color: g.color || getCategoryConfig(g.category).color,
          createdAt: g.created_at,
        }))
        setGoals(mappedGoals)

        // Sync from localStorage if backend has no goals
        if (mappedGoals.length === 0) {
          await syncLocalStorageToBackend()
        }
      } catch (err) {
        console.error('Failed to load goals:', err)
        setError('Failed to load goals')
        
        // Fallback to localStorage on error
        const stored = localStorage.getItem(`portfolio-goals-${activePortfolioId}`)
        if (stored) {
          try {
            setGoals(JSON.parse(stored))
          } catch {
            setGoals([])
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadGoals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePortfolioId, isPreview])

  // One-time migration: sync localStorage goals to backend
  const syncLocalStorageToBackend = async () => {
    if (!activePortfolioId || isPreview) return

    const stored = localStorage.getItem(`portfolio-goals-${activePortfolioId}`)
    if (!stored) return

    try {
      const localGoals = JSON.parse(stored)
      if (!Array.isArray(localGoals) || localGoals.length === 0) return

      // Create each goal in the backend
      for (const localGoal of localGoals) {
        try {
          await api.createPortfolioGoal(activePortfolioId, {
            title: localGoal.title,
            target_amount: localGoal.targetAmount,
            target_date: localGoal.targetDate,
            monthly_contribution: localGoal.monthlyContribution || 0,
            category: localGoal.category,
            color: localGoal.color,
            is_active: true,
          })
        } catch (err) {
          console.error('Failed to migrate goal:', localGoal, err)
        }
      }

      // Reload goals from backend
      const apiGoals = await api.getPortfolioGoals(activePortfolioId, false)
      const mappedGoals: Goal[] = apiGoals.map(g => ({
        id: g.id,
        title: g.title,
        targetAmount: g.target_amount,
        targetDate: g.target_date,
        monthlyContribution: g.monthly_contribution,
        category: g.category,
        color: g.color || getCategoryConfig(g.category).color,
        createdAt: g.created_at,
      }))
      setGoals(mappedGoals)

      // Clear localStorage after successful migration
      localStorage.removeItem(`portfolio-goals-${activePortfolioId}`)
    } catch (err) {
      console.error('Failed to sync localStorage goals:', err)
    }
  }

  const currentGoal = goals[currentGoalIndex]
  const currentValue = metrics?.total_value || 0

  const handleAddGoal = () => {
    setFormTitle('')
    setFormTargetAmount('')
    setFormTargetDate('')
    setFormMonthlyContribution('0')
    setFormCategory('other')
    setEditingGoal(null)
    setShowGoalForm(true)
  }

  const handleEditGoal = (goal: Goal) => {
    setFormTitle(goal.title)
    setFormTargetAmount(goal.targetAmount.toString())
    setFormTargetDate(goal.targetDate || '')
    setFormMonthlyContribution(goal.monthlyContribution.toString())
    setFormCategory(goal.category)
    setEditingGoal(goal)
    setShowGoalForm(true)
  }

  const handleDeleteGoal = async (goalId: number) => {
    if (!activePortfolioId || isPreview) return

    try {
      await api.deletePortfolioGoal(activePortfolioId, goalId)
      const newGoals = goals.filter(g => g.id !== goalId)
      setGoals(newGoals)
      if (currentGoalIndex >= newGoals.length) {
        setCurrentGoalIndex(Math.max(0, newGoals.length - 1))
      }
    } catch (err) {
      console.error('Failed to delete goal:', err)
      setError('Failed to delete goal')
    }
  }

  const handleSaveGoal = async () => {
    if (!activePortfolioId || isPreview) return

    const targetAmount = parseFloat(formTargetAmount)
    const monthlyContribution = parseFloat(formMonthlyContribution) || 0

    if (!formTitle.trim() || isNaN(targetAmount) || targetAmount <= 0) {
      return
    }

    const categoryConfig = getCategoryConfig(formCategory)
    setIsSaving(true)

    try {
      if (editingGoal) {
        // Update existing goal
        const updated = await api.updatePortfolioGoal(activePortfolioId, editingGoal.id, {
          title: formTitle.trim(),
          target_amount: targetAmount,
          target_date: formTargetDate || null,
          monthly_contribution: monthlyContribution,
          category: formCategory,
          color: categoryConfig.color,
        })

        setGoals(goals.map(g => 
          g.id === editingGoal.id 
            ? {
                id: updated.id,
                title: updated.title,
                targetAmount: updated.target_amount,
                targetDate: updated.target_date,
                monthlyContribution: updated.monthly_contribution,
                category: updated.category,
                color: updated.color || categoryConfig.color,
                createdAt: updated.created_at,
              }
            : g
        ))
      } else {
        // Add new goal
        const created = await api.createPortfolioGoal(activePortfolioId, {
          title: formTitle.trim(),
          target_amount: targetAmount,
          target_date: formTargetDate || null,
          monthly_contribution: monthlyContribution,
          category: formCategory,
          color: categoryConfig.color,
        })

        const newGoal: Goal = {
          id: created.id,
          title: created.title,
          targetAmount: created.target_amount,
          targetDate: created.target_date,
          monthlyContribution: created.monthly_contribution,
          category: created.category,
          color: created.color || categoryConfig.color,
          createdAt: created.created_at,
        }
        setGoals([...goals, newGoal])
        setCurrentGoalIndex(goals.length)
      }

      setShowGoalForm(false)
      setEditingGoal(null)
    } catch (err) {
      console.error('Failed to save goal:', err)
      setError('Failed to save goal')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePreviousGoal = () => {
    setCurrentGoalIndex((prev) => (prev > 0 ? prev - 1 : goals.length - 1))
  }

  const handleNextGoal = () => {
    setCurrentGoalIndex((prev) => (prev < goals.length - 1 ? prev + 1 : 0))
  }

  // Calculate goal metrics
  // Calculate historical performance and scenarios
  // Load projections when current goal changes or when goal parameters update (after save)
  useEffect(() => {
    const goalId = currentGoal?.id
    if (!goalId || isPreview || !activePortfolioId) {
      setGoalProjections(null)
      return
    }

    const loadProjections = async () => {
      try {
        setIsLoadingProjections(true)
        const projections = await api.getGoalProjections(activePortfolioId, goalId)
        setGoalProjections(projections)
        
        // Show warning if target date is in the past
        if (projections.warning) {
          console.warn('Goal projection warning:', projections.warning)
        }
      } catch (err) {
        console.error('Failed to load projections:', err)
        setGoalProjections(null)
      } finally {
        setIsLoadingProjections(false)
      }
    }

    loadProjections()
  }, [currentGoal?.id, currentGoal?.targetDate, currentGoal?.targetAmount, currentGoal?.monthlyContribution, activePortfolioId, isPreview])
  
  const calculateGoalMetrics = (goal: Goal) => {
    const progress = goal.targetAmount > 0 ? Math.min((currentValue / goal.targetAmount) * 100, 100) : 0
    const remaining = Math.max(goal.targetAmount - currentValue, 0)
    const isGoalReached = currentValue >= goal.targetAmount

    // Use API projections if available
    const scenarios = goalProjections?.scenarios || []
    const milestones = goalProjections?.milestones || []
    const overallProbability = goalProjections?.probability ?? 0
    const historicalReturn = goalProjections?.historical_performance?.annual_return || 0.08
    const volatility = goalProjections?.historical_performance?.annual_volatility || 0.15

    // Calculate estimated time to goal using median scenario from API projections
    let timeToGoal = null
    let projectedValue = currentValue

    if (!isGoalReached && remaining > 0) {
      // Use median scenario from API projections if available
      const medianScenario = scenarios.find(s => s.label === 'Median')
      
      if (medianScenario && medianScenario.projected_months > 0) {
        // Use the projected months from the median scenario
        const months = medianScenario.projected_months
        const years = Math.floor(months / 12)
        const remainingMonths = Math.round(months % 12)
        
        if (years === 0) {
          timeToGoal = `${Math.round(months)} ${Math.round(months) === 1 ? 'month' : 'months'}`
        } else if (remainingMonths === 0) {
          timeToGoal = `${years} ${years === 1 ? 'year' : 'years'}`
        } else {
          timeToGoal = `${years}y ${remainingMonths}m`
        }
        
        projectedValue = medianScenario.projected_amount
      } else {
        // Fallback to simple calculation if projections not available
        const monthlyRate = historicalReturn / 12
        
        if (goal.monthlyContribution > 0) {
          // Future value with contributions
          let months = 0
          let value = currentValue
          const maxMonths = 600 // 50 years max
          
          while (value < goal.targetAmount && months < maxMonths) {
            value = value * (1 + monthlyRate) + goal.monthlyContribution
            months++
          }
          
          if (months < maxMonths) {
            const years = Math.floor(months / 12)
            const remainingMonths = months % 12
            
            if (years === 0) {
              timeToGoal = `${months} ${months === 1 ? 'month' : 'months'}`
            } else if (remainingMonths === 0) {
              timeToGoal = `${years} ${years === 1 ? 'year' : 'years'}`
            } else {
              timeToGoal = `${years}y ${remainingMonths}m`
            }
          }
        } else {
          // No contributions, just growth
          const yearsToGoal = Math.log(goal.targetAmount / currentValue) / Math.log(1 + historicalReturn)
          
          if (yearsToGoal < 1) {
            timeToGoal = `${Math.ceil(yearsToGoal * 12)} months`
          } else {
            const years = Math.floor(yearsToGoal)
            const months = Math.ceil((yearsToGoal - years) * 12)
            timeToGoal = months > 0 ? `${years}y ${months}m` : `${years} ${years === 1 ? 'year' : 'years'}`
          }
        }

        // Calculate projected value with contributions over time to target date
        if (goal.targetDate) {
          const targetDate = new Date(goal.targetDate)
          const now = new Date()
          const monthsToTarget = Math.max(0, (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
          
          let value = currentValue
          for (let i = 0; i < monthsToTarget; i++) {
            value = value * (1 + monthlyRate) + goal.monthlyContribution
          }
          projectedValue = value
        }
      }
    }

    return {
      progress,
      remaining,
      isGoalReached,
      timeToGoal,
      projectedValue,
      scenarios,
      milestones,
      overallProbability,
      historicalReturn,
      volatility,
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="card h-full flex flex-col items-center justify-center p-5">
        <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400" size={32} />
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
          {t('common.loading')}...
        </p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="card h-full flex flex-col p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="text-red-600 dark:text-red-400" size={18} />
            </div>
            <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('dashboard.widgets.goalTracker.name')}
            </h3>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  if (goals.length === 0 && !showGoalForm) {
    // Empty state
    return (
      <div className="card h-full flex flex-col p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="text-emerald-600 dark:text-emerald-400" size={18} />
            </div>
            <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('dashboard.widgets.goalTracker.name')}
            </h3>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
            <Target className="text-neutral-400" size={32} />
          </div>
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            {t('dashboard.widgets.goalTracker.noGoals')}
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center mb-6 max-w-xs">
            {t('dashboard.widgets.goalTracker.noGoalsDescription')}
          </p>
          <button
            onClick={handleAddGoal}
            disabled={isPreview}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t('dashboard.widgets.goalTracker.addFirstGoal')}
          </button>
        </div>
      </div>
    )
  }

  const goalMetrics = currentGoal ? calculateGoalMetrics(currentGoal) : null
  const categoryConfig = currentGoal ? getCategoryConfig(currentGoal.category) : null
  const CategoryIcon = categoryConfig?.icon || Target

  // Goal form modal
  if (showGoalForm) {
    return (
      <div className="card h-full flex flex-col p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="text-emerald-600 dark:text-emerald-400" size={18} />
            </div>
            <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {editingGoal ? t('dashboard.widgets.goalTracker.editGoal') : t('dashboard.widgets.goalTracker.addGoal')}
            </h3>
          </div>
          <button
            onClick={() => {
              setShowGoalForm(false)
              setEditingGoal(null)
            }}
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            {t('common.cancel')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Goal Title */}
          <div>
            <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
              {t('dashboard.widgets.goalTracker.goalTitle')}
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
              placeholder={t('dashboard.widgets.goalTracker.goalTitlePlaceholder')}
              autoFocus
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 block">
              {t('dashboard.widgets.goalTracker.category')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GOAL_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const isSelected = formCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setFormCategory(cat.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `border-${cat.color}-500 bg-${cat.color}-50 dark:bg-${cat.color}-900/20`
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <Icon size={20} className={isSelected ? `text-${cat.color}-600 dark:text-${cat.color}-400` : 'text-neutral-400'} />
                    <span className="text-xs font-medium">{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target Amount */}
          <div>
            <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
              {t('dashboard.widgets.goalTracker.targetAmount')}
            </label>
            <input
              type="number"
              value={formTargetAmount}
              onChange={(e) => setFormTargetAmount(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
              placeholder="100000"
            />
          </div>

          {/* Target Date */}
          <div>
            <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
              {t('dashboard.widgets.goalTracker.targetDate')}
              <span className="ml-1 text-neutral-400">{t('common.optional')}</span>
            </label>
            <input
              type="date"
              value={formTargetDate}
              onChange={(e) => setFormTargetDate(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
            />
          </div>

          {/* Monthly Contribution */}
          <div>
            <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
              {t('dashboard.widgets.goalTracker.monthlyContribution')}
              <span className="ml-1 text-neutral-400">{t('common.optional')}</span>
            </label>
            <input
              type="number"
              value={formMonthlyContribution}
              onChange={(e) => setFormMonthlyContribution(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
              placeholder="0"
            />
            <p className="text-xs text-neutral-400 mt-1">
              {t('dashboard.widgets.goalTracker.monthlyContributionHelp')}
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={handleSaveGoal}
            disabled={isSaving || !formTitle.trim() || !formTargetAmount || parseFloat(formTargetAmount) <= 0}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="animate-spin" size={16} />}
            {isSaving 
              ? t('common.saving') 
              : editingGoal ? t('common.save') : t('dashboard.widgets.goalTracker.createGoal')
            }
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col p-5 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 bg-${categoryConfig?.color}-50 dark:bg-${categoryConfig?.color}-900/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
            <CategoryIcon className={`text-${categoryConfig?.color}-600 dark:text-${categoryConfig?.color}-400`} size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">
              {currentGoal?.title || t('dashboard.widgets.goalTracker.name')}
            </h3>
            {goals.length > 1 && (
              <p className="text-xs text-neutral-400">
                {currentGoalIndex + 1} {t('common.of')} {goals.length}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {goals.length > 1 && (
            <>
              <button
                onClick={handlePreviousGoal}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                title={t('common.previous')}
              >
                <ChevronLeft size={16} className="text-neutral-500" />
              </button>
              <button
                onClick={handleNextGoal}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                title={t('common.next')}
              >
                <ChevronRight size={16} className="text-neutral-500" />
              </button>
            </>
          )}
          <button
            onClick={() => currentGoal && handleEditGoal(currentGoal)}
            disabled={isPreview}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
            title={t('common.edit')}
          >
            <Edit2 size={14} className="text-neutral-500" />
          </button>
          <button
            onClick={() => currentGoal && handleDeleteGoal(currentGoal.id)}
            disabled={isPreview}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
            title={t('common.delete')}
          >
            <Trash2 size={14} className="text-red-500" />
          </button>
          <button
            onClick={handleAddGoal}
            disabled={isPreview}
            className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded transition-colors disabled:opacity-50"
            title={t('dashboard.widgets.goalTracker.addGoal')}
          >
            <Plus size={14} className="text-emerald-600 dark:text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Progress Circle */}
      <div className="flex-1 flex flex-col items-center justify-center py-3">
        <div className="relative w-28 h-28 mb-3">
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="50"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-neutral-200 dark:text-neutral-700"
            />
            {/* Progress Circle */}
            <circle
              cx="56"
              cy="56"
              r="50"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - (goalMetrics?.progress || 0) / 100)}`}
              className={`text-${categoryConfig?.color}-${goalMetrics?.isGoalReached ? '600' : '500'} dark:text-${categoryConfig?.color}-${goalMetrics?.isGoalReached ? '500' : '600'} transition-all duration-500`}
              strokeLinecap="round"
            />
          </svg>
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {goalMetrics?.progress.toFixed(0)}%
            </span>
            {goalMetrics?.isGoalReached && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {t('dashboard.widgets.goalTracker.goalReached')}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="w-full space-y-2">
          {/* Current Value */}
          <div className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-neutral-500" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">{t('dashboard.widgets.goalTracker.current')}</span>
            </div>
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(currentValue, portfolioCurrency)}
            </span>
          </div>

          {/* Goal Amount */}
          <div className={`flex items-center justify-between p-2.5 bg-${categoryConfig?.color}-50 dark:bg-${categoryConfig?.color}-900/20 rounded-lg`}>
            <div className="flex items-center gap-2">
              <Target size={14} className={`text-${categoryConfig?.color}-600 dark:text-${categoryConfig?.color}-400`} />
              <span className={`text-xs text-${categoryConfig?.color}-700 dark:text-${categoryConfig?.color}-400`}>{t('dashboard.widgets.goalTracker.goal')}</span>
            </div>
            <span className={`text-sm font-semibold text-${categoryConfig?.color}-900 dark:text-${categoryConfig?.color}-100`}>
              {currentGoal && formatCurrency(currentGoal.targetAmount, portfolioCurrency)}
            </span>
          </div>

          {!goalMetrics?.isGoalReached && (
            <>
              {/* Remaining */}
              <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-400">{t('dashboard.widgets.goalTracker.toGo')}</span>
                </div>
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {goalMetrics && formatCurrency(goalMetrics.remaining, portfolioCurrency)}
                </span>
              </div>

              {/* Monthly Contribution */}
              {currentGoal && currentGoal.monthlyContribution > 0 && (
                <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-amber-700 dark:text-amber-400">{t('dashboard.widgets.goalTracker.monthly')}</span>
                  </div>
                  <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {formatCurrency(currentGoal.monthlyContribution, portfolioCurrency)}
                  </span>
                </div>
              )}

              {/* Time Estimate */}
              {goalMetrics?.timeToGoal && (
                <div className="flex items-center justify-between p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-purple-600 dark:text-purple-400" />
                    <span className="text-xs text-purple-700 dark:text-purple-400">{t('dashboard.widgets.goalTracker.estTime')}</span>
                  </div>
                  <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    {goalMetrics.timeToGoal}
                  </span>
                </div>
              )}

              {/* Target Date */}
              {currentGoal?.targetDate && (
                <div className={`flex items-center justify-between p-2.5 rounded-lg ${
                  goalProjections?.is_past_target_date 
                    ? 'bg-amber-50 dark:bg-amber-900/20' 
                    : 'bg-indigo-50 dark:bg-indigo-900/20'
                }`}>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className={
                      goalProjections?.is_past_target_date 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-indigo-600 dark:text-indigo-400'
                    } />
                    <span className={`text-xs ${
                      goalProjections?.is_past_target_date 
                        ? 'text-amber-700 dark:text-amber-400' 
                        : 'text-indigo-700 dark:text-indigo-400'
                    }`}>{t('dashboard.widgets.goalTracker.targetDate')}</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    goalProjections?.is_past_target_date 
                      ? 'text-amber-900 dark:text-amber-100' 
                      : 'text-indigo-900 dark:text-indigo-100'
                  }`}>
                    {new Date(currentGoal.targetDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Past Date Warning */}
      {goalProjections?.is_past_target_date && goalProjections.warning && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-900 dark:text-amber-100 mb-1">
                Target date is in the past
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {goalProjections.warning}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading Projections */}
      {!goalMetrics?.isGoalReached && isLoadingProjections && (
        <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={16} />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Calculating projections...</span>
        </div>
      )}

      {/* Low Probability Warning */}
      {!goalMetrics?.isGoalReached && !isLoadingProjections && goalMetrics?.overallProbability !== undefined && goalMetrics.overallProbability < 0.05 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-red-900 dark:text-red-100 mb-1">
                Very Unlikely Goal
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                This goal is very unlikely with the current monthly contribution. Consider increasing your monthly contributions or adjusting your target amount.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Probability Gauge */}
      {!goalMetrics?.isGoalReached && !isLoadingProjections && goalMetrics?.overallProbability !== undefined && (
        <div className="mt-4 p-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Achievement Probability</span>
            </div>
            <span className="text-lg font-bold text-purple-900 dark:text-purple-100">
              {(goalMetrics.overallProbability * 100).toFixed(0)}%
            </span>
          </div>
          
          {/* Probability Bar */}
          <div className="relative w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                goalMetrics.overallProbability >= 0.7 ? 'bg-emerald-500' :
                goalMetrics.overallProbability >= 0.4 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${goalMetrics.overallProbability * 100}%` }}
            />
          </div>
          
          <div className="flex items-center gap-1 mt-2">
            {goalMetrics.overallProbability >= 0.7 ? (
              <Target size={12} className="text-emerald-600 dark:text-emerald-400" />
            ) : goalMetrics.overallProbability >= 0.4 ? (
              <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
            ) : (
              <TrendingDown size={12} className="text-red-600 dark:text-red-400" />
            )}
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {goalMetrics.overallProbability >= 0.7
                ? 'High confidence based on Monte Carlo simulation'
                : goalMetrics.overallProbability >= 0.4
                ? 'Moderate confidence - consider increasing contributions'
                : 'Low confidence - significant adjustments needed'}
            </p>
          </div>
        </div>
      )}

      {/* Projection Scenarios */}
      {!goalMetrics?.isGoalReached && !isLoadingProjections && goalMetrics?.scenarios && goalMetrics.scenarios.length > 0 && (
        <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Projection Scenarios</span>
          </div>
          
          <div className="space-y-2">
            {goalMetrics.scenarios.map((scenario) => (
              <div key={scenario.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${scenario.color}-500`} />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {scenario.label}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      ({(scenario.return_rate * 100).toFixed(1)}% annual)
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    scenario.projected_amount >= (currentGoal?.targetAmount || 0)
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(scenario.projected_amount, portfolioCurrency)}
                  </span>
                </div>
                
                {/* Visual bar showing if target is met */}
                <div className="relative w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full bg-${scenario.color}-500 transition-all duration-500`}
                    style={{ width: `${Math.min((scenario.projected_amount / (currentGoal?.targetAmount || 1)) * 100, 100)}%` }}
                  />
                  {/* Target marker */}
                  <div className="absolute inset-y-0 left-full -ml-px w-0.5 bg-neutral-900 dark:bg-neutral-100" style={{ left: '100%' }} />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Based on historical return of {(goalMetrics.historicalReturn * 100).toFixed(1)}% ± {(goalMetrics.volatility * 100).toFixed(1)}% volatility
            </p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
          {goalMetrics?.isGoalReached
            ? t('dashboard.widgets.goalTracker.congratulations')
            : currentGoal?.monthlyContribution
            ? 'Projections use historical performance and Monte Carlo simulation'
            : 'Add monthly contributions to see detailed projections'}
        </p>
      </div>
    </div>
  )
}
