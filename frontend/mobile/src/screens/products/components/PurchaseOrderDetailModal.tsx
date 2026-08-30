import React from 'react'
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import { ProductGroupHeader } from '../../../components/ProductGroupHeader'
import { CopyableBadge } from '../../../components/CopyableBadge'
import type { PurchaseOrder } from '../../../types'

interface PurchaseOrderDetailModalProps {
  poDetailModalOpen: boolean
  setPoDetailModalOpen: (v: boolean) => void
  selectedPoDetail: PurchaseOrder | null
  handleMarkPoReceived: (poId: string) => void
}

export function PurchaseOrderDetailModal({
  poDetailModalOpen,
  setPoDetailModalOpen,
  selectedPoDetail,
  handleMarkPoReceived,
}: PurchaseOrderDetailModalProps) {
  if (!selectedPoDetail) return null

  const isReceived = selectedPoDetail.status === 'RECEIVED'
  const isCancelled = selectedPoDetail.status === 'CANCELLED'
  const totalItemCount = (selectedPoDetail.items || []).reduce((sum, item) => sum + item.quantity, 0)

  const items = selectedPoDetail.items || []
  const groups: Record<string, { parentName: string; items: typeof items; totalQty: number; totalCost: number }> = {}
  items.forEach((it) => {
    const parentName = it.parentProductName || (it.productName ? it.productName.split(' (')[0].split(' - ')[0] : 'Product') || 'Product'
    if (!groups[parentName]) {
      groups[parentName] = {
        parentName,
        items: [],
        totalQty: 0,
        totalCost: 0,
      }
    }
    groups[parentName].items.push(it)
    groups[parentName].totalQty += it.quantity
    groups[parentName].totalCost += it.totalCost
  })
  const groupList = Object.values(groups)

  return (
    <Modal
      visible={poDetailModalOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setPoDetailModalOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '90%', flexShrink: 1, overflow: 'hidden' }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text" size={18} color={tokens.colors.primaryContainer} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  #{selectedPoDetail.poNumber}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: tokens.colors.secondary, marginTop: 2 }} numberOfLines={1}>
                Supplier: <Text style={{ fontWeight: '700', color: tokens.colors.onBackground }}>{selectedPoDetail.supplierName}</Text>
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setPoDetailModalOpen(false)}
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
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* KPI Summary 3-Metric Box with Dividers */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 12, borderWidth: 1, borderColor: tokens.colors.borderSubtle }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: tokens.colors.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>STATUS</Text>
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
                    {selectedPoDetail.status}
                  </Text>
                </View>
              </View>

              <View style={{ width: 1, height: 28, backgroundColor: tokens.colors.borderSubtle }} />

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: tokens.colors.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>TOTAL COST</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: tokens.colors.primaryContainer, marginTop: 2 }}>
                  ${Number(selectedPoDetail.totalCost || 0).toFixed(2)}
                </Text>
              </View>

              <View style={{ width: 1, height: 28, backgroundColor: tokens.colors.borderSubtle }} />

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: tokens.colors.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>ORDER DATE</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: tokens.colors.onBackground, marginTop: 2 }}>
                  {selectedPoDetail.orderDate || 'N/A'}
                </Text>
              </View>
            </View>

            {/* Expected Delivery Date Notice */}
            {Boolean(selectedPoDetail.expectedDeliveryDate) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12, gap: 6 }}>
                <Ionicons name="calendar-outline" size={14} color="#166534" />
                <Text style={{ fontSize: 11.5, color: '#166534', fontWeight: '600' }}>
                  Expected Delivery: {selectedPoDetail.expectedDeliveryDate}
                </Text>
              </View>
            )}

            {/* Notes Callout */}
            {Boolean(selectedPoDetail.notes) && (
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={12} color="#92400E" />
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#92400E' }}>PO Notes & Instructions:</Text>
                </View>
                <Text style={{ fontSize: 11.5, color: '#78350F', marginTop: 2 }}>{selectedPoDetail.notes}</Text>
              </View>
            )}

            {/* Section Header */}
            <Text style={[styles.sectionHeaderInner, { marginTop: 4, marginBottom: 8 }]}>
              Ordered Items ({groupList.length} products • {totalItemCount} units)
            </Text>

            {/* Items List Grouped by Parent */}
            <View style={{ gap: 10, marginTop: 4, marginBottom: 12 }}>
              {groupList.map((group, gIdx) => {
                const isMultiVariant = group.items.length > 1
                return (
                  <View key={`podg-${gIdx}`} style={[styles.poItemRow, { padding: 0, overflow: 'hidden', backgroundColor: '#FFFFFF', flexDirection: 'column' }]}>
                    <ProductGroupHeader
                      parentName={group.parentName}
                      variantCount={group.items.length}
                      totalQty={group.totalQty}
                      totalCost={group.totalCost}
                    />
                    {group.items.map((it, idx) => (
                      <View key={it.id || idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: idx < group.items.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9', width: '100%' }}>
                        <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                          <Text style={styles.poItemName} numberOfLines={1}>
                            {isMultiVariant
                              ? (it.productName && it.productName.includes('(') ? it.productName.split('(')[1].replace(')', '') : it.productName || 'Variant')
                              : it.productName || 'Product'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                            {Boolean(it.sku) && (
                              <CopyableBadge
                                type="sku"
                                value={it.sku}
                                compact
                              />
                            )}
                            <Text style={styles.poItemSku}>• {it.quantity} units @ ${Number(it.unitCost).toFixed(2)}</Text>
                          </View>
                        </View>
                        <Text style={[styles.poItemCost, { fontWeight: '800', color: tokens.colors.primaryContainer }]}>
                          ${Number(it.totalCost).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: tokens.colors.borderSubtle, backgroundColor: '#FFFFFF' }}>
            {selectedPoDetail.status !== 'RECEIVED' ? (
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: '#16A34A' }]}
                onPress={() => {
                  handleMarkPoReceived(selectedPoDetail.id)
                  setPoDetailModalOpen(false)
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitBtnText}>Mark as Received</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7', borderRadius: 10, paddingVertical: 12, gap: 6 }}>
                <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#16A34A' }}>Stock Fully Received</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default PurchaseOrderDetailModal
