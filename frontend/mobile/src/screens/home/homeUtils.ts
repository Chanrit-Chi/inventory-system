import type { Order } from '../../types'

export function formatOrderTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return '12:00 PM'
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Today'
  }
}

export function getChannelDisplayName(order: Order): string | null {
  if (order.channel?.name) return order.channel.name
  if (!order.channel_id) return null
  const isTechnicalId =
    /^[0-9a-fA-F-]{8,}$/i.test(order.channel_id) ||
    order.channel_id.length > 18 ||
    order.channel_id.startsWith('chan-') ||
    order.channel_id.startsWith('ch-')
  if (isTechnicalId) return null
  return order.channel_id
}
