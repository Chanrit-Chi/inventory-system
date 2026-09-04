import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react'
import { Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { queryClient } from '../api/queryClient'
import { setTokenGetter, onUnauthorized } from '../api/client'
import type { UserAccount } from '../types'

const TOKEN_KEY = '@kc_inventory_token'
const USER_KEY = '@kc_inventory_user'
export const PUSH_TOKEN_KEY = '@kc_inventory_push_token'

interface AuthContextValue {
  currentUser: UserAccount | null
  token: string | null
  isAuthenticated: boolean
  isRestoring: boolean
  sessionExpiredMessage: string | null
  clearSessionExpiredMessage: () => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updated: Partial<UserAccount>) => void
  refreshUser: () => Promise<UserAccount | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null)
  const isAlertingRef = useRef(false)
  const tokenRef = useRef<string | null>(null)

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null)
  }, [])

  const handleSessionExpired = useCallback(async (reason?: string) => {
    tokenRef.current = null
    setToken(null)
    setCurrentUser(null)
    const msg =
      reason ||
      'You have been signed out because your account was logged into from another device or your session expired.'
    setSessionExpiredMessage(msg)
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, PUSH_TOKEN_KEY]).catch(() => null)
    queryClient.clear()

    if (!isAlertingRef.current) {
      isAlertingRef.current = true
      Alert.alert('Session Expired', msg, [
        {
          text: 'Sign In Again',
          onPress: () => {
            isAlertingRef.current = false
          },
        },
      ])
    }
  }, [])

  // Register token getter and unauthorized handler with API client (event emitter pattern)
  useEffect(() => {
    setTokenGetter(() => tokenRef.current)
    const unsubscribe = onUnauthorized(handleSessionExpired)
    return unsubscribe
  }, [handleSessionExpired])

  const refreshUser = useCallback(async (): Promise<UserAccount | null> => {
    try {
      const { fetchCurrentUser } = await import('../api/endpoints')
      const user = await fetchCurrentUser()
      if (user) {
        setCurrentUser(user)
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
        return user
      }
      return null
    } catch (err) {
      return null
    }
  }, [])

  // Restore session from AsyncStorage on cold start and refresh in background
  useEffect(() => {
    ;(async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ])
        if (savedToken && savedUser) {
          const user: UserAccount = JSON.parse(savedUser)
          tokenRef.current = savedToken
          setToken(savedToken)
          setCurrentUser(user)
          // Background sync latest permissions from server
          refreshUser().catch(() => null)
        }
      } catch {
        // Corrupted storage — start fresh
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY])
      } finally {
        setIsRestoring(false)
      }
    })()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const { loginUser } = await import('../api/endpoints')
    const result = await loginUser(email, password)
    tokenRef.current = result.token
    setToken(result.token)
    setCurrentUser(result.user)
    // Persist to AsyncStorage
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, result.token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(result.user)),
    ])
  }, [])

  const logout = useCallback(async () => {
    try {
      // Before calling logoutUser(), retrieve savedPushToken from AsyncStorage.
      // If present, call deregisterPushToken(savedPushToken) inside try/catch so network failure never blocks logout.
      try {
        const savedPushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
        if (savedPushToken) {
          const { deregisterPushToken } = await import('../api/endpoints')
          await deregisterPushToken(savedPushToken)
          await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => null)
        }
      } catch (pushErr) {
        console.warn('Push token deregistration on logout warning:', pushErr)
      }

      // Then call logoutUser().
      const { logoutUser } = await import('../api/endpoints')
      await logoutUser()
    } catch (err) {
      // Gracefully catch network errors so local session clearing always completes
      console.warn('Server logout error (proceeding with local cleanup):', err)
    } finally {
      tokenRef.current = null
      setToken(null)
      setCurrentUser(null)
      try {
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, PUSH_TOKEN_KEY])
      } catch {
        // Ignore storage removal errors
      }
    }
  }, [])

  const updateProfile = useCallback((updated: Partial<UserAccount>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...updated }
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => null)
      return next
    })
  }, [])

  const authValue = useMemo(
    () => ({
      currentUser,
      token,
      isAuthenticated: !!currentUser && !!token,
      isRestoring,
      sessionExpiredMessage,
      clearSessionExpiredMessage,
      login,
      logout,
      updateProfile,
      refreshUser,
    }),
    [
      currentUser,
      token,
      isRestoring,
      sessionExpiredMessage,
      clearSessionExpiredMessage,
      login,
      logout,
      updateProfile,
      refreshUser,
    ]
  )

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
