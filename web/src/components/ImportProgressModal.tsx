import { useEffect, useState, useRef } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { useTranslation } from 'react-i18next'

interface ImportLog {
  type: 'progress' | 'log' | 'complete' | 'error'
  message: string
  timestamp: Date
}

interface ImportResult {
  success: boolean
  imported_count: number
  errors?: string[]
  warnings?: string[]
}

interface ImportProgressModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (success: boolean) => void
  portfolioId?: number  // Optional for watchlist
  file: File | null
  apiEndpoint?: string  // Optional custom endpoint
}

export default function ImportProgressModal({
  isOpen,
  onClose,
  onComplete,
  portfolioId,
  file,
  apiEndpoint
}: ImportProgressModalProps) {
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [status, setStatus] = useState<'importing' | 'complete' | 'error'>('importing')
  const [result, setResult] = useState<ImportResult | null>(null)
  const hasStartedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const { t } = useTranslation()

  // Update the ref when onComplete changes
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !file || hasStartedRef.current) return

    // Mark as started to prevent duplicate imports
    hasStartedRef.current = true

    // Reset state
    setProgress(0)
    setTotal(0)
    setLogs([])
    setStatus('importing')
    setResult(null)

    const importWithProgress = async () => {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const token = localStorage.getItem('auth_token')
        
        // Determine API endpoint
        const url = apiEndpoint || `/api/portfolios/import/csv/stream?portfolio_id=${portfolioId}`
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No response body')
        }

        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep the last incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const update = JSON.parse(line)
                
                // Update progress
                if (update.current !== undefined && update.total !== undefined) {
                  setProgress(update.current)
                  setTotal(update.total)
                }

                // Add log entry (prepend to show latest first)
                const log: ImportLog = {
                  type: update.type,
                  message: update.message,
                  timestamp: new Date()
                }
                setLogs(prev => [log, ...prev])

                // Handle completion
                if (update.type === 'complete') {
                  setStatus('complete')
                  setResult(update.result)
                  onCompleteRef.current(update.result?.success || true)
                } else if (update.type === 'error' && update.result) {
                  setStatus('error')
                  setResult(update.result)
                  onCompleteRef.current(false)
                }
              } catch (e) {
                console.error('Failed to parse update:', line, e)
              }
            }
          }
        }
      } catch (error) {
        console.error('Import error:', error)
        setStatus('error')
        setLogs(prev => [{
          type: 'error',
          message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        }, ...prev])
        onCompleteRef.current(false)
      }
    }

    importWithProgress()
  }, [isOpen, file, portfolioId, apiEndpoint])

  // Reset hasStartedRef when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasStartedRef.current = false
      setStatus('importing')
      setProgress(0)
      setTotal(0)
      setLogs([])
      setResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const progressPercent = total > 0 ? (progress / total) * 100 : 0

  return (
    <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card p-6 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {status === 'importing' && (
              <>
                <LoadingSpinner variant="icon" size="sm" />
                {t('importProgressModal.title')}
              </>
            )}
            {status === 'complete' && (
              <>
                <CheckCircle className="text-green-500" size={20} />
                {t('importProgressModal.completed')}
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="text-red-500" size={20} />
                {t('importProgressModal.failed')}
              </>
            )}
          </h2>
          {status !== 'importing' && (
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex justify-between text-sm mb-1">
            <span>{t('importProgressModal.progress')}: {progress} / {total}</span>
            <span>{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
            <div
              className="bg-pink-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Summary */}
        {result && (
          <div className="mb-4 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="font-medium">{t('importProgressModal.imported')}:</span>
                <span className="text-green-600 dark:text-green-400 font-bold">
                  {result.imported_count}
                </span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="flex justify-between">
                  <span className="font-medium">Errors:</span>
                  <span className="text-red-600 dark:text-red-400 font-bold">
                    {result.errors.length}
                  </span>
                </div>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <div className="flex justify-between">
                  <span className="font-medium">{t('importProgressModal.warnings')}:</span>
                  <span className="text-yellow-600 dark:text-yellow-400 font-bold">
                    {result.warnings.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="flex-1 min-h-0 flex flex-col">
          <h3 className="text-sm font-semibold mb-2 text-neutral-700 dark:text-neutral-300 flex items-center justify-between flex-shrink-0">
            <span>{t('importProgressModal.importLog')}</span>
            <span className="text-xs text-neutral-500 font-normal">({t('importProgressModal.latestFirst')})</span>
          </h3>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm font-mono bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 ${
                  log.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : log.type === 'complete'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <span className="text-neutral-500 text-xs flex-shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-neutral-500 italic">{t('importProgressModal.waitingForUpdates')}</div>
            )}
          </div>
        </div>

        {/* Errors and Warnings Details */}
        {result && ((result.errors && result.errors.length > 0) || (result.warnings && result.warnings.length > 0)) && (
          <div className="mt-4 space-y-2 flex-shrink-0 max-h-48 overflow-y-auto">
            {result.errors && result.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
                  {t('importProgressModal.errors')}:
                </h4>
                <div className="text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded space-y-1">
                  {result.errors.map((error: string, idx: number) => (
                    <div key={idx} className="text-red-700 dark:text-red-300">
                      • {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.warnings && result.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-2">
                  <span>{t('importProgressModal.warnings')}</span>
                  <span className="text-xs font-normal text-neutral-500">({t('importProgressModal.assetsAutoCreated')})</span>
                </h4>
                <div className="text-xs bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded space-y-1">
                  {result.warnings.map((warning: string, idx: number) => (
                    <div key={idx} className="text-yellow-700 dark:text-yellow-300">
                      • {warning}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {status !== 'importing' && (
          <div className="mt-4 flex justify-end gap-2 flex-shrink-0">
            <button onClick={onClose} className="btn-primary">
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
