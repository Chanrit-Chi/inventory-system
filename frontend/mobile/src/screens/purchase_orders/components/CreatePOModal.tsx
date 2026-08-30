import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../PurchaseOrdersScreen.styles'
import { ProductGroupHeader } from '../../../components/ProductGroupHeader'
import { CopyableBadge } from '../../../components/CopyableBadge'
import type { Supplier, PurchaseOrderItem, PoGroup } from '../../../types'

export interface CreatePOModalProps {
  visible: boolean
  suppliers: Supplier[]
  selectedSupplierId: string
  setSelectedSupplierId: (id: string) => void
  poItems: PurchaseOrderItem[]
  groupedPoItems: PoGroup[]
  poExpectedDate: string
  setPoExpectedDate: (d: string) => void
  poNotes: string
  setPoNotes: (n: string) => void
  onClose: () => void
  onOpenCatalog: () => void
  onOpenScanner: () => void
  onRemoveParentGroup: (group: PoGroup) => void
  onRemoveItem: (item: PurchaseOrderItem) => void
  onUpdateItemQty: (itemId: string, delta: number) => void
  onSetItemQty?: (itemId: string, qty: number) => void
  onUpdateItemCost: (itemId: string, costStr: string) => void
  onSavePO: () => void
}

export const CreatePOModal: React.FC<CreatePOModalProps> = ({
  visible,
  suppliers,
  selectedSupplierId,
  setSelectedSupplierId,
  poItems,
  groupedPoItems,
  poExpectedDate,
  setPoExpectedDate,
  poNotes,
  setPoNotes,
  onClose,
  onOpenCatalog,
  onOpenScanner,
  onRemoveParentGroup,
  onRemoveItem,
  onUpdateItemQty,
  onSetItemQty,
  onUpdateItemCost,
  onSavePO,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.modalTitle}>New Purchase Order</Text>
              <Text style={styles.modalSubtitle}>Order inventory from authorized suppliers</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
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
                    <Text
                      style={[
                        styles.supChoiceText,
                        selectedSupplierId === s.id && styles.supChoiceTextActive,
                      ]}
                    >
                      {s.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color:
                          selectedSupplierId === s.id
                            ? tokens.colors.onPrimary
                            : tokens.colors.secondary,
                      }}
                    >
                      {s.leadTimeDays ? `${s.leadTimeDays}d lead` : 'Standard'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Action Buttons: Browse Catalog & Barcode Scanner */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                style={[
                  styles.poActionBtn,
                  { flex: 1, backgroundColor: tokens.colors.primaryContainer },
                ]}
                onPress={onOpenCatalog}
                activeOpacity={0.8}
              >
                <Ionicons name="list-outline" size={18} color={tokens.colors.onPrimary} />
                <Text style={styles.poActionBtnText}>+ Browse Catalog</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.poActionBtn, { flex: 1, backgroundColor: '#0284C7' }]}
                onPress={onOpenScanner}
                activeOpacity={0.8}
              >
                <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
                <Text style={styles.poActionBtnText}>Scan Barcode</Text>
              </TouchableOpacity>
            </View>

            {/* Line Items List */}
            <View style={styles.lineItemHeaderRow}>
              <Text style={styles.formLabel}>Line Items ({poItems.length})</Text>
              {poItems.length > 0 && (
                <Text style={styles.unitSummary}>
                  {poItems.reduce((s, it) => s + it.quantity, 0)} units • $
                  {poItems.reduce((s, it) => s + it.totalCost, 0).toFixed(2)}
                </Text>
              )}
            </View>

            {poItems.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Ionicons name="cube-outline" size={32} color={tokens.colors.secondary} />
                <Text style={styles.emptyItemsTitle}>No items added to this PO</Text>
                <Text style={styles.emptyItemsSubtitle}>
                  Tap "+ Browse Catalog" or "Scan Barcode" to add products.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10, marginBottom: 16 }}>
                {groupedPoItems.map((group) => {
                  const isMultiVariant = group.items.length > 1
                  return (
                    <View
                      key={group.groupKey}
                      style={[styles.poItemRow, { padding: 0, overflow: 'hidden' }]}
                    >
                      <ProductGroupHeader
                        parentName={group.parentName}
                        variantCount={group.items.length}
                        totalQty={group.totalQty}
                        totalCost={group.totalCost}
                        onRemoveAll={() => onRemoveParentGroup(group)}
                      />

                      {group.items.map((item: PurchaseOrderItem) => (
                        <View
                          key={item.id}
                          style={{
                            padding: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F1F5F9',
                          }}
                        >
                          <View style={styles.poItemHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.poItemName} numberOfLines={1}>
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
                            <TouchableOpacity
                              onPress={() => onRemoveItem(item)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={tokens.colors.statusError}
                              />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.poItemControlRow}>
                            {/* Stepper */}
                            <View style={styles.stepperContainer}>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => onUpdateItemQty(item.id, -1)}
                              >
                                <Ionicons
                                  name="remove"
                                  size={14}
                                  color={tokens.colors.onBackground}
                                />
                              </TouchableOpacity>
                              <TextInput
                                style={styles.stepperVal}
                                keyboardType="numeric"
                                value={String(item.quantity)}
                                onChangeText={(t) => {
                                  const clean = t.replace(/[^0-9]/g, '')
                                  const num = parseInt(clean, 10)
                                  if (onSetItemQty) {
                                    onSetItemQty(item.id, isNaN(num) ? 1 : Math.max(1, num))
                                  }
                                }}
                                selectTextOnFocus
                              />
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => onUpdateItemQty(item.id, 1)}
                              >
                                <Ionicons
                                  name="add"
                                  size={14}
                                  color={tokens.colors.onBackground}
                                />
                              </TouchableOpacity>
                            </View>

                            {/* Unit Cost */}
                            <View style={styles.costInputGroup}>
                              <Text style={styles.costInputLabel}>Cost/unit:</Text>
                              <TextInput
                                style={styles.costInput}
                                value={String(item.unitCost)}
                                onChangeText={(t) => onUpdateItemCost(item.id, t)}
                                keyboardType="decimal-pad"
                              />
                            </View>

                            <Text style={styles.itemTotalCost}>
                              ${item.totalCost.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                })}
              </View>
            )}

            {/* Expected Delivery & Notes */}
            <Text style={styles.formLabel}>Expected Delivery Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD (e.g. 2026-09-01)"
              placeholderTextColor={tokens.colors.secondary}
              value={poExpectedDate}
              onChangeText={setPoExpectedDate}
            />

            <Text style={styles.formLabel}>Order Notes / Instructions</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Payment terms, delivery instructions, reference..."
              placeholderTextColor={tokens.colors.secondary}
              value={poNotes}
              onChangeText={setPoNotes}
              multiline
            />
          </ScrollView>

          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={[styles.submitPoBtn, poItems.length === 0 && { opacity: 0.5 }]}
              onPress={onSavePO}
              disabled={poItems.length === 0}
            >
              <Text style={styles.submitPoBtnText}>
                Issue Purchase Order ($
                {poItems.reduce((s, it) => s + it.totalCost, 0).toFixed(2)})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
