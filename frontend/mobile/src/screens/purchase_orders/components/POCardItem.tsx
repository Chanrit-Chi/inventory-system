import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PurchaseOrdersScreen.styles'
import type { PurchaseOrder } from '../../../types'

export interface POCardItemProps {
  po: PurchaseOrder
  onSelectPo: (po: PurchaseOrder) => void
  onOpenStockIn?: () => void
}

export const POCardItem: React.FC<POCardItemProps> = React.memo(({ po, onSelectPo, onOpenStockIn }) => {
  const isReceived = po.status === 'RECEIVED'
  const isOrdered = po.status === 'ORDERED'
  const firstItem = po.items[0]
  const totalUnits = (po.items || []).reduce((s, it) => s + (it.quantity || 0), 0)

  return (
    <TouchableOpacity
      style={styles.poCard}
      onPress={() => onSelectPo(po)}
      activeOpacity={0.8}
    >
      <View style={styles.poCardHeader}>
        <View style={styles.poIdGroup}>
          <View style={styles.poIconBox}>
            <Ionicons name="document-text" size={18} color={tokens.colors.primaryContainer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.poNumber} numberOfLines={1}>{po.poNumber}</Text>
            <View style={styles.poSupplierRow}>
              <Ionicons name="business-outline" size={12} color={tokens.colors.secondary} />
              <Text style={styles.poSupplier} numberOfLines={1} ellipsizeMode="tail">{po.supplierName}</Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.poStatusBadge,
            isReceived && styles.poStatusBadgeReceived,
            isOrdered && styles.poStatusBadgeOrdered,
          ]}
        >
          <Text
            style={[
              styles.poStatusText,
              isReceived && styles.poStatusTextReceived,
              isOrdered && styles.poStatusTextOrdered,
            ]}
          >
            {po.status}
          </Text>
        </View>
      </View>

      {/* Items Summary */}
      <View style={styles.poItemSummaryBox}>
        <Text style={styles.poItemSummaryTitle} numberOfLines={1}>
          {firstItem ? `${firstItem.productName} (${firstItem.sku})` : 'Procurement Batch'}
          {po.items.length > 1 ? ` + ${po.items.length - 1} more items` : ''}
        </Text>
        <Text style={styles.poItemSummaryMeta}>
          {totalUnits} units total • Ordered: {po.orderDate}
        </Text>
      </View>

      {/* Card Footer */}
      <View style={styles.poCardFooter}>
        <View>
          <Text style={styles.poCostLabel}>Total Cost</Text>
          <Text style={styles.poCostValue}>${Number(po.totalCost || 0).toFixed(2)}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Boolean(isOrdered && onOpenStockIn) && (
            <TouchableOpacity
              style={styles.receiveBtn}
              onPress={(e) => {
                e.stopPropagation()
                onOpenStockIn?.()
              }}
            >
              <Ionicons name="enter-outline" size={14} color={tokens.colors.onPrimary} />
              <Text style={styles.receiveBtnText}>Receive / Stock In</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.viewDetailBtn}
            onPress={() => onSelectPo(po)}
          >
            <Text style={styles.viewDetailBtnText}>Details</Text>
            <Ionicons name="chevron-forward" size={12} color={tokens.colors.primaryContainer} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
})
