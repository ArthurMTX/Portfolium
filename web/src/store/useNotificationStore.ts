import { create } from 'zustand'
import { api } from '../lib/api'

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

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  
  // Actions
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (notificationId: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: number) => Promise<void>
  refreshNotifications: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  fetchNotifications: async (unreadOnly = false) => {
    set({ loading: true, error: null })
    try {
      const notifications = await api.getNotifications(0, 50, unreadOnly)
      set({ notifications, loading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch notifications',
        loading: false 
      })
    }
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
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  },

  refreshNotifications: async () => {
    const { fetchNotifications, fetchUnreadCount } = get()
    await Promise.all([
      fetchNotifications(),
      fetchUnreadCount()
    ])
  }
}))
