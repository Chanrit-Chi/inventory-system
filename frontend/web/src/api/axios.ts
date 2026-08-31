import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { tokenStore } from './tokenStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/composables/useToast'

export interface ApiErrorPayload {
  message: string
  errors?: Record<string, string[]>
  status?: number
}

export class ApiError extends Error {
  errors?: Record<string, string[]>
  status?: number
  isNetworkError: boolean

  constructor(message: string, errors?: Record<string, string[]>, status?: number, isNetworkError: boolean = false) {
    super(message)
    this.name = 'ApiError'
    this.errors = errors
    this.status = status
    this.isNetworkError = isNetworkError
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://backend.test/api/v1',
  timeout: 15000, // 15s default timeout (matches mobile)
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor - inject auth token via injectable tokenStore
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: unknown) => Promise.reject(error)
)

// Response interceptor — standardizes error envelope
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>) => {
    if (!error.response) {
      const message = error.message || 'Cannot reach the server. Please check your network connection.'
      return Promise.reject(new ApiError(message, undefined, undefined, true))
    }

    const data = error.response.data
    const status = error.response.status
    
    // Extract first validation error if present
    let message = data?.message
    if (data?.errors && typeof data.errors === 'object') {
      const firstFieldErrors = Object.values(data.errors).flat()
      if (firstFieldErrors.length > 0 && typeof firstFieldErrors[0] === 'string') {
        message = firstFieldErrors[0]
      }
    }
    if (!message) {
      message = error.message || 'An unexpected error occurred.'
    }

    const errors = data?.errors

    // Clear auth on 401 Unauthorized and notify user
    if (status === 401) {
      const auth = useAuthStore()
      auth.handleSessionExpired() // sets isAuthenticated=false, clears token
      const toast = useToast()
      toast.warning('Your session has expired. Please log in again.')
    }

    return Promise.reject(new ApiError(message, errors, status, false))
  }
)

export default api
