import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { Order } from '../types'

export interface TransactionCardProps {
  order: Order
  onPress?: (order: Order) => void
  testID?: string
  style?: ViewStyle
}

import {
  formatDateTime,
  getChannelPlatformMeta,
  getChannelCleanShopName,
  getChannelDisplayName,
  getCustomerDisplayAddress,
  getPaymentStyle,
} from '../screens/transactions/transactionUtils'

export {
  formatDateTime,
  getChannelPlatformMeta,
  getChannelCleanShopName,
  getChannelDisplayName,
  getCustomerDisplayAddress,
  getPaymentStyle,
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
  const channelLogoUrl = order.channel?.image_url || order.channel?.imageUrl || null
  const customerAddress = getCustomerDisplayAddress(order)
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
      {/* 1. Top Header: Order Number Pill + Status Badge */}
      <View style={styles.topHeaderRow}>
        <View style={styles.orderIdPill}>
          <Ionicons name="receipt-outline" size={12} color="#924C00" style={styles.orderIdIcon} />
          <Text style={styles.orderIdText} numberOfLines={1}>
            #{order.order_number}
          </Text>
        </View>

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

      {/* 2. Middle Row: Hero Customer Name & Item Count + Price */}
      <View style={styles.middleRow}>
        <View style={styles.customerInfoCol}>
          <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
            {order.customer?.name || 'Walk-in Customer'}
          </Text>
          <Text style={styles.itemCountText} numberOfLines={1}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
            {cashierName ? ` • by ${cashierName}` : ''}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <Text
            style={[
              styles.priceText,
              isCancelled && styles.priceTextCancelled,
            ]}
            numberOfLines={1}
          >
            ${totalNum.toFixed(2)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondary} style={{ marginLeft: 3 }} />
        </View>
      </View>

      {/* Customer Address Row (if available) */}
      {Boolean(customerAddress) && (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={12} color={tokens.colors.secondary} style={styles.addressIcon} />
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="tail">
            {customerAddress}
          </Text>
        </View>
      )}

      {/* 3. Bottom Tag Strip: Channel, Payment Method, Date & Time */}
      <View style={styles.bottomTagStrip}>
        {/* Channel Tag */}
        {channelName ? (
          <View
            style={[
              styles.metaPill,
              channelMeta ? { backgroundColor: channelMeta.bg } : styles.metaPillNeutral,
            ]}
          >
            {channelLogoUrl ? (
              <Image
                source={{ uri: channelLogoUrl }}
                style={styles.channelLogoImg}
                contentFit="contain"
              />
            ) : (
              <Ionicons
                name={channelMeta?.icon || 'storefront-outline'}
                size={11}
                color={channelMeta?.color || tokens.colors.secondary}
              />
            )}
            <Text
              style={[
                styles.metaPillText,
                channelMeta ? { color: channelMeta.color } : styles.metaPillTextNeutral,
              ]}
              numberOfLines={1}
            >
              {channelName}
            </Text>
          </View>
        ) : null}

        {/* Payment Method Tag */}
        <View style={[styles.metaPill, { backgroundColor: payInfo.bg }]}>
          <Ionicons name={payInfo.name} size={11} color={payInfo.color} />
          <Text style={[styles.metaPillText, { color: payInfo.color }]} numberOfLines={1}>
            {payInfo.label || payMethod}
          </Text>
        </View>

        {/* Date & Time Tag */}
        <View style={[styles.metaPill, styles.metaPillDate]}>
          <Ionicons name="time-outline" size={11} color={tokens.colors.secondary} />
          <Text style={[styles.metaPillText, styles.metaPillTextDate]} numberOfLines={1}>
            {formatDateTime(order.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
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
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  orderIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E8',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    flexShrink: 0,
  },
  orderIdIcon: {
    marginRight: 4,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#924C00',
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 9999,
    gap: 4,
    flexShrink: 0,
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
    fontSize: 10.5,
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
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  customerInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  itemCountText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  priceText: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  priceTextCancelled: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  bottomTagStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    gap: 4,
  },
  metaPillNeutral: {
    backgroundColor: '#F1F5F9',
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaPillTextNeutral: {
    color: tokens.colors.secondary,
  },
  metaPillDate: {
    backgroundColor: tokens.colors.surfaceAlt,
    marginLeft: 'auto',
  },
  metaPillTextDate: {
    color: tokens.colors.secondary,
    fontWeight: '600',
    fontSize: 11,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 1,
  },
  addressIcon: {
    flexShrink: 0,
    marginTop: 0.5,
  },
  addressText: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    flex: 1,
  },
  channelLogoImg: {
    width: 12,
    height: 12,
    borderRadius: 2.5,
  },
})

export default TransactionCard
