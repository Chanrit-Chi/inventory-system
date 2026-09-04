import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { getDeviceIdentifier } from '@/utils/device'
import { useAuthStore } from '@/stores/authStore'
import api from '@/api/axios'

vi.mock('@/api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(msg: string) {
      super(msg)
      this.name = 'ApiError'
    }
  },
}))

describe('Web Device Identifier & Multi-Device Auth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('generates a valid formatted device identifier and persists it in localStorage', () => {
    expect(localStorage.getItem('@kc_web_device_install_id')).toBeNull()

    const deviceId = getDeviceIdentifier()
    expect(deviceId).toMatch(/^Web-.* \([A-Z0-9]{6}\)$/)

    const storedId = localStorage.getItem('@kc_web_device_install_id')
    expect(storedId).not.toBeNull()
    expect(deviceId).toContain(storedId!)
  })

  it('reuses the existing device installation ID across subsequent calls', () => {
    localStorage.setItem('@kc_web_device_install_id', 'TEST99')
    const deviceId = getDeviceIdentifier()
    expect(deviceId).toContain('TEST99')

    const deviceId2 = getDeviceIdentifier()
    expect(deviceId2).toBe(deviceId)
  })

  it('passes resolved device_name when authStore.login is called', async () => {
    localStorage.setItem('@kc_web_device_install_id', 'TERM01')
    const authStore = useAuthStore()

    const mockPost = vi.mocked(api.post)
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          token: 'token-abc',
          user: { id: '1', name: 'Cashier Staff', email: 'cashier@pos.test', role: 'SELLER' },
        },
      },
    })

    const result = await authStore.login('cashier@pos.test', 'password123')

    expect(result.success).toBe(true)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'cashier@pos.test',
      password: 'password123',
      device_name: expect.stringContaining('TERM01'),
    })

    expect(authStore.token).toBe('token-abc')
    expect(localStorage.getItem('omnipos_token')).toBe('token-abc')
  })

  it('allows explicit device_name override during login if provided', async () => {
    const authStore = useAuthStore()

    const mockPost = vi.mocked(api.post)
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          token: 'token-xyz',
          user: { id: '2', name: 'Admin', email: 'admin@pos.test', role: 'ADMIN' },
        },
      },
    })

    await authStore.login('admin@pos.test', 'password123', 'Custom-POS-Terminal-04')

    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@pos.test',
      password: 'password123',
      device_name: 'Custom-POS-Terminal-04',
    })
  })

  it('handleSessionExpired cleans up stored auth credentials', async () => {
    localStorage.setItem('omnipos_token', 'stale-token')
    localStorage.setItem('omnipos_user', JSON.stringify({ id: '1', email: 'test@pos.test' }))

    const authStore = useAuthStore()
    authStore.initAuth()
    expect(authStore.isAuthenticated).toBe(true)

    await authStore.handleSessionExpired()

    expect(authStore.token).toBeNull()
    expect(authStore.user).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem('omnipos_token')).toBeNull()
    expect(localStorage.getItem('omnipos_user')).toBeNull()
  })
})
