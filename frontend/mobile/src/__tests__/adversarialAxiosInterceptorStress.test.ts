import React from 'react'
import { Alert } from 'react-native'
import { AxiosRequestConfig, AxiosResponse } from 'axios'
import apiClient, {
  setTokenGetter,
  onUnauthorized,
  onConnectionChange,
} from '../api/client'
import { AuthProvider, useAuth } from '../context/AuthContext'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: any) => obj.ios || obj.default,
  },
  Alert: {
    alert: jest.fn(),
  },
}))

// Mock async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}))

describe('Adversarial Stress Test: Axios 401 Interceptor & Alert.alert Prevention', () => {
  let originalAdapter: any

  beforeAll(() => {
    originalAdapter = apiClient.defaults.adapter
  })

  afterAll(() => {
    apiClient.defaults.adapter = originalAdapter
    setTokenGetter(() => null)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    setTokenGetter(() => null)
  })

  function create401AxiosError(
    url?: string,
    headers: Record<string, string> = {},
    data: any = { message: 'Unauthenticated.' }
  ) {
    const config: AxiosRequestConfig = {
      url,
      headers: headers as any,
    }
    const error: any = new Error('Request failed with status code 401')
    error.isAxiosError = true
    error.config = config
    error.response = {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
      data,
    }
    return error
  }

  // =========================================================================
  // 1. Unauthenticated Requests Receiving 401 NEVER Trigger onUnauthorized
  // =========================================================================
  describe('Unauthenticated 401 Requests', () => {
    const unauthenticatedEndpoints = [
      '/orders',
      '/products',
      '/customers',
      '/inventory/ledger',
      '/dashboard/summary',
      '/settings/store-branding',
      '/api/v1/random-protected-route',
      '',
    ]

    it.each(unauthenticatedEndpoints)(
      'guarantees onUnauthorized is NEVER called for unauthenticated request to %s',
      async (endpoint) => {
        setTokenGetter(() => null)
        const listener = jest.fn()
        const unsub = onUnauthorized(listener)

        apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
          return Promise.reject(create401AxiosError(config.url, config.headers as any))
        })

        await expect(apiClient.get(endpoint)).rejects.toThrow()
        expect(listener).not.toHaveBeenCalled()

        unsub()
      }
    )

    it('guarantees onUnauthorized is NEVER called when token getter returns empty string', async () => {
      setTokenGetter(() => '')
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      await expect(apiClient.get('/products')).rejects.toThrow()
      expect(listener).not.toHaveBeenCalled()

      unsub()
    })

    it('guarantees onUnauthorized is NEVER called when token getter returns undefined as any', async () => {
      setTokenGetter(() => undefined as any)
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      await expect(apiClient.get('/orders')).rejects.toThrow()
      expect(listener).not.toHaveBeenCalled()

      unsub()
    })
  })

  // =========================================================================
  // 2. Push-Token Endpoints Receiving 401 NEVER Trigger onUnauthorized
  // =========================================================================
  describe('Push-Token Endpoints Receiving 401', () => {
    const pushTokenUrls = [
      '/push-tokens',
      '/push-tokens/ExponentPushToken%5Btest-token-123%5D',
      '/push-tokens/ExponentPushToken[raw-bracket-token]',
      'http://backend.test/api/v1/push-tokens',
      'http://backend.test/api/v1/push-tokens/ExponentPushToken%5Babc%2Bdef%2Fghi%3D%5D',
      'https://api.domain.com/v1/push-tokens/ExponentPushToken[123]?device=ios&env=test',
      '/api/v1/push-tokens/deregister/batch',
    ]

    it.each(pushTokenUrls)(
      'guarantees onUnauthorized is NEVER called for push-token url: %s even when user holds valid token',
      async (pushUrl) => {
        setTokenGetter(() => 'valid-bearer-token-12345')
        const listener = jest.fn()
        const unsub = onUnauthorized(listener)

        apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
          return Promise.reject(create401AxiosError(config.url, config.headers as any))
        })

        await expect(apiClient.delete(pushUrl)).rejects.toThrow('Unauthenticated.')
        expect(listener).not.toHaveBeenCalled()

        unsub()
      }
    )

    it('guarantees onUnauthorized is NEVER called for push-token POST when user holds valid token', async () => {
      setTokenGetter(() => 'valid-bearer-token-12345')
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      await expect(
        apiClient.post('/push-tokens', { token: 'ExponentPushToken[xyz]' })
      ).rejects.toThrow('Unauthenticated.')
      expect(listener).not.toHaveBeenCalled()

      unsub()
    })

    it('guarantees onUnauthorized is NEVER called for push-token DELETE when client has NO token', async () => {
      setTokenGetter(() => null)
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      await expect(
        apiClient.delete('/push-tokens/ExponentPushToken%5Bunauth%5D')
      ).rejects.toThrow('Unauthenticated.')
      expect(listener).not.toHaveBeenCalled()

      unsub()
    })
  })

  // =========================================================================
  // 3. Stress Test: High-Concurrency Burst (50 Parallel Requests)
  // =========================================================================
  describe('High-Concurrency Burst & Interleaving', () => {
    it('survives 50 concurrent unauthenticated 401s without triggering a single listener call', async () => {
      setTokenGetter(() => null)
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      const requests = Array.from({ length: 50 }).map((_, i) =>
        apiClient.get(`/test-resource-${i}`).catch((e) => e)
      )

      await Promise.all(requests)

      expect(listener).toHaveBeenCalledTimes(0)
      unsub()
    })

    it('survives 50 concurrent push-token 401s with active auth token without triggering a single listener call', async () => {
      setTokenGetter(() => 'authenticated-user-token')
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      const requests = Array.from({ length: 50 }).map((_, i) =>
        apiClient.delete(`/push-tokens/token-${i}`).catch((e) => e)
      )

      await Promise.all(requests)

      expect(listener).toHaveBeenCalledTimes(0)
      unsub()
    })

    it('accurately distinguishes interleaved unauthenticated, push-tokens, and authenticated 401s', async () => {
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      // 1. Unauthenticated request (no token) -> should NOT notify
      setTokenGetter(() => null)
      await apiClient.get('/inventory').catch(() => {})
      expect(listener).toHaveBeenCalledTimes(0)

      // 2. Push token request with auth -> should NOT notify
      setTokenGetter(() => 'valid-token')
      await apiClient.delete('/push-tokens/tok123').catch(() => {})
      expect(listener).toHaveBeenCalledTimes(0)

      // 3. Login bad credentials -> should NOT notify
      setTokenGetter(() => null)
      await apiClient.post('/auth/login', {}).catch(() => {})
      expect(listener).toHaveBeenCalledTimes(0)

      // 4. Authenticated normal protected endpoint -> MUST notify!
      setTokenGetter(() => 'valid-token')
      await apiClient.get('/orders').catch(() => {})
      expect(listener).toHaveBeenCalledTimes(1)

      // 5. Subsequent push token request with auth -> should NOT notify again
      await apiClient.delete('/push-tokens/tok456').catch(() => {})
      expect(listener).toHaveBeenCalledTimes(1)

      // 6. Another authenticated normal protected endpoint -> MUST notify again
      await apiClient.get('/customers').catch(() => {})
      expect(listener).toHaveBeenCalledTimes(2)

      unsub()
    })
  })

  // =========================================================================
  // 4. End-to-End Alert.alert Verification with AuthContext
  // =========================================================================
  describe('Alert.alert Prevention in AuthContext Integration', () => {
    it('guarantees Alert.alert is NEVER called for unauthenticated 401 responses', async () => {
      // Simulate unauthenticated state in client
      setTokenGetter(() => null)

      // Directly register an unauthorized handler that behaves like AuthContext
      const mockAlert = jest.spyOn(Alert, 'alert')
      const handleUnauthorized = jest.fn((reason?: string) => {
        Alert.alert('Session Expired', reason)
      })

      const unsub = onUnauthorized(handleUnauthorized)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      // Send 10 unauthenticated requests
      for (let i = 0; i < 10; i++) {
        await apiClient.get(`/protected-route-${i}`).catch(() => {})
      }

      expect(handleUnauthorized).not.toHaveBeenCalled()
      expect(mockAlert).not.toHaveBeenCalled()

      unsub()
    })

    it('guarantees Alert.alert is NEVER called during push token cleanup logout flow when server returns 401', async () => {
      const mockAlert = jest.spyOn(Alert, 'alert')
      const handleUnauthorized = jest.fn((reason?: string) => {
        Alert.alert('Session Expired', reason)
      })

      const unsub = onUnauthorized(handleUnauthorized)

      // Simulate push token deregistration during logout:
      // Endpoint returns 401 (e.g. session was already closed or token unauth)
      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(
          create401AxiosError('/push-tokens/ExponentPushToken%5Btest%5D', config.headers as any)
        )
      })

      // Client performs push-token deregistration
      setTokenGetter(() => 'old-session-token')
      await apiClient.delete('/push-tokens/ExponentPushToken%5Btest%5D').catch(() => {})

      expect(handleUnauthorized).not.toHaveBeenCalled()
      expect(mockAlert).not.toHaveBeenCalled()

      unsub()
    })

    it('triggers Alert.alert exactly once when authenticated session genuinely expires on a protected endpoint', async () => {
      let isAlerting = false
      const mockAlert = jest.spyOn(Alert, 'alert')

      const handleUnauthorized = jest.fn((reason?: string) => {
        if (!isAlerting) {
          isAlerting = true
          Alert.alert('Session Expired', reason)
        }
      })

      const unsub = onUnauthorized(handleUnauthorized)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(create401AxiosError(config.url, config.headers as any))
      })

      setTokenGetter(() => 'valid-bearer-token')
      await apiClient.get('/orders').catch(() => {})

      expect(handleUnauthorized).toHaveBeenCalledTimes(1)
      expect(mockAlert).toHaveBeenCalledTimes(1)
      expect(mockAlert).toHaveBeenCalledWith(
        'Session Expired',
        'Your session was terminated because another device signed into this account, or your session has expired.'
      )

      unsub()
    })
  })

  // =========================================================================
  // 5. Malformed / Extreme Corner Cases
  // =========================================================================
  describe('Extreme Corner Cases', () => {
    it('handles 401 when config.url is undefined', async () => {
      setTokenGetter(() => 'valid-token')
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        const err = create401AxiosError(undefined, config.headers as any)
        delete err.config.url
        return Promise.reject(err)
      })

      await expect(apiClient.get('')).rejects.toThrow()
      // Since url is undefined, url is '', not exempt, and token exists -> listener should be called
      expect(listener).toHaveBeenCalledTimes(1)

      unsub()
    })

    it('handles 401 when error.config itself is undefined on error object', async () => {
      setTokenGetter(() => 'valid-token')
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn(() => {
        const err: any = new Error('Weird 401 error without config')
        err.isAxiosError = true
        err.response = { status: 401, data: { message: 'Unauthorized' } }
        return Promise.reject(err)
      })

      await expect(apiClient.get('/anything')).rejects.toThrow()
      // Since _getToken() returns 'valid-token', hasAuthCredentials evaluates to true, not exempt -> notified
      expect(listener).toHaveBeenCalledTimes(1)

      unsub()
    })

    it('handles 401 when response.data is null or non-object', async () => {
      setTokenGetter(() => null)
      const listener = jest.fn()
      const unsub = onUnauthorized(listener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        const err = create401AxiosError('/test', config.headers as any, null)
        return Promise.reject(err)
      })

      await expect(apiClient.get('/test')).rejects.toThrow('Server error (401)')
      expect(listener).not.toHaveBeenCalled()

      unsub()
    })
  })
})
