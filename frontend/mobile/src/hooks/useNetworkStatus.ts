import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { onConnectionChange, apiClient } from '../api/client'

export type ConnectionState = 'online' | 'device_offline' | 'server_unreachable'

export interface NetworkStatus {
  isDeviceOnline: boolean
  isBackendReachable: boolean
  connectionState: ConnectionState
  errorMessage: string | null
  isChecking: boolean
  checkConnection: () => Promise<boolean>
}

export function useNetworkStatus(): NetworkStatus {
  const [isDeviceOnline, setIsDeviceOnline] = useState(true)
  const [isBackendReachable, setIsBackendReachable] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const isBackendReachableRef = useRef(isBackendReachable)
  isBackendReachableRef.current = isBackendReachable

  const isDeviceOnlineRef = useRef(isDeviceOnline)
  isDeviceOnlineRef.current = isDeviceOnline

  // 1. Listen to physical network connectivity (NetInfo)
  useEffect(() => {
    const handleNetInfoChange = (state: NetInfoState) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false)
      setIsDeviceOnline(online)
      if (!online) {
        setErrorMessage('No internet connection. Please check your Wi-Fi or cellular network.')
      } else if (isBackendReachableRef.current) {
        setErrorMessage(null)
      }
    }

    NetInfo.fetch().then(handleNetInfoChange)
    const unsubscribe = NetInfo.addEventListener(handleNetInfoChange)
    return () => unsubscribe()
  }, [])

  // 2. Listen to API Client response/error events
  useEffect(() => {
    const unsubscribe = onConnectionChange((reachable, error) => {
      setIsBackendReachable(reachable)
      if (!reachable) {
        setErrorMessage(error?.message || 'Cannot reach the backend server.')
      } else if (isDeviceOnlineRef.current) {
        setErrorMessage(null)
      }
    })
    return () => unsubscribe()
  }, [])

  // 3. Manual ping / check connection function
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true)
    try {
      const netState = await NetInfo.fetch()
      const deviceOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false)
      setIsDeviceOnline(deviceOnline)
      if (!deviceOnline) {
        setErrorMessage('No internet connection. Please check your Wi-Fi or cellular network.')
        setIsChecking(false)
        return false
      }

      await apiClient.get('/health', { timeout: 8000 })
      setIsBackendReachable(true)
      setErrorMessage(null)
      setIsChecking(false)
      return true
    } catch (err: unknown) {
      const error = err as { message?: string }
      setIsBackendReachable(false)
      setErrorMessage(error.message || 'Cannot reach backend server.')
      setIsChecking(false)
      return false
    }
  }, [])

  const connectionState: ConnectionState = !isDeviceOnline
    ? 'device_offline'
    : !isBackendReachable
    ? 'server_unreachable'
    : 'online'

  return useMemo(
    () => ({
      isDeviceOnline,
      isBackendReachable,
      connectionState,
      errorMessage,
      isChecking,
      checkConnection,
    }),
    [
      isDeviceOnline,
      isBackendReachable,
      connectionState,
      errorMessage,
      isChecking,
      checkConnection,
    ]
  )
}
