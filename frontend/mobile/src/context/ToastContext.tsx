import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { registerGlobalToastListener } from '../utils/clipboard'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastOptions {
  type?: ToastType
  duration?: number
  action?: {
    label: string
    onPress: () => void
  }
}

export interface ToastContextType {
  showToast: (message: string, options?: ToastOptions | ToastType) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

interface ToastState {
  id: number
  message: string
  type: ToastType
  duration: number
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const currentToastIdRef = useRef<number>(0)
  const translateY = useRef(new Animated.Value(-60)).current
  const opacity = useRef(new Animated.Value(0)).current

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const targetId = currentToastIdRef.current
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -60,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (isMountedRef.current && finished && currentToastIdRef.current === targetId) {
        setToast(null)
      }
    })
  }, [translateY, opacity])

  const showToast = useCallback(
    (message: string, options?: ToastOptions | ToastType) => {
      if (!message || typeof message !== 'string') return

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      let type: ToastType = 'success'
      let duration = 2500

      if (typeof options === 'string') {
        type = options
      } else if (options && typeof options === 'object') {
        if (options.type) type = options.type
        if (options.duration) duration = options.duration
      }

      const nextId = Date.now()
      currentToastIdRef.current = nextId
      setToast({ id: nextId, message, type, duration })

      translateY.setValue(-60)
      opacity.setValue(0)

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start()

      timerRef.current = setTimeout(() => {
        hideToast()
      }, duration)
    },
    [hideToast, translateY, opacity]
  )

  // Listen to global clipboard / event broadcasts
  useEffect(() => {
    isMountedRef.current = true
    const unregister = registerGlobalToastListener((message, type) => {
      showToast(message, { type })
    })
    return () => {
      isMountedRef.current = false
      unregister()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [showToast])

  const getIcon = (type: ToastType): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'success':
        return 'checkmark-circle'
      case 'error':
        return 'alert-circle'
      case 'warning':
        return 'warning'
      case 'info':
      default:
        return 'information-circle'
    }
  }

  const getIconColor = (type: ToastType): string => {
    switch (type) {
      case 'success':
        return '#34D399' // Soft green
      case 'error':
        return '#F87171' // Soft red
      case 'warning':
        return '#FBBF24' // Soft yellow
      case 'info':
      default:
        return tokens.colors.primaryContainer
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.toastPill}
            activeOpacity={0.9}
            onPress={hideToast}
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
            accessibilityHint="Double tap to dismiss notification"
          >
            <Ionicons
              name={getIcon(toast.type)}
              size={18}
              color={getIconColor(toast.type)}
              style={styles.toastIcon}
            />
            <Text style={styles.toastText} numberOfLines={2}>
              {toast.message}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      showToast: (msg: string) => {
        // No-op or console debug, won't crash
      },
      hideToast: () => {},
    }
  }
  return context
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B', // Modern slate dark pill
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    maxWidth: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  toastIcon: {
    marginRight: 8,
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
})
