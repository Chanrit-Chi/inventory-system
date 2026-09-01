<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useRestockStore, type RestockScanResult } from '@/stores/restockStore'
import api from '@/api/axios'
import {
  ArrowDownToLine,
  Check,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Info,
  Search,
  Package,
  Plus,
  Minus,
  FileText,
  Truck,
  Link as LinkIcon,
  Unlink,
  Layers,
  TrendingUp,
  DollarSign,
  Boxes,
  ScanLine,
  CheckCircle2,
  X,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Card,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  StatCard,
  DatePicker,
  SelectField,
} from '@/components/ui'

const router = useRouter()
const restockStore = useRestockStore()

const barcodeInput = ref('')
const scanError = ref('')
const successMessage = ref('')
const showVariantPicker = ref(false)
const multiVariantProduct = ref<RestockScanResult | null>(null)
const discardConfirm = ref(false)
const lastScanFeedback = ref<{ name: string; sku: string; time: number } | null>(null)

// Suppliers State
interface SupplierOption {
  id: string
  name: string
  contact_person?: string
  phone?: string
}
const suppliersList = ref<SupplierOption[]>([])
const loadingSuppliers = ref(false)

const supplierOptions = computed(() => [
  { label: '-- Direct Intake (No Supplier) --', value: '' },
  ...suppliersList.value.map(s => ({
    label: `${s.name}${s.contact_person ? ` (${s.contact_person})` : ''}`,
    value: s.id,
  })),
])

// Catalog Picker Modal State
const showCatalogModal = ref(false)
const catalogSearch = ref('')
const catalogLoading = ref(false)
const catalogProducts = ref<any[]>([])
const selectedCatalogVariants = ref<Record<string, { product: any; variant: any; qty: number; cost: number; selling: number }>>({})

// Purchase Order Linking Modal State
const showPoModal = ref(false)
const loadingPos = ref(false)
const pendingPurchaseOrders = ref<any[]>([])

const activeStep = computed(() => {
  if (restockStore.items.length === 0) return 1
  if (restockStore.items.length > 0 && !restockStore.submitting) return 2
  return 3
})

onMounted(() => {
  restockStore.loadDraft()
  fetchSuppliers()
  fetchPendingPOs()
})

async function fetchSuppliers() {
  try {
    loadingSuppliers.value = true
    const res = await api.get('/suppliers')
    const list = res.data?.data || res.data || []
    suppliersList.value = Array.isArray(list) ? list : []
  } catch {
    // Non-blocking
  } finally {
    loadingSuppliers.value = false
  }
}

async function fetchPendingPOs() {
  try {
    loadingPos.value = true
    // Try localStorage POs first
    const raw = localStorage.getItem('@kc_inventory_purchase_orders')
    let pos: any[] = []
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          pos = parsed.filter((p: any) => p.status === 'ORDERED' || p.status === 'DRAFT')
        }
      } catch {
        // ignore
      }
    }

    // Also fetch quotations/estimates if any
    try {
      const res = await api.get('/quotations')
      const list = res.data?.data || res.data || []
      if (Array.isArray(list)) {
        const quotes = list.filter((q: any) => q.status === 'APPROVED' || q.status === 'PENDING').map((q: any) => ({
          id: q.id,
          po_number: q.quotation_number || `QT-${q.id.slice(0, 6)}`,
          supplier_name: q.customer_name || 'Vendor',
          total_amount: q.total_amount || 0,
          created_at: q.created_at,
          items: (q.items || []).map((it: any) => ({
            variant_id: it.product_variant_id || it.variant_id || it.id,
            product_name: it.product_name || 'Item',
            sku: it.sku || 'SKU',
            quantity: it.quantity || 1,
            unit_cost: it.unit_price || 0,
          })),
        }))
        pos = [...pos, ...quotes]
      }
    } catch {
      // ignore
    }

    pendingPurchaseOrders.value = pos
  } finally {
    loadingPos.value = false
  }
}

async function openCatalogPicker() {
  showCatalogModal.value = true
  selectedCatalogVariants.value = {}
  if (catalogProducts.value.length === 0) {
    await fetchCatalogProducts()
  }
}

async function fetchCatalogProducts() {
  try {
    catalogLoading.value = true
    const res = await api.get('/products', { params: { per_page: 50 } })
    const list = res.data?.data || res.data || []
    catalogProducts.value = Array.isArray(list) ? list : []
  } catch (e: unknown) {
    scanError.value = 'Failed to load catalog products'
  } finally {
    catalogLoading.value = false
  }
}

