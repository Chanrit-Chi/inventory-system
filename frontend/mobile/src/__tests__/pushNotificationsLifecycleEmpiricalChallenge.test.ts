import React from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { registerPushToken, deregisterPushToken } from '../api/endpoints'
import apiClient from '../api/client'
import {
  usePushNotifications,
  getEasProjectId,
} from '../hooks/usePushNotifications'
import {
  NotificationHandler,
  mapNotificationTypeToToast,
} from '../components/NotificationHandler'

// State variables for dynamic mocking
var mockCapturedSetHandlerConfig: any = null
let mockPlatformOS = 'android'
let mockIsDevice = true
let mockModelName = 'Pixel 8'
let mockDeviceName = 'Google Pixel'
let mockExpoConfig: any = {
  extra: {
    eas: {
      projectId: 'f403c66d-8e4b-49a5-bc41-13de8ea312f6',
    },
  },
}
let mockEasConfig: any = {
  projectId: 'f403c66d-8e4b-49a5-bc41-13de8ea312f6',
}

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS
    },
    set OS(val: string) {
      mockPlatformOS = val
    },
    select: (obj: any) => obj[mockPlatformOS] || obj.default,
  },
  Alert: { alert: jest.fn() },
}))

// Mock expo-device
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice
  },
  set isDevice(val: boolean) {
    mockIsDevice = val
  },
  get modelName() {
    return mockModelName
  },
  set modelName(val: string) {
    mockModelName = val
  },
  get deviceName() {
    return mockDeviceName
  },
  set deviceName(val: string) {
    mockDeviceName = val
  },
}))

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig
    },
    set expoConfig(val: any) {
      mockExpoConfig = val
    },
    get easConfig() {
      return mockEasConfig
    },
    set easConfig(val: any) {
      mockEasConfig = val
    },
  },
}))

// Mock expo-notifications
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
    mockCapturedSetHandlerConfig = config
  }),
  addNotificationReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  setNotificationChannelAsync: jest.fn().mockResolvedValue({}),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({
    data: 'ExponentPushToken[emp-token-abc]',
  }),
}))

// Mock AuthContext
let mockAuthState = {
  currentUser: { id: 'usr-ch-1', name: 'Challenger User' } as any,
  isAuthenticated: true,
}

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}))

// Mock API endpoints
jest.mock('../api/endpoints', () => {
  const actual = jest.requireActual('../api/endpoints')
  return {
    ...actual,
    registerPushToken: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'rec-1',
        user_id: 'usr-ch-1',
        token: 'ExponentPushToken[emp-token-abc]',
      },
    }),
    deregisterPushToken: jest.fn().mockResolvedValue({
      success: true,
      data: null,
    }),
  }
})

// Mock apiClient for endpoints-level testing
jest.mock('../api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({ data: { success: true, data: null } }),
    delete: jest.fn().mockResolvedValue({ data: { success: true, data: null } }),
  },
  apiClient: {
    post: jest.fn().mockResolvedValue({ data: { success: true, data: null } }),
    delete: jest.fn().mockResolvedValue({ data: { success: true, data: null } }),
  },
}))

// Mock ToastContext
const mockShowToast = jest.fn()
jest.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

/**
 * Empirical Hook Harness:
 * Simulates React's internal fiber state, memoized callbacks, and effect queues
 * across renders in a pure Node/Jest environment.
 */
