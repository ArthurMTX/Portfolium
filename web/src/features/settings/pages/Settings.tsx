import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import api from '@/api'
import { useAuth } from '@/app/providers/AuthContext'
import VersionInfo from '@/features/settings/components/VersionInfo'
import { InlineLoading, ListSkeleton } from '@/shared/components/StatePrimitives'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageShell,
  PageSummaryPanel,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { useTranslation } from 'react-i18next'
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications'
import '@/shared/design/pages/settings.css'

type SettingsTab = 'account' | 'preferences' | 'notifications' | 'security' | 'danger' | 'about'
type NotificationField =
  | 'daily_change_notifications_enabled'
  | 'transaction_notifications_enabled'
  | 'ath_atl_notifications_enabled'
  | 'daily_report_enabled'

interface SettingsSectionProps {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
  tone?: 'default' | 'danger'
}

interface SettingRowProps {
  title: string
  description?: string
  children: ReactNode
}

function SettingsSection({ eyebrow, title, description, children, tone = 'default' }: SettingsSectionProps) {
  return (
    <section className={`pf-section settings-section ${tone === 'danger' ? 'is-danger' : ''}`}>
      <div className="pf-section-header pf-section-header--grid settings-section__header">
        <div>
          <p className="pf-section-kicker">{eyebrow}</p>
          <h2 className="pf-section-title">{title}</h2>
        </div>
        {description && <span className="pf-section-description">{description}</span>}
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  )
}

function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="settings-row">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  )
}

function StaticValue({ children }: { children: ReactNode }) {
  return <span className="settings-static-value">{children}</span>
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <label className="settings-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span aria-hidden="true" />
      <em>{label}</em>
    </label>
  )
}