const filteredCatalogProducts = computed(() => {
  const q = catalogSearch.value.toLowerCase().trim()
  if (!q) return catalogProducts.value
  return catalogProducts.value.filter((p: any) => {
    const nameMatch = (p.name || '').toLowerCase().includes(q)
    const skuMatch = (p.sku || '').toLowerCase().includes(q)
    const catMatch = (p.category?.name || '').toLowerCase().includes(q)
    const variantMatch = (p.variants || []).some((v: any) => 
      (v.sku || '').toLowerCase().includes(q) || 
      (v.barcode || '').toLowerCase().includes(q)
    )
    return nameMatch || skuMatch || catMatch || variantMatch
  })
})

function toggleCatalogVariant(product: any, variant: any) {
  const key = variant.id
  if (selectedCatalogVariants.value[key]) {
    delete selectedCatalogVariants.value[key]
  } else {
    const cost = parseFloat(String(variant.cost_price || variant.cost_price_override || product.purchase_price || 0)) || 0
    const selling = parseFloat(String(variant.selling_price || product.selling_price || 0)) || 0
    selectedCatalogVariants.value[key] = {
      product,
      variant,
      qty: 1,
      cost,
      selling,
    }
  }
}

function commitCatalogSelection() {
  const entries = Object.values(selectedCatalogVariants.value)
  if (entries.length === 0) {
    showCatalogModal.value = false
    return
  }

  for (const entry of entries) {
    const { product, variant, qty, cost, selling } = entry
    const attrSummary = (variant.attribute_values || [])
      .map((av: any) => av.value_name || av.value || av.attribute?.name)
      .filter(Boolean)
      .join(' / ')
    
    const displayName = attrSummary ? `${product.name} (${attrSummary})` : variant.sku ? `${product.name} - ${variant.sku}` : product.name

    restockStore.addItem({
      variant_id: variant.id,
      product_id: product.id,
      parent_name: product.name,
      sku: variant.sku || product.sku || 'SKU',
      product_name: displayName,
      scanned_barcode: variant.barcode || product.barcode || null,
      quantity: qty,
      unit_cost: cost,
      selling_price: selling,
      current_stock: variant.quantity_on_hand ?? product.quantity_on_hand ?? 0,
      thumbnail_url: product.thumbnail || product.image_url,
    })
  }

  showCatalogModal.value = false
  selectedCatalogVariants.value = {}
}

function handleLinkPO(po: any) {
  restockStore.linkPurchaseOrder(po)
  showPoModal.value = false
}

function handleSupplierChange(val: string | number) {
  const sId = String(val)
  const found = suppliersList.value.find(s => s.id === sId)
  restockStore.setSupplier(sId || null, found ? found.name : '')
}

async function handleBarcodeScan() {
  const code = barcodeInput.value.trim()
  if (!code) return

  scanError.value = ''
  try {
    const result = await restockStore.lookupBarcode(code)
    barcodeInput.value = ''

    if (result.type === 'variant' && result.variant) {
      const v = result.variant
      const itemName = v.product?.name ? `${v.product.name} (${v.sku})` : v.sku
      restockStore.addItem({
        variant_id: v.id,
        product_id: v.product_id || v.product?.id,
        parent_name: v.product?.name || 'Product',
        sku: v.sku,
        product_name: itemName,
        scanned_barcode: v.barcode || code,
        quantity: 1,
        unit_cost: parseFloat(String(v.cost_price)) || 0,
        selling_price: parseFloat(String(v.selling_price)) || 0,
        current_stock: v.quantity_on_hand ?? 0,
        thumbnail_url: v.product?.thumbnail,
      })
      lastScanFeedback.value = { name: itemName, sku: v.sku, time: Date.now() }
      setTimeout(() => { lastScanFeedback.value = null }, 3500)
    } else if (result.type === 'product' && result.variants && result.variants.length > 0) {
      if (result.variants.length === 1) {
        const v = result.variants[0]
        const itemName = result.product?.name ? `${result.product.name} (${v.sku})` : v.sku
        restockStore.addItem({
          variant_id: v.id,
          product_id: result.product?.id,
          parent_name: result.product?.name || 'Product',
          sku: v.sku,
          product_name: itemName,
          scanned_barcode: v.barcode || code,
          quantity: 1,
          unit_cost: parseFloat(String(v.cost_price || result.product?.purchase_price)) || 0,
          selling_price: parseFloat(String(v.selling_price)) || 0,
          current_stock: v.quantity_on_hand ?? 0,
          thumbnail_url: result.product?.thumbnail,
        })
        lastScanFeedback.value = { name: itemName, sku: v.sku, time: Date.now() }
        setTimeout(() => { lastScanFeedback.value = null }, 3500)
      } else {
        multiVariantProduct.value = result
        showVariantPicker.value = true
      }
    } else {
      scanError.value = 'No matching product or variant found for code.'
    }
  } catch (e: unknown) {
    scanError.value = e instanceof Error ? e.message : 'Failed to lookup barcode.'
  }
}

