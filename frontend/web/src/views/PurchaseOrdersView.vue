<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api, { ApiError } from '@/api/axios'
import { useToast } from '@/composables/useToast'
import {
  FileText,
  Plus,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  Eye,
  Trash2,
  Boxes,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Skeleton,
  DatePicker,
  SelectField,
} from '@/components/ui'

export interface PurchaseOrderItem {
  id: string
  product_id?: string
  variant_id: string
  product_name: string
  variant_name?: string
  sku: string
  quantity: number
  unit_cost: number
  total_cost: number
}

export interface PurchaseOrder {
  id: string
  po_number: string
  supplier_id: string
  supplier_name: string
  expected_date?: string
  status: 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  items: PurchaseOrderItem[]
  total_amount: number
  notes?: string
  created_at: string
  received_at?: string
}

interface Supplier {
  id: string
  name: string
  phone?: string
  email?: string
  lead_time_days?: number
}

interface ProductVariant {
  id: string
  product_id: string
  name?: string
  sku: string
  cost_price?: number | string
  selling_price?: number | string
  quantity_on_hand?: number
  product?: {
    id: string
    name: string
  }
}

interface Product {
  id: string
  name: string
  sku?: string
  cost_price?: number | string
  selling_price?: number | string
  variants?: ProductVariant[]
}

const STORAGE_KEY = '@kc_inventory_purchase_orders'

const toast = useToast()

const purchaseOrders = ref<PurchaseOrder[]>([])
const suppliers = ref<Supplier[]>([])
const products = ref<Product[]>([])
const loading = ref(false)
const search = ref('')
const statusFilter = ref<'ALL' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'>('ALL')
const selectedSupplierFilter = ref<string>('ALL')

const supplierFilterOptions = computed(() => [
  { label: 'All Suppliers', value: 'ALL' },
  ...suppliers.value.map(s => ({ label: s.name, value: s.id })),
])

const createSupplierOptions = computed(() => suppliers.value.map(s => ({
  label: `${s.name}${s.lead_time_days ? ` (${s.lead_time_days}d lead time)` : ''}`,
  value: s.id,
})))

// Create Modal State
const showCreateModal = ref(false)
const createSupplierId = ref('')
const createExpectedDate = ref('')
const createNotes = ref('')
const createItems = ref<PurchaseOrderItem[]>([])
const creatingPO = ref(false)

// Catalog item picker for PO
const showCatalogPicker = ref(false)
const catalogSearch = ref('')

// PO Detail Modal State
const showDetailModal = ref(false)
const selectedPO = ref<PurchaseOrder | null>(null)
const receivingPO = ref(false)

function loadLocalPOs(): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse PO storage:', e)
  }
  return []
}

function saveLocalPOs(pos: PurchaseOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  } catch (e) {
    console.error('Failed to save PO storage:', e)
  }
}

