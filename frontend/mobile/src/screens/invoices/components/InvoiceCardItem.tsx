import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../InvoicesScreen.styles'
import type { Invoice } from '../../../types'
import {
  getInvoiceNumber,
  getOrderNumber,
  getCustomerName,
  getTotalAmount,
  getBalanceDue,
  getDueDate,
  getStatusStyle,
  formatDate,
} from '../invoiceUtils'

export interface InvoiceCardItemProps {
  invoice: Invoice
  canRecordPayment: boolean
  onSelect: (inv: Invoice) => void
  onQuickPay: (inv: Invoice) => void
  onQuickPrint: (inv: Invoice) => void
}

export const InvoiceCardItem: React.FC<InvoiceCardItemProps> = React.memo(({
  invoice,
  canRecordPayment,
  onSelect,
  onQuickPay,
  onQuickPrint,
}) => {
  const invNum = getInvoiceNumber(invoice)
  const orderNum = getOrderNumber(invoice)
  const custName = getCustomerName(invoice)
  const total = getTotalAmount(invoice)
  const balance = getBalanceDue(invoice)
  const dueDate = getDueDate(invoice)
  const statusStyle = getStatusStyle(invoice.status)

  return (
    <TouchableOpacity
      style={styles.invoiceCard}
      onPress={() => onSelect(invoice)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Invoice ${invNum}, Customer ${custName}, Total $${total.toFixed(2)}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleCol}>
          <View style={styles.invNumRow}>
            <Text style={styles.invNum}>{invNum}</Text>
            {Boolean(orderNum) && <Text style={styles.orderTag}> • Order #{orderNum}</Text>}
          </View>
          <Text style={styles.customerName} numberOfLines={1}>{custName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardMetrics}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>TOTAL</Text>
          <Text style={styles.metricVal}>${total.toFixed(2)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>DUE DATE</Text>
          <Text style={styles.metricVal}>{formatDate(dueDate)}</Text>
        </View>
        <View style={[styles.metricItem, { alignItems: 'flex-end' }]}>
          <Text style={styles.metricLabel}>BALANCE</Text>
          <Text
            style={[
              styles.metricVal,
              { color: balance > 0 ? tokens.colors.statusError : tokens.colors.statusSuccess },
            ]}
          >
            ${balance.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Quick Action Toolbar on Card */}
      <View style={styles.cardActionsRow}>
        {Boolean(balance > 0 && canRecordPayment) && (
          <TouchableOpacity
            style={styles.recordPaymentQuickBtn}
            onPress={(e) => {
              e.stopPropagation?.()
              onQuickPay(invoice)
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={13} color={tokens.colors.onPrimary} />
            <Text style={styles.recordPaymentQuickText}>Pay Balance</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.printQuickBtn}
          onPress={(e) => {
            e.stopPropagation?.()
            onQuickPrint(invoice)
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="print-outline" size={13} color={tokens.colors.primaryContainer} />
          <Text style={styles.printQuickBtnText}>Print</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})
