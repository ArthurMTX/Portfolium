import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw, Eye } from 'lucide-react'
import { api, DailyPerformanceDay, EarningsEvent, MarketHolidaysResponse } from '../lib/api'
import usePortfolioStore from '../store/usePortfolioStore'
import EmptyPortfolioPrompt from '../components/EmptyPortfolioPrompt'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../lib/formatUtils'
import { getAssetLogoUrl, handleLogoError } from '../lib/logoUtils'

type CalendarTab = 'overview' | 'earnings'

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  isMarketClosed: boolean
  holidayName?: string
  closedExchanges?: string[]  // Exchange codes that are closed
  closedExchangeNames?: string[]  // Human-readable names of closed exchanges
  isPartialClosure?: boolean  // True if only some exchanges are closed
  performance?: DailyPerformanceDay
  earnings: EarningsEvent[]
}

export default function Calendar() {
  const { portfolios, activePortfolioId, setPortfolios, setActivePortfolio } = usePortfolioStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeTab, setActiveTab] = useState<CalendarTab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformanceDay[]>([])
  const [earnings, setEarnings] = useState<EarningsEvent[]>([])
  const [marketHolidays, setMarketHolidays] = useState<MarketHolidaysResponse | null>(null)
  const [showWatchlistEarnings, setShowWatchlistEarnings] = useState(true)
  const { t, i18n } = useTranslation()

  const currentLocale = i18n.language || 'en-US'

  // Get portfolio currency
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId)
  const currency = activePortfolio?.base_currency || 'EUR'

  // Load portfolios if not loaded
  useEffect(() => {
    let canceled = false
    const load = async () => {
      if (portfolios.length === 0) {
        const data = await api.getPortfolios()
        if (canceled) return
        setPortfolios(data)
        if (data.length > 0 && !activePortfolioId) setActivePortfolio(data[0].id)
      }
    }
    load()
    return () => { canceled = true }
  }, [portfolios.length, activePortfolioId, setActivePortfolio, setPortfolios])

  // Cache for loaded months to enable lazy loading
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set())

  // Load calendar data for a specific month range (lazy loading)
  const loadMonthData = useCallback(async (targetDate: Date, showRefreshing = false) => {
    if (!activePortfolioId) return

    // Calculate month key for caching
    const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`
    
    // Skip if already loaded
    if (loadedMonths.has(monthKey) && !showRefreshing) return

    if (showRefreshing) {
      setRefreshing(true)
    } else if (loadedMonths.size === 0) {
      setLoading(true)
    }
    setError(null)

    try {
      // Calculate days needed for this month plus buffer
      const firstOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
      const lastOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0)
      const today = new Date()
      
      // Calculate days back from today to first of target month
      const daysBack = Math.max(0, Math.ceil((today.getTime() - firstOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 7)
      // Calculate days forward from today to last of target month
      const daysForward = Math.max(0, Math.ceil((lastOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 7)

      // Format dates for API
      const startDateStr = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDateStr = new Date(today.getTime() + daysForward * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [performanceData, earningsData, holidaysData] = await Promise.all([
        api.getDailyPerformance({ portfolio_id: activePortfolioId, days: Math.max(daysBack, 90) }),
        api.getEarningsCalendar({ portfolio_id: activePortfolioId, days_back: Math.max(daysBack, 90), days_forward: Math.max(daysForward, 90), include_watchlist: true }),
        api.getMarketHolidays({ portfolio_id: activePortfolioId, start_date: startDateStr, end_date: endDateStr })
      ])

      // Merge with existing data
      setDailyPerformance(prev => {
        const existingDates = new Set(prev.map(d => d.date))
        const newData = performanceData.days.filter(d => !existingDates.has(d.date))
        return [...prev, ...newData].sort((a, b) => a.date.localeCompare(b.date))
      })
      
      setEarnings(prev => {
        const existingKeys = new Set(prev.map(e => `${e.symbol}-${e.date}`))
        const newData = earningsData.earnings.filter(e => !existingKeys.has(`${e.symbol}-${e.date}`))
        return [...prev, ...newData].sort((a, b) => a.date.localeCompare(b.date))
      })

      // Update market holidays
      setMarketHolidays(prev => {
        if (!prev) return holidaysData
        // Merge holidays - combine unique dates
        const existingHolidays = new Set(prev.holidays.map(h => h.date))
        const newHolidays = holidaysData.holidays.filter(h => !existingHolidays.has(h.date))
        const existingClosed = new Set(prev.closed_dates)
        const newClosed = holidaysData.closed_dates.filter(d => !existingClosed.has(d))
        return {
          ...holidaysData,
          holidays: [...prev.holidays, ...newHolidays].sort((a, b) => a.date.localeCompare(b.date)),
          closed_dates: [...prev.closed_dates, ...newClosed].sort()
        }
      })
      
      setLoadedMonths(prev => new Set([...prev, monthKey]))
    } catch (err) {
      console.error('Failed to load calendar data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load calendar data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activePortfolioId, loadedMonths])

  // Load data when month changes
  useEffect(() => {
    loadMonthData(currentDate)
  }, [currentDate, loadMonthData])

  // Reset cache when portfolio changes
  useEffect(() => {
    setLoadedMonths(new Set())
    setDailyPerformance([])
    setEarnings([])
    setMarketHolidays(null)
  }, [activePortfolioId])

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // First day of month
    const firstDay = new Date(year, month, 1)
    // Last day of month
    const lastDay = new Date(year, month + 1, 0)

    // Start from Sunday of the week containing the first day
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - startDate.getDay())

    // End on Saturday of the week containing the last day
    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

    const days: CalendarDay[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create a set of holiday dates for fast lookup
    const holidayDates = new Set(marketHolidays?.closed_dates || [])
    // Create a map for holiday info (name, exchanges, exchange_names)
    const holidayInfo = new Map(
      (marketHolidays?.holidays || []).map(h => [h.date, {
        name: h.name,
        exchanges: h.exchanges,
        exchangeNames: h.exchange_names || []
      }])
    )
    // Get total exchanges being tracked
    const totalExchanges = marketHolidays?.total_exchanges || 1

    const currentDateIter = new Date(startDate)
    while (currentDateIter <= endDate) {
      // Use local date string to avoid timezone conversion issues
      const iterYear = currentDateIter.getFullYear()
      const iterMonth = currentDateIter.getMonth() + 1
      const dayNum = currentDateIter.getDate()
      const dateStr = `${iterYear}-${String(iterMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

      const dayOfWeek = currentDateIter.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      // Use dynamic holidays from API - check if date is in closed_dates (excludes weekends since we filter those)
      const isMarketClosed = !isWeekend && holidayDates.has(dateStr)
      const holiday = holidayInfo.get(dateStr)
      const holidayName = holiday?.name
      const closedExchanges = holiday?.exchanges || []
      const closedExchangeNames = holiday?.exchangeNames || []
      // Partial closure = only some of the tracked exchanges are closed
      const isPartialClosure = isMarketClosed && closedExchanges.length < totalExchanges

      // Skip weekends entirely
      if (!isWeekend) {
        const performance = dailyPerformance.find(d => d.date === dateStr)
        const dayEarnings = earnings.filter(e => e.date === dateStr)

        // Compare 0-indexed months (both getMonth() return 0-11)
        const viewingMonth = currentDate.getMonth()
        days.push({
          date: new Date(currentDateIter),
          isCurrentMonth: currentDateIter.getMonth() === viewingMonth,
          isToday: currentDateIter.getTime() === today.getTime(),
          isWeekend,
          isMarketClosed,
          holidayName,
          closedExchanges,
          closedExchangeNames,
          isPartialClosure,
          performance,
          earnings: dayEarnings
        })
      }

      currentDateIter.setDate(currentDateIter.getDate() + 1)
    }

    return days
  }, [currentDate, dailyPerformance, earnings, marketHolidays])

  // Filter earnings based on watchlist toggle (client-side)
  const filteredEarnings = useMemo(() => {
    if (showWatchlistEarnings) {
      return earnings
    }
    return earnings.filter(e => e.source !== 'watchlist')
  }, [earnings, showWatchlistEarnings])

  // Calendar days with filtered earnings
  const calendarDaysFiltered = useMemo(() => {
    return calendarDays.map(day => ({
      ...day,
      earnings: day.earnings.filter(e => showWatchlistEarnings || e.source !== 'watchlist')
    }))
  }, [calendarDays, showWatchlistEarnings])

  // Month navigation
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Get color class based on performance
  const getPerformanceColor = (changePct: number): string => {
    if (changePct > 2) return 'bg-green-500 dark:bg-green-600'
    if (changePct > 0.5) return 'bg-green-400 dark:bg-green-500'
    if (changePct > 0) return 'bg-green-300 dark:bg-green-400'
    if (changePct > -0.5) return 'bg-red-300 dark:bg-red-400'
    if (changePct > -2) return 'bg-red-400 dark:bg-red-500'
    return 'bg-red-500 dark:bg-red-600'
  }

  // Calculate month stats
  const monthStats = useMemo(() => {
    const monthDays = calendarDaysFiltered.filter(d => d.isCurrentMonth && d.performance)
    const positiveDays = monthDays.filter(d => d.performance!.is_positive).length
    const negativeDays = monthDays.filter(d => !d.performance!.is_positive).length
    const totalChange = monthDays.reduce((sum, d) => sum + d.performance!.total_change, 0)
    const upcomingEarnings = filteredEarnings.filter(e => e.is_future).length
    const pastEarnings = filteredEarnings.filter(e => !e.is_future).length

    return {
      positiveDays,
      negativeDays,
      totalChange,
      upcomingEarnings,
      pastEarnings
    }
  }, [calendarDaysFiltered, filteredEarnings])

  // Upcoming and past earnings lists
  const upcomingEarningsList = useMemo(() => {
    return filteredEarnings
      .filter(e => e.is_future)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredEarnings])

  const pastEarningsList = useMemo(() => {
    return filteredEarnings
      .filter(e => !e.is_future)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredEarnings])

  // Refresh earnings cache from yfinance
  const refreshEarningsCache = useCallback(async () => {
    setRefreshing(true)
    try {
      await api.refreshEarningsCache({ include_watchlist: showWatchlistEarnings })
      // Clear cache and reload data
      setLoadedMonths(new Set())
      setDailyPerformance([])
      setEarnings([])
      await loadMonthData(currentDate, false)
    } catch (err) {
      console.error('Failed to refresh earnings cache:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh earnings')
    } finally {
      setRefreshing(false)
    }
  }, [currentDate, loadMonthData, showWatchlistEarnings])

  // Toggle watchlist earnings (client-side filter, no reload)
  const toggleWatchlistEarnings = useCallback(() => {
    setShowWatchlistEarnings(prev => !prev)
  }, [])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="calendar" />
  }

  const monthName = currentDate.toLocaleDateString(currentLocale, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarIcon className="text-pink-600" size={32} />
            {t('calendar.title', 'Calendar')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {t('calendar.subtitle', 'Track your daily performance and upcoming earnings')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshEarningsCache}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 text-sm"
            title={t('calendar.refreshEarnings', 'Fetch latest earnings data from market')}
          >
            <BarChart3 size={16} className={refreshing ? 'animate-pulse' : ''} />
            {t('calendar.refreshEarnings', 'Refresh Earnings')}
          </button>
          <button
            onClick={() => loadMonthData(currentDate, true)}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <CalendarIcon size={18} />
            {t('calendar.tabs.overview', 'Calendar Overview')}
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'earnings'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <BarChart3 size={18} />
            {t('calendar.tabs.earnings', 'Earnings Calendar')}
            {upcomingEarningsList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400 rounded-full">
                {upcomingEarningsList.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="p-4 animate-pulse">
            {/* Skeleton Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
                </div>
              ))}
            </div>
            {/* Skeleton Calendar Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-10"></div>
                <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-32"></div>
                <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-10"></div>
              </div>
              <div className="h-9 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-20"></div>
            </div>
            {/* Skeleton Calendar Grid */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="grid grid-cols-5 bg-neutral-50 dark:bg-neutral-800">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                  <div key={day} className="px-2 py-2 text-center border-b border-neutral-200 dark:border-neutral-700">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-8 mx-auto"></div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5">
                {[...Array(25)].map((_, i) => (
                  <div key={i} className="min-h-[110px] p-2 border-b border-r border-neutral-200 dark:border-neutral-700">
                    <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-6 mb-2"></div>
                    <div className="space-y-1">
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-12"></div>
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-10"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <p>{error}</p>
            <button
              onClick={() => loadMonthData(currentDate, true)}
              className="mt-4 btn btn-secondary"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="p-4">
            {/* Month Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <TrendingUp size={18} />
                  <span className="text-sm font-medium">{t('calendar.stats.positiveDays', 'Positive Days')}</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                  {monthStats.positiveDays}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <TrendingDown size={18} />
                  <span className="text-sm font-medium">{t('calendar.stats.negativeDays', 'Negative Days')}</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
                  {monthStats.negativeDays}
                </p>
              </div>
              <div className={`rounded-lg p-4 ${monthStats.totalChange >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                <div className={`flex items-center gap-2 ${monthStats.totalChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  <DollarSign size={18} />
                  <span className="text-sm font-medium">{t('calendar.stats.monthChange', 'Month Change')}</span>
                </div>
                <div className="mt-1">
                  <p className={`text-2xl font-bold ${monthStats.totalChange >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {monthStats.totalChange >= 0 ? '+' : ''}{(() => {
                      const monthDays = calendarDaysFiltered.filter(d => d.isCurrentMonth && d.performance)
                      const totalChangePct = monthDays.reduce((sum, d) => sum + d.performance!.total_change_pct, 0)
                      return totalChangePct.toFixed(2)
                    })()}%
                  </p>
                  <p className={`text-sm font-medium mt-0.5 ${monthStats.totalChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {monthStats.totalChange >= 0 ? '+' : ''}{formatCurrency(monthStats.totalChange, currency)}
                  </p>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <BarChart3 size={18} />
                  <span className="text-sm font-medium">{t('calendar.stats.upcomingEarnings', 'Upcoming Earnings')}</span>
                </div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                  {monthStats.upcomingEarnings}
                </p>
              </div>
            </div>

            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold min-w-[180px] text-center capitalize">
                  {monthName}
                </h2>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToToday}
                  className="btn btn-primary text-sm"
                >
                  {t('calendar.today', 'Today')}
                </button>
                <button
                  onClick={toggleWatchlistEarnings}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    showWatchlistEarnings
                      ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400'
                  }`}
                  title={t('calendar.toggleWatchlist', 'Toggle watchlist earnings')}
                >
                  <Eye size={16} />
                  <span className="hidden sm:inline">{t('calendar.watchlist', 'Watchlist')}</span>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              {/* Day headers - weekdays only */}
              <div className="grid grid-cols-5 bg-neutral-50 dark:bg-neutral-800">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                  <div
                    key={day}
                    className="px-2 py-2 text-center text-xs font-medium text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700"
                  >
                    {t(`calendar.days.${day.toLowerCase()}`, day)}
                  </div>
                ))}
              </div>

              {/* Calendar days - weekdays only */}
              <div className="grid grid-cols-5">
                <style>{`
                  .market-closed-stripe {
                    background-image: repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 10px,
                      rgba(0, 0, 0, 0.03) 10px,
                      rgba(0, 0, 0, 0.03) 20px
                    );
                  }
                  .dark .market-closed-stripe {
                    background-image: repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 10px,
                      rgba(255, 255, 255, 0.02) 10px,
                      rgba(255, 255, 255, 0.02) 20px
                    );
                  }
                `}</style>
                {calendarDaysFiltered.map((day, index) => (
                  <div
                    key={index}
                    className={`min-h-[110px] p-2 border-b border-r border-neutral-200 dark:border-neutral-700 last:border-r-0 transition-colors relative ${
                      !day.isCurrentMonth 
                        ? 'bg-neutral-50 dark:bg-neutral-900/50' 
                        : day.isMarketClosed
                          ? day.isPartialClosure
                            ? 'bg-amber-50/50 dark:bg-amber-950/20'  // Partial closure - lighter amber
                            : 'bg-neutral-100 dark:bg-neutral-900 market-closed-stripe'  // Full closure - stripes
                          : 'bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750'
                    } ${day.isToday ? 'ring-2 ring-inset ring-pink-500 dark:ring-pink-500' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-sm font-medium ${
                          !day.isCurrentMonth
                            ? 'text-neutral-400 dark:text-neutral-600'
                            : day.isToday
                              ? 'text-pink-600 dark:text-pink-400 font-bold'
                              : 'text-neutral-700 dark:text-neutral-300'
                        }`}>
                          {day.date.getDate()}
                        </span>
                        {day.isMarketClosed && day.isCurrentMonth && (
                          <span 
                            className={`text-[9px] px-1 py-0.5 rounded font-semibold border cursor-help ${
                              day.isPartialClosure
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600'
                            }`}
                            title={`${day.holidayName || 'Market Holiday'}${day.closedExchangeNames && day.closedExchangeNames.length > 0 ? ` (${day.closedExchangeNames.join(', ')})` : ''}`}
                          >
                            {day.isPartialClosure && day.closedExchangeNames && day.closedExchangeNames.length > 0
                              ? day.closedExchangeNames.length <= 2
                                ? day.closedExchangeNames.join(', ')
                                : `${day.closedExchangeNames.slice(0, 1).join(', ')} +${day.closedExchangeNames.length - 1}`
                              : t('calendar.closed', 'Closed')
                            }
                          </span>
                        )}
                      </div>
                      {day.performance && (
                        <div className={`w-2 h-2 rounded-full ${getPerformanceColor(day.performance.total_change_pct)}`} />
                      )}
                    </div>

                    {/* Performance indicator */}
                    {day.performance && day.isCurrentMonth && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className={`text-xs font-bold ${
                          day.performance.is_positive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {day.performance.is_positive ? '+' : ''}{day.performance.total_change_pct.toFixed(2)}%
                        </div>
                        <div className={`text-[10px] font-medium opacity-80 ${
                          day.performance.is_positive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {day.performance.total_change >= 0 ? '+' : ''}{formatCurrency(day.performance.total_change, currency)}
                        </div>
                      </div>
                    )}

                    {/* Earnings badges */}
                    {day.earnings.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {day.earnings.slice(0, 3).map((earning, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border w-fit ${
                              earning.source === 'watchlist'
                                ? earning.is_future
                                  ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-100 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-300'
                                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                                : earning.is_future
                                  ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800/50 text-purple-700 dark:text-purple-300'
                                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                            }`}
                            title={`${earning.symbol}: ${earning.name || 'Earnings'}${earning.source === 'watchlist' ? ' (Watchlist)' : ''}`}
                          >
                            {earning.source === 'watchlist' && (
                              <Eye size={10} className="shrink-0" />
                            )}
                            <img
                              src={getAssetLogoUrl(earning.symbol, 'stock', earning.name)}
                              alt={earning.symbol}
                              className="w-3 h-3 rounded-full object-cover bg-white shrink-0"
                              onError={(e) => handleLogoError(e, earning.symbol, earning.name, 'stock')}
                            />
                            <span className="font-semibold">{earning.symbol}</span>
                          </div>
                        ))}
                        {day.earnings.length > 3 && (
                          <div className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded font-medium">
                            +{day.earnings.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>{t('calendar.legend.positive', 'Positive day')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>{t('calendar.legend.negative', 'Negative day')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-neutral-200 dark:bg-neutral-700 market-closed-stripe border border-neutral-300 dark:border-neutral-600 rounded" />
                <span>{t('calendar.legend.allMarketsClosed', 'All markets closed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 rounded" />
                <span>{t('calendar.legend.someMarketsClosed', 'Some markets closed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-1.5 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                  AAPL
                </div>
                <span>{t('calendar.legend.earnings', 'Upcoming earnings')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded">
                  <Eye size={10} />
                  TSLA
                </div>
                <span>{t('calendar.legend.watchlistEarnings', 'Watchlist earnings')}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Earnings Tab */
          <div className="p-4">
            {/* Upcoming Earnings */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-600" />
                {t('calendar.earnings.upcoming', 'Upcoming Earnings')}
                <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                  ({upcomingEarningsList.length})
                </span>
              </h3>
              {upcomingEarningsList.length === 0 ? (
                <p className="text-neutral-500 dark:text-neutral-400 text-center py-8">
                  {t('calendar.earnings.noUpcoming', 'No upcoming earnings for your stocks or watchlist')}
                </p>
              ) : (
                <div className="grid gap-3">
                  {upcomingEarningsList.map((earning, index) => (
                    <div
                      key={`${earning.symbol}-${earning.date}-${index}`}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-white dark:bg-neutral-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                        earning.source === 'watchlist'
                          ? 'border-cyan-200 dark:border-cyan-700'
                          : 'border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                        <div className={`text-center w-[48px] sm:min-w-[60px] p-1.5 sm:p-2 rounded-lg border shrink-0 ${
                          earning.source === 'watchlist'
                            ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-800/30'
                            : 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30'
                        }`}>
                          <div className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
                            earning.source === 'watchlist'
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : 'text-purple-600 dark:text-purple-400'
                          }`}>
                            {new Date(earning.date).toLocaleDateString(currentLocale, { month: 'short' })}
                          </div>
                          <div className={`text-xl sm:text-2xl font-bold leading-none mt-0.5 sm:mt-1 ${
                            earning.source === 'watchlist'
                              ? 'text-cyan-700 dark:text-cyan-300'
                              : 'text-purple-700 dark:text-purple-300'
                          }`}>
                            {new Date(earning.date).getDate()}
                          </div>
                        </div>
                        
                        <img
                          src={getAssetLogoUrl(earning.symbol, 'stock', earning.name)}
                          alt={earning.symbol}
                          className="w-8 h-8 sm:w-10 sm:h-10 shadow-sm shrink-0"
                          onError={(e) => handleLogoError(e, earning.symbol, earning.name, 'stock')}
                        />
                        
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 shrink-0">{earning.symbol}</span>
                            {earning.source === 'watchlist' ? (
                              <span className="flex items-center gap-1 text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-400 font-medium shrink-0">
                                <Eye size={10} />
                                {t('calendar.earnings.watchlist', 'Watchlist')}
                              </span>
                            ) : (
                              <span className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium shrink-0">
                                Upcoming
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] sm:text-sm text-neutral-600 dark:text-neutral-400 font-medium truncate">
                            {earning.name || 'Company'}
                          </div>
                          {earning.source !== 'watchlist' && earning.portfolios.length > 0 && (
                            <div className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-500 mt-0.5 truncate">
                              <span className="opacity-70">{t('calendar.earnings.inPortfolios', 'In')}:</span> {earning.portfolios.map(p => p.name).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-left sm:text-right flex flex-wrap sm:flex-col gap-2 sm:gap-0 shrink-0">
                        {earning.eps_estimate && (
                          <div className="text-xs sm:text-sm mb-0 sm:mb-1">
                            <span className="text-neutral-500 dark:text-neutral-400 mr-1 sm:mr-2 text-[10px] sm:text-xs uppercase tracking-wide">
                              EPS
                            </span>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm whitespace-nowrap">
                              ${typeof earning.eps_estimate === 'number' ? earning.eps_estimate.toFixed(2) : earning.eps_estimate}
                            </span>
                          </div>
                        )}
                        {earning.revenue_estimate && (
                          <div className="text-xs sm:text-sm">
                            <span className="text-neutral-500 dark:text-neutral-400 mr-1 sm:mr-2 text-[10px] sm:text-xs uppercase tracking-wide">
                              REV
                            </span>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm whitespace-nowrap">
                              {typeof earning.revenue_estimate === 'number'
                                ? (earning.revenue_estimate / 1e9).toFixed(2) + 'B'
                                : earning.revenue_estimate}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Earnings */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-neutral-500" />
                {t('calendar.earnings.past', 'Past Earnings')}
                <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                  ({pastEarningsList.length})
                </span>
              </h3>
              {pastEarningsList.length === 0 ? (
                <p className="text-neutral-500 dark:text-neutral-400 text-center py-8">
                  {t('calendar.earnings.noPast', 'No past earnings data available')}
                </p>
              ) : (
                <div className="grid gap-2">
                  {pastEarningsList.slice(0, 10).map((earning, index) => (
                    <div
                      key={`${earning.symbol}-${earning.date}-${index}`}
                      className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 min-w-[50px] text-right">
                          {new Date(earning.date).toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' })}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <img
                            src={getAssetLogoUrl(earning.symbol, 'stock', earning.name)}
                            alt={earning.symbol}
                            className="w-8 h-8 rounded-full object-cover bg-white border border-neutral-100 dark:border-neutral-700"
                            onError={(e) => handleLogoError(e, earning.symbol, earning.name, 'stock')}
                          />
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                              {earning.symbol}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[150px]">
                              {earning.name}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        {earning.eps_actual !== undefined && earning.eps_actual !== null && (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">EPS</span>
                            <span className="font-medium">${typeof earning.eps_actual === 'number' ? earning.eps_actual.toFixed(2) : earning.eps_actual}</span>
                          </div>
                        )}
                        {earning.surprise_pct !== undefined && earning.surprise_pct !== null && (
                          <div className="flex flex-col items-end min-w-[60px]">
                            <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">Surprise</span>
                            <span className={`font-bold ${
                              Number(earning.surprise_pct) >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {Number(earning.surprise_pct) >= 0 ? '+' : ''}{Number(earning.surprise_pct).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {pastEarningsList.length > 10 && (
                    <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-2">
                      {t('calendar.earnings.showingRecent', 'Showing 10 most recent earnings')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
