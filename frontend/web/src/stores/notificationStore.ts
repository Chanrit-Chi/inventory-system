import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/axios'

export interface HeaderNotification {
  id: string
  title: string
  desc: string
  time: string
  created_at?: string
  variant: 'warning' | 'info' | 'success' | 'danger'
  unread: boolean
  to?: string
  type?: string
}

export const useNotificationStore = defineStore('notification', () => {
  // Fallback initial sample data if backend is empty / initial load
  const defaultFallbackNotifications: HeaderNotification[] = [
    {
      id: 'n-1',
      title: 'Low Stock Alert: Optical Mouse',
      desc: 'Wireless Optical Mouse (SKU: MOU-001) is down to 3 units.',
      time: '4m ago',
      variant: 'warning',
      unread: true,
      to: '/inventory',
    },
    {
      id: 'n-2',
      title: 'Restock Batch #RS-9942 Verified',
      desc: 'Inbound shipment from TechSupply Co. added 120 items.',
      time: '38m ago',
      variant: 'info',
      unread: true,
      to: '/restock',
    },
    {
      id: 'n-3',
      title: 'POS Register Sync Complete',
      desc: 'Register #1 recorded 18 checkout sales ($1,480.00).',
      time: '2h ago',
      variant: 'success',
      unread: false,
      to: '/orders',
    },
  ]

  const notifications = ref<HeaderNotification[]>([...defaultFallbackNotifications])
  const isLoading = ref(false)
  const isPolling = ref(false)
  const lastFetched = ref<string | null>(null)
  const notificationFilter = ref<'all' | 'unread'>('all')

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let visibilityListener: (() => void) | null = null

  const unreadCount = computed(() => {
    return notifications.value.filter((n) => n.unread).length
  })

  const filteredNotifications = computed(() => {
    if (notificationFilter.value === 'unread') {
      return notifications.value.filter((n) => n.unread)
    }
    return notifications.value
  })

  const hasUnread = computed(() => unreadCount.value > 0)

  /**
   * Helper to format relative time client-side if needed.
   */
  function formatTime(isoString?: string): string {
    if (!isoString) return 'Just now'
    try {
      const date = new Date(isoString)
      const diffMs = Date.now() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      const diffDays = Math.floor(diffHours / 24)
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return 'Recently'
    }
  }

  /**
   * Fetch active notifications from backend.
   */
  async function fetchNotifications(silent = false) {
    if (!silent) {
      isLoading.value = true
    }

    try {
      const res = await api.get('/notifications')
      const data = res.data?.data ?? res.data
      if (Array.isArray(data) && data.length > 0) {
        notifications.value = data.map((item) => ({
          id: String(item.id || crypto.randomUUID()),
          title: item.title || 'System Notification',
          desc: item.desc || '',
          time: item.time || (item.created_at ? formatTime(item.created_at) : 'Just now'),
          created_at: item.created_at,
          variant: item.variant || 'info',
          unread: Boolean(item.unread),
          to: item.to || undefined,
          type: item.type || undefined,
        }))
      } else if (Array.isArray(data) && data.length === 0 && notifications.value.length === 0) {
        notifications.value = [...defaultFallbackNotifications]
      }
      lastFetched.value = new Date().toISOString()
    } catch (err) {
      // If network fails and list is empty, initialize with default fallback
      if (notifications.value.length === 0) {
        notifications.value = [...defaultFallbackNotifications]
      }
    } finally {
      if (!silent) {
        isLoading.value = false
      }
    }
  }

  /**
   * Mark an individual notification as read.
   */
  async function markAsRead(id: string) {
    const target = notifications.value.find((n) => n.id === id)
    if (target) {
      target.unread = false
    }

    try {
      await api.patch(`/notifications/${encodeURIComponent(id)}/read`)
    } catch {
      // Optimistic state preserved locally
    }
  }

  /**
   * Mark all active notifications as read.
   */
  async function markAllAsRead() {
    notifications.value.forEach((n) => {
      n.unread = false
    })

    try {
      await api.post('/notifications/mark-all-read')
    } catch {
      // Optimistic state preserved locally
    }
  }

  /**
   * Dismiss/hide a notification.
   */
  async function dismiss(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id)

    try {
      await api.delete(`/notifications/${encodeURIComponent(id)}`)
    } catch {
      // Optimistic state preserved locally
    }
  }

  /**
   * Push a local live event (e.g. from local actions or websocket).
   */
  function pushLocalNotification(item: Partial<HeaderNotification> & { title: string; desc: string }) {
    const newNotif: HeaderNotification = {
      id: item.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      desc: item.desc,
      time: item.time || 'Just now',
      created_at: item.created_at || new Date().toISOString(),
      variant: item.variant || 'info',
      unread: item.unread ?? true,
      to: item.to,
      type: item.type || 'local',
    }

    notifications.value.unshift(newNotif)
  }

  /**
   * Start polling with window visibility awareness.
   */
  function startPolling(intervalMs = 30000) {
    if (isPolling.value) return
    isPolling.value = true

    // Initial silent fetch
    fetchNotifications(true)

    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return // Pause polling while tab is in background
      }
      fetchNotifications(true)
    }, intervalMs)

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      visibilityListener = () => {
        if (!document.hidden) {
          fetchNotifications(true)
        }
      }
      document.addEventListener('visibilitychange', visibilityListener)
    }
  }

  /**
   * Stop background polling.
   */
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityListener)
      visibilityListener = null
    }
    isPolling.value = false
  }

  return {
    notifications,
    isLoading,
    isPolling,
    lastFetched,
    notificationFilter,
    unreadCount,
    filteredNotifications,
    hasUnread,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    dismiss,
    pushLocalNotification,
    startPolling,
    stopPolling,
    defaultFallbackNotifications,
  }
})
