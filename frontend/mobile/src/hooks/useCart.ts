import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CartItem, ScannedVariant } from '../types'

const CART_STORAGE_KEY = '@kc_inventory_active_cart'
const PRESET_STORAGE_KEY = '@kc_inventory_active_cart_preset'

export interface CartCheckoutPreset {
  discount?: number | string
  customerName?: string
  customerPhone?: string
  notes?: string
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [checkoutPreset, setCheckoutPreset] = useState<CartCheckoutPreset | null>(null)
  const isHydrated = useRef(false)

  // 1. Restore persisted cart and preset from storage on mount
  useEffect(() => {
    async function restoreCart() {
      try {
        const [storedCart, storedPreset] = await Promise.all([
          AsyncStorage.getItem(CART_STORAGE_KEY),
          AsyncStorage.getItem(PRESET_STORAGE_KEY),
        ])
        if (storedCart) {
          const parsed = JSON.parse(storedCart)
          if (Array.isArray(parsed)) {
            setCart(parsed)
          }
        }
        if (storedPreset) {
          const parsedPreset = JSON.parse(storedPreset)
          if (parsedPreset && typeof parsedPreset === 'object') {
            setCheckoutPreset(parsedPreset)
          }
        }
      } catch {
        // Fallback silently if storage read fails
      } finally {
        isHydrated.current = true
      }
    }
    restoreCart()
  }, [])

