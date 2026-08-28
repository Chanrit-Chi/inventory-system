import { usePermissions } from '../hooks/usePermissions'
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { CameraScannerModal } from '../components/CameraScannerModal'
import { ProductPickerModal } from '../components/ProductPickerModal'
import {
  createAttribute,
  createCategory,
  updateProduct,
  deleteProduct,
} from '../api/endpoints'
import type {
  Product,
  PurchaseOrder,
  TabType,
  ProductCategory,
  AttributeTaxonomy,
} from '../types'
import { styles } from './products/ProductsScreen.styles'
import { useProductCatalog } from './products/hooks/useProductCatalog'
import { useStockMovements } from './products/hooks/useStockMovements'
import { usePurchaseOrders } from './products/hooks/usePurchaseOrders'
import { useProductForm } from './products/hooks/useProductForm'
import { StockMovementsTab } from './products/components/StockMovementsTab'
import { ProductCatalogTab } from './products/components/ProductCatalogTab'
import { PurchaseOrdersTab } from './products/components/PurchaseOrdersTab'
import { InlineCreatorModals } from './products/components/InlineCreatorModals'
import { SupplierFormModal } from './products/components/SupplierFormModal'
import { PurchaseOrderDetailModal } from './products/components/PurchaseOrderDetailModal'
import { PurchaseOrderModal } from './products/components/PurchaseOrderModal'
import { ProductDetailModal } from './products/components/ProductDetailModal'
import { ProductFormModal } from './products/components/ProductFormModal'

export interface ProductsScreenProps {
  onNavigate: (tab: TabType) => void
  onOpenStockIn?: (product?: Product | null, variant?: any) => void
  onOpenStockAdjustment?: (product?: Product | null, variant?: any) => void
  onOpenPurchaseOrder?: (opts?: { mode?: 'list' | 'create'; supplierId?: string }) => void
  purchaseOrders?: PurchaseOrder[]
  onAddPO?: (po: PurchaseOrder) => void
  onMarkPoReceived?: (poId: string) => void
  initialSubTab?: 'catalog' | 'movements' | 'purchaseOrders'
}

