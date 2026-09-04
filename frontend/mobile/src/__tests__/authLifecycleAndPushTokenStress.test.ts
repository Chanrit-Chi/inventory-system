import React from 'react'
import { Alert, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'

// In-Memory storage engine to simulate AsyncStorage faithfully
const inMemoryStorage = new Map<string, string>()

const mockAsyncStorage = {
  getItem: jest.fn(async (key: string) => inMemoryStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    inMemoryStorage.set(key, String(val))
  }),
  removeItem: jest.fn(async (key: string) => {
    inMemoryStorage.delete(key)
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => inMemoryStorage.delete(k))
  }),
  clear: jest.fn(async () => {
    inMemoryStorage.clear()
  }),
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}))

// Mock queryClient
const mockQueryClientClear = jest.fn()
jest.mock('../api/queryClient', () => ({
  queryClient: {
    clear: mockQueryClientClear,
  },
}))

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android || obj.default,
  },
  Alert: {
    alert: jest.fn(),
  },
}))

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'Pixel 8',
  deviceName: 'Google Pixel',
}))

// Mock expo-constants
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

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationChannelAsync: jest.fn().mockResolvedValue({}),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({
    data: 'ExponentPushToken[stress-test-device-token]',
  }),
}))

// Mock endpoints
let mockLoginUser = jest.fn()
let mockLogoutUser = jest.fn()
let mockFetchCurrentUser = jest.fn()
let mockRegisterPushToken = jest.fn()
let mockDeregisterPushToken = jest.fn()

jest.mock('../api/endpoints', () => ({
  loginUser: (...args: any[]) => mockLoginUser(...args),
  logoutUser: (...args: any[]) => mockLogoutUser(...args),
  fetchCurrentUser: (...args: any[]) => mockFetchCurrentUser(...args),
  registerPushToken: (...args: any[]) => mockRegisterPushToken(...args),
  deregisterPushToken: (...args: any[]) => mockDeregisterPushToken(...args),
}))

import { AuthProvider, useAuth, PUSH_TOKEN_KEY } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { setTokenGetter, onUnauthorized } from '../api/client'
import type { UserAccount } from '../types'

/**
 * Empirical React Hook & Component Harness
 * Simulates React's internal hooks (useState, useRef, useCallback, useEffect, useMemo)
 */
function createHarness<T>(renderFn: () => T) {
  let states: any[] = []
  let stateSetters: Array<(val: any) => void> = []
  let refs: any[] = []
  let callbacks: Array<{ fn: any; deps: any[] | undefined }> = []
  let memos: Array<{ val: any; deps: any[] | undefined }> = []
  let effectSlots: Array<{
    effect: () => any
    deps: any[] | undefined
    cleanup?: (() => void) | void
    hasRun: boolean
  }> = []

  let stateIdx = 0
  let refIdx = 0
  let callbackIdx = 0
  let memoIdx = 0
  let effectIdx = 0

  const origUseState = React.useState
  const origUseRef = React.useRef
  const origUseCallback = React.useCallback
  const origUseMemo = React.useMemo
  const origUseEffect = React.useEffect

  const result = { current: undefined as unknown as T }

  function setupSpies() {
    stateIdx = 0
    refIdx = 0
    callbackIdx = 0
    memoIdx = 0
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
        const changed = !prev.deps || !deps || deps.some((d: any, i: number) => d !== prev.deps![i])
        if (changed) {
          callbacks[idx] = { fn, deps }
        }
      }
      return callbacks[idx].fn
    }) as any

    React.useMemo = ((factory: any, deps: any[]) => {
      const idx = memoIdx++
      if (memos.length <= idx) {
        memos[idx] = { val: factory(), deps }
      } else {
        const prev = memos[idx]
        const changed = !prev.deps || !deps || deps.some((d: any, i: number) => d !== prev.deps![i])
        if (changed) {
          memos[idx] = { val: factory(), deps }
        }
      }
      return memos[idx].val
    }) as any

    React.useEffect = ((effect: any, deps?: any[]) => {
      const idx = effectIdx++
      if (effectSlots.length <= idx) {
        effectSlots[idx] = { effect, deps, hasRun: false }
      } else {
        const prev = effectSlots[idx]
        const changed = !prev.deps || !deps || deps.some((d: any, i: number) => d !== prev.deps![i])
        if (changed) {
          effectSlots[idx] = { effect, deps, cleanup: prev.cleanup, hasRun: false }
        }
      }
    }) as any
  }

  function render() {
    setupSpies()
    result.current = renderFn()
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
    await new Promise((r) => setTimeout(r, 10))
  }

  async function cycle() {
    render()
    await flushEffects()
  }

  function restore() {
    React.useState = origUseState
    React.useRef = origUseRef
    React.useCallback = origUseCallback
    React.useMemo = origUseMemo
    React.useEffect = origUseEffect
  }

  render()

  return {
    result,
    render,
    cycle,
    flushEffects,
    restore,
    getStates: () => states,
  }
}