function createHookHarness<T>(hookFn: () => T) {
  let states: any[] = []
  let stateSetters: Array<(val: any) => void> = []
  let refs: any[] = []
  let callbacks: Array<{ fn: any; deps: any[] | undefined }> = []
  let effectSlots: Array<{
    effect: () => any
    deps: any[] | undefined
    cleanup?: (() => void) | void
    hasRun: boolean
  }> = []

  let stateIdx = 0
  let refIdx = 0
  let callbackIdx = 0
  let effectIdx = 0

  const originalUseState = React.useState
  const originalUseRef = React.useRef
  const originalUseCallback = React.useCallback
  const originalUseEffect = React.useEffect

  const result = { current: undefined as unknown as T }

  function setupSpies() {
    stateIdx = 0
    refIdx = 0
    callbackIdx = 0
    effectIdx = 0

    React.useState = ((initial: any) => {
      const idx = stateIdx++
      if (states.length <= idx) {
        states[idx] = typeof initial === 'function' ? initial() : initial
        stateSetters[idx] = (val: any) => {
          states[idx] = typeof val === 'function' ? val(states[idx]) : val
        }
      }
      return [states[idx], stateSetters[idx]]
    }) as any

    React.useRef = ((initial: any) => {
      const idx = refIdx++
      if (refs.length <= idx) {
        refs[idx] = { current: initial }
      }
      return refs[idx]
    }) as any

    React.useCallback = ((fn: any, deps: any[]) => {
      const idx = callbackIdx++
      if (callbacks.length <= idx) {
        callbacks[idx] = { fn, deps }
      } else {
        const prev = callbacks[idx]
        const changed =
          !prev.deps || !deps || deps.some((d: any, i: number) => d !== prev.deps![i])
        if (changed) {
          callbacks[idx] = { fn, deps }
        }
      }
      return callbacks[idx].fn
    }) as any

    React.useEffect = ((effect: any, deps?: any[]) => {
      const idx = effectIdx++
      if (effectSlots.length <= idx) {
        effectSlots[idx] = { effect, deps, hasRun: false }
      } else {
        const prev = effectSlots[idx]
        const changed =
          !prev.deps || !deps || deps.some((d: any, i: number) => d !== prev.deps![i])
        if (changed) {
          effectSlots[idx] = { effect, deps, cleanup: prev.cleanup, hasRun: false }
        }
      }
    }) as any
  }

  async function flushAsync() {
    await new Promise((r) => setTimeout(r, 20))
  }

  async function flushEffects() {
    for (let i = 0; i < effectSlots.length; i++) {
      const slot = effectSlots[i]
      if (slot && !slot.hasRun) {
        slot.hasRun = true
        if (typeof slot.cleanup === 'function') {
          slot.cleanup()
        }
        const cleanup = slot.effect()
        if (cleanup && typeof cleanup.then === 'function') {
          slot.cleanup = await cleanup
        } else {
          slot.cleanup = cleanup
        }
      }
    }
    await flushAsync()
  }

  function render() {
    setupSpies()
    result.current = hookFn()
  }

  async function cycle() {
    render()
    await flushEffects()
  }

  async function unmount() {
    for (const slot of effectSlots) {
      if (slot && typeof slot.cleanup === 'function') {
        slot.cleanup()
      }
    }
  }

  function restore() {
    React.useState = originalUseState
    React.useRef = originalUseRef
    React.useCallback = originalUseCallback
    React.useEffect = originalUseEffect
  }

  render()

  return {
    result,
    render,
    cycle,
    flushEffects,
    unmount,
    restore,
  }
}

