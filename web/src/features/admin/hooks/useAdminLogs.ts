import { useEffect, useState } from 'react'
import type { LogEntry } from '@/features/admin/types'

export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

export function useAdminLogs() {
  const [logs, setLogs] = useState<string[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsPageSize, setLogsPageSize] = useState(50)
  const [logsLevel, setLogsLevel] = useState('')
  const [logsSearch, setLogsSearch] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false)
  const [logsRefreshInterval, setLogsRefreshInterval] = useState(5)
  const [logsManualRefresh, setLogsManualRefresh] = useState(false)

  const fetchLogs = async (isManual = false) => {
    setLogsLoading(true)
    if (isManual) setLogsManualRefresh(true)
    try {
      const params: Record<string, string | number> = { page: logsPage, page_size: logsPageSize }
      if (logsLevel) params.level = logsLevel
      if (logsSearch) params.search = logsSearch

      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value))
      })

      const response = await fetch(`/api/admin/logs?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`)
      }

      const res: LogEntry = await response.json()
      const logsArr = Array.isArray(res.logs) ? res.logs : []
      setLogs(logsArr)
      setLogsTotal(typeof res.total === 'number' ? res.total : 0)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch logs.'
      setLogs([`Error: ${errorMessage}`])
      setLogsTotal(0)
    } finally {
      setLogsLoading(false)
      if (isManual) setLogsManualRefresh(false)
    }
  }

  useEffect(() => {
    void fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsPage, logsPageSize, logsLevel])

  useEffect(() => {
    if (!logsAutoRefresh) return

    const interval = setInterval(() => {
      void fetchLogs()
    }, logsRefreshInterval * 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsAutoRefresh, logsRefreshInterval])

  return {
    logs,
    logsTotal,
    logsPage,
    logsPageSize,
    logsLevel,
    logsSearch,
    logsLoading,
    logsAutoRefresh,
    logsRefreshInterval,
    logsManualRefresh,
    logsTotalPages: Math.ceil(logsTotal / logsPageSize),
    setLogsPage,
    setLogsPageSize,
    setLogsLevel,
    setLogsSearch,
    setLogsAutoRefresh,
    setLogsRefreshInterval,
    fetchLogs,
  }
}
