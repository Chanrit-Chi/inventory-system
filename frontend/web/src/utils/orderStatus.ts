// Order status -> Badge variant + human label
// Mirrors mobile's TransactionCard mapping (paid/pending/cancelled) and
// the backend's UPPERCASE lifecycle (COMPLETED/PENDING/PROCESSING/CANCELLED).
export type OrderStatusVariant =
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'neutral'

export interface OrderStatusInfo {
  variant: OrderStatusVariant
  label: string
}

const STATUS_MAP: Record<string, OrderStatusInfo> = {
  // UPPERCASE (backend)
  COMPLETED: { variant: 'success', label: 'Completed' },
  PAID: { variant: 'success', label: 'Completed' },
  PENDING: { variant: 'warning', label: 'Pending' },
  PROCESSING: { variant: 'info', label: 'Processing' },
  SENT: { variant: 'info', label: 'Processing' },
  CANCELLED: { variant: 'destructive', label: 'Cancelled' },
  REJECTED: { variant: 'destructive', label: 'Cancelled' },
  REFUNDED: { variant: 'neutral', label: 'Refunded' },
  FAILED: { variant: 'destructive', label: 'Failed' },
  DRAFT: { variant: 'warning', label: 'Pending' },
  // lowercase (mobile / mixed legacy)
  completed: { variant: 'success', label: 'Completed' },
  paid: { variant: 'success', label: 'Completed' },
  pending: { variant: 'warning', label: 'Pending' },
  processing: { variant: 'info', label: 'Processing' },
  sent: { variant: 'info', label: 'Processing' },
  cancelled: { variant: 'destructive', label: 'Cancelled' },
  rejected: { variant: 'destructive', label: 'Cancelled' },
  refunded: { variant: 'neutral', label: 'Refunded' },
  failed: { variant: 'destructive', label: 'Failed' },
  draft: { variant: 'warning', label: 'Pending' },
}

export function getOrderStatus(status?: string | null): OrderStatusInfo {
  if (!status) return { variant: 'neutral', label: 'Unknown' }
  return STATUS_MAP[status] ?? { variant: 'neutral', label: status }
}
