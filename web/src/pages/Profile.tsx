import { useEffect, useState } from 'react'
import { MailCheck, Shield, Trash2, User as UserIcon, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { translateApiError } from '../lib/errorUtils'
import TwoFactorSettings from '../components/TwoFactorSettings'

type ProfileTab = 'profile' | 'security' | 'danger';

export default function Profile() {
  const { user, refreshUser, logout } = useAuth()
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Resend verification
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  // Delete account
  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canDelete = confirmDelete.trim().toLowerCase() === 'delete account'

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setUsername(user.username || '')
      setEmail(user.email || '')
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage(null)
    try {
      const payload: Record<string, string> = {}
      if (fullName !== (user.full_name || '')) payload.full_name = fullName
      if (username !== user.username) payload.username = username
      if (email !== user.email) payload.email = email

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'success', text: t('profile.nothingToUpdate') })
        return
      }

      await api.updateCurrentUser(payload)
      await refreshUser()
      const emailChanged = 'email' in payload
      setMessage({
        type: 'success',
        text: emailChanged
          ? t('profile.profileUpdatedEmailChanged')
          : t('profile.profileUpdated'),
      })
    } catch (err: unknown) {
      const text = err instanceof Error ? translateApiError(err.message, t) : t('profile.failedToUpdateProfile')
      setMessage({ type: 'error', text })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMessage(null)
    if (!newPassword || newPassword.length < 8) {
      setPwdMessage({ type: 'error', text: t('profile.newPasswordMinLength') })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: 'error', text: t('profile.newPasswordMismatch') })
      return
    }
    setChangingPwd(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setPwdMessage({ type: 'success', text: t('profile.passwordSuccessfullyChanged') })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const text = err instanceof Error ? translateApiError(err.message, t) : t('profile.failedToChangePassword')
      setPwdMessage({ type: 'error', text })
    } finally {
      setChangingPwd(false)
      setTimeout(() => setPwdMessage(null), 4000)
    }
  }

  const handleResendVerification = async () => {
    if (!email) return
    setResending(true)
    setResendMsg(null)
    try {
      const res = await api.resendVerification(email)
      setResendMsg(res.message)
    } catch (err: unknown) {
      const text = err instanceof Error ? translateApiError(err.message, t) : t('profile.failedToSendVerification')
      setResendMsg(text)
    } finally {
      setResending(false)
      setTimeout(() => setResendMsg(null), 4000)
    }
  }

  const handleDeleteAccount = async () => {
    if (!canDelete) return
    setDeleting(true)
    try {
      await api.deleteAccount()
      // Log out and redirect to login
      logout()
    } catch (err: unknown) {
      const text = err instanceof Error ? translateApiError(err.message, t) : t('profile.failedToDeleteAccount')
      setMessage({ type: 'error', text })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <UserIcon className="text-pink-600" size={28} />
          {t('profile.title')}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
          {t('profile.description')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto scrollbar-hide">
        <nav className="flex gap-2 sm:gap-4 min-w-max">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <UserIcon size={14} className="inline mr-1" />
            {t('profile.profileTab')}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Shield size={14} className="inline mr-1" />
            {t('profile.securityTab')}
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'danger'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Trash2 size={14} className="inline mr-1" />
            {t('profile.dangerTab')}
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card p-6">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <UserIcon size={20} className="text-pink-600 dark:text-pink-400" />
          {t('profile.profileInformation')}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('profile.profileDescription')}</p>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.nameField')}</label>
            <input
              className="input w-full"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('profile.namePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.usernameField')}</label>
            <input
              className="input w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('profile.usernamePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.emailField')}</label>
            <input
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('profile.emailPlaceholder')}
            />
            {user && !user.is_verified && (
              <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <MailCheck size={14} /> {t('profile.emailNotVerified')}
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
                >
                  <RefreshCw size={12} /> {resending ? t('profile.resendingVerification') : t('profile.resendVerification')}
                </button>
                {resendMsg && <span className="ml-2">{resendMsg}</span>}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button type="submit" disabled={saving} className={`btn ${saving ? 'btn-disabled' : 'btn-primary'}`}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card p-6">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Shield size={20} className="text-pink-600 dark:text-pink-400" />
          {t('profile.securityInformation')}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('profile.securityDescription')}</p>

        {pwdMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              pwdMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            {pwdMessage.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.currentPasswordField')}</label>
            <input
              type="password"
              className="input w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.newPasswordField')}</label>
            <input
              type="password"
              className="input w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('profile.newPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.confirmNewPasswordField')}</label>
            <input
              type="password"
              className="input w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('profile.confirmNewPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={changingPwd} className={`btn ${changingPwd ? 'btn-disabled' : 'btn-primary'}`}>
              {changingPwd ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>

        {/* Two-Factor Authentication */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-neutral-700">
          <TwoFactorSettings />
        </div>
      </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="card p-6 border border-red-300/40 bg-red-50 dark:bg-red-950/30">
        <h2 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
          <Trash2 size={20} />
          {t('profile.deleteAccount')}
        </h2>
        <p className="text-red-800 dark:text-red-200 mb-4">
          {t('profile.deleteDescription')}
        </p>
        <label className="block text-sm text-red-800 dark:text-red-200 mb-2">{t('profile.deleteConfirm')}</label>
        <div className="flex gap-3 items-center">
          <input
            className="input w-52 bg-white/70 dark:bg-neutral-900/50"
            placeholder="delete account"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
          />
          <button
            onClick={handleDeleteAccount}
            disabled={!canDelete || deleting}
            className={`btn ${canDelete ? 'btn-error' : 'btn-disabled'}`}
          >
            {deleting ? t('profile.deletingAccount') : t('profile.deleteAccountButton')}
          </button>
        </div>
      </div>
      )}
    </div>
  )
}
