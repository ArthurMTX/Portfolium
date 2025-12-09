import { useState, FormEvent } from 'react'
import { Shield, AlertCircle } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { useTranslation } from 'react-i18next'

interface TwoFactorLoginProps {
  email: string
  password: string
  onSubmit: (token: string) => Promise<void>
  onBack: () => void
  darkMode?: boolean
}

export default function TwoFactorLogin({ email, password, onSubmit, onBack, darkMode = false }: TwoFactorLoginProps) {
  const { t } = useTranslation()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    
    const tokenLength = useBackupCode ? 14 : 6 // XXXX-XXXX-XXXX or 6 digits
    if (!token || (useBackupCode ? token.length < 12 : token.length !== 6)) {
      setError(t('twoFactor.invalidCodeLength'))
      return
    }

    setLoading(true)
    try {
      await onSubmit(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('twoFactor.verificationFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleTokenChange = (value: string) => {
    if (useBackupCode) {
      // Allow alphanumeric and hyphens for backup codes
      const formatted = value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
      setToken(formatted)
    } else {
      // Only digits for TOTP
      setToken(value.replace(/\D/g, ''))
    }
    setError('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className={`inline-block p-3 rounded-2xl mb-4 ${
          darkMode ? 'bg-pink-600' : 'bg-indigo-600'
        }`}>
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h2 className={`text-2xl font-bold ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {t('twoFactor.title')}
        </h2>
        <p className={`mt-2 text-sm ${
          darkMode ? 'text-neutral-400' : 'text-gray-600'
        }`}>
          {useBackupCode ? t('twoFactor.enterBackupCode') : t('twoFactor.enterCodeFromApp')}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          darkMode 
            ? 'bg-red-900/20 border border-red-800' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            darkMode ? 'text-red-400' : 'text-red-600'
          }`} />
          <p className={`text-sm ${
            darkMode ? 'text-red-300' : 'text-red-800'
          }`}>{error}</p>
        </div>
      )}

      {/* 2FA Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="token" className={`block text-sm font-medium mb-2 ${
            darkMode ? 'text-neutral-200' : 'text-gray-700'
          }`}>
            {useBackupCode ? t('twoFactor.backupCode') : t('twoFactor.authCode')}
          </label>
          <input
            id="token"
            type="text"
            inputMode={useBackupCode ? 'text' : 'numeric'}
            maxLength={useBackupCode ? 14 : 6}
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            className={`block w-full px-4 py-3 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
              darkMode
                ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                : 'border border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
            placeholder={useBackupCode ? 'XXXX-XXXX-XXXX' : '000000'}
            disabled={loading}
            autoFocus
          />
        </div>

        {/* Switch between TOTP and backup code */}
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode)
            setToken('')
            setError('')
          }}
          className={`text-sm ${
            darkMode ? 'text-pink-400 hover:text-pink-300' : 'text-pink-600 hover:text-pink-700'
          }`}
        >
          {useBackupCode ? t('twoFactor.useAuthApp') : t('twoFactor.useBackupCode')}
        </button>

        <button
          type="submit"
          disabled={loading || !token}
          className={`w-full px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            darkMode
              ? 'bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {loading ? <LoadingSpinner size="sm" /> : null}
          {loading ? t('common.verifying') : t('twoFactor.verify')}
        </button>
      </form>

      {/* Back button */}
      <button
        onClick={onBack}
        className={`w-full text-sm ${
          darkMode ? 'text-neutral-400 hover:text-neutral-300' : 'text-gray-600 hover:text-gray-700'
        }`}
      >
        {t('common.back')}
      </button>
    </div>
  )
}
