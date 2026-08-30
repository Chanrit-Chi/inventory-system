import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react'
import { useCart as useCartHook, CartCheckoutPreset, AddVariantResult } from '../hooks/useCart'
import type { CartItem, ScannedVariant } from '../types'

interface CartContextValue {
  // State
  cart: CartItem[]
  checkoutPreset: CartCheckoutPreset | null
  isHydrated: boolean

  // Cart operations
  addVariantToCart: (variant: ScannedVariant, productName: string, productImageUrl?: string | null) => AddVariantResult
  addMultipleItemsToCart: (items: Array<{
    variantId: string
    sku?: string
    productName: string
    quantity: number
    unitPrice: number
    availableStock?: number
    imageUrl?: string | null
    attributesSummary?: string
  }>) => void
  replaceCartWithItems: (items: Array<{
    variantId: string
    sku?: string
    productName: string
    quantity: number
    unitPrice: number
    availableStock?: number
    imageUrl?: string | null
    attributesSummary?: string
  }>, preset?: CartCheckoutPreset | null) => void
  updateQuantity: (variantId: string, delta: number) => void
  removeFromCart: (variantId: string) => void
  setItemQuantity: (variantId: string, quantity: number) => void
  clearCart: () => void

  // Checkout preset
  setCheckoutPreset: (preset: CartCheckoutPreset | null) => void

  // Computed
  cartTotal: number
  totalItemCount: number
  stockWarnings: Record<string, string>
  hasOutOfStockItems: boolean
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const cartHook = useCartHook()

  const value = useMemo<CartContextValue>(
    () => ({
      ...cartHook,
      isHydrated: true, // useCart manages its own hydration internally
    }),
    [cartHook]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCartContext(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider')
  }
  return context
}