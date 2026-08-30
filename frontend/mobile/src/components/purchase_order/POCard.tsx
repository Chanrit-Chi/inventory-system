import React from 'react'
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'
import type { PurchaseOrder } from '../../types'

export interface POCardProps {
  po: PurchaseOrder
  onSelect: (po: PurchaseOrder) => void
  onOpenStockIn?: (po: PurchaseOrder) => void
  onMarkReceived?: (poId: string) => void
  style?: StyleProp<ViewStyle>
  styles: Record<string, any>
}

export const POCard: React.FC<POCardProps> = ({
  po,
  onSelect,
  onOpenStockIn,
  onMarkReceived,
  style,
  styles,
}) => {
  const isReceived = po.status === 'RECEIVED'
  const isOrdered = po.status === 'ORDERED'
  const firstItem = po.items?.[0]
  const totalPoUnits = (po.items || []).reduce((s, it) => s + (it.quantity || 0), 0)

  return (
    <TouchableOpacity
      style={[styles.poOrderCard, style]}
      onPress={() => onSelect(po)}
      activeOpacity={0.8}
    >
      {/* 1. Header: PO Number + Status Badge */}
      <View style={styles.poCardHeaderRow}>
        <View style={styles.poNumberGroup}>
          <View style={styles.poNumberIconWrap}>
            <Ionicons name="document-text" size={16} color={tokens.colors.primaryContainer} />
          </View>
          <Text style={styles.poCardNumberText}>{po.poNumber}</Text>
        </View>

        <View
          style={[
            styles.statusPill,
            isReceived && { backgroundColor: tokens.colors.badgeSuccessBg },
            isOrdered && { backgroundColor: '#FEF3C7' },
            po.status === 'CANCELLED' && { backgroundColor: '#FEE2E2' },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isReceived && { backgroundColor: tokens.colors.statusSuccess },
              isOrdered && { backgroundColor: '#D97706' },
              po.status === 'CANCELLED' && { backgroundColor: tokens.colors.statusError },
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              isReceived && { color: tokens.colors.statusSuccess },
              isOrdered && { color: '#B45309' },
              po.status === 'CANCELLED' && { color: tokens.colors.statusError },
            ]}
          >
            {po.status}
          </Text>
        </View>
      </View>

      {/* 2. Supplier / Vendor Name & Address */}
      <View style={styles.poSupplierRowBox}>
        <View style={styles.poSupplierIconWrap}>
          <Ionicons name="business" size={13} color={tokens.colors.primaryContainer} />
        </View>
        <Text style={styles.poSupplierNameText} numberOfLines={1} ellipsizeMode="tail">
          {po.supplierName || 'Standard Supplier'}
        </Text>
      </View>

      {/* 3. Dates Grid */}
      <View style={styles.poDatesRow}>
        <View style={styles.poDateChip}>
          <Ionicons name="time-outline" size={13} color={tokens.colors.secondary} />
          <Text style={styles.poDateChipLabel}>Ordered:</Text>
          <Text style={styles.poDateChipValue}>{po.orderDate || 'N/A'}</Text>
        </View>

        {Boolean(po.expectedDeliveryDate) && (
          <View style={[styles.poDateChip, styles.poExpectedDateChip]}>
            <Ionicons name="calendar-outline" size={13} color={tokens.colors.primaryContainer} />
            <Text style={styles.poExpectedDateChipLabel}>Expected:</Text>
            <Text style={styles.poExpectedDateChipValue}>{po.expectedDeliveryDate}</Text>
          </View>
        )}
      </View>

      {/* 4. Items Summary Box */}
      <View style={styles.poSummaryBox}>
        <Text style={styles.poSummaryText} numberOfLines={1} ellipsizeMode="tail">
          {firstItem ? `${firstItem.productName} (${firstItem.sku})` : 'Procurement Batch'}
          {po.items.length > 1 ? ` + ${po.items.length - 1} more items` : ''}
        </Text>
        <Text style={styles.poSummaryMeta}>
          {totalPoUnits} unit{totalPoUnits !== 1 ? 's' : ''} total • {po.items.length} item{po.items.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* 5. Card Footer: Total Value + Action Buttons */}
      <View style={styles.poCardFooter}>
        <View>
          <Text style={styles.fieldLabel}>TOTAL VALUE</Text>
          <Text style={styles.valueHighlight}>${Number(po.totalCost || 0).toFixed(2)}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Boolean(isOrdered && onOpenStockIn) && (
            <TouchableOpacity
              style={styles.stockInActionBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                onOpenStockIn?.(po)
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down-circle" size={14} color={tokens.colors.onPrimary} />
              <Text style={styles.stockInActionText}>Receive Stock</Text>
            </TouchableOpacity>
          )}

          {Boolean(isOrdered && onMarkReceived && !onOpenStockIn) && (
            <TouchableOpacity
              style={styles.markReceivedBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                onMarkReceived?.(po.id)
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={14} color={tokens.colors.primaryContainer} />
              <Text style={styles.markReceivedBtnText}>Mark Received</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}
