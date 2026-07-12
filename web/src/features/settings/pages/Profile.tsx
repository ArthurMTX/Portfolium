import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, MailCheck, RefreshCw, Shield, Trash2, User as UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import { useAuth } from '@/app/providers/AuthContext'
import TwoFactorSettings from '@/features/auth/components/TwoFactorSettings'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageSection,
  PageSectionHeader,
  PageShell,
  PageSummaryPanel,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { translateApiError } from '@/shared/lib/errorUtils'
import '@/shared/design/pages/profile.css'

type ProfileTab = 'profile' | 'security' | 'danger'
type FormMessage = { type: 'success' | 'error'; text: string } | null

function Message({ message }: { message: FormMessage }) {
  if (!message) return null

  return (
    <div className={`profile-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
      {message.text}
    </div>
  )
}

function ProfileField({
  label,
  description,
  children,
}: {
  label: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="profile-field">
      <span>
        <strong>{label}</strong>
        {description && <em>{description}</em>}
      </span>
      <span className="profile-field__control">{children}</span>
    </label>
  )
}

function ProfileActionRow({
  title,
  description,
  children,
  danger = false,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  danger?: boolean
}) {
  return (
    <div className={`profile-action-row ${danger ? 'is-danger' : ''}`}>
      <span>
        <strong>{title}</strong>
        {description && <em>{description}</em>}
      </span>
      <div>{children}</div>
    </div>
  )
}

export default function Profile() {
  const { user, refreshUser, logout } = useAuth()
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<FormMessage>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdMessage, setPwdMessage] = useState<FormMessage>(null)

  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

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

  const tabs: Array<{ id: ProfileTab; label: string; icon: typeof UserIcon }> = [
    { id: 'profile', label: t('profile.profileTab'), icon: UserIcon },
    { id: 'security', label: t('profile.securityTab'), icon: Shield },
    { id: 'danger', label: t('profile.dangerTab'), icon: Trash2 },
  ]

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? t('profile.title')
  const verificationLabel = user?.is_verified ? t('profile.emailVerified') : t('profile.emailNotVerified')

  const handleSave = async (e: FormEvent) => {
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

  const handleChangePassword = async (e: FormEvent) => {
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
      logout()
    } catch (err: unknown) {
      const text = err instanceof Error ? translateApiError(err.message, t) : t('profile.failedToDeleteAccount')
      setMessage({ type: 'error', text })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageShell className="profile-page">
      <PageHeader>
        <PageTitleBlock
          kicker={t('profile.title')}
          title={t('profile.title')}
          description={t('profile.description')}
        />
        <PageSummaryPanel
          lead={activeTabLabel}
          description={user?.email ?? t('profile.description')}
        />
      </PageHeader>

      <PageMetricStrip label={t('profile.title')}>
        <PageMetric label={t('profile.usernameField')} value={user?.username || '-'} />
        <PageMetric label={t('profile.emailField')} value={user?.email || '-'} />
        <PageMetric
          label={t('profile.verificationStatus')}
          value={verificationLabel}
          tone={user?.is_verified ? 'positive' : 'negative'}
        />
      </PageMetricStrip>

      <PageControls
        label={t('profile.title')}
        start={
          <PageTabs label={t('profile.title')}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={activeTab === id ? 'is-active' : undefined}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </PageTabs>
        }
      />

      <PageMainGrid single>
        <PageMainColumn>
          {activeTab === 'profile' && (
            <PageSection className="profile-page__section">
              <PageSectionHeader
                kicker={t('profile.profileTab')}
                title={t('profile.profileInformation')}
                description={t('profile.profileDescription')}
              />

              <Message message={message} />

              <form className="profile-form" onSubmit={handleSave}>
                <ProfileField label={t('profile.nameField')}>
                  <input
                    className="pf-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('profile.namePlaceholder')}
                  />
                </ProfileField>

                <ProfileField label={t('profile.usernameField')}>
                  <input
                    className="pf-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('profile.usernamePlaceholder')}
                  />
                </ProfileField>

                <ProfileField
                  label={t('profile.emailField')}
                  description={!user?.is_verified ? t('profile.emailNotVerified') : verificationLabel}
                >
                  <input
                    type="email"
                    className="pf-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('profile.emailPlaceholder')}
                  />
                </ProfileField>

                {user && !user.is_verified && (
                  <ProfileActionRow title={t('profile.verificationStatus')} description={resendMsg}>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="pf-button pf-button--secondary"
                    >
                      {resending ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <MailCheck aria-hidden="true" />}
                      {resending ? t('profile.resendingVerification') : t('profile.resendVerification')}
                    </button>
                  </ProfileActionRow>
                )}

                <ProfileActionRow title={t('profile.profileInformation')}>
                  <button type="submit" disabled={saving} className="pf-button pf-button--primary">
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </ProfileActionRow>
              </form>
            </PageSection>
          )}

          {activeTab === 'security' && (
            <PageSection className="profile-page__section">
              <PageSectionHeader
                kicker={t('profile.securityTab')}
                title={t('profile.securityInformation')}
                description={t('profile.securityDescription')}
                aside={
                  <span className={`profile-status ${user?.is_verified ? 'is-success' : 'is-warning'}`}>
                    {user?.is_verified ? <CheckCircle2 aria-hidden="true" /> : <MailCheck aria-hidden="true" />}
                    {verificationLabel}
                  </span>
                }
              />

              <Message message={pwdMessage} />

              <form className="profile-form" onSubmit={handleChangePassword}>
                <ProfileField label={t('profile.currentPasswordField')}>
                  <input
                    type="password"
                    className="pf-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </ProfileField>

                <ProfileField label={t('profile.newPasswordField')} description={t('profile.newPasswordMinLength')}>
                  <input
                    type="password"
                    className="pf-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('profile.newPasswordPlaceholder')}
                    autoComplete="new-password"
                  />
                </ProfileField>

                <ProfileField label={t('profile.confirmNewPasswordField')}>
                  <input
                    type="password"
                    className="pf-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('profile.confirmNewPasswordPlaceholder')}
                    autoComplete="new-password"
                  />
                </ProfileField>

                <ProfileActionRow title={t('profile.securityInformation')}>
                  <button type="submit" disabled={changingPwd} className="pf-button pf-button--primary">
                    {changingPwd ? t('common.saving') : t('common.save')}
                  </button>
                </ProfileActionRow>
              </form>

              <div className="profile-page__two-factor">
                <TwoFactorSettings />
              </div>
            </PageSection>
          )}

          {activeTab === 'danger' && (
            <PageSection className="profile-page__section is-danger">
              <PageSectionHeader
                kicker={t('profile.dangerTab')}
                title={t('profile.deleteAccount')}
                description={t('profile.deleteDescription')}
              />

              <Message message={message} />

              <div className="profile-form">
                <ProfileField label={t('profile.deleteConfirm')} description={t('profile.deleteDescription')}>
                  <input
                    className="pf-input"
                    placeholder="delete account"
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                  />
                </ProfileField>

                <ProfileActionRow title={t('profile.deleteAccount')} danger>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={!canDelete || deleting}
                    className="pf-button pf-button--danger"
                  >
                    <Trash2 aria-hidden="true" />
                    {deleting ? t('profile.deletingAccount') : t('profile.deleteAccountButton')}
                  </button>
                </ProfileActionRow>
              </div>
            </PageSection>
          )}
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}
