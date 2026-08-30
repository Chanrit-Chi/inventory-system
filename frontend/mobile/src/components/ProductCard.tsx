import React from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { Product } from '../types'

export interface ProductCardProps {
  product: Product
  cartQuantity?: number
  mode?: 'sales' | 'management'
  onAddToCart?: (product: Product) => void
  onIncrease?: (product: Product) => void
  onDecrease?: (product: Product) => void
  onSetQuantity?: (product: Product, quantity: number) => void
  onPress?: (product: Product) => void
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({
  product,
  cartQuantity = 0,
  mode = 'sales',
  onAddToCart,
  onIncrease,
  onDecrease,
  onSetQuantity,
  onPress,
}) => {
  const price =
    typeof product.selling_price === 'number'
      ? product.selling_price
      : parseFloat(String(product.selling_price || '0')) || 0

  const totalStock =
    product.variants && product.variants.length > 0
      ? product.variants.reduce((sum, v) => sum + (v.quantity_on_hand ?? 0), 0)
      : (product as { quantity_on_hand?: number }).quantity_on_hand ?? 0

  const reorderLevel = product.default_reorder_level ?? 5
  const isOutOfStock = totalStock <= 0
  const isLowStock = totalStock > 0 && totalStock <= reorderLevel
  const isInCart = cartQuantity > 0
  const isVariable =
    Boolean(product.variants && product.variants.length > 1) ||
    Boolean(
      product.variants?.[0]?.attribute_values &&
        product.variants[0].attribute_values.length > 0
    )

  const categoryName = product.category?.name || 'General'

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    const cat = category.toLowerCase()
    if (cat.includes('apparel') || cat.includes('cloth') || cat.includes('shirt')) return 'shirt-outline'
    if (cat.includes('footwear') || cat.includes('shoe')) return 'footsteps-outline'
    if (cat.includes('headwear') || cat.includes('hat') || cat.includes('cap')) return 'glasses-outline'
    if (cat.includes('bag') || cat.includes('backpack')) return 'briefcase-outline'
    if (cat.includes('accessory') || cat.includes('watch')) return 'watch-outline'
    return 'cube-outline'
  }

  const handleCardPress = () => {
    if (onPress) {
      onPress(product)
    } else if (onAddToCart) {
      if (isOutOfStock) return
      onAddToCart(product)
    }
  }

