import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthContext'
import { AlertCircle, Lock, LogIn, Mail } from 'lucide-react'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import TwoFactorLogin from '@/features/auth/components/TwoFactorLogin'
import { useTranslation } from 'react-i18next'
import { translateApiError } from '@/shared/lib/errorUtils'
import { api } from '@/api'
import AuthPageShell from '@/features/auth/components/AuthPageShell'
import useAuthTheme from '@/features/auth/hooks/useAuthTheme'

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const { darkMode, toggleDarkMode } = useAuthTheme()

  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  // Redirect if already logged in
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
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password'
      
      // Check if 2FA is required
      if (message.includes('Two-factor authentication token required') || 
          message.includes('2FA') ||
          message.includes('two-factor')) {
        setRequires2FA(true)
        setError('')
      } else {
        setError(translateApiError(message, t))
      }
    } finally {
      setLoading(false)
    }
  }

  const handle2FASubmit = async (token: string) => {
    const response = await api.loginWith2FA(email, password, token)
    localStorage.setItem('auth_token', response.access_token)
    
    // Manually trigger auth context refresh (similar to login flow)
    window.location.href = from
  }

  const handleBack = () => {
    setRequires2FA(false)
    setPassword('')
    setError('')
  }

  return (
    <AuthPageShell darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="auth-card">
        {requires2FA ? (
          <TwoFactorLogin
            onSubmit={handle2FASubmit}
            onBack={handleBack}
          />
        ) : (
          <>
            <div className="auth-card__header">
              <p className="pf-page-kicker">{t('login.signIn')}</p>
              <h1 className="pf-section-title auth-card__title">{t('login.title')}</h1>
              <p className="pf-section-description auth-card__description">{t('login.description')}</p>
            </div>

            {error && (
              <div className="auth-message is-error" role="alert">
                <AlertCircle aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-field" htmlFor="email">
                <span>{t('login.emailLabel')}</span>
                <span className="auth-field__control">
                  <Mail aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('login.emailPlaceholder')}
                    disabled={loading}
                  />
                </span>
              </label>

              <label className="auth-field" htmlFor="password">
                <span>{t('login.passwordLabel')}</span>
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
              </label>

              <div className="auth-form__meta">
                <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="pf-button pf-button--primary auth-submit"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" color="white" />
                    {t('login.signingIn')}
                  </>
                ) : (
                  <>
                    <LogIn aria-hidden="true" />
                    {t('login.signIn')}
                  </>
                )}
              </button>
            </form>

            <div className="auth-card__footer">
              <span>{t('login.newToPortfolium')}</span>
              <Link to="/register">
                {t('login.createAccount')}
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="auth-terms">
        {t('login.termsPrefix')}{' '}
        <a href="#">{t('login.termsOfService')}</a>{' '}
        {t('login.and')}{' '}
        <a href="#">{t('login.privacyPolicy')}</a>
      </p>
    </AuthPageShell>
  )
}
