import { request } from '@/api/client'
import type {
  CalendarEventsResponse,
  DailyPerformanceResponse,
  EarningsCalendarResponse,
  EarningsRefreshResponse,
  EarningsRefreshStatusResponse,
  MarketHolidaysResponse,
} from '@/api/types'

// Calendar
export async function getCalendarEvents(params?: {
  portfolio_id?: number
  days_back?: number
  days_forward?: number
}) {
  const queryParams = new URLSearchParams()
  if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
  if (params?.days_back) queryParams.append('days_back', params.days_back.toString())
  if (params?.days_forward) queryParams.append('days_forward', params.days_forward.toString())
  
  const queryString = queryParams.toString()
  return request<CalendarEventsResponse>(`/calendar/events${queryString ? `?${queryString}` : ''}`)
}

export async function getEarningsCalendar(params?: {
  portfolio_id?: number
  days_back?: number
  days_forward?: number
  include_watchlist?: boolean
}) {
  const queryParams = new URLSearchParams()
  if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
  if (params?.days_back) queryParams.append('days_back', params.days_back.toString())
  if (params?.days_forward) queryParams.append('days_forward', params.days_forward.toString())
  if (params?.include_watchlist !== undefined) queryParams.append('include_watchlist', params.include_watchlist.toString())
  
  const queryString = queryParams.toString()
  return request<EarningsCalendarResponse>(`/calendar/earnings${queryString ? `?${queryString}` : ''}`)
}

export async function getDailyPerformance(params?: {
  portfolio_id?: number
  days?: number
}) {
  const queryParams = new URLSearchParams()
  if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
  if (params?.days) queryParams.append('days', params.days.toString())
  
  const queryString = queryParams.toString()
  return request<DailyPerformanceResponse>(`/calendar/daily-performance${queryString ? `?${queryString}` : ''}`)
}

export async function refreshEarningsCache(params?: { include_watchlist?: boolean }) {
  const queryParams = new URLSearchParams()
  if (params?.include_watchlist !== undefined) queryParams.append('include_watchlist', params.include_watchlist.toString())
  const queryString = queryParams.toString()
  
  return request<EarningsRefreshResponse>(`/calendar/refresh-earnings${queryString ? `?${queryString}` : ''}`, {
    method: 'POST'
  })
}

export async function getEarningsRefreshStatus(taskId: string) {
  return request<EarningsRefreshStatusResponse>(`/calendar/refresh-earnings/${encodeURIComponent(taskId)}`)
}

export async function getMarketHolidays(params?: {
  portfolio_id?: number
  start_date?: string
  end_date?: string
  currency?: string
  exchange?: string
}) {
  const queryParams = new URLSearchParams()
  if (params?.portfolio_id) queryParams.append('portfolio_id', params.portfolio_id.toString())
  if (params?.start_date) queryParams.append('start_date', params.start_date)
  if (params?.end_date) queryParams.append('end_date', params.end_date)
  if (params?.currency) queryParams.append('currency', params.currency)
  if (params?.exchange) queryParams.append('exchange', params.exchange)
  
  const queryString = queryParams.toString()
  return request<MarketHolidaysResponse>(`/calendar/market-holidays${queryString ? `?${queryString}` : ''}`)
}
