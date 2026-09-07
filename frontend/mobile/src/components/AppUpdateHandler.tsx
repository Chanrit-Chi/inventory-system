import React, { useEffect } from 'react'
import { Alert, Platform } from 'react-native'
import { useAppUpdates } from '../hooks/useAppUpdates'
import { checkApkVersion, downloadAndInstallApk } from '../utils/apkUpdater'

/**
 * AppUpdateHandler
 *
 * Headless controller component:
 * 1. Automatically checks for EAS Over-The-Air (OTA) updates on app launch.
 * 2. Checks backend `/app/version` endpoint for native APK releases.
 * 3. Prompts the user to update if a critical APK update is required.
 */
export const AppUpdateHandler: React.FC = () => {
  // Mounts background EAS OTA update listener
  useAppUpdates()

  useEffect(() => {
    // Check for native binary APK update on Android
    if (Platform.OS !== 'android') return

    let isMounted = true

    async function checkNativeApk() {
      const versionInfo = await checkApkVersion()
      if (!isMounted || !versionInfo) return

      // If a native binary update is flagged as mandatory
      if (versionInfo.update_required && versionInfo.apk_url) {
        Alert.alert(
          'App Update Required',
          `A new version (v${versionInfo.latest_version}) of KC Shop is required to continue.\n\n${versionInfo.changelog}`,
          [
            {
              text: 'Download & Install',
              onPress: () => {
                downloadAndInstallApk(versionInfo.apk_url)
              },
            },
          ],
          { cancelable: false }
        )
      } else if (versionInfo.update_available && versionInfo.apk_url) {
        // Optional update available
        Alert.alert(
          'Update Available',
          `A new version (v${versionInfo.latest_version}) of KC Shop is available.\n\n${versionInfo.changelog}`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Download & Install',
              onPress: () => {
                downloadAndInstallApk(versionInfo.apk_url)
              },
            },
          ],
          { cancelable: true }
        )
      }
    }

    checkNativeApk()

    return () => {
      isMounted = false
    }
  }, [])

  return null
}

export default AppUpdateHandler
