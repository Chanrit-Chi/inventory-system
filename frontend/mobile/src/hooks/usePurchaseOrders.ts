import { useState, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { restockInventory } from '../api/endpoints'
import { queryClient } from '../api/queryClient'
import { queryKeys } from '../api/queryKeys'
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
    async (poId: string) => {
      const targetPo = purchaseOrders.find((p) => p.id === poId)
      if (targetPo && targetPo.status === 'RECEIVED') {
        return { success: false, reason: 'already_received', totalUnits: 0 }
      }

      // Restock items into inventory if items exist
      let totalUnits = 0
      if (targetPo && targetPo.items && targetPo.items.length > 0) {
        const restockItems = targetPo.items
          .filter((it) => it.variantId && it.quantity > 0)
          .map((it) => ({
            variant_id: it.variantId,
            quantity: it.quantity,
            unit_cost: it.unitCost || 0,
          }))

        totalUnits = restockItems.reduce((sum, it) => sum + it.quantity, 0)

        if (restockItems.length > 0) {
          try {
            await restockInventory({
              items: restockItems,
              notes: `PO Received: ${targetPo.poNumber || targetPo.id}`,
            })
            await Promise.allSettled([
              queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
              queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
              queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
            ])
          } catch (err: unknown) {
            console.warn('[usePurchaseOrders] Restock API error, PO status still updated:', err)
          }
        }
      }

      setPurchaseOrders((prev) => {
        const next = prev.map((po) =>
          po.id === poId ? { ...po, status: 'RECEIVED' as PurchaseOrderStatus } : po
        )
        savePOs(next)
        return next
      })

      return { success: true, totalUnits }
    },
    [purchaseOrders, savePOs]
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
