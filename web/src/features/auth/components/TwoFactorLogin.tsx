import { useState, FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useTranslation } from 'react-i18next'

interface TwoFactorLoginProps {
  onSubmit: (token: string) => Promise<void>
  onBack: () => void
}

export default function TwoFactorLogin({ onSubmit, onBack }: TwoFactorLoginProps) {
  const { t } = useTranslation()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    
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
    <div className="auth-two-factor">
      <div className="auth-card__header">
        <p className="pf-page-kicker">{t('twoFactor.verify')}</p>
        <h2 className="pf-section-title auth-card__title">{t('twoFactor.title')}</h2>
        <p className="pf-section-description auth-card__description">
          {useBackupCode ? t('twoFactor.enterBackupCode') : t('twoFactor.enterCodeFromApp')}
        </p>
      </div>

      {error && (
        <div className="auth-message is-error" role="alert">
          <AlertCircle aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field" htmlFor="token">
          <span>{useBackupCode ? t('twoFactor.backupCode') : t('twoFactor.authCode')}</span>
          <input
            id="token"
            type="text"
            inputMode={useBackupCode ? 'text' : 'numeric'}
            maxLength={useBackupCode ? 14 : 6}
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            className="auth-token-input"
            placeholder={useBackupCode ? 'XXXX-XXXX-XXXX' : '000000'}
            disabled={loading}
            autoFocus
          />
        </label>

        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode)
            setToken('')
            setError('')
          }}
          className="auth-link-button"
        >
          {useBackupCode ? t('twoFactor.useAuthApp') : t('twoFactor.useBackupCode')}
        </button>

        <button
          type="submit"
          disabled={loading || !token}
          className="pf-button pf-button--primary auth-submit"
        >
          {loading ? <LoadingSpinner size="sm" color="white" /> : null}
          {loading ? t('common.verifying') : t('twoFactor.verify')}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="auth-secondary-action"
      >
        {t('common.back')}
      </button>
    </div>
  )
}