function selectVariantFromModal(variant: {
  id: string
  sku: string
  barcode: string | null
  cost_price: number | string
  selling_price?: number | string
  quantity_on_hand?: number
}) {
  if (!multiVariantProduct.value?.product) return

  const itemName = `${multiVariantProduct.value.product.name} (${variant.sku})`
  restockStore.addItem({
    variant_id: variant.id,
    product_id: multiVariantProduct.value.product.id,
    parent_name: multiVariantProduct.value.product.name,
    sku: variant.sku,
    product_name: itemName,
    scanned_barcode: variant.barcode || multiVariantProduct.value.product.barcode,
    quantity: 1,
    unit_cost: parseFloat(String(variant.cost_price || multiVariantProduct.value.product.purchase_price)) || 0,
    selling_price: parseFloat(String(variant.selling_price || 0)) || undefined,
    current_stock: variant.quantity_on_hand ?? 0,
    thumbnail_url: multiVariantProduct.value.product.thumbnail,
  })

  lastScanFeedback.value = { name: itemName, sku: variant.sku, time: Date.now() }
  setTimeout(() => { lastScanFeedback.value = null }, 3500)

  showVariantPicker.value = false
  multiVariantProduct.value = null
}

function closeVariantPicker() {
  showVariantPicker.value = false
  multiVariantProduct.value = null
}

async function handleCompleteSession() {
  successMessage.value = ''
  scanError.value = ''
  try {
    await restockStore.commitRestock()
    successMessage.value = 'Restock batch committed successfully! Inventory updated.'
    setTimeout(() => {
      router.push('/inventory')
    }, 1200)
  } catch (e: unknown) {
    scanError.value = e instanceof Error ? e.message : 'Failed to commit restock.'
  }
}

function promptDiscardDraft() {
  discardConfirm.value = true
}

function executeDiscardDraft() {
  restockStore.clearDraft()
  discardConfirm.value = false
}

function fmtMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Restock Intake Batch</h1>
          <Badge variant="warning" class="font-mono text-xs px-2.5 py-0.5 font-bold">
            DRAFT INTAKE
          </Badge>
          <Badge v-if="restockStore.linkedPoNumber" variant="primary" class="font-mono text-xs px-2.5 py-0.5 flex items-center gap-1">
            <FileText :size="11" />
            <span>PO: {{ restockStore.linkedPoNumber }}</span>
          </Badge>
          <Badge v-if="restockStore.items.length > 0" variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ restockStore.totals.lineCount }} Lines / {{ restockStore.totals.totalUnits }} Units
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Scan barcodes or browse catalog, verify unit costs, link supplier purchase orders, and commit atomic inventory intake.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button
          v-if="restockStore.items.length > 0"
          id="btn-discard-draft"
          variant="ghost"
          size="sm"
          class="text-destructive hover:bg-destructive/10 text-xs"
          @click="promptDiscardDraft"
        >
          Discard Draft
        </Button>

        <RouterLink to="/inventory">
          <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs">
            <ArrowLeft :size="14" />
            <span>Back to Ledger</span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- Financial Valuation Summary Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label="Total Intake Units"
        :value="`${restockStore.totals.totalUnits} Units`"
        :sub="`${restockStore.totals.lineCount} item variants`"
        :icon="Boxes"
        icon-variant="primary"
      />
      <StatCard
        label="Batch Cost Investment"
        :value="fmtMoney(restockStore.totals.totalCost)"
        sub="Incoming wholesale cost"
        :icon="DollarSign"
        icon-variant="warning"
      />
      <StatCard
        label="Est. Retail Valuation"
        :value="fmtMoney(restockStore.totals.totalRetailValue)"
        sub="Projected sales revenue"
        :icon="TrendingUp"
        icon-variant="success"
      />
      <StatCard
        label="Projected Margin"
        :value="`${restockStore.totals.marginPercent.toFixed(1)}%`"
        :sub="`Est. Profit: ${fmtMoney(restockStore.totals.estimatedProfit)}`"
        :icon="Layers"
        icon-variant="purple"
      />
    </div>

    <!-- Stepper Workflow Header -->
    <div class="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1"
          :class="activeStep === 1 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            :class="restockStore.items.length > 0 ? 'bg-success text-success-foreground' : activeStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <Check v-if="restockStore.items.length > 0" :size="14" />
            <span v-else>1</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Scan / Select Products</div>
            <div class="text-[11px] text-muted-foreground">Barcode gun, search, or PO link</div>
          </div>
        </div>

        <div class="hidden sm:block w-8 h-px bg-border flex-shrink-0" />

        <div
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1"
          :class="activeStep === 2 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            :class="restockStore.items.length > 0 ? 'bg-success text-success-foreground' : activeStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <Check v-if="restockStore.items.length > 0" :size="14" />
            <span v-else>2</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Verify Quantities & Costs</div>
            <div class="text-[11px] text-muted-foreground">Review projected stock & unit cost</div>
          </div>
        </div>

        <div class="hidden sm:block w-8 h-px bg-border flex-shrink-0" />

        <div
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1"
          :class="activeStep === 3 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            :class="activeStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <span>3</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Review & Commit</div>
            <div class="text-[11px] text-muted-foreground">Atomic stock ledger update</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Restored Draft Notice -->
    <Alert v-if="restockStore.isDraftLoaded" variant="info">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <Info :size="15" class="flex-shrink-0" />
          <span>Restored saved draft session from local browser storage.</span>
        </div>
        <Button variant="ghost" size="sm" class="h-6 text-xs text-destructive hover:bg-destructive/10 cursor-pointer" @click="executeDiscardDraft">
          Clear Draft
        </Button>
      </div>
    </Alert>

    <!-- Alert Notifications -->
    <Alert v-if="scanError || restockStore.error" variant="error">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" class="flex-shrink-0" />
        <span>{{ scanError || restockStore.error }}</span>
      </div>
    </Alert>

    <Alert v-if="successMessage" variant="success">
      <div class="flex items-center gap-2">
        <Check :size="16" class="flex-shrink-0" />
        <span>{{ successMessage }}</span>
      </div>
    </Alert>

    <!-- Session Metadata & Supplier Linking Card -->
    <Card class="p-4 bg-card border-border">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <!-- Date -->
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Session Intake Date *</label>
          <DatePicker
            id="restock-date"
            v-model="restockStore.sessionDate"
            class="h-9 w-full bg-surface"
            @change="restockStore.saveDraft"
          />
        </div>

        <!-- Supplier Dropdown -->
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
            <span>Supplier / Vendor</span>
            <span v-if="loadingSuppliers" class="text-[10px] text-muted-foreground animate-pulse">Loading…</span>
          </label>
          <SelectField
            :model-value="restockStore.supplierId || ''"
            :options="supplierOptions"
            placeholder="-- Direct Intake (No Supplier) --"
            class="h-9 w-full bg-surface text-xs"
            @update:model-value="handleSupplierChange"
          />
        </div>

        <!-- PO Linking Info / Trigger -->
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Purchase Order (PO)</label>
          <div v-if="restockStore.linkedPoNumber" class="flex items-center gap-2 h-9 px-3 rounded-md bg-primary/10 border border-primary/20">
            <FileText :size="14" class="text-primary shrink-0" />
            <span class="text-xs font-mono font-bold text-primary flex-1 truncate">{{ restockStore.linkedPoNumber }}</span>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
              title="Unlink PO"
              @click="restockStore.unlinkPurchaseOrder"
            >
              <Unlink :size="13" />
            </Button>
          </div>
          <Button
            v-else
            variant="outline"
            size="sm"
            class="w-full h-9 justify-start text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            @click="showPoModal = true"
          >
            <LinkIcon :size="13" />
            <span>Link Open Purchase Order…</span>
          </Button>
        </div>
      </div>

      <!-- Notes Input -->
      <div class="mt-3 pt-3 border-t border-border">
        <label class="block text-xs font-semibold text-foreground mb-1">Session / Shipment Notes</label>
        <Input
          id="restock-notes"
          v-model="restockStore.notes"
          type="text"
          placeholder="e.g. Supplier Invoice #INV-2026-088 — Inbound container delivery"
          class="h-9 bg-surface text-sm"
          @input="restockStore.saveDraft"
        />
      </div>
    </Card>

    <!-- Rapid Barcode Scanner & Intake Command Station -->
    <div class="rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-card via-card to-primary/5 p-5 shadow-xs space-y-4">
      <!-- Top Bar: Station Header & Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <ScanLine :size="20" />
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="font-display font-bold text-base text-foreground">Rapid Barcode Scanner & Product Intake</h2>
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20">
                <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                Scanner Ready
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              Scan physical barcodes with any USB/Bluetooth gun or type SKU and press <kbd class="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-surface rounded border border-border">Enter ↵</kbd>
            </p>
          </div>
        </div>

        <!-- Quick Action Launchers -->
        <div class="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            class="h-9 px-3.5 gap-2 text-xs font-semibold bg-surface hover:bg-surface-subtle border-border shadow-2xs cursor-pointer"
            @click="openCatalogPicker"
          >
            <Search :size="14" class="text-primary" />
            <span>Browse Catalog</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-9 px-3.5 gap-2 text-xs font-semibold bg-surface hover:bg-surface-subtle border-border shadow-2xs cursor-pointer"
            @click="showPoModal = true"
          >
            <FileText :size="14" class="text-primary" />
            <span>Link Purchase Order</span>
            <Badge v-if="restockStore.linkedPoNumber" variant="primary" class="ml-1 text-[10px] py-0 px-1.5">Linked</Badge>
          </Button>
        </div>
      </div>

      <!-- Central Search & Scan Input Box -->
      <div class="relative flex items-center gap-2">
        <div class="relative flex-1">
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center gap-1.5">
            <ScanLine :size="18" class="text-primary" />
          </div>

          <input
            id="restock-barcode-input"
            v-model="barcodeInput"
            type="text"
            placeholder="Scan barcode with scanner gun, or type SKU / barcode and press Enter ↵…"
            class="w-full h-12 pl-11 pr-24 rounded-xl bg-surface border-2 border-primary/25 hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 transition-all outline-none"
            :disabled="restockStore.loading || restockStore.submitting"
            autofocus
            @keydown.enter.prevent="handleBarcodeScan"
          />

          <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <button
              v-if="barcodeInput"
              type="button"
              class="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-subtle cursor-pointer"
              title="Clear input"
              @click="barcodeInput = ''"
            >
              <X :size="13" />
            </button>

            <span class="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground bg-surface-subtle border border-border rounded">
              ENTER ↵
            </span>
          </div>
        </div>

        <Button
          id="btn-scan-intake"
          variant="primary"
          class="h-12 px-6 gap-2 text-xs font-bold shrink-0 cursor-pointer shadow-sm"
          :disabled="!barcodeInput.trim() || restockStore.loading || restockStore.submitting"
          @click="handleBarcodeScan"
        >
          <span v-if="restockStore.loading" class="animate-spin mr-1">⏳</span>
          <ArrowDownToLine v-else :size="16" />
          <span>{{ restockStore.loading ? 'Looking up…' : 'Add to Batch' }}</span>
        </Button>
      </div>

      <!-- Live Scan Feedback Flash Pill -->
      <div v-if="lastScanFeedback" class="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium transition-all">
        <CheckCircle2 :size="16" class="shrink-0 text-success" />
        <span class="font-semibold text-foreground">Scanned:</span>
        <span class="font-bold font-mono text-primary">{{ lastScanFeedback.sku }}</span>
        <span class="text-foreground truncate">— {{ lastScanFeedback.name }}</span>
        <Badge variant="success" class="ml-auto text-[10px] font-mono shrink-0">+1 Staged</Badge>
      </div>
    </div>

    <!-- Hierarchical Product Line Items -->
    <div class="space-y-4">
      <div class="flex items-center justify-between px-1">
        <div>
          <h2 class="font-display font-bold text-lg text-foreground flex items-center gap-2">
            <span>Intake Items by Product</span>
            <Badge variant="info" class="font-mono text-xs">
              {{ restockStore.groupedProducts.length }} Products / {{ restockStore.totals.lineCount }} Variants
            </Badge>
          </h2>
          <p class="text-xs text-muted-foreground mt-0.5">
            Review incoming quantities, unit costs, and before/after stock projections.
          </p>
        </div>
      </div>

      <EmptyState
        v-if="restockStore.items.length === 0"
        :icon="ArrowDownToLine"
        title="No items staged for restock"
        description="Scan barcodes, browse the product catalog, or link a purchase order to begin receiving inventory."
      >
        <template #action>
          <div class="flex items-center gap-2 mt-2">
            <Button variant="primary" size="sm" class="gap-1.5 text-xs cursor-pointer" @click="openCatalogPicker">
              <Search :size="14" />
              <span>Browse Catalog</span>
            </Button>
            <Button variant="outline" size="sm" class="gap-1.5 text-xs cursor-pointer" @click="showPoModal = true">
              <FileText :size="14" />
              <span>Link Purchase Order</span>
            </Button>
          </div>
        </template>
      </EmptyState>

      <!-- Grouped Product Cards (Hierarchical) -->
      <div v-else class="space-y-4">
        <div
          v-for="group in restockStore.groupedProducts"
          :key="group.groupKey"
          class="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
        >
          <!-- Parent Product Header Banner -->
          <div class="p-3.5 bg-surface-subtle/80 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary font-bold shadow-2xs overflow-hidden">
                <img v-if="group.thumbnailUrl" :src="group.thumbnailUrl" :alt="group.parentName" class="w-full h-full object-cover" />
                <Package v-else :size="16" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-foreground font-display">{{ group.parentName }}</h3>
                <span class="text-[11px] text-muted-foreground font-mono">
                  {{ group.items.length }} variant{{ group.items.length > 1 ? 's' : '' }} receiving
                </span>
              </div>
            </div>

            <!-- Group Summary Badges -->
            <div class="flex items-center gap-3 text-xs">
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-foreground font-mono font-semibold">
                <span class="text-muted-foreground text-[10px] uppercase font-sans">Group Qty:</span>
                <span>{{ group.totalQty }} units</span>
              </div>
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono font-bold">
                <span class="text-[10px] uppercase font-sans">Subtotal:</span>
                <span>{{ fmtMoney(group.totalCost) }}</span>
              </div>
            </div>
          </div>

          <!-- Variants Table inside Group -->
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/20 text-[11px]">
                  <TableHead>Variant / SKU</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead class="text-center w-36">Stock Projection</TableHead>
                  <TableHead class="w-48 text-center">Intake Quantity</TableHead>
                  <TableHead class="w-32 text-right">Unit Cost ($)</TableHead>
                  <TableHead class="w-28 text-right font-mono">Line Total</TableHead>
                  <TableHead class="w-10 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="item in group.items"
                  :key="item.tempId"
                  class="hover:bg-surface-subtle/50 transition-colors"
                >
                  <!-- SKU & Variant Title -->
                  <TableCell>
                    <div class="text-xs font-semibold text-foreground">{{ item.product_name }}</div>
                    <span class="font-mono text-[11px] text-primary">{{ item.sku }}</span>
                  </TableCell>

                  <!-- Barcode -->
                  <TableCell class="font-mono text-xs">
                    <span v-if="item.scanned_barcode" class="px-2 py-0.5 rounded bg-surface-subtle border border-border text-foreground text-[11px]">
                      {{ item.scanned_barcode }}
                    </span>
                    <span v-else class="text-muted-foreground text-xs">—</span>
                  </TableCell>

                  <!-- Stock Projection: Current -> Projected (+Qty) -->
                  <TableCell class="text-center">
                    <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface border border-border text-xs font-mono">
                      <span class="text-muted-foreground">{{ item.current_stock ?? 0 }}</span>
                      <span class="text-muted-foreground">→</span>
                      <span class="font-bold text-success">{{ (item.current_stock ?? 0) + item.quantity }}</span>
                      <span class="text-[10px] text-primary font-bold">(+{{ item.quantity }})</span>
                    </div>
                  </TableCell>

                  <!-- Intake Quantity with Stepper Helpers -->
                  <TableCell>
                    <div class="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Minus 1"
                        @click="restockStore.quickAdjustQty(item.tempId, -1)"
                      >
                        <Minus :size="12" />
                      </Button>

                      <Input
                        :id="`qty-input-${item.tempId}`"
                        type="number"
                        min="1"
                        :model-value="item.quantity"
                        class="h-7 w-16 bg-surface text-xs font-mono font-bold text-center"
                        @change="restockStore.updateItemQty(item.tempId, parseInt(($event.target as HTMLInputElement).value) || 1)"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Plus 1"
                        @click="restockStore.quickAdjustQty(item.tempId, 1)"
                      >
                        <Plus :size="12" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-7 px-1.5 text-[10px] font-mono text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                        title="Add 5"
                        @click="restockStore.quickAdjustQty(item.tempId, 5)"
                      >
                        +5
                      </Button>
                    </div>
                  </TableCell>

                  <!-- Unit Cost -->
                  <TableCell class="text-right">
                    <Input
                      :id="`cost-input-${item.tempId}`"
                      type="number"
                      step="0.01"
                      min="0"
                      :model-value="item.unit_cost"
                      class="h-7 w-24 bg-surface text-xs font-mono text-right ml-auto"
                      @change="restockStore.updateItemCost(item.tempId, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                    />
                  </TableCell>

                  <!-- Line Total -->
                  <TableCell class="font-mono text-xs font-bold text-foreground text-right tabular-nums">
                    {{ fmtMoney(item.quantity * item.unit_cost) }}
                  </TableCell>

                  <!-- Delete -->
                  <TableCell class="text-right">
                    <Button
                      :id="`btn-remove-item-${item.tempId}`"
                      variant="ghost"
                      size="sm"
                      class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      @click="restockStore.removeItem(item.tempId)"
                    >
                      <Trash2 :size="13" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <!-- Totals & Commit Action Bar -->
      <div
        v-if="restockStore.items.length > 0"
        class="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-6"
      >
        <div class="flex items-center gap-6 text-xs flex-wrap">
          <div>
            <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Total Intake Units</span>
            <span class="font-display font-bold text-lg text-foreground tabular-nums">{{ restockStore.totals.totalUnits }} units</span>
          </div>

          <div>
            <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Batch Cost Investment</span>
            <span class="font-display font-bold text-lg text-primary tabular-nums">{{ fmtMoney(restockStore.totals.totalCost) }}</span>
          </div>

          <div>
            <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Est. Retail Value</span>
            <span class="font-display font-bold text-lg text-success tabular-nums">{{ fmtMoney(restockStore.totals.totalRetailValue) }}</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive hover:bg-destructive/10 text-xs cursor-pointer"
            @click="promptDiscardDraft"
          >
            Discard
          </Button>

          <Button
            id="btn-complete-restock"
            variant="primary"
            class="h-10 px-6 gap-2 text-xs font-semibold shadow-sm cursor-pointer"
            :disabled="restockStore.submitting"
            @click="handleCompleteSession"
          >
            <span v-if="restockStore.submitting" class="animate-spin mr-1">⏳</span>
            <Check v-else :size="16" />
            <span>{{ restockStore.submitting ? 'Committing Ledger…' : 'Commit Restock Batch' }}</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Catalog Product Browser Modal -->
    <Dialog :open="showCatalogModal" @update:open="(val) => showCatalogModal = val">
      <DialogContent class="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <Search :size="16" class="text-primary" />
            <span>Browse Product Catalog for Stock Intake</span>
          </DialogTitle>
          <DialogDescription>
            Search by product name, SKU, or category to select variants for the restock session.
          </DialogDescription>
        </DialogHeader>

        <!-- Search input -->
        <div class="py-2">
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="catalogSearch"
              placeholder="Search products by name, SKU, or category…"
              class="pl-9 h-9 bg-surface text-sm"
              autofocus
            />
          </div>
        </div>

        <!-- Products List with Variants -->
        <div class="flex-1 overflow-y-auto space-y-3 pr-1 py-1 min-h-[300px]">
          <div v-if="catalogLoading" class="p-8 text-center text-xs text-muted-foreground animate-pulse">
            Loading product catalog…
          </div>

          <div v-else-if="filteredCatalogProducts.length === 0" class="p-8 text-center text-xs text-muted-foreground">
            No products found matching "{{ catalogSearch }}".
          </div>

          <div
            v-for="prod in filteredCatalogProducts"
            :key="prod.id"
            class="p-3 rounded-lg border border-border bg-surface-subtle/40 space-y-2"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-md bg-surface border border-border flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                  <img v-if="prod.thumbnail || prod.image_url" :src="prod.thumbnail || prod.image_url" :alt="prod.name" class="w-full h-full object-cover" />
                  <Package v-else :size="14" />
                </div>
                <div>
                  <h4 class="text-xs font-bold text-foreground">{{ prod.name }}</h4>
                  <span class="text-[10px] text-muted-foreground font-mono">{{ prod.sku || 'No SKU' }}</span>
                </div>
              </div>

              <Badge v-if="prod.category?.name" variant="neutral" class="text-[10px]">
                {{ prod.category.name }}
              </Badge>
            </div>

            <!-- Variant Pills / Checkboxes -->
            <div class="flex flex-wrap gap-2 pt-1 border-t border-border/50">
              <button
                v-for="v in (prod.variants && prod.variants.length > 0 ? prod.variants : [{ id: prod.id, sku: prod.sku, name: 'Single Item', cost_price: prod.purchase_price, selling_price: prod.selling_price, quantity_on_hand: prod.quantity_on_hand }])"
                :key="v.id"
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-2 border transition-all cursor-pointer shadow-2xs',
                  selectedCatalogVariants[v.id]
                    ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/30'
                    : 'border-border bg-surface text-foreground hover:bg-surface-subtle'
                ]"
                @click="toggleCatalogVariant(prod, v)"
              >
                <span class="w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px]" :class="selectedCatalogVariants[v.id] ? 'bg-primary text-white border-primary' : 'border-muted-foreground/40'">
                  <Check v-if="selectedCatalogVariants[v.id]" :size="10" />
                </span>
                <span>{{ v.sku || v.name }}</span>
                <span class="text-[10px] text-muted-foreground font-sans">Stock: {{ v.quantity_on_hand ?? 0 }}</span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4 border-t border-border pt-3">
          <div class="flex-1 text-xs text-muted-foreground flex items-center">
            <span v-if="Object.keys(selectedCatalogVariants).length > 0">
              {{ Object.keys(selectedCatalogVariants).length }} variant(s) selected
            </span>
          </div>
          <Button variant="outline" @click="showCatalogModal = false">Cancel</Button>
          <Button
            variant="primary"
            :disabled="Object.keys(selectedCatalogVariants).length === 0"
            @click="commitCatalogSelection"
          >
            + Add Selected ({{ Object.keys(selectedCatalogVariants).length }})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Purchase Order Linking Modal -->
    <Dialog :open="showPoModal" @update:open="(val) => showPoModal = val">
      <DialogContent class="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <FileText :size="16" class="text-primary" />
            <span>Link Purchase Order to Stock Intake</span>
          </DialogTitle>
          <DialogDescription>
            Select a pending purchase order to automatically stage ordered items, quantities, and supplier details.
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-3 py-2">
          <div v-if="loadingPos" class="p-8 text-center text-xs text-muted-foreground animate-pulse">
            Loading purchase orders…
          </div>

          <EmptyState
            v-else-if="pendingPurchaseOrders.length === 0"
            :icon="FileText"
            title="No open purchase orders found"
            description="Create a purchase order in Purchase Orders view to track expected vendor shipments."
          />

          <div
            v-for="po in pendingPurchaseOrders"
            :key="po.id"
            class="p-3.5 rounded-xl border border-border bg-surface-subtle/50 hover:border-primary/50 transition-all flex items-center justify-between gap-4"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-sm text-primary">{{ po.po_number || po.poNumber }}</span>
                <Badge variant="warning" class="text-[10px] font-mono">
                  {{ po.status || 'ORDERED' }}
                </Badge>
              </div>
              <div class="text-xs text-foreground font-semibold flex items-center gap-2">
                <Truck :size="13" class="text-muted-foreground" />
                <span>{{ po.supplier_name || po.supplierName || 'Unknown Supplier' }}</span>
              </div>
              <div class="text-[11px] text-muted-foreground font-mono">
                {{ (po.items || []).length }} line items • Total: {{ fmtMoney(po.total_amount || 0) }}
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              class="h-8 px-3 text-xs gap-1.5 cursor-pointer shrink-0"
              @click="handleLinkPO(po)"
            >
              <LinkIcon :size="12" />
              <span>Link & Stage Items</span>
            </Button>
          </div>
        </div>

        <DialogFooter class="border-t border-border pt-3">
          <Button variant="outline" @click="showPoModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Multi-Variant Barcode Modal -->
    <Dialog :open="showVariantPicker" @update:open="(val) => { if (!val) closeVariantPicker() }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">Select Variant to Restock</DialogTitle>
          <DialogDescription>
            The barcode "{{ barcodeInput }}" matched product "{{ multiVariantProduct?.product?.name }}". Select which variant was received.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-2 py-2">
          <button
            v-for="v in multiVariantProduct?.variants"
            :key="v.id"
            type="button"
            class="w-full text-left p-3 rounded-lg border border-border hover:border-cta hover:bg-cta/5 transition-all flex items-center justify-between"
            @click="selectVariantFromModal(v)"
          >
            <div>
              <div class="font-mono text-xs font-bold text-foreground">{{ v.sku }}</div>
              <div class="text-xs text-muted-foreground font-mono">Stock on hand: {{ v.quantity_on_hand }}</div>
            </div>
            <div class="text-right font-mono text-xs font-bold text-cta">
              {{ fmtMoney(parseFloat(String(v.cost_price)) || 0) }}
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="closeVariantPicker">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Discard Confirmation Dialog -->
    <Dialog :open="discardConfirm" @update:open="(val) => discardConfirm = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Discard Intake Batch?</DialogTitle>
          <DialogDescription>
            Are you sure you want to discard this draft restock session? All staged line items and entered quantities will be cleared.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="discardConfirm = false">Keep Editing</Button>
          <Button variant="destructive" @click="executeDiscardDraft">Discard Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
