import React, { useEffect, useState } from "react";
import { useAuth, User } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import api from "../lib/api";
import { PlusCircle, Users as UsersIcon, X, FileText, Mail, Send, CheckCircle, AlertCircle } from 'lucide-react'

interface LogEntry {
  logs: string[];
  total: number;
  page: number;
  page_size: number;
}

const LOG_LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

type NewUser = {
  email: string;
  username: string;
  password: string;
  full_name?: string;
  is_admin?: boolean;
  is_active?: boolean;
  is_verified?: boolean;
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'email'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [newUser, setNewUser] = useState<NewUser>({
    email: "",
    username: "",
    password: "",
    full_name: "",
    is_admin: false,
    is_active: true,
    is_verified: false,
  });
  type SortKey = 'id' | 'email' | 'username' | 'created_at';
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Logs state
  const [logs, setLogs] = useState<string[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsPageSize, setLogsPageSize] = useState(50)
  const [logsLevel, setLogsLevel] = useState<string>("")
  const [logsSearch, setLogsSearch] = useState("")
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false)
  const [logsRefreshInterval, setLogsRefreshInterval] = useState(5) // seconds
  const [logsManualRefresh, setLogsManualRefresh] = useState(false) // Track manual refresh only

  // Email state
  const [emailConfig, setEmailConfig] = useState({
    enable_email: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '' as string | null,
    smtp_tls: true,
    from_email: '',
    from_name: '',
    frontend_url: ''
  })
  const [emailStats, setEmailStats] = useState({
    total_active_users: 0,
    verified_users: 0,
    email_enabled: false,
    notifications: {
      daily_reports_enabled: 0,
      daily_changes_enabled: 0,
      transaction_notifications_enabled: 0
    },
    smtp_configured: false
  })
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [testEmailType, setTestEmailType] = useState<'simple' | 'verification' | 'password_reset' | 'daily_report'>('simple')
  const [emailTesting, setEmailTesting] = useState(false)

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await api.getAdminUsers();
      setUsers(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load users";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_admin || user?.is_superuser) {
      loadUsers();
    }
  }, [user]);

  const toggleActive = async (u: User) => {
    try {
      const updated = await api.updateAdminUser(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update user';
      alert(msg);
    }
  };

  const toggleAdmin = async (u: User) => {
    try {
      const updated = await api.updateAdminUser(u.id, { is_admin: !u.is_admin });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update user';
      alert(msg);
    }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user ${u.email}?`)) return;
    await api.deleteAdminUser(u.id);
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  };
  const openEditModal = (u: User) => {
    setEditingUser(u);
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingUser(null);
  };

  const [editPayload, setEditPayload] = useState<{ email?: string; username?: string; full_name?: string | null; password?: string; is_active?: boolean; is_admin?: boolean; is_verified?: boolean }>({});

  useEffect(() => {
    if (editingUser) {
      setEditPayload({
        email: editingUser.email,
        username: editingUser.username,
        full_name: editingUser.full_name || '',
        is_active: editingUser.is_active,
        is_admin: editingUser.is_admin,
        is_verified: editingUser.is_verified,
      });
    }
  }, [editingUser]);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const { password, ...rest } = editPayload;
      const payloadToSend = password ? { ...rest, password } : { ...rest };
      const updated = await api.updateAdminUser(editingUser.id, payloadToSend);
      setUsers((prev) => prev.map((x) => (x.id === editingUser.id ? updated : x)));
      closeEditModal();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update user';
      alert(msg);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api.createAdminUser(newUser);
      setUsers((prev) => [created, ...prev]);
      setNewUser({ email: "", username: "", password: "", full_name: "", is_admin: false, is_active: true, is_verified: false });
      setIsCreateOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create user";
      alert(msg);
    } finally {
      setCreating(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // Logs functions
  const fetchLogs = async (isManual: boolean = false) => {
    setLogsLoading(true)
    if (isManual) setLogsManualRefresh(true)
    try {
      const params: Record<string, string | number> = { page: logsPage, page_size: logsPageSize }
      if (logsLevel) params.level = logsLevel
      if (logsSearch) params.search = logsSearch
      
      // Build query string manually
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value))
      })
      
      const url = `/api/admin/logs?${queryParams.toString()}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`)
      }
      
      const res: LogEntry = await response.json()
      const logsArr = Array.isArray(res.logs) ? res.logs : []
      setLogs(logsArr)
      setLogsTotal(typeof res.total === 'number' ? res.total : 0)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch logs.'
      setLogs([`Error: ${errorMessage}`])
      setLogsTotal(0)
    }
    setLogsLoading(false)
    if (isManual) setLogsManualRefresh(false)
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
    }
    // eslint-disable-next-line
  }, [logsPage, logsPageSize, logsLevel, activeTab])

  // Auto-refresh logs
  useEffect(() => {
    if (activeTab === 'logs' && logsAutoRefresh) {
      const interval = setInterval(() => {
        fetchLogs()
      }, logsRefreshInterval * 1000)
      
      return () => clearInterval(interval)
    }
    // eslint-disable-next-line
  }, [logsAutoRefresh, logsRefreshInterval, activeTab])

  // Email functions
  const loadEmailConfig = async () => {
    setEmailLoading(true)
    try {
      const config = await api.getEmailConfig()
      setEmailConfig(config)
      const stats = await api.getEmailStats()
      setEmailStats(stats)
    } catch (err) {
      console.error('Failed to load email config:', err)
    } finally {
      setEmailLoading(false)
    }
  }

  const saveEmailConfig = async () => {
    setEmailSaving(true)
    setEmailTestResult(null)
    try {
      const updated = await api.updateEmailConfig(emailConfig)
      setEmailConfig(updated)
      setEmailTestResult({ type: 'success', message: 'Email configuration updated successfully!' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update email configuration'
      setEmailTestResult({ type: 'error', message })
    } finally {
      setEmailSaving(false)
    }
  }

  const testEmail = async () => {
    if (!testEmailAddress) {
      setEmailTestResult({ type: 'error', message: 'Please enter an email address' })
      return
    }
    setEmailTesting(true)
    setEmailTestResult(null)
    try {
      const result = await api.testEmail(testEmailAddress, testEmailType)
      setEmailTestResult({ type: 'success', message: result.message })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send test email'
      setEmailTestResult({ type: 'error', message })
    } finally {
      setEmailTesting(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailConfig()
    }
  }, [activeTab])

  if (!(user?.is_admin || user?.is_superuser)) return <Navigate to="/" />;
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          onClick={loadUsers}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const logsTotalPages = Math.ceil(logsTotal / logsPageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <UsersIcon className="text-pink-600" size={28} />
            Admin
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1 text-sm sm:text-base">
            Manage users, permissions, and view system logs
          </p>
        </div>
        {activeTab === 'users' && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={loadUsers}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
            >
              <PlusCircle size={18} />
              New User
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto scrollbar-hide">
        <nav className="flex gap-2 sm:gap-4 min-w-max">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <UsersIcon size={14} className="inline mr-1" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <FileText size={14} className="inline mr-1" />
            Logs
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`pb-3 px-2 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'email'
                ? 'border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Mail size={14} className="inline mr-1" />
            Email
          </button>
        </nav>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          {/* Search / Filters */}
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-3 items-center">
            <input
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder="Search by email or username"
              className="input text-sm max-w-sm"
            />
            <select
              value={filterRole}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setFilterRole(e.target.value as 'all' | 'admin' | 'user')}
              className="input text-sm"
            >
              <option value="all">All roles</option>
              <option value="admin">Admins</option>
              <option value="user">Users</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="input text-sm"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button onClick={() => { setSearch(''); setFilterRole('all'); setFilterStatus('all'); }} className="btn btn-secondary text-sm">Clear</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" onClick={() => handleSort('id')}>
                    ID {sortKey === 'id' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" onClick={() => handleSort('email')}>
                    Email {sortKey === 'email' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" onClick={() => handleSort('username')}>
                    Username {sortKey === 'username' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" onClick={() => handleSort('created_at')}>
                    Created {sortKey === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {[...users]
                  .filter(u => {
                    const q = search.trim().toLowerCase();
                    const matchesQuery = !q || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
                    const matchesRole = filterRole === 'all' || (filterRole === 'admin' ? u.is_admin : !u.is_admin);
                    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? u.is_active : !u.is_active);
                    return matchesQuery && matchesRole && matchesStatus;
                  })
                  .sort((a, b) => {
                    let aVal: string | number = '';
                    let bVal: string | number = '';
                    switch (sortKey) {
                      case 'id':
                        aVal = a.id;
                        bVal = b.id;
                        break;
                      case 'email':
                        aVal = a.email.toLowerCase();
                        bVal = b.email.toLowerCase();
                        break;
                      case 'username':
                        aVal = a.username.toLowerCase();
                        bVal = b.username.toLowerCase();
                        break;
                      case 'created_at':
                        aVal = a.created_at || '';
                        bVal = b.created_at || '';
                        break;
                      default:
                        break;
                    }
                    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
                    return 0;
                  })
                  .map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{u.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-neutral-700 dark:text-neutral-300">{u.email}</div>
                        {u.is_admin ? (
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-medium">Admin</span>
                        ) : (
                          u.is_superuser && (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 font-medium">Superuser</span>
                          )
                        )}
                        {!u.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-medium">Inactive</span>
                        )}
                        {u.is_verified && (
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 font-medium">Verified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">{u.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${u.is_admin ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{u.is_admin ? 'Admin' : 'User'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex gap-2 text-sm">
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={u.is_superuser}
                          className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                          title={u.is_superuser ? 'Cannot deactivate the primary admin' : ''}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => toggleAdmin(u)}
                          disabled={u.is_superuser}
                          className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                          title={u.is_superuser ? 'Cannot revoke admin from the primary admin' : ''}
                        >
                          {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={u.id === user?.id || u.is_superuser}
                          className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
                          title={u.is_superuser ? 'Cannot delete the primary admin' : ''}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileText size={20} className="text-pink-600 dark:text-pink-400" />
              API Logs
            </h2>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-secondary text-sm"
                onClick={() => fetchLogs(true)}
                disabled={logsManualRefresh}
              >
                {logsManualRefresh ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <select
              className="input text-sm"
              value={logsLevel}
              onChange={e => { setLogsLevel(e.target.value); setLogsPage(1); }}
            >
              <option value="">All Levels</option>
              {LOG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input
              className="input text-sm"
              placeholder="Search logs..."
              value={logsSearch}
              onChange={e => setLogsSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") fetchLogs(); }}
            />
            <button
              className="btn btn-primary text-sm"
              onClick={() => { setLogsPage(1); fetchLogs(true); }}
            >
              Search
            </button>
            <select
              className="input text-sm"
              value={logsPageSize}
              onChange={e => { setLogsPageSize(Number(e.target.value)); setLogsPage(1); }}
            >
              {[25, 50, 100, 200, 500].map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
            
            {/* Auto-refresh controls */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={logsAutoRefresh}
                  onChange={(e) => setLogsAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                Auto-refresh
              </label>
              <select
                className="input text-sm w-24"
                value={logsRefreshInterval}
                onChange={(e) => setLogsRefreshInterval(Number(e.target.value))}
                disabled={!logsAutoRefresh}
              >
                <option value="2">2s</option>
                <option value="5">5s</option>
                <option value="10">10s</option>
                <option value="30">30s</option>
                <option value="60">1m</option>
              </select>
            </div>
          </div>
          
          <div className="bg-black text-green-200 font-mono text-xs rounded p-2 h-[600px] overflow-auto border border-neutral-700">
            {logsLoading && logs.length === 0 ? (
              <div className="text-yellow-300">Loading logs...</div>
            ) : !Array.isArray(logs) || logs.length === 0 ? (
              <div>
                <div className="text-yellow-300">No logs found.</div>
                <div className="text-neutral-400 mt-2">
                  {logsTotal === 0 && 'The log file may be empty or does not exist yet.'}
                </div>
                <div className="text-neutral-400 mt-1">
                  Check the browser console for any errors.
                </div>
              </div>
            ) : (
              logs.map((log, idx) => <div key={idx}>{log}</div>)
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <button
              className="btn btn-secondary text-sm disabled:opacity-50"
              onClick={() => setLogsPage(p => Math.max(1, p - 1))}
              disabled={logsPage === 1}
            >
              Prev
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Page {logsPage} of {logsTotalPages || 1}
            </span>
            <button
              className="btn btn-secondary text-sm disabled:opacity-50"
              onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
              disabled={logsPage === logsTotalPages || logsTotalPages === 0}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          {/* Email Configuration */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mail size={20} className="text-pink-600" />
              Email Configuration
            </h2>
            
            {emailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Enable Email */}
                <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div>
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">Enable Email System</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Allow the application to send emails</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailConfig.enable_email}
                      onChange={(e) => setEmailConfig({ ...emailConfig, enable_email: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pink-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                  </label>
                </div>

                {/* SMTP Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">SMTP Host</label>
                    <input
                      type="text"
                      value={emailConfig.smtp_host}
                      onChange={(e) => setEmailConfig({ ...emailConfig, smtp_host: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">SMTP Port</label>
                    <input
                      type="number"
                      value={emailConfig.smtp_port}
                      onChange={(e) => setEmailConfig({ ...emailConfig, smtp_port: parseInt(e.target.value) || 587 })}
                      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                      placeholder="587"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">SMTP Username</label>
                    <input
                      type="text"
                      value={emailConfig.smtp_user}
                      onChange={(e) => setEmailConfig({ ...emailConfig, smtp_user: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                      placeholder="your-email@gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">SMTP Password</label>
                    <input
                      type="password"
                      value={emailConfig.smtp_password || ''}
                      onChange={(e) => setEmailConfig({ ...emailConfig, smtp_password: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* SMTP TLS */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="smtp_tls"
                    checked={emailConfig.smtp_tls}
                    onChange={(e) => setEmailConfig({ ...emailConfig, smtp_tls: e.target.checked })}
                    className="rounded border-neutral-300 dark:border-neutral-700"
                  />
                  <label htmlFor="smtp_tls" className="text-sm text-neutral-700 dark:text-neutral-300">Use TLS encryption</label>
                </div>

                {/* From Email Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">From Email</label>
                    <input
                      type="email"
                      value={emailConfig.from_email}
                      onChange={(e) => setEmailConfig({ ...emailConfig, from_email: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                      placeholder="noreply@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">From Name</label>
                    <input
                      type="text"
                      value={emailConfig.from_name}
                      onChange={(e) => setEmailConfig({ ...emailConfig, from_name: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                      placeholder="Portfolium"
                    />
                  </div>
                </div>

                {/* Frontend URL */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Frontend URL</label>
                  <input
                    type="url"
                    value={emailConfig.frontend_url}
                    onChange={(e) => setEmailConfig({ ...emailConfig, frontend_url: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                    placeholder="https://example.com"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Used in email links and templates</p>
                </div>

                {/* Save Button */}
                <button
                  onClick={saveEmailConfig}
                  disabled={emailSaving}
                  className="w-full px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:bg-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {emailSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Test Email */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Send size={20} className="text-pink-600" />
              Test Email
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Recipient Email</label>
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                    placeholder="test@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Email Type</label>
                  <select
                    value={testEmailType}
                    onChange={(e) => setTestEmailType(e.target.value as 'simple' | 'verification' | 'password_reset' | 'daily_report')}
                    className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                  >
                    <option value="simple">Simple Test</option>
                    <option value="verification">Verification Email</option>
                    <option value="password_reset">Password Reset</option>
                    <option value="daily_report">Daily Report</option>
                  </select>
                </div>
              </div>

              <button
                onClick={testEmail}
                disabled={emailTesting || !testEmailAddress}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-neutral-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {emailTesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Test Email
                  </>
                )}
              </button>

              {/* Test Result */}
              {emailTestResult && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${
                  emailTestResult.type === 'success' 
                    ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                }`}>
                  {emailTestResult.type === 'success' ? (
                    <CheckCircle size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <p className={emailTestResult.type === 'success' 
                    ? 'text-green-800 dark:text-green-200 text-sm' 
                    : 'text-red-800 dark:text-red-200 text-sm'
                  }>
                    {emailTestResult.message}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Email Statistics */}
          {emailStats && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
              <h2 className="text-xl font-semibold mb-4">Email Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Active Users</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{emailStats.total_active_users}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Verified Users</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{emailStats.verified_users}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Email System</p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100 mt-1">
                    {emailStats.email_enabled ? '✓ Enabled' : '✗ Disabled'}
                  </p>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">SMTP Configuration</p>
                  <p className="text-lg font-bold text-orange-900 dark:text-orange-100 mt-1">
                    {emailStats.smtp_configured ? '✓ Configured' : '✗ Not Configured'}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Notification Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">Daily Reports:</span>{' '}
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{emailStats.notifications.daily_reports_enabled}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">Daily Changes:</span>{' '}
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{emailStats.notifications.daily_changes_enabled}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">Transactions:</span>{' '}
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{emailStats.notifications.transaction_notifications_enabled}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Create User</h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                <X size={20} />
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={createUser}>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Email</label>
                <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" placeholder="Email" type="email" value={newUser.email} onChange={(e)=>setNewUser({...newUser, email: e.target.value})} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Username</label>
                  <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" placeholder="Username" value={newUser.username} onChange={(e)=>setNewUser({...newUser, username: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Full name</label>
                  <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" placeholder="Full name" value={newUser.full_name} onChange={(e)=>setNewUser({...newUser, full_name: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Password</label>
                <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" placeholder="Password" type="password" value={newUser.password} onChange={(e)=>setNewUser({...newUser, password: e.target.value})} required />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!newUser.is_admin} onChange={(e)=>setNewUser({...newUser, is_admin: e.target.checked})} /> Admin</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!newUser.is_active} onChange={(e)=>setNewUser({...newUser, is_active: e.target.checked})} /> Active</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!newUser.is_verified} onChange={(e)=>setNewUser({...newUser, is_verified: e.target.checked})} /> Verified</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-neutral-400 text-white rounded-lg transition-colors">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditOpen && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Edit User</h2>
              <button onClick={closeEditModal} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                <X size={20} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={saveEdit}>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Email</label>
                <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" value={editPayload.email || ''} onChange={(e)=>setEditPayload(p=>({...p, email: e.target.value}))} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Username</label>
                  <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" value={editPayload.username || ''} onChange={(e)=>setEditPayload(p=>({...p, username: e.target.value}))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Full name</label>
                  <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" value={editPayload.full_name || ''} onChange={(e)=>setEditPayload(p=>({...p, full_name: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">New Password (optional)</label>
                <input className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700" type="password" value={editPayload.password || ''} onChange={(e)=>setEditPayload(p=>({...p, password: e.target.value}))} placeholder="Leave blank to keep current password" />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!editPayload.is_admin} onChange={(e)=>setEditPayload(p=>({...p, is_admin: e.target.checked}))} disabled={editingUser.is_superuser} /> Admin</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!editPayload.is_active} onChange={(e)=>setEditPayload(p=>({...p, is_active: e.target.checked}))} disabled={editingUser.is_superuser} /> Active</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!editPayload.is_verified} onChange={(e)=>setEditPayload(p=>({...p, is_verified: e.target.checked}))} /> Verified</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeEditModal} className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
