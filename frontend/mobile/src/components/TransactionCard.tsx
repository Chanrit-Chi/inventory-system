import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { Order } from '../types'

export interface TransactionCardProps {
  order: Order
  onPress?: (order: Order) => void
  testID?: string
  style?: any
}

function formatOrderTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return '12:00 PM'
  }
}

function formatRelativeTime(dateStr: string): string {
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

function getChannelDisplayName(order: Order): string | null {
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

function getPaymentStyle(methodStr: string) {
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

export const TransactionCard: React.FC<TransactionCardProps> = React.memo(({
  order,
  onPress,
  testID,
  style,
}) => {
  const statusLower = (order.status || 'completed').toLowerCase()
  const isCompleted = statusLower === 'completed'
  const isPending = statusLower === 'pending'
  const isCancelled = statusLower === 'cancelled'

  const payMethod = order.payments?.[0]?.payment_method || 'Cash'
  const payInfo = getPaymentStyle(payMethod)
  const totalNum =
    typeof order.total_amount === 'number'
      ? order.total_amount
      : parseFloat(String(order.total_amount || '0')) || 0
  const itemCount = order.items?.reduce((s, it) => s + it.quantity, 0) || 1
  const channelName = getChannelDisplayName(order)
  const channelMeta = getChannelPlatformMeta(order.channel, order.channel_id)
  const cashierName = order.user?.name

  return (
    <TouchableOpacity
      testID={testID || `txn-card-${order.id}`}
      style={[
        styles.card,
        isPending && styles.cardPendingBorder,
        isCancelled && styles.cardCancelledBorder,
        style,
      ]}
      onPress={() => onPress?.(order)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_number}, ${order.customer?.name || 'Walk-in Customer'}, total $${totalNum.toFixed(2)}, status ${order.status}`}
    >
      {/* 1. Header Bar: Order ID + Channel Name Badge (Icon + Name) + Relative Time & Status */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeftGroup}>
          <View style={styles.orderIdPill}>
            <Ionicons name="receipt-outline" size={11} color="#924C00" style={styles.orderIdIcon} />
            <Text style={styles.orderIdText} numberOfLines={1}>
              {order.order_number}
            </Text>
          </View>
          {channelName ? (
            <View
              style={[
                styles.channelTag,
                channelMeta ? { backgroundColor: channelMeta.bg } : null,
              ]}
              accessibilityLabel={`Channel: ${channelName}`}
            >
              <Ionicons
                name={channelMeta?.icon || 'storefront-outline'}
                size={10}
                color={channelMeta?.color || tokens.colors.secondary}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.channelTagText,
                  channelMeta ? { color: channelMeta.color } : null,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {channelName}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerRightGroup}>
          <Text style={styles.timeText} numberOfLines={1}>
            {formatRelativeTime(order.created_at || '')}
          </Text>
          <View
            style={[
              styles.statusBadge,
              isCompleted && styles.statusBadgeCompleted,
              isPending && styles.statusBadgePending,
              isCancelled && styles.statusBadgeCancelled,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                isCompleted && styles.statusDotCompleted,
                isPending && styles.statusDotPending,
                isCancelled && styles.statusDotCancelled,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                isCompleted && styles.statusTextCompleted,
                isPending && styles.statusTextPending,
                isCancelled && styles.statusTextCancelled,
              ]}
            >
              {isCompleted ? 'Paid' : isPending ? 'Pending' : isCancelled ? 'Cancelled' : (order.status || 'PAID').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Divider line */}
      <View style={styles.divider} />

      {/* 3. Main Row: Payment Icon + Customer Info + Price / Receipt CTA */}
      <View style={styles.bodyRow}>
        {/* Payment Avatar */}
        <View style={[styles.payAvatar, { backgroundColor: payInfo.bg }]}>
          <Ionicons name={payInfo.name} size={18} color={payInfo.color} />
        </View>

        {/* Customer & Item Details */}
        <View style={styles.infoCol}>
          <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
            {order.customer?.name || 'Walk-in Customer'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} • {payMethod}
              {cashierName ? ` • ${cashierName}` : ''}
            </Text>
          </View>
        </View>

        {/* Amount & Time */}
        <View style={styles.priceCol}>
          <Text
            style={[
              styles.priceText,
              isCancelled && styles.priceTextCancelled,
            ]}
            numberOfLines={1}
          >
            ${totalNum.toFixed(2)}
          </Text>
          <View style={styles.receiptHintRow}>
            <Text style={styles.receiptHintText}>{formatOrderTime(order.created_at || '')}</Text>
            <Ionicons name="chevron-forward" size={12} color={tokens.colors.secondary} style={{ marginLeft: 2 }} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardPendingBorder: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFCF8',
  },
  cardCancelledBorder: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBFB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  orderIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E8',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexShrink: 0,
  },
  orderIdIcon: {
    marginRight: 3,
  },
  orderIdText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#924C00',
    letterSpacing: 0.2,
  },
  channelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    maxWidth: 110,
    flexShrink: 1,
  },
  channelTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  timeText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 9999,
    gap: 4,
  },
  statusBadgeCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotCompleted: {
    backgroundColor: '#16A34A',
  },
  statusDotPending: {
    backgroundColor: '#D97706',
  },
  statusDotCancelled: {
    backgroundColor: '#DC2626',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextCompleted: {
    color: '#15803D',
  },
  statusTextPending: {
    color: '#B45309',
  },
  statusTextCancelled: {
    color: '#B91C1C',
  },
  divider: {
    height: 1,
    backgroundColor: '#F2EBE1',
    marginVertical: 6,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    fontWeight: '400',
  },
  priceCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 65,
  },
  priceText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    letterSpacing: -0.2,
  },
  priceTextCancelled: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  receiptHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  receiptHintText: {
    fontSize: 10.5,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
})

export default TransactionCard
