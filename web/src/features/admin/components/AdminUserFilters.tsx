import { useTranslation } from 'react-i18next'
import type { AdminUsersModel } from '@/features/admin/types'

interface AdminUserFiltersProps {
  users: Pick<
    AdminUsersModel,
    | 'search'
    | 'filterRole'
    | 'filterStatus'
    | 'setSearch'
    | 'setFilterRole'
    | 'setFilterStatus'
    | 'clearFilters'
  >
}

export default function AdminUserFilters({ users }: AdminUserFiltersProps) {
  const { t } = useTranslation()

  return (
    <div className="admin-page__filters">
      <input
        value={users.search}
        onChange={(e) => users.setSearch(e.target.value)}
        placeholder={t('admin.searchEmailUser')}
        className="pf-input"
      />
      <select
        value={users.filterRole}
        onChange={(e) => users.setFilterRole(e.target.value as 'all' | 'admin' | 'user')}
        className="pf-select"
      >
        <option value="all">{t('admin.allRoles')}</option>
        <option value="admin">{t('admin.admins')}</option>
        <option value="user">{t('admin.users')}</option>
      </select>
      <select
        value={users.filterStatus}
        onChange={(e) => users.setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
        className="pf-select"
      >
        <option value="all">{t('admin.allStatuses')}</option>
        <option value="active">{t('admin.active')}</option>
        <option value="inactive">{t('admin.inactive')}</option>
      </select>
      <button type="button" onClick={users.clearFilters} className="pf-button pf-button--secondary">
        {t('common.clear')}
      </button>
    </div>
  )
}
