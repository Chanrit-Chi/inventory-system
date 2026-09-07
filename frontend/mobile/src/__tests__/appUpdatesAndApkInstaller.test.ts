jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  Alert: {
    alert: jest.fn(),
  },
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
      extra: {
        eas: {
          projectId: 'f403c66d-8e4b-49a5-bc41-13de8ea312f6',
        },
      },
    },
  },
}))

import { checkApkVersion, downloadAndInstallApk } from '../utils/apkUpdater'
import { apiClient } from '../api/client'
import * as FileSystem from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'
import { Platform, Alert } from 'react-native'

jest.mock('../api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock/cache/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
  getContentUriAsync: jest.fn(),
}))

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
}))

jest.mock('expo-updates', () => ({
  isEnabled: true,
  channel: 'preview',
  updateId: 'mock-update-id-1234',
  runtimeVersion: '1.0.0',
  createdAt: '2026-09-07T00:00:00Z',
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}))

describe('App Updates & APK Installer Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkApkVersion', () => {
    it('returns parsed version data when API responds with success', async () => {
      const mockData = {
        platform: 'android',
        client_version: '1.0.0',
        latest_version: '1.2.0',
        latest_version_code: 12,
        min_supported_version: '1.0.0',
        update_available: true,
        update_required: false,
        apk_url: 'https://storage.test/kc-shop-1.2.0.apk',
        changelog: 'Fast scanning & updates',
        checked_at: '2026-09-07T12:00:00Z',
      }

      ;(apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: mockData },
      })

      const res = await checkApkVersion()
      expect(res).toEqual(mockData)
      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/app/version'))
    })

    it('returns null on request failure without throwing', async () => {
      ;(apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const res = await checkApkVersion()
      expect(res).toBeNull()
    })
  })

  describe('downloadAndInstallApk', () => {
    it('alerts error on non-android platform', async () => {
      const originalOS = Platform.OS
      Platform.OS = 'ios'
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

      const success = await downloadAndInstallApk('https://test.apk')
      expect(success).toBe(false)
      expect(alertSpy).toHaveBeenCalledWith('Unsupported Platform', expect.any(String))

      Platform.OS = originalOS
    })

    it('downloads APK and launches Android package installer on Android', async () => {
      const originalOS = Platform.OS
      Platform.OS = 'android'

      ;(FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true })
      ;(FileSystem.deleteAsync as jest.Mock).mockResolvedValueOnce(undefined)

      const mockDownloadAsync = jest.fn().mockResolvedValueOnce({
        uri: 'file:///mock/cache/kc-shop-update.apk',
      })
      ;(FileSystem.createDownloadResumable as jest.Mock).mockReturnValueOnce({
        downloadAsync: mockDownloadAsync,
      })
      ;(FileSystem.getContentUriAsync as jest.Mock).mockResolvedValueOnce('content://mock.authority/apk')

      const success = await downloadAndInstallApk('https://test.apk/update.apk')

      expect(success).toBe(true)
      expect(FileSystem.deleteAsync).toHaveBeenCalled()
      expect(mockDownloadAsync).toHaveBeenCalled()
      expect(FileSystem.getContentUriAsync).toHaveBeenCalledWith('file:///mock/cache/kc-shop-update.apk')
      expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
        'android.intent.action.VIEW',
        expect.objectContaining({
          data: 'content://mock.authority/apk',
          type: 'application/vnd.android.package-archive',
        })
      )

      Platform.OS = originalOS
    })
  })
})