  return (
    <TouchableOpacity
      testID={`product-card-${product.id}`}
      style={[styles.card, isInCart && styles.cardActive]}
      onPress={handleCardPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, price: $${price.toFixed(2)}, stock: ${totalStock}`}
    >
      {/* === THUMBNAIL === */}
      <View style={styles.thumbnailContainer}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.thumbnailImage}
            contentFit="cover"
            recyclingKey={product.id}
            transition={150}
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons
              name={getCategoryIcon(categoryName)}
              size={32}
              color={tokens.colors.primary}
            />
          </View>
        )}

        {/* In-Cart Badge — top-right overlay */}
        {Boolean(isInCart) && (
          <View style={styles.inCartBadge}>
            <Ionicons name="checkmark" size={10} color={tokens.colors.onPrimary} />
          </View>
        )}

        {/* Type Badge — bottom-left overlay on thumbnail */}
        <View style={[styles.typeBadgeOverlay, isVariable ? styles.typeBadgeVariable : styles.typeBadgeSingle]}>
          <Ionicons
            name={isVariable ? 'copy-outline' : 'cube-outline'}
            size={8}
            color={isVariable ? '#7C3AED' : tokens.colors.secondary}
          />
          <Text style={[styles.typeText, isVariable ? styles.typeTextVariable : styles.typeTextSingle]}>
            {isVariable ? 'Variable' : 'Single'}
          </Text>
        </View>
      </View>

      {/* === BODY === */}
      <View style={styles.body}>
        {/* Product Title */}
        <Text style={styles.productTitle} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Category + Stock row */}
        <View style={styles.metaRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {categoryName}
            </Text>
          </View>

          <View style={[
            styles.stockDotBadge,
            isOutOfStock ? styles.stockDotOos : isLowStock ? styles.stockDotLow : styles.stockDotOk,
          ]}>
            <View style={[
              styles.dot,
              isOutOfStock ? styles.dotOos : isLowStock ? styles.dotLow : styles.dotOk,
            ]} />
            <Text style={[
              styles.stockLabel,
              isOutOfStock ? styles.stockLabelOos : isLowStock ? styles.stockLabelLow : styles.stockLabelOk,
            ]} numberOfLines={1}>
              {isOutOfStock ? '0 Stock' : isLowStock ? `${totalStock} low` : `${totalStock}`}
            </Text>
          </View>
        </View>

        {/* Price + Action Row */}
        <View style={styles.bottomRow}>
          <Text style={styles.priceText}>
            ${price.toFixed(2)}
          </Text>

          {mode === 'management' ? (
            <TouchableOpacity
              testID={`btn-manage-stock-${product.id}`}
              style={styles.manageBtn}
              onPress={() => onPress?.(product)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Adjust stock for ${product.name}`}
            >
              <Ionicons name="create-outline" size={13} color={tokens.colors.primaryContainer} />
            </TouchableOpacity>
          ) : !isInCart ? (
            <TouchableOpacity
              testID={`btn-add-product-${product.id}`}
              style={[styles.addBtn, isOutOfStock && !isVariable && styles.addBtnDisabled]}
              onPress={() => {
                if (onPress) {
                  onPress(product)
                } else {
                  onAddToCart?.(product)
                }
              }}
              disabled={isOutOfStock && !isVariable}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Add ${product.name} to cart`}
            >
              <Ionicons
                name={isVariable ? 'options-outline' : 'add'}
                size={18}
                color={isOutOfStock && !isVariable ? tokens.colors.textDisabled : tokens.colors.primaryContainer}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.stepperPill}>
              <TouchableOpacity
                testID={`btn-dec-product-${product.id}`}
                style={styles.stepperBtn}
                onPress={() => onDecrease?.(product)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Decrease quantity for ${product.name}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}
              >
                <Ionicons name="remove" size={14} color={tokens.colors.onPrimary} />
              </TouchableOpacity>

              <TextInput
                style={styles.stepperCount}
                keyboardType="numeric"
                value={String(cartQuantity)}
                onChangeText={(txt) => {
                  const clean = txt.replace(/[^0-9]/g, '')
                  const num = parseInt(clean, 10)
                  if (onSetQuantity) {
                    onSetQuantity(product, isNaN(num) ? 0 : Math.min(num, totalStock))
                  }
                }}
                selectTextOnFocus
              />

              <TouchableOpacity
                testID={`btn-inc-product-${product.id}`}
                style={[
                  styles.stepperBtn,
                  (isOutOfStock || cartQuantity >= totalStock) && styles.stepperBtnDisabled,
                ]}
                onPress={() => onIncrease?.(product)}
                disabled={isOutOfStock || cartQuantity >= totalStock}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Increase quantity for ${product.name}`}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
              >
                <Ionicons
                  name="add"
                  size={14}
                  color={
                    isOutOfStock || cartQuantity >= totalStock
                      ? 'rgba(255, 255, 255, 0.35)'
                      : tokens.colors.onPrimary
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    flex: 1,
    maxWidth: '48.5%',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    overflow: 'hidden',
    marginBottom: tokens.spacing.md,
    ...tokens.shadows.cardInnerDepth,
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: tokens.colors.primaryFixedDim,
  },

  // ── Thumbnail ──────────────────────────────────────────
  thumbnailContainer: {
    width: '100%',
    height: 100,
    backgroundColor: tokens.colors.surfaceContainerLow,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
  },

  // ── Overlays on thumbnail ──────────────────────────────
  inCartBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.shadows.card,
  },
  typeBadgeOverlay: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 3,
  },
  typeBadgeVariable: {
    backgroundColor: 'rgba(237, 233, 254, 0.92)',
  },
  typeBadgeSingle: {
    backgroundColor: 'rgba(242, 236, 225, 0.92)',
  },
  typeText: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  typeTextVariable: {
    color: '#7C3AED',
  },
  typeTextSingle: {
    color: tokens.colors.secondary,
  },

  // ── Body ──────────────────────────────────────────────
  body: {
    padding: tokens.spacing.sm,
    paddingTop: 7,
    gap: 5,
  },
  productTitle: {
    color: tokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },

  // ── Meta row: category + stock ─────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryBadge: {
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
    flexShrink: 1,
  },
  categoryText: {
    color: tokens.colors.secondary,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  stockDotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
    gap: 3,
    flexShrink: 0,
  },
  stockDotOk: { backgroundColor: tokens.colors.badgeSuccessBg },
  stockDotLow: { backgroundColor: tokens.colors.errorContainer },
  stockDotOos: { backgroundColor: tokens.colors.errorContainer },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotOk: { backgroundColor: tokens.colors.statusSuccess },
  dotLow: { backgroundColor: tokens.colors.statusError },
  dotOos: { backgroundColor: tokens.colors.statusError },
  stockLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  stockLabelOk: { color: tokens.colors.statusSuccess },
  stockLabelLow: { color: tokens.colors.statusError },
  stockLabelOos: { color: tokens.colors.statusError },

  // ── Bottom row: price + action ─────────────────────────
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.priceDisplay.fontSize,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.actionPrimaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  addBtnDisabled: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderColor: tokens.colors.borderSubtle,
    opacity: 0.5,
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 3,
    height: 30,
    gap: 2,
    ...tokens.shadows.card,
  },
  stepperBtn: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperCount: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 20,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 2,
    includeFontPadding: false,
  },
  manageBtn: {
    width: 30,
    height: 30,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.actionPrimaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
})
