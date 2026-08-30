import type { Order } from '../../types'

export type FilterStatus = 'ALL' | 'COMPLETED' | 'PENDING' | 'CANCELLED'
export type DateRangeMode = 'all' | 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'

export function computeActiveDateBounds(
  dateRange: DateRangeMode,
  singleDate: string,
  customFrom: string,
  customTo: string
): { from?: string; to?: string } {
  const todayStr = new Date().toISOString().split('T')[0]
  if (dateRange === 'today') {
    return { from: todayStr, to: todayStr }
  }
  if (dateRange === '7d') {
    const fromStr = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    return { from: fromStr, to: todayStr }
  }
  if (dateRange === '30d') {
    const fromStr = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
    return { from: fromStr, to: todayStr }
  }
  if (dateRange === 'year') {
    const thisYear = new Date().getFullYear()
    return { from: `${thisYear}-01-01`, to: todayStr }
  }
  if (dateRange === 'single') {
    return { from: singleDate, to: singleDate }
  }
  if (dateRange === 'custom') {
    return { from: customFrom, to: customTo }
  }
  return { from: undefined, to: undefined }
}

export function isDateWithinBounds(dateStr?: string, from?: string, to?: string): boolean {
  if (!from && !to) return true
  if (!dateStr) return true
  const target = dateStr.split('T')[0]
  if (from && target < from) return false
  if (to && target > to) return false
  return true
}

export function computeTransactionMetrics(orders: Order[] = []) {
  const totalVolume = orders.reduce((acc, o) => {
    const orderWithTotal = o as { total_amount?: string | number; total?: string | number };
    const rawTotal = orderWithTotal.total_amount ?? orderWithTotal.total ?? 0
    const amt = typeof rawTotal === 'number' ? rawTotal : parseFloat(String(rawTotal || '0')) || 0
    return acc + amt
  }, 0)

  const completedCount = orders.filter((o) => (o.status || '').toLowerCase() === 'paid' || (o.status || '').toLowerCase() === 'completed').length
  const pendingCount = orders.filter((o) => (o.status || '').toLowerCase() === 'pending' || (o.status || '').toLowerCase() === 'unpaid').length
  const cancelledCount = orders.filter((o) => (o.status || '').toLowerCase() === 'cancelled' || (o.status || '').toLowerCase() === 'refunded').length

  return {
    totalVolume,
    totalCount: orders.length,
    completedCount,
    pendingCount,
    cancelledCount,
  }
}
