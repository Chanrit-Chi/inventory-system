import axios, { AxiosError } from 'axios'

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
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Response interceptor — standardizes error envelope
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ success?: boolean; message?: string; errors?: Record<string, string[]> }>) => {
    const data = error.response?.data
    const status = error.response?.status
    const message = data?.message || error.message || 'An unexpected error occurred.'
    const errors = data?.errors
    return Promise.reject(new ApiError(message, errors, status))
  }
)

export default api
