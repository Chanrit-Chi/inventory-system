import AsyncStorage from '@react-native-async-storage/async-storage'

const DEVICE_INSTALL_KEY = '@kc_device_install_id'

function getPlatformOS(): string {
  try {
    // Lazy resolve Platform so unit test runners (node environment) execute without full react-native runtime
    const { Platform } = require('react-native')
    if (Platform?.OS === 'ios') return 'iOS'
    if (Platform?.OS === 'android') return 'Android'
    return 'Web'
  } catch {
    return 'Mobile'
  }
}

/**
 * Returns a persistent, unique device identifier for this app installation.
 * Used during login to allow the same account to be logged into multiple physical devices
 * (e.g., Android phone + iPad) without kicking each other out.
 */
export async function getDeviceIdentifier(): Promise<string> {
  try {
    let installId = await AsyncStorage.getItem(DEVICE_INSTALL_KEY)
    if (!installId) {
      // Generate a short 6-character alphanumeric installation hash
      installId = Math.random().toString(36).substring(2, 8).toUpperCase()
      await AsyncStorage.setItem(DEVICE_INSTALL_KEY, installId)
    }

    const platformName = getPlatformOS()
    return `${platformName} (${installId})`
  } catch {
    const platformName = getPlatformOS()
    return `${platformName} Device`
  }
}
