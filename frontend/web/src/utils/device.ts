const DEVICE_INSTALL_KEY = '@kc_web_device_install_id'

function getBrowserName(): string {
  if (typeof navigator === 'undefined') return 'Web'
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg')) return 'Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  return 'Browser'
}

/**
 * Returns a persistent, unique device identifier for this browser installation.
 * Used during login to allow the same account to be logged into multiple physical devices / browsers
 * (e.g., POS terminal, office desktop, mobile tablet) without kicking each other out.
 */
export function getDeviceIdentifier(): string {
  try {
    let installId = localStorage.getItem(DEVICE_INSTALL_KEY)
    if (!installId) {
      // Generate a short 6-character alphanumeric installation hash
      installId = Math.random().toString(36).substring(2, 8).toUpperCase()
      localStorage.setItem(DEVICE_INSTALL_KEY, installId)
    }

    const browserName = getBrowserName()
    return `Web-${browserName} (${installId})`
  } catch {
    return 'Web Device'
  }
}
