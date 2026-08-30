import type { Quotation } from '../../types'

export function getQuoteNumber(q: Quotation): string {
  return q.quotation_number || q.quotationNumber || 'QT-2026'
}

export function getCustomerName(q: Quotation): string {
  return q.customer_name || q.customerName || 'General Customer'
}

export function getCustomerPhone(q: Quotation): string {
  return q.customer_phone || q.customerPhone || ''
}

export function getCustomerEmail(q: Quotation): string {
  return q.customer_email || q.customerEmail || ''
}

export function getTotalAmount(q: Quotation): number {
  if (q.total_amount !== undefined) {
    return typeof q.total_amount === 'number' ? q.total_amount : parseFloat(String(q.total_amount)) || 0
  }
  if (q.totalAmount !== undefined) {
    return typeof q.totalAmount === 'number' ? q.totalAmount : parseFloat(String(q.totalAmount)) || 0
  }
  return 0
}

export function getSubtotal(q: Quotation): number {
  return typeof q.subtotal === 'number' ? q.subtotal : parseFloat(String(q.subtotal || '0')) || 0
}

export function getDiscount(q: Quotation): number {
  return typeof q.discount === 'number' ? q.discount : parseFloat(String(q.discount || '0')) || 0
}

export function getValidUntil(q: Quotation): string {
  return q.valid_until || q.validUntil || '14 Days'
}

export function getCreatedAt(q: Quotation): string {
  return q.created_at || q.createdAt || new Date().toISOString()
}

export function getStatusStyle(status: string) {
  const s = (status || '').toUpperCase()
  switch (s) {
    case 'SENT':
      return { bg: '#EFF6FF', text: '#1D4ED8' }
    case 'ACCEPTED':
      return { bg: '#ECFDF5', text: '#047857' }
    case 'REJECTED':
      return { bg: '#FEF2F2', text: '#B91C1C' }
    case 'CONVERTED':
      return { bg: '#EDE9FE', text: '#6D28D9' }
    case 'DRAFT':
    default:
      return { bg: '#F1F5F9', text: '#475569' }
  }
}
