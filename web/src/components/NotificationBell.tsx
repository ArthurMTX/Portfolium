import { Bell } from 'lucide-react'
import { useNotificationStore } from '../store/useNotificationStore'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NotificationDropdown from './NotificationDropdown'

export default function NotificationBell() {
  const navigate = useNavigate()
  const { unreadCount, fetchUnreadCount } = useNotificationStore()
  const [isHovered, setIsHovered] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Fetch unread count on mount
    fetchUnreadCount()

    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  const handleMouseEnter = () => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    // Show dropdown immediately on hover
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    // Add a small delay before hiding to allow moving to dropdown
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 200)
  }

  const handleClick = () => {
    // Navigate to notifications page on click
    navigate('/notifications')
  }

  // Cancel hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div 
      className="relative" 
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isHovered && (
        <NotificationDropdown 
          onClose={() => setIsHovered(false)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </div>
  )
}
