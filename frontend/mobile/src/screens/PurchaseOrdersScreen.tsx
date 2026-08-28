import { usePermissions } from '../hooks/usePermissions'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { getProducts, fetchSuppliers, scanBarcode, createSupplier } from '../api/endpoints'
import { ProductPickerModal, SelectedProductItem, ExistingPickerItem } from '../components/ProductPickerModal'
import { ProductGroupHeader } from '../components/ProductGroupHeader'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { CopyableBadge } from '../components/CopyableBadge'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import { SupplierFormModal } from './products/components/SupplierFormModal'
import type { TabType, PurchaseOrder, PurchaseOrderItem, Product, Supplier, ProductVariant, ScannedVariant } from '../types'

export interface PurchaseOrdersScreenProps {
  onNavigate: (tab: TabType) => void
  onOpenStockIn?: () => void
  purchaseOrders?: PurchaseOrder[]
  onAddPO?: (po: PurchaseOrder) => void
  onMarkPoReceived?: (poId: string) => void
}

export const PurchaseOrdersScreen: React.FC<PurchaseOrdersScreenProps> = ({
  onNavigate,
  onOpenStockIn,
  purchaseOrders: propsPurchaseOrders,
  onAddPO,
  onMarkPoReceived,
}) => {
  const { can } = usePermissions()
  const [localPurchaseOrders, setLocalPurchaseOrders] = useState<PurchaseOrder[]>([])
  const purchaseOrders = propsPurchaseOrders || localPurchaseOrders

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'>('ALL')

  // New PO Modal State
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [poExpectedDate, setPoExpectedDate] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([])

  // Product Catalog Picker for PO creation
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)

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
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create supplier.')
    }
  }

  // PO Detail Modal State
  const [selectedPoDetail, setSelectedPoDetail] = useState<PurchaseOrder | null>(null)
  const [poDetailModalOpen, setPoDetailModalOpen] = useState(false)

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
        if (supList.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(supList[0].id)
        }
      }

      if (prodRes.status === 'fulfilled' && prodRes.value) {
        const prodList: Product[] = Array.isArray(prodRes.value) ? prodRes.value : (prodRes.value as any)?.data || []
        setProducts(prodList)
      }
    } catch {
      // Fallback
  // PO Detail Modal State
  const [selectedPoDetail, setSelectedPoDetail] = useState<PurchaseOrder | null>(null)
  const [poDetailModalOpen, setPoDetailModalOpen] = useState(false)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedSupplierId])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      }
      return [...prev, newItem]
    })
  }, [])

  // Barcode Scanner hook for PO creation
  const {
    scannerOpen,
    setScannerOpen,
    loading: scanLoading,
    handleScanCode: handleScanBarcodeForPO,
  } = useBarcodeScan({
    mode: 'purchase-order',
    onFoundVariant: (variant, product) => {
      const cost = parseFloat(product?.purchase_price || '0') || 0
      handleAddVariantToPO({
        variantId: variant.id,
        productId: product?.id,
        parentProductName: product?.name,
        displayName: product?.name ? `${product.name} (${variant.sku})` : 'Product',
        sku: variant.sku || 'SKU',
        costPrice: cost,
      })
      Alert.alert('Scanned & Added', `Added ${product?.name || 'Product'} to Purchase Order.`)
    },
    onFoundProduct: (product, variants) => {
      const v = variants?.[0]
      const cost = parseFloat(product.purchase_price || '0') || 0
      handleAddVariantToPO({
        variantId: v?.id || product.id,
        productId: product.id,
        parentProductName: product.name,
        displayName: product.name,
        sku: v?.sku || product.barcode || 'SKU',
        costPrice: cost,
      })
      Alert.alert('Scanned & Added', `Added ${product.name} to Purchase Order.`)
    },
  })

  // Catalog picker single selection
  const handleSelectProductForPO = (product: Product, variant?: ProductVariant | ScannedVariant) => {
    const cost = parseFloat(String(product.purchase_price || '0')) || 0
    const varId = variant?.id || product.id
    const sku = variant?.sku || product.sku || 'SKU'
    const name = variant ? `${product.name} (${sku})` : product.name
    handleAddVariantToPO({
      variantId: varId,
      productId: product.id,
      parentProductName: product.name,
      displayName: name,
      sku: sku,
      costPrice: cost,
      quantity: 1,
    })
    setCatalogPickerOpen(false)
  }

  // Catalog picker batch selection
  const handleSelectMultipleProductsForPO = (items: SelectedProductItem[]) => {
    items.forEach((item) => {
      const cost = parseFloat(String(item.product.purchase_price || '0')) || 0
      const varId = item.variant?.id || item.product.id
      const sku = item.variant?.sku || item.product.sku || 'SKU'
      const name = item.variant ? `${item.product.name} (${sku})` : item.product.name
      handleAddVariantToPO({
        variantId: varId,
        productId: item.product.id,
        parentProductName: item.product.name,
        displayName: name,
        sku: sku,
        costPrice: cost,
        quantity: item.quantity,
      })
    })
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
          },
        },
      ]
    )
  }

  const handleRemovePoItem = (id: string) => {
    setPoItems((prev) => prev.filter((it) => it.id !== id))
  }

  // Submit and Save PO
  const handleSavePO = () => {
    if (!selectedSupplierId) {
      Alert.alert('Validation Error', 'Please select a supplier for this purchase order.')
      return
    }
    if (poItems.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one line item to the purchase order.')
      return
    }

    const sup = suppliers.find((s) => s.id === selectedSupplierId)
    const totalCost = poItems.reduce((s, it) => s + it.totalCost, 0)
    const poNum = `PO-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

    const newPO: PurchaseOrder = {
      id: `po_${Date.now()}`,
      poNumber: poNum,
      supplierId: selectedSupplierId,
      supplierName: sup?.name || 'Standard Vendor',
      status: 'ORDERED',
      items: poItems,
      totalCost,
      expectedDeliveryDate: poExpectedDate || new Date().toISOString().split('T')[0],
      orderDate: new Date().toISOString().split('T')[0],
      notes: poNotes || undefined,
    }

    if (onAddPO) {
      onAddPO(newPO)
    } else {
      setLocalPurchaseOrders((prev) => [newPO, ...prev])
    }

    Alert.alert('Purchase Order Created', `Purchase Order "${poNum}" has been created and sent to ${sup?.name || 'supplier'}.`)
    setPoModalOpen(false)
    setPoItems([])
    setPoNotes('')
    setPoExpectedDate('')
  }

  // Mark PO Received handler
  const handleMarkReceived = (poId: string) => {
    if (onMarkPoReceived) {
      onMarkPoReceived(poId)
    } else {
      setLocalPurchaseOrders((prev) =>
        prev.map((po) => (po.id === poId ? { ...po, status: 'RECEIVED' } : po))
      )
    }
    if (selectedPoDetail && selectedPoDetail.id === poId) {
      setSelectedPoDetail({ ...selectedPoDetail, status: 'RECEIVED' })
    }
    Alert.alert('PO Received', 'Purchase order status updated to RECEIVED.')
  }

  return (
    <View style={styles.container}>
      {/* Top Header & Search Row */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBox}>
            <Ionicons name="document-attach" size={20} color={tokens.colors.primaryContainer} />
          </View>
          <View>
            <Text style={styles.screenTitle}>Purchase Orders</Text>
            <Text style={styles.screenSubtitle}>
              {purchaseOrders.length} total orders • Supplier procurement
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Boolean(can('products:read')) && (
            <TouchableOpacity
              style={styles.catalogLinkBtn}
              onPress={() => onNavigate('products')}
              activeOpacity={0.8}
            >
              <Ionicons name="cube-outline" size={15} color={tokens.colors.primaryContainer} />
              <Text style={styles.catalogLinkText}>Catalog</Text>
            </TouchableOpacity>
          )}

          {Boolean(can('purchase-orders:create')) && (
            <TouchableOpacity
              style={styles.newPoBtn}
              onPress={() => setPoModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={tokens.colors.onPrimary} />
              <Text style={styles.newPoBtnText}>New PO</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
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
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {status} ({count})
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* Content Feed */}
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
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true)
            loadData()
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={tokens.colors.secondary} />
              <Text style={styles.emptyTitle}>No Purchase Orders Found</Text>
              <Text style={styles.emptySubtitle}>
                {search.length > 0 || statusFilter !== 'ALL'
                  ? 'Try clearing filters or search terms.'
                  : 'Create a new purchase order to track vendor procurement.'}
              </Text>
              {Boolean(can('purchase-orders:create')) && (
                <TouchableOpacity
                  style={[styles.newPoBtn, { marginTop: 16 }]}
                  onPress={() => setPoModalOpen(true)}
                >
                  <Ionicons name="add" size={16} color={tokens.colors.onPrimary} />
                  <Text style={styles.newPoBtnText}>Create First PO</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item: po }) => {
            const isReceived = po.status === 'RECEIVED'
            const isOrdered = po.status === 'ORDERED'
            const firstItem = po.items[0]
            const totalUnits = po.items.reduce((s, it) => s + it.quantity, 0)

            return (
              <TouchableOpacity
                style={styles.poCard}
                onPress={() => {
                  setSelectedPoDetail(po)
                  setPoDetailModalOpen(true)
                }}
                activeOpacity={0.8}
              >
                <View style={styles.poCardHeader}>
                  <View style={styles.poIdGroup}>
                    <View style={styles.poIconBox}>
                      <Ionicons name="document-text" size={18} color={tokens.colors.primaryContainer} />
                    </View>
                    <View>
                      <Text style={styles.poNumber}>{po.poNumber}</Text>
                      <View style={styles.poSupplierRow}>
                        <Ionicons name="business-outline" size={12} color={tokens.colors.secondary} />
                        <Text style={styles.poSupplier}>{po.supplierName}</Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.poStatusBadge,
                      isReceived && styles.poStatusBadgeReceived,
                      isOrdered && styles.poStatusBadgeOrdered,
                    ]}
                  >
                    <Text
                      style={[
                        styles.poStatusText,
                        isReceived && styles.poStatusTextReceived,
                        isOrdered && styles.poStatusTextOrdered,
                      ]}
                    >
                      {po.status}
                    </Text>
                  </View>
                </View>

                {/* Items Summary */}
                <View style={styles.poItemSummaryBox}>
                  <Text style={styles.poItemSummaryTitle} numberOfLines={1}>
                    {firstItem ? `${firstItem.productName} (${firstItem.sku})` : 'Procurement Batch'}
                    {po.items.length > 1 ? ` + ${po.items.length - 1} more items` : ''}
                  </Text>
                  <Text style={styles.poItemSummaryMeta}>
                    {totalUnits} units total • Ordered: {po.orderDate}
                  </Text>
                </View>

                {/* Card Footer */}
                <View style={styles.poCardFooter}>
                  <View>
                    <Text style={styles.poCostLabel}>Total Cost</Text>
                    <Text style={styles.poCostValue}>${po.totalCost.toFixed(2)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {Boolean(isOrdered && onOpenStockIn) && (
                      <TouchableOpacity
                        style={styles.receiveBtn}
                        onPress={(e) => {
                          e.stopPropagation()
                          onOpenStockIn?.()
                        }}
                      >
                        <Ionicons name="enter-outline" size={14} color={tokens.colors.onPrimary} />
                        <Text style={styles.receiveBtnText}>Receive / Stock In</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.viewDetailBtn}
                      onPress={() => {
                        setSelectedPoDetail(po)
                        setPoDetailModalOpen(true)
                      }}
                    >
                      <Text style={styles.viewDetailBtnText}>Details</Text>
                      <Ionicons name="chevron-forward" size={12} color={tokens.colors.primaryContainer} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* Barcode Camera Scanner Modal */}
      <CameraScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanCode={async (code) => { await handleScanBarcodeForPO(code) }}
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

      {/* New Purchase Order Modal */}
      <Modal visible={poModalOpen} transparent animationType="slide" onRequestClose={() => setPoModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>New Purchase Order</Text>
                <Text style={styles.modalSubtitle}>Order inventory from authorized suppliers</Text>
              </View>
              <TouchableOpacity onPress={() => setPoModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Supplier Selection */}
              <Text style={styles.formLabel}>Target Supplier / Vendor *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {suppliers.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.supChoice, selectedSupplierId === s.id && styles.supChoiceActive]}
                      onPress={() => setSelectedSupplierId(s.id)}
                    >
                      <Text style={[styles.supChoiceText, selectedSupplierId === s.id && styles.supChoiceTextActive]}>
                        {s.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: selectedSupplierId === s.id ? tokens.colors.onPrimary : tokens.colors.secondary,
                        }}
                      >
                        {s.leadTimeDays ? `${s.leadTimeDays}d lead` : 'Standard'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Action Buttons: Browse Catalog & Barcode Scanner */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.poActionBtn, { flex: 1, backgroundColor: tokens.colors.primaryContainer }]}
                  onPress={() => setCatalogPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="list-outline" size={18} color={tokens.colors.onPrimary} />
                  <Text style={styles.poActionBtnText}>+ Browse Catalog</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.poActionBtn, { flex: 1, backgroundColor: '#0284C7' }]}
                  onPress={() => setScannerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.poActionBtnText}>Scan Barcode</Text>
                </TouchableOpacity>
              </View>

              {/* Line Items List */}
              <View style={styles.lineItemHeaderRow}>
                <Text style={styles.formLabel}>Line Items ({poItems.length})</Text>
                {poItems.length > 0 && (
                  <Text style={styles.unitSummary}>
                    {poItems.reduce((s, it) => s + it.quantity, 0)} units • $
                    {poItems.reduce((s, it) => s + it.totalCost, 0).toFixed(2)}
                  </Text>
                )}
              </View>

              {poItems.length === 0 ? (
                <View style={styles.emptyItemsBox}>
                  <Ionicons name="cube-outline" size={32} color={tokens.colors.secondary} />
                  <Text style={styles.emptyItemsTitle}>No items added to this PO</Text>
                  <Text style={styles.emptyItemsSubtitle}>
                    Tap "+ Browse Catalog" or "Scan Barcode" to add products.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {groupedPoItems.map((group) => {
                    const isMultiVariant = group.items.length > 1
                    return (
                      <View key={group.groupKey} style={[styles.poItemRow, { padding: 0, overflow: 'hidden' }]}>
                        <ProductGroupHeader
                          parentName={group.parentName}
                          variantCount={group.items.length}
                          totalQty={group.totalQty}
                          totalCost={group.totalCost}
                          onRemoveAll={() => handleRemoveParentGroupWithConfirm(group)}
                        />

                        {group.items.map((item) => (
                          <View key={item.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                            <View style={styles.poItemHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.poItemName} numberOfLines={1}>
                                  {isMultiVariant
                                    ? (item.productName.includes('(') ? item.productName.split('(')[1].replace(')', '') : item.productName)
                                    : item.productName}
                                </Text>
                                {Boolean(item.sku) && (
                                  <View style={{ marginTop: 2 }}>
                                    <CopyableBadge
                                      type="sku"
                                      value={item.sku}
                                      compact
                                    />
                                  </View>
                                )}
                              </View>
                              <TouchableOpacity
                                onPress={() => handleRemovePoItemWithConfirm(item)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={16} color={tokens.colors.statusError} />
                              </TouchableOpacity>
                            </View>

                            <View style={styles.poItemControlRow}>
                              {/* Stepper */}
                              <View style={styles.stepperContainer}>
                                <TouchableOpacity
                                  style={styles.stepperBtn}
                                  onPress={() => handleUpdateItemQty(item.id, -1)}
                                >
                                  <Ionicons name="remove" size={14} color={tokens.colors.onBackground} />
                                </TouchableOpacity>
                                <Text style={styles.stepperVal}>{item.quantity}</Text>
                                <TouchableOpacity
                                  style={styles.stepperBtn}
                                  onPress={() => handleUpdateItemQty(item.id, 1)}
                                >
                                  <Ionicons name="add" size={14} color={tokens.colors.onBackground} />
                                </TouchableOpacity>
                              </View>

                              {/* Unit Cost */}
                              <View style={styles.costInputGroup}>
                                <Text style={styles.costInputLabel}>Cost/unit:</Text>
                                <TextInput
                                  style={styles.costInput}
                                  value={String(item.unitCost)}
                                  onChangeText={(t) => handleUpdateItemCost(item.id, t)}
                                  keyboardType="decimal-pad"
                                />
                              </View>

                              <Text style={styles.itemTotalCost}>${item.totalCost.toFixed(2)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )
                  })}
                </View>
              )}

              {/* Expected Delivery & Notes */}
              <Text style={styles.formLabel}>Expected Delivery Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD (e.g. 2026-09-01)"
                placeholderTextColor={tokens.colors.secondary}
                value={poExpectedDate}
                onChangeText={setPoExpectedDate}
              />

              <Text style={styles.formLabel}>Order Notes / Instructions</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Payment terms, delivery instructions, reference..."
                placeholderTextColor={tokens.colors.secondary}
                value={poNotes}
                onChangeText={setPoNotes}
                multiline
              />
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={[styles.submitPoBtn, poItems.length === 0 && { opacity: 0.5 }]}
                onPress={handleSavePO}
                disabled={poItems.length === 0}
              >
                <Text style={styles.submitPoBtnText}>
                  Issue Purchase Order (${poItems.reduce((s, it) => s + it.totalCost, 0).toFixed(2)})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PO Detail View Modal */}
      {selectedPoDetail ? (
        <Modal
          visible={poDetailModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPoDetailModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedPoDetail.poNumber}</Text>
                  <Text style={styles.modalSubtitle}>Supplier: {selectedPoDetail.supplierName}</Text>
                </View>
                <TouchableOpacity onPress={() => setPoDetailModalOpen(false)}>
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

                <Text style={styles.formLabel}>Ordered Items ({selectedPoDetail.items.length})</Text>
                {(() => {
                  const detailGroups: Record<string, { parentName: string; items: any[]; totalQty: number; totalCost: number }> = {}
                  selectedPoDetail.items.forEach((it) => {
                    const parentName = it.parentProductName || it.productName.split(' (')[0].split(' - ')[0] || it.productName
                    if (!detailGroups[parentName]) {
                      detailGroups[parentName] = {
                        parentName,
                        items: [],
                        totalQty: 0,
                        totalCost: 0,
                      }
                    }
                    detailGroups[parentName].items.push(it)
                    detailGroups[parentName].totalQty += it.quantity
                    detailGroups[parentName].totalCost += it.totalCost
                  })
                  const groupList = Object.values(detailGroups)

                  return (
                    <View style={{ gap: 10, marginTop: 4, marginBottom: 8 }}>
                      {groupList.map((group, gIdx) => {
                        const isMultiVariant = group.items.length > 1
                        return (
                          <View key={`dg-${gIdx}`} style={[styles.poItemRow, { padding: 0, overflow: 'hidden', backgroundColor: '#FFFFFF' }]}>
                            <ProductGroupHeader
                              parentName={group.parentName}
                              variantCount={group.items.length}
                              totalQty={group.totalQty}
                              totalCost={group.totalCost}
                            />
                            {group.items.map((item, idx) => (
                              <View key={item.id || idx} style={[styles.detailItemRow, { borderBottomWidth: idx < group.items.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 10 }]}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.detailItemName}>
                                    {isMultiVariant
                                      ? (item.productName.includes('(') ? item.productName.split('(')[1].replace(')', '') : item.productName)
                                      : item.productName}
                                  </Text>
                                  {Boolean(item.sku) && (
                                    <View style={{ marginTop: 2 }}>
                                      <CopyableBadge
                                        type="sku"
                                        value={item.sku}
                                        compact
                                      />
                                    </View>
                                  )}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.detailItemQty}>
                                    {item.quantity} × ${item.unitCost.toFixed(2)}
                                  </Text>
                                  <Text style={styles.detailItemTotal}>${item.totalCost.toFixed(2)}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )
                      })}
                    </View>
                  )
                })()}
              </ScrollView>

              <View style={styles.sheetFooter}>
                {selectedPoDetail.status === 'ORDERED' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {Boolean(onOpenStockIn) && (
                      <TouchableOpacity
                        style={[styles.submitPoBtn, { flex: 1, backgroundColor: tokens.colors.statusSuccess }]}
                        onPress={() => {
                          setPoDetailModalOpen(false)
                          onOpenStockIn?.()
                        }}
                      >
                        <Ionicons name="enter-outline" size={16} color={tokens.colors.onPrimary} />
                        <Text style={styles.submitPoBtnText}>Receive with Stock In</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.submitPoBtn, { flex: 1, backgroundColor: tokens.colors.primaryContainer }]}
                      onPress={() => handleMarkReceived(selectedPoDetail.id)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={tokens.colors.onPrimary} />
                      <Text style={styles.submitPoBtnText}>Mark Received</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tokens.colors.primaryContainer + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  catalogLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.colors.primaryContainer + '15',
  },
  catalogLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  newPoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.colors.primaryContainer,
  },
  newPoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  filterScroll: {
    maxHeight: 38,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.outline,
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
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 32,
  },
  poCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    gap: 10,
  },
  poCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  poIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  poIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: tokens.colors.primaryContainer + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  poSupplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  poSupplier: {
    fontSize: 11,
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  poStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  poStatusBadgeOrdered: {
    backgroundColor: '#FEF3C7',
  },
  poStatusBadgeReceived: {
    backgroundColor: '#D1FAE5',
  },
  poStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  poStatusTextOrdered: {
    color: '#B45309',
  },
  poStatusTextReceived: {
    color: '#047857',
  },
  poItemSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
  },
  poItemSummaryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  poItemSummaryMeta: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  poCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  poCostLabel: {
    fontSize: 10,
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  poCostValue: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  receiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: tokens.colors.statusSuccess,
  },
  receiveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: tokens.colors.primaryContainer + '15',
  },
  viewDetailBtnText: {
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
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outline,
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
    padding: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 10,
  },
  supChoice: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    backgroundColor: '#F8FAFC',
  },
  supChoiceActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  supChoiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  supChoiceTextActive: {
    color: tokens.colors.onPrimary,
  },
  poActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  poActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lineItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  unitSummary: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  emptyItemsBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    marginBottom: 12,
  },
  emptyItemsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 6,
  },
  emptyItemsSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  poItemRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    padding: 10,
    gap: 8,
  },
  poItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  poItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  poItemSku: {
    fontSize: 10,
    color: tokens.colors.secondary,
    fontFamily: 'monospace',
  },
  poItemControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: 6,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperVal: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    color: tokens.colors.onBackground,
  },
  costInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  costInputLabel: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  costInput: {
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 60,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    color: tokens.colors.onBackground,
  },
  itemTotalCost: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.outline,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: tokens.colors.onBackground,
    marginBottom: 6,
  },
  sheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.outline,
  },
  submitPoBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  submitPoBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onPrimary,
  },
  detailSummaryBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
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
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
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
    borderBottomColor: '#F1F5F9',
  },
  detailItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  detailItemSku: {
    fontSize: 10,
    color: tokens.colors.secondary,
    fontFamily: 'monospace',
  },
  detailItemQty: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  detailItemTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
})
