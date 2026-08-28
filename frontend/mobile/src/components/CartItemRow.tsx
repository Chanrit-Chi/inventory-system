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
import { CopyableBadge } from './CopyableBadge'
import type { CartItem } from '../types'

interface CartItemRowProps {
  item: CartItem
  warning?: string
  onIncrease: (variantId: string) => void
  onDecrease: (variantId: string) => void
  onRemove: (variantId: string) => void
  onSetQuantity?: (variantId: string, quantity: number) => void
}

export const CartItemRow: React.FC<CartItemRowProps> = React.memo(({
  item,
  warning,
  onIncrease,
  onDecrease,
  onRemove,
  onSetQuantity,
}) => {
  const lineTotal = item.quantity * item.unitPrice
  const hasWarning = Boolean(warning)
  const isAtMaxStock = item.availableStock <= 0 || item.quantity >= item.availableStock

  return (
    <View style={[styles.card, hasWarning && styles.cardWarning]}>
      <View style={styles.mainRow}>
        {/* Left: Image */}
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.productImage}
              contentFit="cover"
              recyclingKey={item.variantId}
              transition={150}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cube-outline" size={24} color={tokens.colors.secondary} />
            </View>
          )}
        </View>

        {/* Middle: Info */}
        <View style={styles.infoCol}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productName}
          </Text>
          {Boolean(item.sku) && (
            <View style={{ marginVertical: 2 }}>
              <CopyableBadge
                type="sku"
                value={item.sku}
                compact
              />
            </View>
          )}
          {item.attributesSummary ? (
            <View style={styles.attrTag}>
              <Text style={styles.attrText} numberOfLines={1}>
                {item.attributesSummary}
              </Text>
            </View>
          ) : null}
          <Text style={styles.unitPriceText}>
            ${item.unitPrice.toFixed(2)} / ea
          </Text>
        </View>

        {/* Right: Price & Stepper */}
        <View style={styles.rightCol}>
          <TouchableOpacity
            style={styles.removeBtnTop}
            onPress={() => onRemove(item.variantId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.productName} from cart`}
          >
            <Ionicons name="close" size={20} color={tokens.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.priceActionWrapper}>
            <Text style={styles.lineTotalText}>
              ${lineTotal.toFixed(2)}
            </Text>
            
            <View style={styles.stepperContainerCompact}>
              <TouchableOpacity
                testID={`btn-dec-${item.variantId}`}
                style={styles.stepperBtnCompact}
                onPress={() => onDecrease(item.variantId)}
                accessibilityRole="button"
                accessibilityLabel={`Decrease quantity for ${item.productName}`}
              >
                <Ionicons name="remove" size={14} color={tokens.colors.onBackground} />
              </TouchableOpacity>

              <View style={styles.quantityDisplayCompact}>
                <TextInput
                  style={styles.quantityNumberCompact}
                  keyboardType="numeric"
                  value={String(item.quantity)}
                  onChangeText={(txt) => {
                    const clean = txt.replace(/[^0-9]/g, '')
                    const num = parseInt(clean, 10)
                    if (onSetQuantity) {
                      onSetQuantity(item.variantId, isNaN(num) ? 0 : num)
                    }
                  }}
                  selectTextOnFocus
                />
              </View>

              <TouchableOpacity
                testID={`btn-inc-${item.variantId}`}
                style={[styles.stepperBtnCompact, isAtMaxStock && styles.stepperBtnDisabledCompact]}
                onPress={() => onIncrease(item.variantId)}
                disabled={isAtMaxStock}
                accessibilityRole="button"
                accessibilityLabel={`Increase quantity for ${item.productName}`}
              >
                <Ionicons
                  name="add"
                  size={14}
                  color={isAtMaxStock ? tokens.colors.textDisabled : tokens.colors.onBackground}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Stock warning banner */}
      {Boolean(hasWarning) && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={14} color={tokens.colors.statusWarning} />
          <Text style={styles.warningMessage}>{warning}</Text>
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    ...tokens.shadows.cardInnerDepth,
  },
  cardWarning: {
    borderColor: tokens.colors.statusWarning,
    backgroundColor: '#FFFDF5',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: tokens.spacing.sm,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.surfaceMuted,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 70,
  },
  removeBtnTop: {
    padding: 2,
  },
  priceActionWrapper: {
    alignItems: 'flex-end',
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  skuTag: {
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  skuText: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.captionSmall.fontSize,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  attrTag: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  attrText: {
    color: tokens.colors.primaryContainer,
    fontSize: tokens.typography.captionSmall.fontSize,
    fontWeight: '600',
  },
  priceCol: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  lineTotalText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.priceDisplay.fontSize,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unitPriceText: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.badgeWarningBg,
    borderRadius: tokens.borderRadius.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 4,
  },
  warningMessage: {
    color: tokens.colors.statusWarning,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    flex: 1,
  },
  stepperContainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.pill,
    padding: 2,
  },
  stepperBtnCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.shadows.card,
  },
  stepperBtnDisabledCompact: {
    backgroundColor: tokens.colors.surfaceMuted,
    elevation: 0,
    shadowOpacity: 0,
  },
  quantityDisplayCompact: {
    minWidth: 20,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quantityNumberCompact: {
    color: tokens.colors.onBackground,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 24,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
})