export const ProductsScreen: React.FC<ProductsScreenProps> = ({
  onNavigate,
  onOpenStockIn,
  onOpenStockAdjustment,
  onOpenPurchaseOrder,
  purchaseOrders: propsPurchaseOrders,
  onAddPO,
  onMarkPoReceived,
  initialSubTab,
}) => {
  const { can } = usePermissions()
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'movements' | 'purchaseOrders'>(() => {
    if (initialSubTab) return initialSubTab
    if (!can('products:read') && (can('purchase-orders:*') || can('purchase-orders:create'))) {
      return 'purchaseOrders'
    }
    return 'catalog'
  })

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab)
    }
  }, [initialSubTab])

  // Catalog, taxonomy and filter state
  const {
    products, setProducts,
    managedCategories, setManagedCategories,
    managedAttributes, setManagedAttributes,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    loading, refreshing,
    catalogError,
    filteredProducts, filterCategoryOptions, missingBarcodeCount,
    loadProducts, onRefresh,
    headerTranslateY, headerOpacity, onScroll, onLayoutHeader, headerHeight,
  } = useProductCatalog()

  // Stock movements log
  const {
    movements, movementsLoading, movementsLoadingMore, movementsHasMore,
    loadMovements, loadMoreMovements,
  } = useStockMovements()

  // Trigger initial fetch when the user switches to the Stock Log tab
  useEffect(() => {
    if (activeSubTab === 'movements') loadMovements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab])

  // Product View Detail Modal State
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // Product Form hook & state
  const productForm = useProductForm({
    products,
    setProducts,
    detailProduct,
    setDetailProduct,
    loadProducts,
    managedCategories,
  })

  const {
    variantScannerOpen,
    setVariantScannerOpen,
    simpleBarcodeScannerOpen,
    setSimpleBarcodeScannerOpen,
    activeScanVariantIndex,
    setActiveScanVariantIndex,
    handleScanCodeForVariant,
    handleScanCodeForSimpleProduct,
    handleOpenCreateProduct,
    handleOpenEditProduct,
    handleAddCustomValueToAttribute,
    setValue,
    setSelectedProductAttributes,
  } = productForm

  // Overview Quick Barcode Assignment
  const [overviewScannerOpen, setOverviewScannerOpen] = useState(false)
  const [overviewScanTarget, setOverviewScanTarget] = useState<
    { type: 'product' } | { type: 'variant'; variantId: string } | null
  >(null)

  // Inline Category Creator Modal
  const [newCatModalOpen, setNewCatModalOpen] = useState(false)
  const [inlineCatName, setInlineCatName] = useState('')
  const [inlineCatCode, setInlineCatCode] = useState('')

  // Custom Attribute Value Modal State
  const [customValueModalOpen, setCustomValueModalOpen] = useState(false)
  const [targetAttrForCustomVal, setTargetAttrForCustomVal] = useState<{ id: string; name: string } | null>(null)
  const [customValInput, setCustomValInput] = useState('')

  // Inline Attribute Creator Modal
  const [newAttrModalOpen, setNewAttrModalOpen] = useState(false)
  const [inlineAttrName, setInlineAttrName] = useState('')
  const [inlineAttrValues, setInlineAttrValues] = useState('')

  // Purchase Orders & Suppliers
  const {
    suppliers,
    purchaseOrders,
    poSubTab, setPoSubTab, poSearch, setPoSearch,
    selectedPoDetail, setSelectedPoDetail, poDetailModalOpen, setPoDetailModalOpen,
    filteredPurchaseOrders, filteredSuppliers,
    poModalOpen, setPoModalOpen,
    selectedSupplierId, setSelectedSupplierId,
    poNotes, setPoNotes,
    poDeliveryDays, setPoDeliveryDays,
    poItems,
    poCatalogOpen, setPoCatalogOpen,
    poScannerOpen, setPoScannerOpen,
    poScanLoading,
    poExistingItems,
    newSupModalOpen, setNewSupModalOpen,
    newSupName, setNewSupName,
    newSupContact, setNewSupContact,
    newSupPhone, setNewSupPhone,
    newSupEmail, setNewSupEmail,
    newSupAddress, setNewSupAddress,
    newSupLeadTime, setNewSupLeadTime,
    handleUpdatePoItemQty,
    handleUpdatePoItemCost,
    handleRemovePoItem,
    handleCreatePO,
    handleCreateSupplier,
    handleMarkPoReceived,
    handleOpenCreatePoForSupplier,
    handleSelectProductForPO,
    handleSelectMultipleProductsForPO,
    handleScanCodeForPO,
  } = usePurchaseOrders({
    propsPurchaseOrders,
    onAddPO,
    onMarkPoReceived,
    products,
  })

  const handleOpenProductDetail = useCallback((prod: Product) => {
    setDetailProduct(prod)
    setDetailModalOpen(true)
  }, [])

  const handleToggleProductActive = async (prod: Product) => {
    const previousProd = prod
    const newActive = prod.is_active === false ? true : false
    const updatedVariants = prod.variants?.map((v) => ({ ...v, is_active: newActive })) || []
    const updated: Product = {
      ...prod,
      is_active: newActive,
      variants: updatedVariants.length > 0 ? updatedVariants : prod.variants,
    }

    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    if (detailProduct?.id === prod.id) {
      setDetailProduct(updated)
    }

    try {
      await updateProduct(prod.id, { is_active: newActive })
      Alert.alert(
        newActive ? 'Product Activated' : 'Product Deactivated',
        `"${prod.name}" is now ${newActive ? 'active' : 'hidden from sale'}${updatedVariants.length > 0 ? ' (all variants included).' : '.'}`
      )
    } catch (err) {
      console.warn('Product status update API call failed, rolling back:', prod.id, err)
      // Rollback on failure
      setProducts((prev) => prev.map((p) => (p.id === previousProd.id ? previousProd : p)))
      if (detailProduct?.id === prod.id) {
        setDetailProduct(previousProd)
      }
      Alert.alert('Update Failed', 'Could not update product status. Reverted changes.')
    }
  }

  const handleToggleVariantActive = async (prod: Product, variantId: string) => {
    const previousProd = prod
    const targetVariant = prod.variants?.find((v) => v.id === variantId)
    const displayName = targetVariant?.name || targetVariant?.sku || 'Variant'
    const newActive = targetVariant?.is_active === false ? true : false

    const updatedVariants = prod.variants?.map((v) =>
      v.id === variantId ? { ...v, is_active: newActive } : v
    ) || []

    const updatedProd: Product = {
      ...prod,
      variants: updatedVariants,
    }

    setProducts((prev) => prev.map((p) => (p.id === updatedProd.id ? updatedProd : p)))
    if (detailProduct?.id === prod.id) {
      setDetailProduct(updatedProd)
    }

    try {
      await updateProduct(prod.id, { variants: [{ id: variantId, is_active: newActive }] })
      Alert.alert(
        newActive ? 'Variant Activated' : 'Variant Deactivated',
        `"${displayName}" is now ${newActive ? 'available for sale.' : 'hidden from sale.'}`
      )
    } catch (err) {
      console.warn('Variant status update API call failed, rolling back:', variantId, err)
      // Rollback on failure
      setProducts((prev) => prev.map((p) => (p.id === previousProd.id ? previousProd : p)))
      if (detailProduct?.id === prod.id) {
        setDetailProduct(previousProd)
      }
      Alert.alert('Update Failed', 'Could not update variant status. Reverted changes.')
    }
  }

  const handleDeleteProductRequest = (prod: Product) => {
    Alert.alert(
      'Delete Product',
      `Permanently delete "${prod.name}"?\n\nProducts linked to sales or stock records cannot be deleted and will be deactivated instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteProduct(prod) },
      ]
    )
  }

  const confirmDeleteProduct = async (prod: Product) => {
    try {
      const res = await deleteProduct(prod.id)
      setProducts((prev) => prev.filter((p) => p.id !== prod.id))
      setDetailModalOpen(false)
      setDetailProduct(null)
      const msg = (res?.message || '').toLowerCase()
      if (msg.includes('deactivat')) {
        Alert.alert('Product Deactivated', `"${prod.name}" has existing records and was deactivated instead of deleted.`)
      } else {
        Alert.alert('Product Deleted', `"${prod.name}" was deleted successfully.`)
      }
    } catch (err: any) {
      const raw = String(err?.message || '').toLowerCase()
      const looksLinked = ['constraint', 'linked', 'associated', 'in use', 'foreign', 'reference', 'record', 'history'].some((k) =>
        raw.includes(k)
      )
      if (looksLinked) {
        try {
          await updateProduct(prod.id, { is_active: false })
          const updatedVariants = prod.variants?.map((v) => ({ ...v, is_active: false })) || []
          const updated: Product = { ...prod, is_active: false, variants: updatedVariants }
          setProducts(products.map((p) => (p.id === prod.id ? updated : p)))
          setDetailProduct(updated)
          Alert.alert('Deactivated Instead', `"${prod.name}" has existing sales/stock records and was deactivated instead of deleted.`)
        } catch {
          Alert.alert('Error', 'Could not delete or deactivate this product.')
        }
      } else {
        Alert.alert('Delete Failed', err?.message || 'Could not delete product.')
      }
    }
  }

  const handleQuickScanFromCard = useCallback(
    (product: Product) => {
      const isVar =
        (product.variants && product.variants.length > 1) ||
        (product.variants?.[0]?.attribute_values && product.variants[0].attribute_values.length > 0)

      if (isVar) {
        handleOpenProductDetail(product)
      } else {
        setDetailProduct(product)
        setOverviewScanTarget({ type: 'product' })
        setOverviewScannerOpen(true)
      }
    },
    [handleOpenProductDetail]
  )

  const handleSaveInlineCategory = async () => {
    if (!inlineCatName.trim()) {
      Alert.alert('Missing Field', 'Please enter category name.')
      return
    }
    const catName = inlineCatName.trim()
    const code = inlineCatCode.trim() || catName.substring(0, 3).toUpperCase()
    const tempId = `cat-${Date.now()}`
    const newCat: ProductCategory = {
      id: tempId,
      name: catName,
      code,
    }
    setManagedCategories((prev) => [...prev, newCat])
    setValue('category', newCat.name)
    setNewCatModalOpen(false)
    setInlineCatName('')
    setInlineCatCode('')

    try {
      const res = await createCategory({
        name: catName,
        code,
      })
      const created = res?.data
      if (created?.id) {
        setManagedCategories((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: created.id } : c))
        )
      }
    } catch {
      // Saved locally
    }

    Alert.alert('Category Added', `Category "${catName}" created and selected!`)
  }

  const handleSaveInlineAttribute = async () => {
    if (!inlineAttrName.trim() || !inlineAttrValues.trim()) {
      Alert.alert('Missing Fields', 'Please enter attribute name and preset values.')
      return
    }
    const values = inlineAttrValues.split(',').map((v) => v.trim()).filter(Boolean)
    const newTaxName = inlineAttrName.trim()
    const tempId = `tax-${Date.now()}`

    const localTax: AttributeTaxonomy = {
      id: tempId,
      name: newTaxName,
      code: newTaxName.toUpperCase().replace(/\s+/g, '_'),
      values,
      productCount: 0,
    }

    setManagedAttributes((prev) => [...prev, localTax])
    setSelectedProductAttributes((prev: any[]) => [
      ...prev,
      { id: tempId, name: newTaxName, selectedValues: values, allValues: values },
    ])
    setNewAttrModalOpen(false)
    setInlineAttrName('')
    setInlineAttrValues('')

    try {
      const res = await createAttribute({
        name: newTaxName,
        values,
      })
      const created = res?.data
      if (created?.id) {
        setManagedAttributes((prev) =>
          prev.map((t) => (t.id === tempId ? { ...t, id: created.id } : t))
        )
      }
    } catch {
      // Saved locally
    }

    Alert.alert('Attribute Created', `Attribute "${newTaxName}" saved to database and added to product.`)
  }

  const handleOpenAddCustomValueModal = (attrId: string, attrName: string) => {
    setTargetAttrForCustomVal({ id: attrId, name: attrName })
    setCustomValInput('')
    setCustomValueModalOpen(true)
  }

  const handleConfirmAddCustomValue = () => {
    const trimmed = customValInput.trim()
    if (!trimmed) {
      Alert.alert('Missing Value', 'Please enter a value name.')
      return
    }
    if (targetAttrForCustomVal) {
      handleAddCustomValueToAttribute(targetAttrForCustomVal.id, trimmed)
    }
    setCustomValueModalOpen(false)
    setTargetAttrForCustomVal(null)
    setCustomValInput('')
  }

  const handleScanCodeForOverview = async (code: string) => {
    const trimmedCode = code.trim()
    if (!trimmedCode || !detailProduct || !overviewScanTarget) return

    const existingConflict = products.find(
      (p) =>
        p.id !== detailProduct.id &&
        (p.barcode === trimmedCode || p.variants?.some((v) => v.barcode === trimmedCode))
    )
    if (existingConflict) {
      Alert.alert(
        'Duplicate Barcode',
        `Barcode "${trimmedCode}" is already assigned to "${existingConflict.name}".`
      )
      return
    }

    const previousProd = detailProduct
    if (overviewScanTarget.type === 'product') {
      const updatedVariants = detailProduct.variants?.map((v) => ({ ...v, barcode: trimmedCode })) || []
      const updated: Product = {
        ...detailProduct,
        barcode: trimmedCode,
        variants: updatedVariants.length > 0 ? updatedVariants : detailProduct.variants,
      }
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setDetailProduct(updated)
      try {
        await updateProduct(detailProduct.id, { barcode: trimmedCode })
      } catch (err) {
        console.warn('Overview barcode update API call failed, rolling back:', err)
        setProducts((prev) => prev.map((p) => (p.id === previousProd.id ? previousProd : p)))
        setDetailProduct(previousProd)
      }
      Alert.alert('Barcode Assigned', `Physical barcode "${trimmedCode}" assigned to "${detailProduct.name}".`)
    } else if (overviewScanTarget.type === 'variant') {
      const variantId = overviewScanTarget.variantId
      const targetVar = detailProduct.variants?.find((v) => v.id === variantId)
      const varName = targetVar?.name || targetVar?.sku || 'Variant'

      const updatedVariants = detailProduct.variants?.map((v) =>
        v.id === variantId ? { ...v, barcode: trimmedCode } : v
      ) || []
      const updated: Product = {
        ...detailProduct,
        variants: updatedVariants,
      }
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setDetailProduct(updated)
      try {
        await updateProduct(detailProduct.id, {
          variants: [{ id: variantId, barcode: trimmedCode }],
        })
      } catch (err) {
        console.warn('Variant barcode update API call failed, rolling back:', err)
        setProducts((prev) => prev.map((p) => (p.id === previousProd.id ? previousProd : p)))
        setDetailProduct(previousProd)
      }
      Alert.alert('Barcode Assigned', `Barcode "${trimmedCode}" assigned to variant "${varName}".`)
    }

    setOverviewScannerOpen(false)
    setOverviewScanTarget(null)
  }

  return (
    <View style={styles.container}>
      <View style={styles.compactHeaderRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subTabsScroll}
          contentContainerStyle={styles.subTabs}
        >
          {can('products:read') ? (
            <TouchableOpacity
              style={[styles.subTabBtn, activeSubTab === 'catalog' && styles.subTabBtnActive]}
              onPress={() => setActiveSubTab('catalog')}
            >
              <Ionicons
                name="cube"
                size={14}
                color={activeSubTab === 'catalog' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text
                style={[styles.subTabBtnText, activeSubTab === 'catalog' && styles.subTabBtnTextActive]}
                numberOfLines={1}
              >
                Catalog
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.subTabBtn, activeSubTab === 'movements' && styles.subTabBtnActive]}
            onPress={() => setActiveSubTab('movements')}
          >
            <Ionicons
              name="swap-vertical"
              size={14}
              color={activeSubTab === 'movements' ? tokens.colors.onPrimary : tokens.colors.secondary}
            />
            <Text
              style={[styles.subTabBtnText, activeSubTab === 'movements' && styles.subTabBtnTextActive]}
              numberOfLines={1}
            >
              Stock Log
            </Text>
          </TouchableOpacity>

          {(can('purchase-orders:*') || can('purchase-orders:create') || can('suppliers:view') || can('suppliers:manage')) ? (
            <TouchableOpacity
              style={[styles.subTabBtn, activeSubTab === 'purchaseOrders' && styles.subTabBtnActive]}
              onPress={() => {
                if (onOpenPurchaseOrder) {
                  onOpenPurchaseOrder({ mode: 'list' })
                } else {
                  onNavigate('purchase-orders')
                }
              }}
            >
              <Ionicons
                name="document-attach"
                size={14}
                color={activeSubTab === 'purchaseOrders' ? tokens.colors.onPrimary : tokens.colors.secondary}
              />
              <Text
                style={[styles.subTabBtnText, activeSubTab === 'purchaseOrders' && styles.subTabBtnTextActive]}
                numberOfLines={1}
              >
                Purchase Orders
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>

      {/* TAB 1: PRODUCT CATALOG */}
      {activeSubTab === 'catalog' ? (
        <ProductCatalogTab
          filteredProducts={filteredProducts}
          filterCategoryOptions={filterCategoryOptions}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          missingBarcodeCount={missingBarcodeCount}
          search={search}
          setSearch={setSearch}
          loading={loading}
          refreshing={refreshing}
          catalogError={catalogError}
          onRefresh={onRefresh}
          loadProducts={loadProducts}
          headerTranslateY={headerTranslateY}
          headerOpacity={headerOpacity}
          onLayoutHeader={onLayoutHeader}
          onScroll={onScroll}
          headerHeight={headerHeight}
          handleOpenCreateProduct={handleOpenCreateProduct}
          handleOpenProductDetail={handleOpenProductDetail}
          handleQuickScanFromCard={handleQuickScanFromCard}
        />
      ) : null}

      {/* TAB 2: STOCK MOVEMENTS LOG */}
      {activeSubTab === 'movements' ? (
        <StockMovementsTab
          movements={movements}
          loading={movementsLoading}
          loadingMore={movementsLoadingMore}
          hasMore={movementsHasMore}
          onLoadMore={loadMoreMovements}
          onRefresh={loadMovements}
          onOpenStockIn={can('inventory:restock') ? onOpenStockIn : undefined}
          onOpenStockAdjustment={can('inventory:adjust') || can('inventory:*') ? onOpenStockAdjustment : undefined}
        />
      ) : null}

      {/* TAB 3: PURCHASE ORDERS & SUPPLIERS */}
      {activeSubTab === 'purchaseOrders' ? (
        <PurchaseOrdersTab
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          filteredPurchaseOrders={filteredPurchaseOrders}
          filteredSuppliers={filteredSuppliers}
          poSubTab={poSubTab}
          setPoSubTab={setPoSubTab}
          poSearch={poSearch}
          setPoSearch={setPoSearch}
          setPoModalOpen={setPoModalOpen}
          setNewSupModalOpen={setNewSupModalOpen}
          setSelectedPoDetail={setSelectedPoDetail}
          setPoDetailModalOpen={setPoDetailModalOpen}
          handleMarkPoReceived={handleMarkPoReceived}
          handleOpenCreatePoForSupplier={handleOpenCreatePoForSupplier}
        />
      ) : null}

      {/* Product Creation / Edit Modal */}
      <ProductFormModal
        form={productForm}
        managedCategories={managedCategories}
        setNewCatModalOpen={setNewCatModalOpen}
        managedAttributes={managedAttributes}
        setNewAttrModalOpen={setNewAttrModalOpen}
        handleOpenAddCustomValueModal={handleOpenAddCustomValueModal}
      />

      {/* Inline creator dialogs: New Category / New Attribute / Custom Value */}
      <InlineCreatorModals
        newCatModalOpen={newCatModalOpen}
        setNewCatModalOpen={setNewCatModalOpen}
        inlineCatName={inlineCatName}
        setInlineCatName={setInlineCatName}
        inlineCatCode={inlineCatCode}
        setInlineCatCode={setInlineCatCode}
        handleSaveInlineCategory={handleSaveInlineCategory}
        newAttrModalOpen={newAttrModalOpen}
        setNewAttrModalOpen={setNewAttrModalOpen}
        inlineAttrName={inlineAttrName}
        setInlineAttrName={setInlineAttrName}
        inlineAttrValues={inlineAttrValues}
        setInlineAttrValues={setInlineAttrValues}
        handleSaveInlineAttribute={handleSaveInlineAttribute}
        customValueModalOpen={customValueModalOpen}
        setCustomValueModalOpen={setCustomValueModalOpen}
        targetAttrForCustomVal={targetAttrForCustomVal}
        customValInput={customValInput}
        setCustomValInput={setCustomValInput}
        handleConfirmAddCustomValue={handleConfirmAddCustomValue}
      />

      {/* Camera Barcode Scanner for Purchase Order */}
      <CameraScannerModal
        visible={poScannerOpen}
        onClose={() => setPoScannerOpen(false)}
        onScanCode={handleScanCodeForPO}
        isLoading={poScanLoading}
      />

      {/* Product Catalog Modal for Purchase Order */}
      <ProductPickerModal
        visible={poCatalogOpen}
        title="Select Products for Purchase Order"
        subtitle="Grouped by product catalog with live stock & purchase costs"
        priceType="cost"
        products={products}
        existingItems={poExistingItems}
        onClose={() => setPoCatalogOpen(false)}
        onSelect={handleSelectProductForPO}
        onSelectMultiple={handleSelectMultipleProductsForPO}
        onRefreshCatalog={loadProducts}
      />

      {/* Restructured Purchase Order Modal */}
      <PurchaseOrderModal
        poModalOpen={poModalOpen}
        setPoModalOpen={setPoModalOpen}
        suppliers={suppliers}
        selectedSupplierId={selectedSupplierId}
        setSelectedSupplierId={setSelectedSupplierId}
        poNotes={poNotes}
        setPoNotes={setPoNotes}
        poDeliveryDays={poDeliveryDays}
        setPoDeliveryDays={setPoDeliveryDays}
        poItems={poItems}
        setPoCatalogOpen={setPoCatalogOpen}
        setPoScannerOpen={setPoScannerOpen}
        handleUpdatePoItemQty={handleUpdatePoItemQty}
        handleUpdatePoItemCost={handleUpdatePoItemCost}
        handleRemovePoItem={handleRemovePoItem}
        handleCreatePO={handleCreatePO}
      />

      {/* Supplier / Vendor Registration Modal */}
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

      {/* Purchase Order Detail Sheet */}
      <PurchaseOrderDetailModal
        poDetailModalOpen={poDetailModalOpen}
        setPoDetailModalOpen={setPoDetailModalOpen}
        selectedPoDetail={selectedPoDetail}
        handleMarkPoReceived={handleMarkPoReceived}
      />

      {/* Read-Only Product Detail Sheet Modal */}
      <ProductDetailModal
        detailModalOpen={detailModalOpen}
        setDetailModalOpen={setDetailModalOpen}
        detailProduct={detailProduct}
        handleOpenEditProduct={handleOpenEditProduct}
        handleDeleteProductRequest={handleDeleteProductRequest}
        handleToggleProductActive={handleToggleProductActive}
        handleToggleVariantActive={handleToggleVariantActive}
        setOverviewScannerOpen={setOverviewScannerOpen}
        setOverviewScanTarget={setOverviewScanTarget}
        onOpenStockIn={onOpenStockIn}
        onOpenStockAdjustment={onOpenStockAdjustment}
      />

      {/* Variant Barcode Camera Scanner */}
      <CameraScannerModal
        visible={variantScannerOpen}
        isLoading={false}
        onClose={() => {
          setVariantScannerOpen(false)
          setActiveScanVariantIndex(null)
        }}
        onScanCode={handleScanCodeForVariant}
      />

      {/* Simple Product Barcode Camera Scanner */}
      <CameraScannerModal
        visible={simpleBarcodeScannerOpen}
        isLoading={false}
        onClose={() => setSimpleBarcodeScannerOpen(false)}
        onScanCode={handleScanCodeForSimpleProduct}
      />

      {/* Overview Quick Barcode Assignment Scanner */}
      <CameraScannerModal
        visible={overviewScannerOpen}
        isLoading={false}
        onClose={() => {
          setOverviewScannerOpen(false)
          setOverviewScanTarget(null)
        }}
        onScanCode={handleScanCodeForOverview}
      />
    </View>
  )
}

export default ProductsScreen
