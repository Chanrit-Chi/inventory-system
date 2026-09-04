import { AxiosRequestConfig, AxiosResponse } from 'axios'
import apiClient, {
  setTokenGetter,
  onUnauthorized,
  onConnectionChange,
} from '../api/client'

describe('apiClient Interceptors & 401 Exemption Rules', () => {
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

  /**
   * Helper to create a mock rejected Axios error matching AxiosError contract
   */
  function createAxios401Error(url: string, headers: Record<string, string> = {}) {
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
      data: {
        message: 'Unauthenticated.',
      },
    }
    return error
  }

  // =========================================================================
  // 1. Request Interceptor: Bearer Token Attachment
  // =========================================================================
  describe('Request Interceptor', () => {
    it('attaches Authorization header when _getToken provides an active token', async () => {
      setTokenGetter(() => 'test-bearer-token-xyz')

      let capturedConfig: any = null
      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        capturedConfig = config
        return Promise.resolve({
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse)
      })

      await apiClient.get('/test-endpoint')

      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig.headers['Authorization']).toBe('Bearer test-bearer-token-xyz')
    })

    it('does NOT attach Authorization header when _getToken returns null', async () => {
      setTokenGetter(() => null)

      let capturedConfig: any = null
      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        capturedConfig = config
        return Promise.resolve({
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse)
      })

      await apiClient.get('/test-endpoint')

      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig.headers['Authorization']).toBeUndefined()
    })
  })

  // =========================================================================
  // 2. Response Interceptor: 401 Exemption Rules
  // =========================================================================
  describe('Response Interceptor: 401 Exemption & Unauthorized Notification', () => {
    it('does NOT trigger onUnauthorized when /push-tokens DELETE returns 401', async () => {
      setTokenGetter(() => 'active-token-123')
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(
          createAxios401Error(
            '/push-tokens/ExponentPushToken%5Btest-token-123%5D',
            config.headers as any
          )
        )
      })

      await expect(
        apiClient.delete('/push-tokens/ExponentPushToken%5Btest-token-123%5D')
      ).rejects.toThrow('Unauthenticated.')

      expect(unauthorizedListener).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('does NOT trigger onUnauthorized when /push-tokens POST returns 401', async () => {
      setTokenGetter(() => 'active-token-123')
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(createAxios401Error('/push-tokens', config.headers as any))
      })

      await expect(
        apiClient.post('/push-tokens', { token: 'ExponentPushToken[xyz]' })
      ).rejects.toThrow('Unauthenticated.')

      expect(unauthorizedListener).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('does NOT trigger onUnauthorized when /auth/login returns 401 on bad credentials', async () => {
      setTokenGetter(() => null)
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        const error = createAxios401Error('/auth/login')
        error.response.data = { message: 'These credentials do not match our records.' }
        return Promise.reject(error)
      })

      await expect(
        apiClient.post('/auth/login', { email: 'bad@user.com', password: 'bad' })
      ).rejects.toThrow('These credentials do not match our records.')

      expect(unauthorizedListener).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('does NOT trigger onUnauthorized when /login returns 401', async () => {
      setTokenGetter(() => null)
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn(() => {
        return Promise.reject(createAxios401Error('/login'))
      })

      await expect(apiClient.post('/login', {})).rejects.toThrow('Unauthenticated.')

      expect(unauthorizedListener).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('does NOT trigger onUnauthorized when request was unauthenticated (no token held)', async () => {
      setTokenGetter(() => null)
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn(() => {
        // Protected endpoint returns 401, but client never sent credentials
        return Promise.reject(createAxios401Error('/orders'))
      })

      await expect(apiClient.get('/orders')).rejects.toThrow('Unauthenticated.')

      expect(unauthorizedListener).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('TRIGGERS onUnauthorized when standard protected endpoint returns 401 and client holds an active token', async () => {
      setTokenGetter(() => 'active-session-token')
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(createAxios401Error('/orders', config.headers as any))
      })

      await expect(apiClient.get('/orders')).rejects.toThrow('Unauthenticated.')

      expect(unauthorizedListener).toHaveBeenCalledTimes(1)
      expect(unauthorizedListener).toHaveBeenCalledWith(
        'Your session was terminated because another device signed into this account, or your session has expired.'
      )
      unsubscribe()
    })

    it('TRIGGERS onUnauthorized when Authorization header was explicitly attached on config', async () => {
      setTokenGetter(() => null) // token getter returns null, but request explicitly had header
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(createAxios401Error('/products', { Authorization: 'Bearer explicit-tok' }))
      })

      await expect(
        apiClient.get('/products', { headers: { Authorization: 'Bearer explicit-tok' } })
      ).rejects.toThrow('Unauthenticated.')

      expect(unauthorizedListener).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('does NOT trigger onUnauthorized for /api/v1/push-tokens with query parameters and special characters', async () => {
      setTokenGetter(() => 'active-bearer-token')
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(
          createAxios401Error(
            'http://backend.test/api/v1/push-tokens/ExponentPushToken%5Babc%2Bdef%2Fghi%3D%5D?force=true',
            config.headers as any
          )
        )
      })

      await expect(
        apiClient.delete(
          'http://backend.test/api/v1/push-tokens/ExponentPushToken%5Babc%2Bdef%2Fghi%3D%5D?force=true'
        )
      ).rejects.toThrow('Unauthenticated.')

      expect(unauthorizedListener).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('does NOT trigger onUnauthorized on 403 Forbidden even with active token', async () => {
      setTokenGetter(() => 'active-session-token')
      const unauthorizedListener = jest.fn()
      const unsubscribe = onUnauthorized(unauthorizedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        const error: any = new Error('Forbidden')
        error.isAxiosError = true
        error.config = config
        error.response = {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config,
          data: { message: 'You do not have permission to perform this action.' },
        }
        return Promise.reject(error)
      })

      await expect(apiClient.get('/admin/audit-logs')).rejects.toThrow(
        'You do not have permission to perform this action.'
      )

      expect(unauthorizedListener).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('extracts field validation error message on 422 Unprocessable Entity', async () => {
      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        const error: any = new Error('Validation failed')
        error.isAxiosError = true
        error.config = config
        error.response = {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: {},
          config,
          data: {
            message: 'The given data was invalid.',
            errors: {
              token: ['The token field is required and must be valid Expo format.'],
            },
          },
        }
        return Promise.reject(error)
      })

      await expect(apiClient.post('/push-tokens', {})).rejects.toThrow(
        'The token field is required and must be valid Expo format.'
      )
    })

    it('flags isServerError and notifies connection unreachable on 502/503/504 errors', async () => {
      const connListener = jest.fn()
      const unsub = onConnectionChange(connListener)

      for (const statusCode of [502, 503, 504]) {
        connListener.mockClear()
        apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
          const err: any = new Error(`Server error (${statusCode})`)
          err.isAxiosError = true
          err.config = config
          err.response = {
            status: statusCode,
            statusText: 'Gateway Error',
            headers: {},
            config,
            data: { message: `Gateway Timeout ${statusCode}` },
          }
          return Promise.reject(err)
        })

        await expect(apiClient.get('/status-check')).rejects.toThrow(`Gateway Timeout ${statusCode}`)
        expect(connListener).toHaveBeenCalledWith(
          false,
          expect.objectContaining({
            isServerError: true,
            message: `Server error (${statusCode})`,
          })
        )
      }

      unsub()
    })
  })

  // =========================================================================
  // 3. Listener Management: Subscription & Unsubscription
  // =========================================================================
  describe('Unauthorized Listener Subscription Lifecycle', () => {
    it('supports multiple listeners and cleanly unsubscribes', async () => {
      setTokenGetter(() => 'valid-token')
      const listenerA = jest.fn()
      const listenerB = jest.fn()

      const unsubA = onUnauthorized(listenerA)
      const unsubB = onUnauthorized(listenerB)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(createAxios401Error('/categories', config.headers as any))
      })

      // Both listeners receive the notification
      await expect(apiClient.get('/categories')).rejects.toThrow()
      expect(listenerA).toHaveBeenCalledTimes(1)
      expect(listenerB).toHaveBeenCalledTimes(1)

      // Unsubscribe listenerA
      unsubA()

      await expect(apiClient.get('/categories')).rejects.toThrow()
      expect(listenerA).toHaveBeenCalledTimes(1) // not called again
      expect(listenerB).toHaveBeenCalledTimes(2) // called again

      // Unsubscribe listenerB
      unsubB()

      await expect(apiClient.get('/categories')).rejects.toThrow()
      expect(listenerA).toHaveBeenCalledTimes(1)
      expect(listenerB).toHaveBeenCalledTimes(2)
    })

    it('handles exceptions thrown by a listener gracefully without breaking caller', async () => {
      setTokenGetter(() => 'valid-token')
      const throwingListener = jest.fn(() => {
        throw new Error('Listener crash!')
      })
      const wellBehavedListener = jest.fn()

      const unsub1 = onUnauthorized(throwingListener)
      const unsub2 = onUnauthorized(wellBehavedListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.reject(createAxios401Error('/inventory', config.headers as any))
      })

      await expect(apiClient.get('/inventory')).rejects.toThrow()
      expect(throwingListener).toHaveBeenCalledTimes(1)
      expect(wellBehavedListener).toHaveBeenCalledTimes(1)

      unsub1()
      unsub2()
    })
  })

  // =========================================================================
  // 4. Connection Listener Tests
  // =========================================================================
  describe('Connection Listener Lifecycle', () => {
    it('notifies connection is reachable on successful 200 responses', async () => {
      const connectionListener = jest.fn()
      const unsub = onConnectionChange(connectionListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        return Promise.resolve({
          data: { status: 'healthy' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse)
      })

      await apiClient.get('/health')
      expect(connectionListener).toHaveBeenCalledWith(true, undefined)

      unsub()
    })

    it('notifies connection is unreachable on network timeout (no response)', async () => {
      const connectionListener = jest.fn()
      const unsub = onConnectionChange(connectionListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        const netErr: any = new Error('Network Error')
        netErr.isAxiosError = true
        netErr.config = config
        // no response property
        return Promise.reject(netErr)
      })

      await expect(apiClient.get('/health')).rejects.toThrow(
        'Cannot reach the server. Please check your network connection'
      )
      expect(connectionListener).toHaveBeenCalledWith(false, expect.any(Error))

      unsub()
    })

    it('notifies connection is unreachable on 500 server error', async () => {
      const connectionListener = jest.fn()
      const unsub = onConnectionChange(connectionListener)

      apiClient.defaults.adapter = jest.fn((config: AxiosRequestConfig) => {
        const err: any = new Error('Internal Server Error')
        err.isAxiosError = true
        err.config = config
        err.response = {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config,
          data: { message: 'Fatal server failure.' },
        }
        return Promise.reject(err)
      })

      await expect(apiClient.get('/health')).rejects.toThrow()
      expect(connectionListener).toHaveBeenCalledWith(false, expect.any(Error))

      unsub()
    })
  })
})
