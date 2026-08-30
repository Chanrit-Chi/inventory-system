import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { CopyableBadge } from './CopyableBadge'
import type { ScannedVariant, ScannedProduct } from '../types'

export interface SelectedVariantItem {
  variant: ScannedVariant
  quantity: number
}

export interface VariantPickerModalProps {
  visible: boolean
  product: ScannedProduct | null
  variants: ScannedVariant[]
  onSelectVariant?: (variant: ScannedVariant) => void
  onAddMultipleVariants?: (items: SelectedVariantItem[]) => void
  onClose: () => void
}

export const VariantPickerModal: React.FC<VariantPickerModalProps> = ({
  visible,
  product,
  variants,
  onSelectVariant,
  onAddMultipleVariants,
  onClose,
}) => {
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    if (visible) {
      if (variants.length === 1 && (variants[0].quantity_on_hand ?? 0) > 0) {
        setSelectedQuantities({ [variants[0].id]: 1 })
      } else {
        setSelectedQuantities({})
      }
    }
  }, [visible, variants])

  const allOutOfStock = variants.length > 0 && variants.every(v => (v.quantity_on_hand ?? 0) <= 0)

  const handleIncrement = useCallback((variant: ScannedVariant) => {
    const stock = variant.quantity_on_hand ?? 0
    if (stock <= 0) return
    setSelectedQuantities(prev => {
      const current = prev[variant.id] || 0
      if (current >= stock) return prev
      return { ...prev, [variant.id]: current + 1 }
    })
  }, [])

  const handleDecrement = useCallback((variant: ScannedVariant) => {
    setSelectedQuantities(prev => {
      const current = prev[variant.id] || 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[variant.id]
        return next
      }
      return { ...prev, [variant.id]: current - 1 }
    })
  }, [])

  const handleSetExactQuantity = useCallback((variant: ScannedVariant, qty: number) => {
    const stock = variant.quantity_on_hand ?? 0
    if (stock <= 0) return
    setSelectedQuantities(prev => {
      if (qty <= 0) {
        const next = { ...prev }
        delete next[variant.id]
        return next
      }
      const capped = Math.min(qty, stock)
      return { ...prev, [variant.id]: capped }
    })
  }, [])

  const totalUnits = useMemo(() => {
    return Object.values(selectedQuantities).reduce((sum, q) => sum + q, 0)
  }, [selectedQuantities])

  const totalPrice = useMemo(() => {
    let sum = 0
    for (const v of variants) {
      const q = selectedQuantities[v.id] || 0
      if (q > 0) {
        const rawPrice = v.selling_price_override ?? v.selling_price ?? product?.selling_price ?? '0'
        const price = parseFloat(String(rawPrice)) || 0
        sum += price * q
      }
    }
    return sum
  }, [selectedQuantities, variants, product])

  const handleConfirmAdd = useCallback(() => {
    const items: SelectedVariantItem[] = []
    for (const v of variants) {
      const q = selectedQuantities[v.id] || 0
      if (q > 0) {
        items.push({ variant: v, quantity: q })
      }
    }
    if (items.length === 0) return

    if (onAddMultipleVariants) {
      onAddMultipleVariants(items)
    } else if (onSelectVariant) {
      items.forEach(it => {
        for (let i = 0; i < it.quantity; i++) {
          onSelectVariant(it.variant)
        }
      })
    }
    onClose()
  }, [selectedQuantities, variants, onAddMultipleVariants, onSelectVariant, onClose])

  const renderVariantItem = ({ item }: { item: ScannedVariant }) => {
    const stock = item.quantity_on_hand ?? 0
    const isOutOfStock = stock <= 0
    const isLowStock = stock > 0 && stock <= 5
    const rawPrice = item.selling_price_override ?? item.selling_price ?? product?.selling_price ?? '0'
    const price = parseFloat(String(rawPrice)) || 0
    const selectedQty = selectedQuantities[item.id] || 0
    const isAtMax = selectedQty >= stock

    const attributeValues = item.attribute_values && item.attribute_values.length > 0
      ? item.attribute_values
      : []

    return (
      <View
        testID={`variant-card-${item.id}`}
        style={[
          styles.variantCard,
          selectedQty > 0 && styles.variantCardSelected,
          isOutOfStock && styles.variantCardDisabled,
        ]}
      >
        <View style={styles.variantLeft}>
          {/* SKU and Barcode row */}
          <View style={styles.skuRow}>
            {Boolean(item.sku) && (
              <CopyableBadge
                type="sku"
                value={item.sku}
                compact
              />
            )}
            {Boolean(item.barcode) && (
              <CopyableBadge
                type="barcode"
                value={item.barcode}
                compact
                prefixIcon
              />
            )}
          </View>

          {/* Visual Attribute Chips */}
          {attributeValues.length > 0 ? (
            <View style={styles.chipsContainer}>
              {attributeValues.map((av, idx) => (
                <View
                  key={av.id || idx}
                  style={[
                    styles.attributeChip,
                    isOutOfStock && styles.attributeChipDisabled,
                  ]}
                >
                  {av.attribute?.name ? (
                    <Text style={styles.chipAttrKey}>{av.attribute.name}: </Text>
                  ) : null}
                  <Text style={styles.chipAttrVal}>{av.value_name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.defaultVariantText, isOutOfStock && styles.textDisabled]}>
              Standard Variant
            </Text>
          )}

          {/* Stock Level Tag */}
          <View style={styles.stockBadgeRow}>
            <View
              style={[
                styles.stockBadge,
                isOutOfStock
                  ? styles.stockBadgeOos
                  : isLowStock
                  ? styles.stockBadgeLow
                  : styles.stockBadgeInStock,
              ]}
            >
              <View
                style={[
                  styles.stockDot,
                  isOutOfStock
                    ? styles.stockDotOos
                    : isLowStock
                    ? styles.stockDotLow
                    : styles.stockDotInStock,
                ]}
              />
              <Text
                style={[
                  styles.stockBadgeText,
                  isOutOfStock
                    ? styles.stockBadgeTextOos
                    : isLowStock
                    ? styles.stockBadgeTextLow
                    : styles.stockBadgeTextInStock,
                ]}
              >
                {isOutOfStock
                  ? '0 Stock'
                  : isLowStock
                  ? `Low Stock: ${stock} left`
                  : `In Stock: ${stock} units`}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Side: Tabular Price + Selection Action Button or Stepper */}
        <View style={styles.variantRight}>
          <Text style={[styles.variantPrice, isOutOfStock && styles.textDisabled]}>
            ${price.toFixed(2)}
          </Text>

          {isOutOfStock ? (
            <View style={styles.oosBadge}>
              <Text style={styles.oosBadgeText}>0 Stock</Text>
            </View>
          ) : selectedQty > 0 ? (
            <View style={styles.inlineStepper}>
              <TouchableOpacity
                testID={`btn-dec-variant-${item.id}`}
                style={styles.stepperBtn}
                onPress={() => handleDecrement(item)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Decrease quantity for ${item.sku}`}
              >
                <Ionicons name="remove" size={14} color={tokens.colors.onBackground} />
              </TouchableOpacity>
              <TextInput
                testID={`input-qty-variant-${item.id}`}
                style={styles.stepperQtyText}
                keyboardType="numeric"
                value={String(selectedQty)}
                onChangeText={(txt) => {
                  const clean = txt.replace(/[^0-9]/g, '')
                  const num = parseInt(clean, 10)
                  handleSetExactQuantity(item, isNaN(num) ? 0 : num)
                }}
                selectTextOnFocus
              />
              <TouchableOpacity
                testID={`btn-inc-variant-${item.id}`}
                style={[styles.stepperBtn, isAtMax && styles.stepperBtnDisabled]}
                onPress={() => handleIncrement(item)}
                disabled={isAtMax}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Increase quantity for ${item.sku}`}
              >
                <Ionicons
                  name="add"
                  size={14}
                  color={isAtMax ? tokens.colors.textDisabled : tokens.colors.onBackground}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              testID={`btn-pick-variant-${item.id}`}
              style={styles.selectButton}
              onPress={() => handleIncrement(item)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Select variant ${item.sku}`}
            >
              <Text style={styles.selectButtonText}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.bottomSheetContainer}>
          {/* Drag Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <View style={styles.masterBadgeRow}>
                <View style={[styles.masterTag, variants.length === 1 && { backgroundColor: tokens.colors.surfaceAlt }]}>
                  <Text style={[styles.masterTagText, variants.length === 1 && { color: tokens.colors.secondary }]}>
                    {variants.length === 1 ? 'Single Product' : 'Master Product Options'}
                  </Text>
                </View>
                <Text style={styles.variantCountTag}>
                  {variants.length === 1 ? '1 item' : `${variants.length} options`}
                </Text>
              </View>
              <Text style={styles.productTitle} numberOfLines={2}>
                {product?.name ?? 'Select Product Variants'}
              </Text>
              {(Boolean(product?.sku) || Boolean(product?.barcode)) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {Boolean(product?.sku) && (
                    <CopyableBadge
                      type="sku"
                      value={product?.sku}
                      compact
                    />
                  )}
                  {Boolean(product?.barcode) && (
                    <CopyableBadge
                      type="barcode"
                      value={product?.barcode}
                      compact
                      prefixIcon
                    />
                  )}
                </View>
              )}
              <Text style={styles.productSubtitle}>
                Choose quantities for one or multiple variants to add to cart
              </Text>
            </View>

            <TouchableOpacity
              testID="btn-close-variant-picker"
              style={styles.closeHeaderBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close variant picker"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Variants List or Empty State */}
          {allOutOfStock ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="alert-circle-outline" size={28} color={tokens.colors.statusError} />
              </View>
              <Text style={styles.emptyTitle}>All Variants Out of Stock</Text>
              <Text style={styles.emptySubtitle}>
                None of the {variants.length} variant options for this product currently have stock on hand.
              </Text>
            </View>
          ) : (
            <FlatList
              data={variants}
              keyExtractor={item => item.id}
              renderItem={renderVariantItem}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
            />
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-confirm-add-variants"
              style={[
                styles.confirmAddBtn,
                totalUnits === 0 && styles.confirmAddBtnDisabled,
              ]}
              onPress={handleConfirmAdd}
              disabled={totalUnits === 0}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Add ${totalUnits} items to cart`}
            >
              <Ionicons name="cart-outline" size={18} color={tokens.colors.onPrimary} />
              <Text style={styles.confirmAddBtnText}>
                {totalUnits > 0
                  ? `Add ${totalUnits} ${totalUnits === 1 ? 'Unit' : 'Units'} ($${totalPrice.toFixed(2)})`
                  : 'Select Variants'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 22, 0.65)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '85%',
    ...tokens.shadows.actionSheet,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.borderSubtle,
    alignSelf: 'center',
    marginTop: tokens.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: tokens.spacing.sm,
  },
  masterBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs + 2,
    marginBottom: 4,
  },
  masterTag: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  masterTagText: {
    color: tokens.colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  variantCountTag: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  productTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  productSubtitle: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: 2,
  },
  closeHeaderBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  listContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    minHeight: 76,
    ...tokens.shadows.cardInnerDepth,
  },
  variantCardDisabled: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderColor: tokens.colors.borderSubtle,
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  variantLeft: {
    flex: 1,
    marginRight: tokens.spacing.md,
  },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  variantSku: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  barcodeBadge: {
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tokens.borderRadius.xs,
  },
  barcodeText: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: tokens.spacing.xs,
  },
  attributeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
  },
  attributeChipDisabled: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderColor: tokens.colors.borderSubtle,
  },
  chipAttrKey: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  chipAttrVal: {
    color: tokens.colors.onBackground,
    fontSize: 11,
    fontWeight: '700',
  },
  defaultVariantText: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: 2,
  },
  stockBadgeRow: {
    marginTop: tokens.spacing.xs + 2,
    flexDirection: 'row',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xs + 4,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  stockBadgeInStock: {
    backgroundColor: tokens.colors.badgeSuccessBg,
  },
  stockBadgeLow: {
    backgroundColor: tokens.colors.errorContainer,
  },
  stockBadgeOos: {
    backgroundColor: tokens.colors.errorContainer,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stockDotInStock: {
    backgroundColor: tokens.colors.statusSuccess,
  },
  stockDotLow: {
    backgroundColor: tokens.colors.statusError,
  },
  stockDotOos: {
    backgroundColor: tokens.colors.statusError,
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockBadgeTextInStock: {
    color: tokens.colors.statusSuccess,
  },
  stockBadgeTextLow: {
    color: tokens.colors.statusError,
  },
  stockBadgeTextOos: {
    color: tokens.colors.statusError,
  },
  variantRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  variantPrice: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.numericMedium.fontSize,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: tokens.spacing.xs,
  },
  selectButton: {
    minHeight: 38,
    minWidth: 76,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.shadows.card,
  },
  selectButtonDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  selectButtonText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  selectButtonTextDisabled: {
    color: tokens.colors.surfaceBase,
  },
  textDisabled: {
    color: tokens.colors.textDisabled,
  },
  emptyContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.errorContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  emptyTitle: {
    color: tokens.colors.statusError,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  emptySubtitle: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.body.fontSize,
    textAlign: 'center',
    lineHeight: 20,
  },
  variantCardSelected: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryFixedDim,
    borderWidth: 1,
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    paddingHorizontal: 3,
    paddingVertical: 2,
    gap: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperQtyText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    minWidth: 28,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 4,
    includeFontPadding: false,
  },
  oosBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oosBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.statusError,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: tokens.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  cancelButton: {
    flex: 1,
    height: tokens.touchTarget.actionButtonHeight,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  confirmAddBtn: {
    flex: 2,
    height: tokens.touchTarget.actionButtonHeight,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: tokens.spacing.md,
    ...tokens.shadows.card,
  },
  confirmAddBtnDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    opacity: 0.6,
    elevation: 0,
    shadowOpacity: 0,
  },
  confirmAddBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
})

