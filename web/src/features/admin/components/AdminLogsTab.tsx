import { useTranslation } from 'react-i18next'
import { PageSection, PageSectionHeader } from '@/shared/components/PageLayout'
import { LOG_LEVELS, useAdminLogs } from '@/features/admin/hooks/useAdminLogs'

export default function AdminLogsTab() {
  const { t } = useTranslation()
  const logs = useAdminLogs()

  return (
    <PageSection className="admin-page__section">
      <PageSectionHeader
        kicker={t('admin.logsTab')}
        title={t('admin.apiLogs')}
        description={t('admin.description')}
        aside={
          <button
            type="button"
            className="pf-button pf-button--secondary"
            onClick={() => logs.fetchLogs(true)}
            disabled={logs.logsManualRefresh}
          >
            {logs.logsManualRefresh ? t('common.refreshing') : t('common.refresh')}
          </button>
        }
      />

      <div className="admin-page__filters">
        <select
          className="pf-select"
          value={logs.logsLevel}
          onChange={(e) => {
            logs.setLogsLevel(e.target.value)
            logs.setLogsPage(1)
          }}
        >
          <option value="">{t('admin.allLevels')}</option>
          {LOG_LEVELS.map((level) => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
        <input
          className="pf-input"
          placeholder={t('admin.searchLogs')}
          value={logs.logsSearch}
          onChange={(e) => logs.setLogsSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void logs.fetchLogs()
          }}
        />
        <button
          type="button"
          className="pf-button pf-button--primary"
          onClick={() => {
            logs.setLogsPage(1)
            void logs.fetchLogs(true)
          }}
        >
          {t('common.search')}
        </button>
        <select
          className="pf-select"
          value={logs.logsPageSize}
          onChange={(e) => {
            logs.setLogsPageSize(Number(e.target.value))
            logs.setLogsPage(1)
          }}
        >
          {[25, 50, 100, 200, 500].map((size) => (
            <option key={size} value={size}>{size} {t('admin.perPage')}</option>
          ))}
        </select>

        <div className="admin-page__auto-refresh">
          <label className="admin-page__checkbox">
            <input
              type="checkbox"
              checked={logs.logsAutoRefresh}
              onChange={(e) => logs.setLogsAutoRefresh(e.target.checked)}
            />
            {t('admin.autoRefresh')}
          </label>
          <select
            className="pf-select admin-page__interval"
            value={logs.logsRefreshInterval}
            onChange={(e) => logs.setLogsRefreshInterval(Number(e.target.value))}
            disabled={!logs.logsAutoRefresh}
          >
            <option value="2">2s</option>
            <option value="5">5s</option>
            <option value="10">10s</option>
            <option value="30">30s</option>
            <option value="60">1m</option>
          </select>
        </div>
      </div>

      <div className="admin-page__log-console">
        {logs.logsLoading && logs.logs.length === 0 ? (
          <div className="admin-page__log-warning">{t('admin.loadingLogs')}</div>
        ) : !Array.isArray(logs.logs) || logs.logs.length === 0 ? (
          <div>
            <div className="admin-page__log-warning">{t('admin.noLogsFound')}</div>
            <div className="admin-page__log-muted">
              {logs.logsTotal === 0 && t('admin.logFileEmptyOrNotFound')}
            </div>
            <div className="admin-page__log-muted">{t('admin.checkConsole')}</div>
          </div>
        ) : (
          logs.logs.map((log, idx) => <div key={idx}>{log}</div>)
        )}
      </div>

      <div className="admin-page__pagination">
        <button
          type="button"
          className="pf-button pf-button--secondary"
          onClick={() => logs.setLogsPage((page) => Math.max(1, page - 1))}
          disabled={logs.logsPage === 1}
        >
          {t('admin.prevButton')}
        </button>
        <span>
          {t('admin.pageOf', { current: logs.logsPage, total: logs.logsTotalPages || 1 })}
        </span>
        <button
          type="button"
          className="pf-button pf-button--secondary"
          onClick={() => logs.setLogsPage((page) => Math.min(logs.logsTotalPages, page + 1))}
          disabled={logs.logsPage === logs.logsTotalPages || logs.logsTotalPages === 0}
        >
          {t('admin.nextButton')}
        </button>
      </div>
    </PageSection>
  )
}
