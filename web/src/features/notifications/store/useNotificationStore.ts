import { create } from 'zustand'
import { api } from '@/api'

const NOTIFICATIONS_CACHE_TTL_MS = 60_000
const NOTIFICATIONS_STORAGE_KEY = 'portfolium.notifications.cache.v1'
let notificationsFetchPromise: Promise<void> | null = null
let unreadNotificationsFetchPromise: Promise<void> | null = null

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  message: string
  metadata: Record<string, unknown>
  is_read: boolean
  created_at: string
}

interface StoredNotificationsCache {
  notifications: Notification[]
  lastFetchedAt: number | null
  authToken: string | null
}

const emptyNotificationsCache: StoredNotificationsCache = {
  notifications: [],
  lastFetchedAt: null,
  authToken: null
}

function getCurrentAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem('auth_token')
}

function readNotificationsCache(): StoredNotificationsCache {
  if (typeof window === 'undefined') {
    return emptyNotificationsCache
  }

  try {
    const rawCache = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (!rawCache) {
      return emptyNotificationsCache
    }

    const parsedCache = JSON.parse(rawCache) as Partial<StoredNotificationsCache>
    const currentAuthToken = getCurrentAuthToken()
    if (!currentAuthToken || parsedCache.authToken !== currentAuthToken) {
      return emptyNotificationsCache
    }

    return {
      notifications: Array.isArray(parsedCache.notifications)
        ? parsedCache.notifications
        : [],
      lastFetchedAt:
        typeof parsedCache.lastFetchedAt === 'number'
          ? parsedCache.lastFetchedAt
          : null,
      authToken: currentAuthToken
    }
  } catch {
    return emptyNotificationsCache
  }
}

function writeNotificationsCache(
  notifications: Notification[],
  lastFetchedAt: number | null
) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const currentAuthToken = getCurrentAuthToken()
    window.localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify({
        notifications,
        lastFetchedAt,
        authToken: currentAuthToken
      })
    )
  } catch {
    // Ignore storage failures and keep the in-memory cache working.
  }
}

const initialNotificationsCache = readNotificationsCache()

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  lastFetchedAt: number | null
  
  // Actions
  fetchNotifications: (
    unreadOnly?: boolean,
    options?: { force?: boolean; background?: boolean }
  ) => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (notificationId: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: number) => Promise<void>
  refreshNotifications: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: initialNotificationsCache.notifications,
  unreadCount: initialNotificationsCache.notifications.filter((n) => !n.is_read).length,
  loading: false,
  error: null,
  lastFetchedAt: initialNotificationsCache.lastFetchedAt,

  fetchNotifications: async (unreadOnly = false, options = {}) => {
    const { force = false, background = false } = options
    const { notifications, lastFetchedAt } = get()
    const isFullListRequest = !unreadOnly
    const hasCachedNotifications = notifications.length > 0
    const isFresh =
      isFullListRequest &&
      lastFetchedAt !== null &&
      Date.now() - lastFetchedAt < NOTIFICATIONS_CACHE_TTL_MS

    if (!force && isFresh) {
      return
    }

    const activePromise = unreadOnly ? unreadNotificationsFetchPromise : notificationsFetchPromise
    if (activePromise) {
      return activePromise
    }

    const shouldShowLoading = !background || !hasCachedNotifications
    if (shouldShowLoading) {
      set({ loading: true, error: null })
    } else {
      set({ error: null })
    }

    const request = (async () => {
      try {
        const notifications = await api.getNotifications(0, 50, unreadOnly)
        const nextLastFetchedAt = unreadOnly ? get().lastFetchedAt : Date.now()
        set((state) => ({
          notifications,
          loading: false,
          error: null,
          lastFetchedAt: unreadOnly ? state.lastFetchedAt : nextLastFetchedAt
        }))
        if (isFullListRequest) {
          writeNotificationsCache(notifications, nextLastFetchedAt)
        }
      } catch (error) {
        set((state) => ({
          error: error instanceof Error ? error.message : 'Failed to fetch notifications',
          loading: shouldShowLoading ? false : state.loading
        }))
      } finally {
        if (unreadOnly) {
          unreadNotificationsFetchPromise = null
        } else {
          notificationsFetchPromise = null
        }
      }
    })()

    if (unreadOnly) {
      unreadNotificationsFetchPromise = request
    } else {
      notificationsFetchPromise = request
    }

    return request
  },

  fetchUnreadCount: async () => {
    try {
      const result = await api.getUnreadCount()
      set({ unreadCount: result.unread_count })
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  },

  markAsRead: async (notificationId: number) => {
    try {
      await api.markNotificationAsRead(notificationId)
      
      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }))
      const { notifications, lastFetchedAt } = get()
      writeNotificationsCache(notifications, lastFetchedAt)
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  },

  markAllAsRead: async () => {
    try {
      await api.markAllNotificationsAsRead()
      
      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0
      }))
      const { notifications, lastFetchedAt } = get()
      writeNotificationsCache(notifications, lastFetchedAt)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  },

  deleteNotification: async (notificationId: number) => {
    try {
      await api.deleteNotification(notificationId)
      
      // Update local state
      set((state) => {
        const notification = state.notifications.find((n) => n.id === notificationId)
        const wasUnread = notification && !notification.is_read
        
        return {
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        }
      })
      const { notifications, lastFetchedAt } = get()
      writeNotificationsCache(notifications, lastFetchedAt)
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  },

  refreshNotifications: async () => {
    const { fetchNotifications, fetchUnreadCount } = get()
    await Promise.all([
      fetchNotifications(false, { force: true }),
      fetchUnreadCount()
    ])
  }
}))