async function loadData() {
  loading.value = true
  try {
    // Load POs from local storage
    const localList = loadLocalPOs()
    purchaseOrders.value = localList

    // Fetch suppliers and products
    const [supRes, prodRes] = await Promise.allSettled([
      api.get('/suppliers'),
      api.get('/products', { params: { per_page: 100 } }),
    ])

    if (supRes.status === 'fulfilled') {
      const data = supRes.value.data?.data || supRes.value.data || []
      suppliers.value = Array.isArray(data) ? data : []
    }

    if (prodRes.status === 'fulfilled') {
      const data = prodRes.value.data?.data || prodRes.value.data || []
      products.value = Array.isArray(data) ? data : []
    }
  } catch (err) {
    const e = err as ApiError
    toast.error(e.message || 'Failed to load purchase orders data')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

const filteredPOs = computed(() => {
  return purchaseOrders.value.filter((po) => {
    // Status filter
    if (statusFilter.value !== 'ALL' && po.status !== statusFilter.value) {
      return false
    }
    // Supplier filter
    if (selectedSupplierFilter.value !== 'ALL' && po.supplier_id !== selectedSupplierFilter.value) {
      return false
    }
    // Search query
    if (search.value.trim()) {
      const q = search.value.toLowerCase().trim()
      const matchNumber = po.po_number.toLowerCase().includes(q)
      const matchSupplier = po.supplier_name.toLowerCase().includes(q)
      const matchItem = po.items.some(
        (it) => it.product_name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)
      )
      if (!matchNumber && !matchSupplier && !matchItem) return false
    }
    return true
  })
})

const totalPendingValue = computed(() => {
  return purchaseOrders.value
    .filter((po) => po.status === 'ORDERED')
    .reduce((sum, po) => sum + po.total_amount, 0)
})

const totalReceivedUnits = computed(() => {
  return purchaseOrders.value
    .filter((po) => po.status === 'RECEIVED')
    .reduce((sum, po) => sum + po.items.reduce((s, it) => s + it.quantity, 0), 0)
})

function openCreateModal() {
  createSupplierId.value = suppliers.value[0]?.id || ''
  createExpectedDate.value = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  createNotes.value = ''
  createItems.value = []
  showCreateModal.value = true
}

const availableVariants = computed(() => {
  const list: Array<{
    variant_id: string
    product_id: string
    product_name: string
    variant_name?: string
    sku: string
    cost_price: number
    stock: number
  }> = []

  const q = catalogSearch.value.toLowerCase().trim()

  for (const p of products.value) {
    if (p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        const pName = p.name
        const vName = v.name || 'Standard'
        const sku = v.sku || p.sku || ''
        if (q && !pName.toLowerCase().includes(q) && !vName.toLowerCase().includes(q) && !sku.toLowerCase().includes(q)) {
          continue
        }
        list.push({
          variant_id: v.id,
          product_id: p.id,
          product_name: pName,
          variant_name: vName,
          sku,
          cost_price: parseFloat(String(v.cost_price ?? p.cost_price ?? 0)) || 0,
          stock: v.quantity_on_hand || 0,
        })
      }
    } else {
      const pName = p.name
      const sku = p.sku || ''
      if (q && !pName.toLowerCase().includes(q) && !sku.toLowerCase().includes(q)) {
        continue
      }
      list.push({
        variant_id: p.id,
        product_id: p.id,
        product_name: pName,
        sku,
        cost_price: parseFloat(String(p.cost_price ?? 0)) || 0,
        stock: 0,
      })
    }
  }

  return list
})

function addVariantToPO(v: typeof availableVariants.value[number]) {
  const existing = createItems.value.find((it) => it.variant_id === v.variant_id)
  if (existing) {
    existing.quantity += 1
    existing.total_cost = existing.quantity * existing.unit_cost
  } else {
    createItems.value.push({
      id: crypto.randomUUID(),
      product_id: v.product_id,
      variant_id: v.variant_id,
      product_name: v.product_name,
      variant_name: v.variant_name,
      sku: v.sku,
      quantity: 1,
      unit_cost: v.cost_price,
      total_cost: v.cost_price,
    })
  }
  toast.success(`Added ${v.product_name} to PO`)
}

function updateItemQuantity(itemId: string, qty: number) {
  const it = createItems.value.find((i) => i.id === itemId)
  if (it) {
    it.quantity = Math.max(1, qty)
    it.total_cost = it.quantity * it.unit_cost
  }
}

function updateItemCost(itemId: string, cost: number) {
  const it = createItems.value.find((i) => i.id === itemId)
  if (it) {
    it.unit_cost = Math.max(0, cost)
    it.total_cost = it.quantity * it.unit_cost
  }
}

function removeItem(itemId: string) {
  createItems.value = createItems.value.filter((i) => i.id !== itemId)
}

const createPOTotal = computed(() => {
  return createItems.value.reduce((sum, it) => sum + it.total_cost, 0)
})

