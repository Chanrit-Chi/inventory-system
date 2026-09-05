import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import { useDebounce } from '../hooks/useDebounce'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { quotationSchema, QuotationFormValues } from '../utils/validation'
import {
  fetchQuotations,
  createQuotation,
  updateQuotationStatus,
  convertQuotation,
} from '../api/endpoints'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import { matchSearch } from '../utils/searchHelper'
import { ProductPickerModal, SelectedProductItem, ExistingPickerItem } from '../components/ProductPickerModal'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { getPrinterConfig } from '../utils/thermalPrinter'
import type { PrinterConfig } from '../utils/thermalPrinter'
import type { CartCheckoutPreset } from '../hooks/useCart'
import type { Quotation, QuotationItem, QuotationStatus, TabType, Product, ProductVariant, ScannedVariant } from '../types'
import { styles } from './quotations/QuotationsScreen.styles'
import {
  getQuoteNumber,
  getCustomerName,
  getCustomerPhone,
  getDiscount,
} from './quotations/quotationUtils'
import { QuotationCardItem } from './quotations/components/QuotationCardItem'
import { QuotationFilterToolbar } from './quotations/components/QuotationFilterToolbar'
import { QuotationDetailModal } from './quotations/components/QuotationDetailModal'
import { CreateQuotationModal } from './quotations/components/CreateQuotationModal'

export interface QuotationsScreenProps {
  onNavigate: (tab: TabType) => void
  onConvertQuoteToCart?: (items: QuotationItem[], quoteNumber?: string, preset?: CartCheckoutPreset) => void
  activeCartCount?: number
}

export const QuotationsScreen: React.FC<QuotationsScreenProps> = ({
  onNavigate,
  onConvertQuoteToCart,
  activeCartCount = 0,
}) => {
  const { showToast } = useToast()
  const { can } = usePermissions()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Selected Quotation for details modal
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [_printerConfig, setPrinterConfig] = useState<PrinterConfig | null>(null)
  const quoteRef = React.useRef<any>(null)

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
    } catch (error) {
      setIsCapturing(false)
      const message = error instanceof Error ? error.message : 'Could not generate or share quotation.'
      Alert.alert('Error', message)
    }
  }

  // Create Quotation Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const { control, handleSubmit, reset, getValues, watch } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      notes: '',
      discount: '0',
      items: [],
    },
  })

  const { fields: itemFields, append: appendItem, remove: removeItem, update: updateItem } = useFieldArray({
    control,
    name: 'items',
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
      const attrNames = (variant.attribute_values || []).map((av) => av.value_name).filter(Boolean).join(' / ')
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
      const unitPrice = parseFloat(String(v?.selling_price_override || (v as ProductVariant)?.selling_price || prod.selling_price || '0')) || 0
      const attrSummary = v?.attribute_values?.map((av) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
      const displayName = v ? ((v as ProductVariant).name || (attrSummary ? `${prod.name} (${attrSummary})` : `${prod.name} - ${v.sku}`)) : prod.name
      const sku = v?.sku || prod.sku || 'SKU-CUSTOM'
      const variantId = v?.id || prod.variants?.[0]?.id || `v-${Date.now()}`
      const addQty = Math.max(1, Math.round(it.quantity || 1))

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

  const loadQuotations = useCallback(
    async (pageNum = 1, isLoadMore = false) => {
      try {
        if (!isLoadMore) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }
        const res = await fetchQuotations({
          page: pageNum,
          per_page: 20,
          search: debouncedSearch.trim() || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        })
        const resData = res?.data
        let list: Quotation[] = []
        let meta = (res as any)?.meta
        if (Array.isArray(resData)) {
          list = resData
        } else if (resData && typeof resData === 'object' && 'data' in resData && Array.isArray((resData as any).data)) {
          list = (resData as any).data
          if (!meta && 'current_page' in resData) {
            meta = resData as any
          }
        }
        if (isLoadMore) {
          setQuotations((prev) => {
            const seen = new Set(prev.map((q) => q.id))
            const fresh = list.filter((q) => !seen.has(q.id))
            return [...prev, ...fresh]
          })
        } else {
          setQuotations(list)
        }
        setPage(pageNum)
        if (meta) {
          setHasMore(meta.current_page < meta.last_page)
        } else {
          setHasMore(list.length >= 20)
        }
      } catch {
        if (!isLoadMore) setQuotations([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [debouncedSearch, statusFilter]
  )

  useEffect(() => {
    loadQuotations(1, false)
  }, [loadQuotations])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadQuotations(1, false)
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
        showToast(`Quotation ${getQuoteNumber(res.data)} created and ready!`, 'success')
      }
    } catch (err: unknown) {
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
      showToast(`Quotation ${fallbackQ.quotationNumber} saved locally.`, 'warning')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Compact toolbar & search */}
      <QuotationFilterToolbar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        canCreateQuote={Boolean(can('quotations:create'))}
        onOpenCreateModal={() => setCreateModalOpen(true)}
      />

      {/* Quotations List */}
      <FlatList
        data={filteredQuotes}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (!loading && !loadingMore && hasMore && filteredQuotes.length > 0) {
            loadQuotations(page + 1, true)
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primaryContainer}
            colors={[tokens.colors.primaryContainer]}
          />
        }
        renderItem={({ item: quote }) => (
          <QuotationCardItem
            key={quote.id}
            quote={quote}
            onSelectQuote={setSelectedQuote}
            onConvertQuote={handleConvertQuote}
            canConvert={Boolean(can('pos:checkout')) || Boolean(can('quotations:create'))}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
              <Text style={{ fontSize: 13, color: tokens.colors.secondary, fontFamily: tokens.fonts.medium }}>
                Loading more quotations...
              </Text>
            </View>
          ) : !hasMore && filteredQuotes.length > 0 ? (
            <View style={{ paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle-outline" size={14} color={tokens.colors.secondary} />
              <Text style={{ fontSize: 13, color: tokens.colors.secondary, fontFamily: tokens.fonts.medium }}>
                All quotations loaded
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
              <Text style={styles.loadingText}>Loading quotations from server...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={tokens.colors.secondaryFixedDim} />
              <Text style={styles.emptyTitle}>No Quotations Found</Text>
              <Text style={styles.emptyText}>Create a new price quotation for your customers.</Text>
            </View>
          )
        }
      />

      {/* Quote Details Modal */}
      <QuotationDetailModal
        quote={selectedQuote}
        quoteRef={quoteRef}
        isCapturing={isCapturing}
        onClose={() => setSelectedQuote(null)}
        onUpdateStatus={handleUpdateStatus}
        onConvertQuote={handleConvertQuote}
        onReloadQuote={handleReloadQuote}
        onShareQuotation={handleShareQuotation}
      />

      {/* New Quotation Modal */}
      <CreateQuotationModal
        visible={createModalOpen}
        control={control}
        itemFields={itemFields}
        submitting={submitting}
        onClose={() => setCreateModalOpen(false)}
        onOpenCatalog={() => setCatalogOpen(true)}
        onOpenScanner={() => setScannerOpen(true)}
        onAppendCustomItem={() =>
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
        onRemoveItemWithConfirm={handleRemoveItemWithConfirm}
        onSubmit={handleSubmit(onSubmit)}
      />

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

export default QuotationsScreen
