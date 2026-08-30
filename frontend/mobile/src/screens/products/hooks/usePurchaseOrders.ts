import { useState, useCallback, useMemo } from 'react'
import { Alert } from 'react-native'
import { scanBarcode, fetchSuppliers } from '../../../api/endpoints'
import { useDebounce } from '../../../hooks/useDebounce'
import type {
  Product,
  ProductVariant,
  ScannedVariant,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  ScannedAttributeValue,
} from '../../../types'
import type { SelectedProductItem, ExistingPickerItem } from '../../../components/ProductPickerModal'

interface UsePurchaseOrdersOptions {
  products: Product[]
  propsPurchaseOrders?: PurchaseOrder[]
  onAddPO?: (po: PurchaseOrder) => void
  onMarkPoReceived?: (poId: string) => void
}

export function usePurchaseOrders({
  products,
  propsPurchaseOrders,
  onAddPO,
  onMarkPoReceived,
}: UsePurchaseOrdersOptions) {
  // ── Suppliers ─────────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetchSuppliers()
      const list = Array.isArray(res) ? res : (res as { data?: Supplier[] })?.data || []
      if (list.length > 0) setSuppliers(list)
    } catch { /* silent */ }
  }, [])

  // ── Local PO list (fallback when no prop provided) ────────────────────────
  const [localPurchaseOrders, setLocalPurchaseOrders] = useState<PurchaseOrder[]>([])
  const purchaseOrders = propsPurchaseOrders ?? localPurchaseOrders

  // ── PO creation form ──────────────────────────────────────────────────────
  const [poModalOpen, setPoModalOpen]           = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('sup-1')
  const [poNotes, setPoNotes]                   = useState('')
  const [poDeliveryDays, setPoDeliveryDays]     = useState('3')
  const [poItems, setPoItems]                   = useState<PurchaseOrderItem[]>([])
  const [poCatalogOpen, setPoCatalogOpen]       = useState(false)
  const [poCatalogSearch, setPoCatalogSearch]   = useState('')
  const debouncedPoCatalogSearch                = useDebounce(poCatalogSearch, 250)
  const [poScannerOpen, setPoScannerOpen]       = useState(false)
  const [poScanLoading, setPoScanLoading]       = useState(false)

  // ── PO list view ──────────────────────────────────────────────────────────
  const [poSubTab, setPoSubTab]                   = useState<'orders' | 'suppliers'>('orders')
  const [poSearch, setPoSearch]                   = useState('')
  const debouncedPoSearch                         = useDebounce(poSearch, 250)
  const [selectedPoDetail, setSelectedPoDetail]   = useState<PurchaseOrder | null>(null)
  const [poDetailModalOpen, setPoDetailModalOpen] = useState(false)

  // ── Supplier creation form ────────────────────────────────────────────────
  const [newSupModalOpen, setNewSupModalOpen] = useState(false)
  const [newSupName, setNewSupName]           = useState('')
  const [newSupContact, setNewSupContact]     = useState('')
  const [newSupPhone, setNewSupPhone]         = useState('')
  const [newSupEmail, setNewSupEmail]         = useState('')
  const [newSupAddress, setNewSupAddress]     = useState('')
  const [newSupLeadTime, setNewSupLeadTime]   = useState('3')

  // ── Derived ───────────────────────────────────────────────────────────────
  const poExistingItems = useMemo<ExistingPickerItem[]>(
    () => poItems.map((it) => ({ variantId: it.variantId, sku: it.sku, productName: it.productName, quantity: it.quantity })),
    [poItems]
  )

  const baseVariantsForPO = useMemo(() => {
    const rows: { variantId: string; sku: string; productName: string; displayName: string; costPrice: number }[] = []
    products.forEach((p) => {
      if (!p.variants || p.variants.length === 0) {
        rows.push({ variantId: p.id, sku: p.sku, productName: p.name, displayName: p.name, costPrice: parseFloat(String(p.purchase_price || '0')) || 0 })
        return
      }
      p.variants.forEach((v) => {
        const attrSummary = v.attribute_values?.map((av: ScannedAttributeValue) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
        rows.push({
          variantId: v.id, sku: v.sku, productName: p.name,
          displayName: attrSummary ? `${p.name} (${attrSummary})` : v.name || v.sku,
          costPrice: parseFloat(String((v as ProductVariant).cost_price_override || p.purchase_price || '0')) || 0,
        })
      })
    })
    return rows
  }, [products])

  const selectableVariantsForPO = useMemo(() => {
    const q = debouncedPoCatalogSearch.toLowerCase().trim()
    return baseVariantsForPO.filter((item) =>
      item.displayName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q) || item.productName.toLowerCase().includes(q)
    )
  }, [baseVariantsForPO, debouncedPoCatalogSearch])

  const filteredPurchaseOrders = useMemo(() => {
    if (!debouncedPoSearch.trim()) return purchaseOrders
    const q = debouncedPoSearch.toLowerCase().trim()
    return purchaseOrders.filter((po) =>
      (po.poNumber || '').toLowerCase().includes(q) ||
      (po.supplierName || '').toLowerCase().includes(q) ||
      (po.status || '').toLowerCase().includes(q) ||
      (po.notes || '').toLowerCase().includes(q) ||
      po.items?.some((it) =>
        (it.productName || '').toLowerCase().includes(q) ||
        (it.sku || '').toLowerCase().includes(q)
      )
    )
  }, [purchaseOrders, debouncedPoSearch])

  const filteredSuppliers = useMemo(() => {
    if (!debouncedPoSearch.trim()) return suppliers
    const q = debouncedPoSearch.toLowerCase().trim()
    return suppliers.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.contactPerson || s.contact_person || '')?.toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  }, [suppliers, debouncedPoSearch])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddVariantToPO = useCallback((item: { variantId: string; displayName: string; sku: string; costPrice: number }) => {
    setPoItems((prev) => {
      const idx = prev.findIndex((i) => i.variantId === item.variantId)
      if (idx >= 0) {
        const next = [...prev]
        const nextQty = next[idx].quantity + 1
        next[idx] = { ...next[idx], quantity: nextQty, totalCost: nextQty * next[idx].unitCost }
        return next
      }
      return [...prev, { id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, variantId: item.variantId, productName: item.displayName, sku: item.sku, quantity: 10, unitCost: item.costPrice, totalCost: 10 * item.costPrice }]
    })
    setPoCatalogOpen(false)
  }, [])

  const handleSelectMultipleProductsForPO = useCallback((selectedList: SelectedProductItem[]) => {
    setPoItems((prev) => {
      const next = [...prev]
      selectedList.forEach((it) => {
        const prod = it.product
        const v = it.variant
        const targetVariantId = v?.id || prod.variants?.[0]?.id || prod.id
        const targetSku = v?.sku || prod.sku || 'SKU-UNKNOWN'
        const purchaseCost = parseFloat(String((v as ProductVariant)?.cost_price_override || prod.purchase_price || '0')) || 0
        const attrSummary = v?.attribute_values?.map((av: ScannedAttributeValue) => av.value_name || av.attribute?.name).filter(Boolean).join(' / ')
        const displayName = v ? ((v as ProductVariant).name || (attrSummary ? `${prod.name} (${attrSummary})` : `${prod.name} - ${v.sku}`)) : prod.name
        const orderQty = it.quantity > 1 ? it.quantity : 10
        const idx = next.findIndex((i) => i.variantId === targetVariantId)
        if (idx >= 0) {
          const nextQty = Math.max(1, Math.round(it.quantity || 1))
          next[idx] = { ...next[idx], quantity: nextQty, totalCost: nextQty * next[idx].unitCost }
        } else {
          next.push({ id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, variantId: targetVariantId, productName: displayName, sku: targetSku, quantity: orderQty, unitCost: purchaseCost, totalCost: orderQty * purchaseCost })
        }
      })
      return next
    })
    setPoCatalogOpen(false)
  }, [])

  const handleSelectProductForPO = useCallback((prod: Product, v?: ProductVariant | ScannedVariant) => {
    handleSelectMultipleProductsForPO([{ product: prod, variant: v, quantity: 1 }])
  }, [handleSelectMultipleProductsForPO])

  const handleScanCodeForPO = useCallback(async (code: string) => {
    if (!code || poScanLoading) return
    setPoScanLoading(true)
    try {
      const result = await scanBarcode(code)
      if (result.type === 'variant' && result.variant) {
        handleAddVariantToPO({ variantId: result.variant.id, displayName: result.product?.name ? `${result.product.name} (${result.variant.sku})` : 'Product', sku: result.variant.sku || code, costPrice: parseFloat(result.product?.purchase_price || '0') || 0 })
        Alert.alert('Scanned & Added', `Added ${result.product?.name || 'Product'} to Purchase Order.`)
      } else if (result.type === 'product' && result.variants && result.variants.length > 0) {
        const v = result.variants[0]
        handleAddVariantToPO({ variantId: v.id, displayName: result.product.name, sku: v.sku || code, costPrice: parseFloat(result.product.purchase_price || '0') || 0 })
        Alert.alert('Scanned & Added', `Added ${result.product.name} to Purchase Order.`)
      } else {
        Alert.alert('Not Found', `No matching product found for code: ${code}`)
      }
    } catch { Alert.alert('Scan Error', `Could not scan barcode ${code}`) }
    finally { setPoScanLoading(false); setPoScannerOpen(false) }
  }, [poScanLoading, handleAddVariantToPO])

  const handleUpdatePoItemQty = useCallback((id: string, delta: number) => {
    setPoItems((prev) => prev.map((it) => { if (it.id !== id) return it; const nextQty = Math.max(1, it.quantity + delta); return { ...it, quantity: nextQty, totalCost: nextQty * it.unitCost } }))
  }, [])

  const handleUpdatePoItemCost = useCallback((id: string, text: string) => {
    const cost = Math.max(0, parseFloat(text) || 0)
    setPoItems((prev) => prev.map((it) => it.id !== id ? it : { ...it, unitCost: cost, totalCost: it.quantity * cost }))
  }, [])

  const handleRemovePoItem = useCallback((id: string) => { setPoItems((prev) => prev.filter((it) => it.id !== id)) }, [])

  const handleCreatePO = useCallback(() => {
    if (poItems.length === 0) { Alert.alert('Empty PO', 'Please add at least one product to the purchase order.'); return }
    const sup = suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0]
    const leadDays = parseInt(poDeliveryDays) || sup?.leadTimeDays || 3
    const totalCost = poItems.reduce((sum, it) => sum + it.totalCost, 0)
    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: sup?.id || 'sup-1', supplierName: sup?.name || 'General Supplier',
      status: 'ORDERED', items: poItems, totalCost,
      expectedDeliveryDate: new Date(Date.now() + leadDays * 86400000).toISOString().split('T')[0],
      orderDate: new Date().toISOString().split('T')[0], notes: poNotes.trim() || undefined,
    }
    if (onAddPO) { onAddPO(newPO) } else { setLocalPurchaseOrders((prev) => [newPO, ...prev]) }
    setPoModalOpen(false); setPoItems([]); setPoNotes('')
    Alert.alert('PO Created & Ordered', `Purchase order ${newPO.poNumber} (${poItems.length} items) sent to ${sup?.name}.`)
  }, [poItems, suppliers, selectedSupplierId, poDeliveryDays, poNotes, onAddPO])

  const handleOpenCreatePoForSupplier = useCallback((supId: string) => { setSelectedSupplierId(supId); setPoModalOpen(true) }, [])

  const handleMarkPoReceived = useCallback((poId: string) => {
    if (onMarkPoReceived) { onMarkPoReceived(poId) }
    else { setLocalPurchaseOrders((prev) => prev.map((po) => (po.id === poId ? { ...po, status: 'RECEIVED' } : po))) }
    if (selectedPoDetail?.id === poId) { setSelectedPoDetail({ ...selectedPoDetail, status: 'RECEIVED' }) }
    Alert.alert('Stock Received', 'Purchase order status updated to RECEIVED.')
  }, [onMarkPoReceived, selectedPoDetail])

  const handleCreateSupplier = useCallback(() => {
    if (!newSupName.trim()) { Alert.alert('Required Field', 'Please enter the supplier / company name.'); return }
    const newSup: Supplier = {
      id: `sup-${Date.now()}`, name: newSupName.trim(),
      contactPerson: newSupContact.trim() || 'Account Rep', phone: newSupPhone.trim() || '+855 23 000 111',
      email: newSupEmail.trim() || 'orders@supplier.kh', address: newSupAddress.trim() || 'Phnom Penh, Cambodia',
      leadTimeDays: parseInt(newSupLeadTime) || 3, activeOrdersCount: 0,
    }
    setSuppliers((prev) => [newSup, ...prev])
    setNewSupModalOpen(false); setNewSupName(''); setNewSupContact(''); setNewSupPhone(''); setNewSupEmail(''); setNewSupAddress('')
    Alert.alert('Supplier Registered', `Vendor "${newSup.name}" has been added.`)
  }, [newSupName, newSupContact, newSupPhone, newSupEmail, newSupAddress, newSupLeadTime])

  return {
    suppliers, setSuppliers, loadSuppliers,
    purchaseOrders, localPurchaseOrders, setLocalPurchaseOrders,
    poSubTab, setPoSubTab, poSearch, setPoSearch,
    selectedPoDetail, setSelectedPoDetail, poDetailModalOpen, setPoDetailModalOpen,
    filteredPurchaseOrders, filteredSuppliers,
    poModalOpen, setPoModalOpen, selectedSupplierId, setSelectedSupplierId,
    poNotes, setPoNotes, poDeliveryDays, setPoDeliveryDays,
    poItems, setPoItems, poExistingItems,
    poCatalogOpen, setPoCatalogOpen, poCatalogSearch, setPoCatalogSearch, selectableVariantsForPO,
    poScannerOpen, setPoScannerOpen, poScanLoading,
    newSupModalOpen, setNewSupModalOpen,
    newSupName, setNewSupName, newSupContact, setNewSupContact,
    newSupPhone, setNewSupPhone, newSupEmail, setNewSupEmail,
    newSupAddress, setNewSupAddress, newSupLeadTime, setNewSupLeadTime,
    handleSelectProductForPO, handleSelectMultipleProductsForPO, handleAddVariantToPO,
    handleScanCodeForPO, handleUpdatePoItemQty, handleUpdatePoItemCost, handleRemovePoItem,
    handleCreatePO, handleOpenCreatePoForSupplier, handleMarkPoReceived, handleCreateSupplier,
  }
}
