import { useEffect, useMemo, useState, type FormEvent } from 'react'
import api from '@/api'
import type { User } from '@/app/providers/AuthContext'
import type {
  AdminFilterRole,
  AdminFilterStatus,
  AdminSortKey,
  AdminUsersModel,
  EditAdminUserPayload,
  NewAdminUser,
} from '@/features/admin/types'

const emptyNewUser: NewAdminUser = {
  email: '',
  username: '',
  password: '',
  full_name: '',
  is_admin: false,
  is_active: true,
  is_verified: false,
}

export function useAdminUsers(canLoad: boolean): AdminUsersModel {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<AdminFilterRole>('all')
  const [filterStatus, setFilterStatus] = useState<AdminFilterStatus>('all')
  const [newUser, setNewUser] = useState<NewAdminUser>(emptyNewUser)
  const [sortKey, setSortKey] = useState<AdminSortKey>('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editPayload, setEditPayload] = useState<EditAdminUserPayload>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const list = await api.getAdminUsers()
      setUsers(list)
      setError(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load users'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canLoad) {
      void loadUsers()
    }
  }, [canLoad])

  useEffect(() => {
    if (isCreateOpen || isEditOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isCreateOpen, isEditOpen])

  useEffect(() => {
    if (editingUser) {
      setEditPayload({
        email: editingUser.email,
        username: editingUser.username,
        full_name: editingUser.full_name || '',
        is_active: editingUser.is_active,
        is_admin: editingUser.is_admin,
        is_verified: editingUser.is_verified,
      })
    }
  }, [editingUser])

  const filteredUsers = useMemo(() => {
    return [...users]
      .filter((u) => {
        const q = search.trim().toLowerCase()
        const matchesQuery = !q || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
        const matchesRole = filterRole === 'all' || (filterRole === 'admin' ? u.is_admin : !u.is_admin)
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? u.is_active : !u.is_active)
        return matchesQuery && matchesRole && matchesStatus
      })
      .sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''
        switch (sortKey) {
          case 'id':
            aVal = a.id
            bVal = b.id
            break
          case 'email':
            aVal = a.email.toLowerCase()
            bVal = b.email.toLowerCase()
            break
          case 'username':
            aVal = a.username.toLowerCase()
            bVal = b.username.toLowerCase()
            break
          case 'created_at':
            aVal = a.created_at || ''
            bVal = b.created_at || ''
            break
          default:
            break
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
        return 0
      })
  }, [filterRole, filterStatus, search, sortDir, sortKey, users])

  const clearFilters = () => {
    setSearch('')
    setFilterRole('all')
    setFilterStatus('all')
  }

  const handleSort = (key: AdminSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const toggleActive = async (u: User) => {
    try {
      const updated = await api.updateAdminUser(u.id, { is_active: !u.is_active })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update user'
      setToast({ type: 'error', message: msg })
    }
  }

  const toggleAdmin = async (u: User) => {
    try {
      const updated = await api.updateAdminUser(u.id, { is_admin: !u.is_admin })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update user'
      setToast({ type: 'error', message: msg })
    }
  }

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user ${u.email}?`)) return
    await api.deleteAdminUser(u.id)
    setUsers((prev) => prev.filter((x) => x.id !== u.id))
  }

  const openEditModal = (u: User) => {
    setEditingUser(u)
    setIsEditOpen(true)
  }

  const closeEditModal = () => {
    setIsEditOpen(false)
    setEditingUser(null)
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    try {
      const { password, ...rest } = editPayload
      const payloadToSend = password ? { ...rest, password } : { ...rest }
      const updated = await api.updateAdminUser(editingUser.id, payloadToSend)
      setUsers((prev) => prev.map((x) => (x.id === editingUser.id ? updated : x)))
      closeEditModal()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update user'
      setToast({ type: 'error', message: msg })
    }
  }

  const createUser = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const created = await api.createAdminUser(newUser)
      setUsers((prev) => [created, ...prev])
      setNewUser(emptyNewUser)
      setIsCreateOpen(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create user'
      setToast({ type: 'error', message: msg })
    } finally {
      setCreating(false)
    }
  }

  return {
    users,
    filteredUsers,
    loading,
    error,
    creating,
    isCreateOpen,
    isEditOpen,
    editingUser,
    search,
    filterRole,
    filterStatus,
    sortKey,
    sortDir,
    newUser,
    editPayload,
    toast,
    activeUsers: users.filter((u) => u.is_active).length,
    adminUsers: users.filter((u) => u.is_admin || u.is_superuser).length,
    verifiedUsers: users.filter((u) => u.is_verified).length,
    loadUsers,
    setIsCreateOpen,
    setNewUser,
    setEditPayload,
    setSearch,
    setFilterRole,
    setFilterStatus,
    setToast,
    clearFilters,
    handleSort,
    toggleActive,
    toggleAdmin,
    deleteUser,
    openEditModal,
    closeEditModal,
    saveEdit,
    createUser,
  }
}