function Message({ message }: { message: { type: 'success' | 'error'; text: string } | null }) {
  if (!message) return null
  return <div className={`settings-message is-${message.type}`}>{message.text}</div>
}

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  const [autoRefreshInterval, setAutoRefreshInterval] = useState(
    localStorage.getItem('autoRefreshInterval') || '60',
  )
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(
    localStorage.getItem('autoRefreshEnabled') === 'true',
  )

  const [validateSellQuantity, setValidateSellQuantity] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [transactionNotificationsEnabled, setTransactionNotificationsEnabled] = useState(true)
  const [athAtlNotificationsEnabled, setAthAtlNotificationsEnabled] = useState(true)
  const [dailyReportsEnabled, setDailyReportsEnabled] = useState(false)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const pushNotifications = usePushNotifications()
  const [pushTestSending, setPushTestSending] = useState(false)
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'account', label: 'Account' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'security', label: 'Security' },
    { id: 'danger', label: 'Danger Zone' },
    { id: 'about', label: 'About' },
  ]

  const handleAutoRefreshSettingsChange = (interval: string, enabled: boolean) => {
    setAutoRefreshInterval(interval)
    setAutoRefreshEnabled(enabled)
    localStorage.setItem('autoRefreshInterval', interval)
    localStorage.setItem('autoRefreshEnabled', String(enabled))
  }

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getSettings()
        setValidateSellQuantity(settings.validate_sell_quantity)
        setSettingsLoading(false)
      } catch (e) {
        console.error('Failed to load settings:', e)
        setSettingsLoading(false)
      }
    }
    loadSettings()

    if (user) {
      setNotificationsEnabled(user.daily_change_notifications_enabled ?? true)
      setTransactionNotificationsEnabled(user.transaction_notifications_enabled ?? true)
      setAthAtlNotificationsEnabled(user.ath_atl_notifications_enabled ?? true)
      setDailyReportsEnabled(user.daily_report_enabled ?? false)
    }
  }, [user])

  const handleValidateSellQuantityChange = async (enabled: boolean) => {
    setSettingsSaving(true)
    setSettingsMessage(null)
    try {
      const updated = await api.updateSettings({ validate_sell_quantity: enabled })
      setValidateSellQuantity(updated.validate_sell_quantity)
      setSettingsMessage({
        type: 'success',
        text: `Sell quantity validation ${enabled ? 'enabled' : 'disabled'} successfully`,
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update settings'
      setSettingsMessage({ type: 'error', text: message })
      setValidateSellQuantity(!enabled)
    } finally {
      setSettingsSaving(false)
      setTimeout(() => setSettingsMessage(null), 3000)
    }
  }

  const handleNotificationPreferenceChange = async (field: NotificationField, enabled: boolean) => {
    if (!user) return
    const previous = {
      daily_change_notifications_enabled: notificationsEnabled,
      transaction_notifications_enabled: transactionNotificationsEnabled,
      ath_atl_notifications_enabled: athAtlNotificationsEnabled,
      daily_report_enabled: dailyReportsEnabled,
    }
    const next = {
      ...previous,
      [field]: enabled,
    }

    setNotificationsEnabled(next.daily_change_notifications_enabled)
    setTransactionNotificationsEnabled(next.transaction_notifications_enabled)
    setAthAtlNotificationsEnabled(next.ath_atl_notifications_enabled)
    setDailyReportsEnabled(next.daily_report_enabled)
    setSavingNotifications(true)
    setNotificationMessage({ type: 'success', text: 'Saving…' })
    try {
      await api.updateCurrentUser(next)
      await refreshUser()
      setNotificationMessage({ type: 'success', text: 'Saved' })
    } catch (err: unknown) {
      setNotificationsEnabled(previous.daily_change_notifications_enabled)
      setTransactionNotificationsEnabled(previous.transaction_notifications_enabled)
      setAthAtlNotificationsEnabled(previous.ath_atl_notifications_enabled)
      setDailyReportsEnabled(previous.daily_report_enabled)
      const text = err instanceof Error ? err.message : 'Failed to update notification settings'
      setNotificationMessage({ type: 'error', text })
    } finally {
      setSavingNotifications(false)
      setTimeout(() => setNotificationMessage(null), 2500)
    }
  }

  const handleDeleteAll = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await api.deleteAllData()
      setResult(
        `Deleted data successfully. Transactions: ${res.deleted?.transactions ?? 0}, Prices: ${res.deleted?.prices ?? 0}, Portfolios: ${res.deleted?.portfolios ?? 0}, Assets: ${res.deleted?.assets ?? 0}`,
      )
      setConfirmText('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const canDelete = confirmText.toLowerCase().trim() === 'delete'

  return (
    <PageShell className="settings">
      <PageHeader>
        <PageTitleBlock kicker="Settings" title={t('settings.title')} />
        <PageSummaryPanel
          lead={tabs.find((tab) => tab.id === activeTab)?.label}
          description={t('settings.description')}
        />
      </PageHeader>

      <PageControls
        label="Settings sections"
        start={
          <PageTabs label="Settings sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? 'is-active' : ''}
              >
                {tab.label}
              </button>
            ))}
          </PageTabs>
        }
      />

      <PageMainGrid single>
        <PageMainColumn className="settings__content">
        {activeTab === 'account' && (
          <SettingsSection
            eyebrow="Account"
            title="Current user"
            description="Identity and login details are managed from Profile."
          >
            <SettingRow title="Email">
              <StaticValue>{user?.email || '—'}</StaticValue>
            </SettingRow>
            <SettingRow title="Username">
              <StaticValue>{user?.username || '—'}</StaticValue>
            </SettingRow>
            <SettingRow title="Name">
              <StaticValue>{user?.full_name || '—'}</StaticValue>
            </SettingRow>
            <SettingRow title="Verification">
              <span className={`settings-badge ${user?.is_verified ? 'is-success' : 'is-warning'}`}>
                {user?.is_verified ? 'Verified' : 'Not verified'}
              </span>
            </SettingRow>
            <div className="settings-action-row">
              <span>Account settings</span>
              <div>
                <a className="pf-button pf-button--secondary" href="/profile">Manage profile</a>
              </div>
            </div>
          </SettingsSection>
        )}

        {activeTab === 'preferences' && (
          <SettingsSection
            eyebrow="Preferences"
            title={t('settings.autoRefreshSettings')}
            description="Control how often prices refresh while you use Portfolium."
          >
            <SettingRow
              title={t('settings.enableAutoRefresh')}
              description="Refresh portfolio prices automatically."
            >
              <Toggle
                checked={autoRefreshEnabled}
                onChange={(checked) => handleAutoRefreshSettingsChange(autoRefreshInterval, checked)}
                label={autoRefreshEnabled ? 'Enabled' : 'Disabled'}
              />
            </SettingRow>

            <SettingRow
              title={t('settings.refreshInterval')}
              description="Shorter intervals increase API usage."
            >
              <select
                value={autoRefreshInterval}
                onChange={(event) => handleAutoRefreshSettingsChange(event.target.value, autoRefreshEnabled)}
                className="settings-select"
                disabled={!autoRefreshEnabled}
              >
                <option value="15">{t('settings.refreshInterval15s')}</option>
                <option value="30">{t('settings.refreshInterval30s')}</option>
                <option value="60">{t('settings.refreshInterval1m')}</option>
                <option value="120">{t('settings.refreshInterval2m')}</option>
                <option value="300">{t('settings.refreshInterval5m')}</option>
                <option value="600">{t('settings.refreshInterval10m')}</option>
              </select>
            </SettingRow>
          </SettingsSection>
        )}

        {activeTab === 'notifications' && (
          <>
            <SettingsSection
              eyebrow="Notifications"
              title="Notification rules"
              description="Notification preferences save automatically."
            >
              <Message message={notificationMessage} />

              <SettingRow
                title={t('settings.dailyChangeNotifications')}
                description={t('settings.enableDailyChangeNotificationsInfo')}
              >
                <Toggle
                  checked={notificationsEnabled}
                  onChange={(checked) => handleNotificationPreferenceChange('daily_change_notifications_enabled', checked)}
                  disabled={savingNotifications}
                  label={notificationsEnabled ? 'Enabled' : 'Disabled'}
                />
              </SettingRow>

              <SettingRow
                title={t('settings.athAtlNotifications')}
                description={t('settings.enableAthAtlNotificationsInfo')}
              >
                <Toggle
                  checked={athAtlNotificationsEnabled}
                  onChange={(checked) => handleNotificationPreferenceChange('ath_atl_notifications_enabled', checked)}
                  disabled={savingNotifications}
                  label={athAtlNotificationsEnabled ? 'Enabled' : 'Disabled'}
                />
              </SettingRow>

              <SettingRow
                title={t('settings.transactionNotifications')}
                description={t('settings.enableTransactionNotificationsInfo')}
              >
                <Toggle
                  checked={transactionNotificationsEnabled}
                  onChange={(checked) => handleNotificationPreferenceChange('transaction_notifications_enabled', checked)}
                  disabled={savingNotifications}
                  label={transactionNotificationsEnabled ? 'Enabled' : 'Disabled'}
                />
              </SettingRow>

              <SettingRow
                title={t('settings.dailyPortfolioReports')}
                description={t('settings.enableDailyPortfolioReportsInfo')}
              >
                <Toggle
                  checked={dailyReportsEnabled}
                  onChange={(checked) => handleNotificationPreferenceChange('daily_report_enabled', checked)}
                  disabled={savingNotifications}
                  label={dailyReportsEnabled ? 'Enabled' : 'Disabled'}
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection
              eyebrow="Push"
              title={t('settings.pushNotifications')}
              description="Browser push delivery for supported notifications."
            >
              {!pushNotifications.isSupported ? (
                <div className="settings-message is-warning">
                  {t('settings.pushNotificationsNotSupported')}
                </div>
              ) : (
                <>
                  <SettingRow
                    title={t('settings.pushNotificationStatus')}
                    description={
                      pushNotifications.isSubscribed
                        ? t('settings.pushNotificationsActive')
                        : pushNotifications.permission === 'denied'
                          ? t('settings.pushNotificationsDenied')
                          : t('settings.pushNotificationsInactive')
                    }
                  >
                    <span className={`settings-badge ${
                      pushNotifications.isSubscribed
                        ? 'is-success'
                        : pushNotifications.permission === 'denied'
                          ? 'is-danger'
                          : ''
                    }`}>
                      {pushNotifications.isSubscribed
                        ? t('settings.enabled')
                        : pushNotifications.permission === 'denied'
                          ? t('settings.blocked')
                          : t('settings.disabled')}
                    </span>
                  </SettingRow>

                  {pushNotifications.error && (
                    <div className="settings-message is-error">{pushNotifications.error}</div>
                  )}
                  <Message message={pushMessage} />

                  <div className="settings-action-row">
                    <span>Push actions</span>
                    <div>
                    {!pushNotifications.isSubscribed ? (
                      <button
                        type="button"
                        onClick={async () => {
                          setPushMessage(null)
                          const success = await pushNotifications.subscribe()
                          if (success) {
                            setPushMessage({ type: 'success', text: t('settings.pushNotificationsEnabled') })
                          } else if (pushNotifications.permission === 'denied') {
                            setPushMessage({ type: 'error', text: t('settings.pushNotificationsDeniedMessage') })
                          }
                          setTimeout(() => setPushMessage(null), 4000)
                        }}
                        disabled={pushNotifications.isLoading || pushNotifications.permission === 'denied'}
                        className="pf-button pf-button--primary"
                      >
                        {pushNotifications.isLoading ? <InlineLoading label={t('common.loading')} /> : t('settings.enablePushNotifications')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            setPushMessage(null)
                            await pushNotifications.unsubscribe()
                            setPushMessage({ type: 'success', text: t('settings.pushNotificationsDisabled') })
                            setTimeout(() => setPushMessage(null), 4000)
                          }}
                          disabled={pushNotifications.isLoading}
                          className="pf-button pf-button--secondary"
                        >
                          {pushNotifications.isLoading ? <InlineLoading label={t('common.loading')} /> : t('settings.disablePushNotifications')}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setPushTestSending(true)
                            setPushMessage(null)
                            const success = await pushNotifications.sendTestNotification()
                            setPushTestSending(false)
                            if (success) {
                              setPushMessage({ type: 'success', text: t('settings.testNotificationSent') })
                            } else {
                              setPushMessage({ type: 'error', text: t('settings.testNotificationFailed') })
                            }
                            setTimeout(() => setPushMessage(null), 4000)
                          }}
                          disabled={pushTestSending || pushNotifications.isLoading}
                          className="pf-button pf-button--secondary"
                        >
                          {pushTestSending ? t('common.sending') : t('settings.sendTestNotification')}
                        </button>
                      </>
                    )}
                    </div>
                  </div>
                  <p className="settings-note">{t('settings.pushNotificationsNote')}</p>
                </>
              )}
            </SettingsSection>
          </>
        )}

        {activeTab === 'security' && (
          <SettingsSection
            eyebrow="Security"
            title={t('settings.transactionValidationSettings')}
            description="Protect transaction entry from impossible sells."
          >
            {settingsLoading ? (
              <ListSkeleton className="settings-loading" rows={2} label="Loading security settings" />
            ) : (
              <>
                <Message message={settingsMessage} />
                <SettingRow
                  title={t('settings.validateSellQuantities')}
                  description={t('settings.validateSellQuantitiesDescription')}
                >
                  <Toggle
                    checked={validateSellQuantity}
                    onChange={handleValidateSellQuantityChange}
                    disabled={settingsSaving}
                    label={validateSellQuantity ? 'Enabled' : 'Disabled'}
                  />
                </SettingRow>
                <p className="settings-note">
                  {t('settings.validateSellQuantitiesDescription1')}{' '}
                  <code>VALIDATE_SELL_QUANTITY</code>
                  {t('settings.validateSellQuantitiesDescription2')}
                </p>
              </>
            )}
          </SettingsSection>
        )}

        {activeTab === 'danger' && (
          <SettingsSection
            eyebrow="Danger Zone"
            title={t('settings.dangerZone')}
            description="Permanent data deletion controls."
            tone="danger"
          >
            <div className="settings-action-row is-danger">
              <span>{t('settings.typeDeleteToConfirm')}</span>
              <div>
                <input
                  id="delete-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="delete"
                  className="settings-input"
                />
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  disabled={!canDelete || loading}
                  className="pf-button pf-button--danger"
                >
                  {loading ? t('settings.deletingData') : t('settings.deleteAllDataButton')}
                </button>
              </div>
            </div>
            {result && <div className="settings-message is-success">{result}</div>}
            {error && <div className="settings-message is-error">{error}</div>}
          </SettingsSection>
        )}

        {activeTab === 'about' && (
          <>
            <SettingsSection
              eyebrow="About"
              title={t('settings.about')}
              description="Application version and project information."
            >
              <div className="settings-action-row">
                <span>Project</span>
                <div>
                <a
                  href="https://github.com/ArthurMTX/Portfolium"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-button pf-button--secondary"
                >
                  {t('settings.viewOnGitHub')} →
                </a>
                </div>
              </div>
            </SettingsSection>
            <VersionInfo />
          </>
        )}
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}