  // 2. Persist cart state to AsyncStorage on changes (only after initial hydration)
  //    Debounced so rapid POS taps don't trigger a storage write per keystroke/tap.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isHydrated.current) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)).catch(() => {})
    }, 400)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [cart])

  // 3. Persist checkout preset state
  useEffect(() => {
    if (!isHydrated.current) return
    if (checkoutPreset) {
      AsyncStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(checkoutPreset)).catch(() => {})
    } else {
      AsyncStorage.removeItem(PRESET_STORAGE_KEY).catch(() => {})
    }
  }, [checkoutPreset])

  const addVariantToCart = useCallback((variant: ScannedVariant, productName: string, productImageUrl?: string | null) => {
    const rawPrice = variant.selling_price_override ?? variant.selling_price ?? variant.product?.selling_price ?? '0'
    const unitPrice = parseFloat(rawPrice) || 0
    const availableStock = variant.quantity_on_hand ?? 0
    if (availableStock <= 0) {
      return
    }
    const attrs = variant.attribute_values?.map(av => `${av.attribute?.name ? av.attribute.name + ': ' : ''}${av.value_name}`).join(', ')

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.variantId === variant.id)
      if (existingIndex >= 0) {
        const current = prevCart[existingIndex]
        if (current.quantity >= availableStock) {
          return prevCart
        }
        const updated = [...prevCart]
        updated[existingIndex] = {
          ...current,
          quantity: current.quantity + 1,
          availableStock, // refresh stock count
        }
        return updated
      }

      return [
        ...prevCart,
        {
          variantId: variant.id,
          sku: variant.sku,
          productName: productName || variant.product?.name || 'Product',
          quantity: 1,
          unitPrice,
          availableStock,
          attributesSummary: attrs || undefined,
          imageUrl: productImageUrl || variant.product?.image_url || undefined,
        },
      ]
    })
  }, [])

  const addMultipleItemsToCart = useCallback((items: Array<{
    variantId: string
    sku?: string
    productName: string
    quantity: number
    unitPrice: number
    availableStock?: number
    imageUrl?: string | null
    attributesSummary?: string
  }>) => {
    setCart(prevCart => {
      const updated = [...prevCart]
      for (const it of items) {
        const stockLimit = it.availableStock !== undefined ? it.availableStock : 0
        if (stockLimit <= 0) continue

        const existingIndex = updated.findIndex(item => item.variantId === it.variantId)
        if (existingIndex >= 0) {
          const current = updated[existingIndex]
          const targetStock = it.availableStock ?? current.availableStock
          const newQty = Math.min(current.quantity + (it.quantity || 1), targetStock > 0 ? targetStock : current.quantity)
          updated[existingIndex] = {
            ...current,
            quantity: newQty,
            availableStock: targetStock,
          }
        } else {
          const qty = it.quantity || 1
          const initialQty = stockLimit > 0 ? Math.min(qty, stockLimit) : qty
          updated.push({
            variantId: it.variantId,
            sku: it.sku || 'SKU-CUSTOM',
            productName: it.productName || 'Product',
            quantity: initialQty,
            unitPrice: it.unitPrice || 0,
            availableStock: stockLimit,
            imageUrl: it.imageUrl || undefined,
            attributesSummary: it.attributesSummary,
          })
        }
      }
      return updated
    })
  }, [])

  const updateQuantity = useCallback((variantId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart
        .map(item => {
          if (item.variantId === variantId) {
            if (delta > 0) {
              if (item.availableStock <= 0 || item.quantity >= item.availableStock) {
                return item
              }
            }
            const nextQty = item.quantity + delta
            return nextQty > 0 ? { ...item, quantity: nextQty } : null
          }
          return item
        })
        .filter((item): item is CartItem => item !== null)
    })
  }, [])

  const removeFromCart = useCallback((variantId: string) => {
    setCart(prevCart => prevCart.filter(item => item.variantId !== variantId))
  }, [])

  const setItemQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(variantId)
      return
    }
    setCart(prevCart =>
      prevCart.map(item => {
        if (item.variantId === variantId) {
          const maxAllowed = item.availableStock > 0 ? Math.min(quantity, item.availableStock) : 0
          return maxAllowed > 0 ? { ...item, quantity: maxAllowed } : item
        }
        return item
      })
    )
  }, [removeFromCart])

  const clearCart = useCallback(() => {
    setCart([])
    setCheckoutPreset(null)
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(() => {})
    AsyncStorage.removeItem(PRESET_STORAGE_KEY).catch(() => {})
  }, [])

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }, [cart])

  const totalItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  const stockWarnings = useMemo(() => {
    const warnings: Record<string, string> = {}
    for (const item of cart) {
      if (item.availableStock <= 0) {
        warnings[item.variantId] = 'Out of stock'
      } else if (item.quantity > item.availableStock) {
        warnings[item.variantId] = `Exceeds stock (available: ${item.availableStock})`
      }
    }
    return warnings
  }, [cart])

  const hasOutOfStockItems = useMemo(() => {
    return Object.keys(stockWarnings).length > 0
  }, [stockWarnings])

  const replaceCartWithItems = useCallback((items: Array<{
    variantId: string
    sku?: string
    productName: string
    quantity: number
    unitPrice: number
    availableStock?: number
    imageUrl?: string | null
    attributesSummary?: string
  }>, preset?: CartCheckoutPreset | null) => {
    const mergedMap = new Map<string, CartItem>()
    items.forEach((it, idx) => {
      const vid = it.variantId || `cart-item-${idx}-${Date.now()}`
      if (mergedMap.has(vid)) {
        const existing = mergedMap.get(vid)!
        existing.quantity += Math.max(1, it.quantity || 1)
      } else {
        mergedMap.set(vid, {
          variantId: vid,
          sku: it.sku || 'SKU-CUSTOM',
          productName: it.productName || 'Product',
          quantity: Math.max(1, it.quantity || 1),
          unitPrice: it.unitPrice || 0,
          availableStock: it.availableStock ?? 999,
          imageUrl: it.imageUrl || undefined,
          attributesSummary: it.attributesSummary,
        })
      }
    })
    setCart(Array.from(mergedMap.values()))
    if (preset !== undefined) {
      setCheckoutPreset(preset)
    }
  }, [])

  return useMemo(
    () => ({
      cart,
      checkoutPreset,
      setCheckoutPreset,
      addVariantToCart,
      addMultipleItemsToCart,
      replaceCartWithItems,
      updateQuantity,
      setItemQuantity,
      removeFromCart,
      clearCart,
      cartTotal,
      totalItemCount,
      stockWarnings,
      hasOutOfStockItems,
    }),
    [
      cart,
      checkoutPreset,
      addVariantToCart,
      addMultipleItemsToCart,
      replaceCartWithItems,
      updateQuantity,
      setItemQuantity,
      removeFromCart,
      clearCart,
      cartTotal,
      totalItemCount,
      stockWarnings,
      hasOutOfStockItems,
    ]
  )
}
