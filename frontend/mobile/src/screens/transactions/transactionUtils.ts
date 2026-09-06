import type { Order } from '../../types'

export type FilterStatus = 'ALL' | 'COMPLETED' | 'PENDING' | 'CANCELLED'
export type DateRangeMode = 'all' | 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'
export type TransactionSortOption =
  | 'DEFAULT'
  | 'OLDEST'
  | 'AMOUNT_DESC'
  | 'AMOUNT_ASC'
  | 'ORDER_NUM_ASC'
export type PaymentMethodFilter = 'ALL' | 'CASH' | 'ABA' | 'CARD' | 'BANK'

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

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Today'
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    if (isToday) {
      return `Today, ${timeStr}`
    }
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${dateFormatted} • ${timeStr}`
  } catch {
    return 'Today'
  }
}

export function getChannelPlatformMeta(channel?: Order['channel'] | null, channelId?: string | null) {
  const nameLower = (channel?.name || channelId || '').toLowerCase()
  const codeLower = (channel?.code || '').toLowerCase()
  const typeLower = (channel?.type || '').toLowerCase()

  if (typeLower === 'telegram' || nameLower.includes('telegram') || codeLower.includes('tg')) {
    return { icon: 'paper-plane' as const, color: '#0284C7', bg: '#E0F2FE', label: 'Telegram' }
  }
  if (typeLower === 'facebook' || nameLower.includes('facebook') || codeLower.includes('fb')) {
    return { icon: 'logo-facebook' as const, color: '#1877F2', bg: '#EBF5FF', label: 'Facebook' }
  }
  if (typeLower === 'instagram' || nameLower.includes('instagram') || codeLower.includes('ig')) {
    return { icon: 'logo-instagram' as const, color: '#E1306C', bg: '#FCE7F3', label: 'Instagram' }
  }
  if (typeLower === 'tiktok' || nameLower.includes('tiktok')) {
    return { icon: 'logo-tiktok' as const, color: '#0F172A', bg: '#F1F5F9', label: 'TikTok' }
  }
  if (typeLower === 'pos' || nameLower.includes('pos') || nameLower.includes('store') || nameLower.includes('retail')) {
    return { icon: 'storefront' as const, color: '#D97706', bg: '#FEF3C7', label: 'Store POS' }
  }
  if (typeLower === 'online' || typeLower === 'website' || nameLower.includes('web') || nameLower.includes('e-commerce') || nameLower.includes('online')) {
    return { icon: 'globe' as const, color: '#059669', bg: '#ECFDF5', label: 'Online Web' }
  }
  if (typeLower === 'shopee' || nameLower.includes('shopee') || nameLower.includes('lazada')) {
    return { icon: 'cart' as const, color: '#EA580C', bg: '#FFEDD5', label: 'E-Commerce' }
  }
  if (typeLower === 'social_media') {
    return { icon: 'share-social' as const, color: '#8B5CF6', bg: '#F5F3FF', label: 'Social Media' }
  }
  if (typeLower === 'offline' || nameLower.includes('b2b') || nameLower.includes('wholesale')) {
    return { icon: 'briefcase' as const, color: '#64748B', bg: '#F1F5F9', label: 'Wholesale' }
  }
  if (channel || channelId) {
    return { icon: 'storefront-outline' as const, color: '#64748B', bg: '#F8FAFC', label: channel?.name || 'Channel' }
  }
  return null
}

export function isTechnicalId(id?: string | null): boolean {
  if (!id) return true
  return (
    /^[0-9a-fA-F-]{8,}$/i.test(id) ||
    id.length > 18 ||
    id.startsWith('chan-') ||
    id.startsWith('ch-')
  )
}

/**
 * Strips platform prefixes/names (e.g. "Facebook - KC Shop" -> "KC Shop")
 * leaving only the actual Shop Name while platform is represented by logo/icon.
 */
export function getChannelCleanShopName(rawName?: string | null): string | null {
  if (!rawName || !rawName.trim()) return null
  const name = rawName.trim()

  // Platforms to strip from name
  const platforms = [
    'telegram',
    'facebook',
    'instagram',
    'tiktok',
    'whatsapp',
    'shopee',
    'lazada',
    'line',
    'tg',
    'fb',
    'ig',
    'social media',
    'online web',
  ]

  // Pattern 1: Prefix with delimiter - "Facebook - KC Shop", "Telegram : KC Shop", "IG | KC Shop"
  const prefixRegex = new RegExp(`^(${platforms.join('|')})\\s*[-:–—|/•]\\s*`, 'i')
  if (prefixRegex.test(name)) {
    const stripped = name.replace(prefixRegex, '').trim()
    if (stripped) return stripped
  }

  // Pattern 2: Suffix with delimiter - "KC Shop - Facebook", "KC Shop (Facebook)"
  const suffixRegex = new RegExp(`\\s*[-:–—|/•]\\s*(${platforms.join('|')})$`, 'i')
  if (suffixRegex.test(name)) {
    const stripped = name.replace(suffixRegex, '').trim()
    if (stripped) return stripped
  }

  const parenRegex = new RegExp(`\\s*\\((${platforms.join('|')})\\)$`, 'i')
  if (parenRegex.test(name)) {
    const stripped = name.replace(parenRegex, '').trim()
    if (stripped) return stripped
  }

  // Pattern 3: Space prefix - "Telegram KC Shop", "Facebook KC Sport"
  const spacePrefixRegex = new RegExp(`^(${platforms.join('|')})\\s+`, 'i')
  if (spacePrefixRegex.test(name)) {
    const stripped = name.replace(spacePrefixRegex, '').trim()
    if (stripped) return stripped
  }

  return name
}

export function getChannelDisplayName(order: Order): string | null {
  const rawName =
    order.channel?.name ||
    (!isTechnicalId(order.channel_id) ? order.channel_id : null)
  if (!rawName) return null
  return getChannelCleanShopName(rawName)
}

/**
 * Resolves the display address for an order, prioritizing real customer street
 * address / delivery location and ignoring generic in-store POS notes.
 */
export function getCustomerDisplayAddress(order: Order): string | null {
  const custAddr = order.customer?.address?.trim()
  const deliveryAddr = order.delivery_address?.trim()
  const region = order.region?.trim()

  // Prefer actual delivery address if it's not a generic in-store pickup tag
  if (
    deliveryAddr &&
    !deliveryAddr.toLowerCase().includes('in-store') &&
    !deliveryAddr.toLowerCase().includes('pos counter') &&
    !deliveryAddr.toLowerCase().includes('counter pickup')
  ) {
    if (region && !deliveryAddr.toLowerCase().includes(region.toLowerCase())) {
      return `${deliveryAddr}, ${region}`
    }
    return deliveryAddr
  }

  // Fallback to customer profile address
  if (custAddr) {
    return custAddr
  }

  // Fallback to region
  if (region && (!deliveryAddr || !deliveryAddr.toLowerCase().includes(region.toLowerCase()))) {
    return region
  }

  return null
}

export function getPaymentStyle(methodStr: string) {
  const m = methodStr.toLowerCase()
  if (m.includes('aba') || m.includes('khqr')) {
    return { name: 'qr-code' as const, color: '#005F83', bg: '#E0F2FE', label: 'ABA QR' }
  }
  if (m.includes('acleda')) {
    return { name: 'business' as const, color: '#0D3880', bg: '#E6EDF8', label: 'ACLEDA' }
  }
  if (m.includes('wing')) {
    return { name: 'phone-portrait' as const, color: '#6EBE44', bg: '#EDF8E6', label: 'Wing' }
  }
  if (m.includes('bank') || m.includes('transfer')) {
    return { name: 'business' as const, color: '#1E3A8A', bg: '#FFF7ED', label: 'Bank' }
  }
  if (m.includes('card')) {
    return { name: 'card' as const, color: '#7C3AED', bg: '#EDE9FE', label: 'Card' }
  }
  return { name: 'cash' as const, color: '#16A34A', bg: '#DCFCE7', label: 'Cash' }
}

export function sortOrders(orders: Order[], sortBy: TransactionSortOption): Order[] {
  if (sortBy === 'DEFAULT') {
    return [...orders].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime() || 0
      const timeB = new Date(b.created_at).getTime() || 0
      return timeB - timeA
    })
  }
  if (sortBy === 'OLDEST') {
    return [...orders].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime() || 0
      const timeB = new Date(b.created_at).getTime() || 0
      return timeA - timeB
    })
  }
  if (sortBy === 'AMOUNT_DESC') {
    return [...orders].sort((a, b) => {
      const amtA = typeof a.total_amount === 'number' ? a.total_amount : parseFloat(String(a.total_amount || '0')) || 0
      const amtB = typeof b.total_amount === 'number' ? b.total_amount : parseFloat(String(b.total_amount || '0')) || 0
      return amtB - amtA
    })
  }
  if (sortBy === 'AMOUNT_ASC') {
    return [...orders].sort((a, b) => {
      const amtA = typeof a.total_amount === 'number' ? a.total_amount : parseFloat(String(a.total_amount || '0')) || 0
      const amtB = typeof b.total_amount === 'number' ? b.total_amount : parseFloat(String(b.total_amount || '0')) || 0
      return amtA - amtB
    })
  }
  if (sortBy === 'ORDER_NUM_ASC') {
    return [...orders].sort((a, b) => {
      const numA = (a.order_number || a.id || '').toLowerCase()
      const numB = (b.order_number || b.id || '').toLowerCase()
      return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }
  return orders
}

export function matchesPaymentMethod(order: Order, filter: PaymentMethodFilter): boolean {
  if (filter === 'ALL') return true
  const payMethod = (order.payments?.[0]?.payment_method || 'Cash').toLowerCase()
  if (filter === 'CASH') {
    return payMethod.includes('cash')
  }
  if (filter === 'ABA') {
    return payMethod.includes('aba') || payMethod.includes('khqr')
  }
  if (filter === 'CARD') {
    return payMethod.includes('card') || payMethod.includes('visa') || payMethod.includes('master')
  }
  if (filter === 'BANK') {
    return payMethod.includes('bank') || payMethod.includes('transfer') || payMethod.includes('acleda') || payMethod.includes('wing')
  }
  return true
}

export function matchesChannel(order: Order, filter: string): boolean {
  if (!filter || filter === 'ALL') return true
  const cleanName = getChannelDisplayName(order) || ''
  const platformMeta = getChannelPlatformMeta(order.channel, order.channel_id)
  const platformLabel = platformMeta?.label || ''
  const channelName = order.channel?.name || ''
  const target = filter.toLowerCase().trim()

  return (
    cleanName.toLowerCase() === target ||
    platformLabel.toLowerCase() === target ||
    channelName.toLowerCase() === target ||
    order.channel_id === filter
  )
}

