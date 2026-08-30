import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'

export interface ApiErrorPayload {
  message: string
  errors?: Record<string, string[]>
  status?: number
}

export class ApiError extends Error {
  errors?: Record<string, string[]>
  status?: number

  constructor(message: string, errors?: Record<string, string[]>, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.errors = errors
    this.status = status
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://backend.test/api/v1',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor - inject auth token from localStorage
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('omnipos_token')
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
    const data = error.response?.data
    const status = error.response?.status
    const message = data?.message || error.message || 'An unexpected error occurred.'
    const errors = data?.errors

    // Clear auth on 401 Unauthorized
    if (status === 401) {
      localStorage.removeItem('omnipos_token')
      localStorage.removeItem('omnipos_user')
    }

    return Promise.reject(new ApiError(message, errors, status))
  }
)

export default api
