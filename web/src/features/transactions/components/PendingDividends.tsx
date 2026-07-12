import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Check, X, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'
import api, { PendingDividendDTO, PortfolioPendingDividendStatsDTO } from '@/api'
import { formatCurrency } from '@/shared/lib/formatUtils'
import AssetLogo from '@/shared/components/AssetLogo'
import Toast from '@/shared/components/Toast'

interface PendingDividendsProps {
  portfolioId: number
  portfolioCurrency: string
  onDividendAccepted?: () => void
}

const getExpandedStorageKey = (portfolioId: number) => `pending-dividends-expanded-${portfolioId}`

const getSavedExpandedState = (portfolioId: number) => {
  if (typeof window === 'undefined') return true

  return window.localStorage.getItem(getExpandedStorageKey(portfolioId)) !== 'false'
}

export default function PendingDividends({ 
  portfolioId, 
  portfolioCurrency,
  onDividendAccepted 
}: PendingDividendsProps) {
  const { t } = useTranslation()
  const [pendingDividends, setPendingDividends] = useState<PendingDividendDTO[]>([])
  const [stats, setStats] = useState<PortfolioPendingDividendStatsDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [expanded, setExpanded] = useState(() => getSavedExpandedState(portfolioId))
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  
  // Accept modal state
  const [acceptingDividend, setAcceptingDividend] = useState<PendingDividendDTO | null>(null)
  const [taxAmount, setTaxAmount] = useState('')
  const [notes, setNotes] = useState('')

  // Get converted total from server-side computed stats (no more N+1 FX calls)
  const convertedTotal = stats ? Number(stats.converted_total_amount) : 0

  const fetchPendingDividends = useCallback(async () => {
    if (!portfolioId) return
    
    setLoading(true)
    try {
      const [dividends, statsData] = await Promise.all([
        api.getPortfolioPendingDividends(portfolioId, 'PENDING'),
        api.getPortfolioPendingDividendStats(portfolioId)
      ])
      setPendingDividends(dividends)
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch pending dividends:', error)
    } finally {
      setLoading(false)
    }
  }, [portfolioId])

  useEffect(() => {
    fetchPendingDividends()
  }, [fetchPendingDividends])

  useEffect(() => {
    setExpanded(getSavedExpandedState(portfolioId))
  }, [portfolioId])

  const toggleExpanded = useCallback(() => {
    setExpanded((current) => {
      const next = !current

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(getExpandedStorageKey(portfolioId), JSON.stringify(next))
      }

      return next
    })
  }, [portfolioId])

  const handleFetchDividends = async () => {
    if (!portfolioId) return
    
    setFetching(true)
    try {
      const newDividends = await api.fetchDividendsForPortfolio(portfolioId)
      if (newDividends.length > 0) {
        setToast({ 
          type: 'success', 
          message: t('pendingDividends.success.fetchSuccess', { count: newDividends.length })
        })
        await fetchPendingDividends()
      } else {
        setToast({ 
          type: 'info', 
          message: t('pendingDividends.success.noNewDividends')
        })
      }
    } catch (error) {
      console.error('Failed to fetch dividends:', error)
      setToast({ type: 'error', message: t('pendingDividends.error.fetchError') })
    } finally {
      setFetching(false)
    }
  }

  const openAcceptModal = (dividend: PendingDividendDTO) => {
    setAcceptingDividend(dividend)
    setTaxAmount('')
    setNotes('')
  }

  const closeAcceptModal = () => {
    setAcceptingDividend(null)
    setTaxAmount('')
    setNotes('')
  }

  const handleAccept = async () => {
    if (!acceptingDividend) return
    
    const dividendId = acceptingDividend.id
    setProcessingIds(prev => new Set(prev).add(dividendId))
    
    try {
      await api.acceptPendingDividend(dividendId, {
        tax_amount: taxAmount ? parseFloat(taxAmount) : 0,
        notes: notes || undefined
      })
      
      setToast({ 
        type: 'success', 
        message: t('pendingDividends.success.accepted')
      })
      
      closeAcceptModal()
      await fetchPendingDividends()
      onDividendAccepted?.()
    } catch (error) {
      console.error('Failed to accept dividend:', error)
      setToast({ type: 'error', message: t('pendingDividends.error.acceptError') })
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(dividendId)
        return next
      })
    }
  }

  const handleReject = async (dividend: PendingDividendDTO) => {
    const dividendId = dividend.id
    setProcessingIds(prev => new Set(prev).add(dividendId))
    
    try {
      await api.rejectPendingDividend(dividendId)
      
      setToast({ 
        type: 'success', 
        message: t('pendingDividends.success.rejected')
      })
      
      await fetchPendingDividends()
    } catch (error) {
      console.error('Failed to reject dividend:', error)
      setToast({ type: 'error', message: t('pendingDividends.error.rejectError') })
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(dividendId)
        return next
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock size={14} className="text-amber-500" />
      case 'ACCEPTED':
        return <CheckCircle size={14} className="text-green-500" />
      case 'REJECTED':
        return <XCircle size={14} className="text-red-500" />
      default:
        return <AlertCircle size={14} className="text-neutral-500" />
    }
  }

  if (loading && pendingDividends.length === 0) {
    return null // Don't show skeleton for initial load
  }

  // Don't show the section if no pending dividends
  if (pendingDividends.length === 0 && !loading) {
    return (
      <section className="transactions-pending-dividends is-empty">
        <div className="transactions-pending-dividends__header">
          <div className="transactions-pending-dividends__title">
            <span className="transactions-pending-dividends__icon" aria-hidden="true">
              <DollarSign size={18} />
            </span>
            <div>
              <h3>{t('pendingDividends.title')}</h3>
              <p>{t('pendingDividends.noPending')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFetchDividends}
            disabled={fetching}
            className="pf-button pf-button--secondary"
          >
            <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
            {fetching ? t('common.loading') : t('pendingDividends.checkForDividends')}
          </button>
        </div>

        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </section>
    )
  }

  return (
    <section className="transactions-pending-dividends">
      <div className="transactions-pending-dividends__panel">
        <div
          className="transactions-pending-dividends__header"
          onClick={toggleExpanded}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggleExpanded()
            }
          }}
        >
          <div className="transactions-pending-dividends__title">
            <span className="transactions-pending-dividends__icon" aria-hidden="true">
              <DollarSign size={18} />
            </span>
            <div>
              <h3>
                {t('pendingDividends.title')}
                <span>{pendingDividends.length}</span>
              </h3>
              <p>{t('pendingDividends.description')}</p>
            </div>
          </div>

          <div className="transactions-pending-dividends__summary">
            {pendingDividends.length > 0 && (
              <div className="transactions-pending-dividends__total">
                <span>{t('pendingDividends.totalPending')}</span>
                <strong>{formatCurrency(convertedTotal, portfolioCurrency)}</strong>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleFetchDividends()
              }}
              disabled={fetching}
              className="pf-button pf-button--secondary transactions-pending-dividends__refresh"
            >
              <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
              <span>{t('pendingDividends.refresh')}</span>
            </button>

            <span className="transactions-pending-dividends__chevron" aria-hidden="true">
              {expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
            </span>
          </div>
        </div>

        {/* Pending Dividends List */}
        {expanded && (
          <div className="transactions-pending-dividends__list">
            {pendingDividends.map((dividend) => {
              const grossAmount = Number(dividend.gross_amount)
              const sharesHeld = Number(dividend.shares_held)
              const divPerShare = Number(dividend.dividend_per_share)
              const isProcessing = processingIds.has(dividend.id)
              
              return (
                <div 
                  key={dividend.id}
                  className="transactions-pending-dividends__item"
                >
                  <div className="transactions-pending-dividends__asset">
                    <AssetLogo
                      symbol={dividend.asset_symbol || ''}
                      assetName={dividend.asset_name}
                      alt={dividend.asset_symbol || ''}
                      className="transactions-pending-dividends__logo"
                    />
                    <span>
                      <strong>
                        {dividend.asset_symbol}
                        {getStatusIcon(dividend.status)}
                      </strong>
                      <em>
                        {dividend.asset_name || dividend.asset_symbol}
                      </em>
                    </span>
                  </div>

                  <dl className="transactions-pending-dividends__details">
                    <div>
                      <dt>{t('pendingDividends.exDate')}</dt>
                      <dd>{new Date(dividend.ex_dividend_date).toLocaleDateString()}</dd>
                    </div>
                    <div>
                      <dt>{t('pendingDividends.shares')}</dt>
                      <dd>{parseFloat(sharesHeld.toFixed(8)).toString()}</dd>
                    </div>
                    <div>
                      <dt>{t('pendingDividends.perShare')}</dt>
                      <dd>{formatCurrency(divPerShare, dividend.currency || portfolioCurrency, undefined, true)}</dd>
                    </div>
                    <div>
                      <dt>{t('pendingDividends.grossAmount')}</dt>
                      <dd className="is-amount">{formatCurrency(grossAmount, dividend.currency || portfolioCurrency)}</dd>
                    </div>
                  </dl>

                  <div className="transactions-pending-dividends__actions">
                    <button
                      type="button"
                      onClick={() => openAcceptModal(dividend)}
                      disabled={isProcessing}
                      className="transactions-pending-dividends__action is-accept"
                      title={t('pendingDividends.accept')}
                      aria-label={t('pendingDividends.accept')}
                    >
                      <Check size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(dividend)}
                      disabled={isProcessing}
                      className="transactions-pending-dividends__action is-reject"
                      title={t('pendingDividends.reject')}
                      aria-label={t('pendingDividends.reject')}
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="transactions-pending-dividends__detected">
                    {t('pendingDividends.detected')} {formatDistanceToNow(new Date(dividend.fetched_at), { addSuffix: true })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Accept Modal */}
      {acceptingDividend && (
        <div className="pf-modal-overlay" onClick={closeAcceptModal}>
          <div 
            className="pf-modal-panel pf-modal-panel--sm"
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="pf-modal-header">
              <h3 className="pf-modal-title">
                {t('pendingDividends.acceptDividend')}
              </h3>
              <button
                onClick={closeAcceptModal}
                className="pf-modal-close"
                aria-label={t('common.close')}
              >
                <X size={20} className="text-neutral-500 dark:text-neutral-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="pf-modal-body pf-modal-section">
              {/* Dividend Summary */}
              <div className="pf-modal-muted-box">
                <div className="flex items-center gap-3 mb-3">
                  <AssetLogo
                    symbol={acceptingDividend.asset_symbol || ''}
                    assetName={acceptingDividend.asset_name}
                    alt={acceptingDividend.asset_symbol || ''}
                    className="w-8 h-8 rounded object-contain bg-white dark:bg-neutral-600"
                  />
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">
                      {acceptingDividend.asset_symbol}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {acceptingDividend.asset_name}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400">{t('pendingDividends.exDate')}</p>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {new Date(acceptingDividend.ex_dividend_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400">{t('pendingDividends.shares')}</p>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {parseFloat(Number(acceptingDividend.shares_held).toFixed(8)).toString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400">{t('pendingDividends.perShare')}</p>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {formatCurrency(Number(acceptingDividend.dividend_per_share), acceptingDividend.currency || portfolioCurrency, undefined, true)}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400">{t('pendingDividends.grossAmount')}</p>
                    <p className="font-semibold text-amber-600 dark:text-amber-400">
                      {formatCurrency(Number(acceptingDividend.gross_amount), acceptingDividend.currency || portfolioCurrency)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Tax Input */}
              <div>
                <label className="pf-modal-label">
                  {t('pendingDividends.withholdingTax')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    {acceptingDividend.currency || portfolioCurrency}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    placeholder="0.00"
                    className="pf-modal-input pl-12"
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {t('pendingDividends.taxDescription')}
                </p>
              </div>
              
              {/* Notes Input */}
              <div>
                <label className="pf-modal-label">
                  {t('fields.notes')} ({t('common.optional')})
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('pendingDividends.notesPlaceholder')}
                  rows={2}
                  className="pf-modal-textarea resize-none"
                />
              </div>
              
              {/* Net Amount Preview */}
              {taxAmount && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {t('pendingDividends.netAmount')}: {' '}
                    <span className="font-semibold">
                      {formatCurrency(
                        Number(acceptingDividend.gross_amount) - (parseFloat(taxAmount) || 0),
                        acceptingDividend.currency || portfolioCurrency
                      )}
                    </span>
                  </p>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="pf-modal-footer">
              <div />
              <div className="pf-modal-footer-actions">
              <button
                onClick={closeAcceptModal}
                className="pf-modal-button pf-modal-button--secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAccept}
                disabled={processingIds.has(acceptingDividend.id)}
                className="pf-modal-button pf-modal-button--primary"
              >
                <Check size={18} />
                {t('pendingDividends.confirmAccept')}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  )
}
