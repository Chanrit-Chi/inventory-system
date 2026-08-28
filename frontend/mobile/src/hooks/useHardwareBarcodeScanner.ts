import { useEffect, useRef, useCallback } from 'react'
import { Platform } from 'react-native'

export interface UseHardwareBarcodeScannerOptions {
  onScan: (barcode: string) => void
  enabled?: boolean
  maxIntervalMs?: number // Max time between character keystrokes in a scan (usually < 50ms for laser/2D scanner)
  minBarcodeLength?: number
}

/**
 * Hook to intercept and buffer rapid keystrokes from hardware USB/Bluetooth barcode scanners
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  maxIntervalMs = 60,
  minBarcodeLength = 3,
}: UseHardwareBarcodeScannerOptions) {
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)

  const handleChar = useCallback(
    (char: string) => {
      if (!enabled) return

      const now = Date.now()
      const timeDiff = now - lastKeyTimeRef.current

      // If time between keystrokes is too long, reset buffer (user is typing manually)
      if (timeDiff > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      lastKeyTimeRef.current = now

      if (char === '\n' || char === '\r' || char === 'Enter') {
        const barcode = bufferRef.current.trim()
        if (barcode.length >= minBarcodeLength) {
          onScan(barcode)
        }
        bufferRef.current = ''
      } else if (char.length === 1) {
        bufferRef.current += char
      }
    },
    [enabled, maxIntervalMs, minBarcodeLength, onScan]
  )

  return {
    handleChar,
    resetBuffer: () => {
      bufferRef.current = ''
    },
  }
}
