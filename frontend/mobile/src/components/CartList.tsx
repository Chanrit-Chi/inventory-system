import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { CartItemRow } from './CartItemRow'
import { tokens } from '../theme/tokens'
import type { CartItem } from '../types'

interface CartListProps {
  cart: CartItem[]
  stockWarnings: Record<string, string>
  onIncrease: (variantId: string) => void
  onDecrease: (variantId: string) => void
  onRemove: (variantId: string) => void
  onSetQuantity?: (variantId: string, quantity: number) => void
  onClearCart: () => void
}

export const CartList: React.FC<CartListProps> = ({
  cart,
  stockWarnings,
  onIncrease,
  onDecrease,
  onRemove,
  onSetQuantity,
  onClearCart,
}) => {
  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from the cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: onClearCart,
        },
      ]
    )
  }

  const handleRemoveItem = (variantId: string, productName: string) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove "${productName}" from the cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(variantId),
        },
      ]
    )
  }

  const handleDecreaseItem = (variantId: string, productName: string, currentQty: number) => {
    if (currentQty <= 1) {
      handleRemoveItem(variantId, productName)
    } else {
      onDecrease(variantId)
    }
  }

  const handleSetQuantity = (variantId: string, productName: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveItem(variantId, productName)
    } else if (onSetQuantity) {
      onSetQuantity(variantId, qty)
    }
  }

  if (cart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="cart-outline" size={40} color={tokens.colors.primaryContainer} />
        </View>
        <Text style={styles.emptyTitle}>Cart is empty</Text>
        <Text style={styles.emptySubtitle}>
          Tap items in the catalog or use the barcode scanner to add products to the cart.
        </Text>
        <View style={styles.emptyHintBadge}>
          <Ionicons name="flash-outline" size={14} color={tokens.colors.primaryContainer} />
          <Text style={styles.emptyHintText}>Rapid Barcode Scan Ready</Text>
        </View>
      </View>
    )
  }

  const distinctCount = cart.length
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <View style={styles.container}>
      {/* Cart Summary Header */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryBadge}>
          <Ionicons name="cube-outline" size={14} color={tokens.colors.primary} />
          <Text style={styles.summaryText}>
            {distinctCount} {distinctCount === 1 ? 'item' : 'items'}
            <Text style={styles.summaryDivider}> • </Text>
            {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
          </Text>
        </View>

        <TouchableOpacity
          testID="btn-clear-cart"
          style={styles.clearBtn}
          onPress={handleClearCart}
          accessibilityRole="button"
          accessibilityLabel="Clear all items in cart"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={14} color={tokens.colors.actionDestructive} />
          <Text style={styles.clearBtnText}>Clear Cart</Text>
        </TouchableOpacity>
      </View>

      {/* Cart List */}
      <FlatList
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        data={cart}
        keyExtractor={(item) => String(item.variantId)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            warning={stockWarnings[item.variantId]}
            onIncrease={onIncrease}
            onDecrease={() => handleDecreaseItem(item.variantId, item.productName, item.quantity)}
            onRemove={() => handleRemoveItem(item.variantId, item.productName)}
            onSetQuantity={(id, qty) => handleSetQuantity(id, item.productName, qty)}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
    backgroundColor: 'transparent',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  summaryText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryDivider: {
    color: tokens.colors.textDisabled,
  },
  clearBtn: {
    minHeight: tokens.touchTarget.minHeight,
    minWidth: tokens.touchTarget.minWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.sm,
    gap: 4,
  },
  clearBtnText: {
    color: tokens.colors.actionDestructive,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.actionPrimaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    ...tokens.shadows.card,
  },
  emptyTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
  },
  emptySubtitle: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.body.fontSize,
    textAlign: 'center',
    lineHeight: tokens.typography.body.lineHeight,
    maxWidth: 290,
    marginBottom: tokens.spacing.md,
  },
  emptyHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  emptyHintText: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
})
