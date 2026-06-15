/* eslint-disable @typescript-eslint/no-explicit-any */
import { request } from '@/api/client'

// Notifications
export async function getNotifications(skip: number = 0, limit: number = 50, unreadOnly: boolean = false) {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
    unread_only: unreadOnly.toString()
  })
  return request<Array<{
    id: number
    user_id: number
    type: string
    title: string
    message: string
    metadata: Record<string, any>
    is_read: boolean
    created_at: string
  }>>(`/notifications?${params.toString()}`)
}

export async function getUnreadCount() {
  return request<{ unread_count: number }>('/notifications/unread-count')
}

export async function markNotificationAsRead(notificationId: number) {
  return request<any>(`/notifications/${notificationId}/read`, {
    method: 'PUT'
  })
}

export async function markAllNotificationsAsRead() {
  return request<{ marked_read: number }>('/notifications/mark-all-read', {
    method: 'PUT'
  })
}

export async function deleteNotification(notificationId: number) {
  return request<void>(`/notifications/${notificationId}`, {
    method: 'DELETE'
  })
}
