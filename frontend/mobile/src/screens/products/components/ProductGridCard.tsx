import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { tokens } from '../../../theme/tokens'
import type { Product } from '../../../types'

interface ProductGridCardProps {
  product: Product
  onPress: (prod: Product) => void
  onQuickScanBarcode?: (prod: Product) => void
}

export const ProductGridCard = React.memo(({ product, onPress, onQuickScanBarcode }: ProductGridCardProps) => {
  const isVariable =
    (product.variants && product.variants.length > 1) ||
    (product.variants?.[0]?.attribute_values && product.variants[0].attribute_values.length > 0)

  const totalStock =
    product.variants?.reduce((sum, v) => sum + (Number(v.quantity_on_hand) || 0), 0) || 0
  const reorderLevel = product.default_reorder_level || 10
  const isOutOfStock = totalStock <= 0
  const isLowStock = !isOutOfStock && totalStock <= reorderLevel

  const totalVariants = product.variants?.length || 0
  const missingVarBarcodes = isVariable
    ? product.variants?.filter((v) => !v.barcode).length || 0
    : 0
  const simpleBarcode = product.barcode || (!isVariable ? product.variants?.[0]?.barcode : null)
  const hasSimpleBarcode = !isVariable && !!simpleBarcode
  const needsBarcode = isVariable ? missingVarBarcodes > 0 : !hasSimpleBarcode

  const sellPriceNum = Number(product.selling_price)
  const displayPrice = isNaN(sellPriceNum) ? '0.00' : sellPriceNum.toFixed(2)

  return (
    <TouchableOpacity
      style={gridStyles.card}
      onPress={() => onPress(product)}
      activeOpacity={0.8}
    >
      {/* ── Top Image Container ────────────────────────────────────────── */}
      <View style={gridStyles.imageBox}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={gridStyles.image}
            contentFit="cover"
            recyclingKey={product.id}
            transition={150}
          />
        ) : (
          <View style={[gridStyles.iconPlaceholder, !isVariable && { backgroundColor: '#E0F2FE' }]}>
            <Ionicons
              name={isVariable ? 'shirt-outline' : 'cube-outline'}
              size={36}
              color={isVariable ? tokens.colors.primaryContainer : '#0284C7'}
            />
          </View>
        )}

        {/* Floating Stock Badge */}
        <View
          style={[
            gridStyles.floatingStockBadge,
            product.is_active === false
              ? gridStyles.stockBadgeInactive
              : isOutOfStock
              ? gridStyles.stockBadgeOut
              : isLowStock
              ? gridStyles.stockBadgeLow
              : gridStyles.stockBadgeOk,
          ]}
        >
          <Text
            style={[
              gridStyles.floatingStockText,
              product.is_active === false
                ? gridStyles.stockTextInactive
                : isOutOfStock
                ? gridStyles.stockTextOut
                : isLowStock
                ? gridStyles.stockTextLow
                : gridStyles.stockTextOk,
            ]}
          >
            {product.is_active === false ? 'Inactive' : isOutOfStock ? '0 Stock' : isLowStock ? `${totalStock} Low` : `${totalStock}`}
          </Text>
        </View>

        {/* Floating Type Pill */}
        <View style={gridStyles.floatingTypePill}>
          <Text style={gridStyles.floatingTypeText}>
            {isVariable ? `${totalVariants} Vars` : 'Simple'}
          </Text>
        </View>
      </View>

      {/* ── Card Content Body ──────────────────────────────────────────── */}
      <View style={gridStyles.body}>
        <Text style={gridStyles.category} numberOfLines={1}>
          {product.category?.name || 'General'}
        </Text>

        <Text style={gridStyles.title} numberOfLines={2}>
          {product.name || 'Product'}
        </Text>

        {/* Price & Quick Scan Row */}
        <View style={gridStyles.bottomRow}>
          <Text style={gridStyles.price}>${displayPrice}</Text>

          {Boolean(needsBarcode) ? (
            <TouchableOpacity
              style={gridStyles.quickBarcodeBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                onQuickScanBarcode?.(product)
              }}
              activeOpacity={0.75}
              accessibilityLabel="Scan barcode"
            >
              <Ionicons name="barcode-outline" size={14} color="#D97706" />
            </TouchableOpacity>
          ) : (
            <View style={gridStyles.barcodeAssignedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
})

const gridStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    margin: 4,
    ...tokens.shadows.card,
  },
  imageBox: {
    width: '100%',
    height: 115,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  iconPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingStockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  stockBadgeOk: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  stockBadgeLow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  stockBadgeOut: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  stockBadgeInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  floatingStockText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  stockTextOk: {
    color: '#15803D',
  },
  stockTextLow: {
    color: '#B45309',
  },
  stockTextOut: {
    color: '#DC2626',
  },
  stockTextInactive: {
    color: '#64748B',
  },
  floatingTypePill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  floatingTypeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    padding: 9,
  },
  category: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
    lineHeight: 16,
    minHeight: 32,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 14,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
  },
  quickBarcodeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeAssignedBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
