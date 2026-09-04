import React, { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { useToast, ToastType } from '../context/ToastContext'
import { usePushNotifications } from '../hooks/usePushNotifications'

/**
 * Configure foreground notification presentation handler.
 * Suppresses native OS notification banners while app is active in foreground,
 * while allowing audio alerts to chime.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/**
 * Notification payload data contract sent by backend PushNotificationService.
 */
export interface NotificationPayloadData {
  type?: string
  notification_type?: string
  id?: string
  variant_id?: string
  session_id?: string
  order_id?: string
  invoice_id?: string
  audit_id?: string
  to?: string
  [key: string]: unknown
}

/**
 * Map backend notification types to ToastType:
 * - low_stock -> warning
 * - restock   -> info
 * - order     -> success
 * - invoice   -> warning
 * - audit     -> error
 * - default   -> info
 */
export function mapNotificationTypeToToast(type?: string): ToastType {
  switch (type?.toLowerCase().trim()) {
    case 'low_stock':
      return 'warning'
    case 'restock':
      return 'info'
    case 'order':
      return 'success'
    case 'invoice':
      return 'warning'
    case 'audit':
      return 'error'
    default:
      return 'info'
  }
}

export interface NotificationHandlerProps {}

/**
 * NotificationHandler component
 *
 * 1. Invokes `usePushNotifications()` to manage device push token registration/deregistration.
 * 2. Listens for foreground push notifications via `Notifications.addNotificationReceivedListener`.
 * 3. Extracts notification body, title, and type payload.
 * 4. Dispatches an in-app toast notification via `useToast().showToast`.
 * 5. Cleans up subscription on unmount.
 *
 * Headless controller component returning null.
 */
export const NotificationHandler: React.FC<NotificationHandlerProps> = () => {
  // Mount push notification lifecycle management (permissions, token registration, logout cleanup)
  usePushNotifications()

  // Retrieve toast trigger from context
  const { showToast } = useToast()

  useEffect(() => {
    // Re-verify notification handler registration in effect lifecycle
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const content = notification?.request?.content
        const title = content?.title?.trim() || ''
        const body = content?.body?.trim() || ''
        const data = (content?.data as NotificationPayloadData) || {}
        const notificationType = data.type || data.notification_type || ''

        const toastType = mapNotificationTypeToToast(notificationType)
        const message = body || title || 'Notification'

        showToast(message, toastType)
      } catch (error) {
        console.warn('[NotificationHandler] Failed to process notification:', error)
      }
    })

    return () => {
      subscription.remove()
    }
  }, [showToast])

  return null
}

export default NotificationHandler
