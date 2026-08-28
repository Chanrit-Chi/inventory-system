import { useState, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { scanBarcode } from '../api/endpoints'
import type { ScanResult, ScannedProduct, ScannedVariant } from '../types'

export interface UseBarcodeScanOptions {
  mode?: 'cart' | 'picker' | 'stock-in' | 'stock-adj' | 'purchase-order' | 'custom'
  onBeforeProcess?: (code: string) => boolean | void
  onFoundVariant?: (variant: ScannedVariant, product?: ScannedProduct) => void
  onFoundProduct?: (product: ScannedProduct, variants: ScannedVariant[]) => void
  onNotFound?: (code: string) => void
  onError?: (error: any, code: string) => void
  autoAlertOnNotFound?: boolean
  autoAlertOnError?: boolean
  blockInactive?: boolean
  closeScannerOnFound?: boolean
  debounceMs?: number
  customToast?: (message: string) => void
}

export function useBarcodeScan(options: UseBarcodeScanOptions = {}) {
  const {
    onBeforeProcess,
    onFoundVariant,
    onFoundProduct,
    onNotFound,
    onError,
    autoAlertOnNotFound = true,
    autoAlertOnError = true,
    blockInactive = false,
    closeScannerOnFound = true,
    debounceMs = 1500,
    customToast,
  } = options

  const [scannerOpen, setScannerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerProduct, setPickerProduct] = useState<ScannedProduct | null>(null)
  const [pickerVariants, setPickerVariants] = useState<ScannedVariant[]>([])
  const lastScannedCode = useRef<string>('')

  const openScanner = useCallback(() => {
    setScannerOpen(true)
  }, [])

  const closeScanner = useCallback(() => {
    setScannerOpen(false)
  }, [])

  const closePicker = useCallback(() => {
    setPickerOpen(false)
    setPickerProduct(null)
    setPickerVariants([])
  }, [])

  const handleScanCode = useCallback(
    async (code: string): Promise<ScanResult | null> => {
      const cleanCode = code?.trim()
      if (!cleanCode) return null
      if (loading || cleanCode === lastScannedCode.current) return null

      lastScannedCode.current = cleanCode

      // If onBeforeProcess returns true, skip network scan (e.g. already in list)
      if (onBeforeProcess && onBeforeProcess(cleanCode) === true) {
        setTimeout(() => {
          lastScannedCode.current = ''
        }, debounceMs)
        return null
      }

      setLoading(true)

      try {
        const result = await scanBarcode(cleanCode)

        if (result?.type === 'variant' && result.variant) {
          if (blockInactive && (result.variant.is_active === false || result.product?.is_active === false)) {
            setScannerOpen(false)
            Alert.alert(
              'Product Deactivated',
              `"${result.variant.name || result.variant.sku}" is currently deactivated and cannot be selected.\n\nPlease reactivate it in Products before use.`
            )
            return result
          }

          if (closeScannerOnFound) {
            setScannerOpen(false)
          }

          if (onFoundVariant) {
            onFoundVariant(result.variant, result.product)
          }
          return result
        } else if (result?.type === 'product' && result.product) {
          if (blockInactive && result.product.is_active === false) {
            setScannerOpen(false)
            Alert.alert(
              'Product Deactivated',
              `"${result.product.name}" is currently deactivated and cannot be selected.\n\nPlease reactivate it in Products before use.`
            )
            return result
          }

          const activeVariants = blockInactive
            ? (result.variants || []).filter((v) => v.is_active !== false)
            : result.variants || []

          if (blockInactive && result.variants && result.variants.length > 0 && activeVariants.length === 0) {
            setScannerOpen(false)
            Alert.alert(
              'Product Deactivated',
              `All variants of "${result.product.name}" are currently deactivated.\n\nPlease reactivate them in Products before use.`
            )
            return result
          }

          setPickerProduct(result.product)
          setPickerVariants(activeVariants)
          setScannerOpen(false)
          setPickerOpen(true)

          if (onFoundProduct) {
            onFoundProduct(result.product, activeVariants)
          }
          return result
        } else {
          if (onNotFound) {
            onNotFound(cleanCode)
          } else if (customToast) {
            customToast(`No product found for barcode: ${cleanCode}`)
          } else if (autoAlertOnNotFound) {
            Alert.alert('Scan Result', `No active product or variant found matching barcode "${cleanCode}".`)
          }
          return null
        }
      } catch (err: any) {
        if (onError) {
          onError(err, cleanCode)
        } else if (customToast) {
          customToast(`Error scanning: ${cleanCode}`)
        } else if (autoAlertOnError) {
          Alert.alert('Scan Error', `Could not lookup barcode "${cleanCode}". Try again.`)
        }
        return null
      } finally {
        setLoading(false)
        setTimeout(() => {
          lastScannedCode.current = ''
        }, debounceMs)
      }
    },
    [
      loading,
      onBeforeProcess,
      onFoundVariant,
      onFoundProduct,
      onNotFound,
      onError,
      autoAlertOnNotFound,
      autoAlertOnError,
      blockInactive,
      closeScannerOnFound,
      debounceMs,
      customToast,
    ]
  )

  return {
    scannerOpen,
    setScannerOpen,
    openScanner,
    closeScanner,
    loading,
    pickerOpen,
    setPickerOpen,
    pickerProduct,
    pickerVariants,
    closePicker,
    handleScanCode,
  }
}
