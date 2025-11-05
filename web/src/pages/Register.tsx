import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle, Moon, Sun } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { useTranslation } from 'react-i18next'
import AuthLanguageSwitcher from '../components/AuthLanguageSwitcher'

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
  const [darkMode, setDarkMode] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  // Check system preference or localStorage for dark mode
  useEffect(() => {
    const savedTheme = localStorage.getItem('auth-theme')
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (!darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('auth-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('auth-theme', 'light')
    }
  }

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
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
        darkMode 
          ? 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900'
          : 'bg-gradient-to-br from-green-100 via-white to-blue-100'
      }`}>
        <div className="max-w-md w-full">
          <div className={`rounded-2xl shadow-xl p-8 text-center ${
            darkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white'
          }`}>
            <div className={`inline-block p-4 rounded-full mb-4 ${
              darkMode ? 'bg-green-900/30' : 'bg-green-100'
            }`}>
              <CheckCircle className={`w-12 h-12 ${
                darkMode ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <h2 className={`text-2xl font-bold mb-4 ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {t('register.successTitle')}
            </h2>
            {emailEnabled ? (
              <p className={`mb-6 ${
                darkMode ? 'text-neutral-300' : 'text-gray-600'
              }`}>
                {t('register.successMessageWithEmail', { email })}
              </p>
            ) : (
              <p className={`mb-6 ${
                darkMode ? 'text-neutral-300' : 'text-gray-600'
              }`}>
                {t('register.successMessageNoEmail')}
              </p>
            )}
            <p className={`text-sm mb-6 ${
              darkMode ? 'text-neutral-500' : 'text-gray-500'
            }`}>
              {t('register.redirecting')}
            </p>
            <Link
              to="/login"
              className={`font-medium transition-colors ${
                darkMode
                  ? 'text-pink-400 hover:text-pink-300'
                  : 'text-indigo-600 hover:text-indigo-500'
              }`}
            >
              {t('register.goToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${
      darkMode 
        ? 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900' 
        : 'bg-gradient-to-br from-indigo-100 via-white to-pink-100'
    }`}>
      <div className="max-w-md w-full">
        {/* Theme and Language controls */}
        <div className="flex justify-end gap-2 mb-4">
          <AuthLanguageSwitcher darkMode={darkMode} />
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${
              darkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
            }`}
            aria-label={t('navigation.toggleDarkMode')}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className={`inline-block p-3 rounded-2xl mb-4 ${
            darkMode ? 'bg-pink-600' : 'bg-indigo-600'
          }`}>
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-3xl font-bold ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>{t('register.title')}</h1>
          <p className={`mt-2 ${
            darkMode ? 'text-neutral-400' : 'text-gray-600'
          }`}>{t('register.subtitle')}</p>
        </div>

        {/* Registration Form */}
        <div className={`rounded-2xl shadow-xl p-8 ${
          darkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white'
        }`}>
          {error && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('register.emailLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    darkMode
                      ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder={t('register.emailPlaceholder')}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('register.usernameLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    darkMode
                      ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder={t('register.usernamePlaceholder')}
                  disabled={loading}
                  minLength={3}
                  maxLength={50}
                />
              </div>
            </div>

            <div>
              <label htmlFor="fullName" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('register.fullNameLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    darkMode
                      ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder={t('register.fullNamePlaceholder')}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('register.passwordLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    darkMode
                      ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                  minLength={8}
                />
              </div>
              <p className={`mt-1 text-xs ${
                darkMode ? 'text-neutral-500' : 'text-gray-500'
              }`}>{t('register.passwordHint')}</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-neutral-200' : 'text-gray-700'
              }`}>
                {t('register.confirmPasswordLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${
                    darkMode ? 'text-neutral-500' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    darkMode
                      ? 'bg-neutral-900 border border-neutral-600 text-white placeholder-neutral-500'
                      : 'border border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                darkMode
                  ? 'bg-pink-600 hover:bg-pink-700 focus:ring-pink-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              }`}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  {t('register.creatingAccount')}
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  {t('register.createAccount')}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className={`text-sm ${
              darkMode ? 'text-neutral-400' : 'text-gray-600'
            }`}>
              {t('register.alreadyHaveAccount')}{' '}
              <Link
                to="/login"
                className={`font-medium transition-colors ${
                  darkMode
                    ? 'text-pink-400 hover:text-pink-300'
                    : 'text-indigo-600 hover:text-indigo-500'
                }`}
              >
                {t('register.signIn')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
