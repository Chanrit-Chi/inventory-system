import { usePermissions } from '../hooks/usePermissions'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { invoiceSchema, InvoiceFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import { SearchBar } from '../components/SearchBar'
import { matchSearch } from '../utils/searchHelper'
import {
  fetchInvoices,
  recordInvoicePayment,
  updateInvoiceStatus,
  createInvoice,
  scanBarcode,
} from '../api/endpoints'
import {
  shareInvoice as thermalShareInvoice,
  getPrinterConfig,
  getPrinterDevices,
  printInvoiceThermalToDevice,
  printInvoiceThermal,
} from '../utils/thermalPrinter'
import type { PrinterConfig, PrinterDevice } from '../utils/thermalPrinter'
import type { Invoice, InvoiceStatus, InvoicePaymentRecord, TabType } from '../types'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { DigitalReceipt } from '../components/DigitalReceipt'
import { PrinterPickerModal } from '../components/PrinterPickerModal'
import { ProductPickerModal, SelectedProductItem, ExistingPickerItem } from '../components/ProductPickerModal'
import type { Product, ProductVariant, ScannedVariant } from '../types'

export interface InvoicesScreenProps {
  onNavigate: (tab: TabType) => void
}

const INITIAL_INVOICES: Invoice[] = []


function getInvoiceNumber(inv: Invoice): string {
  return inv.invoice_number || inv.invoiceNumber || 'INV-2026'
}

function getOrderNumber(inv: Invoice): string | null {
  return inv.order_number || inv.orderNumber || null
}

function getCustomerName(inv: Invoice): string {
  return inv.customer_name || inv.customerName || 'General Customer'
}

function getCustomerPhone(inv: Invoice): string {
  return inv.customer_phone || inv.customerPhone || ''
}

function getTotalAmount(inv: Invoice): number {
  if (inv.total_amount !== undefined) {
    return typeof inv.total_amount === 'number' ? inv.total_amount : parseFloat(String(inv.total_amount)) || 0
  }
  if (inv.totalAmount !== undefined) {
    return typeof inv.totalAmount === 'number' ? inv.totalAmount : parseFloat(String(inv.totalAmount)) || 0
  }
  return 0
}

function getAmountPaid(inv: Invoice): number {
  if (inv.amount_paid !== undefined) {
    return typeof inv.amount_paid === 'number' ? inv.amount_paid : parseFloat(String(inv.amount_paid)) || 0
  }
  if (inv.amountPaid !== undefined) {
    return typeof inv.amountPaid === 'number' ? inv.amountPaid : parseFloat(String(inv.amountPaid)) || 0
  }
  return 0
}

function getBalanceDue(inv: Invoice): number {
  if (inv.balance_due !== undefined) {
    return typeof inv.balance_due === 'number' ? inv.balance_due : parseFloat(String(inv.balance_due)) || 0
  }
  if (inv.balanceDue !== undefined) {
    return typeof inv.balanceDue === 'number' ? inv.balanceDue : parseFloat(String(inv.balanceDue)) || 0
  }
  return Math.max(0, getTotalAmount(inv) - getAmountPaid(inv))
}

function getDueDate(inv: Invoice): string {
  return inv.due_date || inv.dueDate || 'Upon Receipt'
}

function getPayments(inv: Invoice): InvoicePaymentRecord[] {
  return inv.payments || []
}

export const InvoicesScreen: React.FC<InvoicesScreenProps> = ({ onNavigate }) => {
  const { can } = usePermissions()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)

  // Selected Invoice for details
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig | null>(null)
  const [devices, setDevices] = useState<PrinterDevice[]>([])
  const [showPrinterPicker, setShowPrinterPicker] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null)
  const invoiceRef = React.useRef<View>(null)

  // Create Invoice Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [submittingInvoice, setSubmittingInvoice] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const {
    control: invoiceControl,
    handleSubmit: handleInvoiceSubmit,
    reset: resetInvoiceForm,
    getValues: getInvoiceValues,
    watch: watchInvoice,
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      notes: '',
      items: [],
    },
  })

  const {
    fields: invoiceItemFields,
    append: appendInvoiceItem,
    remove: removeInvoiceItem,
    update: updateInvoiceItem,
  } = useFieldArray({
    control: invoiceControl,
    name: 'items',
  })

  const {
    scannerOpen,
    setScannerOpen,
    loading: isScanning,
    handleScanCode: handleScanBarcodeForInvoice,
  } = useBarcodeScan({
    mode: 'custom',
    blockInactive: true,
    onFoundVariant: (variant, product) => {
      const attrNames = (variant.attribute_values || []).map((av: any) => av.value_name).filter(Boolean).join(' / ')
      const name = product?.name ? `${product.name}${attrNames ? ` (${attrNames})` : ''}` : variant.sku
      const price = parseFloat(variant.selling_price_override || variant.selling_price || product?.selling_price || '0') || 0
      appendInvoiceItem({
        id: `item-${Date.now()}`,
        productName: name,
        sku: variant.sku || 'SKU-SCANNED',
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
      })
      Alert.alert('Item Added', `Added "${name}" ($${price.toFixed(2)}) to invoice.`)
    },
    onFoundProduct: (product, variants) => {
      const v = variants?.[0]
      const name = product.name
      const sku = v?.sku || product.barcode || product.id || 'SKU-SCANNED'
      const price = parseFloat(v?.selling_price_override || v?.selling_price || product.selling_price || '0') || 0
      appendInvoiceItem({
        id: `item-${Date.now()}`,
        productName: name,
        sku,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
      })
      Alert.alert('Item Added', `Added "${name}" ($${price.toFixed(2)}) to invoice.`)
    },
  })

  const handleRemoveInvoiceItemWithConfirm = (idx: number, itemName?: string) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove ${itemName ? `"${itemName}"` : `Item #${idx + 1}`} from the invoice?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeInvoiceItem(idx),
        },
      ]
    )
  }

  const watchedInvoiceItems = watchInvoice('items')
  const invoiceExistingItems = useMemo<ExistingPickerItem[]>(
    () =>
      (watchedInvoiceItems || [])
        .filter((it) => it.sku && it.sku !== 'SKU-CUSTOM')
        .map((it) => ({
          sku: it.sku,
          productName: it.productName,
          quantity: Number(it.quantity) || 1,
        })),
    [watchedInvoiceItems]
  )

  const handleSelectProductForInvoice = (prod: Product, v?: ProductVariant | ScannedVariant) => {
    handleSelectMultipleProductsForInvoice([{ product: prod, variant: v, quantity: 1 }])
  }

  const handleSelectMultipleProductsForInvoice = (selectedList: SelectedProductItem[]) => {
    const current = getInvoiceValues('items') || []
    const toAppend: InvoiceFormValues['items'] = []

    selectedList.forEach((it) => {
      const prod = it.product
      const v = it.variant
      const unitPrice = parseFloat(String(v?.selling_price_override || (v as any)?.selling_price || prod.selling_price || '0')) || 0
      const attrSummary = v?.attribute_values?.map((av: any) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
      const displayName = v ? ((v as ProductVariant).name || (attrSummary ? `${prod.name} (${attrSummary})` : `${prod.name} - ${v.sku}`)) : prod.name
      const sku = v?.sku || prod.sku || 'SKU-CUSTOM'
      const variantId = v?.id || prod.variants?.[0]?.id
      const addQty = Math.max(1, Math.round(it.quantity || 1))

      // Picker reflects current totals: confirm sets the line to the chosen quantity (no double-count)
      const existingIdx = current.findIndex(
        (ci) => (variantId && (ci as any).variantId === variantId) || (!!sku && sku !== 'SKU-CUSTOM' && ci.sku === sku)
      )
      if (existingIdx >= 0) {
        updateInvoiceItem(existingIdx, {
          ...current[existingIdx],
          quantity: addQty,
          unitPrice,
          totalPrice: unitPrice * addQty,
        })
      } else {
        toAppend.push({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          productName: displayName,
          sku,
          quantity: addQty,
          unitPrice,
          totalPrice: unitPrice * addQty,
        })
      }
    })

    if (toAppend.length > 0) {
      appendInvoiceItem(toAppend)
    }
    setCatalogOpen(false)
  }

  const onSubmitNewInvoice = async (data: InvoiceFormValues) => {
    try {
      setSubmittingInvoice(true)
      const totalAmount = data.items.reduce(
        (acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        0
      )

      const payload = {
        customer_name: data.customerName,
        customer_phone: data.customerPhone || undefined,
        due_date: data.dueDate || undefined,
        notes: data.notes || undefined,
        items: data.items.map((it) => ({
          product_name: it.productName,
          sku: it.sku || undefined,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unitPrice) || 0,
        })),
      }

      const res = await createInvoice(payload)
      if (res && res.data) {
        const newInv = res.data
        setInvoices([newInv, ...invoices])
        setCreateModalOpen(false)
        resetInvoiceForm()
        Alert.alert('Success', `Invoice ${getInvoiceNumber(newInv)} created and issued!`)
      }
    } catch (err: unknown) {
      // Create local optimistic invoice
      const totalAmount = data.items.reduce(
        (acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        0
      )
      const localInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: data.customerName,
        customerPhone: data.customerPhone || '',
        status: 'SENT',
        totalAmount,
        amountPaid: 0,
        balanceDue: totalAmount,
        dueDate: data.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        notes: data.notes || '',
        createdAt: new Date().toISOString(),
        items: data.items.map((it, idx) => ({
          id: `ii-${Date.now()}-${idx}`,
          productName: it.productName,
          sku: it.sku || 'SKU-GEN',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          totalPrice: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        })),
        payments: [],
      }

      setInvoices([localInvoice, ...invoices])
      setCreateModalOpen(false)
      resetInvoiceForm()
      Alert.alert('Invoice Issued', `Invoice ${getInvoiceNumber(localInvoice)} created and ready!`)
    } finally {
      setSubmittingInvoice(false)
    }
  }

  // Payment Recording Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'ABA QR' | 'Cash' | 'Card'>('ABA QR')
  const [payRef, setPayRef] = useState('')

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchInvoices()
      if (res && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).data || []
        setInvoices(list)
      } else {
        setInvoices([])
      }
    } catch {
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleShareInvoice = async (invoice: Invoice) => {
    try {
      if (invoiceRef.current) {
        setIsCapturing(true)
        await new Promise(resolve => setTimeout(resolve, 150))
        const uri = await captureRef(invoiceRef, { format: 'png', quality: 1 })
        setIsCapturing(false)
        const canShare = await Sharing.isAvailableAsync()
        if (canShare) {
          await Sharing.shareAsync(uri, {
            dialogTitle: `Share Invoice #${getInvoiceNumber(invoice)}`,
            mimeType: 'image/png'
          })
        } else {
          Alert.alert('Share Unavailable', 'File sharing is not available on this device.')
        }
      }
    } catch (error: any) {
      setIsCapturing(false)
      Alert.alert('Error', error?.message || 'Could not generate or share invoice.')
    }
  }

  const handlePrintInvoice = async (inv: Invoice) => {
    try {
      setIsPrinting(true)
      const printerList = devices.length > 0 ? devices : await getPrinterDevices()
      setDevices(printerList)
      if (printerList.length > 1) {
        setInvoiceToPrint(inv)
        setShowPrinterPicker(true)
        return
      }
      const targetDevice = printerList.find((d) => d.isDefault) || printerList[0]
      if (targetDevice) {
        await printInvoiceThermalToDevice(inv, targetDevice, printerConfig || undefined)
      } else {
        await printInvoiceThermal(inv, printerConfig || undefined)
      }
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Could not print invoice.')
    } finally {
      setIsPrinting(false)
    }
  }

  const handleSelectPrinter = async (device: PrinterDevice) => {
    setShowPrinterPicker(false)
    if (!invoiceToPrint) return
    setIsPrinting(true)
    try {
      await printInvoiceThermalToDevice(invoiceToPrint, device, printerConfig || undefined)
    } finally {
      setIsPrinting(false)
      setInvoiceToPrint(null)
    }
  }

  const handlePrintAllPrinters = async () => {
    setShowPrinterPicker(false)
    if (!invoiceToPrint) return
    setIsPrinting(true)
    try {
      for (const d of devices) {
        await printInvoiceThermalToDevice(invoiceToPrint, d, printerConfig || undefined)
      }
    } finally {
      setIsPrinting(false)
      setInvoiceToPrint(null)
    }
  }

  useEffect(() => {
    getPrinterConfig().then(setPrinterConfig)
    getPrinterDevices().then(setDevices)
  }, [])

  useEffect(() => {
    if (selectedInvoice) {
      getPrinterConfig().then(setPrinterConfig)
    }
  }, [selectedInvoice])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadInvoices()
  }, [loadInvoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const itemNames = inv.items?.map((it) => it.product_name || (it as any).productName || '') || []
      const itemSkus = inv.items?.map((it) => it.sku || '') || []
      const match = matchSearch(
        search,
        getInvoiceNumber(inv),
        getCustomerName(inv),
        getCustomerPhone(inv),
        getOrderNumber(inv),
        inv.notes,
        itemNames,
        itemSkus
      )
      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter
      return match && matchStatus
    })
  }, [invoices, search, statusFilter])

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return { bg: '#E6F4EA', text: '#15803D', label: 'Paid in Full' }
      case 'PARTIAL':
        return { bg: '#FEF3C7', text: '#B45309', label: 'Partially Paid' }
      case 'OVERDUE':
        return { bg: '#FFDAD6', text: '#93000A', label: 'Overdue' }
      case 'SENT':
        return { bg: '#E0F2FE', text: '#0369A1', label: 'Sent' }
      case 'DRAFT':
        return { bg: '#EFEAE2', text: '#615E57', label: 'Draft' }
      default:
        return { bg: '#EFEAE2', text: '#615E57', label: status }
    }
  }

  const handleOpenRecordPayment = (inv: Invoice) => {
    setSelectedInvoice(inv)
    setPayAmount(getBalanceDue(inv).toFixed(2))
    setPayRef('')
    setPaymentModalOpen(true)
  }

  const handleRecordPaymentSubmit = async () => {
    if (!selectedInvoice) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.')
      return
    }

    try {
      setRecordingPayment(true)
      const res = await recordInvoicePayment(selectedInvoice.id, {
        amount,
        payment_method: payMethod,
        transaction_ref: payRef || undefined,
      })

      if (res && res.data && res.data.invoice) {
        const updated = res.data.invoice
        setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        setSelectedInvoice(updated)
      } else {
        // Optimistic local update
        const newPayment: InvoicePaymentRecord = {
          id: `pay-${Date.now()}`,
          amount,
          paymentMethod: payMethod,
          transactionRef: payRef || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
          paidAt: new Date().toISOString(),
          recordedBy: 'Current Cashier',
        }

        const newPaid = getAmountPaid(selectedInvoice) + amount
        const newBalance = Math.max(0, getTotalAmount(selectedInvoice) - newPaid)
        const newStatus: InvoiceStatus = newBalance === 0 ? 'PAID' : 'PARTIAL'

        const updatedInvoice: Invoice = {
          ...selectedInvoice,
          amountPaid: newPaid,
          amount_paid: newPaid,
          balanceDue: newBalance,
          balance_due: newBalance,
          status: newStatus,
          payments: [newPayment, ...getPayments(selectedInvoice)],
        }

        setInvoices((prev) => prev.map((i) => (i.id === selectedInvoice.id ? updatedInvoice : i)))
        setSelectedInvoice(updatedInvoice)
      }

      setPaymentModalOpen(false)
      Alert.alert('Payment Recorded', `Successfully recorded payment of $${amount.toFixed(2)} via ${payMethod}.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment.'
      Alert.alert('Error', msg)
    } finally {
      setRecordingPayment(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Compact toolbar: search + new pos sale */}
      <View style={styles.compactToolbar}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice #, order, customer..."
          containerStyle={styles.searchBarContainer}
        />
        {Boolean(can('invoices:create')) && (
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => setCreateModalOpen(true)}
            accessibilityLabel="Create New Invoice"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={tokens.colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {['ALL', 'PARTIAL', 'OVERDUE', 'PAID', 'SENT'].map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
            onPress={() => setStatusFilter(st)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]} numberOfLines={1}>
              {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Invoice List */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primaryContainer}
            colors={[tokens.colors.primaryContainer]}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            <Text style={styles.loadingText}>Loading invoices from server...</Text>
          </View>
        ) : filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={tokens.colors.secondaryFixedDim} />
            <Text style={styles.emptyTitle}>No Invoices Found</Text>
            <Text style={styles.emptyText}>Invoices generated from completed orders will appear here.</Text>
          </View>
        ) : (
          filteredInvoices.map((inv) => {
            const badge = getStatusBadge(inv.status)
            const total = getTotalAmount(inv)
            const paid = getAmountPaid(inv)
            const balance = getBalanceDue(inv)
            const invNum = getInvoiceNumber(inv)
            const cName = getCustomerName(inv)
            const ordNum = getOrderNumber(inv)

            return (
              <TouchableOpacity
                key={inv.id}
                style={styles.invoiceCard}
                onPress={() => setSelectedInvoice(inv)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.headerTitleCol}>
                    <View style={styles.invNumRow}>
                      <Ionicons name="receipt-outline" size={13} color={tokens.colors.primaryContainer} style={{ marginRight: 4 }} />
                      <Text style={styles.invNum} numberOfLines={1} ellipsizeMode="tail">{invNum}</Text>
                      {ordNum ? <Text style={styles.orderTag} numberOfLines={1}> ({ordNum})</Text> : null}
                    </View>
                    <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">{cName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Total Amount</Text>
                    <Text style={styles.metricVal}>${total.toFixed(2)}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Paid</Text>
                    <Text style={[styles.metricVal, { color: tokens.colors.statusSuccess }]}>
                      ${paid.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Balance Due</Text>
                    <Text
                      style={[
                        styles.metricVal,
                        balance > 0 ? { color: tokens.colors.statusError } : { color: tokens.colors.textMuted },
                      ]}
                    >
                      ${balance.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActionsRow}>
                  {Boolean(balance > 0 && can('invoices:record-payment')) && (
                    <TouchableOpacity
                      style={styles.recordPaymentQuickBtn}
                      onPress={() => handleOpenRecordPayment(inv)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="card" size={13} color={tokens.colors.onPrimary} />
                      <Text style={styles.recordPaymentQuickText}>Record Payment</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.printQuickBtn}
                    onPress={() => handlePrintInvoice(inv)}
                    activeOpacity={0.85}
                    accessibilityLabel="Print Invoice"
                  >
                    <Ionicons name="print-outline" size={14} color={tokens.colors.primaryContainer} />
                    <Text style={styles.printQuickBtnText}>Print</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>

      {/* Invoice Details Modal */}
      {selectedInvoice && !paymentModalOpen ? (
        <Modal visible={true} animationType="slide" onRequestClose={() => setSelectedInvoice(null)} statusBarTranslucent>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
              <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 24 }}>
              <DigitalReceipt
                ref={invoiceRef}
                documentType="Invoice"
                documentNumber={getInvoiceNumber(selectedInvoice)}
                dueDate={getDueDate(selectedInvoice)}
                referenceNumber={getOrderNumber(selectedInvoice)}
                customerName={getCustomerName(selectedInvoice)}
                customerPhone={getCustomerPhone(selectedInvoice)}
                items={(selectedInvoice.items || []).map((item, idx) => {
                  const pName = item.product_name || item.productName || 'Product'
                  const uPrice = typeof item.unit_price === 'number' ? item.unit_price : typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unit_price || item.unitPrice || '0')) || 0
                  const tPrice = typeof item.total_price === 'number' ? item.total_price : typeof item.totalPrice === 'number' ? item.totalPrice : parseFloat(String(item.total_price || item.totalPrice || (item.quantity * uPrice))) || (item.quantity * uPrice)
                  return {
                    id: item.id || `inv-it-${idx}`,
                    name: pName,
                    sku: item.sku || undefined,
                    quantity: item.quantity,
                    unitPrice: uPrice,
                    totalPrice: tPrice,
                  }
                })}
                subtotal={getTotalAmount(selectedInvoice)}
                tax={0}
                amountPaid={getAmountPaid(selectedInvoice)}
                balanceDue={getBalanceDue(selectedInvoice)}
                payments={getPayments(selectedInvoice).map((p, idx) => {
                  const pMethod = p.payment_method || p.paymentMethod || 'Cash'
                  const pRef = p.transaction_ref || p.transactionRef || 'Direct'
                  const pAmt = typeof p.amount === 'number' ? p.amount : parseFloat(String(p.amount || '0')) || 0
                  const pDate = p.paid_at || p.paidAt || new Date().toISOString()
                  return {
                    id: p.id || `pay-${idx}`,
                    method: pMethod,
                    ref: pRef,
                    amount: pAmt,
                    date: `${new Date(pDate).toLocaleDateString()} ${new Date(pDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                  }
                })}
              />
              
              {/* Secondary Actions (Outside of ViewShot) */}
              {Boolean(!isCapturing) && (
                <View style={{ marginTop: 24, gap: 10 }}>
                  {getBalanceDue(selectedInvoice) > 0 ? (
                    Boolean(can('invoices:record-payment')) && (
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => handleOpenRecordPayment(selectedInvoice)}
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
                      onPress={() => handlePrintInvoice(selectedInvoice)}
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
                      style={[styles.shareInvoiceBtn, { flex: 1, marginTop: 0, marginBottom: 0 }, isCapturing && { opacity: 0.7 }]}
                      onPress={() => handleShareInvoice(selectedInvoice)}
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
                    onPress={() => setSelectedInvoice(null)}
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
      ) : null}

      {/* Record Payment Form Modal */}
      {paymentModalOpen && selectedInvoice ? (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setPaymentModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.detailSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.detailTitle}>Record Payment</Text>
                <TouchableOpacity onPress={() => setPaymentModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={tokens.colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                <View style={styles.payContextBox}>
                  <Text style={styles.payContextLabel}>Invoice: {getInvoiceNumber(selectedInvoice)}</Text>
                  <Text style={styles.payContextBalance}>Remaining: ${getBalanceDue(selectedInvoice).toFixed(2)}</Text>
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
                  onPress={handleRecordPaymentSubmit}
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
      ) : null}

      {/* Create New Invoice Modal */}
      <Modal visible={createModalOpen} transparent animationType="slide" onRequestClose={() => setCreateModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.detailTitle}>Create New Invoice</Text>
              <TouchableOpacity onPress={() => setCreateModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
              <ControlledInput
                name="customerName"
                control={invoiceControl}
                label="Customer Name *"
                placeholder="e.g. Acme Corporation / Sarah Connor"
              />
              <ControlledInput
                name="customerPhone"
                control={invoiceControl}
                label="Customer Phone (Optional)"
                placeholder="+855 ..."
                inputProps={{ keyboardType: 'phone-pad' }}
              />
              <ControlledInput
                name="dueDate"
                control={invoiceControl}
                label="Due Date (YYYY-MM-DD)"
                placeholder="YYYY-MM-DD"
              />

              <View style={styles.itemsSection}>
                <Text style={styles.formLabel}>Invoice Line Items</Text>
                <View style={styles.itemActionsRow}>
                  <TouchableOpacity
                    style={[styles.addItemBtn, styles.addItemBtnPrimary]}
                    onPress={() => setCatalogOpen(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="list-outline" size={14} color={tokens.colors.onPrimary} />
                    <Text style={[styles.addItemBtnText, { color: tokens.colors.onPrimary }]}>Catalog</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addItemBtn, styles.addItemBtnOutlined]}
                    onPress={() => setScannerOpen(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="barcode-outline" size={14} color={tokens.colors.primary} />
                    <Text style={[styles.addItemBtnText, { color: tokens.colors.primary }]}>Scan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addItemBtn, styles.addItemBtnTonal]}
                    onPress={() =>
                      appendInvoiceItem({
                        id: `item-${Date.now()}`,
                        productName: '',
                        sku: 'SKU-CUSTOM',
                        quantity: 1,
                        unitPrice: 0,
                        totalPrice: 0,
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={tokens.colors.primary} />
                    <Text style={[styles.addItemBtnText, { color: tokens.colors.primary }]}>Custom</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {invoiceItemFields.map((item, idx) => (
                <View key={item.id} style={styles.createItemBox}>
                  <View style={styles.itemBoxTopRow}>
                    <Text style={styles.itemBoxIndex}>Item #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleRemoveInvoiceItemWithConfirm(idx, item.productName)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={tokens.colors.actionDestructive} />
                    </TouchableOpacity>
                  </View>
                  <ControlledInput
                    name={`items.${idx}.productName`}
                    control={invoiceControl}
                    label=""
                    placeholder="Product Name"
                    inputProps={{ style: styles.itemInput }}
                  />
                  <View style={styles.inlineInputs}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <ControlledInput
                        name={`items.${idx}.quantity`}
                        control={invoiceControl}
                        label=""
                        placeholder="Qty"
                        inputProps={{ 
                          keyboardType: 'numeric',
                          style: [styles.itemInput, { flex: 1 }] 
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ControlledInput
                        name={`items.${idx}.unitPrice`}
                        control={invoiceControl}
                        label=""
                        placeholder="Unit Price ($)"
                        inputProps={{ 
                          keyboardType: 'numeric',
                          style: [styles.itemInput, { flex: 1 }] 
                        }}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <ControlledInput
                name="notes"
                control={invoiceControl}
                label="Terms / Notes (Optional)"
                placeholder="Payment terms, bank details, delivery notes..."
                inputProps={{ multiline: true, style: [styles.input, { height: 60 }] }}
              />

              <TouchableOpacity
                style={[styles.submitPayBtn, submittingInvoice && { opacity: 0.6 }]}
                onPress={handleInvoiceSubmit(onSubmitNewInvoice)}
                disabled={submittingInvoice}
                activeOpacity={0.85}
              >
                {submittingInvoice ? (
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                ) : (
                  <Text style={styles.submitPayText}>Save & Issue Invoice</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Barcode Camera Scanner Modal */}
      <CameraScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanCode={async (code) => {
          await handleScanBarcodeForInvoice(code)
        }}
        isLoading={isScanning}
      />

      {/* Printer Picker Station Modal */}
      <PrinterPickerModal
        visible={showPrinterPicker}
        devices={devices}
        onSelectDevice={handleSelectPrinter}
        onPrintAll={handlePrintAllPrinters}
        onClose={() => {
          setShowPrinterPicker(false)
          setInvoiceToPrint(null)
        }}
      />

      {/* Product Catalog Selection Modal */}
      <ProductPickerModal
        visible={catalogOpen}
        title="Select Products for Invoice"
        subtitle="Grouped by product catalog with live stock & prices"
        priceType="selling"
        existingItems={invoiceExistingItems}
        onClose={() => setCatalogOpen(false)}
        onSelect={handleSelectProductForInvoice}
        onSelectMultiple={handleSelectMultipleProductsForInvoice}
      />
    </View>
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
  compactToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  addIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.card,
  },
  filterRow: {
    maxHeight: 50,
    backgroundColor: tokens.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  filterRowContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  filterChipTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 36,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyState: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptyText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
  invoiceCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  invNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invNum: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  orderTag: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: 10,
  },
  cardMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  recordPaymentQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 8,
    paddingVertical: 7,
    gap: 6,
  },
  recordPaymentQuickText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  printQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 5,
  },
  printQuickBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: tokens.colors.surfaceCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  detailSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  detailBody: {
    paddingVertical: 12,
  },
  infoBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 3,
  },
  boxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 4,
  },
  boxText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  itemSku: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  calcBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
    gap: 6,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcLabel: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  calcVal: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  calcTotalRow: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  noPaymentText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 12,
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
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  paidInFullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EA',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  paidInFullText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  payContextBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  payContextLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  payContextBalance: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.statusError,
    marginTop: 2,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: tokens.colors.onBackground,
    marginBottom: 12,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.colors.surfaceMuted,
    gap: 4,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  methodBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  methodBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  methodBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  submitPayBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitPayText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  printInvoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 12,
  },
  printInvoiceBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  shareInvoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 12,
  },
  shareInvoiceBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  footer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    padding: tokens.spacing.md,
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
  itemsSection: {
    marginTop: 14,
    marginBottom: 8,
  },
  itemActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  addItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  addItemBtnPrimary: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  addItemBtnOutlined: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  addItemBtnTonal: {
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  addItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  createItemBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  itemBoxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemBoxIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  itemInput: {
    backgroundColor: tokens.colors.surfaceCard,
    fontSize: 13,
    marginBottom: 6,
  },
  inlineInputs: {
    flexDirection: 'row',
  },
})

export default InvoicesScreen
