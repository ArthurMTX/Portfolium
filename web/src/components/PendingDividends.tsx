import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Check, X, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'
import api, { PendingDividendDTO, PendingDividendStatsDTO } from '../lib/api'
import { formatCurrency } from '../lib/formatUtils'
import { getAssetLogoUrl, handleLogoError } from '../lib/logoUtils'
import Toast from './Toast'

interface PendingDividendsProps {
  portfolioId: number
  portfolioCurrency: string
  onDividendAccepted?: () => void
}

export default function PendingDividends({ 
  portfolioId, 
  portfolioCurrency,
  onDividendAccepted 
}: PendingDividendsProps) {
  const { t } = useTranslation()
  const [pendingDividends, setPendingDividends] = useState<PendingDividendDTO[]>([])
  const [stats, setStats] = useState<PendingDividendStatsDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [convertedTotal, setConvertedTotal] = useState<number>(0)
  
  // Accept modal state
  const [acceptingDividend, setAcceptingDividend] = useState<PendingDividendDTO | null>(null)
  const [taxAmount, setTaxAmount] = useState('')
  const [notes, setNotes] = useState('')

  // Convert all dividends to portfolio currency
  const calculateConvertedTotal = useCallback(async () => {
    if (pendingDividends.length === 0) {
      setConvertedTotal(0)
      return
    }

    try {
      let total = 0
      
      for (const dividend of pendingDividends) {
        const dividendCurrency = dividend.currency || portfolioCurrency
        const amount = Number(dividend.gross_amount)
        
        if (dividendCurrency === portfolioCurrency) {
          total += amount
        } else {
          // Get today's exchange rate for conversion
          const today = new Date().toISOString().split('T')[0]
          const rateData = await api.getFxRateForDate(
            portfolioId,
            dividendCurrency,
            portfolioCurrency,
            today
          )
          total += amount * rateData.rate
        }
      }
      
      setConvertedTotal(total)
    } catch (error) {
      console.error('Failed to convert dividend amounts:', error)
      // Fallback: sum only matching currencies
      const fallbackTotal = pendingDividends
        .filter(d => d.currency === portfolioCurrency)
        .reduce((sum, d) => sum + Number(d.gross_amount), 0)
      setConvertedTotal(fallbackTotal)
    }
  }, [pendingDividends, portfolioId, portfolioCurrency])

  useEffect(() => {
    calculateConvertedTotal()
  }, [calculateConvertedTotal])

  const fetchPendingDividends = useCallback(async () => {
    if (!portfolioId) return
    
    setLoading(true)
    try {
      const [dividends, statsData] = await Promise.all([
        api.getPortfolioPendingDividends(portfolioId, 'PENDING'),
        api.getPendingDividendStats()
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
      <div className="mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <DollarSign size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">
                  {t('pendingDividends.title')}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('pendingDividends.noPending')}
                </p>
              </div>
            </div>
            <button
              onClick={handleFetchDividends}
              disabled={fetching}
              className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
            >
              <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
              {fetching ? t('common.loading') : t('pendingDividends.checkForDividends')}
            </button>
          </div>
        </div>
        
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="card overflow-hidden">
        {/* Header */}
        <div 
          className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-amber-200 dark:border-amber-800 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <DollarSign size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  {t('pendingDividends.title')}
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full">
                    {pendingDividends.length}
                  </span>
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t('pendingDividends.description')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {pendingDividends.length > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {t('pendingDividends.totalPending')}
                  </p>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    {formatCurrency(convertedTotal, portfolioCurrency)}
                  </p>
                </div>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleFetchDividends()
                }}
                disabled={fetching}
                className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
              >
                <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{t('pendingDividends.refresh')}</span>
              </button>
              
              {expanded ? (
                <ChevronUp size={20} className="text-neutral-500" />
              ) : (
                <ChevronDown size={20} className="text-neutral-500" />
              )}
            </div>
          </div>
        </div>

        {/* Pending Dividends List */}
        {expanded && (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {pendingDividends.map((dividend) => {
              const grossAmount = Number(dividend.gross_amount)
              const sharesHeld = Number(dividend.shares_held)
              const divPerShare = Number(dividend.dividend_per_share)
              const isProcessing = processingIds.has(dividend.id)
              
              return (
                <div 
                  key={dividend.id}
                  className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Asset Logo */}
                    <div className="flex-shrink-0">
                      <img
                        src={getAssetLogoUrl(dividend.asset_symbol || '')}
                        alt={dividend.asset_symbol || ''}
                        className="w-10 h-10 p-1"
                        onError={(e) => handleLogoError(e, dividend.asset_symbol || '', dividend.asset_name, null)}
                      />
                    </div>
                    
                    {/* Asset Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {dividend.asset_symbol}
                        </span>
                        {getStatusIcon(dividend.status)}
                      </div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                        {dividend.asset_name || dividend.asset_symbol}
                      </p>
                    </div>
                    
                    {/* Dividend Details */}
                    <div className="hidden md:block text-right">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {t('pendingDividends.exDate')}
                      </p>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {new Date(dividend.ex_dividend_date).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="hidden sm:block text-right">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {t('pendingDividends.shares')}
                      </p>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {parseFloat(sharesHeld.toFixed(8)).toString()}
                      </p>
                    </div>
                    
                    <div className="hidden sm:block text-right">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {t('pendingDividends.perShare')}
                      </p>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {formatCurrency(divPerShare, dividend.currency || portfolioCurrency, undefined, true)}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {t('pendingDividends.grossAmount')}
                      </p>
                      <p className="font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(grossAmount, dividend.currency || portfolioCurrency)}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openAcceptModal(dividend)}
                        disabled={isProcessing}
                        className="p-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 rounded-lg transition-colors disabled:opacity-50"
                        title={t('pendingDividends.accept')}
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => handleReject(dividend)}
                        disabled={isProcessing}
                        className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-800/50 text-red-700 dark:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                        title={t('pendingDividends.reject')}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Mobile details */}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500 dark:text-neutral-400 sm:hidden">
                    <span>{t('pendingDividends.exDate')}: {new Date(dividend.ex_dividend_date).toLocaleDateString()}</span>
                    <span>{t('pendingDividends.shares')}: {parseFloat(sharesHeld.toFixed(8)).toString()}</span>
                    <span>{t('pendingDividends.perShare')}: {formatCurrency(divPerShare, dividend.currency || portfolioCurrency, undefined, true)}</span>
                  </div>
                  
                  {/* Fetched info */}
                  <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeAcceptModal}>
          <div 
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {t('pendingDividends.acceptDividend')}
              </h3>
              <button
                onClick={closeAcceptModal}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-neutral-500 dark:text-neutral-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Dividend Summary */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={getAssetLogoUrl(acceptingDividend.asset_symbol || '')}
                    alt={acceptingDividend.asset_symbol || ''}
                    className="w-8 h-8 rounded object-contain bg-white dark:bg-neutral-600"
                    onError={(e) => handleLogoError(e, acceptingDividend.asset_symbol || '', acceptingDividend.asset_name, null)}
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
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
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
                    className="w-full pl-12 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {t('pendingDividends.taxDescription')}
                </p>
              </div>
              
              {/* Notes Input */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('fields.notes')} ({t('common.optional')})
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('pendingDividends.notesPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white resize-none"
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
            <div className="flex gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <button
                onClick={closeAcceptModal}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAccept}
                disabled={processingIds.has(acceptingDividend.id)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {t('pendingDividends.confirmAccept')}
              </button>
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
    </div>
  )
}
