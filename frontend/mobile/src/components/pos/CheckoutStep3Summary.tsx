import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../theme/tokens'
import { round2 } from '../../utils/money'
import { CopyableBadge } from '../CopyableBadge'
import type { CartItem, SalesChannel, DeliveryZone, BankAccount } from '../../types'

export interface CheckoutStep3SummaryProps {
  cart: CartItem[]
  cartTotal: number
  totalItemCount: number
  discountType: 'flat' | 'percentage'
  discountInput?: string
  taxType: 'flat' | 'percentage'
  taxInput?: string
  taxRate?: string
  isDelivery: boolean
  selectedDeliveryZone: DeliveryZone | null
  customDeliveryFee?: string
  channels: SalesChannel[]
  activeChannel: SalesChannel | null
  channelId?: string
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
  activePaymentMethod: string
  selectedBank: BankAccount | null
  orderStatus: 'paid' | 'pending'
  onSetOrderStatus: (status: 'paid' | 'pending') => void
}

export function CheckoutStep3Summary({
  cart,
  cartTotal,
  totalItemCount,
  discountType,
  discountInput,
  taxType,
  taxInput,
  taxRate,
  isDelivery,
  selectedDeliveryZone,
  customDeliveryFee,
  channels,
  activeChannel,
  channelId,
  customerName,
  customerPhone,
  deliveryAddress,
  activePaymentMethod,
  selectedBank,
  orderStatus,
  onSetOrderStatus,
}: CheckoutStep3SummaryProps) {
  const summaryParsedDiscount = parseFloat(discountInput || '0') || 0
  const summaryDiscountAmount = round2(
    discountType === 'percentage'
      ? cartTotal * (summaryParsedDiscount / 100)
      : summaryParsedDiscount
  )

  const summaryParsedTax = parseFloat(taxInput || taxRate || '0') || 0
  const summaryTaxAmount = round2(
    taxType === 'percentage'
      ? cartTotal * (summaryParsedTax / 100)
      : summaryParsedTax
  )

  const summaryDeliveryCost = (() => {
    if (!isDelivery || !selectedDeliveryZone) return 0
    if (selectedDeliveryZone.id === 'custom') {
      const customFee = parseFloat(String(customDeliveryFee || '0')) || 0
      return round2(customFee)
    }
    return selectedDeliveryZone.cost
  })()

  const summaryGrandTotal = round2(
    Math.max(0, cartTotal - summaryDiscountAmount + summaryDeliveryCost + summaryTaxAmount)
  )

  const channelName =
    channels.find((c) => c.id === channelId)?.name ||
    activeChannel?.name ||
    'Main POS'

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 24 }}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Order Summary</Text>

        {/* Items Purchased List */}
        <Text style={styles.summarySectionHeading}>
          Items Purchased ({totalItemCount})
        </Text>
        <View style={styles.summaryItemsList}>
          {cart.map((item) => {
            const unitPrice = parseFloat(String(item.unitPrice || '0')) || 0
            const lineTotal = unitPrice * item.quantity
            return (
              <View key={item.variantId} style={styles.summaryItemRow}>
                <View style={styles.summaryItemLeft}>
                  <View style={styles.summaryItemQtyBadge}>
                    <Text style={styles.summaryItemQtyText}>{item.quantity}x</Text>
                  </View>
                  <View style={styles.summaryItemInfo}>
                    <Text style={styles.summaryItemName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {Boolean(item.attributesSummary) && (
                        <Text style={styles.summaryItemVariant} numberOfLines={1}>
                          {item.attributesSummary}
                        </Text>
                      )}
                      {Boolean(item.sku) && (
                        <CopyableBadge
                          type="sku"
                          value={item.sku}
                          compact
                        />
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.summaryItemRight}>
                  <Text style={styles.summaryItemLineTotal}>
                    ${lineTotal.toFixed(2)}
                  </Text>
                  <Text style={styles.summaryItemUnitRate}>
                    ${unitPrice.toFixed(2)} ea
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal ({totalItemCount} items)</Text>
          <Text style={styles.summaryValue}>${cartTotal.toFixed(2)}</Text>
        </View>

        {isDelivery && selectedDeliveryZone ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Delivery ({selectedDeliveryZone.name})
            </Text>
            <Text style={styles.summaryValue}>
              ${summaryDeliveryCost.toFixed(2)}
            </Text>
          </View>
        ) : null}

        {summaryDiscountAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Global Discount (
              {discountType === 'percentage'
                ? `${summaryParsedDiscount}%`
                : `$${summaryParsedDiscount.toFixed(2)}`}
              )
            </Text>
            <Text
              style={[styles.summaryValue, { color: tokens.colors.statusError }]}
            >
              -${summaryDiscountAmount.toFixed(2)}
            </Text>
          </View>
        )}

        {summaryTaxAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Tax (
              {taxType === 'percentage'
                ? `${summaryParsedTax}%`
                : `$${summaryParsedTax.toFixed(2)}`}
              )
            </Text>
            <Text
              style={[styles.summaryValue, { color: tokens.colors.primary }]}
            >
              +${summaryTaxAmount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sales Channel</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: tokens.colors.primary, fontWeight: '700' },
            ]}
          >
            {channelName}
          </Text>
        </View>

        {Boolean((customerName || customerPhone)) && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customer</Text>
            <Text
              style={[styles.summaryValue, { fontWeight: '600' }]}
              numberOfLines={1}
            >
              {customerName ? customerName : ''}
              {customerPhone ? ` (${customerPhone})` : ''}
            </Text>
          </View>
        )}

        {isDelivery && deliveryAddress ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Address</Text>
            <Text
              style={[styles.summaryValue, { maxWidth: 180 }]}
              numberOfLines={2}
            >
              {deliveryAddress}
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Payment Method</Text>
          <Text style={styles.summaryValue}>
            {activePaymentMethod === 'Bank'
              ? `${selectedBank?.bankName || 'Bank'} Transfer`
              : 'Cash'}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        {/* Order Status Option */}
        <View style={{ marginVertical: 6 }}>
          <Text
            style={[styles.summaryLabel, { marginBottom: 8, fontWeight: '700' }]}
          >
            Order Status
          </Text>
          <View style={styles.typeToggleContainer}>
            <TouchableOpacity
              style={[
                styles.typeToggleBtn,
                orderStatus === 'paid' && {
                  backgroundColor: '#16A34A',
                  borderColor: '#16A34A',
                },
              ]}
              onPress={() => onSetOrderStatus('paid')}
              activeOpacity={0.8}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={orderStatus === 'paid' ? '#FFFFFF' : '#16A34A'}
                />
                <Text
                  style={[
                    styles.typeToggleText,
                    orderStatus === 'paid' && {
                      color: '#FFFFFF',
                      fontWeight: '700',
                    },
                  ]}
                >
                  Paid (Complete)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeToggleBtn,
                orderStatus === 'pending' && {
                  backgroundColor: '#D97706',
                  borderColor: '#D97706',
                },
              ]}
              onPress={() => onSetOrderStatus('pending')}
              activeOpacity={0.8}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons
                  name="time"
                  size={15}
                  color={orderStatus === 'pending' ? '#FFFFFF' : '#D97706'}
                />
                <Text
                  style={[
                    styles.typeToggleText,
                    orderStatus === 'pending' && {
                      color: '#FFFFFF',
                      fontWeight: '700',
                    },
                  ]}
                >
                  Pending (Pay Later)
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={[styles.summaryRow, { marginTop: 8 }]}>
          <Text style={styles.summaryTotalLabel}>Grand Total</Text>
          <Text style={styles.summaryTotalValue}>
            ${summaryGrandTotal.toFixed(2)}
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginBottom: tokens.spacing.md,
  },
  summarySectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryItemsList: {
    gap: 8,
    marginBottom: 8,
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 8,
  },
  summaryItemQtyBadge: {
    backgroundColor: `${tokens.colors.primary}18`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  summaryItemQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  summaryItemVariant: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  summaryItemRight: {
    alignItems: 'flex-end',
  },
  summaryItemLineTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  summaryItemUnitRate: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.outline,
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 13,
    color: tokens.colors.secondary,
  },
  summaryValue: {
    fontSize: 13,
    color: tokens.colors.onBackground,
    fontWeight: '500',
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.primary,
  },
  typeToggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
})
