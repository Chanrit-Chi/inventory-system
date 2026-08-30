import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'
import { CopyableBadge } from '../CopyableBadge'
import type { PurchaseOrder } from '../../types'

export interface PODetailModalProps {
  visible: boolean
  po: PurchaseOrder | null
  onClose: () => void
  onOpenStockIn?: () => void
  onMarkReceived: (poId: string) => void
  styles: Record<string, any>
}

export const PODetailModal: React.FC<PODetailModalProps> = ({
  visible,
  po,
  onClose,
  onOpenStockIn,
  onMarkReceived,
  styles,
}) => {
  if (!visible || !po) return null

  const totalItemCount = (po.items || []).reduce((sum, item) => sum + item.quantity, 0)
  const isReceived = po.status === 'RECEIVED'
  const isCancelled = po.status === 'CANCELLED'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '90%', flexShrink: 1, overflow: 'hidden' }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text" size={18} color={tokens.colors.primaryContainer} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  #{po.poNumber}
                </Text>
              </View>
              <Text style={styles.modalSub} numberOfLines={1}>
                Supplier: <Text style={{ fontWeight: '700', color: tokens.colors.onBackground }}>{po.supplierName}</Text>
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: tokens.colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetContent}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* KPI Summary 3-Metric Box with Dividers */}
            <View style={[styles.detailMetricsRow, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 12, borderWidth: 1, borderColor: tokens.colors.outline }]}>
              <View style={styles.detailMetricCol}>
                <Text style={styles.detailMetricLabel}>STATUS</Text>
                <View
                  style={{
                    backgroundColor: isReceived ? '#DCFCE7' : isCancelled ? '#FEE2E2' : '#FEF3C7',
                    paddingHorizontal: 8,
                    paddingVertical: 2.5,
                    borderRadius: 9999,
                    marginTop: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '800',
                      color: isReceived ? '#15803D' : isCancelled ? '#DC2626' : '#B45309',
                    }}
                  >
                    {po.status}
                  </Text>
                </View>
              </View>

              <View style={{ width: 1, height: 28, backgroundColor: tokens.colors.outline }} />

              <View style={styles.detailMetricCol}>
                <Text style={styles.detailMetricLabel}>TOTAL COST</Text>
                <Text style={[styles.detailMetricVal, { color: tokens.colors.primaryContainer, fontWeight: '800' }]}>
                  ${Number(po.totalCost || 0).toFixed(2)}
                </Text>
              </View>

              <View style={{ width: 1, height: 28, backgroundColor: tokens.colors.outline }} />

              <View style={styles.detailMetricCol}>
                <Text style={styles.detailMetricLabel}>ORDER DATE</Text>
                <Text style={styles.detailMetricVal}>{po.orderDate || 'N/A'}</Text>
              </View>
            </View>

            {/* Expected Delivery Date */}
            {Boolean(po.expectedDeliveryDate) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12, gap: 6 }}>
                <Ionicons name="calendar-outline" size={14} color="#166534" />
                <Text style={{ fontSize: 11.5, color: '#166534', fontWeight: '600' }}>
                  Expected Delivery: {po.expectedDeliveryDate}
                </Text>
              </View>
            )}

            {/* Notes */}
            {Boolean(po.notes) && (
              <View style={styles.detailNotesBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={12} color="#92400E" />
                  <Text style={styles.detailNotesLabel}>PO Notes & Instructions:</Text>
                </View>
                <Text style={styles.detailNotesText}>{po.notes}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Ordered Items ({(po.items || []).length} lines • {totalItemCount} units)
            </Text>

            <View style={{ gap: 8, marginTop: 4 }}>
              {(po.items || []).map((item, idx) => (
                <View key={item.id || idx} style={[styles.detailItemRow, { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: tokens.colors.outline }]}>
                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <Text style={[styles.itemName, { fontWeight: '700', fontSize: 13 }]} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    {Boolean(item.sku) && (
                      <View style={{ marginTop: 4 }}>
                        <CopyableBadge
                          type="sku"
                          value={item.sku}
                          compact
                        />
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    <Text style={styles.expectedText}>
                      {item.quantity} × ${Number(item.unitCost || 0).toFixed(2)}
                    </Text>
                    <Text style={[styles.boldText, { color: tokens.colors.primaryContainer, fontSize: 13 }]}>
                      ${Number(item.totalCost || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Sticky Bottom Footer */}
          <View style={styles.sheetFooter}>
            {po.status === 'ORDERED' ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {Boolean(onOpenStockIn) && (
                  <TouchableOpacity
                    style={[styles.completeBtn, { flex: 1, backgroundColor: tokens.colors.statusSuccess }]}
                    onPress={() => {
                      onClose()
                      onOpenStockIn?.()
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="enter-outline" size={16} color={tokens.colors.onPrimary} />
                    <Text style={styles.completeBtnText}>Receive with Stock In</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.completeBtn, { flex: 1 }]}
                  onPress={() => onMarkReceived(po.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={tokens.colors.onPrimary} />
                  <Text style={styles.completeBtnText}>Mark Received</Text>
                </TouchableOpacity>
              </View>
            ) : isReceived ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7', borderRadius: 10, paddingVertical: 12, gap: 6 }}>
                <Ionicons name="checkmark-done-circle" size={18} color="#15803D" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#15803D' }}>Stock Fully Received</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default PODetailModal
