import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { translateApiError } from '@/shared/lib/errorUtils'
import { useTranslation } from 'react-i18next'
import AuthPageShell from '@/features/auth/components/AuthPageShell'
import useAuthTheme from '@/features/auth/hooks/useAuthTheme'

export default function VerifyEmail() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const { darkMode, toggleDarkMode } = useAuthTheme()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) return

      try {
        await api.verifyEmail(token)
        setSuccess(true)
        setTimeout(() => {
          navigate('/login')
        }, 5000)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to verify email'
        setError(translateApiError(message, t))
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      verifyEmail()
    } else {
      setError(translateApiError('Invalid or missing verification token', t))
      setLoading(false)
    }
  }, [token, t, navigate])

  if (loading) {
    return (
      <AuthPageShell darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="auth-card auth-card--center">
          <div className="auth-success-copy">
            <h1 className="pf-section-title auth-card__title">
              {t('verifyEmail.verifying')}
            </h1>
            <p className="pf-section-description auth-card__description">
              {t('verifyEmail.verifyingMessage')}
            </p>
          </div>
        </div>
      </AuthPageShell>
    )
  }

  if (success) {
    return (
      <AuthPageShell darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="auth-card auth-card--center">
          <div className="auth-success-copy">
            <h1 className="pf-section-title auth-card__title">
              {t('verifyEmail.successTitle')}
            </h1>
            <p className="pf-section-description auth-card__description">
              {t('verifyEmail.successMessage')}
            </p>
          </div>

          <div className="auth-message auth-message--center">
            <p>{t('verifyEmail.redirecting')}</p>
          </div>

          <Link to="/login" className="pf-button pf-button--primary auth-submit">
            {t('verifyEmail.signInNow')}
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="auth-card auth-card--center">

        <div className="auth-success-copy">
          <h1 className="pf-section-title auth-card__title">
            {t('verifyEmail.errorTitle')}
          </h1>
          <p className="pf-section-description auth-card__description">
            {error || t('verifyEmail.errorMessageDefault')}
          </p>
        </div>

        <div className="auth-action-stack">
          <Link to="/login" className="pf-button pf-button--primary auth-submit">
            {t('verifyEmail.goToLogin')}
          </Link>
          <Link to="/register" className="auth-link-inline">
            {t('verifyEmail.createNewAccount')}
          </Link>
        </div>
      </div>
    </AuthPageShell>
  )
}
