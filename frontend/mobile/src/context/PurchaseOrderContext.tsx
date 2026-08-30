import React, { createContext, useContext, useMemo, ReactNode } from 'react'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import type { PurchaseOrder, PurchaseOrderStatus } from '../types'

interface PurchaseOrderContextValue {
  // State
  purchaseOrders: PurchaseOrder[]
  pendingPurchaseOrders: PurchaseOrder[]
  isLoaded: boolean

  // Operations
  addPurchaseOrder: (po: PurchaseOrder) => void
  markPoReceived: (poId: string) => Promise<{ success: boolean; totalUnits: number; reason?: string }>
  updatePoStatus: (poId: string, status: PurchaseOrderStatus) => void
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>
}

const PurchaseOrderContext = createContext<PurchaseOrderContextValue | undefined>(undefined)

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const hook = usePurchaseOrders()

  const value = useMemo<PurchaseOrderContextValue>(
    () => ({
      ...hook,
    }),
    [hook]
  )

  return <PurchaseOrderContext.Provider value={value}>{children}</PurchaseOrderContext.Provider>
}

export function usePurchaseOrderContext(): PurchaseOrderContextValue {
  const context = useContext(PurchaseOrderContext)
  if (!context) {
    throw new Error('usePurchaseOrderContext must be used within a PurchaseOrderProvider')
  }
  return context
}