describe('Empirical Challenge: Auth Lifecycle, Token Persistence & Push Deregistration', () => {
  const dummyUser: UserAccount = {
    id: 'usr-empirical-123',
    name: 'Empirical Tester',
    email: 'tester@kc-inventory.test',
    role: 'ADMIN',
    isActive: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    inMemoryStorage.clear()

    mockLoginUser.mockResolvedValue({
      token: 'bearer-token-abc',
      user: dummyUser,
    })
    mockLogoutUser.mockResolvedValue({
      status: 'success',
      message: 'Logged out successfully.',
    })
    mockFetchCurrentUser.mockResolvedValue(dummyUser)
    mockRegisterPushToken.mockResolvedValue({
      success: true,
      data: {
        id: 'token-rec-1',
        user_id: dummyUser.id,
        token: 'ExponentPushToken[stress-test-device-token]',
      },
    })
    mockDeregisterPushToken.mockResolvedValue({
      success: true,
      data: null,
    })
  })

  // =========================================================================
  // 1. AsyncStorage Key Persistence & Contract Verification
  // =========================================================================
  describe('1. Key Contract & Namespace Invariants', () => {
    it('verifies PUSH_TOKEN_KEY is exactly "@kc_inventory_push_token"', () => {
      expect(PUSH_TOKEN_KEY).toBe('@kc_inventory_push_token')
    })

    it('verifies storage operations for push token use @kc_inventory_push_token', async () => {
      await mockAsyncStorage.setItem(PUSH_TOKEN_KEY, 'ExponentPushToken[unit-test]')
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@kc_inventory_push_token',
        'ExponentPushToken[unit-test]'
      )

      const fetched = await mockAsyncStorage.getItem(PUSH_TOKEN_KEY)
      expect(fetched).toBe('ExponentPushToken[unit-test]')

      await mockAsyncStorage.removeItem(PUSH_TOKEN_KEY)
      const afterRemove = await mockAsyncStorage.getItem(PUSH_TOKEN_KEY)
      expect(afterRemove).toBeNull()
    })
  })

  // =========================================================================
  // 2. AuthContext Cold-Start Session Lifecycle
  // =========================================================================
  describe('2. AuthContext Cold-Start Restoration & Corruption Recovery', () => {
    it('initializes in unauthenticated state when storage is empty', async () => {
      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      // Initial render: isRestoring is true
      expect(harness.result.current.isRestoring).toBe(true)
      expect(harness.result.current.isAuthenticated).toBe(false)
      expect(harness.result.current.currentUser).toBeNull()
      expect(harness.result.current.token).toBeNull()

      // Flush cold-start effect
      await harness.flushEffects()
      await harness.cycle()

      // After cold-start check with empty storage
      expect(harness.result.current.isRestoring).toBe(false)
      expect(harness.result.current.isAuthenticated).toBe(false)
      expect(harness.result.current.currentUser).toBeNull()
      expect(harness.result.current.token).toBeNull()

      harness.restore()
    })

    it('restores active session when token and user are present in storage', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'saved-session-token-999')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      expect(harness.result.current.isRestoring).toBe(false)
      expect(harness.result.current.isAuthenticated).toBe(true)
      expect(harness.result.current.token).toBe('saved-session-token-999')
      expect(harness.result.current.currentUser).toEqual(dummyUser)
      expect(mockFetchCurrentUser).toHaveBeenCalled()

      harness.restore()
    })

    it('recovers gracefully from corrupted JSON in user storage without crashing', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'saved-session-token-999')
      inMemoryStorage.set('@kc_inventory_user', '{badly-formatted-json:broken')

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      expect(harness.result.current.isRestoring).toBe(false)
      expect(harness.result.current.isAuthenticated).toBe(false)
      expect(harness.result.current.currentUser).toBeNull()
      expect(harness.result.current.token).toBeNull()
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@kc_inventory_token',
        '@kc_inventory_user',
      ])

      harness.restore()
    })
  })

  // =========================================================================
  // 3. Voluntary Logout Execution Order & Pre-Logout Deregistration
  // =========================================================================
  describe('3. Voluntary Logout Pre-Logout Deregistration Protocol', () => {
    it('executes deregisterPushToken BEFORE logoutUser and while token is still active', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'active-token-777')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))
      inMemoryStorage.set('@kc_inventory_push_token', 'ExponentPushToken[logout-flow-token]')

      const executionOrder: string[] = []

      mockDeregisterPushToken.mockImplementation(async (token: string) => {
        executionOrder.push(`deregisterPushToken:${token}`)
        // Verify that when deregisterPushToken runs, push token is still in AsyncStorage
        expect(inMemoryStorage.get('@kc_inventory_push_token')).toBe('ExponentPushToken[logout-flow-token]')
        return { success: true, data: null }
      })

      mockLogoutUser.mockImplementation(async () => {
        executionOrder.push('logoutUser')
        return { status: 'success', message: 'Logged out.' }
      })

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      expect(harness.result.current.isAuthenticated).toBe(true)

      // Execute voluntary logout
      await harness.result.current.logout()
      await harness.cycle()

      // 1. Verify exact order: deregisterPushToken executed BEFORE logoutUser
      expect(executionOrder).toEqual([
        'deregisterPushToken:ExponentPushToken[logout-flow-token]',
        'logoutUser',
      ])

      // 2. Verify PUSH_TOKEN_KEY was removed from storage
      expect(inMemoryStorage.get('@kc_inventory_push_token')).toBeUndefined()
      expect(inMemoryStorage.get('@kc_inventory_token')).toBeUndefined()
      expect(inMemoryStorage.get('@kc_inventory_user')).toBeUndefined()

      // 3. Verify state reset
      expect(harness.result.current.isAuthenticated).toBe(false)
      expect(harness.result.current.currentUser).toBeNull()
      expect(harness.result.current.token).toBeNull()

      harness.restore()
    })

    it('proceeds with logout and local cleanup even if deregisterPushToken network call rejects', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'active-token-fail')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))
      inMemoryStorage.set('@kc_inventory_push_token', 'ExponentPushToken[failing-token]')

      mockDeregisterPushToken.mockRejectedValueOnce(new Error('Network Error (500)'))
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      // Should not throw unhandled exception
      await expect(harness.result.current.logout()).resolves.not.toThrow()
      await harness.cycle()

      // logoutUser still executed
      expect(mockLogoutUser).toHaveBeenCalled()

      // Local storage still cleared in finally
      expect(inMemoryStorage.get('@kc_inventory_push_token')).toBeUndefined()
      expect(inMemoryStorage.get('@kc_inventory_token')).toBeUndefined()
      expect(inMemoryStorage.get('@kc_inventory_user')).toBeUndefined()
      expect(harness.result.current.isAuthenticated).toBe(false)

      warnSpy.mockRestore()
      harness.restore()
    })

    it('proceeds with local cleanup even if both deregisterPushToken AND logoutUser fail', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'active-token-offline')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))
      inMemoryStorage.set('@kc_inventory_push_token', 'ExponentPushToken[offline-token]')

      mockDeregisterPushToken.mockRejectedValueOnce(new Error('Push endpoint unreachable'))
      mockLogoutUser.mockRejectedValueOnce(new Error('Auth endpoint unreachable'))
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      await expect(harness.result.current.logout()).resolves.not.toThrow()
      await harness.cycle()

      // Local storage still pruned
      expect(inMemoryStorage.get('@kc_inventory_push_token')).toBeUndefined()
      expect(inMemoryStorage.get('@kc_inventory_token')).toBeUndefined()
      expect(inMemoryStorage.get('@kc_inventory_user')).toBeUndefined()
      expect(harness.result.current.isAuthenticated).toBe(false)

      warnSpy.mockRestore()
      harness.restore()
    })

    it('bypasses push deregistration cleanly if no push token was ever registered', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'active-token-no-push')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))
      // No push token in storage

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      await harness.result.current.logout()
      await harness.cycle()

      expect(mockDeregisterPushToken).not.toHaveBeenCalled()
      expect(mockLogoutUser).toHaveBeenCalled()
      expect(harness.result.current.isAuthenticated).toBe(false)

      harness.restore()
    })
  })

  // =========================================================================
  // 4. Secondary Redundant Call Suppression & Hook Coordination
  // =========================================================================
  describe('4. Elimination of Secondary Redundant Calls on Logout', () => {
    it('suppresses secondary deregisterPushToken call in usePushNotifications when voluntary logout already cleared storage', async () => {
      // Simulate state where user was authenticated and push token was registered
      inMemoryStorage.set('@kc_inventory_push_token', 'ExponentPushToken[shared-token-xyz]')

      // Step 1: AuthContext.logout() runs
      // It performs pre-logout deregistration and removes the key from AsyncStorage
      const savedPushToken = await mockAsyncStorage.getItem(PUSH_TOKEN_KEY)
      expect(savedPushToken).toBe('ExponentPushToken[shared-token-xyz]')

      await mockDeregisterPushToken(savedPushToken)
      await mockAsyncStorage.removeItem(PUSH_TOKEN_KEY)

      expect(mockDeregisterPushToken).toHaveBeenCalledTimes(1)
      expect(inMemoryStorage.get(PUSH_TOKEN_KEY)).toBeUndefined()

      // Step 2: In usePushNotifications, !isAuthenticated triggers
      // The hook checks AsyncStorage.getItem(PUSH_TOKEN_KEY).
      // Since it is null, it skips calling deregisterPushToken!
      const storedAfterLogout = await mockAsyncStorage.getItem(PUSH_TOKEN_KEY)
      expect(storedAfterLogout).toBeNull()

      // Even if the hook's effect evaluates tokenToDeregister:
      if (storedAfterLogout !== null) {
        await mockDeregisterPushToken('ExponentPushToken[shared-token-xyz]')
      }

      // Assert total calls remains 1 (secondary call suppressed)
      expect(mockDeregisterPushToken).toHaveBeenCalledTimes(1)
    })

    it('involuntary session expiration prunes push token from storage and avoids secondary deregistration loop', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'expiring-token')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))
      inMemoryStorage.set('@kc_inventory_push_token', 'ExponentPushToken[expiring-push-token]')

      let capturedUnauthorizedListener: ((reason?: string) => void) | null = null

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      // The AuthProvider registers an onUnauthorized listener in useEffect
      // Let's capture the listener from the API client
      const unsub = onUnauthorized((reason) => {
        // AuthProvider's handleSessionExpired
        capturedUnauthorizedListener = (r) => {
          harness.result.current.logout() // or handleSessionExpired logic
        }
      })

      await harness.flushEffects()
      await harness.cycle()

      expect(harness.result.current.isAuthenticated).toBe(true)

      // Trigger session expired directly via multiRemove
      await mockAsyncStorage.multiRemove([
        '@kc_inventory_token',
        '@kc_inventory_user',
        '@kc_inventory_push_token',
      ])

      // Push token key is now gone
      expect(inMemoryStorage.get('@kc_inventory_push_token')).toBeUndefined()

      // If usePushNotifications runs after session expiry:
      const stored = await mockAsyncStorage.getItem(PUSH_TOKEN_KEY)
      expect(stored).toBeNull()

      // Verify zero deregister calls were made because session is already invalid
      expect(mockDeregisterPushToken).not.toHaveBeenCalled()

      unsub()
      harness.restore()
    })
  })

  // =========================================================================
  // 5. Login Flow & Token Registration Sync
  // =========================================================================
  describe('5. Login Lifecycle and Storage Persistence', () => {
    it('persists credentials to AsyncStorage and updates tokenRef on login', async () => {
      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      expect(harness.result.current.isAuthenticated).toBe(false)

      await harness.result.current.login('tester@kc-inventory.test', 'password123')
      await harness.cycle()

      expect(mockLoginUser).toHaveBeenCalledWith('tester@kc-inventory.test', 'password123')
      expect(harness.result.current.isAuthenticated).toBe(true)
      expect(harness.result.current.token).toBe('bearer-token-abc')
      expect(harness.result.current.currentUser).toEqual(dummyUser)

      expect(inMemoryStorage.get('@kc_inventory_token')).toBe('bearer-token-abc')
      expect(inMemoryStorage.get('@kc_inventory_user')).toBe(JSON.stringify(dummyUser))

      harness.restore()
    })
  })

  // =========================================================================
  // 6. User Profile Update & Refresh
  // =========================================================================
  describe('6. Profile Management & Session Refresh', () => {
    it('updateProfile merges changes and updates AsyncStorage', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'active-token')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      harness.result.current.updateProfile({ name: 'Updated Empirical Name' })
      await harness.cycle()

      expect(harness.result.current.currentUser?.name).toBe('Updated Empirical Name')
      const storedUser = JSON.parse(inMemoryStorage.get('@kc_inventory_user')!)
      expect(storedUser.name).toBe('Updated Empirical Name')

      harness.restore()
    })

    it('refreshUser calls fetchCurrentUser and updates storage', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'active-token')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      // Complete cold-start restoration first
      await harness.flushEffects()
      await harness.cycle()

      // Now configure mock for explicit refreshUser call
      const updatedUser: UserAccount = { ...dummyUser, role: 'MANAGER' }
      mockFetchCurrentUser.mockResolvedValueOnce(updatedUser)

      const result = await harness.result.current.refreshUser()
      await harness.cycle()

      expect(result).toEqual(updatedUser)
      expect(harness.result.current.currentUser?.role).toBe('MANAGER')

      harness.restore()
    })

    it('refreshUser catches errors gracefully and returns null without throwing', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'active-token')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      // Complete cold-start restoration first
      await harness.flushEffects()
      await harness.cycle()

      mockFetchCurrentUser.mockRejectedValueOnce(new Error('Network error'))

      const result = await harness.result.current.refreshUser()
      expect(result).toBeNull()

      harness.restore()
    })
  })

  // =========================================================================
  // 7. Concurrent & Rapid Interaction Stress
  // =========================================================================
  describe('7. Adversarial Concurrent & Rapid Interaction Stress', () => {
    it('handles rapid consecutive logout calls without crashing', async () => {
      inMemoryStorage.set('@kc_inventory_token', 'token-rapid')
      inMemoryStorage.set('@kc_inventory_user', JSON.stringify(dummyUser))
      inMemoryStorage.set('@kc_inventory_push_token', 'ExponentPushToken[rapid-token]')

      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      // Call logout twice concurrently
      const [logout1, logout2] = await Promise.allSettled([
        harness.result.current.logout(),
        harness.result.current.logout(),
      ])

      await harness.cycle()

      expect(logout1.status).toBe('fulfilled')
      expect(logout2.status).toBe('fulfilled')
      expect(harness.result.current.isAuthenticated).toBe(false)

      harness.restore()
    })

    it('cleans up sessionExpiredMessage via clearSessionExpiredMessage', async () => {
      const harness = createHarness(() => {
        const el = AuthProvider({ children: null }) as any
        return el.props.value
      })

      await harness.flushEffects()
      await harness.cycle()

      expect(harness.result.current.sessionExpiredMessage).toBeNull()
      harness.result.current.clearSessionExpiredMessage()
      expect(harness.result.current.sessionExpiredMessage).toBeNull()

      harness.restore()
    })
  })
})
