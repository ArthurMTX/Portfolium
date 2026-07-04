import { useTranslation } from 'react-i18next'
import type { User } from '@/app/providers/AuthContext'
import Toast from '@/shared/components/Toast'
import { PageSection, PageSectionHeader } from '@/shared/components/PageLayout'
import type { AdminUsersModel } from '@/features/admin/types'
import AdminUserFilters from '@/features/admin/components/AdminUserFilters'
import AdminUsersTable from '@/features/admin/components/AdminUsersTable'
import { CreateUserModal, EditUserModal } from '@/features/admin/components/AdminUserModal'

interface AdminUsersTabProps {
  currentUser: User | null
  users: AdminUsersModel
}

export default function AdminUsersTab({ currentUser, users }: AdminUsersTabProps) {
  const { t } = useTranslation()

  return (
    <>
      <PageSection className="admin-page__section">
        <PageSectionHeader
          kicker={t('admin.usersTab')}
          title={t('admin.users')}
          description={t('admin.description')}
          aside={<span className="pf-metric-label">{users.filteredUsers.length} / {users.users.length}</span>}
        />
        <AdminUserFilters users={users} />
        <AdminUsersTable currentUser={currentUser} users={users} />
      </PageSection>

      {users.isCreateOpen && <CreateUserModal users={users} />}
      {users.isEditOpen && <EditUserModal users={users} />}

      {users.toast && (
        <Toast
          type={users.toast.type}
          message={users.toast.message}
          onClose={() => users.setToast(null)}
        />
      )}
    </>
  )
}
