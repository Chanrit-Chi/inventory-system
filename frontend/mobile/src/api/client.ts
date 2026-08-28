import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import type { ApiResponse } from '../types'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://backend.test/api/v1'

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
})

// Request interceptor — attach bearer token when available
apiClient.interceptors.request.use(
  (config) => {
    const { getToken } = require('../context/AuthContext')
    const token: string | null = getToken()
    if (token) {
      config.headers = config.headers ?? {}
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

type ConnectionListener = (isReachable: boolean, error?: Error) => void
const connectionListeners = new Set<ConnectionListener>()

export function onConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener)
  return () => {
    connectionListeners.delete(listener)
  }
}

function notifyConnectionChange(isReachable: boolean, error?: Error) {
  connectionListeners.forEach((listener) => {
    try {
      listener(isReachable, error)
    } catch {
      // ignore
    }
  })
}

// Response interceptor with unified error extraction
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    notifyConnectionChange(true)
    return response
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    let errorMessage: string

    if (!error.response) {
      // No response at all — DNS failure, refused connection, timeout, etc.
      errorMessage =
        'Cannot reach the server. Please check your network connection and ensure the backend is running.'
      const networkError = new Error(errorMessage)
      ;(networkError as any).isNetworkError = true
      notifyConnectionChange(false, networkError)
      return Promise.reject(networkError)
    } else {
      // If 502/503/504 Bad Gateway / Service Unavailable, also notify unreachable
      if (error.response.status >= 500) {
        const serverError = new Error(`Server error (${error.response.status})`)
        ;(serverError as any).isServerError = true
        notifyConnectionChange(false, serverError)
      } else {
        // Successful contact with server (business error like 400/404/422)
        notifyConnectionChange(true)
      }

      const data = error.response.data
      const fieldError = data?.errors
        ? Object.values(data.errors).flat()[0] as string | undefined
        : undefined

      errorMessage = fieldError ?? data?.message ?? `Server error (${error.response.status})`
    }

    return Promise.reject(new Error(errorMessage))
  }
)

export default apiClient
