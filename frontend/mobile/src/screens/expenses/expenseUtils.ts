import { tokens } from '../../theme/tokens'
import type { ExpenseRecord } from '../../types'

export type DateRangeMode = 'all' | 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'

export const CATEGORIES: ExpenseRecord['category'][] = [
  'Rent',
  'Utilities',
  'Salary',
  'Logistics',
  'Marketing',
  'Supplies',
  'Maintenance',
  'Other',
]

export function formatExpenseDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recent'
  try {
    const target = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`).getTime()
    const diffMs = Date.now() - target
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays <= 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    const d = new Date(target)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recent'
  }
}

export function getCategoryConfig(category: string) {
  switch (category) {
    case 'Rent':
      return { icon: 'business-outline' as const, color: tokens.colors.primaryContainer, bg: tokens.colors.actionPrimaryBg, label: 'Rent' }
    case 'Utilities':
      return { icon: 'flash-outline' as const, color: '#F59E0B', bg: '#FEF3C7', label: 'Utilities' }
    case 'Salary':
      return { icon: 'people-outline' as const, color: '#8B5CF6', bg: '#F5F3FF', label: 'Salary' }
    case 'Logistics':
      return { icon: 'car-outline' as const, color: '#06B6D4', bg: '#ECFEFF', label: 'Logistics' }
    case 'Marketing':
      return { icon: 'megaphone-outline' as const, color: '#EC4899', bg: '#FDF2F8', label: 'Marketing' }
    case 'Supplies':
      return { icon: 'cart-outline' as const, color: '#10B981', bg: '#ECFDF5', label: 'Supplies' }
    case 'Maintenance':
      return { icon: 'construct-outline' as const, color: '#F97316', bg: '#FFF7ED', label: 'Maintenance' }
    default:
      return { icon: 'receipt-outline' as const, color: '#64748B', bg: '#F1F5F9', label: 'Other' }
  }
}

export function getPaymentBadge(method: string) {
  const m = (method || '').toLowerCase()
  if (m.includes('aba') || m.includes('khqr')) {
    return { name: 'qr-code' as const, color: '#005F83', bg: '#E0F2FE', label: 'ABA QR' }
  }
  if (m.includes('bank') || m.includes('transfer')) {
    return { name: 'business' as const, color: '#1E3A8A', bg: '#FFF7ED', label: 'Bank' }
  }
  if (m.includes('card')) {
    return { name: 'card' as const, color: '#7C3AED', bg: '#EDE9FE', label: 'Card' }
  }
  return { name: 'cash' as const, color: '#16A34A', bg: '#DCFCE7', label: 'Cash' }
}
