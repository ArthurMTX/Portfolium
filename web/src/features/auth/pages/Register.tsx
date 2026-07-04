import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthContext'
import { api } from '@/api'
import { AlertCircle, CheckCircle, Lock, Mail, User, UserPlus } from 'lucide-react'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useTranslation } from 'react-i18next'
import { translateApiError } from '@/shared/lib/errorUtils'
import AuthPageShell from '@/features/auth/components/AuthPageShell'
import useAuthTheme from '@/features/auth/hooks/useAuthTheme'

export default function Register() {
  const { t, i18n } = useTranslation()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(true) // Default to true
  const { darkMode, toggleDarkMode } = useAuthTheme()

  const { register, user } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  // Check if email system is enabled
  useEffect(() => {
    const checkEmailStatus = async () => {
      try {
        const health = await api.healthCheck()
        setEmailEnabled(health.email_enabled)
      } catch (error) {
        console.error('Failed to check email status:', error)
        // Default to true if we can't check
        setEmailEnabled(true)
      }
    }
    checkEmailStatus()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'))
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError(t('register.passwordMinLength'))
      setLoading(false)
      return
    }

    try {
      await register(email, username, password, fullName || undefined, i18n.language)
      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('register.registrationFailed')
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
              {t('register.successTitle')}
            </h1>
            {emailEnabled ? (
              <p className="pf-section-description auth-card__description">
                {t('register.successMessageWithEmail', { email })}
              </p>
            ) : (
              <p className="pf-section-description auth-card__description">
                {t('register.successMessageNoEmail')}
              </p>
            )}
          </div>

          <div className="auth-message auth-message--center">
            <p>{t('register.redirecting')}</p>
          </div>

          <Link to="/login" className="pf-button pf-button--primary auth-submit">
            {t('register.goToLogin')}
          </Link>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="auth-card">
        <div className="auth-card__header">
          <p className="pf-page-kicker">{t('register.createAccount')}</p>
          <h1 className="pf-section-title auth-card__title">{t('register.title')}</h1>
          <p className="pf-section-description auth-card__description">{t('register.subtitle')}</p>
        </div>

        {error && (
          <div className="auth-message is-error" role="alert">
            <AlertCircle aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field" htmlFor="email">
            <span>{t('register.emailLabel')}</span>
            <span className="auth-field__control">
              <Mail aria-hidden="true" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('register.emailPlaceholder')}
                disabled={loading}
              />
            </span>
          </label>

          <label className="auth-field" htmlFor="username">
            <span>{t('register.usernameLabel')}</span>
            <span className="auth-field__control">
              <User aria-hidden="true" />
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('register.usernamePlaceholder')}
                disabled={loading}
                minLength={3}
                maxLength={50}
              />
            </span>
          </label>

          <label className="auth-field" htmlFor="fullName">
            <span>{t('register.fullNameLabel')}</span>
            <span className="auth-field__control">
              <User aria-hidden="true" />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('register.fullNamePlaceholder')}
                disabled={loading}
              />
            </span>
          </label>

          <label className="auth-field" htmlFor="password">
            <span>{t('register.passwordLabel')}</span>
            <span className="auth-field__control">
              <Lock aria-hidden="true" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                minLength={8}
              />
            </span>
            <span className="auth-field__hint">{t('register.passwordHint')}</span>
          </label>

          <label className="auth-field" htmlFor="confirmPassword">
            <span>{t('register.confirmPasswordLabel')}</span>
            <span className="auth-field__control">
              <Lock aria-hidden="true" />
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                minLength={8}
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
                {t('register.creatingAccount')}
              </>
            ) : (
              <>
                <UserPlus aria-hidden="true" />
                {t('register.createAccount')}
              </>
            )}
          </button>
        </form>

        <div className="auth-card__footer">
          <span>{t('register.alreadyHaveAccount')}</span>
          <Link to="/login">
            {t('register.signIn')}
          </Link>
        </div>
      </div>
    </AuthPageShell>
  )
}
