import { Platform, Alert } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'
import Constants from 'expo-constants'
import { apiClient } from '../api/client'

export interface AppVersionResponse {
  platform: string
  client_version: string
  latest_version: string
  latest_version_code: number
  min_supported_version: string
  update_available: boolean
  update_required: boolean
  apk_url: string
  changelog: string
  checked_at: string
}

export async function checkApkVersion(): Promise<AppVersionResponse | null> {
  try {
    const currentVersion = Constants.expoConfig?.version || '1.0.0'
    const res = await apiClient.get<{ success: boolean; data: AppVersionResponse }>(
      `/app/version?platform=${Platform.OS}&version=${currentVersion}`
    )
    if (res.data?.success && res.data?.data) {
      return res.data.data
    }
    return null
  } catch (err) {
    console.warn('[apkUpdater] Version check request failed:', err)
    return null
  }
}

export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: (progressPercent: number) => void
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    Alert.alert('Unsupported Platform', 'In-app APK installation is only supported on Android devices.')
    return false
  }

  if (!apkUrl) {
    Alert.alert('Download Error', 'No APK download link was provided by the server.')
    return false
  }

  try {
    const targetFileUri = `${FileSystem.cacheDirectory}kc-shop-update.apk`

    // Remove existing cached APK if present
    const fileInfo = await FileSystem.getInfoAsync(targetFileUri)
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(targetFileUri, { idempotent: true })
    }

    // Download with progress tracking if callback provided
    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      targetFileUri,
      {},
      (downloadProgress) => {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          const progress = Math.round(
            (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
          )
          onProgress(progress)
        }
      }
    )

    const result = await downloadResumable.downloadAsync()
    if (!result || !result.uri) {
      throw new Error('APK download was interrupted or returned empty file.')
    }

    // Get content URI for Android Package Installer
    const contentUri = await FileSystem.getContentUriAsync(result.uri)

    // Launch Android native Package Installer intent
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    })

    return true
  } catch (error) {
    console.error('[apkUpdater] Failed to install APK:', error)
    const message = error instanceof Error ? error.message : 'Unknown installation error'
    Alert.alert('Installation Failed', `Could not launch APK installer: ${message}`)
    return false
  }
}
