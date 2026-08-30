import { useState, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { scanBarcode } from '../api/endpoints'
import type { ScanResult, ScannedProduct, ScannedVariant } from '../types'

export interface ScanFeedback {
  message: string
  submessage?: string
  type: 'success' | 'warning' | 'error' | 'info'
  timestamp: number
}

export interface UseBarcodeScanOptions {
  mode?: 'cart' | 'picker' | 'stock-in' | 'stock-adj' | 'purchase-order' | 'custom'
  onBeforeProcess?: (code: string) => boolean | void
  onFoundVariant?: (variant: ScannedVariant, product?: ScannedProduct) => void
  onFoundProduct?: (product: ScannedProduct, variants: ScannedVariant[]) => void
  onNotFound?: (code: string) => void
  onError?: (error: unknown, code: string) => void
  onFeedback?: (feedback: ScanFeedback) => void
  autoAlertOnNotFound?: boolean
  autoAlertOnError?: boolean
  blockInactive?: boolean
  closeScannerOnFound?: boolean
  debounceMs?: number
  customToast?: (message: string) => void
}

export function useBarcodeScan(options: UseBarcodeScanOptions = {}) {
  const {
    mode = 'cart',
    onBeforeProcess,
    onFoundVariant,
    onFoundProduct,
    onNotFound,
    onError,
    onFeedback,
    autoAlertOnNotFound = false,
    autoAlertOnError = false,
    blockInactive = false,
    closeScannerOnFound = false,
    debounceMs = 1200,
    customToast,
  } = options

  const [scannerOpen, setScannerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerProduct, setPickerProduct] = useState<ScannedProduct | null>(null)
  const [pickerVariants, setPickerVariants] = useState<ScannedVariant[]>([])
  const [lastFeedback, setLastFeedback] = useState<ScanFeedback | null>(null)
  const lastScannedCode = useRef<string>('')
  const lastScannedTime = useRef<number>(0)

  const triggerFeedback = useCallback((feedback: ScanFeedback) => {
    setLastFeedback(feedback)
    if (onFeedback) {
      onFeedback(feedback)
    }
    if (customToast && feedback.type === 'success') {
      customToast(feedback.message)
    }
  }, [onFeedback, customToast])

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

  const clearFeedback = useCallback(() => {
    setLastFeedback(null)
  }, [])

  const handleScanCode = useCallback(
    async (code: string): Promise<ScanResult | null> => {
      const cleanCode = code?.trim()
      if (!cleanCode) return null

      const now = Date.now()
      if (loading) return null

      // If it's the identical code scanned within debounceMs window, ignore to avoid double fire
      if (cleanCode === lastScannedCode.current && now - lastScannedTime.current < debounceMs) {
        return null
      }

      lastScannedCode.current = cleanCode
      lastScannedTime.current = now

      // If onBeforeProcess returns true, skip network scan (e.g. already staged in list and incremented)
      if (onBeforeProcess && onBeforeProcess(cleanCode) === true) {
        return null
      }

      setLoading(true)

      try {
        const result = await scanBarcode(cleanCode)

        if (result?.type === 'variant' && result.variant) {
          const prodName = result.product?.name || result.variant.name || 'Product'
          const variantSku = result.variant.sku ? ` (${result.variant.sku})` : ''
          const availableStock = result.variant.quantity_on_hand !== undefined ? result.variant.quantity_on_hand : 0

          if (blockInactive && (result.variant.is_active === false || result.product?.is_active === false)) {
            triggerFeedback({
              message: `Product Deactivated: ${prodName}${variantSku}`,
              submessage: 'Item is inactive and cannot be selected',
              type: 'error',
              timestamp: Date.now(),
            })
            if (autoAlertOnError) {
              Alert.alert(
                'Product Deactivated',
                `"${result.variant.name || result.variant.sku}" is currently deactivated and cannot be selected.`
              )
            }
            return result
          }

          // Check if out of stock in cart mode
          if (mode === 'cart' && availableStock <= 0) {
            triggerFeedback({
              message: `Out of Stock: ${prodName}${variantSku}`,
              submessage: '0 units available in inventory',
              type: 'error',
              timestamp: Date.now(),
            })
            if (onFoundVariant) {
              onFoundVariant(result.variant, result.product)
            }
            return result
          }

          if (closeScannerOnFound) {
            setScannerOpen(false)
          }

          let customResult: any
          if (onFoundVariant) {
            customResult = onFoundVariant(result.variant, result.product)
          }

          if (customResult && typeof customResult === 'object') {
            if (!customResult.success) {
              if (customResult.reason === 'out_of_stock') {
                triggerFeedback({
                  message: `Out of Stock: ${prodName}${variantSku}`,
                  submessage: '0 units available in inventory',
                  type: 'error',
                  timestamp: Date.now(),
                })
              } else if (customResult.reason === 'max_stock_reached') {
                triggerFeedback({
                  message: `Max Stock Reached: ${prodName}`,
                  submessage: `Cannot exceed ${customResult.availableStock} in stock`,
                  type: 'warning',
                  timestamp: Date.now(),
                })
              }
              return result
            } else if (customResult.currentQuantity !== undefined) {
              triggerFeedback({
                message: `Added: ${prodName}${variantSku}`,
                submessage: `Qty in cart: ${customResult.currentQuantity} • ${availableStock} in stock`,
                type: 'success',
                timestamp: Date.now(),
              })
              return result
            }
          }

          triggerFeedback({
            message: `Scanned: ${prodName}${variantSku}`,
            submessage: cleanCode,
            type: 'success',
            timestamp: Date.now(),
          })

          return result
        } else if (result?.type === 'product' && result.product) {
          if (blockInactive && result.product.is_active === false) {
            triggerFeedback({
              message: `Product Deactivated: ${result.product.name}`,
              type: 'error',
              timestamp: Date.now(),
            })
            if (autoAlertOnError) {
              Alert.alert(
                'Product Deactivated',
                `"${result.product.name}" is currently deactivated and cannot be selected.`
              )
            }
            return result
          }

          const activeVariants = blockInactive
            ? (result.variants || []).filter((v) => v.is_active !== false)
            : result.variants || []

          if (blockInactive && result.variants && result.variants.length > 0 && activeVariants.length === 0) {
            triggerFeedback({
              message: `All variants deactivated: ${result.product.name}`,
              type: 'error',
              timestamp: Date.now(),
            })
            return result
          }

          triggerFeedback({
            message: `Found: ${result.product.name}`,
            submessage: `${activeVariants.length} variant(s) available`,
            type: 'info',
            timestamp: Date.now(),
          })

          setPickerProduct(result.product)
          setPickerVariants(activeVariants)
          setScannerOpen(false)
          setPickerOpen(true)

          if (onFoundProduct) {
            onFoundProduct(result.product, activeVariants)
          }
          return result
        } else {
          triggerFeedback({
            message: `Barcode Not Found: ${cleanCode}`,
            submessage: 'No matching product or variant in catalog',
            type: 'warning',
            timestamp: Date.now(),
          })

          if (onNotFound) {
            onNotFound(cleanCode)
          } else if (autoAlertOnNotFound) {
            Alert.alert('Scan Result', `No active product or variant found matching barcode "${cleanCode}".`)
          }
          return null
        }
      } catch (err: unknown) {
        triggerFeedback({
          message: `Scan Error for: ${cleanCode}`,
          submessage: err instanceof Error ? err.message : 'Lookup failed',
          type: 'error',
          timestamp: Date.now(),
        })

        if (onError) {
          onError(err, cleanCode)
        } else if (autoAlertOnError) {
          Alert.alert('Scan Error', `Could not lookup barcode "${cleanCode}". Try again.`)
        }
        return null
      } finally {
        setLoading(false)
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
      triggerFeedback,
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
    setPickerProduct,
    pickerVariants,
    setPickerVariants,
    closePicker,
    handleScanCode,
    lastFeedback,
    clearFeedback,
    triggerFeedback,
  }
}

