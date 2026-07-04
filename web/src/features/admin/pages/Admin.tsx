import { FileText, Mail, PlusCircle, Users as UsersIcon } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/providers/AuthContext'
import AdminEmailTab from '@/features/admin/components/AdminEmailTab'
import AdminLogsTab from '@/features/admin/components/AdminLogsTab'
import AdminUsersTab from '@/features/admin/components/AdminUsersTab'
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers'
import type { AdminTab } from '@/features/admin/types'
import {
  PageControls,
  PageHeader,
  PageMainColumn,
  PageMainGrid,
  PageMetric,
  PageMetricStrip,
  PageShell,
  PageSummaryPanel,
  PageTabs,
  PageTitleBlock,
} from '@/shared/components/PageLayout'
import { StateBlock } from '@/shared/components/StatePrimitives'
import '@/shared/design/pages/admin.css'
import { useState } from 'react'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const canAccess = Boolean(user?.is_admin || user?.is_superuser)
  const users = useAdminUsers(canAccess)

  if (!canAccess) return <Navigate to="/" />

  if (users.loading) {
    return (
      <PageShell className="admin-page">
        <StateBlock tone="info" title={t('common.loading')} />
      </PageShell>
    )
  }

  if (users.error) {
    return (
      <PageShell className="admin-page">
        <StateBlock tone="error" title={users.error}>
          <button type="button" onClick={users.loadUsers} className="pf-button pf-button--secondary">
            {t('admin.refresh')}
          </button>
        </StateBlock>
      </PageShell>
    )
  }

  const activeTabLabel =
    activeTab === 'users' ? t('admin.usersTab') : activeTab === 'logs' ? t('admin.logsTab') : t('admin.emailTab')

  return (
    <PageShell className="admin-page">
      <PageHeader>
        <PageTitleBlock
          kicker={t('admin.title')}
          title={t('admin.title')}
          description={t('admin.description')}
        />
        <PageSummaryPanel
          lead={activeTabLabel}
          description={`${users.users.length} ${t('admin.users').toLowerCase()} · ${users.adminUsers} ${t('admin.admins').toLowerCase()}`}
        />
      </PageHeader>

      <PageMetricStrip label={t('admin.title')}>
        <PageMetric label={t('admin.users')} value={users.users.length} />
        <PageMetric label={t('admin.active')} value={users.activeUsers} tone={users.activeUsers > 0 ? 'positive' : 'neutral'} />
        <PageMetric label={t('admin.admins')} value={users.adminUsers} />
        <PageMetric label={t('admin.verified')} value={users.verifiedUsers} />
      </PageMetricStrip>

      <PageControls
        label={t('admin.title')}
        start={
          <PageTabs label={t('admin.title')}>
            <button type="button" onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'is-active' : undefined}>
              <UsersIcon aria-hidden="true" />
              {t('admin.usersTab')}
            </button>
            <button type="button" onClick={() => setActiveTab('logs')} className={activeTab === 'logs' ? 'is-active' : undefined}>
              <FileText aria-hidden="true" />
              {t('admin.logsTab')}
            </button>
            <button type="button" onClick={() => setActiveTab('email')} className={activeTab === 'email' ? 'is-active' : undefined}>
              <Mail aria-hidden="true" />
              {t('admin.emailTab')}
            </button>
          </PageTabs>
        }
        end={
          activeTab === 'users' ? (
            <>
              <button type="button" onClick={users.loadUsers} className="pf-button pf-button--secondary">
                {t('admin.refresh')}
              </button>
              <button type="button" onClick={() => users.setIsCreateOpen(true)} className="pf-button pf-button--primary">
                <PlusCircle aria-hidden="true" />
                {t('admin.newUser')}
              </button>
            </>
          ) : null
        }
      />

      <PageMainGrid single>
        <PageMainColumn>
          {activeTab === 'users' && <AdminUsersTab currentUser={user} users={users} />}
          {activeTab === 'logs' && <AdminLogsTab />}
          {activeTab === 'email' && <AdminEmailTab />}
        </PageMainColumn>
      </PageMainGrid>
    </PageShell>
  )
}
