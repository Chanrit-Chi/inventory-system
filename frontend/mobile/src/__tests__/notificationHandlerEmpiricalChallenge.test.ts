import React from 'react'

// Track mocks and registrations
let capturedHandlerConfig: any = null
let capturedListenerCallbacks: Array<(notification: any) => void> = []
const mockRemoveSubscription = jest.fn()

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android || obj.default,
  },
  Alert: { alert: jest.fn() },
}))

jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'Pixel 8 Pro',
  deviceName: 'Google Pixel',
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}))

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 'challenger-usr-99', name: 'Challenger QA' },
    isAuthenticated: true,
  }),
}))

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
  },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  setNotificationHandler: jest.fn((config) => {
    capturedHandlerConfig = config
  }),
  addNotificationReceivedListener: jest.fn((cb) => {
    capturedListenerCallbacks.push(cb)
    return {
      remove: mockRemoveSubscription,
    }
  }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue({}),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({
    data: 'ExponentPushToken[challenger-token-xyz]',
  }),
}))

const mockShowToast = jest.fn()
const mockHideToast = jest.fn()
jest.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
    hideToast: mockHideToast,
  }),
}))

const mockUsePushNotifications = jest.fn()
jest.mock('../hooks/usePushNotifications', () => {
  const actual = jest.requireActual('../hooks/usePushNotifications')
  return {
    ...actual,
    usePushNotifications: () => mockUsePushNotifications(),
  }
})

jest.mock('../api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    delete: jest.fn(),
  },
  apiClient: {
    post: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'f403c66d-8e4b-49a5-bc41-13de8ea312f6',
        },
      },
    },
  },
}))

import * as Notifications from 'expo-notifications'
import {
  NotificationHandler,
  mapNotificationTypeToToast,
} from '../components/NotificationHandler'

