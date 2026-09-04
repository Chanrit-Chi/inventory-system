import { useState, useEffect, useCallback, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { registerPushToken, deregisterPushToken } from '../api/endpoints'
import type { UsePushNotificationsResult } from '../types'

const PUSH_TOKEN_KEY = '@kc_inventory_push_token'
const FALLBACK_PROJECT_ID = 'f403c66d-8e4b-49a5-bc41-13de8ea312f6'
const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production'

/**
 * Resolves the EAS Project ID from Expo constants with fallback to app.json ID
 */
export function getEasProjectId(): string {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    FALLBACK_PROJECT_ID
  )
}

/**
 * Custom hook to manage Expo push notification registration, permissions,
 * Android notification channels, and backend lifecycle synchronization.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const { currentUser, isAuthenticated } = useAuth()
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<
    Notifications.PermissionStatus | 'undetermined'
  >('undetermined')
  const [isRegistered, setIsRegistered] = useState<boolean>(false)

  const lastRegisteredTokenRef = useRef<string | null>(null)
  const lastRegisteredUserIdRef = useRef<string | null>(null)
  const isRegisteringBackendRef = useRef<boolean>(false)

  /**
   * Configure notification channel, request permissions, and acquire Expo push token.
   * Safe to call on simulators/emulators without crashing.
   */
  const registerDevice = useCallback(async (): Promise<string | null> => {
    // 1. Guard against non-physical devices (emulators/simulators)
    if (!Device.isDevice) {
      if (isDev) {
        console.log('[usePushNotifications] Push notifications are not supported on simulators/emulators.')
      }
      return null
    }

    // 2. Configure Android Notification Channel (required for Android 8.0+)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        })
      } catch (channelErr) {
        console.warn('[usePushNotifications] Failed to set Android notification channel:', channelErr)
      }
    }

    // 3. Permission flow: check existing permissions, request if not granted
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      setPermissionStatus(finalStatus)

      if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
        if (isDev) {
          console.log('[usePushNotifications] Permission not granted:', finalStatus)
        }
        return null
      }

      // 4. Retrieve Expo push token with EAS project ID
      const projectId = getEasProjectId()
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId })
      const token = tokenResponse.data

      setExpoPushToken(token)
      return token
    } catch (tokenErr) {
      console.warn('[usePushNotifications] Error acquiring Expo push token:', tokenErr)
      return null
    }
  }, [])

  // Acquire push token on initial mount
  useEffect(() => {
    registerDevice().catch((err) => {
      console.warn('[usePushNotifications] Initial device registration error:', err)
    })
  }, [registerDevice])

  // 5. Backend synchronization: Register token on login / authenticated state
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !expoPushToken) {
      return
    }

    const needsRegistration =
      !isRegistered ||
      lastRegisteredTokenRef.current !== expoPushToken ||
      lastRegisteredUserIdRef.current !== currentUser.id

    if (!needsRegistration || isRegisteringBackendRef.current) {
      return
    }

    isRegisteringBackendRef.current = true
    const deviceName = Device.modelName || Device.deviceName || 'Mobile Device'
    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown'

    registerPushToken({
      token: expoPushToken,
      device_name: deviceName,
      platform,
    })
      .then(() => {
        lastRegisteredTokenRef.current = expoPushToken
        lastRegisteredUserIdRef.current = currentUser.id
        setIsRegistered(true)
        AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken).catch(() => {})
      })
      .catch((err) => {
        console.warn('[usePushNotifications] Failed to sync push token with backend:', err)
        setIsRegistered(false)
      })
      .finally(() => {
        isRegisteringBackendRef.current = false
      })
  }, [isAuthenticated, currentUser?.id, expoPushToken, isRegistered])

  // 6. Backend synchronization: Deregister token on logout (!isAuthenticated)
  useEffect(() => {
    if (isAuthenticated) {
      return
    }

    const tokenToDeregister = lastRegisteredTokenRef.current || expoPushToken
    const hadRegistration = isRegistered || Boolean(lastRegisteredTokenRef.current)

    // Cleanly reset registration refs and state immediately
    lastRegisteredTokenRef.current = null
    lastRegisteredUserIdRef.current = null
    setIsRegistered(false)

    if (tokenToDeregister && hadRegistration) {
      // Avoid secondary redundant deregistration if already deregistered during voluntary logout
      AsyncStorage.getItem(PUSH_TOKEN_KEY)
        .then((stored) => {
          if (stored !== null) {
            AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {})
            deregisterPushToken(tokenToDeregister).catch((err) => {
              if (isDev) {
                console.log('[usePushNotifications] Push token deregistration cleanup:', err)
              }
            })
          }
        })
        .catch(() => {
          // Fallback if storage access is unavailable (e.g. node test environment)
          deregisterPushToken(tokenToDeregister).catch((err) => {
            if (isDev) {
              console.log('[usePushNotifications] Push token deregistration cleanup:', err)
            }
          })
        })
    }
  }, [isAuthenticated, expoPushToken, isRegistered])

  return {
    expoPushToken,
    permissionStatus,
    isRegistered,
    registerDevice,
  }
}

export default usePushNotifications
