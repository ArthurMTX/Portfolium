import { useState, useEffect } from 'react'
import { PlusCircle, Edit2, Trash2, Folder, TrendingUp, X, Globe, Link2, Copy, Check, GlobeLock } from 'lucide-react'
import api from '../lib/api'
import usePortfolioStore from '../store/usePortfolioStore'
import { useTranslation } from 'react-i18next'

interface Portfolio {
  id: number
  name: string
  base_currency: string
  description: string | null
  is_public: boolean
  share_token: string
  created_at: string
}

export default function Portfolios() {
  const { t } = useTranslation()
  const portfolios = usePortfolioStore((state) => state.portfolios)
  const setPortfolios = usePortfolioStore((state) => state.setPortfolios)
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId)
  const setActivePortfolio = usePortfolioStore((state) => state.setActivePortfolio)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [shareModal, setShareModal] = useState<Portfolio | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('EUR')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    fetchPortfolios()
  }, [])

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (showModal || deleteConfirm || shareModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showModal, deleteConfirm, shareModal])

  const fetchPortfolios = async () => {
    setLoading(true)
    try {
      const data = await api.getPortfolios()
      setPortfolios(data) // Update global store

      // Validate that activePortfolioId belongs to the current user's portfolios
      const portfolioIds = data.map(p => p.id)
      const activeIsValid = activePortfolioId && portfolioIds.includes(activePortfolioId)

      // If current active portfolio doesn't exist in user's portfolios, reset it
      if (!activeIsValid && data.length > 0) {
        setActivePortfolio(data[0].id)
      } else if (!activeIsValid && data.length === 0) {
        // No portfolios at all, clear active
        setActivePortfolio(null as any)
      }
    } catch (error) {
      console.error('Failed to fetch portfolios:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (portfolio: Portfolio) => {
    setEditingPortfolio(portfolio)
    setName(portfolio.name)
    setBaseCurrency(portfolio.base_currency)
    setDescription(portfolio.description || '')
    setIsPublic(portfolio.is_public)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPortfolio(null)
    resetForm()
  }

  const resetForm = () => {
    setName('')
    setBaseCurrency('EUR')
    setDescription('')
    setIsPublic(false)
    setFormError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')

    try {
      const portfolioData = {
        name,
        base_currency: baseCurrency,
        description: description || undefined,
        is_public: isPublic
      }

      if (editingPortfolio) {
        // Update existing portfolio
        await api.updatePortfolio(editingPortfolio.id, portfolioData)
      } else {
        // Create new portfolio
        await api.createPortfolio(portfolioData)
      }

      await fetchPortfolios()
      closeModal()
    } catch (err: any) {
      setFormError(err.message || 'Operation failed')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (portfolioId: number) => {
    try {
      await api.deletePortfolio(portfolioId)
      await fetchPortfolios()
      setDeleteConfirm(null)

      // If deleted active portfolio, select another one
      if (activePortfolioId === portfolioId) {
        const remaining = portfolios.filter(p => p.id !== portfolioId)
        if (remaining.length > 0) {
          setActivePortfolio(remaining[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to delete portfolio:', err)
    }
  }

  const handleSelectPortfolio = (portfolioId: number) => {
    setActivePortfolio(portfolioId)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getPublicShareUrl = (shareToken: string) => {
    return `${window.location.origin}/p/${shareToken}`
  }

  const handleCopyLink = async (shareToken: string) => {
    try {
      await navigator.clipboard.writeText(getPublicShareUrl(shareToken))
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleTogglePublic = async (portfolio: Portfolio) => {
    try {
      const updated = await api.updatePortfolio(portfolio.id, {
        name: portfolio.name,
        base_currency: portfolio.base_currency,
        description: portfolio.description || undefined,
        is_public: !portfolio.is_public
      })
      await fetchPortfolios()
      // Update the share modal with the updated portfolio data
      if (shareModal && shareModal.id === portfolio.id) {
        setShareModal(updated)
      }
    } catch (err) {
      console.error('Failed to toggle public status:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Folder className="text-pink-600" size={28} />
            {t('portfolios.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            {t('portfolios.description')}
          </p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2 text-sm sm:text-base px-3 py-2 self-start sm:self-auto">
          <PlusCircle size={16} />
          <span className="hidden sm:inline">{t('portfolios.create')}</span>
          <span className="sm:hidden">{t('common.create')}</span>
        </button>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500 dark:text-neutral-400">{t('portfolios.loading')}</p>
        </div>
      ) : portfolios.length === 0 ? (
        <div className="card p-12 text-center">
          <Folder size={48} className="mx-auto text-neutral-400 dark:text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            {t('emptyStates.noPortfolios')}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t('emptyStates.noPortfoliosInfo')}
          </p>
          <button onClick={openAddModal} className="btn-primary inline-flex items-center gap-2">
            <PlusCircle size={18} />
            {t('emptyStates.noPortfoliosCreate')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className={`card p-6 cursor-pointer transition-all hover:shadow-lg ${activePortfolioId === portfolio.id
                ? 'ring-2 ring-pink-500 bg-pink-50 dark:bg-pink-900/10'
                : ''
                }`}
              onClick={() => handleSelectPortfolio(portfolio.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Folder
                      size={20}
                      className={
                        activePortfolioId === portfolio.id
                          ? 'text-pink-500'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }
                    />
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                      {portfolio.name}
                    </h3>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {portfolio.base_currency}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShareModal(portfolio)
                    }}
                    className={`p-2 rounded transition-colors ${
                      portfolio.is_public
                        ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                        : 'text-neutral-400 hover:bg-neutral-50 dark:text-neutral-500 dark:hover:bg-neutral-800'
                    }`}
                    title={portfolio.is_public ? t('portfolios.publicEnabled') : t('portfolios.publicDisabled')}
                  >
                    {portfolio.is_public ? <Globe size={16} /> : <GlobeLock size={16} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditModal(portfolio)
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm(portfolio.id)
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {portfolio.description && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-2">
                  {portfolio.description}
                </p>
              )}

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t('portfolios.createdAt')} {formatDate(portfolio.created_at)}
                </div>
              </div>

              {activePortfolioId === portfolio.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs font-medium rounded">
                    <TrendingUp size={12} />
                    {t('common.active')}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {editingPortfolio ? t('portfolios.edit') : t('portfolios.create')}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('portfolios.nameField')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  placeholder={t('portfolios.namePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('portfolios.currencyField')} *
                </label>
                <select
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CHF">CHF (Fr)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('portfolios.descriptionField')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  rows={3}
                  placeholder={t('portfolios.descriptionPlaceholder')}
                />
              </div>

              <div className="flex items-center justify-between py-3 px-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe size={20} className={isPublic ? 'text-green-600 dark:text-green-400' : 'text-neutral-400'} />
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {t('portfolios.publicSharing')}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t('portfolios.publicSharingHint')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPublic ? 'bg-green-600' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-neutral-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {formLoading ? t('common.saving') : editingPortfolio ? t('common.save') : t('portfolios.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              {t('portfolios.delete')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {t('portfolios.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {t('portfolios.sharePortfolio')}
              </h3>
              <button
                onClick={() => {
                  setShareModal(null)
                  setCopiedLink(false)
                }}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Public toggle */}
              <div className="flex items-center justify-between py-3 px-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {shareModal.is_public ? (
                    <Globe size={20} className="text-green-600 dark:text-green-400" />
                  ) : (
                    <GlobeLock size={20} className="text-neutral-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {shareModal.is_public ? t('portfolios.publicEnabled') : t('portfolios.publicDisabled')}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {shareModal.is_public ? t('portfolios.publicEnabledHint') : t('portfolios.publicDisabledHint')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleTogglePublic(shareModal)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    shareModal.is_public ? 'bg-green-600' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      shareModal.is_public ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Share link (only if public) */}
              {shareModal.is_public && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('portfolios.shareLink')}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <Link2 size={16} className="text-neutral-400 flex-shrink-0" />
                      <span className="text-sm text-neutral-600 dark:text-neutral-300 break-all">
                        {getPublicShareUrl(shareModal.share_token)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyLink(shareModal.share_token)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                        copiedLink
                          ? 'bg-green-600 text-white'
                          : 'bg-pink-600 hover:bg-pink-700 text-white'
                      }`}
                    >
                      {copiedLink ? (
                        <>
                          <Check size={16} />
                          {t('common.copied')}
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          {t('common.copy')}
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t('portfolios.shareLinkHint')}
                  </p>
                </div>
              )}

              {/* Preview button */}
              {shareModal.is_public && (
                <a
                  href={getPublicShareUrl(shareModal.share_token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Globe size={16} />
                  {t('portfolios.previewPublicPage')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

