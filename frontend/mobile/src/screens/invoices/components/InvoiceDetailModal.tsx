import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../InvoicesScreen.styles'
import { DigitalReceipt } from '../../../components/DigitalReceipt'
import type { Invoice } from '../../../types'
import {
  getInvoiceNumber,
  getOrderNumber,
  getCustomerName,
  getCustomerPhone,
  getTotalAmount,
  getAmountPaid,
  getBalanceDue,
  getDueDate,
  getPayments,
} from '../invoiceUtils'

export interface InvoiceDetailModalProps {
  invoice: Invoice | null
  invoiceRef: React.RefObject<View | null>
  isCapturing: boolean
  isPrinting: boolean
  paymentModalOpen: boolean
  payAmount: string
  setPayAmount: (s: string) => void
  payMethod: 'ABA QR' | 'Cash' | 'Card'
  setPayMethod: (m: 'ABA QR' | 'Cash' | 'Card') => void
  payRef: string
  setPayRef: (s: string) => void
  recordingPayment: boolean
  canRecordPayment: boolean
  onCloseDetail: () => void
  onOpenRecordPayment: (inv: Invoice) => void
  onClosePaymentModal: () => void
  onRecordPaymentSubmit: () => void
  onPrintInvoice: (inv: Invoice) => void
  onShareInvoice: (inv: Invoice) => void
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  invoiceRef,
  isCapturing,
  isPrinting,
  paymentModalOpen,
  payAmount,
  setPayAmount,
  payMethod,
  setPayMethod,
  payRef,
  setPayRef,
  recordingPayment,
  canRecordPayment,
  onCloseDetail,
  onOpenRecordPayment,
  onClosePaymentModal,
  onRecordPaymentSubmit,
  onPrintInvoice,
  onShareInvoice,
}) => {
  if (!invoice) return null

  return (
    <>
      {/* Invoice Details Modal */}
      {!paymentModalOpen && (
        <Modal visible={true} animationType="slide" onRequestClose={onCloseDetail} statusBarTranslucent>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
              <ScrollView
                style={{ flex: 1, width: '100%' }}
                contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 24 }}
              >
                <DigitalReceipt
                  ref={invoiceRef}
                  documentType="Invoice"
                  documentNumber={getInvoiceNumber(invoice)}
                  dueDate={getDueDate(invoice)}
                  referenceNumber={getOrderNumber(invoice)}
                  customerName={getCustomerName(invoice)}
                  customerPhone={getCustomerPhone(invoice)}
                  items={(invoice.items || []).map((item, idx) => {
                    const pName = item.product_name || item.productName || 'Product'
                    const uPrice =
                      typeof item.unit_price === 'number'
                        ? item.unit_price
                        : typeof item.unitPrice === 'number'
                        ? item.unitPrice
                        : parseFloat(String(item.unit_price || item.unitPrice || '0')) || 0
                    const tPrice =
                      typeof item.total_price === 'number'
                        ? item.total_price
                        : typeof item.totalPrice === 'number'
                        ? item.totalPrice
                        : parseFloat(String(item.total_price || item.totalPrice || item.quantity * uPrice)) ||
                          item.quantity * uPrice
                    return {
                      id: item.id || `inv-it-${idx}`,
                      name: pName,
                      sku: item.sku || undefined,
                      quantity: item.quantity,
                      unitPrice: uPrice,
                      totalPrice: tPrice,
                    }
                  })}
                  subtotal={getTotalAmount(invoice)}
                  tax={0}
                  amountPaid={getAmountPaid(invoice)}
                  balanceDue={getBalanceDue(invoice)}
                  payments={getPayments(invoice).map((p, idx) => {
                    const pMethod = p.payment_method || p.paymentMethod || 'Cash'
                    const pRefVal = p.transaction_ref || p.transactionRef || 'Direct'
                    const pAmt = typeof p.amount === 'number' ? p.amount : parseFloat(String(p.amount || '0')) || 0
                    const pDate = p.paid_at || p.paidAt || new Date().toISOString()
                    return {
                      id: p.id || `pay-${idx}`,
                      method: pMethod,
                      ref: pRefVal,
                      amount: pAmt,
                      date: `${new Date(pDate).toLocaleDateString()} ${new Date(pDate).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`,
                    }
                  })}
                />

                {/* Secondary Actions (Outside of ViewShot) */}
                {!isCapturing && (
                  <View style={{ marginTop: 24, gap: 10 }}>
                    {getBalanceDue(invoice) > 0 ? (
                      Boolean(canRecordPayment) && (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => onOpenRecordPayment(invoice)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="card" size={18} color={tokens.colors.onPrimary} />
                          <Text style={styles.payBtnText}>Record Payment</Text>
                        </TouchableOpacity>
                      )
                    ) : (
                      <View style={styles.paidInFullBanner}>
                        <Ionicons name="checkmark-circle" size={18} color={tokens.colors.statusSuccess} />
                        <Text style={styles.paidInFullText}>Settled in Full</Text>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.printInvoiceBtn, isPrinting && { opacity: 0.7 }]}
                        onPress={() => onPrintInvoice(invoice)}
                        activeOpacity={0.8}
                        disabled={isPrinting}
                      >
                        {isPrinting ? (
                          <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                        ) : (
                          <Ionicons name="print-outline" size={18} color={tokens.colors.onPrimary} />
                        )}
                        <Text style={styles.printInvoiceBtnText}>{isPrinting ? 'Printing...' : 'Print Invoice'}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.shareInvoiceBtn,
                          { flex: 1, marginTop: 0, marginBottom: 0 },
                          isCapturing && { opacity: 0.7 },
                        ]}
                        onPress={() => onShareInvoice(invoice)}
                        activeOpacity={0.8}
                        disabled={isCapturing}
                      >
                        {isCapturing ? (
                          <ActivityIndicator size="small" color={tokens.colors.primary} />
                        ) : (
                          <Ionicons name="share-social-outline" size={18} color={tokens.colors.primary} />
                        )}
                        <Text style={styles.shareInvoiceBtnText}>{isCapturing ? 'Preparing...' : 'Share'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Sticky Bottom Primary CTAs */}
              <View style={styles.footer}>
                <View style={styles.footerButtonsRow}>
                  <TouchableOpacity
                    style={styles.closeFooterButton}
                    onPress={onCloseDetail}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Text style={styles.closeFooterButtonText}>Close Invoice</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Record Payment Form Modal */}
      {paymentModalOpen && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={onClosePaymentModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.detailSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.detailTitle}>Record Payment</Text>
                <TouchableOpacity onPress={onClosePaymentModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                <View style={styles.payContextBox}>
                  <Text style={styles.payContextLabel}>Invoice: {getInvoiceNumber(invoice)}</Text>
                  <Text style={styles.payContextBalance}>Remaining: ${getBalanceDue(invoice).toFixed(2)}</Text>
                </View>

                <Text style={styles.formLabel}>Payment Amount ($) *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="0.00"
                />

                <Text style={styles.formLabel}>Payment Method</Text>
                <View style={styles.methodSelector}>
                  {(['ABA QR', 'Cash', 'Card'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodBtn, payMethod === m && styles.methodBtnActive]}
                      onPress={() => setPayMethod(m)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={m === 'ABA QR' ? 'qr-code' : m === 'Cash' ? 'cash' : 'card'}
                        size={16}
                        color={payMethod === m ? tokens.colors.onPrimary : tokens.colors.secondary}
                      />
                      <Text style={[styles.methodBtnText, payMethod === m && styles.methodBtnTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>Transaction Reference # (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={payRef}
                  onChangeText={setPayRef}
                  placeholder="e.g. ABA Bank Ref / POS Approval"
                />

                <TouchableOpacity
                  style={[styles.submitPayBtn, recordingPayment && { opacity: 0.6 }]}
                  onPress={onRecordPaymentSubmit}
                  disabled={recordingPayment}
                  activeOpacity={0.85}
                >
                  {recordingPayment ? (
                    <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  ) : (
                    <Text style={styles.submitPayText}>Confirm & Apply Payment</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}
