import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface RestockLineItem {
  tempId: string
  variant_id: string
  product_id?: string
  parent_name?: string
  sku: string
  product_name: string
  scanned_barcode: string | null
  quantity: number
  unit_cost: number
  selling_price?: number
  current_stock?: number
  thumbnail_url?: string
}

export interface RestockGroupedProduct {
  groupKey: string
  productId?: string
  parentName: string
  thumbnailUrl?: string
  totalQty: number
  totalCost: number
  totalRetailValue: number
  items: RestockLineItem[]
}

export interface RestockScanResult {
  type: 'variant' | 'product'
  variant?: {
    id: string
    product_id: string
    sku: string
    barcode: string | null
    cost_price: number | string
    selling_price: number | string
    quantity_on_hand: number
    product?: { id?: string; name: string; thumbnail?: string }
  }
  product?: {
    id: string
    name: string
    barcode: string | null
    purchase_price: number | string
    thumbnail?: string
  }
  variants?: Array<{
    id: string
    sku: string
    barcode: string | null
    cost_price: number | string
    selling_price: number | string
    quantity_on_hand: number
  }>
}

const STORAGE_KEY = 'omnipos_restock_draft_v1'

export const useRestockStore = defineStore('restock', () => {
  const sessionDate = ref<string>(new Date().toISOString().slice(0, 10))
  const notes = ref<string>('')
  const supplierId = ref<string | null>(null)
  const supplierName = ref<string>('')
  const linkedPoId = ref<string | null>(null)
  const linkedPoNumber = ref<string>('')
  const items = ref<RestockLineItem[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const isDraftLoaded = ref(false)

  // Totals & Financial Valuation
  const totals = computed(() => {
    let totalUnits = 0
    let totalCost = 0
    let totalRetailValue = 0

    for (const item of items.value) {
      totalUnits += item.quantity
      totalCost += item.quantity * item.unit_cost
      const retailPrice = item.selling_price ?? (item.unit_cost > 0 ? item.unit_cost * 1.3 : 0)
      totalRetailValue += item.quantity * retailPrice
    }

    const estimatedProfit = Math.max(0, totalRetailValue - totalCost)
    const marginPercent = totalRetailValue > 0 ? ((estimatedProfit / totalRetailValue) * 100) : 0

    return {
      lineCount: items.value.length,
      totalUnits,
      totalCost,
      totalRetailValue,
      estimatedProfit,
      marginPercent,
    }
  })

  // Hierarchical Grouping by Parent Product
  const groupedProducts = computed<RestockGroupedProduct[]>(() => {
    const map = new Map<string, RestockGroupedProduct>()

    for (const item of items.value) {
      const groupKey = item.product_id || item.parent_name || item.product_name
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          productId: item.product_id,
          parentName: item.parent_name || item.product_name,
          thumbnailUrl: item.thumbnail_url,
          totalQty: 0,
          totalCost: 0,
          totalRetailValue: 0,
          items: [],
        })
      }

      const group = map.get(groupKey)!
      group.items.push(item)
      group.totalQty += item.quantity
      group.totalCost += item.quantity * item.unit_cost
      const retailPrice = item.selling_price ?? (item.unit_cost > 0 ? item.unit_cost * 1.3 : 0)
      group.totalRetailValue += item.quantity * retailPrice
    }

    return Array.from(map.values())
  })

  function saveDraft() {
    try {
      const draft = {
        sessionDate: sessionDate.value,
        notes: notes.value,
        supplierId: supplierId.value,
        supplierName: supplierName.value,
        linkedPoId: linkedPoId.value,
        linkedPoNumber: linkedPoNumber.value,
        items: items.value,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch {
      // Storage error ignored
    }
  }

  function loadDraft(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const draft = JSON.parse(raw)
      if (draft && Array.isArray(draft.items) && draft.items.length > 0) {
        sessionDate.value = draft.sessionDate || new Date().toISOString().slice(0, 10)
        notes.value = draft.notes || ''
        supplierId.value = draft.supplierId || null
        supplierName.value = draft.supplierName || ''
        linkedPoId.value = draft.linkedPoId || null
        linkedPoNumber.value = draft.linkedPoNumber || ''
        items.value = draft.items
        isDraftLoaded.value = true
        return true
      }
    } catch {
      // Invalid draft ignored
    }
    return false
  }

  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage error ignored
    }
    sessionDate.value = new Date().toISOString().slice(0, 10)
    notes.value = ''
    supplierId.value = null
    supplierName.value = ''
    linkedPoId.value = null
    linkedPoNumber.value = ''
    items.value = []
    isDraftLoaded.value = false
    error.value = null
  }

  function addItem(item: Omit<RestockLineItem, 'tempId'>) {
    const existingIndex = items.value.findIndex(i => i.variant_id === item.variant_id)
    if (existingIndex !== -1) {
      items.value[existingIndex].quantity += item.quantity
      if (item.unit_cost > 0) {
        items.value[existingIndex].unit_cost = item.unit_cost
      }
      if (item.current_stock !== undefined) {
        items.value[existingIndex].current_stock = item.current_stock
      }
    } else {
      items.value.push({
        ...item,
        tempId: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      })
    }
    saveDraft()
  }

  function updateItemQty(tempId: string, quantity: number) {
    const item = items.value.find(i => i.tempId === tempId)
    if (item) {
      item.quantity = Math.max(1, quantity)
      saveDraft()
    }
  }

  function quickAdjustQty(tempId: string, delta: number) {
    const item = items.value.find(i => i.tempId === tempId)
    if (item) {
      item.quantity = Math.max(1, item.quantity + delta)
      saveDraft()
    }
  }

  function updateItemCost(tempId: string, cost: number) {
    const item = items.value.find(i => i.tempId === tempId)
    if (item) {
      item.unit_cost = Math.max(0, cost)
      saveDraft()
    }
  }

  function removeItem(tempId: string) {
    items.value = items.value.filter(i => i.tempId !== tempId)
    saveDraft()
  }

  function linkPurchaseOrder(po: { id: string; po_number?: string; poNumber?: string; supplier_name?: string; supplierName?: string; items?: any[] }) {
    linkedPoId.value = po.id
    linkedPoNumber.value = po.po_number || po.poNumber || `PO-${po.id.slice(0, 8)}`
    if (po.supplier_name || po.supplierName) {
      supplierName.value = po.supplier_name || po.supplierName || ''
    }

    if (po.items && Array.isArray(po.items)) {
      for (const it of po.items) {
        const variantId = it.variant_id || it.variantId || it.id
        const unitCost = parseFloat(String(it.unit_cost || it.unitCost || it.cost_price || 0)) || 0
        const qty = parseInt(String(it.quantity || it.expected_qty || 1)) || 1
        
        addItem({
          variant_id: variantId,
          product_id: it.product_id || it.productId,
          parent_name: it.product_name || it.productName || 'Product',
          sku: it.sku || 'SKU',
          product_name: it.variant_name || it.product_name || it.productName || 'Item',
          scanned_barcode: it.barcode || null,
          quantity: qty,
          unit_cost: unitCost,
          selling_price: parseFloat(String(it.selling_price || 0)) || undefined,
          current_stock: it.current_stock || 0,
        })
      }
    }
    saveDraft()
  }

  function unlinkPurchaseOrder() {
    linkedPoId.value = null
    linkedPoNumber.value = ''
    saveDraft()
  }

  function setSupplier(id: string | null, name: string) {
    supplierId.value = id
    supplierName.value = name
    saveDraft()
  }

  async function lookupBarcode(code: string): Promise<RestockScanResult> {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/inventory/scan', { params: { code: code.trim() } })
      return res.data.data as RestockScanResult
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Product / Barcode not found.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function commitRestock() {
    if (items.value.length === 0) {
      throw new Error('Please add at least one line item to the restock session.')
    }

    submitting.value = true
    error.value = null

    let noteText = notes.value.trim()
    if (linkedPoNumber.value) {
      noteText = `[Linked PO: ${linkedPoNumber.value}] ${noteText}`.trim()
    }
    if (supplierName.value && !noteText.includes(supplierName.value)) {
      noteText = `[Supplier: ${supplierName.value}] ${noteText}`.trim()
    }

    const payload = {
      session_date: sessionDate.value,
      notes: noteText || undefined,
      items: items.value.map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        scanned_barcode: item.scanned_barcode || undefined,
      })),
    }

    try {
      const res = await api.post('/inventory/restock', payload)
      clearDraft()
      return res.data.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to commit restock session.'
      }
      throw e
    } finally {
      submitting.value = false
    }
  }

  return {
    sessionDate,
    notes,
    supplierId,
    supplierName,
    linkedPoId,
    linkedPoNumber,
    items,
    groupedProducts,
    loading,
    submitting,
    error,
    isDraftLoaded,
    totals,
    addItem,
    updateItemQty,
    quickAdjustQty,
    updateItemCost,
    removeItem,
    linkPurchaseOrder,
    unlinkPurchaseOrder,
    setSupplier,
    lookupBarcode,
    saveDraft,
    loadDraft,
    clearDraft,
    commitRestock,
  }
})

