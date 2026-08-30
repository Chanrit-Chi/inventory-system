import type { PurchaseOrder, PurchaseOrderItem } from '../../types'

export function calculatePoTotalUnits(items: PurchaseOrderItem[] = []): number {
  return items.reduce((s, it) => s + (it.quantity || 0), 0)
}

export function calculatePoTotalCost(items: PurchaseOrderItem[] = []): number {
  return items.reduce((s, it) => s + (it.quantity || 0) * (it.unitCost || 0), 0)
}

export function formatPoDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}
