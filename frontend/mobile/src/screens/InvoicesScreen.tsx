import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { invoiceSchema, InvoiceFormValues } from '../utils/validation'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import { matchSearch } from '../utils/searchHelper'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import {
  fetchInvoices,
  recordInvoicePayment,
  createInvoice,
} from '../api/endpoints'
import {
  getPrinterConfig,
  getPrinterDevices,
  printInvoiceThermalToDevice,
  printInvoiceThermal,
} from '../utils/thermalPrinter'
import type { PrinterConfig, PrinterDevice } from '../utils/thermalPrinter'
import type { Invoice, InvoiceStatus, InvoicePaymentRecord, TabType } from '../types'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { PrinterPickerModal } from '../components/PrinterPickerModal'
import { ProductPickerModal, SelectedProductItem, ExistingPickerItem } from '../components/ProductPickerModal'
import type { Product, ProductVariant, ScannedVariant, ScannedAttributeValue } from '../types'
import { styles } from './invoices/InvoicesScreen.styles'
import {
  getInvoiceNumber,
  getCustomerName,
  getCustomerPhone,
  getOrderNumber,
  getTotalAmount,
  getAmountPaid,
  getBalanceDue,
  getPayments,
} from './invoices/invoiceUtils'
import { InvoiceCardItem } from './invoices/components/InvoiceCardItem'
import { InvoiceFilterBar } from './invoices/components/InvoiceFilterBar'
import { InvoiceDetailModal } from './invoices/components/InvoiceDetailModal'
import { CreateInvoiceModal } from './invoices/components/CreateInvoiceModal'

export interface InvoicesScreenProps {
  onNavigate: (tab: TabType) => void
}

export const InvoicesScreen: React.FC<InvoicesScreenProps> = () => {
  const { showToast } = useToast()
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
      const attrNames = (variant.attribute_values || []).map((av: ScannedAttributeValue) => av.value_name).filter(Boolean).join(' / ')
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
      const unitPrice = parseFloat(String(v?.selling_price_override || v?.selling_price || prod.selling_price || '0')) || 0
      const attrSummary = v?.attribute_values?.map((av: ScannedAttributeValue) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
      const displayName = v ? ((v as ProductVariant).name || (attrSummary ? `${prod.name} (${attrSummary})` : `${prod.name} - ${v.sku}`)) : prod.name
      const sku = v?.sku || prod.sku || 'SKU-CUSTOM'
      const variantId = v?.id || prod.variants?.[0]?.id
      const addQty = Math.max(1, Math.round(it.quantity || 1))

      const existingIdx = current.findIndex(
        (ci) => (variantId && (ci as { variantId?: string }).variantId === variantId) || (!!sku && sku !== 'SKU-CUSTOM' && ci.sku === sku)
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
        showToast(`Invoice ${getInvoiceNumber(newInv)} created and issued!`, 'success')
      }
    } catch {
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
      showToast(`Invoice ${getInvoiceNumber(localInvoice)} saved locally.`, 'warning')
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
        const list = Array.isArray(res.data) ? res.data : res.data.data || []
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
        await new Promise((resolve) => setTimeout(resolve, 150))
        const uri = await captureRef(invoiceRef, { format: 'png', quality: 1 })
        setIsCapturing(false)
        const canShare = await Sharing.isAvailableAsync()
        if (canShare) {
          await Sharing.shareAsync(uri, {
            dialogTitle: `Share Invoice #${getInvoiceNumber(invoice)}`,
            mimeType: 'image/png',
          })
        } else {
          Alert.alert('Share Unavailable', 'File sharing is not available on this device.')
        }
      }
    } catch (error) {
      setIsCapturing(false)
      const message = error instanceof Error ? error.message : 'Could not generate or share invoice.'
      Alert.alert('Error', message)
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not print invoice.'
      Alert.alert('Print Error', message)
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
      const itemNames = inv.items?.map((it) => it.product_name || it.productName || '') || []
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
      showToast(`Recorded payment of $${amount.toFixed(2)} via ${payMethod}.`, 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment.'
      showToast(msg, 'error')
    } finally {
      setRecordingPayment(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Search & Action Toolbar + Filters */}
      <InvoiceFilterBar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        canCreate={Boolean(can('invoices:create'))}
        onOpenCreate={() => setCreateModalOpen(true)}
      />

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
          filteredInvoices.map((inv) => (
            <InvoiceCardItem
              key={inv.id}
              invoice={inv}
              canRecordPayment={Boolean(can('invoices:record-payment'))}
              onSelect={(selected) => setSelectedInvoice(selected)}
              onQuickPay={handleOpenRecordPayment}
              onQuickPrint={handlePrintInvoice}
            />
          ))
        )}
      </ScrollView>

      {/* Invoice Details Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        invoiceRef={invoiceRef}
        isCapturing={isCapturing}
        isPrinting={isPrinting}
        paymentModalOpen={paymentModalOpen}
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        payMethod={payMethod}
        setPayMethod={setPayMethod}
        payRef={payRef}
        setPayRef={setPayRef}
        recordingPayment={recordingPayment}
        canRecordPayment={Boolean(can('invoices:record-payment'))}
        onCloseDetail={() => setSelectedInvoice(null)}
        onOpenRecordPayment={handleOpenRecordPayment}
        onClosePaymentModal={() => setPaymentModalOpen(false)}
        onRecordPaymentSubmit={handleRecordPaymentSubmit}
        onPrintInvoice={handlePrintInvoice}
        onShareInvoice={handleShareInvoice}
      />

      {/* Create New Invoice Modal */}
      <CreateInvoiceModal
        visible={createModalOpen}
        invoiceControl={invoiceControl}
        invoiceItemFields={invoiceItemFields}
        submittingInvoice={submittingInvoice}
        onClose={() => setCreateModalOpen(false)}
        onOpenCatalog={() => setCatalogOpen(true)}
        onOpenScanner={() => setScannerOpen(true)}
        onAddCustomItem={() =>
          appendInvoiceItem({
            id: `item-${Date.now()}`,
            productName: '',
            sku: 'SKU-CUSTOM',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
          })
        }
        onRemoveItem={handleRemoveInvoiceItemWithConfirm}
        onSubmit={handleInvoiceSubmit(onSubmitNewInvoice)}
      />

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

export default InvoicesScreen
