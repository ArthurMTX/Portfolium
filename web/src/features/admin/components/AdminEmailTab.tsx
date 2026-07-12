import { AlertCircle, CheckCircle, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { PageSection, PageSectionHeader } from '@/shared/components/PageLayout'
import { useAdminEmail } from '@/features/admin/hooks/useAdminEmail'
import type { AdminEmailTestType } from '@/features/admin/types'

export default function AdminEmailTab() {
  const { t } = useTranslation()
  const email = useAdminEmail()

  return (
    <div className="admin-page__email-stack">
      <PageSection className="admin-page__section">
        <PageSectionHeader
          kicker={t('admin.emailTab')}
          title={t('admin.emailSettings')}
          description={t('admin.emailSettingsDescription')}
        />

        {email.emailLoading ? (
          <div className="admin-page__loading">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="admin-page__form-stack">
            <div className="admin-page__setting-row">
              <div>
                <h3>{t('admin.enableEmail')}</h3>
                <p>{t('admin.emailSettingsDescription')}</p>
              </div>
              <label className="pf-switch">
                <input
                  type="checkbox"
                  checked={email.emailConfig.enable_email}
                  onChange={(e) => email.setEmailConfig({ ...email.emailConfig, enable_email: e.target.checked })}
                />
                <span className="pf-switch-track" aria-hidden="true" />
              </label>
            </div>

            <div className="pf-modal-grid">
              <div>
                <label className="pf-modal-label">{t('admin.smtpHost')}</label>
                <input
                  type="text"
                  value={email.emailConfig.smtp_host}
                  onChange={(e) => email.setEmailConfig({ ...email.emailConfig, smtp_host: e.target.value })}
                  className="pf-modal-input"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className="pf-modal-label">{t('admin.smtpPort')}</label>
                <input
                  type="number"
                  value={email.emailConfig.smtp_port}
                  onChange={(e) => email.setEmailConfig({ ...email.emailConfig, smtp_port: parseInt(e.target.value) || 587 })}
                  className="pf-modal-input"
                  placeholder="587"
                />
              </div>
              <div>
                <label className="pf-modal-label">{t('admin.smtpUsername')}</label>
                <input
                  type="text"
                  value={email.emailConfig.smtp_user}
                  onChange={(e) => email.setEmailConfig({ ...email.emailConfig, smtp_user: e.target.value })}
                  className="pf-modal-input"
                  placeholder="your-email@gmail.com"
                />
              </div>
              <div>
                <label className="pf-modal-label">{t('admin.smtpPassword')}</label>
                <input
                  type="password"
                  value={email.emailConfig.smtp_password || ''}
                  onChange={(e) => email.setEmailConfig({ ...email.emailConfig, smtp_password: e.target.value })}
                  className="pf-modal-input"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="smtp_tls"
                checked={email.emailConfig.smtp_tls}
                onChange={(e) => email.setEmailConfig({ ...email.emailConfig, smtp_tls: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-700"
              />
              <label htmlFor="smtp_tls" className="text-sm text-neutral-700 dark:text-neutral-300">{t('admin.useTls')}</label>
            </div>

            <div className="pf-modal-grid">
              <div>
                <label className="pf-modal-label">{t('admin.fromEmail')}</label>
                <input
                  type="email"
                  value={email.emailConfig.from_email}
                  onChange={(e) => email.setEmailConfig({ ...email.emailConfig, from_email: e.target.value })}
                  className="pf-modal-input"
                  placeholder="noreply@example.com"
                />
              </div>
              <div>
                <label className="pf-modal-label">{t('admin.fromName')}</label>
                <input
                  type="text"
                  value={email.emailConfig.from_name}
                  onChange={(e) => email.setEmailConfig({ ...email.emailConfig, from_name: e.target.value })}
                  className="pf-modal-input"
                  placeholder="Portfolium"
                />
              </div>
            </div>

            <div>
              <label className="pf-modal-label">{t('admin.frontendUrl')}</label>
              <input
                type="url"
                value={email.emailConfig.frontend_url}
                onChange={(e) => email.setEmailConfig({ ...email.emailConfig, frontend_url: e.target.value })}
                className="pf-modal-input"
                placeholder="https://example.com"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('admin.frontendNote')}</p>
            </div>

            <button
              type="button"
              onClick={email.saveEmailConfig}
              disabled={email.emailSaving}
              className="pf-button pf-button--primary admin-page__full-action"
            >
              {email.emailSaving ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        )}
      </PageSection>

      {email.emailConfig.enable_email && (
        <PageSection className="admin-page__section">
          <PageSectionHeader
            kicker={t('admin.emailTab')}
            title={t('admin.testEmail')}
            description={t('admin.sendTestEmail')}
          />

          <div className="admin-page__form-stack">
            <div className="pf-modal-grid">
              <div>
                <label className="pf-modal-label">{t('admin.recipientEmail')}</label>
                <input
                  type="email"
                  value={email.testEmailAddress}
                  onChange={(e) => email.setTestEmailAddress(e.target.value)}
                  className="pf-modal-input"
                  placeholder="test@example.com"
                />
              </div>
              <div>
                <label className="pf-modal-label">{t('admin.emailType')}</label>
                <select
                  value={email.testEmailType}
                  onChange={(e) => email.setTestEmailType(e.target.value as AdminEmailTestType)}
                  className="pf-modal-input"
                >
                  <option value="simple">{t('admin.simpleTest')}</option>
                  <option value="verification">{t('admin.verificationTest')}</option>
                  <option value="password_reset">{t('admin.passwordResetTest')}</option>
                  <option value="welcome">{t('admin.welcomeTest')}</option>
                  <option value="daily_report">{t('admin.dailyReportTest')}</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={email.testEmail}
              disabled={email.emailTesting || !email.testEmailAddress}
              className="pf-button pf-button--primary admin-page__full-action"
            >
              {email.emailTesting ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  {t('admin.sendingTestEmail')}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {t('admin.sendTestEmail')}
                </>
              )}
            </button>

            {email.emailTestResult && (
              <div className={`admin-page__message is-${email.emailTestResult.type}`}>
                {email.emailTestResult.type === 'success' ? (
                  <CheckCircle size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
                <p>{email.emailTestResult.message}</p>
              </div>
            )}
          </div>
        </PageSection>
      )}

      {email.emailStats && (
        <PageSection className="admin-page__section">
          <PageSectionHeader
            kicker={t('admin.emailTab')}
            title={t('admin.emailStatistics')}
            description={t('admin.notificationPreferences')}
          />
          <div className="admin-page__stat-grid">
            <div>
              <span className="pf-metric-label">{t('admin.totalActiveUsers')}</span>
              <strong className="pf-metric-figure">{email.emailStats.total_active_users}</strong>
            </div>
            <div>
              <span className="pf-metric-label">{t('admin.verifiedUsers')}</span>
              <strong className="pf-metric-figure">{email.emailStats.verified_users}</strong>
            </div>
            <div>
              <span className="pf-metric-label">{t('admin.emailSystem')}</span>
              <strong className="pf-metric-figure">
                {email.emailStats.email_enabled ? t('admin.enabled') : t('admin.disabled')}
              </strong>
            </div>
            <div>
              <span className="pf-metric-label">{t('admin.smtpConfiguration')}</span>
              <strong className="pf-metric-figure">
                {email.emailStats.smtp_configured ? t('admin.configured') : t('admin.notConfigured')}
              </strong>
            </div>
          </div>
          <div className="admin-page__notification-stats">
            <h3>{t('admin.notificationPreferences')}</h3>
            <div>
              <div>
                <span>{t('admin.dailyReports')}:</span>{' '}
                <strong>{email.emailStats.notifications.daily_reports_enabled}</strong>
              </div>
              <div>
                <span>{t('admin.dailyChanges')}:</span>{' '}
                <strong>{email.emailStats.notifications.daily_changes_enabled}</strong>
              </div>
              <div>
                <span>{t('admin.transactions')}:</span>{' '}
                <strong>{email.emailStats.notifications.transaction_notifications_enabled}</strong>
              </div>
            </div>
          </div>
        </PageSection>
      )}
    </div>
  )
}
