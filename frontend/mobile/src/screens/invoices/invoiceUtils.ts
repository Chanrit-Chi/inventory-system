import type { Invoice, InvoicePaymentRecord, InvoiceStatus } from '../../types'
import { tokens } from '../../theme/tokens'

export function getInvoiceNumber(inv: Invoice): string {
  return inv.invoice_number || inv.invoiceNumber || 'INV-2026'
}

export function getOrderNumber(inv: Invoice): string | null {
  return inv.order_number || inv.orderNumber || null
}

export function getCustomerName(inv: Invoice): string {
  return inv.customer_name || inv.customerName || 'General Customer'
}

export function getCustomerPhone(inv: Invoice): string {
  return inv.customer_phone || inv.customerPhone || ''
}

export function getTotalAmount(inv: Invoice): number {
  if (inv.total_amount !== undefined) {
    return typeof inv.total_amount === 'number' ? inv.total_amount : parseFloat(String(inv.total_amount)) || 0
  }
  if (inv.totalAmount !== undefined) {
    return typeof inv.totalAmount === 'number' ? inv.totalAmount : parseFloat(String(inv.totalAmount)) || 0
  }
  return 0
}

export function getAmountPaid(inv: Invoice): number {
  if (inv.amount_paid !== undefined) {
    return typeof inv.amount_paid === 'number' ? inv.amount_paid : parseFloat(String(inv.amount_paid)) || 0
  }
  if (inv.amountPaid !== undefined) {
    return typeof inv.amountPaid === 'number' ? inv.amountPaid : parseFloat(String(inv.amountPaid)) || 0
  }
  return 0
}

export function getBalanceDue(inv: Invoice): number {
  if (inv.balance_due !== undefined) {
    return typeof inv.balance_due === 'number' ? inv.balance_due : parseFloat(String(inv.balance_due)) || 0
  }
  if (inv.balanceDue !== undefined) {
    return typeof inv.balanceDue === 'number' ? inv.balanceDue : parseFloat(String(inv.balanceDue)) || 0
  }
  return Math.max(0, getTotalAmount(inv) - getAmountPaid(inv))
}

export function getDueDate(inv: Invoice): string {
  return inv.due_date || inv.dueDate || 'Upon Receipt'
}

export function getPayments(inv: Invoice): InvoicePaymentRecord[] {
  return inv.payments || []
}

export function getStatusStyle(status: InvoiceStatus) {
  switch (status) {
    case 'PAID':
      return { bg: '#E6F4EA', text: '#15803D', label: 'Paid' }
    case 'PARTIAL':
      return { bg: '#FEF3C7', text: '#B45309', label: 'Partial' }
    case 'OVERDUE':
      return { bg: '#FEE2E2', text: '#DC2626', label: 'Overdue' }
    case 'SENT':
      return { bg: '#E0F2FE', text: '#0369A1', label: 'Sent' }
    case 'DRAFT':
    default:
      return { bg: tokens.colors.surfaceMuted, text: tokens.colors.secondary, label: status || 'Draft' }
  }
}

export function formatDate(d?: string): string {
  if (!d) return 'Upon Receipt'
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return d
  }
}
