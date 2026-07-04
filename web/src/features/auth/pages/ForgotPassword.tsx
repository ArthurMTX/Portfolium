import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { AlertCircle, ArrowLeft, CheckCircle, Mail } from 'lucide-react'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { translateApiError } from '@/shared/lib/errorUtils'
import { useTranslation, Trans } from 'react-i18next'
import { useAuth } from '@/app/providers/AuthContext'
import AuthPageShell from '@/features/auth/components/AuthPageShell'
import useAuthTheme from '@/features/auth/hooks/useAuthTheme'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { darkMode, toggleDarkMode } = useAuthTheme()

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.forgotPassword(email)
      setSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email'
      setError(translateApiError(message, t))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthPageShell darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="auth-card auth-card--center">
          <div className="auth-success-copy">
            <h1 className="pf-section-title auth-card__title">
              {t('forgotPassword.successTitle')}
            </h1>
            <p className="pf-section-description auth-card__description">
              <Trans
                i18nKey="forgotPassword.successMessage"
                values={{ email }}
                components={{ strong: <strong /> }}
              />
            </p>
          </div>

          <div className="auth-message auth-message--center">
            <p>{t('forgotPassword.expiryMessage')}</p>
          </div>

          <Link to="/login" className="auth-link-inline">
            <ArrowLeft aria-hidden="true" />
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="auth-card">
        <div className="auth-card__header">
          <p className="pf-page-kicker">{t('forgotPassword.sendResetInstructions')}</p>
          <h1 className="pf-section-title auth-card__title">{t('forgotPassword.title')}</h1>
          <p className="pf-section-description auth-card__description">{t('forgotPassword.subtitle')}</p>
        </div>

        {error && (
          <div className="auth-message is-error" role="alert">
            <AlertCircle aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field" htmlFor="email">
            <span>{t('forgotPassword.emailLabel')}</span>
            <span className="auth-field__control">
              <Mail aria-hidden="true" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('forgotPassword.emailPlaceholder')}
                disabled={loading}
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="pf-button pf-button--primary auth-submit"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                {t('forgotPassword.sending')}
              </>
            ) : (
              t('forgotPassword.sendResetInstructions')
            )}
          </button>
        </form>

        <div className="auth-card__footer">
          <Link to="/login" className="auth-link-inline">
            <ArrowLeft aria-hidden="true" />
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </div>
    </AuthPageShell>
  )
}
