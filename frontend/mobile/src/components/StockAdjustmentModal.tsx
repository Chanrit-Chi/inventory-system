import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { adjustStock, scanBarcode, getProducts } from '../api/endpoints'
import { CameraScannerModal } from './CameraScannerModal'
import { ProductPickerModal, SelectedProductItem } from './ProductPickerModal'
import { ProductGroupHeader } from './ProductGroupHeader'
import { CopyableBadge } from './CopyableBadge'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import type {
  Product,
  ProductVariant,
  ScannedVariant,
  StockAdjustmentReason,
  StockAdjustmentPayload,
} from '../types'

export interface StockAdjustmentItem {
  id: string
  variant_id: string
  product_name: string
  variant_name?: string
  sku: string
  barcode?: string | null
  current_quantity: number
  new_quantity: number
  difference: number
  reason: StockAdjustmentReason
}

export interface StockAdjustmentModalProps {
  visible: boolean
  product?: Product | null
  variant?: ProductVariant | ScannedVariant | null
  onClose: () => void
  onSave?: (adjustment: StockAdjustmentPayload) => Promise<void> | void
  onSuccess?: () => void
}

const REASONS: StockAdjustmentReason[] = [
  'Audit',
  'Damaged',
  'Shrinkage',
  'Restock',
  'Return',
]

