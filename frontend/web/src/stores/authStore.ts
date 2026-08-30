import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface User {
  id: string
  name: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER'
  department?: string | null
  phone?: string | null
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = computed(() => !!token.value)
  const isLoading = ref(false)

  // Initialize from localStorage on first load
  const initAuth = () => {
    const storedToken = localStorage.getItem('omnipos_token')
    const storedUser = localStorage.getItem('omnipos_user')

    if (storedToken && storedUser) {
      token.value = storedToken
      user.value = JSON.parse(storedUser)
      isLoading.value = false
    } else {
      isLoading.value = false
    }
  }

  // Login
  async function login(email: string, password: string) {
    isLoading.value = true
    try {
      const res = await api.post('/auth/login', { email, password })
      const payload = res.data?.data || res.data

      const authToken = payload?.token
      const authUser = payload?.user

      if (authToken && authUser) {
        token.value = authToken
        user.value = authUser as User
        localStorage.setItem('omnipos_token', authToken)
        localStorage.setItem('omnipos_user', JSON.stringify(authUser))
        isLoading.value = false
        return { success: true }
      }

      return { success: false, error: 'Invalid response format from server' }
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : 'Login failed'
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  // Logout
  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('omnipos_token')
    localStorage.removeItem('omnipos_user')
  }

  // Refresh user from API (optional)
  async function fetchCurrentUser() {
    if (!token.value) return
    isLoading.value = true
    try {
      const res = await api.get('/auth/me')
      user.value = res.data.data as User
    } catch {
      // User may have been deactivated; clear auth state
      logout()
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    initAuth,
    login,
    logout,
    fetchCurrentUser,
  }
})