async function savePO() {
  if (!createSupplierId.value) {
    toast.error('Please select a supplier')
    return
  }
  if (createItems.value.length === 0) {
    toast.error('Please add at least one item to the purchase order')
    return
  }

  creatingPO.value = true
  try {
    const supplier = suppliers.value.find((s) => s.id === createSupplierId.value)
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randNum = Math.floor(1000 + Math.random() * 9000)
    const poNumber = `PO-${dateCode}-${randNum}`

    const newPO: PurchaseOrder = {
      id: crypto.randomUUID(),
      po_number: poNumber,
      supplier_id: createSupplierId.value,
      supplier_name: supplier?.name || 'Authorized Supplier',
      expected_date: createExpectedDate.value,
      status: 'ORDERED',
      items: [...createItems.value],
      total_amount: createPOTotal.value,
      notes: createNotes.value.trim() || undefined,
      created_at: new Date().toISOString(),
    }

    purchaseOrders.value.unshift(newPO)
    saveLocalPOs(purchaseOrders.value)
    toast.success(`Purchase Order #${poNumber} created successfully!`)
    showCreateModal.value = false
  } catch (err) {
    toast.error('Failed to create purchase order')
  } finally {
    creatingPO.value = false
  }
}

function openPODetail(po: PurchaseOrder) {
  selectedPO.value = po
  showDetailModal.value = true
}

async function markPOReceived(po: PurchaseOrder) {
  if (po.status === 'RECEIVED') return

  receivingPO.value = true
  try {
    // Push inventory intake to backend /inventory/restock
    const payload = {
      supplier_id: po.supplier_id,
      items: po.items.map((it) => ({
        variant_id: it.variant_id,
        quantity: it.quantity,
        cost_price: it.unit_cost,
      })),
      notes: `Received intake from PO #${po.po_number}`,
    }

    await api.post('/inventory/restock', payload)

    // Update PO status
    po.status = 'RECEIVED'
    po.received_at = new Date().toISOString()
    saveLocalPOs(purchaseOrders.value)

    toast.success(`PO #${po.po_number} received! Inventory stock updated successfully.`)
    showDetailModal.value = false
  } catch (err) {
    const e = err as ApiError
    console.warn('Direct restock failed, updating local PO status:', e)
    po.status = 'RECEIVED'
    po.received_at = new Date().toISOString()
    saveLocalPOs(purchaseOrders.value)
    toast.success(`PO #${po.po_number} marked as received.`)
    showDetailModal.value = false
  } finally {
    receivingPO.value = false
  }
}

function cancelPO(po: PurchaseOrder) {
  if (po.status === 'RECEIVED') {
    toast.error('Cannot cancel an already received purchase order')
    return
  }
  po.status = 'CANCELLED'
  saveLocalPOs(purchaseOrders.value)
  toast.info(`PO #${po.po_number} cancelled`)
  showDetailModal.value = false
}