describe('Empirical Challenge: Mobile Push Registration & Token Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCapturedSetHandlerConfig = null
    mockIsDevice = true
    mockModelName = 'Pixel 8'
    mockDeviceName = 'Google Pixel'
    mockPlatformOS = 'android'
    mockExpoConfig = {
      extra: {
        eas: {
          projectId: 'f403c66d-8e4b-49a5-bc41-13de8ea312f6',
        },
      },
    }
    mockEasConfig = {
      projectId: 'f403c66d-8e4b-49a5-bc41-13de8ea312f6',
    }
    mockAuthState = {
      currentUser: { id: 'usr-ch-1', name: 'Challenger User' },
      isAuthenticated: true,
    }
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Notifications.PermissionStatus.GRANTED,
    })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Notifications.PermissionStatus.GRANTED,
    })
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[emp-token-abc]',
    })
    ;(Notifications.setNotificationChannelAsync as jest.Mock).mockResolvedValue({})
    ;(registerPushToken as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'rec-1',
        user_id: 'usr-ch-1',
        token: 'ExponentPushToken[emp-token-abc]',
      },
    })
    ;(deregisterPushToken as jest.Mock).mockResolvedValue({
      success: true,
      data: null,
    })
  })

  // =========================================================================
  // CHALLENGE 1: Simulator / Emulator Guard (Device.isDevice === false)
  // =========================================================================
  describe('Challenge 1: Non-device Simulator / Emulator Guard', () => {
    it('when Device.isDevice === false, throws zero exceptions and makes ZERO native push calls', async () => {
      mockIsDevice = false

      const harness = createHookHarness(() => usePushNotifications())

      // Flush mount effects and cycle
      await harness.flushEffects()
      await harness.cycle()

      // 1. Hook state guarantees
      expect(harness.result.current.expoPushToken).toBeNull()
      expect(harness.result.current.isRegistered).toBe(false)

      // 2. Zero native calls guarantee
      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled()
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled()
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled()

      // 3. Zero backend registration guarantee
      expect(registerPushToken).not.toHaveBeenCalled()

      // 4. Manual registerDevice invocation on simulator returns null cleanly
      const token = await harness.result.current.registerDevice()
      expect(token).toBeNull()

      harness.restore()
    })

    it('simulator guard logs diagnostic message in __DEV__ mode without unhandled rejection', async () => {
      mockIsDevice = false
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()

      const token = await harness.result.current.registerDevice()
      expect(token).toBeNull()
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Push notifications are not supported on simulators/emulators')
      )

      logSpy.mockRestore()
      harness.restore()
    })
  })

  // =========================================================================
  // CHALLENGE 2: Permission Rejection Flow
  // =========================================================================
  describe('Challenge 2: Permission Rejection Flow', () => {
    it('when permissions return denied, sets permissionStatus: "denied" without crashing and does not query Expo push token', async () => {
      mockIsDevice = true
      ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Notifications.PermissionStatus.DENIED,
      })
      ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Notifications.PermissionStatus.DENIED,
      })

      const harness = createHookHarness(() => usePushNotifications())

      // Run mount effect (registerDevice) and cycle to propagate state
      await harness.flushEffects()
      await harness.cycle()

      // 1. Verify permission query and request occurred
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled()
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()

      // 2. Verify permissionStatus state updated to denied
      expect(harness.result.current.permissionStatus).toBe(Notifications.PermissionStatus.DENIED)

      // 3. Verify getExpoPushTokenAsync was NEVER called
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled()

      // 4. Verify token and registration remain unset
      expect(harness.result.current.expoPushToken).toBeNull()
      expect(harness.result.current.isRegistered).toBe(false)
      expect(registerPushToken).not.toHaveBeenCalled()

      harness.restore()
    })

    it('when permissions are already granted, avoids duplicate requestPermissionsAsync prompt', async () => {
      mockIsDevice = true
      ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Notifications.PermissionStatus.GRANTED,
      })

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()

      expect(Notifications.getPermissionsAsync).toHaveBeenCalled()
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
      expect(harness.result.current.permissionStatus).toBe(Notifications.PermissionStatus.GRANTED)
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled()

      harness.restore()
    })
  })

  // =========================================================================
  // CHALLENGE 3: EAS Project ID Fallback Resolution
  // =========================================================================
  describe('Challenge 3: EAS Project ID Resolution and Fallback', () => {
    it('resolves EAS Project ID dynamically from Constants.expoConfig.extra.eas.projectId', () => {
      mockExpoConfig = {
        extra: { eas: { projectId: 'custom-eas-uuid-123' } },
      }
      mockEasConfig = null

      expect(getEasProjectId()).toBe('custom-eas-uuid-123')
    })

    it('falls back to Constants.easConfig.projectId when expoConfig extra is absent', () => {
      mockExpoConfig = null
      mockEasConfig = { projectId: 'eas-config-uuid-456' }

      expect(getEasProjectId()).toBe('eas-config-uuid-456')
    })

    it('falls back to hardcoded production project ID when both configs are null or empty', () => {
      mockExpoConfig = null
      mockEasConfig = null

      expect(getEasProjectId()).toBe('f403c66d-8e4b-49a5-bc41-13de8ea312f6')
    })

    it('passes resolved projectId to Notifications.getExpoPushTokenAsync during registration', async () => {
      mockIsDevice = true
      mockExpoConfig = {
        extra: { eas: { projectId: 'dynamic-proj-id-999' } },
      }

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()

      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: 'dynamic-proj-id-999',
      })

      harness.restore()
    })
  })

  // =========================================================================
  // CHALLENGE 4: Android vs iOS Channel Configuration
  // =========================================================================
  describe('Challenge 4: Platform Channel Configuration', () => {
    it('configures Android channel with high priority on Android platform', async () => {
      mockIsDevice = true
      mockPlatformOS = 'android'

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      })

      harness.restore()
    })

    it('catches Android notification channel error gracefully without crashing flow', async () => {
      mockIsDevice = true
      mockPlatformOS = 'android'
      ;(Notifications.setNotificationChannelAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Channel permission error')
      )
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()

      // Flow proceeds despite channel error
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled()
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to set Android notification channel:'),
        expect.any(Error)
      )

      warnSpy.mockRestore()
      harness.restore()
    })

    it('does not attempt setNotificationChannelAsync on iOS', async () => {
      mockIsDevice = true
      mockPlatformOS = 'ios'

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()

      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled()

      harness.restore()
    })
  })

  // =========================================================================
  // CHALLENGE 5: Token Acquisition Failure Resilience
  // =========================================================================
  describe('Challenge 5: Token Acquisition Failure Resilience', () => {
    it('catches getExpoPushTokenAsync rejection gracefully and returns null', async () => {
      mockIsDevice = true
      ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Firebase service unavailable')
      )
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()

      expect(harness.result.current.expoPushToken).toBeNull()
      expect(harness.result.current.isRegistered).toBe(false)
      expect(registerPushToken).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error acquiring Expo push token:'),
        expect.any(Error)
      )

      warnSpy.mockRestore()
      harness.restore()
    })
  })

  // =========================================================================
  // CHALLENGE 6: Login & Authenticated Backend Synchronization
  // =========================================================================
  describe('Challenge 6: Authenticated Backend Synchronization (POST /api/v1/push-tokens)', () => {
    it('dispatches registerPushToken when user is authenticated with token and device metadata', async () => {
      mockIsDevice = true
      mockModelName = 'Galaxy S24'
      mockPlatformOS = 'android'
      mockAuthState = {
        currentUser: { id: 'usr-ch-100', name: 'Manager Bob' },
        isAuthenticated: true,
      }

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects() // 1. Runs registerDevice()
      await harness.cycle()        // 2. Propagates expoPushToken to state, triggers login sync effect
      await harness.cycle()        // 3. registerPushToken finishes, updates isRegistered to true

      expect(registerPushToken).toHaveBeenCalledWith({
        token: 'ExponentPushToken[emp-token-abc]',
        device_name: 'Galaxy S24',
        platform: 'android',
      })
      expect(harness.result.current.isRegistered).toBe(true)

      harness.restore()
    })

    it('does NOT register token if user is unauthenticated initially', async () => {
      mockIsDevice = true
      mockAuthState = {
        currentUser: null,
        isAuthenticated: false,
      }

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects() // Runs registerDevice()
      await harness.cycle()        // Propagates token to state

      // Device acquired token, but backend sync was bypassed because !isAuthenticated
      expect(harness.result.current.expoPushToken).toBe('ExponentPushToken[emp-token-abc]')
      expect(harness.result.current.isRegistered).toBe(false)
      expect(registerPushToken).not.toHaveBeenCalled()

      harness.restore()
    })

    it('synchronizes token immediately when user transitions from unauthenticated to authenticated', async () => {
      mockIsDevice = true
      mockAuthState = {
        currentUser: null,
        isAuthenticated: false,
      }

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects() // Runs registerDevice()
      await harness.cycle()        // Propagates token

      expect(registerPushToken).not.toHaveBeenCalled()

      // User logs in
      mockAuthState = {
        currentUser: { id: 'usr-seller-55', name: 'Seller Sam' },
        isAuthenticated: true,
      }

      await harness.cycle() // Runs login sync effect -> calls registerPushToken
      await harness.cycle() // Updates isRegistered to true

      expect(registerPushToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'ExponentPushToken[emp-token-abc]',
        })
      )
      expect(harness.result.current.isRegistered).toBe(true)

      harness.restore()
    })

    it('handles backend registration network failure gracefully without throwing uncaught rejection', async () => {
      mockIsDevice = true
      ;(registerPushToken as jest.Mock).mockRejectedValueOnce(
        new Error('HTTP 500 Internal Server Error')
      )
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()
      await harness.cycle()

      expect(registerPushToken).toHaveBeenCalled()
      expect(harness.result.current.isRegistered).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync push token with backend:'),
        expect.any(Error)
      )

      warnSpy.mockRestore()
      harness.restore()
    })

    it('re-registers push token when authenticated user switches accounts', async () => {
      mockIsDevice = true
      mockAuthState = {
        currentUser: { id: 'usr-1', name: 'User 1' },
        isAuthenticated: true,
      }

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()
      await harness.cycle()

      expect(registerPushToken).toHaveBeenCalledTimes(1)

      // Switch to User 2
      mockAuthState = {
        currentUser: { id: 'usr-2', name: 'User 2' },
        isAuthenticated: true,
      }

      await harness.cycle()
      await harness.cycle()

      // Re-registers with backend for User 2
      expect(registerPushToken).toHaveBeenCalledTimes(2)

      harness.restore()
    })
  })

  // =========================================================================
  // CHALLENGE 7: Logout Deregistration (DELETE /api/v1/push-tokens/{token})
  // =========================================================================
  describe('Challenge 7: Logout Deregistration Flow', () => {
    it('dispatches deregisterPushToken when authenticated user logs out', async () => {
      mockIsDevice = true
      mockAuthState = {
        currentUser: { id: 'usr-logged-in', name: 'Logged In User' },
        isAuthenticated: true,
      }

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()
      await harness.cycle()

      expect(harness.result.current.isRegistered).toBe(true)
      expect(deregisterPushToken).not.toHaveBeenCalled()

      // User logs out
      mockAuthState = {
        currentUser: null,
        isAuthenticated: false,
      }

      await harness.cycle()
      await harness.cycle()

      expect(deregisterPushToken).toHaveBeenCalledWith('ExponentPushToken[emp-token-abc]')
      expect(harness.result.current.isRegistered).toBe(false)

      harness.restore()
    })

    it('catches deregisterPushToken failure silently on logout (e.g. session already invalidated)', async () => {
      mockIsDevice = true
      ;(deregisterPushToken as jest.Mock).mockRejectedValueOnce(
        new Error('HTTP 401 Unauthorized - Session Already Dead')
      )
      mockAuthState = {
        currentUser: { id: 'usr-test', name: 'Test' },
        isAuthenticated: true,
      }

      const harness = createHookHarness(() => usePushNotifications())
      await harness.flushEffects()
      await harness.cycle()
      await harness.cycle()

      // Log out
      mockAuthState = {
        currentUser: null,
        isAuthenticated: false,
      }

      // Should not throw unhandled rejection
      await expect(harness.cycle()).resolves.not.toThrow()
      await expect(harness.cycle()).resolves.not.toThrow()

      expect(deregisterPushToken).toHaveBeenCalled()
      expect(harness.result.current.isRegistered).toBe(false)

      harness.restore()
    })

    it('deregisterPushToken endpoint properly encodes tokens with special URI characters (+, /, =)', async () => {
      const actualEndpoints = jest.requireActual('../api/endpoints')
      const adversarialToken = 'ExponentPushToken[+abc/xyz=123==]'

      ;(apiClient.delete as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: null },
      })

      const response = await actualEndpoints.deregisterPushToken(adversarialToken)

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/push-tokens/ExponentPushToken%5B%2Babc%2Fxyz%3D123%3D%3D%5D'
      )
      expect(response.success).toBe(true)
    })
  })

  // =========================================================================
  // CHALLENGE 8: In-App Toast Presentation and Foreground Suppression
  // =========================================================================
  describe('Challenge 8: Foreground Suppression and In-App Toast Routing', () => {
    it('sets foreground notification handler with banner suppression and sound enabled', async () => {
      const harness = createHookHarness(() => NotificationHandler({}))
      await harness.flushEffects()

      expect(mockCapturedSetHandlerConfig).toBeDefined()
      const behavior = await mockCapturedSetHandlerConfig.handleNotification({} as any)

      expect(behavior.shouldShowAlert).toBe(false)
      expect(behavior.shouldShowBanner).toBe(false)
      expect(behavior.shouldShowList).toBe(false)
      expect(behavior.shouldPlaySound).toBe(true)
      expect(behavior.shouldSetBadge).toBe(false)

      harness.restore()
    })

    it('exhaustively maps all alert types to appropriate semantic toast types', () => {
      expect(mapNotificationTypeToToast('low_stock')).toBe('warning')
      expect(mapNotificationTypeToToast('restock')).toBe('info')
      expect(mapNotificationTypeToToast('order')).toBe('success')
      expect(mapNotificationTypeToToast('invoice')).toBe('warning')
      expect(mapNotificationTypeToToast('audit')).toBe('error')

      // Case insensitivity and whitespace trimming
      expect(mapNotificationTypeToToast('  LOW_STOCK  ')).toBe('warning')
      expect(mapNotificationTypeToToast('Restock')).toBe('info')
      expect(mapNotificationTypeToToast('ORDER')).toBe('success')

      // Fallbacks
      expect(mapNotificationTypeToToast('unknown_custom_alert')).toBe('info')
      expect(mapNotificationTypeToToast('')).toBe('info')
      expect(mapNotificationTypeToToast(undefined)).toBe('info')
    })
  })
})
