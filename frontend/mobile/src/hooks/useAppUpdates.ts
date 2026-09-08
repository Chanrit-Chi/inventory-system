import { useEffect, useState, useCallback, useRef } from 'react'
import * as Updates from 'expo-updates'
import { useToast } from '../context/ToastContext'

export interface UpdateState {
  isEnabled: boolean
  isChecking: boolean
  updateAvailable: boolean
  isDownloaded: boolean
  updateId: string | null
  channel: string | null
  runtimeVersion: string | null
  createdAt: string | null
  lastChecked: string | null
}

export function useAppUpdates() {
  const { showToast } = useToast()
  const [state, setState] = useState<UpdateState>({
    isEnabled: Updates.isEnabled,
    isChecking: false,
    updateAvailable: false,
    isDownloaded: false,
    updateId: Updates.updateId ?? null,
    channel: Updates.channel ?? null,
    runtimeVersion: typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion : null,
    createdAt: Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : null,
    lastChecked: null,
  })

  const hasCheckedInitialRef = useRef(false)

  const checkForUpdate = useCallback(
    async (manual = false) => {
      // EAS Updates does not run in Expo Go or __DEV__ development mode
      if (!Updates.isEnabled || __DEV__) {
        if (manual) {
          showToast('OTA updates are inactive in local development mode.', {
            type: 'info',
            duration: 4000,
          })
        }
        return
      }

      try {
        console.log('[useAppUpdates] checkForUpdate initiated. Updates info:', {
          isEnabled: Updates.isEnabled,
          channel: Updates.channel,
          runtimeVersion: Updates.runtimeVersion,
          updateId: Updates.updateId,
          isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        })
        setState((prev) => ({ ...prev, isChecking: true }))

        const checkResult = await Updates.checkForUpdateAsync()
        const nowStr = new Date().toLocaleTimeString()

        if (checkResult.isAvailable) {
          setState((prev) => ({
            ...prev,
            updateAvailable: true,
            lastChecked: nowStr,
          }))

          // Fetch the update in background
          const fetchResult = await Updates.fetchUpdateAsync()

          if (fetchResult.isNew) {
            setState((prev) => ({
              ...prev,
              isDownloaded: true,
              isChecking: false,
            }))

            showToast('New update downloaded! Restart to apply changes.', {
              type: 'info',
              duration: 12000,
              action: {
                label: 'Restart Now',
                onPress: async () => {
                  try {
                    await Updates.reloadAsync()
                  } catch {
                    // Fallback if reload fails
                  }
                },
              },
            })
          } else {
            setState((prev) => ({ ...prev, isChecking: false }))
          }
        } else {
          setState((prev) => ({
            ...prev,
            updateAvailable: false,
            lastChecked: nowStr,
            isChecking: false,
          }))

          if (manual) {
            showToast('App is up to date (latest release).', {
              type: 'success',
              duration: 3500,
            })
          }
        }
      } catch (error) {
        console.error('[useAppUpdates] checkForUpdateAsync error:', error)
        setState((prev) => ({ ...prev, isChecking: false }))
        if (manual) {
          const errMessage = error instanceof Error ? error.message : 'Unknown error'
          showToast(`Update check failed: ${errMessage}`, {
            type: 'error',
            duration: 5000,
          })
        }
      }
    },
    [showToast]
  )

  const reloadApp = useCallback(async () => {
    if (!Updates.isEnabled || __DEV__) return
    try {
      await Updates.reloadAsync()
    } catch {
      showToast('Could not reload the application.', { type: 'error' })
    }
  }, [showToast])

  // Background check once on app mount
  useEffect(() => {
    if (!hasCheckedInitialRef.current) {
      hasCheckedInitialRef.current = true
      checkForUpdate(false)
    }
  }, [checkForUpdate])

  return {
    ...state,
    checkForUpdate: () => checkForUpdate(true),
    reloadApp,
  }
}
