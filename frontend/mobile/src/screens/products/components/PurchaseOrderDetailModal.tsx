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
  return (
      <Modal visible={poDetailModalOpen} transparent animationType="slide" onRequestClose={() => setPoDetailModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Purchase Order</Text>
                <Text style={{ fontSize: 12, color: tokens.colors.secondary, fontWeight: '600' }}>
                  {selectedPoDetail?.poNumber}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPoDetailModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              {/* Supplier Box */}
              <View style={styles.poDetailSupCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.supAvatarSmall}>
                    <Ionicons name="business" size={16} color={tokens.colors.primaryContainer} />
                  </View>
                  <View>
                    <Text style={styles.poDetailSupName}>{selectedPoDetail?.supplierName}</Text>
                    <Text style={styles.poDetailSupMeta}>Order Date: {selectedPoDetail?.orderDate}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.poModernStatusBadge,
                    selectedPoDetail?.status === 'RECEIVED' && styles.poStatusBadgeReceived,
                    selectedPoDetail?.status === 'ORDERED' && styles.poStatusBadgeOrdered,
                  ]}
                >
                  <Text
                    style={[
                      styles.poModernStatusText,
                      selectedPoDetail?.status === 'RECEIVED' && styles.poStatusTextReceived,
                      selectedPoDetail?.status === 'ORDERED' && styles.poStatusTextOrdered,
                    ]}
                  >
                    {selectedPoDetail?.status}
                  </Text>
                </View>
              </View>

              {/* Items List Grouped by Parent */}
              <Text style={[styles.sectionHeaderInner, { marginTop: 12 }]}>Ordered Line Items</Text>
              {(() => {
                const items = selectedPoDetail?.items || []
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
                  <View style={{ gap: 8, marginTop: 4, marginBottom: 12 }}>
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
                              <View style={{ flex: 1 }}>
                                <Text style={styles.poItemName}>
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
                              <Text style={styles.poItemCost}>${Number(it.totalCost).toFixed(2)}</Text>
                            </View>
                          ))}
                        </View>
                      )
                    })}
                  </View>
                )
              })()}

              {/* Summary */}
              <View style={styles.poSummaryCard}>
                <View style={styles.poSummaryRow}>
                  <Text style={styles.poSummaryLabel}>Total Purchase Cost</Text>
                  <Text style={styles.poSummaryTotal}>${Number(selectedPoDetail?.totalCost || 0).toFixed(2)}</Text>
                </View>
                <Text style={styles.poDeliveryMeta}>
                  Expected Delivery: {selectedPoDetail?.expectedDeliveryDate || 'Within 3 business days'}
                </Text>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                {selectedPoDetail?.status !== 'RECEIVED' ? (
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, backgroundColor: '#16A34A' }]}
                    onPress={() => {
                      if (selectedPoDetail) {
                        handleMarkPoReceived(selectedPoDetail.id)
                        setPoDetailModalOpen(false)
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>Mark as Received</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.submitBtn, { flex: 1, backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" style={{ marginRight: 6 }} />
                    <Text style={[styles.submitBtnText, { color: '#16A34A' }]}>Stock Fully Received</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

  )
}