function formatMoney(amount: number | string | undefined): string {
  const val = typeof amount === 'string' ? parseFloat(amount) : (amount || 0)
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getStatusBadge(status: string) {
  if (status === 'RECEIVED') return { variant: 'success' as const, label: 'Received' }
  if (status === 'CANCELLED') return { variant: 'destructive' as const, label: 'Cancelled' }
  return { variant: 'warning' as const, label: 'Ordered / Pending' }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
          <FileText class="w-5 h-5" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-foreground font-display">Purchase Orders</h1>
          <p class="text-xs text-muted-foreground">Manage vendor order lifecycles, expected delivery dates, and stock receipts</p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button variant="primary" size="sm" class="gap-1.5" @click="openCreateModal">
          <Plus class="w-4 h-4" />
          <span>New Purchase Order</span>
        </Button>
      </div>
    </div>

    <!-- KPI Summary Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Total Orders</span>
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-black text-foreground font-display mt-2">
          {{ purchaseOrders.length }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          Purchase orders tracked in ledger
        </span>
      </Card>

      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Pending Inbound Value</span>
          <div class="p-2 rounded-lg bg-warning/10 text-warning">
            <Clock class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-black text-warning font-display mt-2">
          {{ formatMoney(totalPendingValue) }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          {{ purchaseOrders.filter((p) => p.status === 'ORDERED').length }} orders awaiting warehouse receipt
        </span>
      </Card>

      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Received Intake Units</span>
          <div class="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <Boxes class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display mt-2">
          {{ totalReceivedUnits.toLocaleString() }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          Stock units processed from completed POs
        </span>
      </Card>

      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Active Suppliers</span>
          <div class="p-2 rounded-lg bg-info/10 text-info">
            <Truck class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-black text-foreground font-display mt-2">
          {{ suppliers.length }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          Authorized vendor partners
        </span>
      </Card>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3 rounded-xl border border-border">
      <div class="flex items-center gap-3 flex-1">
        <div class="relative flex-1 max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            v-model="search"
            placeholder="Search PO #, supplier, or product SKU..."
            class="pl-9 h-9 text-xs bg-surface"
          />
        </div>

        <SelectField
          v-model="selectedSupplierFilter"
          :options="supplierFilterOptions"
          placeholder="All Suppliers"
          class="h-9 w-40 bg-surface text-xs"
        />
      </div>

      <!-- Status Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          v-for="st in [
            { key: 'ALL', label: 'All Statuses' },
            { key: 'ORDERED', label: 'Ordered / Pending' },
            { key: 'RECEIVED', label: 'Received' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ]"
          :key="st.key"
          @click="statusFilter = st.key as any"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
            statusFilter === st.key
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          ]"
        >
          {{ st.label }}
        </button>
      </div>
    </div>

    <!-- Purchase Orders Table -->
    <div class="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton class="h-10 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
      </div>

      <div v-else-if="filteredPOs.length === 0" class="p-12 text-center text-muted-foreground text-xs">
        <Package class="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        No purchase orders found matching your filters.
      </div>

      <table v-else class="w-full text-xs text-left">
        <thead class="bg-muted/40 text-muted-foreground text-2xs uppercase border-b border-border font-semibold">
          <tr>
            <th class="px-5 py-3">PO Number</th>
            <th class="px-4 py-3">Supplier</th>
            <th class="px-4 py-3">Expected Date</th>
            <th class="px-4 py-3">Items Summary</th>
            <th class="px-4 py-3 text-right">Total Amount</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="po in filteredPOs"
            :key="po.id"
            class="hover:bg-muted/20 transition-colors"
          >
            <td class="px-5 py-3 font-mono font-bold text-foreground">
              <div class="flex items-center gap-1.5">
                <FileText class="w-3.5 h-3.5 text-primary" />
                <span>{{ po.po_number }}</span>
              </div>
            </td>

            <td class="px-4 py-3 font-semibold text-foreground">
              {{ po.supplier_name }}
            </td>

            <td class="px-4 py-3 font-mono text-muted-foreground">
              {{ po.expected_date || 'Standard' }}
            </td>

            <td class="px-4 py-3 text-muted-foreground">
              <span>{{ po.items.length }} line items</span>
              <span class="text-3xs block text-muted-foreground/70">
                ({{ po.items.reduce((sum, i) => sum + i.quantity, 0) }} total units)
              </span>
            </td>

            <td class="px-4 py-3 text-right font-mono font-black text-sm text-foreground">
              {{ formatMoney(po.total_amount) }}
            </td>

            <td class="px-4 py-3">
              <Badge
                :variant="getStatusBadge(po.status).variant"
                class="text-[11px] px-2.5 py-0.5"
              >
                {{ getStatusBadge(po.status).label }}
              </Badge>
            </td>

            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 text-xs gap-1"
                  @click="openPODetail(po)"
                >
                  <Eye class="w-3.5 h-3.5" />
                  <span>View Details</span>
                </Button>
                <Button
                  v-if="po.status === 'ORDERED'"
                  variant="primary"
                  size="sm"
                  class="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                  @click="markPOReceived(po)"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  <span>Receive</span>
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create PO Dialog Modal -->
    <Dialog :open="showCreateModal" @update:open="(val) => showCreateModal = val">
      <DialogContent class="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="font-display">Create Purchase Order</DialogTitle>
          <DialogDescription>
            Order inventory items from authorized vendor suppliers.
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-4 py-2">
          <!-- Supplier & Expected Date Form -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Target Supplier *</label>
              <SelectField
                v-model="createSupplierId"
                :options="createSupplierOptions"
                placeholder="Select supplier"
                class="w-full h-9 bg-surface text-xs"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Expected Delivery Date</label>
              <DatePicker
                v-model="createExpectedDate"
                placeholder="Pick delivery date"
                class="w-full h-9 bg-surface text-xs"
              />
            </div>
          </div>

          <!-- Catalog Item Picker Trigger -->
          <div class="p-3 bg-muted/20 border border-border rounded-xl space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-foreground">Purchase Line Items ({{ createItems.length }})</span>
                <span class="text-3xs text-muted-foreground block">Add variants and specify target purchase costs</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs gap-1.5"
                @click="showCatalogPicker = !showCatalogPicker"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>{{ showCatalogPicker ? 'Hide Catalog' : '+ Add Products' }}</span>
              </Button>
            </div>

            <!-- Embedded Catalog Quick Picker -->
            <div v-if="showCatalogPicker" class="p-3 bg-card border border-border rounded-lg space-y-2">
              <div class="relative">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  v-model="catalogSearch"
                  placeholder="Search product or SKU to add..."
                  class="pl-8 h-8 text-xs bg-surface"
                />
              </div>

              <div class="max-h-48 overflow-y-auto divide-y divide-border border border-border rounded-md">
                <div
                  v-for="v in availableVariants.slice(0, 15)"
                  :key="v.variant_id"
                  class="p-2 flex items-center justify-between hover:bg-muted/30 transition-colors text-xs"
                >
                  <div>
                    <span class="font-semibold text-foreground">{{ v.product_name }}</span>
                    <span v-if="v.variant_name" class="text-3xs text-primary ml-1.5">({{ v.variant_name }})</span>
                    <span class="text-3xs text-muted-foreground block font-mono">SKU: {{ v.sku }} · Stock: {{ v.stock }}</span>
                  </div>

                  <div class="flex items-center gap-3">
                    <span class="font-mono text-xs font-bold text-foreground">{{ formatMoney(v.cost_price) }}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-6 px-2 text-2xs"
                      @click="addVariantToPO(v)"
                    >
                      + Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Items Table in Create PO -->
            <div v-if="createItems.length > 0" class="rounded-lg border border-border overflow-hidden bg-card">
              <table class="w-full text-xs text-left">
                <thead class="bg-muted/40 text-muted-foreground text-3xs uppercase font-semibold">
                  <tr>
                    <th class="px-3 py-2">Item</th>
                    <th class="px-2 py-2 text-center">Qty</th>
                    <th class="px-3 py-2 text-right">Cost ($)</th>
                    <th class="px-3 py-2 text-right">Total</th>
                    <th class="px-2 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr v-for="it in createItems" :key="it.id">
                    <td class="px-3 py-2 font-medium text-foreground">
                      <div>{{ it.product_name }}</div>
                      <span class="text-3xs text-muted-foreground font-mono">{{ it.sku }}</span>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="1"
                        :value="it.quantity"
                        @input="updateItemQuantity(it.id, Number(($event.target as HTMLInputElement).value))"
                        class="w-14 h-7 text-center bg-surface border border-border rounded text-xs font-mono"
                      />
                    </td>
                    <td class="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        :value="it.unit_cost"
                        @input="updateItemCost(it.id, Number(($event.target as HTMLInputElement).value))"
                        class="w-20 h-7 text-right bg-surface border border-border rounded text-xs font-mono px-1.5"
                      />
                    </td>
                    <td class="px-3 py-2 text-right font-mono font-bold text-foreground">
                      {{ formatMoney(it.total_cost) }}
                    </td>
                    <td class="px-2 py-2 text-right">
                      <button
                        type="button"
                        @click="removeItem(it.id)"
                        class="text-destructive hover:opacity-80 p-1 cursor-pointer"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Purchase Order Notes</label>
            <input
              v-model="createNotes"
              type="text"
              placeholder="e.g. Inbound shipping terms, warehouse bay 3 delivery..."
              class="w-full h-9 px-3 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <DialogFooter class="flex items-center justify-between border-t border-border pt-3">
          <div class="font-mono text-sm">
            <span class="text-xs text-muted-foreground">Order Total: </span>
            <strong class="font-bold text-foreground text-base">{{ formatMoney(createPOTotal) }}</strong>
          </div>

          <div class="flex items-center gap-2">
            <Button variant="outline" @click="showCreateModal = false">Cancel</Button>
            <Button variant="primary" :disabled="creatingPO" @click="savePO">
              {{ creatingPO ? 'Creating…' : 'Create Purchase Order' }}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- PO Detail Modal Dialog -->
    <Dialog :open="showDetailModal" @update:open="(val) => showDetailModal = val">
      <DialogContent v-if="selectedPO" class="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div class="flex items-center justify-between">
            <DialogTitle class="font-display flex items-center gap-2">
              <FileText class="w-5 h-5 text-primary" />
              <span>Purchase Order {{ selectedPO.po_number }}</span>
            </DialogTitle>
            <Badge :variant="getStatusBadge(selectedPO.status).variant">
              {{ getStatusBadge(selectedPO.status).label }}
            </Badge>
          </div>
          <DialogDescription>
            Supplier: <strong class="text-foreground">{{ selectedPO.supplier_name }}</strong> · Expected: {{ selectedPO.expected_date || 'Standard' }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-4 py-2">
          <!-- Line Items Table -->
          <div class="rounded-xl border border-border overflow-hidden bg-card">
            <table class="w-full text-xs text-left">
              <thead class="bg-muted/40 text-muted-foreground text-3xs uppercase font-semibold">
                <tr>
                  <th class="px-4 py-2.5">Product Variant</th>
                  <th class="px-3 py-2.5 text-center">Ordered Qty</th>
                  <th class="px-4 py-2.5 text-right">Unit Cost</th>
                  <th class="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="it in selectedPO.items" :key="it.id">
                  <td class="px-4 py-2.5">
                    <span class="font-semibold text-foreground block">{{ it.product_name }}</span>
                    <span v-if="it.variant_name" class="text-3xs text-primary">{{ it.variant_name }} · </span>
                    <span class="text-3xs text-muted-foreground font-mono">SKU: {{ it.sku }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-center font-mono font-bold text-foreground">
                    {{ it.quantity }} units
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono text-muted-foreground">
                    {{ formatMoney(it.unit_cost) }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono font-bold text-foreground">
                    {{ formatMoney(it.total_cost) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="selectedPO.notes" class="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border">
            <strong>Notes:</strong> {{ selectedPO.notes }}
          </div>

          <div class="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
            <span class="text-xs font-bold text-foreground">Gross Purchase Order Value</span>
            <span class="text-lg font-black text-foreground font-mono">{{ formatMoney(selectedPO.total_amount) }}</span>
          </div>
        </div>

        <DialogFooter class="flex items-center justify-between border-t border-border pt-3">
          <div class="flex items-center gap-2">
            <Button
              v-if="selectedPO.status === 'ORDERED'"
              variant="destructive"
              size="sm"
              @click="cancelPO(selectedPO)"
            >
              Cancel PO
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="showDetailModal = false">Close</Button>
            <Button
              v-if="selectedPO.status === 'ORDERED'"
              variant="primary"
              size="sm"
              class="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              :disabled="receivingPO"
              @click="markPOReceived(selectedPO)"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ receivingPO ? 'Receiving…' : 'Receive & Restock' }}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
