import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserAccount } from '../types'

const TOKEN_KEY = '@kc_inventory_token'
const USER_KEY = '@kc_inventory_user'

interface AuthContextValue {
  currentUser: UserAccount | null
  token: string | null
  isAuthenticated: boolean
  isRestoring: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updated: Partial<UserAccount>) => void
  refreshUser: () => Promise<UserAccount | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Module-level token accessor — safe to use outside React tree (e.g. Axios interceptors)
let _token: string | null = null
export function getToken(): string | null {
  return _token
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)

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
          _token = savedToken
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
    _token = result.token
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
      const { logoutUser } = await import('../api/endpoints')
      await logoutUser()
    } catch (err) {
      // Gracefully catch network errors so local session clearing always completes
      console.warn('Server logout error (proceeding with local cleanup):', err)
    } finally {
      _token = null
      setToken(null)
      setCurrentUser(null)
      try {
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY])
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
      login,
      logout,
      updateProfile,
      refreshUser,
    }),
    [currentUser, token, isRestoring, login, logout, updateProfile, refreshUser]
  )

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