describe('Empirical Challenge: Mobile Foreground Presentation, Alert Mapping & Lifecycle', () => {
  let activeCleanups: Array<() => void> = []

  beforeEach(() => {
    jest.clearAllMocks()
    capturedListenerCallbacks = []
    activeCleanups = []
    jest.spyOn(React, 'useEffect').mockImplementation((effect) => {
      const cleanup = effect()
      if (typeof cleanup === 'function') {
        activeCleanups.push(cleanup)
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // =========================================================================
  // CHALLENGE 1: Foreground Notification Presentation Configuration
  // =========================================================================
  describe('Challenge 1: Foreground Notification Presentation Configuration', () => {
    it('sets handler configuration that suppresses native alert banners while enabling audio chime', async () => {
      NotificationHandler({})
      expect(Notifications.setNotificationHandler).toHaveBeenCalled()
      expect(capturedHandlerConfig).toBeDefined()
      expect(typeof capturedHandlerConfig.handleNotification).toBe('function')

      // Invoke handler with realistic notification
      const result = await capturedHandlerConfig.handleNotification({
        request: {
          content: {
            title: 'Test Notification',
            body: 'Test Body',
          },
        },
      })

      // Must explicitly suppress native alert banner
      expect(result.shouldShowAlert).toBe(false)
      expect(result.shouldShowBanner).toBe(false)
      expect(result.shouldShowList).toBe(false)

      // Must explicitly enable audio chimes
      expect(result.shouldPlaySound).toBe(true)

      // Must not modify badge unexpectedly
      expect(result.shouldSetBadge).toBe(false)
    })

    it('stress harness: 1000 concurrent handleNotification invocations with edge-case payloads', async () => {
      NotificationHandler({})
      const handleNotification = capturedHandlerConfig.handleNotification

      const payloads = [
        null,
        undefined,
        {},
        { request: null },
        { request: { content: null } },
        { request: { content: { title: '', body: '' } } },
        { request: { content: { title: 'A'.repeat(5000), body: 'B'.repeat(10000) } } },
      ]

      const promises = Array.from({ length: 1000 }, (_, i) => {
        const payload = payloads[i % payloads.length]
        return handleNotification(payload)
      })

      const results = await Promise.all(promises)

      expect(results).toHaveLength(1000)
      for (const res of results) {
        expect(res.shouldShowAlert).toBe(false)
        expect(res.shouldShowBanner).toBe(false)
        expect(res.shouldShowList).toBe(false)
        expect(res.shouldPlaySound).toBe(true)
        expect(res.shouldSetBadge).toBe(false)
      }
    })
  })

  // =========================================================================
  // CHALLENGE 2: Alert Type Mapping Across All Events & Fuzzing
  // =========================================================================
  describe('Challenge 2: Alert Type Mapping Across All Events', () => {
    it('accurately maps canonical notification types to their designated toast types', () => {
      const canonicalMatrix: Record<string, string> = {
        low_stock: 'warning',
        restock: 'info',
        order: 'success',
        invoice: 'warning',
        audit: 'error',
      }

      for (const [type, expectedToast] of Object.entries(canonicalMatrix)) {
        expect(mapNotificationTypeToToast(type)).toBe(expectedToast)
      }
    })

    it('handles uppercase, mixed case, and excessive whitespace padding', () => {
      const caseVariants: Array<[string, string]> = [
        ['LOW_STOCK', 'warning'],
        ['Low_Stock', 'warning'],
        ['  low_stock  ', 'warning'],
        ['\t\nlow_stock\r\n', 'warning'],
        ['RESTOCK', 'info'],
        ['ReStock', 'info'],
        ['  restock  ', 'info'],
        ['ORDER', 'success'],
        ['Order', 'success'],
        ['  order  ', 'success'],
        ['INVOICE', 'warning'],
        ['Invoice', 'warning'],
        ['  invoice  ', 'warning'],
        ['AUDIT', 'error'],
        ['Audit', 'error'],
        ['  audit  ', 'error'],
      ]

      for (const [input, expected] of caseVariants) {
        expect(mapNotificationTypeToToast(input)).toBe(expected)
      }
    })

    it('falls back safely to "info" on unknown, empty, or missing types', () => {
      const fallbacks = [
        undefined,
        '',
        '   ',
        'unknown_event',
        'billing_issue',
        'refund_processed',
        'system_alert',
        'null',
        'undefined',
        'zero',
      ]

      for (const input of fallbacks) {
        expect(mapNotificationTypeToToast(input)).toBe('info')
      }
    })

    it('fuzz testing: 500 arbitrary adversarial strings fall back deterministically to "info"', () => {
      const seedChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~` \t\n'
      const knownCanonical = new Set(['low_stock', 'restock', 'order', 'invoice', 'audit'])

      for (let i = 0; i < 500; i++) {
        // Generate random string
        const len = Math.floor(Math.random() * 50) + 1
        let randomStr = ''
        for (let j = 0; j < len; j++) {
          randomStr += seedChars[Math.floor(Math.random() * seedChars.length)]
        }

        const normalized = randomStr.toLowerCase().trim()
        const result = mapNotificationTypeToToast(randomStr)

        if (knownCanonical.has(normalized)) {
          expect(['warning', 'info', 'success', 'error']).toContain(result)
        } else {
          expect(result).toBe('info')
        }
      }
    })
  })

  // =========================================================================
  // CHALLENGE 3: Notification Listener Toast Routing & Payload Edge Cases
  // =========================================================================
  describe('Challenge 3: In-App Notification Toast Routing & Payload Handling', () => {
    it('dispatches appropriate toast for all 5 backend event payloads', () => {
      NotificationHandler({})
      expect(capturedListenerCallbacks.length).toBeGreaterThan(0)
      const listener = capturedListenerCallbacks[capturedListenerCallbacks.length - 1]

      const testEvents = [
        {
          payload: {
            title: 'Low Stock Alert: Item A',
            body: 'Only 1 unit remaining.',
            data: { type: 'low_stock', variant_id: 'var-1' },
          },
          expectedMsg: 'Only 1 unit remaining.',
          expectedType: 'warning',
        },
        {
          payload: {
            title: 'Restock Batch #REC-900',
            body: 'Restock session completed.',
            data: { type: 'restock', session_id: 'sess-1' },
          },
          expectedMsg: 'Restock session completed.',
          expectedType: 'info',
        },
        {
          payload: {
            title: 'Order #ORD-101 Completed',
            body: 'Sale of $450.00 settled.',
            data: { type: 'order', order_id: 'ord-1' },
          },
          expectedMsg: 'Sale of $450.00 settled.',
          expectedType: 'success',
        },
        {
          payload: {
            title: 'Invoice #INV-202 Overdue',
            body: 'Balance of $1,200.00 pending.',
            data: { type: 'invoice', invoice_id: 'inv-1' },
          },
          expectedMsg: 'Balance of $1,200.00 pending.',
          expectedType: 'warning',
        },
        {
          payload: {
            title: 'Security Log: Permission Change',
            body: 'Super Admin revoked seller token.',
            data: { type: 'audit', audit_id: 'aud-1' },
          },
          expectedMsg: 'Super Admin revoked seller token.',
          expectedType: 'error',
        },
      ]

      for (const ev of testEvents) {
        mockShowToast.mockClear()
        listener({
          request: {
            content: ev.payload,
          },
        } as any)

        expect(mockShowToast).toHaveBeenCalledTimes(1)
        expect(mockShowToast).toHaveBeenCalledWith(ev.expectedMsg, ev.expectedType)
      }
    })

    it('falls back to data.notification_type if data.type is missing', () => {
      NotificationHandler({})
      const listener = capturedListenerCallbacks[capturedListenerCallbacks.length - 1]

      mockShowToast.mockClear()
      listener({
        request: {
          content: {
            title: 'Legacy Invoice',
            body: 'Payment overdue notice.',
            data: { notification_type: 'invoice' },
          },
        },
      } as any)

      expect(mockShowToast).toHaveBeenCalledWith('Payment overdue notice.', 'warning')
    })

    it('prefers data.type over data.notification_type if both are present', () => {
      NotificationHandler({})
      const listener = capturedListenerCallbacks[capturedListenerCallbacks.length - 1]

      mockShowToast.mockClear()
      listener({
        request: {
          content: {
            title: 'Multi-type Event',
            body: 'Order event occurred.',
            data: { type: 'order', notification_type: 'audit' },
          },
        },
      } as any)

      expect(mockShowToast).toHaveBeenCalledWith('Order event occurred.', 'success')
    })

    it('handles empty body by falling back to title, and empty title by falling back to "Notification"', () => {
      NotificationHandler({})
      const listener = capturedListenerCallbacks[capturedListenerCallbacks.length - 1]

      // Case 1: Body is empty, title is present
      mockShowToast.mockClear()
      listener({
        request: {
          content: {
            title: 'Urgent Restock Needed',
            body: '   ',
            data: { type: 'restock' },
          },
        },
      } as any)
      expect(mockShowToast).toHaveBeenCalledWith('Urgent Restock Needed', 'info')

      // Case 2: Both body and title are empty whitespace
      mockShowToast.mockClear()
      listener({
        request: {
          content: {
            title: '   ',
            body: '   ',
            data: { type: 'unknown' },
          },
        },
      } as any)
      expect(mockShowToast).toHaveBeenCalledWith('Notification', 'info')

      // Case 3: Content missing entirely
      mockShowToast.mockClear()
      listener({} as any)
      expect(mockShowToast).toHaveBeenCalledWith('Notification', 'info')
    })

    it('survives malformed or completely unexpected notification objects without throwing', () => {
      NotificationHandler({})
      const listener = capturedListenerCallbacks[capturedListenerCallbacks.length - 1]

      const malformedCases = [
        null,
        undefined,
        {},
        { request: null },
        { request: { content: null } },
        { request: { content: { data: null } } },
      ]

      for (const badNotification of malformedCases) {
        expect(() => listener(badNotification as any)).not.toThrow()
      }
    })
  })

  // =========================================================================
  // CHALLENGE 4: Listener Unmount Cleanup & Lifecycle Safety
  // =========================================================================
  describe('Challenge 4: Listener Unmount Cleanup & Lifecycle Safety', () => {
    it('strictly calls subscription.remove() when NotificationHandler unmounts', () => {
      NotificationHandler({})
      expect(activeCleanups.length).toBe(1)
      expect(mockRemoveSubscription).not.toHaveBeenCalled()

      // Execute unmount cleanup
      activeCleanups[0]()
      expect(mockRemoveSubscription).toHaveBeenCalledTimes(1)
    })

    it('stress harness: 50 rapid mount and unmount cycles clean up every subscription', () => {
      mockRemoveSubscription.mockClear()

      for (let i = 0; i < 50; i++) {
        activeCleanups = []
        NotificationHandler({})
        expect(activeCleanups.length).toBe(1)
        activeCleanups[0]()
      }

      expect(mockRemoveSubscription).toHaveBeenCalledTimes(50)
    })

    it('headless contract: NotificationHandler returns null and invokes usePushNotifications', () => {
      const rendered = NotificationHandler({})
      expect(rendered).toBeNull()
      expect(mockUsePushNotifications).toHaveBeenCalled()
    })
  })
})
