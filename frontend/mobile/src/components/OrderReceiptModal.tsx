import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import {
  printThermalReceipt,
  getPrinterConfig,
  getPrinterDevices,
  printThermalReceiptToDevice,
} from '../utils/thermalPrinter'
import type { PrinterConfig, PrinterDevice } from '../utils/thermalPrinter'
import type { Order, Customer } from '../types'
import { DigitalReceipt } from './DigitalReceipt'
import { PrinterPickerModal } from './PrinterPickerModal'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'

export interface OrderReceiptModalProps {
  visible: boolean
  order: Order | null
  matchedCustomer?: Customer | null
  onNewSale: () => void
  onClose?: () => void
  onNavigateSettings?: () => void
  onUpdateStatus?: (orderId: string, newStatus: string, paymentMethod?: string, notes?: string) => Promise<void> | void
  onUpdateOrder?: (orderId: string, payload: { status?: string; payment_method?: string; notes?: string; delivery_address?: string; region?: string }) => Promise<void> | void
}

const PAYMENT_METHODS = [
  { id: 'ABA QR', label: 'ABA / KHQR', icon: 'qr-code' as const, color: '#005F83', bg: '#E0F2FE' },
  { id: 'Cash', label: 'Cash', icon: 'cash' as const, color: '#16A34A', bg: '#DCFCE7' },
  { id: 'ACLEDA', label: 'ACLEDA', icon: 'business' as const, color: '#0D3880', bg: '#E6EDF8' },
  { id: 'Wing', label: 'Wing Bank', icon: 'phone-portrait' as const, color: '#6EBE44', bg: '#EDF8E6' },
  { id: 'Card', label: 'Card / POS', icon: 'card' as const, color: '#7C3AED', bg: '#EDE9FE' },
]

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  visible,
  order,
  matchedCustomer,
  onNewSale,
  onClose = onNewSale,
  onNavigateSettings,
  onUpdateStatus,
  onUpdateOrder,
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current
  const [localOrder, setLocalOrder] = useState<Order | null>(order)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('ABA QR')
  const [editNotes, setEditNotes] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [devices, setDevices] = useState<PrinterDevice[]>([])
  const [showPrinterPicker, setShowPrinterPicker] = useState(false)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig | null>(null)
  const receiptRef = useRef<View>(null)

  useEffect(() => {
    setLocalOrder(order)
  }, [order])

  useEffect(() => {
    if (visible) {
      getPrinterConfig().then(setPrinterConfig)
      getPrinterDevices().then(setDevices)
      bounceAnim.setValue(0)
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }).start()
      const current = order
      if (current) {
        setEditNotes(current.notes || current.note || '')
        setEditAddress(current.delivery_address || '')
        setSelectedMethod(current.payments?.[0]?.payment_method || 'ABA QR')
      }
    }
  }, [visible, bounceAnim, order])

  const handlePrintReceipt = async () => {
    if (!order) return
    const printerList = devices.length > 0 ? devices : await getPrinterDevices()
    if (printerList.length > 1) {
      setDevices(printerList)
      setShowPrinterPicker(true)
      return
    }

    if (isPrinting) return
    setIsPrinting(true)
    try {
      if (printerList.length === 1) {
        await printThermalReceiptToDevice(order, printerList[0])
      } else {
        await printThermalReceipt(order)
      }
    } catch (err: any) {
      Alert.alert('Print Notice', err?.message || 'Could not send receipt to printer.')
    } finally {
      setIsPrinting(false)
    }
  }

  const handleSelectPrinterDevice = async (device: PrinterDevice) => {
    setShowPrinterPicker(false)
    if (!order || isPrinting) return
    setIsPrinting(true)
    try {
      await printThermalReceiptToDevice(order, device)
    } catch (err: any) {
      Alert.alert('Print Notice', err?.message || 'Could not send ticket to printer.')
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePrintAllStations = async () => {
    setShowPrinterPicker(false)
    if (!order || isPrinting) return
    setIsPrinting(true)
    try {
      for (const dev of devices) {
        await printThermalReceiptToDevice(order, dev)
      }
    } catch (err: any) {
      Alert.alert('Print Notice', err?.message || 'Error dispatching to all printers.')
    } finally {
      setIsPrinting(false)
    }
  }

  const activeOrder = localOrder || order
  if (!activeOrder) return null

  const statusLower = (activeOrder.status || 'completed').toLowerCase()
  const isPending = statusLower === 'pending'
  const isCancelled = statusLower === 'cancelled'
  const isCompleted = statusLower === 'completed' || statusLower === 'paid'

  const orderDate = activeOrder.created_at
    ? new Date(activeOrder.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString()

  const totalPaid =
    typeof activeOrder.total_amount === 'number'
      ? activeOrder.total_amount
      : parseFloat(String(activeOrder.total_amount || '0')) || 0

  const paymentMethod = activeOrder.payments?.[0]?.payment_method || 'Cash'
  const items = activeOrder.items ?? []

  // Resolve customer loyalty tier styling
  const customerObj = activeOrder.customer || matchedCustomer
  const totalSpentNum = customerObj
    ? typeof customerObj.total_spent === 'number'
      ? customerObj.total_spent
      : parseFloat(String(customerObj.total_spent || '0')) || 0
    : 0

  let tierName = 'Bronze'
  let tierColor = tokens.colors.tierBronze
  let tierBg = tokens.colors.tierBronzeBg

  if (totalSpentNum >= 1000) {
    tierName = 'Platinum'
    tierColor = tokens.colors.tierPlatinum
    tierBg = tokens.colors.tierPlatinumBg
  } else if (totalSpentNum >= 500) {
    tierName = 'Gold'
    tierColor = tokens.colors.tierGold
    tierBg = tokens.colors.tierGoldBg
  } else if (totalSpentNum >= 200) {
    tierName = 'Silver'
    tierColor = tokens.colors.tierSilver
    tierBg = tokens.colors.tierSilverBg
  }

  // Payment method badge styling (Cambodia context: ABA, Acleda, Wing, Bank Transfer, Cash)
  const pmLower = paymentMethod.toLowerCase()
  const isAba = pmLower.includes('aba') || pmLower.includes('khqr')
  const isAcleda = pmLower.includes('acleda')
  const isWing = pmLower.includes('wing')
  const isBank = pmLower.includes('bank') || pmLower.includes('transfer') || isAcleda || isWing
  const isCash = pmLower.includes('cash')

  const methodBg = isAba
    ? tokens.colors.accentAbaBg
    : isAcleda
    ? tokens.colors.accentAcledaBg
    : isWing
    ? tokens.colors.accentWingBg
    : isBank
    ? tokens.colors.accentBankBg
    : isCash
    ? tokens.colors.accentCashBg
    : tokens.colors.badgeNeutralBg

  const methodColor = isAba
    ? tokens.colors.accentAba
    : isAcleda
    ? tokens.colors.accentAcleda
    : isWing
    ? tokens.colors.accentWing
    : isBank
    ? tokens.colors.accentBank
    : isCash
    ? tokens.colors.accentCash
    : tokens.colors.onBackground


  const handleShareReceipt = async () => {
    try {
      if (receiptRef.current) {
        setIsCapturing(true)
        // Add a slight delay to ensure UI layout is settled and buttons are hidden
        await new Promise(resolve => setTimeout(resolve, 150))
        const uri = await captureRef(receiptRef, {
          format: 'png',
          quality: 1,
        })
        setIsCapturing(false)
        const canShare = await Sharing.isAvailableAsync()
        if (canShare) {
          await Sharing.shareAsync(uri, {
            dialogTitle: `Share Receipt #${activeOrder.order_number}`,
            mimeType: 'image/png',
          })
        } else {
          Alert.alert('Share Unavailable', 'File sharing is not available on this device.')
        }
      }
    } catch (err: any) {
      setIsCapturing(false)
      Alert.alert('Share Notice', err?.message || 'Could not generate or open share dialog.')
    }
  }

  const handleSettleConfirm = async () => {
    try {
      setIsUpdating(true)
      if (onUpdateStatus) {
        await onUpdateStatus(activeOrder.id, 'completed', selectedMethod)
      }
      setLocalOrder((prev) => (prev ? { ...prev, status: 'completed' } : null))
      setShowSettleModal(false)
      Alert.alert('Payment Settle Complete', `Order #${activeOrder.order_number} marked as Paid via ${selectedMethod}.`)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update order status.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelOrder = () => {
    if (isCancelled) {
      Alert.alert('Notice', 'This order is already cancelled.')
      return
    }
    Alert.alert(
      'Cancel / Void Order',
      `Are you sure you want to cancel Order #${activeOrder.order_number}? This will restore all items back to stock.`,
      [
        { text: 'No, Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUpdating(true)
              if (onUpdateStatus) {
                await onUpdateStatus(activeOrder.id, 'cancelled')
              }
              setLocalOrder((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
              Alert.alert('Order Cancelled', `Order #${activeOrder.order_number} has been voided and stock restored.`)
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel order.')
            } finally {
              setIsUpdating(false)
            }
          },
        },
      ]
    )
  }

  const handleSaveDetails = async () => {
    try {
      setIsUpdating(true)
      if (onUpdateOrder) {
        await onUpdateOrder(activeOrder.id, {
          notes: editNotes,
          delivery_address: editAddress,
        })
      }
      setLocalOrder((prev) =>
        prev
          ? {
              ...prev,
              notes: editNotes,
              delivery_address: editAddress,
            }
          : null
      )
      setShowEditModal(false)
      Alert.alert('Details Saved', `Order #${activeOrder.order_number} details have been updated.`)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update details.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onNewSale}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header Banner with Dynamic Status */}
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.successIconCircle,
                isPending && { backgroundColor: '#F59E0B' },
                isCancelled && { backgroundColor: '#DC2626' },
                {
                  transform: [
                    { scale: bounceAnim },
                    {
                      translateY: bounceAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name={
                  isPending
                    ? 'hourglass'
                    : isCancelled
                    ? 'close'
                    : 'checkmark'
                }
                size={32}
                color={tokens.colors.onPrimary}
              />
            </Animated.View>
            <Text style={styles.successTitle}>
              {isPending
                ? 'Order Pending Payment'
                : isCancelled
                ? 'Order Cancelled / Void'
                : 'Transaction Complete!'}
            </Text>
            <View style={styles.orderNumberPill}>
              <Text style={styles.orderNumberLabel}>Order</Text>
              <Text style={styles.orderNumberText}>#{activeOrder.order_number}</Text>
            </View>
            <Text style={styles.orderDateText}>{orderDate}</Text>
          </View>

          {/* Receipt Scroll Area */}
          <ScrollView
            style={styles.receiptScroll}
            contentContainerStyle={styles.receiptContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Action Banner for Pending / Editable Orders */}
            <View
              style={[
                styles.statusControlBanner,
                isPending && styles.statusControlBannerPending,
                isCancelled && styles.statusControlBannerCancelled,
                isCompleted && styles.statusControlBannerCompleted,
              ]}
            >
              <View style={styles.statusControlHeader}>
                <View style={styles.statusControlTitleRow}>
                  <Ionicons
                    name={
                      isPending
                        ? 'alert-circle'
                        : isCancelled
                        ? 'close-circle'
                        : 'checkmark-circle'
                    }
                    size={20}
                    color={
                      isPending
                        ? '#D97706'
                        : isCancelled
                        ? '#DC2626'
                        : '#16A34A'
                    }
                  />
                  <Text
                    style={[
                      styles.statusControlTitle,
                      isPending && { color: '#92400E' },
                      isCancelled && { color: '#991B1B' },
                      isCompleted && { color: '#166534' },
                    ]}
                  >
                    {isPending
                      ? `Pending Payment: $${totalPaid.toFixed(2)}`
                      : isCancelled
                      ? 'Order Voided / Cancelled'
                      : `Paid in Full (${paymentMethod})`}
                  </Text>
                </View>
                {!isCancelled && (
                  <TouchableOpacity
                    style={styles.editNotesBtn}
                    onPress={() => setShowEditModal(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={14} color={tokens.colors.primary} />
                    <Text style={styles.editNotesBtnText}>Edit Info</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Action Buttons */}
              <View style={styles.statusActionButtonsRow}>
                {isPending ? (
                  <>
                    <TouchableOpacity
                      style={styles.settlePaymentBtn}
                      onPress={() => setShowSettleModal(true)}
                      disabled={isUpdating}
                      activeOpacity={0.8}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                          <Text style={styles.settlePaymentBtnText}>Settle & Mark as Paid</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelOrderBtn}
                      onPress={handleCancelOrder}
                      disabled={isUpdating}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text style={styles.cancelOrderBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : isCancelled ? (
                  <View style={styles.cancelledNoticeBadge}>
                    <Ionicons name="close-circle" size={16} color="#DC2626" />
                    <Text style={styles.cancelledNoticeText}>Order Cancelled • Stock Restored to Inventory</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.cancelOrderBtn}
                      onPress={handleCancelOrder}
                      disabled={isUpdating}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                      <Text style={styles.cancelOrderBtnText}>Void / Cancel Order</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            <DigitalReceipt
              ref={receiptRef}
              documentType="Receipt"
              documentNumber={activeOrder.order_number || activeOrder.id || 'N/A'}
              customerName={customerObj?.name || 'Walk-in Customer'}
              customerPhone={customerObj?.phone}
              items={items.map((item, index) => ({
                id: item.id || `item-${index}`,
                name: item.variant?.sku || `Item #${index + 1}`,
                sku: item.variant?.attribute_values && item.variant.attribute_values.length > 0
                  ? item.variant.attribute_values.map(a => a.value_name).join(' • ')
                  : undefined,
                quantity: item.quantity,
                unitPrice: typeof item.unit_price === 'number' ? item.unit_price : parseFloat(String(item.unit_price || '0')) || 0,
                totalPrice: typeof item.line_total === 'number' ? item.line_total : parseFloat(String(item.line_total || '0')) || item.quantity * (typeof item.unit_price === 'number' ? item.unit_price : parseFloat(String(item.unit_price || '0')) || 0)
              }))}
              subtotal={typeof activeOrder.subtotal === 'number' ? activeOrder.subtotal : parseFloat(String(activeOrder.subtotal || '0')) || totalPaid}
              tax={typeof activeOrder.tax_amount === 'number' ? activeOrder.tax_amount : parseFloat(String(activeOrder.tax_amount || '0')) || 0}
              discount={typeof activeOrder.discount === 'number' ? activeOrder.discount : parseFloat(String(activeOrder.discount || '0')) || 0}
              amountPaid={totalPaid}
              balanceDue={0}
              paymentMethod={paymentMethod}
              channelName={activeOrder.channel?.name || activeOrder.channel_id || 'Store POS'}
            />

            {/* Secondary Actions: Print & Share (Outside the receipt capture) */}
            {Boolean(!isCapturing) && (
              <View style={styles.secondaryActionsRow}>
                <TouchableOpacity
                  testID="btn-print-receipt"
                  style={[styles.secondaryBtn, (isPrinting || isCapturing) && { opacity: 0.7 }]}
                  onPress={handlePrintReceipt}
                  activeOpacity={0.8}
                  disabled={isPrinting || isCapturing}
                  accessibilityRole="button"
                  accessibilityLabel="Print receipt"
                >
                  {isPrinting ? (
                    <ActivityIndicator size="small" color={tokens.colors.primary} />
                  ) : (
                    <Ionicons name="print-outline" size={16} color={tokens.colors.primary} />
                  )}
                  <Text style={styles.secondaryBtnText}>{isPrinting ? 'Printing...' : 'Print'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="btn-share-receipt"
                  style={[styles.secondaryBtn, (isPrinting || isCapturing) && { opacity: 0.7 }]}
                  onPress={handleShareReceipt}
                  activeOpacity={0.8}
                  disabled={isPrinting || isCapturing}
                  accessibilityRole="button"
                  accessibilityLabel="Share receipt"
                >
                  {isCapturing ? (
                    <ActivityIndicator size="small" color={tokens.colors.primary} />
                  ) : (
                    <Ionicons name="share-social-outline" size={16} color={tokens.colors.primary} />
                  )}
                  <Text style={styles.secondaryBtnText}>{isCapturing ? 'Preparing...' : 'Share'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Loading Overlay HUD */}
          {Boolean(isPrinting) && (
            <View style={styles.loadingOverlayHUD}>
              <View style={styles.loadingCardHUD}>
                <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
                <Text style={styles.loadingTitleHUD}>Printing Receipt</Text>
                <Text style={styles.loadingSubtitleHUD}>Connecting to Thermal ESC/POS Printer...</Text>
              </View>
            </View>
          )}

          {/* Sticky Bottom Primary CTAs */}
          <View style={styles.footer}>
            <View style={styles.footerButtonsRow}>
              <TouchableOpacity
                style={styles.closeFooterButton}
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close receipt"
              >
                <Text style={styles.closeFooterButtonText}>Close Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="btn-new-sale"
                style={styles.newSaleButton}
                onPress={onNewSale}
                accessibilityRole="button"
                accessibilityLabel="Start a new sale"
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
                <Text style={styles.newSaleButtonText}>New Sale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 1. Settle / Collect Payment Sub-Modal */}
        <Modal
          visible={showSettleModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSettleModal(false)}
        >
          <View style={styles.subModalOverlay}>
            <View style={styles.subModalContent}>
              <View style={styles.subModalHeader}>
                <View style={styles.subModalTitleRow}>
                  <View style={styles.subModalIconBox}>
                    <Ionicons name="card" size={18} color={tokens.colors.primaryContainer} />
                  </View>
                  <View>
                    <Text style={styles.subModalTitle}>Settle Payment</Text>
                    <Text style={styles.subModalSub}>Order #{activeOrder.order_number}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setShowSettleModal(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.amountDueBox}>
                <Text style={styles.amountDueLabel}>TOTAL AMOUNT DUE</Text>
                <Text style={styles.amountDueValue}>${totalPaid.toFixed(2)}</Text>
              </View>

              <Text style={styles.selectMethodLabel}>Select Payment Method:</Text>
              <View style={styles.methodList}>
                {PAYMENT_METHODS.map((pm) => {
                  const isSelected = selectedMethod === pm.id
                  return (
                    <TouchableOpacity
                      key={pm.id}
                      style={[styles.methodOption, isSelected && styles.methodOptionActive]}
                      onPress={() => setSelectedMethod(pm.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.methodIconBadge, { backgroundColor: pm.bg }]}>
                        <Ionicons name={pm.icon} size={18} color={pm.color} />
                      </View>
                      <Text style={[styles.methodOptionText, isSelected && styles.methodOptionTextActive]}>
                        {pm.label}
                      </Text>
                      {Boolean(isSelected) && (
                        <Ionicons name="checkmark-circle" size={20} color={tokens.colors.primaryContainer} />
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>

              <View style={styles.subModalActions}>
                <TouchableOpacity
                  style={styles.subModalCancelBtn}
                  onPress={() => setShowSettleModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.subModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.subModalConfirmBtn}
                  onPress={handleSettleConfirm}
                  disabled={isUpdating}
                  activeOpacity={0.8}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.subModalConfirmText}>Confirm & Settle</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 2. Edit Order Details Sub-Modal */}
        <Modal
          visible={showEditModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.subModalOverlay}>
            <View style={styles.subModalContent}>
              <View style={styles.subModalHeader}>
                <View style={styles.subModalTitleRow}>
                  <View style={styles.subModalIconBox}>
                    <Ionicons name="create" size={18} color={tokens.colors.primaryContainer} />
                  </View>
                  <View>
                    <Text style={styles.subModalTitle}>Edit Order Info</Text>
                    <Text style={styles.subModalSub}>Order #{activeOrder.order_number}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Order Notes / Remarks</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Add special instructions, notes, or tags..."
                    placeholderTextColor={tokens.colors.secondary}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Delivery Address / Location</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter delivery destination or table..."
                    placeholderTextColor={tokens.colors.secondary}
                    value={editAddress}
                    onChangeText={setEditAddress}
                  />
                </View>
              </ScrollView>

              <View style={styles.subModalActions}>
                <TouchableOpacity
                  style={styles.subModalCancelBtn}
                  onPress={() => setShowEditModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.subModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.subModalConfirmBtn}
                  onPress={handleSaveDetails}
                  disabled={isUpdating}
                  activeOpacity={0.8}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.subModalConfirmText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 3. Multi-Station Printer Picker Modal */}
        <PrinterPickerModal
          visible={showPrinterPicker}
          devices={devices}
          onSelectDevice={handleSelectPrinterDevice}
          onPrintAll={handlePrintAllStations}
          onManagePrinters={() => {
            if (onNavigateSettings) {
              onClose()
              onNavigateSettings()
            }
          }}
          onClose={() => setShowPrinterPicker(false)}
        />
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    alignItems: 'center',
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    position: 'relative',
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs + 2,
    ...tokens.shadows.card,
  },
  successTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  orderNumberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryFixed,
    paddingHorizontal: tokens.spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    marginTop: tokens.spacing.xs,
    gap: 6,
  },
  orderNumberLabel: {
    color: tokens.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderNumberText: {
    color: tokens.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  orderDateText: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: tokens.spacing.xs,
  },
  statusControlBanner: {
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  statusControlBannerPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  statusControlBannerCancelled: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  statusControlBannerCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  statusControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  statusControlTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusControlTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  editNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  editNotesBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  statusActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  settlePaymentBtn: {
    flex: 1,
    height: 40,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    ...tokens.shadows.card,
  },
  settlePaymentBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelOrderBtn: {
    flex: 0.6,
    height: 40,
    backgroundColor: '#FEE2E2',
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  cancelOrderBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelledNoticeBadge: {
    flex: 1,
    height: 40,
    backgroundColor: '#FEE2E2',
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  cancelledNoticeText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  receiptScroll: {
    flex: 1,
  },
  receiptContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl + 20,
  },
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
  brandLogoBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
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
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 40,
    gap: 6,
  },
  secondaryBtnText: {
    color: tokens.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    padding: tokens.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    ...tokens.shadows.actionSheet,
  },
  footerButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  closeFooterButton: {
    flex: 1,
    height: tokens.touchTarget.actionButtonHeight,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: tokens.colors.onBackground,
    fontSize: 13,
    fontWeight: '700',
  },
  newSaleButton: {
    flex: 1.2,
    height: tokens.touchTarget.actionButtonHeight,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...tokens.shadows.card,
  },
  newSaleButtonText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '700',
  },
  // Sub-Modal Styles
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  subModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.xl,
    padding: tokens.spacing.lg,
    ...tokens.shadows.modal,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  subModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subModalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.primaryFixed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  subModalSub: {
    fontSize: 12,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  amountDueBox: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.md,
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  amountDueLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
  },
  amountDueValue: {
    fontSize: 26,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  selectMethodLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: tokens.spacing.xs + 2,
  },
  methodList: {
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.sm + 2,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    gap: 10,
  },
  methodOptionActive: {
    borderColor: tokens.colors.primaryContainer,
    backgroundColor: tokens.colors.primaryFixed,
  },
  methodIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  methodOptionTextActive: {
    fontWeight: '800',
    color: tokens.colors.primary,
  },
  inputGroup: {
    marginBottom: tokens.spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
    fontSize: 14,
    color: tokens.colors.onBackground,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  subModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: tokens.spacing.xs,
  },
  subModalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subModalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  subModalConfirmBtn: {
    flex: 1.3,
    height: 42,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    ...tokens.shadows.card,
  },
  subModalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingOverlayHUD: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingCardHUD: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...tokens.shadows.actionSheet,
    minWidth: 220,
  },
  loadingTitleHUD: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 4,
  },
  loadingSubtitleHUD: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
})
