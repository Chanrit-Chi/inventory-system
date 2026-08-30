import React, { createContext, useContext, useMemo, ReactNode } from 'react'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import type { CheckoutPayload, OfflineMutation, OfflineMutationPayload } from '../types'

interface OfflineQueueContextValue {
  // State
  queue: OfflineMutation[]
  pendingCount: number
  isSyncing: boolean
  lastSyncResult: { synced: number; failed: number } | null
  isHydrated: boolean

  // Operations
  enqueueMutation: (payload: CheckoutPayload | OfflineMutationPayload) => OfflineMutation
  enqueueStockAdjustment: (data: any) => OfflineMutation
  enqueueStockIn: (data: {
    items: Array<{ variant_id: string; quantity: number; cost_price?: number; unit_cost?: number }>
    notes?: string
    reference_number?: string
    client_mutation_id: string
  }) => OfflineMutation
  enqueueStatusUpdate: (orderId: string, status: string, client_mutation_id?: string) => OfflineMutation
  removeMutation: (id: string) => void
  syncQueue: () => Promise<{ syncedOrders: any[]; failedCount: number }>
  clearQueue: () => void
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | undefined>(undefined)

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const hook = useOfflineQueue()

  const value = useMemo<OfflineQueueContextValue>(
    () => ({
      ...hook,
      isHydrated: true, // useOfflineQueue manages its own hydration internally
    }),
    [hook]
  )

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>
}

export function useOfflineQueueContext(): OfflineQueueContextValue {
  const context = useContext(OfflineQueueContext)
  if (!context) {
    throw new Error('useOfflineQueueContext must be used within an OfflineQueueProvider')
  }
  return context
}