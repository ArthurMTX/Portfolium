import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { api, TwoFactorStatusResponse } from '../lib/api'
import TwoFactorSetup from './TwoFactorSetup'
import LoadingSpinner from './LoadingSpinner'
import ConfirmModal from './ConfirmModal'
import { useTranslation } from 'react-i18next'

export default function TwoFactorSettings() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<TwoFactorStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [showDisableModal, setShowDisableModal] = useState(false)
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableToken, setDisableToken] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const data = await api.get2FAStatus()
      setStatus(data)
    } catch (err) {
      console.error('Failed to load 2FA status:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSetupComplete = async () => {
    setShowSetup(false)
    await loadStatus()
    setMessage({ type: 'success', text: t('twoFactor.enabledSuccessfully') })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleDisable = async () => {
    if (!disablePassword) {
      setMessage({ type: 'error', text: t('twoFactor.passwordRequired') })
      return
    }

    setDisabling(true)
    try {
      await api.disable2FA(disablePassword, disableToken || undefined)
      await loadStatus()
      setShowDisableModal(false)
      setDisablePassword('')
      setDisableToken('')
      setMessage({ type: 'success', text: t('twoFactor.disabledSuccessfully') })
      setTimeout(() => setMessage(null), 5000)
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : t('twoFactor.disableFailed')
      })
    } finally {
      setDisabling(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    setRegenerating(true)
    try {
      const data = await api.regenerateBackupCodes()
      setShowRegenerateModal(false)
      
      // Download backup codes automatically
      const content = data.backup_codes.join('\n')
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'portfolium-new-backup-codes.txt'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      await loadStatus()
      setMessage({ type: 'success', text: t('twoFactor.backupCodesRegenerated') })
      setTimeout(() => setMessage(null), 5000)
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : t('twoFactor.regenerateFailed')
      })
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (showSetup) {
    return (
      <TwoFactorSetup
        onComplete={handleSetupComplete}
        onCancel={() => setShowSetup(false)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Status Message */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 2FA Status Card */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              status?.enabled 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-neutral-100 dark:bg-neutral-700'
            }`}>
              <Shield className={`w-6 h-6 ${
                status?.enabled 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-neutral-500 dark:text-neutral-400'
              }`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {t('twoFactor.title')}
              </h3>
              <p className={`text-sm ${
                status?.enabled 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}>
                {status?.enabled ? t('twoFactor.enabled') : t('twoFactor.disabled')}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          {status?.enabled 
            ? t('twoFactor.enabledDescription')
            : t('twoFactor.disabledDescription')}
        </p>

        {status?.enabled ? (
          <div className="space-y-4">
            {/* Backup codes info */}
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <p className="text-sm">
                {t('twoFactor.backupCodesRemaining')}: <strong>{status.backup_codes_remaining}</strong>
              </p>
              {status.backup_codes_remaining < 3 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  {t('twoFactor.lowBackupCodesWarning')}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowRegenerateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('twoFactor.regenerateBackupCodes')}
              </button>
              <button
                onClick={() => setShowDisableModal(true)}
                className="btn btn-danger"
              >
                {t('twoFactor.disable')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowSetup(true)}
            className="btn btn-primary"
          >
            {t('twoFactor.enable')}
          </button>
        )}
      </div>

      {/* Disable 2FA Modal */}
      {showDisableModal && (
        <ConfirmModal
          isOpen={showDisableModal}
          onClose={() => {
            setShowDisableModal(false)
            setDisablePassword('')
            setDisableToken('')
          }}
          onConfirm={handleDisable}
          title={t('twoFactor.disableConfirmTitle')}
          message={t('twoFactor.disableConfirmMessage')}
          confirmText={t('twoFactor.disable')}
          confirmButtonClass="btn-danger"
          loading={disabling}
        >
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">
              {t('profile.currentPasswordField')}
            </label>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="input w-full"
              placeholder="••••••••"
              autoFocus
            />
          </div>
        </ConfirmModal>
      )}

      {/* Regenerate Backup Codes Modal */}
      {showRegenerateModal && (
        <ConfirmModal
          isOpen={showRegenerateModal}
          onClose={() => setShowRegenerateModal(false)}
          onConfirm={handleRegenerateBackupCodes}
          title={t('twoFactor.regenerateBackupCodesTitle')}
          message={t('twoFactor.regenerateBackupCodesMessage')}
          confirmText={t('twoFactor.regenerate')}
          confirmButtonClass="btn-primary"
          loading={regenerating}
        />
      )}
    </div>
  )
}
