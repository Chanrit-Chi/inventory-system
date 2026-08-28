import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { PaymentMethod } from '../types'

interface PaymentActionBarProps {
  totalAmount: number
  itemCount: number
  channelName?: string
  isSubmitting: boolean
  activePaymentMethod: PaymentMethod | null
  disabled?: boolean
  onSelectPayment: (method: PaymentMethod) => void
}

export const PaymentActionBar: React.FC<PaymentActionBarProps> = ({
  totalAmount,
  itemCount,
  channelName,
  isSubmitting,
  activePaymentMethod,
  disabled = false,
  onSelectPayment,
}) => {
  const isPayDisabled = disabled || itemCount === 0 || isSubmitting

  return (
    <View style={styles.container}>
      {/* Top row: Channel & Item count pill, and Total Due */}
      <View style={styles.summaryRow}>
        <View style={styles.channelBadge}>
          <Ionicons name="storefront-outline" size={14} color={tokens.colors.primary} />
          <Text style={styles.channelNameText} numberOfLines={1}>
            {channelName || 'Store POS'}
          </Text>
          <Text style={styles.itemCountText}>
            ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </Text>
        </View>

        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>Total Due</Text>
          <Text style={styles.totalAmountText}>
            ${totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Payment Action Buttons Row (Cash & Bank) */}
      <View style={styles.buttonRow}>
        {/* Cash Payment Button */}
        <TouchableOpacity
          testID="btn-pay-cash"
          style={[
            styles.payButton,
            styles.btnCash,
            isPayDisabled && styles.payButtonDisabled,
          ]}
          onPress={() => onSelectPayment('Cash')}
          disabled={isPayDisabled}
          accessibilityRole="button"
          accessibilityLabel={`Pay $${totalAmount.toFixed(2)} with Cash`}
          activeOpacity={0.8}
        >
          {isSubmitting && activePaymentMethod === 'Cash' ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="cash-outline" size={22} color={tokens.colors.onPrimary} />
              <View style={styles.btnTextCol}>
                <Text style={styles.btnText}>Cash</Text>
                <Text style={styles.btnSubtext}>Instant Cashier</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Bank Payment Button (ABA, Acleda, Wing, Canadia...) */}
        <TouchableOpacity
          testID="btn-pay-bank"
          style={[
            styles.payButton,
            styles.btnBank,
            isPayDisabled && styles.payButtonDisabled,
          ]}
          onPress={() => onSelectPayment('Bank')}
          disabled={isPayDisabled}
          accessibilityRole="button"
          accessibilityLabel={`Pay $${totalAmount.toFixed(2)} with Bank (ABA, Acleda, Wing)`}
          activeOpacity={0.8}
        >
          {isSubmitting && activePaymentMethod === 'Bank' ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="business-outline" size={22} color={tokens.colors.onPrimary} />
              <View style={styles.btnTextCol}>
                <Text style={styles.btnText}>Bank</Text>
                <Text style={styles.btnSubtext}>ABA, Acleda, Wing...</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm + 2,
    paddingBottom: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    ...tokens.shadows.actionSheet,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs + 1,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    maxWidth: '55%',
    gap: 4,
  },
  channelNameText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
  },
  itemCountText: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  totalBlock: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.captionSmall.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  totalAmountText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.numericLarge.fontSize,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  payButton: {
    flex: 1,
    height: tokens.touchTarget.actionButtonHeight,
    borderRadius: tokens.borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xs,
    ...tokens.shadows.card,
  },
  payButtonDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  btnCash: {
    backgroundColor: tokens.colors.accentCash,
  },
  btnAba: {
    backgroundColor: tokens.colors.accentAba,
  },
  btnBank: {
    backgroundColor: tokens.colors.accentBank,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnTextCol: {
    alignItems: 'flex-start',
  },
  btnText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
    lineHeight: 16,
  },
  btnSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
})