const REASON_LABELS: Record<StockAdjustmentReason, string> = {
  Audit: 'Physical Audit',
  Damaged: 'Damaged Goods',
  Shrinkage: 'Lost / Shrinkage',
  Restock: 'Restock Correction',
  Return: 'Customer Return',
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  visible,
  product,
  variant,
  onClose,
  onSave,
  onSuccess,
}) => {
  const [items, setItems] = useState<StockAdjustmentItem[]>([])
  const [globalReason, setGlobalReason] = useState<StockAdjustmentReason>('Audit')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Catalog Modal State
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')

  // Scanner State
  const [toastMessage, setToastMessage] = useState('')
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToastMessage(''), 2500)
  }, [])

  // Load products for catalog picker
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    try {
      const res = await getProducts({ page: 1 })
      const list: Product[] = Array.isArray(res) ? res : res?.data || []
      setCatalogProducts(list)
    } catch {
      // Fallback
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (visible) {
      loadCatalog()
      const isRealVariant = variant && typeof variant === 'object' && typeof variant.id === 'string' && variant.id.length > 0 && !('nativeEvent' in variant)
      const isRealProduct = product && typeof product === 'object' && typeof product.id === 'string' && typeof product.name === 'string' && product.name.length > 0 && !('nativeEvent' in product)

      if (isRealVariant) {
        const initialStock = variant.quantity_on_hand ?? 0
        const initItem: StockAdjustmentItem = {
          id: `adj-${variant.id}-${Date.now()}`,
          variant_id: variant.id,
          product_name: product?.name || 'Selected Product',
          variant_name: (variant as ProductVariant)?.name,
          sku: variant.sku || 'SKU-UNKNOWN',
          barcode: variant.barcode,
          current_quantity: initialStock,
          new_quantity: initialStock,
          difference: 0,
          reason: 'Audit',
        }
        setItems([initItem])
      } else if (isRealProduct) {
        if (product.variants && product.variants.length > 0) {
          const initItems: StockAdjustmentItem[] = product.variants.map((v, idx) => {
            const attrSummary = v.attribute_values?.map((av: any) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
            const varName = v.name || attrSummary || v.sku
            return {
              id: `adj-${v.id || idx}-${Date.now()}`,
              variant_id: v.id,
              product_name: product.name,
              variant_name: varName,
              sku: v.sku,
              barcode: v.barcode,
              current_quantity: v.quantity_on_hand ?? 0,
              new_quantity: v.quantity_on_hand ?? 0,
              difference: 0,
              reason: 'Audit',
            }
          })
          setItems(initItems)
        } else {
          const initItem: StockAdjustmentItem = {
            id: `adj-${product.id}-${Date.now()}`,
            variant_id: product.id,
            product_name: product.name,
            sku: product.sku || 'SKU-UNKNOWN',
            barcode: product.barcode,
            current_quantity: 0,
            new_quantity: 0,
            difference: 0,
            reason: 'Audit',
          }
          setItems([initItem])
        }
      } else {
        setItems([])
      }
      setGlobalReason('Audit')
      setNotes('')
    }
  }, [visible, product, variant, loadCatalog])

  const handleOpenCatalog = () => {
    setCatalogOpen(true)
    loadCatalog()
  }

  // Add a variant to the adjustment list
  const handleAddVariantToAdjustment = (prod: Product, v: ProductVariant | ScannedVariant, qtyDelta: number = 1) => {
    // Check if already in list
    const existingIndex = items.findIndex((i) => i.variant_id === v.id)
    if (existingIndex >= 0) {
      handleUpdateItemCount(items[existingIndex].id, items[existingIndex].new_quantity + qtyDelta)
      showToast(`Updated "${prod.name}" (+${qtyDelta})`)
      setCatalogOpen(false)
      return
    }

    const currentQty = v.quantity_on_hand ?? 0
    const newQty = currentQty + qtyDelta
    const newItem: StockAdjustmentItem = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      variant_id: v.id,
      product_name: prod.name,
      variant_name: (v as ProductVariant).name,
      sku: v.sku,
      barcode: v.barcode,
      current_quantity: currentQty,
      new_quantity: newQty,
      difference: newQty - currentQty,
      reason: globalReason,
    }

    setItems((prev) => [...prev, newItem])
    showToast(`Added "${prod.name}" (+${qtyDelta})`)
    setCatalogOpen(false)
  }

  const handleSelectFromPicker = (prod: Product, v?: ProductVariant | ScannedVariant) => {
    handleSelectMultipleFromPicker([{ product: prod, variant: v, quantity: 1 }])
  }

  const handleSelectMultipleFromPicker = (selectedList: SelectedProductItem[]) => {
    setItems((prev) => {
      const next = [...prev]
      selectedList.forEach((it) => {
        const prod = it.product
        const v = it.variant || (prod.variants && prod.variants.length > 0 ? prod.variants[0] : {
          id: prod.id,
          name: prod.name,
          product_id: prod.id,
          sku: prod.sku,
          barcode: prod.barcode ?? null,
          quantity_on_hand: (prod as any).quantity_on_hand ?? 0,
          selling_price_override: null,
          selling_price: String(prod.selling_price),
        })

        const qtyToAdd = it.quantity > 0 ? it.quantity : 1
        const existingIndex = next.findIndex((i) => i.variant_id === v.id)

        if (existingIndex >= 0) {
          // Picker reflects current totals: confirm sets the line to the chosen quantity (no double-count)
          const updatedNewQty = Math.max(0, Math.round(it.quantity || 0))
          next[existingIndex] = {
            ...next[existingIndex],
            new_quantity: updatedNewQty,
            difference: updatedNewQty - next[existingIndex].current_quantity,
          }
        } else {
          const currentQty = v.quantity_on_hand ?? 0
          const initialNewQty = currentQty + qtyToAdd
          next.push({
            id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            variant_id: v.id,
            product_name: prod.name,
            variant_name: (v as ProductVariant).name,
            sku: v.sku,
            barcode: v.barcode,
            current_quantity: currentQty,
            new_quantity: initialNewQty,
            difference: initialNewQty - currentQty,
            reason: globalReason,
          })
        }
      })
      return next
    })
    showToast(`Added ${selectedList.length} item${selectedList.length > 1 ? 's' : ''} to adjustment`)
    setCatalogOpen(false)
  }

  // Barcode Scanner Hook for Stock Adjustment
  const {
    scannerOpen,
    setScannerOpen,
    loading: scanLoading,
    handleScanCode,
  } = useBarcodeScan({
    mode: 'stock-adj',
    onFoundVariant: (variant, product) => {
      handleAddVariantToAdjustment(
        {
          id: product?.id || 'prod-1',
          name: product?.name || 'Product',
          sku: variant.sku,
          purchase_price: 0,
          selling_price: parseFloat(variant.selling_price || '0') || 0,
          is_active: true,
        },
        variant
      )
    },
    onFoundProduct: (product, variants) => {
      if (variants.length === 1) {
        handleAddVariantToAdjustment(
          {
            id: product.id,
            name: product.name,
            sku: product.id,
            purchase_price: 0,
            selling_price: parseFloat(product.selling_price || '0') || 0,
            is_active: true,
          },
          variants[0]
        )
      } else {
        setCatalogSearch(product.name)
        setCatalogOpen(true)
        loadCatalog()
      }
    },
  })

  // Stepper changes
  const handleUpdateItemCount = (id: string, newCount: number) => {
    const validCount = Math.max(0, newCount)
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            new_quantity: validCount,
            difference: validCount - item.current_quantity,
          }
        }
        return item
      })
    )
  }

  const handleUpdateItemReason = (id: string, reason: StockAdjustmentReason) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, reason } : item))
    )
  }

  const handleRemoveItem = (id: string, name?: string) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove "${name || 'this item'}" from the adjustment list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setItems((prev) => prev.filter((item) => item.id !== id))
            showToast('Removed item from adjustment')
          },
        },
      ]
    )
  }

  // Apply global reason to all items
  const handleApplyGlobalReason = (reason: StockAdjustmentReason) => {
    setGlobalReason(reason)
    setItems((prev) => prev.map((item) => ({ ...item, reason })))
  }

  interface StockAdjustmentGroup {
    groupKey: string
    parentName: string
    items: StockAdjustmentItem[]
    totalQty: number
    totalCurrentQty: number
    totalDifference: number
  }

  const groupedAdjItems = useMemo<StockAdjustmentGroup[]>(() => {
    const groups: Record<string, StockAdjustmentGroup> = {}
    items.forEach((it) => {
      const groupKey = it.product_name || 'Product'
      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          parentName: it.product_name || 'Product',
          items: [],
          totalQty: 0,
          totalCurrentQty: 0,
          totalDifference: 0,
        }
      }
      groups[groupKey].items.push(it)
      groups[groupKey].totalQty += it.new_quantity
      groups[groupKey].totalCurrentQty += it.current_quantity
      groups[groupKey].totalDifference += it.difference
    })
    return Object.values(groups)
  }, [items])

  const handleRemoveAdjParentGroupWithConfirm = (group: StockAdjustmentGroup) => {
    Alert.alert(
      'Remove All Variants',
      `Are you sure you want to remove all ${group.items.length} variants of "${group.parentName}" from this adjustment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: () => {
            const idsToRemove = new Set(group.items.map((i) => i.id))
            setItems((prev) => prev.filter((i) => !idsToRemove.has(i.id)))
            showToast(`Removed all variants of ${group.parentName}`)
          },
        },
      ]
    )
  }

  // Summary counts
  const totalDifference = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.difference, 0)
  }, [items])

  const adjustedItemsCount = useMemo(() => {
    return items.filter((i) => i.difference !== 0).length
  }, [items])

  // Save all adjustments
  const handleSaveAll = async () => {
    if (items.length === 0) {
      Alert.alert('No Items', 'Please select or scan at least one product to adjust.')
      return
    }

    if (adjustedItemsCount === 0) {
      Alert.alert('No Changes', 'All item counts match current stock. No adjustments needed.')
      return
    }

    setIsSubmitting(true)
    try {
      for (const item of items) {
        if (item.difference !== 0) {
          const payload: StockAdjustmentPayload = {
            variant_id: item.variant_id,
            current_quantity: item.current_quantity,
            new_quantity: item.new_quantity,
            difference: item.difference,
            reason: item.reason,
            notes: notes.trim() || undefined,
            adjusted_at: new Date().toISOString(),
          }

          if (onSave) {
            await onSave(payload)
          } else {
            await adjustStock({
              variant_id: item.variant_id,
              current_quantity: item.current_quantity,
              new_quantity: item.new_quantity,
              difference: item.difference,
              reason: item.reason,
              notes: notes.trim() || undefined,
            })
          }
        }
      }

      Alert.alert(
        'Stock Adjusted Successfully',
        `Updated ${adjustedItemsCount} items with a net variance of ${totalDifference >= 0 ? '+' : ''}${totalDifference} units.`,
        [
          {
            text: 'Done',
            onPress: () => {
              if (onSuccess) onSuccess()
              onClose()
            },
          },
        ]
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save stock adjustments.'
      Alert.alert('Adjustment Error', msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter catalog products
  const filteredCatalogProducts = useMemo(() => {
    if (!catalogSearch.trim()) return catalogProducts
    const q = catalogSearch.toLowerCase().trim()
    return catalogProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.variants?.some(
          (v) =>
            v.sku.toLowerCase().includes(q) ||
            (v.barcode && v.barcode.toLowerCase().includes(q)) ||
            (v.name && v.name.toLowerCase().includes(q))
        )
    )
  }, [catalogProducts, catalogSearch])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Stock Count Adjustment</Text>
              <Text style={styles.headerSubtitle}>Physical Inventory Audit & Correction</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close stock adjustment"
            >
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Toast Notification */}
          {toastMessage.length > 0 && (
            <View style={styles.toast}>
              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Quick Intake Action Buttons: Select from Catalog & Scan Barcode */}
            <View style={styles.topActionsRow}>
              <TouchableOpacity
                style={styles.actionBtnCatalog}
                onPress={handleOpenCatalog}
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={16} color={tokens.colors.onPrimary} />
                <Text style={styles.actionBtnText}>Select Product</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnScan}
                onPress={() => setScannerOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="barcode-outline" size={18} color={tokens.colors.onPrimary} />
                <Text style={styles.actionBtnText}>Scan Barcode</Text>
              </TouchableOpacity>
            </View>

            {/* Global Reason Selector */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="clipboard-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.sectionCardTitle}>Adjustment Reason</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reasonScroll}>
                {REASONS.map((r) => {
                  const isSelected = globalReason === r
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.reasonChip, isSelected && styles.reasonChipActive]}
                      onPress={() => handleApplyGlobalReason(r)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextActive]}>
                        {REASON_LABELS[r]}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            {/* Selected Items List */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="layers-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.sectionCardTitle}>
                  Items to Adjust ({items.length})
                </Text>
              </View>

              {items.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Ionicons name="cube-outline" size={32} color={tokens.colors.secondary} />
                  <Text style={styles.emptyTitle}>No items selected for adjustment</Text>
                  <Text style={styles.emptySub}>
                    Tap "+ Select Product" or scan physical barcode labels to adjust stock counts.
                  </Text>
                </View>
              ) : (
                groupedAdjItems.map((group) => {
                  const isMultiVariant = group.items.length > 1
                  return (
                    <View key={group.groupKey} style={[styles.itemCard, { padding: 0, overflow: 'hidden' }]}>
                      <ProductGroupHeader
                        parentName={group.parentName}
                        variantCount={group.items.length}
                        totalQty={group.totalQty}
                        onRemoveAll={() => handleRemoveAdjParentGroupWithConfirm(group)}
                      />

                      {group.items.map((item) => {
                        const diffColor =
                          item.difference > 0
                            ? '#15803D'
                            : item.difference < 0
                            ? '#BA1A1A'
                            : tokens.colors.secondary
                        const diffBg =
                          item.difference > 0
                            ? '#E6F4EA'
                            : item.difference < 0
                            ? '#FFDAD6'
                            : '#F1F5F9'

                        return (
                          <View key={item.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                            <View style={styles.itemHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>
                                  {isMultiVariant
                                    ? item.variant_name || item.sku
                                    : item.product_name}
                                </Text>
                                {Boolean(isMultiVariant && item.variant_name) && (
                                  <Text style={styles.itemVariantName}>{item.variant_name}</Text>
                                )}
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                  {Boolean(item.sku) && (
                                    <CopyableBadge
                                      type="sku"
                                      value={item.sku}
                                      compact
                                      onToast={showToast}
                                    />
                                  )}
                                  {Boolean(item.barcode) && (
                                    <CopyableBadge
                                      type="barcode"
                                      value={item.barcode}
                                      compact
                                      prefixIcon
                                      onToast={showToast}
                                    />
                                  )}
                                </View>
                              </View>
                              <TouchableOpacity
                                style={styles.itemRemoveBtn}
                                onPress={() => handleRemoveItem(item.id, item.variant_name || item.product_name)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                              </TouchableOpacity>
                            </View>

                            {/* Stock Stepper & Variance Row */}
                            <View style={styles.stepperContainer}>
                              <View style={styles.currentStockPill}>
                                <Text style={styles.currentStockLabel}>ON HAND</Text>
                                <Text style={styles.currentStockValue}>{item.current_quantity}</Text>
                              </View>

                              <Ionicons name="arrow-forward" size={14} color={tokens.colors.secondary} />

                              {/* Stepper Input */}
                              <View style={styles.stepperBox}>
                                <TouchableOpacity
                                  style={styles.stepBtn}
                                  onPress={() => handleUpdateItemCount(item.id, item.new_quantity - 1)}
                                >
                                  <Ionicons name="remove" size={16} color={tokens.colors.onBackground} />
                                </TouchableOpacity>
                                <TextInput
                                  style={styles.stepInput}
                                  keyboardType="numeric"
                                  value={String(item.new_quantity)}
                                  onChangeText={(txt) => {
                                    const clean = txt.replace(/[^0-9]/g, '')
                                    const num = parseInt(clean, 10)
                                    handleUpdateItemCount(item.id, isNaN(num) ? 0 : num)
                                  }}
                                  selectTextOnFocus
                                />
                                <TouchableOpacity
                                  style={styles.stepBtn}
                                  onPress={() => handleUpdateItemCount(item.id, item.new_quantity + 1)}
                                >
                                  <Ionicons name="add" size={16} color={tokens.colors.onBackground} />
                                </TouchableOpacity>
                              </View>

                              {/* Variance Badge */}
                              <View style={[styles.diffBadge, { backgroundColor: diffBg }]}>
                                <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                                  {item.difference > 0 ? `+${item.difference}` : item.difference}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  )
                })
              )}
            </View>

            {/* Audit Notes Input */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Audit Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="e.g. Discrepancy found during routine stock audit, shelf B-02"
                placeholderTextColor={tokens.colors.textDisabled}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Footer Submit Button */}
          <View style={styles.footerBar}>
            <View style={styles.footerSummary}>
              <Text style={styles.footerSummaryLabel}>
                {items.length} {items.length === 1 ? 'item' : 'items'} selected
              </Text>
              <Text style={styles.footerSummaryVariance}>
                Net Variance: {totalDifference >= 0 ? `+${totalDifference}` : totalDifference} units
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (items.length === 0 || isSubmitting) && { opacity: 0.6 },
              ]}
              onPress={handleSaveAll}
              disabled={items.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Save Adjustments</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Product Catalog Selection Modal */}
      <ProductPickerModal
        visible={catalogOpen}
        title="Select Product to Adjust"
        subtitle="Grouped by product catalog with live store inventory"
        priceType="selling"
        allowExceedStock={true}
        products={catalogProducts}
        existingItems={items.map((it) => ({
          variantId: it.variant_id,
          sku: it.sku,
          productName: it.product_name,
          quantity: it.new_quantity,
        }))}
        onClose={() => setCatalogOpen(false)}
        onSelect={handleSelectFromPicker}
        onSelectMultiple={handleSelectMultipleFromPicker}
        onRefreshCatalog={loadCatalog}
      />

      {/* Barcode Camera Scanner Modal */}
      <CameraScannerModal
        visible={scannerOpen}
        isLoading={scanLoading}
        onClose={() => setScannerOpen(false)}
        onScanCode={async (code) => { await handleScanCode(code) }}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  headerSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#86EFAC',
  },
  toastText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  scrollBody: {
    flex: 1,
    padding: tokens.spacing.md,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  actionBtnCatalog: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  actionBtnScan: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  actionBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.card,
    padding: 12,
    marginBottom: tokens.spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  reasonScroll: {
    flexDirection: 'row',
  },
  reasonChip: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  reasonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  reasonChipTextActive: {
    color: tokens.colors.onPrimary,
  },
  emptyStateBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  itemCard: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    padding: 10,
    marginTop: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  itemVariantName: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.primaryContainer,
    marginTop: 1,
  },
  itemTagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  itemSkuTag: {
    fontSize: 10,
    color: tokens.colors.secondary,
    backgroundColor: tokens.colors.surfaceCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemBarcodeTag: {
    fontSize: 10,
    color: tokens.colors.secondary,
    backgroundColor: tokens.colors.surfaceCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemRemoveBtn: {
    padding: 4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  currentStockPill: {
    alignItems: 'center',
  },
  currentStockLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  currentStockValue: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  stepInput: {
    width: 44,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    paddingVertical: 4,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  diffBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    padding: 10,
    fontSize: 12,
    color: tokens.colors.onBackground,
    textAlignVertical: 'top',
    height: 60,
    marginTop: 6,
  },
  footerBar: {
    backgroundColor: tokens.colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerSummary: {
    flex: 1,
  },
  footerSummaryLabel: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  footerSummaryVariance: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: tokens.borderRadius.pill,
  },
  saveBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  catalogSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    margin: tokens.spacing.md,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.input,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  catalogSearchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  catalogCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.card,
    padding: 12,
    marginBottom: 8,
  },
  catalogProdTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  catalogProdSku: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  catalogVariantsWrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    paddingTop: 6,
    gap: 4,
  },
  catalogVarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  catalogVarTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  catalogVarStock: {
    fontSize: 10,
    color: tokens.colors.secondary,
  },
  catalogSingleAddBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.pill,
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  catalogSingleAddText: {
    color: tokens.colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
})


