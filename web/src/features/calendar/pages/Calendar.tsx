import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Eye } from 'lucide-react'
import { api, DailyPerformanceDay, EarningsEvent, MarketHolidaysResponse } from '@/api'
import usePortfolioStore from '@/features/portfolios/store/usePortfolioStore'
import EmptyPortfolioPrompt from '@/features/portfolios/components/EmptyPortfolioPrompt'
import { ChartSkeleton, StateBlock } from '@/shared/components/StatePrimitives'
import {
  PageAsideColumn,
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
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/shared/lib/formatUtils'
import { getAssetLogoUrl, handleLogoError } from '@/shared/lib/logoUtils'
import '@/shared/design/pages/calendar.css'

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

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatCompactDate(dateValue: string, locale: string): string {
  return new Date(dateValue).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function getDaysRemaining(dateValue: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateValue)
  target.setHours(0, 0, 0, 0)
  const days = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function formatRevenueEstimate(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if (Math.abs(numeric) >= 1e9) return `$${(numeric / 1e9).toFixed(2)}B`
  if (Math.abs(numeric) >= 1e6) return `$${(numeric / 1e6).toFixed(1)}M`
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function getPortfolioExposureLabel(earning: EarningsEvent): string {
  if (earning.portfolios.length === 0) return 'Portfolio'
  if (earning.portfolios.length === 1) return earning.portfolios[0].name
  return `${earning.portfolios.length} portfolios`
}

function getGainToneClass(value: number | null | undefined): 'is-positive' | 'is-negative' | '' {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'is-positive' : 'is-negative'
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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
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

  const todayKey = useMemo(() => formatDateKey(new Date()), [])
  const effectiveSelectedDateKey = selectedDateKey || todayKey
  const selectedDay = useMemo(() => {
    return calendarDaysFiltered.find(day => formatDateKey(day.date) === effectiveSelectedDateKey)
      || calendarDaysFiltered.find(day => day.isToday)
      || calendarDaysFiltered.find(day => day.isCurrentMonth)
      || calendarDaysFiltered[0]
  }, [calendarDaysFiltered, effectiveSelectedDateKey])

  const earningsThisWeek = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(today.getDate() + 7)
    return filteredEarnings.filter((earning) => {
      if (!earning.is_future) return false
      const earningDate = new Date(earning.date)
      return earningDate >= today && earningDate <= endOfWeek
    }).length
  }, [filteredEarnings])

  const nextPortfolioCatalyst = useMemo(() => {
    return upcomingEarningsList.find(earning => earning.source !== 'watchlist') || upcomingEarningsList[0] || null
  }, [upcomingEarningsList])

  const largestReportingHolding = useMemo(() => {
    return upcomingEarningsList.find(earning => earning.source !== 'watchlist') || null
  }, [upcomingEarningsList])

  const groupedUpcomingEarnings = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const thisWeekEnd = new Date(now)
    thisWeekEnd.setDate(now.getDate() + 7)
    const nextWeekEnd = new Date(now)
    nextWeekEnd.setDate(now.getDate() + 14)
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const groups: Array<{ key: string; title: string; items: EarningsEvent[] }> = [
      { key: 'this-week', title: 'This week', items: [] },
      { key: 'next-week', title: 'Next week', items: [] },
      { key: 'later-this-month', title: 'Later this month', items: [] },
      { key: 'later', title: 'Later', items: [] },
    ]

    upcomingEarningsList.forEach((earning) => {
      const earningDate = new Date(earning.date)
      if (earningDate <= thisWeekEnd) groups[0].items.push(earning)
      else if (earningDate <= nextWeekEnd) groups[1].items.push(earning)
      else if (earningDate <= currentMonthEnd) groups[2].items.push(earning)
      else groups[3].items.push(earning)
    })

    return groups.filter(group => group.items.length > 0)
  }, [currentDate, upcomingEarningsList])

  const recentReportedEarnings = useMemo(() => pastEarningsList.slice(0, 10), [pastEarningsList])

  if (portfolios.length === 0 || !activePortfolioId) {
    return <EmptyPortfolioPrompt pageType="calendar" />
  }

  const monthName = currentDate.toLocaleDateString(currentLocale, { month: 'long', year: 'numeric' })
  const monthDays = calendarDaysFiltered.filter(d => d.isCurrentMonth && d.performance)
  const totalChangePct = monthDays.reduce((sum, d) => sum + d.performance!.total_change_pct, 0)
  const watchlistEarningsCount = filteredEarnings.filter(earning => earning.source === 'watchlist' && earning.is_future).length
  const monthGainToneClass = getGainToneClass(monthStats.totalChange)

  return (
    <PageShell className="calendar">
      <PageHeader>
        <PageTitleBlock kicker="Calendar" title="Portfolio timeline" />
        <PageSummaryPanel
          lead={monthName}
          description="Performance days, earnings events and market closures for the active portfolio."
          actions={
            <>
              <button className="pf-button pf-button--secondary" type="button" onClick={refreshEarningsCache} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                {t('calendar.refreshEarnings', 'Refresh Earnings')}
              </button>
              <button className="pf-button pf-button--secondary" type="button" onClick={() => loadMonthData(currentDate, true)} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                {t('common.refresh')}
              </button>
            </>
          }
        />
      </PageHeader>

      <PageMetricStrip label="Calendar context">
        <PageMetric label="Current month" value={monthName} />
        <PageMetric label="Upcoming earnings" value={monthStats.upcomingEarnings} />
        <PageMetric label="Earnings this week" value={earningsThisWeek} />
        <PageMetric label="Positive trading days" value={monthStats.positiveDays} tone="positive" />
        <PageMetric label="Negative trading days" value={monthStats.negativeDays} tone="negative" />
      </PageMetricStrip>

      <PageControls
        label="Calendar views"
        start={
          <PageTabs label="Calendar views">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={activeTab === 'overview' ? 'is-active' : ''}
            >
              {t('calendar.tabs.overview', 'Calendar Overview')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('earnings')}
              className={activeTab === 'earnings' ? 'is-active' : ''}
            >
              {t('calendar.tabs.earnings', 'Earnings Calendar')}
              {upcomingEarningsList.length > 0 && <span>{upcomingEarningsList.length}</span>}
            </button>
          </PageTabs>
        }
        end={
          <div className="calendar__earnings-controls">
            <button
              type="button"
              onClick={toggleWatchlistEarnings}
              className={showWatchlistEarnings ? 'is-active' : ''}
              title={t('calendar.toggleWatchlist', 'Toggle watchlist earnings')}
            >
              <Eye size={15} />
              {t('calendar.watchlist', 'Watchlist')}
            </button>
          </div>
        }
      />

      {loading ? (
        <ChartSkeleton className="calendar__loading" label={t('calendar.loading', 'Loading calendar')} />
      ) : error ? (
        <StateBlock
          tone="error"
          className="calendar-empty"
          eyebrow="Calendar"
          title="Could not load calendar data."
          description="Performance and earnings events could not be refreshed for this period."
          detail={error}
          actionLabel={t('common.tryAgain')}
          onAction={() => loadMonthData(currentDate, true)}
        />
      ) : activeTab === 'overview' ? (
        <PageSection className="calendar-section">
          <PageSectionHeader
            kicker="Month view"
            title={monthName}
            aside={
              <span className={`pf-section-description calendar-month-change ${monthGainToneClass}`.trim()}>
                {monthStats.totalChange >= 0 ? '+' : ''}{totalChangePct.toFixed(2)}% this month · {monthStats.totalChange >= 0 ? '+' : ''}{formatCurrency(monthStats.totalChange, currency)}
              </span>
            }
          />

          <div className="calendar__calendar-toolbar">
            <div>
              <button type="button" onClick={goToPreviousMonth} aria-label="Previous month">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={goToNextMonth} aria-label="Next month">
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={goToToday}>{t('calendar.today', 'Today')}</button>
            </div>
          </div>

          <PageMainGrid className="calendar__overview">
            <PageMainColumn className="calendar__calendar">
              <div className="calendar__weekdays">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                  <div key={day}>{t(`calendar.days.${day.toLowerCase()}`, day)}</div>
                ))}
              </div>

              <div className="calendar__days">
                {calendarDaysFiltered.map((day) => {
                  const dateKey = formatDateKey(day.date)
                  const isSelected = selectedDay && formatDateKey(selectedDay.date) === dateKey
                  const performanceToneClass = getGainToneClass(day.performance?.total_change)
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(dateKey)}
                      className={[
                        'calendar-day',
                        !day.isCurrentMonth ? 'is-outside' : '',
                        day.isToday ? 'is-today' : '',
                        isSelected ? 'is-selected' : '',
                        day.isMarketClosed ? 'is-market-closed' : '',
                        day.isPartialClosure ? 'is-partial-closure' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className="calendar-day__number">{day.date.getDate()}</span>

                      {day.performance && day.isCurrentMonth ? (
                        <span className={`calendar-day__return ${performanceToneClass}`.trim()}>
                          {day.performance.is_positive ? '+' : ''}{day.performance.total_change_pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="calendar-day__quiet">—</span>
                      )}

                      <span className="calendar-day__events">
                        {day.performance && <i className={performanceToneClass} />}
                        {day.earnings.length > 0 && <i className="is-earnings" />}
                        {day.isMarketClosed && <i className="is-closed" />}
                      </span>

                      {day.earnings.length > 0 && (
                        <span className="calendar-day__symbols">
                          {day.earnings.slice(0, 2).map(earning => earning.symbol).join(', ')}
                          {day.earnings.length > 2 ? ` +${day.earnings.length - 2}` : ''}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </PageMainColumn>

            <PageAsideColumn className="calendar-summary">
              {selectedDay ? (
                <>
                  <p>Selected day</p>
                  <h3>{selectedDay.date.toLocaleDateString(currentLocale, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>

                  <dl>
                    <div>
                      <dt>Portfolio</dt>
                      <dd className={getGainToneClass(selectedDay.performance?.total_change)}>
                        {selectedDay.performance
                          ? `${selectedDay.performance.is_positive ? '+' : ''}${selectedDay.performance.total_change_pct.toFixed(2)}%`
                          : 'No performance data'}
                      </dd>
                    </div>
                    {selectedDay.performance && (
                      <div>
                        <dt>Gain / loss</dt>
                        <dd className={getGainToneClass(selectedDay.performance.total_change)}>
                          {selectedDay.performance.total_change >= 0 ? '+' : ''}{formatCurrency(selectedDay.performance.total_change, currency)}
                        </dd>
                      </div>
                    )}
                    {selectedDay.isMarketClosed && (
                      <div>
                        <dt>Market state</dt>
                        <dd>{selectedDay.isPartialClosure ? 'Partial closure' : 'Closed'}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="calendar-summary__events">
                    <span>Events</span>
                    {selectedDay.earnings.length === 0 && !selectedDay.isMarketClosed ? (
                      <p>No recorded calendar events.</p>
                    ) : (
                      <ul>
                        {selectedDay.isMarketClosed && (
                          <li>
                            <strong>{selectedDay.holidayName || 'Market holiday'}</strong>
                            <small>{selectedDay.closedExchangeNames?.join(', ') || 'Tracked exchanges'}</small>
                          </li>
                        )}
                        {selectedDay.earnings.map((earning, index) => (
                          <li
                            key={`${earning.symbol}-${earning.date}-${index}`}
                            className={earning.source === 'watchlist' ? 'is-watchlist' : ''}
                          >
                            <img
                              src={getAssetLogoUrl(earning.symbol, 'stock', earning.name)}
                              alt={earning.symbol}
                              onError={(e) => handleLogoError(e, earning.symbol, earning.name, 'stock')}
                            />
                            <div>
                              <strong>{earning.symbol} earnings</strong>
                              <small>{earning.name || 'Company'}</small>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <p>Select a day to inspect its financial footprint.</p>
              )}
            </PageAsideColumn>
          </PageMainGrid>

          <div className="calendar-observations">
            <p>Calendar observations</p>
            <dl>
              <div>
                <dt>Next portfolio catalyst</dt>
                <dd>{nextPortfolioCatalyst ? `${nextPortfolioCatalyst.symbol} on ${formatCompactDate(nextPortfolioCatalyst.date, currentLocale)}` : '—'}</dd>
              </div>
              <div>
                <dt>Largest holding reporting soon</dt>
                <dd>{largestReportingHolding ? `${largestReportingHolding.symbol} · ${formatCompactDate(largestReportingHolding.date, currentLocale)}` : '—'}</dd>
              </div>
              <div>
                <dt>Watchlist earnings</dt>
                <dd>{watchlistEarningsCount}</dd>
              </div>
              <div>
                <dt>Recently reported</dt>
                <dd>{recentReportedEarnings[0] ? `${recentReportedEarnings[0].symbol} · ${formatCompactDate(recentReportedEarnings[0].date, currentLocale)}` : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="calendar-legend">
            <span><i className="is-positive" />Positive day</span>
            <span><i className="is-negative" />Negative day</span>
            <span><i className="is-earnings" />Earnings</span>
            <span><i className="is-closed" />Market closure</span>
          </div>
        </PageSection>
      ) : (
        <PageSection className="calendar-section">
          <PageSectionHeader
            kicker="Earnings timeline"
            title={t('calendar.earnings.upcoming', 'Upcoming Earnings')}
            aside={
              <span className="pf-section-description">{upcomingEarningsList.length} upcoming events · {watchlistEarningsCount} from watchlist.</span>
            }
          />

          {groupedUpcomingEarnings.length === 0 ? (
            <StateBlock
              className="calendar-empty"
              eyebrow="No earnings"
              title={t('calendar.earnings.noUpcoming', 'No earnings found for this period.')}
              description="Owned and watched companies with upcoming earnings will appear here."
            />
          ) : (
            <div className="calendar-timeline">
              {groupedUpcomingEarnings.map((group) => (
                <section key={group.key}>
                  <h3>{group.title}</h3>
                  <div>
                    {group.items.map((earning, index) => (
                      <article
                        key={`${earning.symbol}-${earning.date}-${index}`}
                        className={`calendar-earning ${earning.source === 'watchlist' ? 'is-watchlist' : ''}`}
                      >
                        <time>
                          <span>{new Date(earning.date).toLocaleDateString(currentLocale, { month: 'short' })}</span>
                          <strong>{new Date(earning.date).getDate()}</strong>
                        </time>

                        <div className="calendar-earning__identity">
                          <img
                            src={getAssetLogoUrl(earning.symbol, 'stock', earning.name)}
                            alt={earning.symbol}
                            onError={(e) => handleLogoError(e, earning.symbol, earning.name, 'stock')}
                          />
                          <div>
                            <strong>{earning.symbol}</strong>
                            <span>{earning.name || 'Company'}</span>
                          </div>
                        </div>

                        <dl>
                          <div>
                            <dt>Days remaining</dt>
                            <dd>{getDaysRemaining(earning.date)}</dd>
                          </div>
                          <div>
                            <dt>Expected EPS</dt>
                            <dd>{earning.eps_estimate !== undefined && earning.eps_estimate !== null ? `$${Number(earning.eps_estimate).toFixed(2)}` : '—'}</dd>
                          </div>
                          <div>
                            <dt>Expected revenue</dt>
                            <dd>{formatRevenueEstimate(earning.revenue_estimate)}</dd>
                          </div>
                          <div>
                            <dt>Exposure</dt>
                            <dd>{earning.source === 'watchlist' ? 'Not owned' : getPortfolioExposureLabel(earning)}</dd>
                          </div>
                        </dl>

                        <div className="calendar-earning__actions">
                          <a href={`/assets/${encodeURIComponent(earning.symbol)}/research`}>Open Asset Research</a>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <PageSection className="calendar-recent">
            <PageSectionHeader
              kicker="Recently reported"
              title={t('calendar.earnings.past', 'Past Earnings')}
              aside={
                <span className="pf-section-description">{pastEarningsList.length > 10 ? t('calendar.earnings.showingRecent', 'Showing 10 most recent earnings') : `${pastEarningsList.length} reported events.`}</span>
              }
            />

            {recentReportedEarnings.length === 0 ? (
              <StateBlock
                className="calendar-empty"
                eyebrow="No reported earnings"
                title={t('calendar.earnings.noPast', 'No past earnings data available.')}
                description="Recently reported earnings for owned and watched companies will appear here."
              />
            ) : (
              <div className="calendar-recent__list">
                {recentReportedEarnings.map((earning, index) => (
                  <article
                    key={`${earning.symbol}-${earning.date}-${index}`}
                    className={earning.source === 'watchlist' ? 'is-watchlist' : ''}
                  >
                    <time>{formatCompactDate(earning.date, currentLocale)}</time>
                    <div className="calendar-recent__identity">
                      <img
                        src={getAssetLogoUrl(earning.symbol, 'stock', earning.name)}
                        alt={earning.symbol}
                        onError={(e) => handleLogoError(e, earning.symbol, earning.name, 'stock')}
                      />
                      <div>
                        <strong>{earning.symbol}</strong>
                        <span>{earning.name || 'Company'}</span>
                      </div>
                    </div>
                    {(earning.eps_actual !== undefined && earning.eps_actual !== null) || (earning.surprise_pct !== undefined && earning.surprise_pct !== null) ? (
                      <dl>
                        {earning.eps_actual !== undefined && earning.eps_actual !== null && (
                          <div>
                            <dt>EPS</dt>
                            <dd>${Number(earning.eps_actual).toFixed(2)}</dd>
                          </div>
                        )}
                        {earning.surprise_pct !== undefined && earning.surprise_pct !== null && (
                          <div>
                            <dt>Surprise</dt>
                            <dd className={Number(earning.surprise_pct) >= 0 ? 'is-positive' : 'is-negative'}>
                              {Number(earning.surprise_pct) >= 0 ? '+' : ''}{Number(earning.surprise_pct).toFixed(1)}%
                            </dd>
                          </div>
                        )}
                      </dl>
                    ) : (
                      <p className="calendar-recent__quiet">Reported. Actual figures unavailable.</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </PageSection>
        </PageSection>
      )}
    </PageShell>
  )
}
