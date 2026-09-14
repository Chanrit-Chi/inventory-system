import type { Payroll } from '@/stores/payrollStore'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function getPeriodRange(year: number | string, month: number | string) {
  const y = Number(year)
  const m = Number(month)
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(lastDay)}`,
    lastDay,
    formatted: `01-${pad(lastDay)} ${MONTH_NAMES[m - 1] ?? ''} ${y}`,
  }
}

export function formatMoney(n: number | string | undefined | null): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (num === null || num === undefined || isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function getStaffName(p: Payroll): string {
  return p.user?.name || (p as any).staff_name || `Staff #${p.user_id?.slice(0, 8) || 'N/A'}`
}

export function getStaffRole(p: Payroll): string {
  const r = p.user?.role || (p as any).role || ''
  const d = p.user?.department || (p as any).department || ''
  if (r && d) return `${r} (${d})`
  return r || d || 'Employee'
}

export function getStaffDept(p: Payroll): string {
  return p.user?.department || (p as any).department || 'General'
}

export function statusBadge(status: string): { variant: 'default' | 'primary' | 'secondary' | 'amber' | 'success' | 'warning' | 'error' | 'destructive' | 'info' | 'purple' | 'neutral' | 'outline'; label: string } {
  switch (status?.toUpperCase()) {
    case 'PAID':
      return { variant: 'success', label: 'Paid' }
    case 'FINALIZED':
      return { variant: 'primary', label: 'Finalized' }
    case 'DRAFT':
    default:
      return { variant: 'warning', label: 'Draft' }
  }
}
