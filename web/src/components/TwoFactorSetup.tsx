import { useState, useEffect } from 'react'
import { Shield, Copy, CheckCircle, Download, X } from 'lucide-react'
import { api, TwoFactorSetupResponse } from '../lib/api'
import LoadingSpinner from './LoadingSpinner'
import { useTranslation } from 'react-i18next'

interface TwoFactorSetupProps {
  onComplete: () => void
  onCancel: () => void
}

export default function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'loading' | 'scan' | 'verify' | 'backup'>('loading')
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedBackup, setCopiedBackup] = useState<number | null>(null)
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const [hasCopiedAny, setHasCopiedAny] = useState(false)

  const initializeSetup = async () => {
    try {
      const data = await api.setup2FA()
      setSetupData(data)
      setStep('scan')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize 2FA setup')
    }
  }

  // Initialize setup on mount
  useEffect(() => {
    initializeSetup()
  }, [])

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t('twoFactor.invalidCodeLength'))
      return
    }

    try {
      await api.verify2FA(verificationCode)
      setStep('backup')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('twoFactor.verificationFailed'))
    }
  }

  const copyToClipboard = (text: string, type: 'secret' | 'backup', index?: number) => {
    navigator.clipboard.writeText(text)
    if (type === 'secret') {
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    } else if (type === 'backup' && index !== undefined) {
      setCopiedBackup(index)
      setTimeout(() => setCopiedBackup(null), 2000)
      setHasCopiedAny(true)
    }
  }

  const downloadBackupCodes = () => {
    if (!setupData) return
    
    const content = setupData.backup_codes.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'portfolium-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setHasDownloaded(true)
  }

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!setupData) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error || t('twoFactor.setupError')}</p>
          <button
            onClick={onCancel}
            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-neutral-700 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-600"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Shield size={20} className="text-pink-600 dark:text-pink-400" />
          {step === 'backup' ? t('twoFactor.backupCodes') : t('twoFactor.setup')}
        </h2>
        {step !== 'backup' && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-4 max-w-xl">
          {/* Step indicator */}
          <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="px-3 py-1 bg-pink-600 dark:bg-pink-500 text-white rounded-full font-medium">1</span>
            <span>{t('twoFactor.stepScan')}</span>
          </div>

          {/* QR Code */}
          <div className="card p-4">
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              {t('twoFactor.scanInstructions')}
            </p>
            <div className="flex justify-center">
              <img
                src={setupData.qr_code}
                alt="QR Code"
                className="w-64 h-64 border border-neutral-300 dark:border-neutral-600 rounded-lg"
              />
            </div>
          </div>

          {/* Manual entry */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              {t('twoFactor.manualEntry')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 input text-sm font-mono">
                {setupData.secret}
              </code>
              <button
                onClick={() => copyToClipboard(setupData.secret, 'secret')}
                className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                title={t('common.copy')}
              >
                {copiedSecret ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                )}
              </button>
            </div>
          </div>

          {/* Verification */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('twoFactor.enterCode')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => {
                setError('')
                setVerificationCode(e.target.value.replace(/\D/g, ''))
              }}
              className="input w-full text-center text-2xl tracking-widest font-mono"
              placeholder="000000"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleVerify}
              disabled={verificationCode.length !== 6}
              className={`btn w-full ${verificationCode.length === 6 ? 'btn-primary' : 'btn-disabled'}`}
            >
              {t('twoFactor.verify')}
            </button>
          </div>
        </div>
      )}

      {step === 'backup' && (
        <div className="space-y-4 max-w-xl">
          {/* Success message */}
          <div className="p-3 rounded-lg text-sm bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium">{t('twoFactor.setupSuccess')}</span>
            </div>
          </div>

          {/* Backup codes */}
          <div>
            <h3 className="text-lg font-semibold mb-1">
              {t('twoFactor.saveBackupCodes')}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {t('twoFactor.backupCodesInstructions')}
            </p>

            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {setupData.backup_codes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 card"
                  >
                    <code className="text-sm font-mono">{code}</code>
                    <button
                      onClick={() => copyToClipboard(code, 'backup', index)}
                      className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                    >
                      {copiedBackup === index ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={downloadBackupCodes}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t('twoFactor.downloadCodes')}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onComplete}
              disabled={!hasDownloaded && !hasCopiedAny}
              className={`btn w-full ${hasDownloaded || hasCopiedAny ? 'btn-primary' : 'btn-disabled'}`}
            >
              {t('common.done')}
            </button>
            {!hasDownloaded && !hasCopiedAny && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                {t('twoFactor.mustSaveBackupCodes')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
