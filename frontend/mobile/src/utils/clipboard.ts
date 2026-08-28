import * as Clipboard from 'expo-clipboard'

export type CopyableType = 'sku' | 'barcode' | string

export interface CopyToClipboardOptions {
  type?: CopyableType
  label?: string
  onToast?: (message: string) => void
  showGlobalToast?: boolean
}

type ToastListener = (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void

const globalToastListeners = new Set<ToastListener>()

export function registerGlobalToastListener(listener: ToastListener): () => void {
  globalToastListeners.add(listener)
  return () => {
    globalToastListeners.delete(listener)
  }
}

export function emitGlobalToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'success'): void {
  globalToastListeners.forEach((listener) => {
    try {
      listener(message, type)
    } catch {
      // Ignore listener errors
    }
  })
}

/**
 * Safely copies a string to the system clipboard and triggers toast feedback.
 * Safely degrades on null, undefined, empty, or whitespace-only inputs without copying or crashing.
 */
export async function copyToClipboard(
  value?: string | null,
  options?: CopyToClipboardOptions
): Promise<boolean> {
  if (!value || typeof value !== 'string') {
    return false
  }

  const cleanValue = value.trim()
  if (!cleanValue) {
    return false
  }

  try {
    await Clipboard.setStringAsync(cleanValue)
  } catch {
    // If expo-clipboard is not available or errors, return false gracefully
    return false
  }

  let labelStr = ''
  if (options?.label) {
    labelStr = options.label.trim().replace(/[:\s]+$/, '')
  } else if (options?.type) {
    const norm = options.type.trim().toLowerCase()
    if (norm === 'sku') {
      labelStr = 'SKU'
    } else if (norm === 'barcode') {
      labelStr = 'Barcode'
    }
  }

  const feedbackMessage = labelStr
    ? `Copied ${labelStr}: ${cleanValue}`
    : `Copied: ${cleanValue}`

  if (options?.onToast) {
    try {
      options.onToast(feedbackMessage)
    } catch {
      // Ignore callback errors
    }
  }

  if (options?.showGlobalToast !== false) {
    emitGlobalToast(feedbackMessage, 'success')
  }

  return true
}
