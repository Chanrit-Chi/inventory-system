import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { checkoutOrder, adjustStock, restockInventory, updateOrderStatus } from '../api/endpoints'
import type { CheckoutPayload, OfflineMutation, OfflineMutationPayload, Order } from '../types'

const QUEUE_STORAGE_KEY = '@kc_inventory_offline_queue'

/**
 * Calculates exponential backoff delay in ms based on retry attempt:
 * attempt 0: 1000ms, attempt 1: 2000ms, attempt 2: 4000ms, max 30000ms
 */
export function getBackoffDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 30000)
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineMutation[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null)
  const isHydrated = useRef(false)
  const isSyncingRef = useRef(false)

  // Restore queue from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(QUEUE_STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) setQueue(parsed)
          } catch {
            // Ignore parse errors
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        isHydrated.current = true
      })
  }, [])

  // Persist queue changes to storage (only after initial hydration)
  useEffect(() => {
    if (!isHydrated.current) return
    AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue)).catch(() => {})
  }, [queue])

  /**
   * Enqueue a generic mutation or legacy CheckoutPayload with deduplication
   */
  const enqueueMutation = useCallback((payload: CheckoutPayload | OfflineMutationPayload) => {
    let id: string
    let endpoint = '/orders/checkout'

    if ('client_mutation_id' in payload) {
      // Legacy CheckoutPayload
      id = payload.client_mutation_id
    } else if (payload.type === 'CHECKOUT') {
      id = payload.data.client_mutation_id
    } else if (payload.type === 'STOCK_ADJUSTMENT') {
      id = payload.data.client_mutation_id
      endpoint = '/inventory/adjust'
    } else if (payload.type === 'STOCK_IN') {
      id = payload.data.client_mutation_id
      endpoint = '/inventory/restock'
    } else {
      id = `status_${payload.data.orderId}_${Date.now()}`
      endpoint = `/orders/${payload.data.orderId}/status`
    }

    const mutation: OfflineMutation = {
      id,
      timestamp: Date.now(),
      endpoint,
      payload,
      retryCount: 0,
      status: 'pending',
    }

    // Deduplication: replace existing pending mutation with same id, or append
    setQueue((prev) => {
      const exists = prev.some((m) => m.id === id)
      if (exists) {
        return prev.map((m) => (m.id === id ? mutation : m))
      }
      return [...prev, mutation]
    })

    return mutation
  }, [])

  /**
   * Enqueue Stock Adjustment
   */
  const enqueueStockAdjustment = useCallback(
    (data: { variant_id: string; type: string; quantity: number; reason: string; client_mutation_id: string }) => {
      return enqueueMutation({ type: 'STOCK_ADJUSTMENT', data })
    },
    [enqueueMutation]
  )

  /**
   * Enqueue Stock Intake / Restock
   */
  const enqueueStockIn = useCallback(
    (data: {
      items: Array<{ variant_id: string; quantity: number; cost_price?: number; unit_cost?: number }>
      notes?: string
      reference_number?: string
      client_mutation_id: string
    }) => {
      return enqueueMutation({ type: 'STOCK_IN', data })
    },
    [enqueueMutation]
  )

  /**
   * Enqueue Order Status Update
   */
  const enqueueStatusUpdate = useCallback(
    (orderId: string, status: string) => {
      return enqueueMutation({ type: 'UPDATE_ORDER_STATUS', data: { orderId, status } })
    },
    [enqueueMutation]
  )

  const removeMutation = useCallback((id: string) => {
    setQueue((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const syncQueue = useCallback(async (): Promise<{ syncedOrders: Order[]; failedCount: number }> => {
    if (isSyncingRef.current || queue.length === 0) {
      return { syncedOrders: [], failedCount: 0 }
    }

    isSyncingRef.current = true
    setIsSyncing(true)

    const syncedOrders: Order[] = []
    let failedCount = 0
    const remainingQueue: OfflineMutation[] = []

    for (const mutation of queue) {
      try {
        const payload = mutation.payload

        if ('client_mutation_id' in payload) {
          // Legacy CheckoutPayload
          const order = await checkoutOrder(payload)
          syncedOrders.push(order)
        } else if (payload.type === 'CHECKOUT') {
          const order = await checkoutOrder(payload.data)
          syncedOrders.push(order)
        } else if (payload.type === 'STOCK_ADJUSTMENT') {
          await adjustStock({
            variant_id: payload.data.variant_id,
            new_quantity: payload.data.quantity,
            reason: payload.data.reason,
          })
        } else if (payload.type === 'STOCK_IN') {
          await restockInventory({
            items: payload.data.items.map((it) => ({
              variant_id: it.variant_id,
              quantity: it.quantity,
              unit_cost: it.unit_cost ?? it.cost_price ?? 0,
            })),
            notes: payload.data.notes || payload.data.reference_number,
          })
        } else if (payload.type === 'UPDATE_ORDER_STATUS') {
          const updated = await updateOrderStatus(payload.data.orderId, payload.data.status)
          syncedOrders.push(updated)
        }
      } catch (err: unknown) {
        failedCount++
        remainingQueue.push({
          ...mutation,
          retryCount: mutation.retryCount + 1,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Sync error',
        })
      }
    }

    setQueue(remainingQueue)
    setIsSyncing(false)
    isSyncingRef.current = false
    setLastSyncResult({ synced: queue.length - failedCount, failed: failedCount })

    return { syncedOrders, failedCount }
  }, [queue])

  const clearQueue = useCallback(() => {
    setQueue([])
    setLastSyncResult(null)
  }, [])

  return useMemo(
    () => ({
      queue,
      pendingCount: queue.length,
      isSyncing,
      lastSyncResult,
      enqueueMutation,
      enqueueStockAdjustment,
      enqueueStockIn,
      enqueueStatusUpdate,
      removeMutation,
      syncQueue,
      clearQueue,
    }),
    [
      queue,
      isSyncing,
      lastSyncResult,
      enqueueMutation,
      enqueueStockAdjustment,
      enqueueStockIn,
      enqueueStatusUpdate,
      removeMutation,
      syncQueue,
      clearQueue,
    ]
  )
}
