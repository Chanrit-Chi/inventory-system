import React, { useEffect, useRef, useState, useMemo } from 'react'
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
import type { Order, Customer, UserAccount } from '../types'
import { fetchStaffMembers } from '../api/endpoints'
import { DigitalReceipt } from './DigitalReceipt'
import { PrinterPickerModal } from './PrinterPickerModal'
import { SellerPickerModal } from './pos/SellerPickerModal'
import { useToast } from '../context/ToastContext'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'

export interface OrderReceiptModalProps {
  visible: boolean
  order: Order | null
  matchedCustomer?: Customer | null
  onNewSale?: () => void
  onClose?: () => void
  onNavigateSettings?: () => void
  onUpdateStatus?: (orderId: string, status: string, paymentMethod?: string) => Promise<void>
  onUpdateOrder?: (
    orderId: string,
    updates: { notes?: string; delivery_address?: string; seller_id?: string | null }
  ) => Promise<void>
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
  const { showToast } = useToast()
  const bounceAnim = useRef(new Animated.Value(0)).current
  const [localOrder, setLocalOrder] = useState<Order | null>(order)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('ABA QR')
  const [editNotes, setEditNotes] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSeller, setEditSeller] = useState<{ id: string; name: string; role?: string; email?: string; isActive?: boolean } | null>(null)
  const [staffUsers, setStaffUsers] = useState<UserAccount[]>([])
  const [sellerPickerOpen, setSellerPickerOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [devices, setDevices] = useState<PrinterDevice[]>([])
  const [showPrinterPicker, setShowPrinterPicker] = useState(false)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig | null>(null)
  const receiptRef = useRef<View>(null)
  const hiddenReceiptRef = useRef<View>(null)

  const activeOrder = localOrder || order
  const items = activeOrder?.items ?? []

  const receiptItems = useMemo(() => {
    return items.map((item, index) => ({
      id: item.id || `item-${index}`,
      name: item.variant?.sku || `Item #${index + 1}`,
      sku: item.variant?.attribute_values && item.variant.attribute_values.length > 0
        ? item.variant.attribute_values.map(a => a.value_name).join(' • ')
        : undefined,
      quantity: item.quantity,
      unitPrice: typeof item.unit_price === 'number' ? item.unit_price : parseFloat(String(item.unit_price || '0')) || 0,
      totalPrice: typeof item.line_total === 'number' ? item.line_total : parseFloat(String(item.line_total || '0')) || item.quantity * (typeof item.unit_price === 'number' ? item.unit_price : parseFloat(String(item.unit_price || '0')) || 0)
    }))
  }, [items])

  const orderDate = useMemo(() => {
    if (!activeOrder?.created_at) return new Date().toLocaleString()
    try {
      const d = new Date(activeOrder.created_at)
      return d.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return String(activeOrder.created_at)
    }
  }, [activeOrder?.created_at])

  useEffect(() => {
    setLocalOrder(order)
    if (order) {
      setEditNotes(order.notes || '')
      setEditAddress(order.delivery_address || '')
      setEditSeller(order.seller || null)
    }
  }, [order])

  useEffect(() => {
    if (visible) {
      getPrinterConfig().then(setPrinterConfig)
      getPrinterDevices().then(setDevices)
      fetchStaffMembers().then((res) => {
        if (Array.isArray(res)) setStaffUsers(res)
      }).catch(() => null)
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
    } catch (err: unknown) {
      Alert.alert('Print Notice', err instanceof Error ? err.message : 'Could not send receipt to printer.')
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
    } catch (err: unknown) {
      Alert.alert('Print Notice', err instanceof Error ? err.message : 'Could not send ticket to printer.')
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
    } catch (err: unknown) {
      Alert.alert('Print Notice', err instanceof Error ? err.message : 'Error dispatching to all printers.')
    } finally {
      setIsPrinting(false)
    }
  }

  if (!activeOrder) return null

  const statusLower = (activeOrder.status || 'completed').toLowerCase()
  const isPending = statusLower === 'pending'
  const isCancelled = statusLower === 'cancelled'
  const isCompleted = statusLower === 'completed' || statusLower === 'paid'

  const totalPaid =
    typeof activeOrder.total_amount === 'number'
      ? activeOrder.total_amount
      : parseFloat(String(activeOrder.total_amount || '0')) || 0

  const paymentMethod = activeOrder.payments?.[0]?.payment_method || 'Cash'

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

  const receiptSubtotal = typeof activeOrder.subtotal === 'number' ? activeOrder.subtotal : parseFloat(String(activeOrder.subtotal || '0')) || totalPaid
  const receiptTax = typeof activeOrder.tax_amount === 'number' ? activeOrder.tax_amount : parseFloat(String(activeOrder.tax_amount || '0')) || 0
  const receiptDiscount = typeof activeOrder.discount === 'number' ? activeOrder.discount : parseFloat(String(activeOrder.discount || '0')) || 0
  const receiptDeliveryCost = typeof activeOrder.delivery_cost === 'number' ? activeOrder.delivery_cost : parseFloat(String(activeOrder.delivery_cost || '0')) || 0
  const deliveryCompany = activeOrder.delivery_company
  const deliveryAddress = activeOrder.delivery_address || editAddress

  const handleShareReceipt = async () => {
    try {
      const targetRef = hiddenReceiptRef.current || receiptRef.current
      if (targetRef) {
        setIsCapturing(true)
        // Add a slight delay to ensure UI layout is settled and views are rasterized
        await new Promise(resolve => setTimeout(resolve, 150))
        const uri = await captureRef(targetRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
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
    } catch (err: unknown) {
      setIsCapturing(false)
      Alert.alert('Share Notice', err instanceof Error ? err.message : 'Could not generate or open share dialog.')
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
      showToast(`Order #${activeOrder.order_number} marked as Paid via ${selectedMethod}.`, 'success')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update order status.', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelOrder = () => {
    if (isCancelled) {
      showToast('This order is already cancelled.', 'info')
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
              showToast(`Order #${activeOrder.order_number} has been voided and stock restored.`, 'info')
            } catch (err: unknown) {
              const error = err as { message?: string }
              showToast(error?.message || 'Failed to cancel order.', 'error')
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
          seller_id: editSeller?.id || null,
        })
      }
      setLocalOrder((prev) =>
        prev
          ? {
              ...prev,
              notes: editNotes,
              delivery_address: editAddress,
              seller: editSeller,
              seller_id: editSeller?.id || null,
            }
          : null
      )
      setShowEditModal(false)
      showToast(`Order #${activeOrder.order_number} details updated.`, 'success')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update details.', 'error')
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
            <View style={styles.orderDateTimeBadge}>
              <Ionicons name="time-outline" size={13} color={tokens.colors.secondary} />
              <Text style={styles.orderDateText}>{orderDate}</Text>
            </View>
          </View>

          {/* Receipt Scroll Area */}
          <ScrollView
            style={styles.receiptScroll}
            contentContainerStyle={styles.receiptContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Modern Redesigned Status Card */}
            <View style={styles.statusControlCard}>
              <View style={styles.statusCardTopRow}>
                {/* Left: Status Badge Pill + Payment Method */}
                <View style={styles.statusCardLeft}>
                  <View style={[
                    styles.statusPill,
                    isPending && styles.statusPillPending,
                    isCancelled && styles.statusPillCancelled,
                    isCompleted && styles.statusPillCompleted,
                  ]}>
                    <Ionicons
                      name={
                        isPending
                          ? 'time-outline'
                          : isCancelled
                          ? 'close-circle'
                          : 'checkmark-circle'
                      }
                      size={13}
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
                        styles.statusPillText,
                        isPending && { color: '#B45309' },
                        isCancelled && { color: '#B91C1C' },
                        isCompleted && { color: '#15803D' },
                      ]}
                    >
                      {isPending
                        ? `Pending • $${totalPaid.toFixed(2)}`
                        : isCancelled
                        ? 'Cancelled / Void'
                        : 'Paid in Full'}
                    </Text>
                  </View>

                  <View style={styles.paymentMethodMetaRow}>
                    <View style={[styles.methodPill, { backgroundColor: methodBg }]}>
                      <Ionicons
                        name={isCash ? 'cash-outline' : isAba ? 'qr-code-outline' : 'card-outline'}
                        size={11}
                        color={methodColor}
                      />
                      <Text style={[styles.methodPillText, { color: methodColor }]}>
                        {paymentMethod}
                      </Text>
                    </View>
                    {Boolean(activeOrder.notes || activeOrder.delivery_address) && (
                      <Text style={styles.hasNotesIndicator} numberOfLines={1}>
                        • {activeOrder.notes || activeOrder.delivery_address}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Right: Actions (Edit, Settle, Void) */}
                <View style={styles.statusCardRight}>
                  {!isCancelled && (
                    <TouchableOpacity
                      style={styles.editInfoIconBtn}
                      onPress={() => setShowEditModal(true)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Edit Order Details"
                    >
                      <Ionicons name="create-outline" size={13} color={tokens.colors.primary} />
                      <Text style={styles.editInfoBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  {isPending ? (
                    <TouchableOpacity
                      style={styles.settlePaymentPillBtn}
                      onPress={() => setShowSettleModal(true)}
                      disabled={isUpdating}
                      activeOpacity={0.8}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={13} color="#FFFFFF" />
                          <Text style={styles.settlePaymentPillText}>Settle</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : !isCancelled ? (
                    <TouchableOpacity
                      style={styles.voidOrderOutlineBtn}
                      onPress={handleCancelOrder}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle-outline" size={13} color={tokens.colors.statusError} />
                      <Text style={styles.voidOrderText}>Void</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            <DigitalReceipt
              ref={receiptRef}
              documentType="Receipt"
              documentNumber={activeOrder.order_number || activeOrder.id || 'N/A'}
              customerName={customerObj?.name || 'Walk-in Customer'}
              customerPhone={customerObj?.phone}
              items={receiptItems}
              subtotal={receiptSubtotal}
              tax={receiptTax}
              discount={receiptDiscount}
              deliveryCost={receiptDeliveryCost}
              deliveryCompany={deliveryCompany}
              deliveryAddress={deliveryAddress}
              amountPaid={totalPaid}
              balanceDue={0}
              paymentMethod={paymentMethod}
              orderDate={orderDate}
              createdAt={activeOrder.created_at}
              channelName={activeOrder.channel?.name || activeOrder.channel_id || 'Store POS'}
              channel={activeOrder.channel}
              channelId={activeOrder.channel_id}
              sellerName={activeOrder.seller?.name}
              cashierName={activeOrder.user?.name}
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

                {/* Sales Representative (Incentive Credit) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Sales Representative (Credited Seller)</Text>
                  <TouchableOpacity
                    style={[
                      styles.textInput,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 12,
                      },
                    ]}
                    onPress={() => setSellerPickerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="person-outline" size={16} color={tokens.colors.primary} />
                      <Text style={{ ...tokens.typography.body, color: tokens.colors.onBackground }}>
                        {editSeller?.name || 'Unassigned / General Register'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.colors.primary }}>
                      Change
                    </Text>
                  </TouchableOpacity>
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
              onClose?.()
              onNavigateSettings()
            }
          }}
          onClose={() => setShowPrinterPicker(false)}
        />

        {/* Off-screen Full-Height Container for High-Res Unclipped Image Capture (Option A) */}
        <View style={styles.offscreenCaptureContainer} pointerEvents="none">
          <DigitalReceipt
            ref={hiddenReceiptRef}
            documentType="Receipt"
            documentNumber={activeOrder.order_number || activeOrder.id || 'N/A'}
            customerName={customerObj?.name || 'Walk-in Customer'}
            customerPhone={customerObj?.phone}
            items={receiptItems}
            subtotal={receiptSubtotal}
            tax={receiptTax}
            discount={receiptDiscount}
            deliveryCost={receiptDeliveryCost}
            deliveryCompany={deliveryCompany}
            deliveryAddress={deliveryAddress}
            amountPaid={totalPaid}
            balanceDue={0}
            paymentMethod={paymentMethod}
            channelName={activeOrder.channel?.name || activeOrder.channel_id || 'Store POS'}
            channel={activeOrder.channel}
            channelId={activeOrder.channel_id}
            sellerName={activeOrder.seller?.name}
            cashierName={activeOrder.user?.name}
          />
        </View>
      </SafeAreaView>

      {/* Seller Picker for Editing Order */}
      <SellerPickerModal
        visible={sellerPickerOpen}
        onClose={() => setSellerPickerOpen(false)}
        users={staffUsers}
        selectedSellerId={editSeller?.id || null}
        onSelectSeller={(user) => {
          setEditSeller(user)
          setSellerPickerOpen(false)
        }}
        onResetToMe={() => {
          setSellerPickerOpen(false)
        }}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  offscreenCaptureContainer: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 380,
    zIndex: -999,
  },
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
  orderDateTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: tokens.borderRadius.pill,
    marginTop: tokens.spacing.xs + 2,
    gap: 5,
  },
  orderDateText: {
    color: tokens.colors.secondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  statusControlCard: {
    marginBottom: tokens.spacing.md,
    padding: tokens.spacing.sm + 2,
    borderRadius: tokens.borderRadius.card,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  statusCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusCardLeft: {
    flex: 1,
    gap: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    alignSelf: 'flex-start',
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusPillCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  paymentMethodMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
  },
  methodPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  hasNotesIndicator: {
    fontSize: 10,
    color: tokens.colors.secondary,
    flex: 1,
  },
  statusCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editInfoIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  editInfoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  settlePaymentPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    ...tokens.shadows.card,
  },
  settlePaymentPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  voidOrderOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  voidOrderText: {
    color: tokens.colors.statusError,
    fontSize: 11,
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
