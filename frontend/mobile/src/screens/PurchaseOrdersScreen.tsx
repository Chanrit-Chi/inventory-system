import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { usePermissions } from '../hooks/usePermissions'
import { getProducts, fetchSuppliers } from '../api/endpoints'
import { ProductPickerModal, SelectedProductItem, ExistingPickerItem } from '../components/ProductPickerModal'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { useBarcodeScan } from '../hooks/useBarcodeScan'
import type {
  TabType,
  PurchaseOrder,
  PurchaseOrderItem,
  Product,
  Supplier,
  ProductVariant,
  ScannedVariant,
  PoGroup,
  ApiResponse,
} from '../types'
import { styles } from './purchase_orders/PurchaseOrdersScreen.styles'
import { POCardItem } from './purchase_orders/components/POCardItem'
import { POFilterToolbar } from './purchase_orders/components/POFilterToolbar'
import { PODetailModal } from './purchase_orders/components/PODetailModal'
import { CreatePOModal } from './purchase_orders/components/CreatePOModal'
import { useToast } from '../context/ToastContext'

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
  const { showToast } = useToast()
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
        const val = supRes.value
        const supList: Supplier[] = Array.isArray(val)
          ? val
          : (val as ApiResponse<Supplier[]>)?.data || []
        setSuppliers(supList)
        if (supList.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(supList[0].id)
        }
      }

      if (prodRes.status === 'fulfilled' && prodRes.value) {
        const val = prodRes.value
        const prodList: Product[] = Array.isArray(val)
          ? val
          : (val as ApiResponse<Product[]>)?.data || []
        setProducts(prodList)
      }
    } catch {
      // Fallback
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
        po.items.some(
          (it) =>
            it.productName.toLowerCase().includes(q) ||
            it.sku.toLowerCase().includes(q)
        )
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

  const handleAddVariantToPO = useCallback(
    (item: {
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
          parentProductName:
            item.parentProductName || item.displayName.split(' (')[0].split(' - ')[0],
          productName: item.displayName,
          sku: item.sku,
          quantity: qty,
          unitCost: item.costPrice,
          totalCost: qty * item.costPrice,
        }
        return [...prev, newItem]
      })
    },
    []
  )

  // Barcode Scanner hook for PO creation
  const {
    scannerOpen,
    setScannerOpen,
    loading: scanLoading,
    handleScanCode: handleScanBarcodeForPO,
    lastFeedback: scanFeedback,
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
  const handleSelectProductForPO = (
    product: Product,
    variant?: ProductVariant | ScannedVariant
  ) => {
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

  const handleSetItemQty = (id: string, qty: number) => {
    setPoItems((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const newQty = Math.max(1, qty)
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

  const groupedPoItems = useMemo<PoGroup[]>(() => {
    const groups: Record<string, PoGroup> = {}
    poItems.forEach((it) => {
      const groupKey =
        it.productId ||
        it.parentProductName ||
        it.productName.split(' (')[0].split(' - ')[0]
      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          parentName:
            it.parentProductName || it.productName.split(' (')[0].split(' - ')[0],
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

    Alert.alert(
      'Purchase Order Created',
      `Purchase Order "${poNum}" has been created and sent to ${sup?.name || 'supplier'}.`
    )
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
    showToast('Purchase order marked as RECEIVED & stock updated.', 'success')
  }

  return (
    <View style={styles.container}>
      {/* Top Header & Search Toolbar */}
      <POFilterToolbar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        canCreatePO={Boolean(can('purchase-orders:create'))}
        onNavigate={onNavigate}
        onOpenNewPO={() => setPoModalOpen(true)}
      />

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
          renderItem={({ item: po }) => (
            <POCardItem
              po={po}
              onSelectPo={(p) => {
                setSelectedPoDetail(p)
                setPoDetailModalOpen(true)
              }}
              onOpenStockIn={onOpenStockIn}
            />
          )}
        />
      )}

      {/* Barcode Camera Scanner Modal */}
      <CameraScannerModal
        visible={scannerOpen}
        title="PO Barcode Scanner"
        subtitle={`${poItems.reduce((sum, it) => sum + (it.quantity || 1), 0)} items • Tap list to pause & edit`}
        primaryActionLabel="Done & Review"
        primaryActionIcon="checkmark-circle-outline"
        onClose={() => setScannerOpen(false)}
        onPrimaryAction={() => setScannerOpen(false)}
        onScanCode={async (code) => {
          await handleScanBarcodeForPO(code)
        }}
        isLoading={scanLoading}
        scannedItems={poItems.map((it) => ({
          id: it.id,
          name: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          priceOrCost: it.unitCost,
        }))}
        totalCount={poItems.reduce((sum, it) => sum + (it.quantity || 1), 0)}
        totalValue={poItems.reduce((sum, it) => sum + (it.totalCost || 0), 0)}
        onUpdateItemQuantity={(id, delta) => handleUpdateItemQty(id, delta)}
        onRemoveItem={(id) => setPoItems((prev) => prev.filter((it) => it.id !== id))}
        feedback={scanFeedback}
      />

      {/* Product Catalog Picker Modal */}
      <ProductPickerModal
        visible={catalogPickerOpen}
        title="Select Products for Purchase Order"
        subtitle="Select items with live supplier cost prices"
        priceType="cost"
        existingItems={existingPickerItems}
        onClose={() => setCatalogPickerOpen(false)}
        onSelect={handleSelectProductForPO}
        onSelectMultiple={handleSelectMultipleProductsForPO}
      />

      {/* New Purchase Order Modal */}
      <CreatePOModal
        visible={poModalOpen}
        suppliers={suppliers}
        selectedSupplierId={selectedSupplierId}
        setSelectedSupplierId={setSelectedSupplierId}
        poItems={poItems}
        groupedPoItems={groupedPoItems}
        poExpectedDate={poExpectedDate}
        setPoExpectedDate={setPoExpectedDate}
        poNotes={poNotes}
        setPoNotes={setPoNotes}
        onClose={() => setPoModalOpen(false)}
        onOpenCatalog={() => setCatalogPickerOpen(true)}
        onOpenScanner={() => setScannerOpen(true)}
        onRemoveParentGroup={handleRemoveParentGroupWithConfirm}
        onRemoveItem={handleRemovePoItemWithConfirm}
        onUpdateItemQty={handleUpdateItemQty}
        onSetItemQty={handleSetItemQty}
        onUpdateItemCost={handleUpdateItemCost}
        onSavePO={handleSavePO}
      />

      {/* PO Detail View Modal */}
      <PODetailModal
        visible={poDetailModalOpen}
        po={selectedPoDetail}
        onClose={() => setPoDetailModalOpen(false)}
        onOpenStockIn={onOpenStockIn}
        onMarkReceived={handleMarkReceived}
      />
    </View>
  )
}

export default PurchaseOrdersScreen
