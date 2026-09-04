import React from 'react'

// Set up mocks before module execution
let capturedHandlerConfig: any = null
let capturedListenerCallback: ((notification: any) => void) | null = null
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
  modelName: 'Pixel 8',
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
    currentUser: { id: 'usr-1', name: 'Test User' },
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
    capturedListenerCallback = cb
    return {
      remove: mockRemoveSubscription,
    }
  }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue({}),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({
    data: 'ExponentPushToken[mock-token-xyz]',
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
import Constants from 'expo-constants'
import apiClient from '../api/client'
import { registerPushToken, deregisterPushToken } from '../api/endpoints'
import {
  NotificationHandler,
  mapNotificationTypeToToast,
} from '../components/NotificationHandler'
import { getEasProjectId } from '../hooks/usePushNotifications'

describe('Push Notifications & In-App Notification Handler', () => {
  let capturedEffectCleanup: (() => void) | void = undefined

  beforeEach(() => {
    jest.clearAllMocks()
    capturedEffectCleanup = undefined
    jest.spyOn(React, 'useEffect').mockImplementation((effect) => {
      capturedEffectCleanup = effect()
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('API Endpoints (registerPushToken & deregisterPushToken)', () => {
    it('registerPushToken calls POST /push-tokens with payload and returns data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'pt-uuid-1',
            user_id: 'usr-123',
            token: 'ExponentPushToken[abc-123]',
            device_name: 'Pixel 8',
            platform: 'android',
          },
          message: 'Push token registered successfully.',
        },
      }
      ;(apiClient.post as jest.Mock).mockResolvedValue(mockResponse)

      const payload = {
        token: 'ExponentPushToken[abc-123]',
        device_name: 'Pixel 8',
        platform: 'android' as const,
      }
      const result = await registerPushToken(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/push-tokens', payload)
      expect(result.data.token).toBe('ExponentPushToken[abc-123]')
      expect(result.data.user_id).toBe('usr-123')
      expect(result.success).toBe(true)
    })

    it('deregisterPushToken calls DELETE /push-tokens/{encodedToken} with URL encoded token', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: null,
          message: 'Push token deregistered successfully.',
        },
      }
      ;(apiClient.delete as jest.Mock).mockResolvedValue(mockResponse)

      const rawToken = 'ExponentPushToken[abc/123+xyz==]'
      const result = await deregisterPushToken(rawToken)

      expect(apiClient.delete).toHaveBeenCalledWith(
        `/push-tokens/${encodeURIComponent(rawToken)}`
      )
      expect(result.success).toBe(true)
    })
  })

  describe('EAS Project ID Fallback Resolution', () => {
    it('resolves EAS project ID from expoConfig', () => {
      expect(getEasProjectId()).toBe('f403c66d-8e4b-49a5-bc41-13de8ea312f6')
    })

    it('falls back to static ID when expoConfig is missing', () => {
      const originalConfig = Constants.expoConfig
      ;(Constants as any).expoConfig = null
      ;(Constants as any).easConfig = null

      expect(getEasProjectId()).toBe('f403c66d-8e4b-49a5-bc41-13de8ea312f6')

      ;(Constants as any).expoConfig = originalConfig
    })
  })

  describe('mapNotificationTypeToToast Mapping', () => {
    it('maps low_stock to warning', () => {
      expect(mapNotificationTypeToToast('low_stock')).toBe('warning')
      expect(mapNotificationTypeToToast('LOW_STOCK')).toBe('warning')
      expect(mapNotificationTypeToToast('  low_stock  ')).toBe('warning')
    })

    it('maps restock to info', () => {
      expect(mapNotificationTypeToToast('restock')).toBe('info')
      expect(mapNotificationTypeToToast('RESTOCK')).toBe('info')
    })

    it('maps order to success', () => {
      expect(mapNotificationTypeToToast('order')).toBe('success')
      expect(mapNotificationTypeToToast('ORDER')).toBe('success')
    })

    it('maps invoice to warning', () => {
      expect(mapNotificationTypeToToast('invoice')).toBe('warning')
      expect(mapNotificationTypeToToast('INVOICE')).toBe('warning')
    })

    it('maps audit to error', () => {
      expect(mapNotificationTypeToToast('audit')).toBe('error')
      expect(mapNotificationTypeToToast('AUDIT')).toBe('error')
    })

    it('maps unknown or empty types to info', () => {
      expect(mapNotificationTypeToToast('')).toBe('info')
      expect(mapNotificationTypeToToast(undefined)).toBe('info')
      expect(mapNotificationTypeToToast('something_else')).toBe('info')
    })
  })

  describe('Foreground Presentation Configuration', () => {
    it('configures setNotificationHandler to suppress banners and enable audio', async () => {
      NotificationHandler({})
      expect(Notifications.setNotificationHandler).toHaveBeenCalled()
      expect(capturedHandlerConfig).toBeDefined()
      expect(typeof capturedHandlerConfig.handleNotification).toBe('function')

      const behavior = await capturedHandlerConfig.handleNotification({} as any)
      expect(behavior.shouldShowAlert).toBe(false)
      expect(behavior.shouldShowBanner).toBe(false)
      expect(behavior.shouldShowList).toBe(false)
      expect(behavior.shouldPlaySound).toBe(true)
      expect(behavior.shouldSetBadge).toBe(false)
    })
  })

  describe('NotificationHandler Component Lifecycle & In-App Toast Routing', () => {
    it('executes usePushNotifications, registers listener, and cleans up on unmount', () => {
      // Render NotificationHandler
      const result = NotificationHandler({})
      expect(result).toBeNull()
      expect(mockUsePushNotifications).toHaveBeenCalled()
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled()
      expect(capturedListenerCallback).toBeDefined()

      // Verify unmount cleanup
      expect(typeof capturedEffectCleanup).toBe('function')
      if (typeof capturedEffectCleanup === 'function') {
        capturedEffectCleanup()
        expect(mockRemoveSubscription).toHaveBeenCalledTimes(1)
      }
    })

    it('routes low stock notification to warning toast with body', () => {
      NotificationHandler({})

      expect(capturedListenerCallback).toBeDefined()
      if (capturedListenerCallback) {
        capturedListenerCallback({
          request: {
            content: {
              title: 'Low Stock Alert: Organic Coffee',
              body: 'Stock is down to 2 units (Threshold: 5).',
              data: {
                type: 'low_stock',
                variant_id: 'var-101',
              },
            },
          },
        } as any)

        expect(mockShowToast).toHaveBeenCalledWith(
          'Stock is down to 2 units (Threshold: 5).',
          'warning'
        )
      }
    })

    it('routes order completed notification to success toast', () => {
      NotificationHandler({})

      if (capturedListenerCallback) {
        capturedListenerCallback({
          request: {
            content: {
              title: 'Order #1001 Completed',
              body: 'Checkout sale of $120.00 settled.',
              data: {
                type: 'order',
                order_id: 'ord-1001',
              },
            },
          },
        } as any)

        expect(mockShowToast).toHaveBeenCalledWith(
          'Checkout sale of $120.00 settled.',
          'success'
        )
      }
    })

    it('routes audit event notification to error toast', () => {
      NotificationHandler({})

      if (capturedListenerCallback) {
        capturedListenerCallback({
          request: {
            content: {
              title: 'Security Log: Role Change',
              body: 'Admin modified permissions.',
              data: {
                type: 'audit',
                audit_id: 'aud-201',
              },
            },
          },
        } as any)

        expect(mockShowToast).toHaveBeenCalledWith(
          'Admin modified permissions.',
          'error'
        )
      }
    })

    it('falls back to title when body is empty', () => {
      NotificationHandler({})

      if (capturedListenerCallback) {
        capturedListenerCallback({
          request: {
            content: {
              title: 'System Notice',
              body: '',
              data: {
                type: 'restock',
              },
            },
          },
        } as any)

        expect(mockShowToast).toHaveBeenCalledWith(
          'System Notice',
          'info'
        )
      }
    })

    it('falls back to "Notification" when both title and body are empty', () => {
      NotificationHandler({})

      if (capturedListenerCallback) {
        capturedListenerCallback({
          request: {
            content: {
              title: '',
              body: '',
              data: {},
            },
          },
        } as any)

        expect(mockShowToast).toHaveBeenCalledWith(
          'Notification',
          'info'
        )
      }
    })
  })
})

