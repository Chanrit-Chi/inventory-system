import { useState, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PurchaseOrder, PurchaseOrderStatus } from '../types'

const PO_STORAGE_KEY = '@omnipos_purchase_orders_v2'

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = []

export function usePurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from local storage on mount
  useEffect(() => {
    async function loadStoredPOs() {
      try {
        const raw = await AsyncStorage.getItem(PO_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPurchaseOrders(parsed)
          }
        }
      } catch {
        // Fallback to initial
      } finally {
        setIsLoaded(true)
      }
    }
    loadStoredPOs()
  }, [])

  // Save to local storage whenever POs change
  const savePOs = useCallback(async (orders: PurchaseOrder[]) => {
    try {
      await AsyncStorage.setItem(PO_STORAGE_KEY, JSON.stringify(orders))
    } catch {
      // Storage error ignored
    }
  }, [])

  // Only pending purchase orders (status ORDERED)
  const pendingPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => po.status === 'ORDERED')
  }, [purchaseOrders])

  const addPurchaseOrder = useCallback(
    (po: PurchaseOrder) => {
      setPurchaseOrders((prev) => {
        const next = [po, ...prev]
        savePOs(next)
        return next
      })
    },
    [savePOs]
  )

  const markPoReceived = useCallback(
    (poId: string) => {
      setPurchaseOrders((prev) => {
        const next = prev.map((po) =>
          po.id === poId ? { ...po, status: 'RECEIVED' as PurchaseOrderStatus } : po
        )
        savePOs(next)
        return next
      })
    },
    [savePOs]
  )

  const updatePoStatus = useCallback(
    (poId: string, status: PurchaseOrderStatus) => {
      setPurchaseOrders((prev) => {
        const next = prev.map((po) => (po.id === poId ? { ...po, status } : po))
        savePOs(next)
        return next
      })
    },
    [savePOs]
  )

  return {
    purchaseOrders,
    pendingPurchaseOrders,
    isLoaded,
    addPurchaseOrder,
    markPoReceived,
    updatePoStatus,
    setPurchaseOrders,
  }
}
