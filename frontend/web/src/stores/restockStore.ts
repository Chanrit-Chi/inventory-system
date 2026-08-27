import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface RestockLineItem {
  tempId: string
  variant_id: string
  sku: string
  product_name: string
  scanned_barcode: string | null
  quantity: number
  unit_cost: number
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
    product?: { name: string }
  }
  product?: {
    id: string
    name: string
    barcode: string | null
    purchase_price: number | string
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
  const items = ref<RestockLineItem[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const isDraftLoaded = ref(false)

  const totals = computed(() => {
    let totalUnits = 0
    let totalCost = 0
    for (const item of items.value) {
      totalUnits += item.quantity
      totalCost += item.quantity * item.unit_cost
    }
    return {
      lineCount: items.value.length,
      totalUnits,
      totalCost,
    }
  })

  function saveDraft() {
    try {
      const draft = {
        sessionDate: sessionDate.value,
        notes: notes.value,
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

    const payload = {
      session_date: sessionDate.value,
      notes: notes.value.trim() || undefined,
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
    items,
    loading,
    submitting,
    error,
    isDraftLoaded,
    totals,
    addItem,
    updateItemQty,
    updateItemCost,
    removeItem,
    lookupBarcode,
    saveDraft,
    loadDraft,
    clearDraft,
    commitRestock,
  }
})
