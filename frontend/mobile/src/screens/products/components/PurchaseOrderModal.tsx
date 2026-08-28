import React from 'react'
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ProductsScreen.styles'
import type { Supplier, PurchaseOrderItem } from '../../../types'

interface PurchaseOrderModalProps {
  poModalOpen: boolean
  setPoModalOpen: (v: boolean) => void
  suppliers: Supplier[]
  selectedSupplierId: string
  setSelectedSupplierId: (v: string) => void
  poNotes: string
  setPoNotes: (v: string) => void
  poDeliveryDays: string
  setPoDeliveryDays: (v: string) => void
  poItems: PurchaseOrderItem[]
  setPoCatalogOpen: (v: boolean) => void
  setPoScannerOpen: (v: boolean) => void
  handleUpdatePoItemQty: (id: string, delta: number) => void
  handleUpdatePoItemCost: (id: string, text: string) => void
  handleRemovePoItem: (id: string) => void
  handleCreatePO: () => void
}

export function PurchaseOrderModal({
  poModalOpen,
  setPoModalOpen,
  suppliers,
  selectedSupplierId,
  setSelectedSupplierId,
  poNotes,
  setPoNotes,
  poDeliveryDays,
  setPoDeliveryDays,
  poItems,
  setPoCatalogOpen,
  setPoScannerOpen,
  handleUpdatePoItemQty,
  handleUpdatePoItemCost,
  handleRemovePoItem,
  handleCreatePO,
}: PurchaseOrderModalProps) {
  return (      <Modal visible={poModalOpen} transparent animationType="slide" onRequestClose={() => setPoModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>New Purchase Order</Text>
                <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>
                  Select or scan products to order from vendor
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPoModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Supplier Selection */}
              <Text style={styles.formLabel}>Target Supplier / Vendor *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {suppliers.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.supChoice, selectedSupplierId === s.id && styles.supChoiceActive]}
                      onPress={() => setSelectedSupplierId(s.id)}
                    >
                      <Text style={[styles.supChoiceText, selectedSupplierId === s.id && styles.supChoiceTextActive]}>
                        {s.name}
                      </Text>
                      <Text style={{ fontSize: 10, color: selectedSupplierId === s.id ? tokens.colors.onPrimary : tokens.colors.secondary }}>
                        {s.leadTimeDays ? `${s.leadTimeDays}d lead` : 'Standard'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Action Buttons: Browse Catalog & Barcode Scanner */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.poActionBtn, { flex: 1, backgroundColor: tokens.colors.primaryContainer, height: 42 }]}
                  onPress={() => setPoCatalogOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="list-outline" size={18} color={tokens.colors.onPrimary} />
                  <Text style={styles.poActionBtnText}>+ Browse Catalog</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.poActionBtn, { flex: 1, backgroundColor: '#0284C7', height: 42 }]}
                  onPress={() => setPoScannerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.poActionBtnText}>Scan Barcode</Text>
                </TouchableOpacity>
              </View>

              {/* Line Items Section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={[styles.formLabel, { marginBottom: 0 }]}>
                  Order Line Items ({poItems.length})
                </Text>
                {poItems.length > 0 && (
                  <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                    {poItems.reduce((sum, i) => sum + i.quantity, 0)} total units
                  </Text>
                )}
              </View>

              {poItems.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
                  <Ionicons name="cube-outline" size={36} color={tokens.colors.secondary} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onBackground, marginTop: 8 }}>
                    No products added to PO yet
                  </Text>
                  <Text style={{ fontSize: 11, color: tokens.colors.secondary, textAlign: 'center', marginTop: 2 }}>
                    Tap "+ Browse Catalog" or "Scan Barcode" to add items to order.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {poItems.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        padding: 12,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onBackground }} numberOfLines={1}>
                            {item.productName}
                          </Text>
                          <Text style={{ fontSize: 10, color: tokens.colors.secondary, fontFamily: 'monospace' }}>
                            {item.sku}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemovePoItem(item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {/* Qty Stepper */}
                        <View style={{ flex: 1.2 }}>
                          <Text style={{ fontSize: 10, color: tokens.colors.secondary, fontWeight: '600', marginBottom: 2 }}>
                            QTY ORDERED
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2 }}>
                            <TouchableOpacity
                              style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                              onPress={() => handleUpdatePoItemQty(item.id, -5)}
                            >
                              <Ionicons name="remove" size={14} color={tokens.colors.onBackground} />
                            </TouchableOpacity>
                            <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 13 }}>
                              {item.quantity}
                            </Text>
                            <TouchableOpacity
                              style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                              onPress={() => handleUpdatePoItemQty(item.id, 5)}
                            >
                              <Ionicons name="add" size={14} color={tokens.colors.onBackground} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Unit Cost */}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, color: tokens.colors.secondary, fontWeight: '600', marginBottom: 2 }}>
                            UNIT COST ($)
                          </Text>
                          <TextInput
                            style={{
                              height: 32,
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#CBD5E1',
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              fontSize: 12,
                              fontWeight: '600',
                            }}
                            keyboardType="numeric"
                            value={String(item.unitCost)}
                            onChangeText={(text) => handleUpdatePoItemCost(item.id, text)}
                          />
                        </View>

                        {/* Line Total */}
                        <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                          <Text style={{ fontSize: 10, color: tokens.colors.secondary, fontWeight: '600', marginBottom: 2 }}>
                            LINE TOTAL
                          </Text>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.colors.primaryContainer }}>
                            ${item.totalCost.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Order Memo & Expected Delivery */}
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Lead Time (Days)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="3"
                    value={poDeliveryDays}
                    onChangeText={setPoDeliveryDays}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.formLabel}>PO Notes / Memo (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Urgent restock, shipping terms"
                    value={poNotes}
                    onChangeText={setPoNotes}
                  />
                </View>
              </View>

              {/* PO Summary Card */}
              {poItems.length > 0 && (
                <View style={{ backgroundColor: tokens.colors.actionPrimaryBg, borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>Total PO Investment</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.colors.primaryContainer }}>
                      ${poItems.reduce((sum, i) => sum + i.totalCost, 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>Status</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#16A34A' }}>ORDERED</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, poItems.length === 0 && { opacity: 0.6 }]}
                onPress={handleCreatePO}
                disabled={poItems.length === 0}
              >
                <Text style={styles.submitBtnText}>Create & Issue Purchase Order</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

  )
}
