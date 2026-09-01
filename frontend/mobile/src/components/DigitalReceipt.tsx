import React, { forwardRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { useBranding } from '../context/BrandingContext'
import { getChannelPlatformMeta } from './TransactionCard'
import type { Order } from '../types'
import ViewShot from 'react-native-view-shot'

export interface ReceiptItem {
  id: string
  name: string
  sku?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface ReceiptPayment {
  id: string
  method: string
  ref: string
  amount: number
  date: string
}

export interface ReceiptBankAccount {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
}

export interface DigitalReceiptProps {
  documentType: 'Receipt' | 'Invoice' | 'Quotation'
  documentNumber: string
  referenceNumber?: string | null
  dueDate?: string
  validUntil?: string
  discount?: number
  deliveryCost?: number
  deliveryCompany?: string
  deliveryAddress?: string
  
  storeName?: string
  receiptHeader?: string
  footerMessage?: string
  
  customerName: string
  customerPhone?: string | null
  
  items: ReceiptItem[]
  
  subtotal: number
  tax: number
  showTax?: boolean
  amountPaid: number
  balanceDue: number
  
  // Specific for Receipts: simple payment method text
  paymentMethod?: string
  orderDate?: string
  createdAt?: string
  channelName?: string
  channel?: Order['channel'] | null
  channelId?: string | null
  sellerName?: string
  cashierName?: string
  
  // Specific for Invoices: detailed payment history
  payments?: ReceiptPayment[]
}

export const DigitalReceipt = forwardRef<ViewShot, DigitalReceiptProps>((props, ref) => {
  const { branding } = useBranding()
  const {
    documentType,
    documentNumber,
    referenceNumber,
    dueDate,
    validUntil,
    discount,
    deliveryCost,
    deliveryCompany,
    deliveryAddress,
    storeName,
    receiptHeader,
    footerMessage,
    customerName,
    customerPhone,
    items,
    subtotal,
    tax,
    showTax,
    amountPaid,
    balanceDue,
    paymentMethod,
    orderDate,
    createdAt,
    channelName,
    channel,
    channelId,
    sellerName,
    cashierName,
    payments,
  } = props

  const isReceipt = documentType === 'Receipt'
  const isQuotation = documentType === 'Quotation'
  const isShowTax = showTax !== undefined ? showTax : !!branding.show_tax
  const channelMeta = isReceipt ? getChannelPlatformMeta(channel, channelId || channelName) : null

  const formattedDateTime = React.useMemo(() => {
    if (orderDate) return orderDate
    if (createdAt) {
      try {
        const d = new Date(createdAt)
        return d.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      } catch {
        return createdAt
      }
    }
    return new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }, [orderDate, createdAt])

  const getDocumentSubtitle = () => {
    if (receiptHeader) return receiptHeader
    if (isQuotation) {
      return branding.quotation_header || 'Official Price Estimate & Quotation'
    }
    if (isReceipt) {
      return branding.receipt_header || 'Official Digital Tax Receipt'
    }
    return branding.invoice_header || 'Official Tax Invoice'
  }

  const getDocumentNumberLabel = () => {
    if (isReceipt) return 'Sales Channel'
    if (isQuotation) return 'Quotation Number'
    return 'Invoice Number'
  }

  return (
    <ViewShot ref={ref} style={styles.receiptPaper}>
      {/* Brand Header */}
      <View style={styles.receiptBrandHeader}>
        <View style={styles.brandRow}>
          {branding.logo_url ? (
            <Image
              source={{ uri: branding.logo_url }}
              style={styles.brandLogoImg}
              contentFit="contain"
            />
          ) : (
            <Image
              source={require('../../assets/KC SHOP-No BG.png')}
              style={styles.brandLogoImg}
              contentFit="contain"
            />
          )}
          <Text style={styles.brandStoreName}>{storeName || branding.store_name || 'KC Shop'}</Text>
        </View>
        <Text style={styles.brandSubtitle}>{getDocumentSubtitle()}</Text>
        {Boolean(branding.store_address || branding.store_phone) && (
          <Text style={styles.brandContactText}>
            {[branding.store_address, branding.store_phone].filter(Boolean).join(' • ')}
          </Text>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{getDocumentNumberLabel()}</Text>
          {isReceipt ? (
            <View
              style={[
                styles.channelBadge,
                channelMeta?.bg ? { backgroundColor: channelMeta.bg } : null,
              ]}
            >
              <Ionicons
                name={channelMeta?.icon || 'storefront-outline'}
                size={12}
                color={channelMeta?.color || tokens.colors.primary}
              />
              <Text
                style={[
                  styles.channelBadgeText,
                  channelMeta?.color ? { color: channelMeta.color } : null,
                ]}
              >
                {channelName || channelMeta?.label || 'Store POS'}
              </Text>
            </View>
          ) : (
            <Text style={styles.infoValue}>{documentNumber}</Text>
          )}
        </View>

        {isReceipt ? (
          <>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Text style={styles.infoLabel}>Order Number</Text>
              <Text style={styles.infoValue}>{documentNumber}</Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Text style={styles.infoLabel}>Date & Time</Text>
              <Text style={styles.infoValue}>{formattedDateTime}</Text>
            </View>
          </>
        ) : isQuotation ? (
          <>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{formattedDateTime}</Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Text style={styles.infoLabel}>Valid Until</Text>
              <Text style={styles.infoValue}>{validUntil || dueDate || '14 Days'}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Text style={styles.infoLabel}>Invoice Date</Text>
              <Text style={styles.infoValue}>{formattedDateTime}</Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Text style={styles.infoLabel}>Due Date</Text>
              <Text style={styles.infoValue}>{dueDate}</Text>
            </View>
          </>
        )}

        {Boolean(referenceNumber) && (
          <View style={[styles.infoRow, { marginTop: 4 }]}>
            <Text style={styles.infoLabel}>Ref. Order</Text>
            <Text style={styles.infoValue}>{referenceNumber}</Text>
          </View>
        )}

        {Boolean(sellerName) && (
          <View style={[styles.infoRow, { marginTop: 4 }]}>
            <Text style={styles.infoLabel}>Sold By</Text>
            <Text style={styles.infoValue}>{sellerName}</Text>
          </View>
        )}

        {Boolean(cashierName && cashierName !== sellerName) && (
          <View style={[styles.infoRow, { marginTop: 4 }]}>
            <Text style={styles.infoLabel}>Cashier</Text>
            <Text style={styles.infoValue}>{cashierName}</Text>
          </View>
        )}
      </View>

      {/* Bill To Customer & Fulfillment */}
      <View style={styles.customerCard}>
        <Text style={styles.customerCardTitle}>{isQuotation ? 'PREPARED FOR' : 'BILL TO'}</Text>
        <Text style={styles.customerName}>{customerName}</Text>
        {customerPhone ? (
          <Text style={styles.customerPhone}>{customerPhone}</Text>
        ) : null}
        {Boolean(deliveryAddress || deliveryCompany) && (
          <View style={styles.deliveryInfoContainer}>
            <View style={styles.deliveryBadge}>
              <Ionicons name="bicycle-outline" size={11} color={tokens.colors.primary} />
              <Text style={styles.deliveryBadgeText}>{deliveryCompany || 'Delivery'}</Text>
            </View>
            {Boolean(deliveryAddress) && (
              <Text style={styles.deliveryAddressText} numberOfLines={2}>
                {deliveryAddress}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Dashed Line */}
      <View style={styles.tearLineContainer}>
        <View style={styles.dashedLine} />
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      {/* Items */}
      <View style={styles.tableSection}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableHeaderTitle}>ITEM DESCRIPTION</Text>
          <Text style={styles.tableHeaderSub}>TOTAL</Text>
        </View>
        
        <View style={styles.itemsTable}>
          {items.map((item, idx) => (
            <View key={item.id ? `${item.id}-${idx}` : `ii-${idx}`} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemSku} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.sku ? item.sku + ' • ' : ''}{item.quantity} × ${item.unitPrice.toFixed(2)}</Text>
              </View>
              <Text style={styles.itemLineTotal}>${item.totalPrice.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Dashed Line */}
      <View style={styles.tearLineContainer}>
        <View style={styles.dashedLine} />
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      {/* Financial Breakdown */}
      <View style={styles.totalBreakdown}>
        {Boolean(!isReceipt || (discount !== undefined && discount > 0) || (deliveryCost !== undefined && deliveryCost > 0) || tax > 0) && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Subtotal</Text>
            <Text style={styles.breakdownValue}>${subtotal.toFixed(2)}</Text>
          </View>
        )}

        {Boolean(discount !== undefined && discount > 0) && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Discount</Text>
            <Text style={[styles.breakdownValue, { color: tokens.colors.statusSuccess }]}>
              -${(discount ?? 0).toFixed(2)}
            </Text>
          </View>
        )}

        {Boolean(deliveryCost !== undefined && deliveryCost > 0) && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Delivery Fee{deliveryCompany ? ` (${deliveryCompany})` : ''}</Text>
            <Text style={styles.breakdownValue}>+${(deliveryCost ?? 0).toFixed(2)}</Text>
          </View>
        )}
        
        {Boolean(isShowTax || tax > 0) && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Tax</Text>
            <Text style={styles.breakdownValue}>${tax.toFixed(2)}</Text>
          </View>
        )}

        {Boolean(!isReceipt && !isQuotation) && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Amount Paid</Text>
            <Text style={[styles.breakdownValue, { color: tokens.colors.statusSuccess }]}>
              -${amountPaid.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Grand Total Box */}
        {isReceipt ? (
          <View style={styles.totalRowHighlight}>
            <View>
              <Text style={styles.totalGrandLabel}>Total Paid</Text>
              <Text style={styles.totalGrandSub}>Authorized via {paymentMethod || 'Cash'}</Text>
            </View>
            <Text style={styles.totalGrandValue}>${amountPaid.toFixed(2)}</Text>
          </View>
        ) : isQuotation ? (
          <View style={styles.totalRowHighlight}>
            <View>
              <Text style={styles.totalGrandLabel}>Total Quotation</Text>
              <Text style={styles.totalGrandSub}>Valid until {validUntil || dueDate || '14 Days'}</Text>
            </View>
            <Text style={styles.totalGrandValue}>${Math.max(0, subtotal - (discount || 0)).toFixed(2)}</Text>
          </View>
        ) : (
          <View style={styles.totalRowHighlight}>
            <View>
              <Text style={styles.totalGrandLabel}>Balance Due</Text>
            </View>
            <Text style={[styles.totalGrandValue, balanceDue > 0 ? { color: tokens.colors.statusError } : { color: tokens.colors.statusSuccess }]}>
              ${balanceDue.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Payment History (Invoices only) */}
      {Boolean(!isReceipt && payments && payments.length > 0) && (
        <View style={{ marginTop: 24 }}>
          <Text style={[styles.tableHeaderTitle, { marginBottom: 8 }]}>PAYMENT HISTORY</Text>
          {payments?.map((p, idx) => (
            <View key={p.id || `pay-${idx}`} style={styles.paymentRecordRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentMethodText}>{p.method}</Text>
                <Text style={styles.paymentRefText}>{p.ref}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.paymentAmountText}>+${p.amount.toFixed(2)}</Text>
                <Text style={styles.paymentDateText}>{p.date}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Footer Section */}
      <View style={styles.thankYouSection}>
        <Text style={styles.thankYouText}>
          {footerMessage ||
            (isReceipt
              ? branding.receipt_footer
              : isQuotation
              ? branding.quotation_footer || branding.receipt_footer
              : branding.invoice_footer || branding.receipt_footer) ||
            'Thank you for your business!'}
        </Text>
      </View>
    </ViewShot>
  )
})

DigitalReceipt.displayName = 'DigitalReceipt'

const styles = StyleSheet.create({
  receiptPaper: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.xl,
    padding: tokens.spacing.lg,
    ...tokens.shadows.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  receiptBrandHeader: {
    alignItems: 'center',
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs + 2,
  },
  brandLogoImg: {
    width: 24,
    height: 24,
  },
  brandStoreName: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: 2,
    fontWeight: '500',
  },
  brandContactText: {
    color: tokens.colors.secondary,
    fontSize: 10,
    marginTop: 3,
    textAlign: 'center',
  },
  infoSection: {
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.xs + 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '500',
  },
  infoValue: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
  },
  channelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primary,
  },
  channelBadgeText: {
    color: tokens.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  customerCard: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.sm + 2,
    marginVertical: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 2,
  },
  customerCardTitle: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  customerName: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  customerPhone: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
  },
  deliveryInfoContainer: {
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    gap: 4,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.primaryFixed,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  deliveryBadgeText: {
    color: tokens.colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  deliveryAddressText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: 16,
  },
  tearLineContainer: {
    position: 'relative',
    marginVertical: tokens.spacing.sm,
    justifyContent: 'center',
  },
  dashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderStyle: 'dashed',
  },
  notch: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: tokens.colors.background,
  },
  notchLeft: {
    left: -7,
  },
  notchRight: {
    right: -7,
  },
  tableSection: {
    gap: tokens.spacing.xs,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  tableHeaderTitle: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderSub: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontWeight: '600',
  },
  itemsTable: {
    gap: tokens.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  itemLeft: {
    flex: 1,
    paddingRight: tokens.spacing.sm,
  },
  itemSku: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  itemSub: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  itemLineTotal: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  totalBreakdown: {
    gap: tokens.spacing.xs + 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
  },
  breakdownValue: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  totalRowHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  totalGrandLabel: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '800',
  },
  totalGrandSub: {
    color: tokens.colors.secondary,
    fontSize: 10,
    marginTop: 1,
  },
  totalGrandValue: {
    color: tokens.colors.primaryContainer,
    fontSize: tokens.typography.numericLarge.fontSize,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  thankYouSection: {
    alignItems: 'center',
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },
  thankYouText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
  },
  returnPolicyText: {
    color: tokens.colors.secondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  paymentRecordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  paymentMethodText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  paymentRefText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  paymentAmountText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.statusSuccess,
  },
  paymentDateText: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    marginTop: 1,
  },
})
