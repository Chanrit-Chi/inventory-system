import { usePermissions } from '../hooks/usePermissions'
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { getProducts, fetchSuppliers, scanBarcode, createSupplier } from '../api/endpoints'
import { ProductPickerModal, SelectedProductItem, ExistingPickerItem } from './ProductPickerModal'
import { ProductGroupHeader } from './ProductGroupHeader'
import { CopyableBadge } from './CopyableBadge'
import { CameraScannerModal } from './CameraScannerModal'
import { SupplierFormModal } from '../screens/products/components/SupplierFormModal'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import type { PurchaseOrder, PurchaseOrderItem, Product, Supplier, ProductVariant, ScannedVariant, ScannedAttributeValue } from '../types'

export interface PurchaseOrderModalProps {
  visible: boolean
  onClose: () => void
  purchaseOrders?: PurchaseOrder[]
  onAddPO?: (po: PurchaseOrder) => void
  onMarkPoReceived?: (poId: string) => void
  onOpenStockIn?: () => void
  initialMode?: 'list' | 'create'
  preSelectedSupplierId?: string
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  visible,
  onClose,
  purchaseOrders = [],
  onAddPO,
  onMarkPoReceived,
  onOpenStockIn,
  initialMode = 'create',
  preSelectedSupplierId,
}) => {
  const { can } = usePermissions()
  const [mode, setMode] = useState<'list' | 'create'>(initialMode)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search & Filter for List Mode
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'>('ALL')

  // Create PO Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(preSelectedSupplierId || '')
  const [poExpectedDate, setPoExpectedDate] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([])
  const [showMetaCard, setShowMetaCard] = useState(true)

  // Inline Supplier Creation Modal State
  const [newSupModalOpen, setNewSupModalOpen] = useState(false)
  const [newSupName, setNewSupName] = useState('')
  const [newSupContact, setNewSupContact] = useState('')
  const [newSupPhone, setNewSupPhone] = useState('')
  const [newSupEmail, setNewSupEmail] = useState('')
  const [newSupAddress, setNewSupAddress] = useState('')
  const [newSupLeadTime, setNewSupLeadTime] = useState('')

  const handleCreateSupplier = async () => {
    if (!newSupName.trim()) {
      Alert.alert('Validation Error', 'Supplier / Company name is required.')
      return
    }
    try {
      const res: any = await createSupplier({
        name: newSupName.trim(),
        contact_person: newSupContact.trim() || undefined,
        phone: newSupPhone.trim() || 'N/A',
        email: newSupEmail.trim() || undefined,
        address: newSupAddress.trim() || undefined,
        lead_time_days: parseInt(newSupLeadTime, 10) || 3,
      })
      const createdSup: Supplier = {
        id: res?.data?.data?.id || res?.data?.id || res?.id || `sup-${Date.now()}`,
        name: res?.data?.data?.name || res?.data?.name || res?.name || newSupName.trim() || 'New Supplier',
        phone: res?.data?.data?.phone || res?.data?.phone || res?.phone || newSupPhone.trim() || '',
        leadTimeDays: parseInt(newSupLeadTime, 10) || 3,
      }
      setSuppliers((prev) => [createdSup, ...prev.filter((s) => s.id !== createdSup.id)])
      setSelectedSupplierId(createdSup.id)
      setNewSupModalOpen(false)
      setNewSupName('')
      setNewSupContact('')
      setNewSupPhone('')
      setNewSupEmail('')
      setNewSupAddress('')
      setNewSupLeadTime('')
      showToast(`Supplier "${createdSup.name}" created and selected!`)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create supplier.')
    }
  }

  // Catalog Picker & Barcode Scanner State
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const hardwareInputRef = useRef<TextInput>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // PO Detail View Modal State
  const [selectedPoDetail, setSelectedPoDetail] = useState<PurchaseOrder | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToastMessage(''), 3000)
  }, [])

  // Sync mode and pre-selected supplier when modal opens
  useEffect(() => {
    if (visible) {
      setMode(initialMode)
      if (preSelectedSupplierId) {
        setSelectedSupplierId(preSelectedSupplierId)
      }
    }
  }, [visible, initialMode, preSelectedSupplierId])

  // Load suppliers and products
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [supRes, prodRes] = await Promise.allSettled([
        fetchSuppliers(),
        getProducts({ per_page: 100 }),
      ])

      if (supRes.status === 'fulfilled' && supRes.value) {
        const supList: Supplier[] = Array.isArray(supRes.value) ? supRes.value : (supRes.value as any)?.data || []
        setSuppliers(supList)
        if (supList.length > 0 && !selectedSupplierId && !preSelectedSupplierId) {
          setSelectedSupplierId(supList[0].id)
        }
      }

      if (prodRes.status === 'fulfilled' && prodRes.value) {
        const prodList: Product[] = Array.isArray(prodRes.value) ? prodRes.value : (prodRes.value as any)?.data || []
        setProducts(prodList)
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false)
    }
  }, [selectedSupplierId, preSelectedSupplierId])

  useEffect(() => {
    if (visible) {
      loadData()
    }
  }, [visible, loadData])

  // Filtered list of purchase orders
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      return (
        po.poNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        po.items.some((it) => it.productName.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q))
      )
    })
  }, [purchaseOrders, statusFilter, search])

  // Existing items for catalog picker
  const existingPickerItems: ExistingPickerItem[] = useMemo(() => {
    return poItems.map((it) => ({
      variantId: it.variantId,
      sku: it.sku,
      productName: it.productName,
      quantity: it.quantity,
    }))
  }, [poItems])

  const handleAddVariantToPO = useCallback((item: {
    variantId: string
    productId?: string
    parentProductName?: string
    displayName: string
    sku: string
    costPrice: number
    quantity?: number
    imageUrl?: string
  }) => {
    setPoItems((prev) => {
      const idx = prev.findIndex((i) => i.variantId === item.variantId)
      if (idx >= 0) {
        const next = [...prev]
        const nextQty = next[idx].quantity + (item.quantity || 1)
        next[idx] = {
          ...next[idx],
          quantity: nextQty,
          totalCost: nextQty * next[idx].unitCost,
        }
        return next
      }
      const qty = item.quantity || 1
      const newItem: PurchaseOrderItem = {
        id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        variantId: item.variantId,
        productId: item.productId,
        parentProductName: item.parentProductName || item.displayName.split(' (')[0].split(' - ')[0],
        productName: item.displayName,
        sku: item.sku,
        quantity: qty,
        unitCost: item.costPrice,
        totalCost: qty * item.costPrice,
        imageUrl: item.imageUrl,
      }
      return [newItem, ...prev]
    })
  }, [])

  // Barcode Scanner Hook for Purchase Order Modal
  const {
    scannerOpen,
    setScannerOpen,
    loading: scanLoading,
    handleScanCode,
  } = useBarcodeScan({
    mode: 'purchase-order',
    customToast: showToast,
    onBeforeProcess: (code) => {
      const existingItem = poItems.find((i) => i.sku === code || i.variantId === code)
      if (existingItem) {
        setPoItems((prev) =>
          prev.map((i) =>
            i.id === existingItem.id
              ? { ...i, quantity: i.quantity + 1, totalCost: (i.quantity + 1) * i.unitCost }
              : i
          )
        )
        showToast(`+1 ${existingItem.productName}`)
        return true
      }
      return false
    },
    onFoundVariant: (variant, product) => {
      const cost = parseFloat(String(product?.purchase_price || '0')) || 0
      const name = product?.name ? `${product.name} (${variant.sku})` : 'Product'
      handleAddVariantToPO({
        variantId: variant.id,
        displayName: name,
        sku: variant.sku || 'SKU',
        costPrice: cost,
      })
      showToast(`Added ${name}`)
    },
    onFoundProduct: (product, variants) => {
      const v = variants[0]
      const cost = parseFloat(String(product.purchase_price || '0')) || 0
      handleAddVariantToPO({
        variantId: v ? v.id : product.id,
        displayName: product.name,
        sku: v?.sku || product.barcode || 'SKU',
        costPrice: cost,
      })
      showToast(`Added ${product.name}`)
    },
  })

  // Catalog picker single selection
  const handleSelectProductForPO = (product: Product, variant?: ProductVariant | ScannedVariant) => {
    const cost = parseFloat(String((variant as ProductVariant)?.cost_price_override || product.purchase_price || '0')) || 0
    const varId = variant?.id || product.variants?.[0]?.id || product.id
    const sku = variant?.sku || product.sku || 'SKU'
    const attrSummary = (variant as ProductVariant)?.attribute_values?.map((av: ScannedAttributeValue) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
    const name = variant ? ((variant as ProductVariant).name || (attrSummary ? `${product.name} (${attrSummary})` : `${product.name} - ${sku}`)) : product.name
    handleAddVariantToPO({
      variantId: varId,
      displayName: name,
      sku: sku,
      costPrice: cost,
      quantity: 1,
    })
    showToast(`Added ${name}`)
    setCatalogPickerOpen(false)
  }

  // Catalog picker batch selection
  const handleSelectMultipleProductsForPO = (items: SelectedProductItem[]) => {
    items.forEach((item) => {
      const cost = parseFloat(String((item.variant as ProductVariant)?.cost_price_override || item.product.purchase_price || '0')) || 0
      const varId = item.variant?.id || item.product.variants?.[0]?.id || item.product.id
      const sku = item.variant?.sku || item.product.sku || 'SKU'
      const attrSummary = (item.variant as ProductVariant)?.attribute_values?.map((av: ScannedAttributeValue) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
      const name = item.variant ? ((item.variant as ProductVariant).name || (attrSummary ? `${item.product.name} (${attrSummary})` : `${item.product.name} - ${sku}`)) : item.product.name
      handleAddVariantToPO({
        variantId: varId,
        productId: item.product.id,
        parentProductName: item.product.name,
        displayName: name,
        sku: sku,
        costPrice: cost,
        quantity: item.quantity,
        imageUrl: item.product.image_url || undefined,
      })
    })
    showToast(`Added ${items.length} item${items.length > 1 ? 's' : ''}`)
    setCatalogPickerOpen(false)
  }

  const handleUpdateItemQty = (id: string, delta: number) => {
    setPoItems((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const newQty = Math.max(1, it.quantity + delta)
            return { ...it, quantity: newQty, totalCost: newQty * it.unitCost }
          }
          return it
        })
        .filter((it) => it.quantity > 0)
    )
  }

  const handleUpdateItemCost = (id: string, costStr: string) => {
    const cost = parseFloat(costStr) || 0
    setPoItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          return { ...it, unitCost: cost, totalCost: it.quantity * cost }
        }
        return it
      })
    )
  }

  interface PoGroup {
    groupKey: string
    parentName: string
    imageUrl?: string
    items: PurchaseOrderItem[]
    totalQty: number
    totalCost: number
  }

  const groupedPoItems = useMemo<PoGroup[]>(() => {
    const groups: Record<string, PoGroup> = {}
    poItems.forEach((it) => {
      const groupKey = it.productId || it.parentProductName || it.productName.split(' (')[0].split(' - ')[0]
      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          parentName: it.parentProductName || it.productName.split(' (')[0].split(' - ')[0],
          imageUrl: it.imageUrl,
          items: [],
          totalQty: 0,
          totalCost: 0,
        }
      }
      groups[groupKey].items.push(it)
      groups[groupKey].totalQty += it.quantity
      groups[groupKey].totalCost += it.totalCost
    })
    return Object.values(groups)
  }, [poItems])

  const handleRemovePoItemWithConfirm = (item: PurchaseOrderItem) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove "${item.productName}" from this purchase order?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPoItems((prev) => prev.filter((it) => it.id !== item.id))
            showToast('Removed item from PO')
          },
        },
      ]
    )
  }

  const handleRemoveParentGroupWithConfirm = (group: PoGroup) => {
    Alert.alert(
      'Remove All Variants',
      `Are you sure you want to remove all ${group.items.length} variants of "${group.parentName}" from this order?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: () => {
            const idsToRemove = new Set(group.items.map((i) => i.id))
            setPoItems((prev) => prev.filter((it) => !idsToRemove.has(it.id)))
            showToast(`Removed all variants of ${group.parentName}`)
          },
        },
      ]
    )
  }

  const handleRemovePoItem = (id: string) => {
    setPoItems((prev) => prev.filter((it) => it.id !== id))
    showToast('Removed item from PO')
  }

  const totalLoggedItems = poItems.length
  const totalUnits = poItems.reduce((s, it) => s + it.quantity, 0)
  const totalValue = poItems.reduce((s, it) => s + it.totalCost, 0)
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)

  // Submit and Save PO
  const handleSavePO = () => {
    if (!can('purchase-orders:create') && !can('purchase-orders:*')) {
      Alert.alert('Access Restricted', 'You do not have permission to create purchase orders.')
      return
    }
    if (!selectedSupplierId) {
      Alert.alert('Validation Error', 'Please select a supplier for this purchase order.')
      return
    }
    if (poItems.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one line item to the purchase order.')
      return
    }
    for (const item of poItems) {
      if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        Alert.alert('Validation Error', `Item "${item.productName}" must have a valid quantity of at least 1.`)
        return
      }
      if (item.unitCost === undefined || item.unitCost === null || isNaN(item.unitCost) || item.unitCost < 0) {
        Alert.alert('Validation Error', `Item "${item.productName}" must have a valid unit cost (>= 0).`)
        return
      }
    }

    setIsSubmitting(true)
    const sup = suppliers.find((s) => s.id === selectedSupplierId)
    const poNum = `PO-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

    const newPO: PurchaseOrder = {
      id: `po_${Date.now()}`,
      poNumber: poNum,
      supplierId: selectedSupplierId,
      supplierName: sup?.name || 'Standard Vendor',
      status: 'ORDERED',
      items: poItems,
      totalCost: totalValue,
      expectedDeliveryDate: poExpectedDate || new Date().toISOString().split('T')[0],
      orderDate: new Date().toISOString().split('T')[0],
      notes: poNotes || undefined,
    }

    if (onAddPO) {
      onAddPO(newPO)
    }

    setIsSubmitting(false)
    Alert.alert(
      'Purchase Order Created',
      `PO "${poNum}" issued to ${sup?.name || 'supplier'}.\nTotal Value: $${totalValue.toFixed(2)} (${totalUnits} units).`,
      [
        {
          text: 'View Orders',
          onPress: () => {
            setPoItems([])
            setPoNotes('')
            setPoExpectedDate('')
            setMode('list')
          },
        },
        {
          text: 'Done',
          onPress: () => {
            setPoItems([])
            setPoNotes('')
            setPoExpectedDate('')
            onClose()
          },
        },
      ]
    )
  }

  const handleMarkReceived = (poId: string) => {
    if (onMarkPoReceived) {
      onMarkPoReceived(poId)
    }
    if (selectedPoDetail && selectedPoDetail.id === poId) {
      setSelectedPoDetail({ ...selectedPoDetail, status: 'RECEIVED' })
    }
    Alert.alert('PO Received', 'Purchase order status updated to RECEIVED.')
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.safeArea}>
        {/* Floating Toast Notification */}
        {!!toastMessage && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Inline Supplier Registration Modal */}
      <SupplierFormModal
        newSupModalOpen={newSupModalOpen}
        setNewSupModalOpen={setNewSupModalOpen}
        newSupName={newSupName}
        setNewSupName={setNewSupName}
        newSupContact={newSupContact}
        setNewSupContact={setNewSupContact}
        newSupPhone={newSupPhone}
        setNewSupPhone={setNewSupPhone}
        newSupEmail={newSupEmail}
        setNewSupEmail={setNewSupEmail}
        newSupAddress={newSupAddress}
        setNewSupAddress={setNewSupAddress}
        newSupLeadTime={newSupLeadTime}
        setNewSupLeadTime={setNewSupLeadTime}
        handleCreateSupplier={handleCreateSupplier}
      />

      {/* Barcode Camera Scanner Modal */}
        <CameraScannerModal
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanCode={async (code) => { await handleScanCode(code) }}
          isLoading={scanLoading}
        />

        {/* Product Catalog Picker Modal */}
        <ProductPickerModal
          visible={catalogPickerOpen}
          title="Select Products for Purchase Order"
          subtitle="Select items with live supplier cost prices"
          priceType="cost"
          products={products}
          existingItems={existingPickerItems}
          onClose={() => setCatalogPickerOpen(false)}
          onSelect={handleSelectProductForPO}
          onSelectMultiple={handleSelectMultipleProductsForPO}
          onRefreshCatalog={loadData}
        />

        <View style={styles.container}>
          {/* Header Bar matching StockInModal */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeRow}>
                <View style={[styles.statusPill, { backgroundColor: '#E0F2FE' }]}>
                  <View style={[styles.statusDot, { backgroundColor: tokens.colors.primaryContainer }]} />
                  <Text style={[styles.statusPillText, { color: tokens.colors.primaryContainer, fontWeight: '700' }]}>
                    {mode === 'create' ? 'Draft Purchase Order' : 'Procurement Orders'}
                  </Text>
                </View>
                {selectedSupplier ? (
                  <View style={styles.poBadge}>
                    <Text style={styles.poBadgeText}>{selectedSupplier.name}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.supplierTitle}>
                {mode === 'create'
                  ? selectedSupplier?.name || 'New Purchase Order'
                  : 'Purchase Orders'}
              </Text>
              <Text style={styles.dateSubtitle}>
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                • {mode === 'create' ? 'Supplier Procurement Draft' : `${purchaseOrders.length} total orders`}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {mode === 'create' && (
                <TouchableOpacity
                  style={styles.scanShortcutBtn}
                  onPress={() => setScannerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="barcode-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.scanShortcutText}>Scan</Text>
                </TouchableOpacity>
              )}

              <TextInput
                ref={hardwareInputRef}
                style={styles.hiddenHardwareScanner}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                onSubmitEditing={() => {
                  if (barcodeInput.trim()) {
                    handleScanCode(barcodeInput.trim())
                    setBarcodeInput('')
                  }
                  hardwareInputRef.current?.focus()
                }}
                autoFocus={true}
                showSoftInputOnFocus={false}
                blurOnSubmit={false}
              />

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close modal">
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sub-Header Tab Switcher */}
          <View style={styles.subHeaderTabs}>
            <TouchableOpacity
              style={[styles.subTabPill, mode === 'create' && styles.subTabPillActive]}
              onPress={() => setMode('create')}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={mode === 'create' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text style={[styles.subTabPillText, mode === 'create' && styles.subTabPillTextActive]}>
                New PO Draft {poItems.length > 0 ? `(${poItems.length})` : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subTabPill, mode === 'list' && styles.subTabPillActive]}
              onPress={() => setMode('list')}
            >
              <Ionicons
                name="list-outline"
                size={14}
                color={mode === 'list' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text style={[styles.subTabPillText, mode === 'list' && styles.subTabPillTextActive]}>
                All Orders ({purchaseOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* MODE 1: CREATE PURCHASE ORDER FORM */}
          {mode === 'create' && (
            <View style={{ flex: 1 }}>
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Supplier Selection Carousel Banner */}
                <View style={styles.supplierBanner}>
                  <View style={styles.supplierBannerHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="business-outline" size={16} color={tokens.colors.primaryContainer} />
                      <Text style={styles.supplierBannerTitle}>Target Supplier / Vendor *</Text>
                    </View>
                    <Text style={styles.supplierBannerHint}>Select vendor for pricing</Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.supplierChipsList}
                  >
                    {/* Add Inline + New Supplier Button */}
                    <TouchableOpacity
                      style={styles.addSupplierChipBtn}
                      onPress={() => setNewSupModalOpen(true)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add-circle" size={16} color={tokens.colors.primaryContainer} />
                      <Text style={styles.addSupplierChipBtnText}>+ New Supplier</Text>
                    </TouchableOpacity>

                    {suppliers.map((s) => {
                      const active = selectedSupplierId === s.id
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.supplierChip, active && styles.supplierChipActive]}
                          onPress={() => setSelectedSupplierId(s.id)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.supplierChipTop}>
                            <Text style={[styles.supplierChipName, active && styles.supplierChipNameActive]}>
                              {s.name}
                            </Text>
                            {Boolean(active) && <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />}
                          </View>
                          <Text style={[styles.supplierChipMeta, active && styles.supplierChipMetaActive]}>
                            {s.leadTimeDays ? `${s.leadTimeDays}d lead time` : 'Standard Lead'}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>
                </View>

                {/* Delivery & Order Metadata Card */}
                {Boolean(showMetaCard) && (
                  <View style={styles.metaCard}>
                    <View style={styles.metaRow}>
                      <View style={styles.metaCol}>
                        <Text style={styles.noteLabel}>EXPECTED DELIVERY DATE</Text>
                        <TextInput
                          style={styles.metaInput}
                          value={poExpectedDate}
                          onChangeText={setPoExpectedDate}
                          placeholder="YYYY-MM-DD (e.g. 2026-09-01)"
                          placeholderTextColor={tokens.colors.textDisabled}
                        />
                      </View>
                      <View style={styles.metaCol}>
                        <Text style={styles.noteLabel}>ORDER REF / INVOICE #</Text>
                        <TextInput
                          style={styles.metaInput}
                          placeholder="Auto-generated PO"
                          placeholderTextColor={tokens.colors.textDisabled}
                          editable={false}
                          value={`PO-${new Date().getFullYear()}-AUTO`}
                        />
                      </View>
                    </View>

                    <View style={{ marginTop: tokens.spacing.sm }}>
                      <Text style={styles.noteLabel}>ORDER NOTES / INSTRUCTIONS (OPTIONAL)</Text>
                      <TextInput
                        style={styles.metaInput}
                        value={poNotes}
                        onChangeText={setPoNotes}
                        placeholder="Payment terms, delivery instructions, shipping reference..."
                        placeholderTextColor={tokens.colors.textDisabled}
                      />
                    </View>
                  </View>
                )}

                {/* Line Items Header & Action Buttons */}
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Order Items ({poItems.length})</Text>
                    <Text style={styles.sectionSub}>Verify quantities and unit cost prices</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.browseProductsBtn}
                    onPress={() => setCatalogPickerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={16} color={tokens.colors.onPrimary} />
                    <Text style={styles.browseProductsBtnText}>+ Add Products</Text>
                  </TouchableOpacity>
                </View>

                {/* Empty State */}
                {poItems.length === 0 ? (
                  <View style={styles.emptyIntakeContainer}>
                    <Ionicons name="cube-outline" size={52} color={tokens.colors.primaryFixedDim} />
                    <Text style={styles.emptyIntakeTitle}>No Items in Purchase Order</Text>
                    <Text style={styles.emptyIntakeSub}>
                      Browse the product catalog with supplier costs or scan barcodes with your camera.
                    </Text>
                    <View style={styles.emptyActionRow}>
                      <TouchableOpacity
                        style={styles.emptyActionBtnPrimary}
                        onPress={() => setCatalogPickerOpen(true)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="list" size={18} color={tokens.colors.onPrimary} />
                        <Text style={styles.emptyActionBtnPrimaryText}>Browse Catalog</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.emptyActionBtnSecondary}
                        onPress={() => setScannerOpen(true)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="barcode-outline" size={18} color={tokens.colors.primaryContainer} />
                        <Text style={styles.emptyActionBtnSecondaryText}>Scan Barcode</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  groupedPoItems.map((group) => {
                    const isMultiVariant = group.items.length > 1
                    return (
                      <View key={group.groupKey} style={[styles.itemCard, { padding: 0, overflow: 'hidden' }]}>
                        <ProductGroupHeader
                          parentName={group.parentName}
                          variantCount={group.items.length}
                          totalQty={group.totalQty}
                          totalCost={group.totalCost}
                          onRemoveAll={() => handleRemoveParentGroupWithConfirm(group)}
                        />

                        {group.items.map((item) => (
                          <View key={item.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                            {/* Item Top Row */}
                            <View style={styles.itemTopRow}>
                              <View style={[styles.thumbnailBox, isMultiVariant && { width: 32, height: 32 }]}>
                                <Ionicons name={isMultiVariant ? 'git-branch-outline' : 'cube-outline'} size={isMultiVariant ? 16 : 22} color={tokens.colors.primaryContainer} />
                              </View>

                              <View style={styles.itemInfoCol}>
                                <Text style={styles.itemName} numberOfLines={1}>
                                  {isMultiVariant
                                    ? (item.productName.includes('(') ? item.productName.split('(')[1].replace(')', '') : item.productName)
                                    : item.productName}
                                </Text>
                                <View style={styles.itemMetaRow}>
                                  {Boolean(item.sku) && (
                                    <CopyableBadge
                                      type="sku"
                                      value={item.sku}
                                      compact
                                    />
                                  )}
                                  <Text style={styles.expectedText}>
                                    Total: <Text style={styles.boldText}>${item.totalCost.toFixed(2)}</Text>
                                  </Text>
                                </View>
                              </View>

                              <TouchableOpacity
                                style={styles.trashBtn}
                                onPress={() => handleRemovePoItemWithConfirm(item)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={18} color={tokens.colors.statusError} />
                              </TouchableOpacity>
                            </View>

                            {/* Quantity Stepper & Cost Inputs Row */}
                            <View style={styles.inputsGrid}>
                              {/* Order Quantity Stepper */}
                              <View style={styles.inputCol}>
                                <Text style={styles.fieldLabel}>ORDER QTY</Text>
                                <View style={styles.stepperContainer}>
                                  <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => handleUpdateItemQty(item.id, -1)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="remove" size={16} color={tokens.colors.textPrimary} />
                                  </TouchableOpacity>

                                  <Text style={styles.stepperValue}>{item.quantity}</Text>

                                  <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => handleUpdateItemQty(item.id, 1)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="add" size={16} color={tokens.colors.textPrimary} />
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Unit Cost */}
                              <View style={styles.inputCol}>
                                <Text style={styles.fieldLabel}>UNIT COST ($)</Text>
                                <TextInput
                                  style={styles.textInput}
                                  value={String(item.unitCost)}
                                  onChangeText={(text) => handleUpdateItemCost(item.id, text)}
                                  keyboardType="decimal-pad"
                                  placeholder="0.00"
                                  placeholderTextColor={tokens.colors.textDisabled}
                                />
                              </View>

                              {/* Line Total Display */}
                              <View style={styles.inputCol}>
                                <Text style={styles.fieldLabel}>LINE TOTAL</Text>
                                <View style={[styles.textInput, { justifyContent: 'center', backgroundColor: '#F1F5F9' }]}>
                                  <Text style={[styles.boldText, { color: tokens.colors.primaryContainer, fontSize: 12 }]}>
                                    ${item.totalCost.toFixed(2)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )
                  })
                )}

                {/* Bottom Quick Add Action */}
                {poItems.length > 0 && (
                  <TouchableOpacity
                    style={styles.addUnexpectedBtn}
                    onPress={() => setCatalogPickerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={tokens.colors.primaryContainer} />
                    <Text style={styles.addUnexpectedText}>+ Add More Products to Order</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {/* Sticky Bottom Summary Bar matching StockInModal */}
              <View style={styles.footer}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryLoggedText}>
                    {totalLoggedItems} item(s) • {totalUnits} total units
                  </Text>
                  <Text style={styles.summaryValueText}>
                    Total Value: <Text style={styles.valueHighlight}>${totalValue.toFixed(2)}</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.completeBtn,
                    (totalLoggedItems === 0 || isSubmitting) && styles.completeBtnDisabled,
                  ]}
                  onPress={handleSavePO}
                  disabled={totalLoggedItems === 0 || isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={18} color={tokens.colors.onPrimary} />
                      <Text style={styles.completeBtnText}>Issue PO</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* MODE 2: ALL ORDERS LIST */}
          {mode === 'list' && (
            <View style={{ flex: 1 }}>
              {/* Search Bar */}
              <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color={tokens.colors.secondary} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search PO #, supplier, or product..."
                    placeholderTextColor={tokens.colors.secondary}
                    value={search}
                    onChangeText={setSearch}
                  />
                  {Boolean(search.length > 0) && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Status Filter Chips */}
              <View style={styles.filterContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterScrollContent}
                >
                  {(['ALL', 'ORDERED', 'RECEIVED', 'CANCELLED'] as const).map((status) => {
                    const count =
                      status === 'ALL'
                        ? purchaseOrders.length
                        : purchaseOrders.filter((po) => po.status === status).length
                    const active = statusFilter === status
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => setStatusFilter(status)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {status} ({count})
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>

              {loading && purchaseOrders.length === 0 ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
                  <Text style={styles.loadingText}>Loading purchase orders...</Text>
                </View>
              ) : (
                <FlatList
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  data={filteredPurchaseOrders}
                  keyExtractor={(item) => item.id}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyIntakeContainer}>
                      <Ionicons name="document-text-outline" size={52} color={tokens.colors.primaryFixedDim} />
                      <Text style={styles.emptyIntakeTitle}>No Purchase Orders Found</Text>
                      <Text style={styles.emptyIntakeSub}>
                        {search.length > 0 || statusFilter !== 'ALL'
                          ? 'Try clearing filters or search terms.'
                          : 'Create a new purchase order to order inventory from vendors.'}
                      </Text>
                      {Boolean(can('purchase-orders:create')) && (
                        <TouchableOpacity
                          style={styles.emptyActionBtnPrimary}
                          onPress={() => setMode('create')}
                        >
                          <Ionicons name="add" size={16} color={tokens.colors.onPrimary} />
                          <Text style={styles.emptyActionBtnPrimaryText}>Create New PO</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  }
                  renderItem={({ item: po }) => {
                    const isReceived = po.status === 'RECEIVED'
                    const isOrdered = po.status === 'ORDERED'
                    const firstItem = po.items[0]
                    const totalPoUnits = po.items.reduce((s, it) => s + it.quantity, 0)

                    return (
                      <TouchableOpacity
                        style={styles.itemCard}
                        onPress={() => setSelectedPoDetail(po)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.itemTopRow}>
                          <View style={styles.thumbnailBox}>
                            <Ionicons name="document-text" size={22} color={tokens.colors.primaryContainer} />
                          </View>
                          <View style={styles.itemInfoCol}>
                            <Text style={styles.itemName}>{po.poNumber}</Text>
                            <View style={styles.itemMetaRow}>
                              <View style={styles.itemSkuBadge}>
                                <Text style={styles.itemSkuText}>{po.supplierName}</Text>
                              </View>
                              <Text style={styles.expectedText}>
                                Ordered: <Text style={styles.boldText}>{po.orderDate}</Text>
                              </Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.statusPill,
                              isReceived && { backgroundColor: tokens.colors.badgeSuccessBg },
                              isOrdered && { backgroundColor: '#FEF3C7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                isReceived && { color: tokens.colors.statusSuccess },
                                isOrdered && { color: '#B45309' },
                              ]}
                            >
                              {po.status}
                            </Text>
                          </View>
                        </View>

                        {/* Items Summary */}
                        <View style={styles.poSummaryBox}>
                          <Text style={styles.poSummaryText} numberOfLines={1}>
                            {firstItem ? `${firstItem.productName} (${firstItem.sku})` : 'Procurement Batch'}
                            {po.items.length > 1 ? ` + ${po.items.length - 1} more items` : ''}
                          </Text>
                          <Text style={styles.poSummaryMeta}>
                            {totalPoUnits} units total • Expected: {po.expectedDeliveryDate || 'Standard'}
                          </Text>
                        </View>

                        {/* Card Footer */}
                        <View style={styles.poCardFooter}>
                          <View>
                            <Text style={styles.fieldLabel}>TOTAL VALUE</Text>
                            <Text style={styles.valueHighlight}>${po.totalCost.toFixed(2)}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {Boolean(isOrdered && onOpenStockIn) && (
                              <TouchableOpacity
                                style={styles.stockInActionBtn}
                                onPress={(e) => {
                                  e.stopPropagation()
                                  onClose()
                                  onOpenStockIn?.()
                                }}
                              >
                                <Ionicons name="enter-outline" size={14} color={tokens.colors.onPrimary} />
                                <Text style={styles.stockInActionText}>Stock In</Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={styles.detailsBtn}
                              onPress={() => setSelectedPoDetail(po)}
                            >
                              <Text style={styles.detailsBtnText}>Details</Text>
                              <Ionicons name="chevron-forward" size={12} color={tokens.colors.primaryContainer} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )
                  }}
                />
              )}
            </View>
          )}

          {/* PO Detail Sub-Modal */}
          {selectedPoDetail ? (
            <Modal
              visible={!!selectedPoDetail}
              transparent
              animationType="slide"
              onRequestClose={() => setSelectedPoDetail(null)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalSheet}>
                  <View style={styles.sheetHeader}>
                    <View>
                      <Text style={styles.modalTitle}>{selectedPoDetail.poNumber}</Text>
                      <Text style={styles.modalSubtitle}>Supplier: {selectedPoDetail.supplierName}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedPoDetail(null)}>
                      <Ionicons name="close" size={24} color={tokens.colors.secondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.detailSummaryBox}>
                      <View style={styles.detailMetricCol}>
                        <Text style={styles.detailMetricLabel}>STATUS</Text>
                        <Text
                          style={[
                            styles.detailMetricVal,
                            selectedPoDetail.status === 'RECEIVED'
                              ? { color: tokens.colors.statusSuccess }
                              : { color: tokens.colors.primaryContainer },
                          ]}
                        >
                          {selectedPoDetail.status}
                        </Text>
                      </View>
                      <View style={styles.detailMetricCol}>
                        <Text style={styles.detailMetricLabel}>TOTAL COST</Text>
                        <Text style={styles.detailMetricVal}>${selectedPoDetail.totalCost.toFixed(2)}</Text>
                      </View>
                      <View style={styles.detailMetricCol}>
                        <Text style={styles.detailMetricLabel}>ORDER DATE</Text>
                        <Text style={styles.detailMetricVal}>{selectedPoDetail.orderDate}</Text>
                      </View>
                    </View>

                    {Boolean(selectedPoDetail.notes) && (
                      <View style={styles.detailNotesBox}>
                        <Text style={styles.detailNotesLabel}>Notes:</Text>
                        <Text style={styles.detailNotesText}>{selectedPoDetail.notes}</Text>
                      </View>
                    )}

                    <Text style={styles.sectionTitle}>Ordered Items ({selectedPoDetail.items.length})</Text>
                    {selectedPoDetail.items.map((item, idx) => (
                      <View key={item.id || idx} style={styles.detailItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.productName}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            {Boolean(item.sku) && (
                              <CopyableBadge
                                type="sku"
                                value={item.sku}
                                compact
                              />
                            )}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.expectedText}>
                            {item.quantity} × ${item.unitCost.toFixed(2)}
                          </Text>
                          <Text style={styles.boldText}>${item.totalCost.toFixed(2)}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={styles.sheetFooter}>
                    {selectedPoDetail.status === 'ORDERED' && (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {Boolean(onOpenStockIn) && (
                          <TouchableOpacity
                            style={[styles.completeBtn, { flex: 1, backgroundColor: tokens.colors.statusSuccess }]}
                            onPress={() => {
                              setSelectedPoDetail(null)
                              onClose()
                              onOpenStockIn?.()
                            }}
                          >
                            <Ionicons name="enter-outline" size={16} color={tokens.colors.onPrimary} />
                            <Text style={styles.completeBtnText}>Receive with Stock In</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[styles.completeBtn, { flex: 1 }]}
                          onPress={() => handleMarkReceived(selectedPoDetail.id)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color={tokens.colors.onPrimary} />
                          <Text style={styles.completeBtnText}>Mark Received</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </Modal>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  poBadge: {
    backgroundColor: tokens.colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xs,
  },
  poBadgeText: {
    color: tokens.colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.badgeSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.statusSuccess,
  },
  statusPillText: {
    color: tokens.colors.statusSuccess,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  supplierTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dateSubtitle: {
    color: tokens.colors.secondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    gap: 4,
  },
  scanShortcutText: {
    color: tokens.colors.primaryContainer,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHeaderTabs: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  subTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  subTabPillActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  subTabPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  subTabPillTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  addSupplierChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  addSupplierChipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  parentGroupCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
  },
  parentGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  parentGroupTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  parentGroupTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  parentGroupMeta: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    marginTop: 2,
    fontWeight: '600',
  },
  removeAllVariantsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removeAllVariantsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  itemCardNested: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 0,
    padding: 12,
  },

  supplierBanner: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: tokens.spacing.md,
  },
  supplierBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  supplierBannerTitle: {
    color: tokens.colors.onBackground,
    fontSize: 12,
    fontWeight: '700',
  },
  supplierBannerHint: {
    color: tokens.colors.secondary,
    fontSize: 11,
  },
  supplierChipsList: {
    gap: 8,
  },
  supplierChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  supplierChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  supplierChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  supplierChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  supplierChipNameActive: {
    color: tokens.colors.onPrimary,
  },
  supplierChipMeta: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  supplierChipMetaActive: {
    color: tokens.colors.onPrimary + 'CC',
  },
  metaCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: tokens.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  metaCol: {
    flex: 1,
  },
  noteLabel: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaInput: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 38,
    paddingHorizontal: 10,
    color: tokens.colors.onBackground,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  sectionTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '700',
  },
  sectionSub: {
    color: tokens.colors.secondary,
    fontSize: 12,
  },
  browseProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  browseProductsBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyIntakeContainer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.spacing.sm,
  },
  emptyIntakeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: tokens.spacing.sm,
  },
  emptyIntakeSub: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  emptyActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  emptyActionBtnPrimaryText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    gap: 6,
  },
  emptyActionBtnSecondaryText: {
    color: tokens.colors.primaryContainer,
    fontSize: 13,
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    ...tokens.shadows.cardInnerDepth,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  thumbnailBox: {
    width: 40,
    height: 40,
    borderRadius: tokens.borderRadius.thumbnail,
    backgroundColor: tokens.colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.sm,
  },
  itemInfoCol: {
    flex: 1,
  },
  itemName: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  itemSkuBadge: {
    backgroundColor: tokens.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tokens.borderRadius.xs,
  },
  itemSkuText: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  expectedText: {
    color: tokens.colors.secondary,
    fontSize: 11,
  },
  boldText: {
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  trashBtn: {
    padding: 6,
  },
  inputsGrid: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    paddingTop: tokens.spacing.sm,
  },
  inputCol: {
    flex: 1,
  },
  fieldLabel: {
    color: tokens.colors.secondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 38,
  },
  stepperBtn: {
    width: 32,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: tokens.colors.onBackground,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  textInput: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    height: 38,
    paddingHorizontal: 8,
    color: tokens.colors.onBackground,
    fontSize: 12,
    fontWeight: '600',
  },
  addUnexpectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.primaryContainer,
    borderStyle: 'dashed',
    borderRadius: tokens.borderRadius.card,
    paddingVertical: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    gap: 6,
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  addUnexpectedText: {
    color: tokens.colors.primaryContainer,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm + 2,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    ...tokens.shadows.actionSheet,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLoggedText: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValueText: {
    color: tokens.colors.onBackground,
    fontSize: 13,
    fontWeight: '600',
  },
  valueHighlight: {
    color: tokens.colors.primaryContainer,
    fontWeight: '800',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: tokens.spacing.lg,
    height: tokens.touchTarget.actionButtonHeight,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  completeBtnDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    opacity: 0.6,
  },
  completeBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  searchRow: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterScrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 2,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  filterChipText: {
    fontSize: 11,
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
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: tokens.colors.secondary,
    marginTop: 8,
  },
  poSummaryBox: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.sm,
    padding: tokens.spacing.sm,
    marginVertical: tokens.spacing.xs,
  },
  poSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  poSummaryMeta: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  poCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.xs,
  },
  stockInActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.statusSuccess,
  },
  stockInActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  modalSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  formScroll: {
    padding: tokens.spacing.md,
  },
  detailSummaryBox: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  detailMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  detailMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  detailMetricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginTop: 2,
  },
  detailNotesBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: tokens.borderRadius.sm,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  detailNotesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  detailNotesText: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceAlt,
  },
  sheetFooter: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  hiddenHardwareScanner: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    backgroundColor: tokens.colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
})
