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
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { quotationSchema, QuotationFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import {
  fetchQuotations,
  createQuotation,
  updateQuotationStatus,
  convertQuotation,
  scanBarcode,
} from '../api/endpoints'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import { DigitalReceipt } from '../components/DigitalReceipt'
import { SearchBar } from '../components/SearchBar'
import { matchSearch } from '../utils/searchHelper'
import { ProductPickerModal, SelectedProductItem, ExistingPickerItem } from '../components/ProductPickerModal'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { getPrinterConfig } from '../utils/thermalPrinter'
import type { PrinterConfig } from '../utils/thermalPrinter'
import type { CartCheckoutPreset } from '../hooks/useCart'
import type { Quotation, QuotationItem, QuotationStatus, TabType, Product, ProductVariant, ScannedVariant } from '../types'

export interface QuotationsScreenProps {
  onNavigate: (tab: TabType) => void
  onConvertQuoteToCart?: (items: QuotationItem[], quoteNumber?: string, preset?: CartCheckoutPreset) => void
  activeCartCount?: number
}

const INITIAL_QUOTATIONS: Quotation[] = []


function getQuoteNumber(q: Quotation): string {
  return q.quotation_number || q.quotationNumber || 'QT-2026'
}

function getCustomerName(q: Quotation): string {
  return q.customer_name || q.customerName || 'General Customer'
}

function getCustomerPhone(q: Quotation): string {
  return q.customer_phone || q.customerPhone || ''
}

function getCustomerEmail(q: Quotation): string {
  return q.customer_email || q.customerEmail || ''
}

function getTotalAmount(q: Quotation): number {
  if (q.total_amount !== undefined) {
    return typeof q.total_amount === 'number' ? q.total_amount : parseFloat(String(q.total_amount)) || 0
  }
  if (q.totalAmount !== undefined) {
    return typeof q.totalAmount === 'number' ? q.totalAmount : parseFloat(String(q.totalAmount)) || 0
  }
  return 0
}

function getSubtotal(q: Quotation): number {
  return typeof q.subtotal === 'number' ? q.subtotal : parseFloat(String(q.subtotal || '0')) || 0
}

function getDiscount(q: Quotation): number {
  return typeof q.discount === 'number' ? q.discount : parseFloat(String(q.discount || '0')) || 0
}

function getValidUntil(q: Quotation): string {
  return q.valid_until || q.validUntil || '14 Days'
}

function getCreatedAt(q: Quotation): string {
  return q.created_at || q.createdAt || new Date().toISOString()
}

export const QuotationsScreen: React.FC<QuotationsScreenProps> = ({
  onNavigate,
  onConvertQuoteToCart,
  activeCartCount = 0,
}) => {
  const { can } = usePermissions()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Selected Quotation for details modal
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig | null>(null)
  const quoteRef = React.useRef<View>(null)

  useEffect(() => {
    if (selectedQuote) {
      getPrinterConfig().then(setPrinterConfig)
    }
  }, [selectedQuote])

  const handleShareQuotation = async (quote: Quotation) => {
    try {
      if (quoteRef.current) {
        setIsCapturing(true)
        await new Promise((resolve) => setTimeout(resolve, 150))
        const uri = await captureRef(quoteRef, { format: 'png', quality: 1 })
        setIsCapturing(false)
        const canShare = await Sharing.isAvailableAsync()
        if (canShare) {
          await Sharing.shareAsync(uri, {
            dialogTitle: `Share Quotation #${getQuoteNumber(quote)}`,
            mimeType: 'image/png',
          })
        } else {
          Alert.alert('Share Unavailable', 'File sharing is not available on this device.')
        }
      }
    } catch (error: any) {
      setIsCapturing(false)
      Alert.alert('Error', error?.message || 'Could not generate or share quotation.')
    }
  }

  // Create Quotation Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  
  const { control, handleSubmit, reset, setValue, getValues, watch } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      notes: '',
      discount: '0',
      items: []
    }
  })

  const { fields: itemFields, append: appendItem, remove: removeItem, update: updateItem } = useFieldArray({
    control,
    name: 'items'
  })

  const {
    scannerOpen,
    setScannerOpen,
    loading: isScanning,
    handleScanCode: handleScanBarcodeForQuotation,
  } = useBarcodeScan({
    mode: 'custom',
    blockInactive: true,
    onFoundVariant: (variant, product) => {
      const attrNames = (variant.attribute_values || []).map((av: any) => av.value_name).filter(Boolean).join(' / ')
      const name = product?.name ? `${product.name}${attrNames ? ` (${attrNames})` : ''}` : variant.sku
      const price = parseFloat(variant.selling_price_override || variant.selling_price || product?.selling_price || '0') || 0
      appendItem({
        id: `item-${Date.now()}`,
        variantId: variant.id,
        productName: name,
        sku: variant.sku || 'SKU-SCANNED',
        quantity: 1,
        unitPrice: price,
        lineTotal: price,
      })
      Alert.alert('Item Added', `Added "${name}" ($${price.toFixed(2)}) to quotation.`)
    },
    onFoundProduct: (product, variants) => {
      const v = variants?.[0]
      const name = product.name
      const sku = v?.sku || product.barcode || product.id || 'SKU-SCANNED'
      const price = parseFloat(v?.selling_price_override || v?.selling_price || product.selling_price || '0') || 0
      const variantId = v?.id || `v-${Date.now()}`
      appendItem({
        id: `item-${Date.now()}`,
        variantId,
        productName: name,
        sku,
        quantity: 1,
        unitPrice: price,
        lineTotal: price,
      })
      Alert.alert('Item Added', `Added "${name}" ($${price.toFixed(2)}) to quotation.`)
    },
  })

  const handleRemoveItemWithConfirm = (idx: number, itemName?: string) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove ${itemName ? `"${itemName}"` : `Item #${idx + 1}`} from the quotation?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeItem(idx),
        },
      ]
    )
  }

  const watchedItems = watch('items')
  const quotationExistingItems = useMemo<ExistingPickerItem[]>(
    () =>
      (watchedItems || []).map((it) => ({
        variantId: it.variantId,
        sku: it.sku,
        productName: it.productName,
        quantity: Number(it.quantity) || 1,
      })),
    [watchedItems]
  )

  const handleSelectProductForQuotation = (prod: Product, v?: ProductVariant | ScannedVariant) => {
    handleSelectMultipleProductsForQuotation([{ product: prod, variant: v, quantity: 1 }])
  }

  const handleSelectMultipleProductsForQuotation = (selectedList: SelectedProductItem[]) => {
    const current = getValues('items') || []
    const toAppend: QuotationFormValues['items'] = []

    selectedList.forEach((it) => {
      const prod = it.product
      const v = it.variant
      const unitPrice = parseFloat(String(v?.selling_price_override || (v as any)?.selling_price || prod.selling_price || '0')) || 0
      const attrSummary = v?.attribute_values?.map((av: any) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
      const displayName = v ? ((v as ProductVariant).name || (attrSummary ? `${prod.name} (${attrSummary})` : `${prod.name} - ${v.sku}`)) : prod.name
      const sku = v?.sku || prod.sku || 'SKU-CUSTOM'
      const variantId = v?.id || prod.variants?.[0]?.id || `v-${Date.now()}`
      const addQty = Math.max(1, Math.round(it.quantity || 1))

      // Picker reflects current totals: confirm sets the line to the chosen quantity (no double-count)
      const existingIdx = current.findIndex((ci) => ci.variantId === variantId)
      if (existingIdx >= 0) {
        updateItem(existingIdx, {
          ...current[existingIdx],
          quantity: addQty,
          unitPrice,
          lineTotal: unitPrice * addQty,
        })
      } else {
        toAppend.push({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          variantId,
          productName: displayName,
          sku,
          quantity: addQty,
          unitPrice,
          lineTotal: unitPrice * addQty,
        })
      }
    })

    if (toAppend.length > 0) {
      appendItem(toAppend)
    }
    setCatalogOpen(false)
  }

  const loadQuotations = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchQuotations()
      if (res && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).data || []
        setQuotations(list)
      } else {
        setQuotations([])
      }
    } catch {
      setQuotations([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadQuotations()
  }, [loadQuotations])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadQuotations()
  }, [loadQuotations])

  const filteredQuotes = useMemo(() => {
    return quotations.filter((q) => {
      const itemNames = q.items?.map((it) => it.product_name || (it as any).productName || (it as any).name || '') || []
      const itemSkus = q.items?.map((it) => it.sku || '') || []
      const match = matchSearch(
        search,
        getQuoteNumber(q),
        getCustomerName(q),
        getCustomerPhone(q),
        q.notes,
        itemNames,
        itemSkus
      )
      const matchStatus = statusFilter === 'ALL' || q.status === statusFilter
      return match && matchStatus
    })
  }, [quotations, search, statusFilter])

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'DRAFT':
        return { bg: '#EFEAE2', text: '#615E57', label: 'Draft' }
      case 'SENT':
        return { bg: '#E0F2FE', text: '#0369A1', label: 'Sent' }
      case 'ACCEPTED':
        return { bg: '#E6F4EA', text: '#15803D', label: 'Accepted' }
      case 'REJECTED':
        return { bg: '#FFDAD6', text: '#93000A', label: 'Rejected' }
      case 'CONVERTED':
        return { bg: '#EDE9FE', text: '#5B21B6', label: 'Converted to Order' }
      default:
        return { bg: '#EFEAE2', text: '#615E57', label: status }
    }
  }

  const executeLoadQuote = (quote: Quotation) => {
    setSelectedQuote(null)
    if (onConvertQuoteToCart) {
      onConvertQuoteToCart(quote.items || [], getQuoteNumber(quote), {
        discount: getDiscount(quote),
        customerName: getCustomerName(quote),
        customerPhone: getCustomerPhone(quote),
        notes: quote.notes || undefined,
      })
    }
    onNavigate('pos')
  }

  const handleReloadQuote = (quote: Quotation) => {
    if (activeCartCount && activeCartCount > 0) {
      Alert.alert(
        'Replace Active Register Cart?',
        `The register already contains ${activeCartCount} item(s) in checkout. Loading quotation ${getQuoteNumber(quote)} will replace your current cart and clear unsaved items.\n\nDo you want to proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace Cart & Load',
            style: 'destructive',
            onPress: () => executeLoadQuote(quote),
          },
        ]
      )
    } else {
      executeLoadQuote(quote)
    }
  }

  const handleConvertQuote = async (quote: Quotation) => {
    if (quote.status === 'CONVERTED') {
      handleReloadQuote(quote)
      return
    }

    const hasActiveCart = activeCartCount && activeCartCount > 0
    const cartWarning = hasActiveCart
      ? `\n\n⚠️ WARNING: The register currently contains ${activeCartCount} item(s). Converting will REPLACE the current cart and clear existing items.`
      : ''

    Alert.alert(
      'Convert Quotation to Sale',
      `Convert quotation ${getQuoteNumber(quote)} into an active POS cart order?\n\n⚠️ IMPORTANT: This action cannot be undone. Once converted, the quotation will be locked and its status cannot be changed or edited.${cartWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasActiveCart ? 'Replace & Convert' : 'Confirm & Convert',
          style: hasActiveCart ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await convertQuotation(quote.id)
            } catch {
              // Optimistic update continues
            }

            setQuotations((prev) =>
              prev.map((q) => (q.id === quote.id ? { ...q, status: 'CONVERTED' } : q))
            )
            executeLoadQuote(quote)
          },
        },
      ]
    )
  }

  const handleUpdateStatus = async (quote: Quotation, newStatus: QuotationStatus) => {
    if (quote.status === 'CONVERTED') {
      Alert.alert(
        'Status Locked',
        'This quotation has already been converted to an active sale order and cannot be modified or reverted.'
      )
      return
    }

    try {
      await updateQuotationStatus(quote.id, newStatus)
      const updated = { ...quote, status: newStatus }
      setQuotations((prev) => prev.map((q) => (q.id === quote.id ? updated : q)))
      setSelectedQuote(updated)
      Alert.alert('Status Updated', `Quotation marked as ${newStatus}.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update quotation status.'
      Alert.alert('Error', msg)
    }
  }

  const onSubmit = async (data: QuotationFormValues) => {
    try {
      setSubmitting(true)
      const sub = data.items.reduce((acc, i) => acc + (parseFloat(String(i.lineTotal)) || 0), 0)
      const disc = parseFloat(data.discount || '0') || 0
      const total = Math.max(0, sub - disc)

      const payload = {
        customer_name: data.customerName,
        customer_phone: data.customerPhone || undefined,
        discount: disc,
        notes: data.notes || undefined,
        items: data.items.map((it) => ({
          variant_id: it.variantId || undefined,
          product_name: it.productName,
          sku: it.sku || undefined,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unitPrice) || 0,
        })),
      }

      const res = await createQuotation(payload)
      if (res && res.data) {
        setQuotations([res.data, ...quotations])
        setCreateModalOpen(false)
        reset()
        Alert.alert('Success', `Quotation ${getQuoteNumber(res.data)} created and marked as Draft/Sent!`)
      }
    } catch (err: unknown) {
      // Create local optimistic quote if offline
      const sub = data.items.reduce((acc, i) => acc + (parseFloat(String(i.lineTotal)) || 0), 0)
      const disc = parseFloat(data.discount || '0') || 0
      const total = Math.max(0, sub - disc)

      const fallbackQ: Quotation = {
        id: `qt-${Date.now()}`,
        quotationNumber: `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        status: 'SENT',
        items: data.items,
        subtotal: sub,
        discount: disc,
        totalAmount: total,
        notes: data.notes || '',
        validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      }

      setQuotations([fallbackQ, ...quotations])
      setCreateModalOpen(false)
      reset()
      Alert.alert('Created (Offline Mode)', `Quotation ${fallbackQ.quotationNumber} saved locally.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Compact toolbar: search + add icon */}
      <View style={styles.compactToolbar}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search quote #, customer, phone, products..."
          containerStyle={styles.searchBarContainer}
        />
        {Boolean(can('quotations:create')) && (
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => setCreateModalOpen(true)}
            accessibilityLabel="New Quote"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={tokens.colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'REJECTED'].map((st) => (
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

      {/* Quotations List */}
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
            <Text style={styles.loadingText}>Loading quotations from server...</Text>
          </View>
        ) : filteredQuotes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={tokens.colors.secondaryFixedDim} />
            <Text style={styles.emptyTitle}>No Quotations Found</Text>
            <Text style={styles.emptyText}>Create a new price quotation for your customers.</Text>
          </View>
        ) : (
          filteredQuotes.map((quote) => {
            const badge = getStatusBadge(quote.status)
            const total = getTotalAmount(quote)
            const qNum = getQuoteNumber(quote)
            const cName = getCustomerName(quote)
            const cPhone = getCustomerPhone(quote)
            const vDate = getValidUntil(quote)
            const itemCount = quote.items?.length || 1

            return (
              <TouchableOpacity
                key={quote.id}
                style={styles.quoteCard}
                onPress={() => setSelectedQuote(quote)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.headerTitleCol}>
                    <View style={styles.quoteNumRow}>
                      <Ionicons name="document-text-outline" size={13} color={tokens.colors.primaryContainer} style={{ marginRight: 4 }} />
                      <Text style={styles.quoteNum} numberOfLines={1} ellipsizeMode="tail">{qNum}</Text>
                    </View>
                    <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">{cName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardBody}>
                  <View style={styles.itemSummaryRow}>
                    <Text style={styles.itemSummaryText}>{itemCount} item(s)</Text>
                    <Text style={styles.validText}>Valid until: {vDate}</Text>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.phoneText} numberOfLines={1}>{cPhone || 'No phone'}</Text>
                    <Text style={styles.totalPrice}>${total.toFixed(2)}</Text>
                  </View>
                </View>

                {Boolean(quote.status === 'ACCEPTED' && (Boolean(can('pos:checkout')) || Boolean(can('quotations:create')))) && (
                  <TouchableOpacity
                    style={styles.convertBar}
                    onPress={() => handleConvertQuote(quote)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="arrow-forward-circle" size={16} color={tokens.colors.onPrimary} />
                    <Text style={styles.convertBarText}>Convert to Active Sale</Text>
                  </TouchableOpacity>
                )}

                {Boolean(quote.status === 'CONVERTED' && (Boolean(can('pos:checkout')) || Boolean(can('quotations:create')))) && (
                  <TouchableOpacity
                    style={[styles.convertBar, { backgroundColor: '#F3E8FF' }]}
                    onPress={() => handleReloadQuote(quote)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={15} color="#5B21B6" />
                    <Text style={[styles.convertBarText, { color: '#5B21B6' }]}>Re-load into POS Cart</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>

      {/* Quote Details Modal (Reusing DigitalReceipt & Share from Invoice/Transactions) */}
      {selectedQuote ? (
        <Modal visible={true} animationType="slide" onRequestClose={() => setSelectedQuote(null)} statusBarTranslucent>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
              <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 24 }}>
                <DigitalReceipt
                  ref={quoteRef}
                  documentType="Quotation"
                  documentNumber={getQuoteNumber(selectedQuote)}
                  validUntil={getValidUntil(selectedQuote)}
                  discount={getDiscount(selectedQuote)}
                  footerMessage={selectedQuote.notes || undefined}
                  customerName={getCustomerName(selectedQuote)}
                  customerPhone={getCustomerPhone(selectedQuote)}
                  items={(selectedQuote.items || []).map((item, idx) => {
                    const pName = item.product_name || item.productName || 'Product'
                    const uPrice = typeof item.unit_price === 'number' ? item.unit_price : typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unit_price || item.unitPrice || '0')) || 0
                    const tPrice = typeof item.line_total === 'number' ? item.line_total : typeof item.lineTotal === 'number' ? item.lineTotal : parseFloat(String(item.line_total || item.lineTotal || (item.quantity * uPrice))) || (item.quantity * uPrice)
                    return {
                      id: item.id || `qi-${idx}`,
                      name: pName,
                      sku: item.sku || 'SKU',
                      quantity: item.quantity,
                      unitPrice: uPrice,
                      totalPrice: tPrice,
                    }
                  })}
                  subtotal={getSubtotal(selectedQuote)}
                  tax={0}
                  amountPaid={0}
                  balanceDue={getTotalAmount(selectedQuote)}
                />

                {/* Status Switcher Action Bar (Outside of ViewShot) */}
                {Boolean(!isCapturing) && (
                  <View style={{ marginTop: 16 }}>
                    {selectedQuote.status === 'CONVERTED' ? (
                      <View style={styles.convertedStatusBanner}>
                        <Ionicons name="lock-closed" size={18} color="#5B21B6" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.convertedStatusBannerTitle}>Converted to Sale Order</Text>
                          <Text style={styles.convertedStatusBannerSubtitle}>
                            This quotation has been converted into an active sale and cannot be modified.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.statusChangeRow}>
                        <Text style={styles.statusChangeLabel}>Update Status:</Text>
                        <View style={styles.statusButtonGroup}>
                          {(['SENT', 'ACCEPTED', 'REJECTED'] as QuotationStatus[]).map((st) => (
                            <TouchableOpacity
                              key={st}
                              style={[
                                styles.statusToggleBtn,
                                selectedQuote.status === st && styles.statusToggleBtnActive,
                              ]}
                              onPress={() => handleUpdateStatus(selectedQuote, st)}
                            >
                              <Text
                                style={[
                                  styles.statusToggleText,
                                  selectedQuote.status === st && styles.statusToggleTextActive,
                                ]}
                              >
                                {st.charAt(0) + st.slice(1).toLowerCase()}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Action buttons: Convert to Order & Share */}
                    <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
                      {selectedQuote.status !== 'CONVERTED' ? (
                        <TouchableOpacity
                          style={[styles.convertBtn, { flex: 1, marginTop: 0, marginBottom: 0 }]}
                          onPress={() => handleConvertQuote(selectedQuote)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="cart" size={18} color={tokens.colors.onPrimary} />
                          <Text style={styles.convertBtnText}>Convert to POS</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.convertBtn, { flex: 1, marginTop: 0, marginBottom: 0, backgroundColor: '#5B21B6' }]}
                          onPress={() => handleReloadQuote(selectedQuote)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="cart" size={18} color={tokens.colors.onPrimary} />
                          <Text style={styles.convertBtnText}>Re-load POS Cart</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.shareQuotationBtn, { flex: 1, marginTop: 0, marginBottom: 0 }, isCapturing && { opacity: 0.7 }]}
                        onPress={() => handleShareQuotation(selectedQuote)}
                        activeOpacity={0.8}
                        disabled={isCapturing}
                      >
                        {isCapturing ? (
                          <ActivityIndicator size="small" color={tokens.colors.primary} />
                        ) : (
                          <Ionicons name="share-social-outline" size={18} color={tokens.colors.primary} />
                        )}
                        <Text style={styles.shareQuotationBtnText}>{isCapturing ? 'Preparing...' : 'Share'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Sticky Bottom Footer CTA */}
              <View style={styles.footer}>
                <View style={styles.footerButtonsRow}>
                  <TouchableOpacity
                    style={styles.closeFooterButton}
                    onPress={() => setSelectedQuote(null)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Text style={styles.closeFooterButtonText}>Close Quotation</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}

      {/* New Quotation Modal */}
      <Modal visible={createModalOpen} transparent animationType="slide" onRequestClose={() => setCreateModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.detailTitle}>Create New Quotation</Text>
              <TouchableOpacity onPress={() => setCreateModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
              <ControlledInput
                name="customerName"
                control={control}
                label="Customer Name *"
                placeholder="e.g. Acme Corporation / John Doe"
              />
              <ControlledInput
                name="customerPhone"
                control={control}
                label="Customer Phone *"
                placeholder="+855 ..."
                inputProps={{ keyboardType: 'phone-pad' }}
              />

              <View style={styles.itemsSection}>
                <Text style={styles.formLabel}>Items in Quotation</Text>
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
                      appendItem({
                        id: `item-${Date.now()}`,
                        variantId: `v-${Date.now()}`,
                        productName: '',
                        sku: 'SKU-CUSTOM',
                        quantity: 1,
                        unitPrice: 0,
                        lineTotal: 0,
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={tokens.colors.primary} />
                    <Text style={[styles.addItemBtnText, { color: tokens.colors.primary }]}>Custom</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {itemFields.map((item, idx) => (
                <View key={item.id} style={styles.createItemBox}>
                  <View style={styles.itemBoxTopRow}>
                    <Text style={styles.itemBoxIndex}>Item #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleRemoveItemWithConfirm(idx, item.productName)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={tokens.colors.actionDestructive} />
                    </TouchableOpacity>
                  </View>
                  <ControlledInput
                    name={`items.${idx}.productName`}
                    control={control}
                    label=""
                    placeholder="Product Name"
                    inputProps={{ style: styles.itemInput }}
                  />
                  <View style={styles.inlineInputs}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <ControlledInput
                        name={`items.${idx}.quantity`}
                        control={control}
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
                        control={control}
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
                name="discount"
                control={control}
                label="Discount Amount ($)"
                placeholder="0.00"
                inputProps={{ keyboardType: 'numeric' }}
              />

              <ControlledInput
                name="notes"
                control={control}
                label="Notes / Validity Terms"
                placeholder="Quote valid for 14 days..."
                inputProps={{ multiline: true, style: [styles.input, { height: 60 }] }}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit(onSubmit)}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                ) : (
                  <Text style={styles.submitBtnText}>Save & Send Quotation</Text>
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
          await handleScanBarcodeForQuotation(code)
        }}
        isLoading={isScanning}
      />

      {/* Product Catalog Selection Modal */}
      <ProductPickerModal
        visible={catalogOpen}
        title="Select Products for Quotation"
        subtitle="Grouped by product catalog with live stock & prices"
        priceType="selling"
        existingItems={quotationExistingItems}
        onClose={() => setCatalogOpen(false)}
        onSelect={handleSelectProductForQuotation}
        onSelectMultiple={handleSelectMultipleProductsForQuotation}
      />
    </View>
  )
}

const styles = StyleSheet.create({
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
  quoteCard: {
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
  quoteNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quoteNum: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
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
  cardBody: {},
  itemSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemSummaryText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  validText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  phoneText: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    flex: 1,
    minWidth: 0,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  convertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
    gap: 6,
  },
  convertBarText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
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
  statusChangeRow: {
    marginBottom: 14,
  },
  statusChangeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  statusButtonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  statusToggleBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  statusToggleTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
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
    color: tokens.colors.primaryContainer,
  },
  notesBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  notesText: {
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
  },
  actionButtonsRow: {
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  convertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  convertBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  printBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
  },
  itemsSection: {
    marginTop: 8,
    marginBottom: 6,
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
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  itemBoxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemBoxIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  itemInput: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 8,
    fontSize: 12,
    height: 36,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  inlineInputs: {
    flexDirection: 'row',
    marginTop: 4,
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
  },
  submitBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  convertedStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  convertedStatusBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },
  convertedStatusBannerSubtitle: {
    fontSize: 11,
    color: '#6D28D9',
    marginTop: 2,
  },
  convertedBadgeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    paddingVertical: 14,
  },
  convertedBadgeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B21B6',
  },
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  shareQuotationBtn: {
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
  shareQuotationBtnText: {
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
})

export default QuotationsScreen
