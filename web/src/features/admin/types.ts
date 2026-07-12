import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { User } from '@/app/providers/AuthContext'

export type AdminTab = 'users' | 'logs' | 'email'
export type AdminSortKey = 'id' | 'email' | 'username' | 'created_at'
export type AdminSortDir = 'asc' | 'desc'
export type AdminFilterRole = 'all' | 'admin' | 'user'
export type AdminFilterStatus = 'all' | 'active' | 'inactive'
export type AdminToast = { type: 'success' | 'error'; message: string } | null

export interface LogEntry {
  logs: string[]
  total: number
  page: number
  page_size: number
}

export interface NewAdminUser {
  email: string
  username: string
  password: string
  full_name?: string
  is_admin?: boolean
  is_active?: boolean
  is_verified?: boolean
}

export type EditAdminUserPayload = {
  email?: string
  username?: string
  full_name?: string | null
  password?: string
  is_active?: boolean
  is_admin?: boolean
  is_verified?: boolean
}

export interface AdminEmailConfig {
  enable_email: boolean
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string | null
  smtp_tls: boolean
  from_email: string
  from_name: string
  frontend_url: string
}

export interface AdminEmailStats {
  total_active_users: number
  verified_users: number
  email_enabled: boolean
  notifications: {
    daily_reports_enabled: number
    daily_changes_enabled: number
    transaction_notifications_enabled: number
  }
  smtp_configured: boolean
}

export type AdminEmailTestType = 'simple' | 'verification' | 'password_reset' | 'welcome' | 'daily_report'
export type AdminEmailTestResult = { type: 'success' | 'error'; message: string } | null

export interface LanguageDisplay {
  countryCode: string
  label: string
  alt: string
}

export interface AdminUsersModel {
  users: User[]
  filteredUsers: User[]
  loading: boolean
  error: string | null
  creating: boolean
  isCreateOpen: boolean
  isEditOpen: boolean
  editingUser: User | null
  search: string
  filterRole: AdminFilterRole
  filterStatus: AdminFilterStatus
  sortKey: AdminSortKey
  sortDir: AdminSortDir
  newUser: NewAdminUser
  editPayload: EditAdminUserPayload
  toast: AdminToast
  activeUsers: number
  adminUsers: number
  verifiedUsers: number
  loadUsers: () => Promise<void>
  setIsCreateOpen: (open: boolean) => void
  setNewUser: Dispatch<SetStateAction<NewAdminUser>>
  setEditPayload: Dispatch<SetStateAction<EditAdminUserPayload>>
  setSearch: (value: string) => void
  setFilterRole: (value: AdminFilterRole) => void
  setFilterStatus: (value: AdminFilterStatus) => void
  setToast: (toast: AdminToast) => void
  clearFilters: () => void
  handleSort: (key: AdminSortKey) => void
  toggleActive: (user: User) => Promise<void>
  toggleAdmin: (user: User) => Promise<void>
  deleteUser: (user: User) => Promise<void>
  openEditModal: (user: User) => void
  closeEditModal: () => void
  saveEdit: (event: FormEvent) => Promise<void>
  createUser: (event: FormEvent) => Promise<void>
}
