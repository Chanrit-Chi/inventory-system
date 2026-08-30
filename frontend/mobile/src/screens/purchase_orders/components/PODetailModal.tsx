import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PurchaseOrdersScreen.styles'
import { ProductGroupHeader } from '../../../components/ProductGroupHeader'
import { CopyableBadge } from '../../../components/CopyableBadge'
import type { PurchaseOrder } from '../../../types'

export interface PODetailModalProps {
  visible: boolean
  po: PurchaseOrder | null
  onClose: () => void
  onOpenStockIn?: () => void
  onMarkReceived: (poId: string) => void
}

export const PODetailModal: React.FC<PODetailModalProps> = ({
  visible,
  po,
  onClose,
  onOpenStockIn,
  onMarkReceived,
}) => {
  if (!po) return null

  const detailGroups: Record<
    string,
    { parentName: string; items: PurchaseOrder['items'][number][]; totalQty: number; totalCost: number }
  > = {}
  ;(po.items || []).forEach((it) => {
    const parentName =
      it.parentProductName ||
      it.productName.split(' (')[0].split(' - ')[0] ||
      it.productName
    if (!detailGroups[parentName]) {
      detailGroups[parentName] = {
        parentName,
        items: [],
        totalQty: 0,
        totalCost: 0,
      }
    }
    detailGroups[parentName].items.push(it)
    detailGroups[parentName].totalQty += it.quantity
    detailGroups[parentName].totalCost += it.totalCost
  })
  const groupList = Object.values(detailGroups)
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
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text" size={18} color={tokens.colors.primaryContainer} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  #{po.poNumber}
                </Text>
              </View>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
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
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* KPI Summary 3-Metric Box with Dividers */}
            <View style={styles.detailSummaryBox}>
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

              <View style={styles.detailMetricDivider} />

              <View style={styles.detailMetricCol}>
                <Text style={styles.detailMetricLabel}>TOTAL COST</Text>
                <Text style={[styles.detailMetricVal, { color: tokens.colors.primaryContainer }]}>
                  ${Number(po.totalCost || 0).toFixed(2)}
                </Text>
              </View>

              <View style={styles.detailMetricDivider} />

              <View style={styles.detailMetricCol}>
                <Text style={styles.detailMetricLabel}>ORDER DATE</Text>
                <Text style={styles.detailMetricVal}>{po.orderDate || 'N/A'}</Text>
              </View>
            </View>

            {/* Expected Delivery Date Notice */}
            {Boolean(po.expectedDeliveryDate) && (
              <View style={styles.detailExpectedBox}>
                <Ionicons name="calendar-outline" size={14} color="#166534" />
                <Text style={styles.detailExpectedText}>
                  Expected Delivery: {po.expectedDeliveryDate}
                </Text>
              </View>
            )}

            {/* Notes Callout */}
            {Boolean(po.notes) && (
              <View style={styles.detailNotesBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={12} color="#92400E" />
                  <Text style={styles.detailNotesLabel}>PO Notes & Instructions:</Text>
                </View>
                <Text style={styles.detailNotesText}>{po.notes}</Text>
              </View>
            )}

            {/* Section Title */}
            <Text style={styles.formLabel}>
              Ordered Items ({groupList.length} products • {totalItemCount} units)
            </Text>

            {/* Items Grouped Breakdown */}
            <View style={{ gap: 10, marginTop: 4, marginBottom: 8 }}>
              {groupList.map((group, gIdx) => {
                const isMultiVariant = group.items.length > 1
                return (
                  <View
                    key={`dg-${gIdx}`}
                    style={[
                      styles.poItemRow,
                      { padding: 0, overflow: 'hidden', backgroundColor: '#FFFFFF' },
                    ]}
                  >
                    <ProductGroupHeader
                      parentName={group.parentName}
                      variantCount={group.items.length}
                      totalQty={group.totalQty}
                      totalCost={group.totalCost}
                    />
                    {group.items.map((item, idx) => (
                      <View
                        key={item.id || idx}
                        style={[
                          styles.detailItemRow,
                          {
                            borderBottomWidth: idx < group.items.length - 1 ? 1 : 0,
                            borderBottomColor: '#F1F5F9',
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                          },
                        ]}
                      >
                        <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                          <Text style={styles.detailItemName} numberOfLines={1}>
                            {isMultiVariant
                              ? item.productName.includes('(')
                                ? item.productName.split('(')[1].replace(')', '')
                                : item.productName
                              : item.productName}
                          </Text>
                          {Boolean(item.sku) && (
                            <View style={{ marginTop: 2 }}>
                              <CopyableBadge type="sku" value={item.sku} compact />
                            </View>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                          <Text style={styles.detailItemQty}>
                            {item.quantity} × ${Number(item.unitCost || 0).toFixed(2)}
                          </Text>
                          <Text style={styles.detailItemTotal}>
                            ${Number(item.totalCost || 0).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View style={styles.sheetFooter}>
            {po.status === 'ORDERED' ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {Boolean(onOpenStockIn) && (
                  <TouchableOpacity
                    style={[
                      styles.submitPoBtn,
                      { flex: 1, backgroundColor: tokens.colors.statusSuccess },
                    ]}
                    onPress={() => {
                      onClose()
                      onOpenStockIn?.()
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="enter-outline" size={16} color={tokens.colors.onPrimary} />
                    <Text style={styles.submitPoBtnText}>Receive via Stock-In</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.submitPoBtn,
                    { flex: 1, backgroundColor: tokens.colors.primaryContainer },
                  ]}
                  onPress={() => onMarkReceived(po.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color={tokens.colors.onPrimary}
                  />
                  <Text style={styles.submitPoBtnText}>Mark Received</Text>
                </TouchableOpacity>
              </View>
            ) : isReceived ? (
              <View style={styles.receivedBanner}>
                <Ionicons name="checkmark-done-circle" size={18} color="#15803D" />
                <Text style={styles.receivedBannerText}>Stock Fully Received</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default PODetailModal
