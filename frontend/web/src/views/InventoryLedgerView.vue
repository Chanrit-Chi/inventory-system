<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import api from '@/api/axios'
import {
  Package,
  Search,
  RefreshCw,
  ArrowDownToLine,
  AlertTriangle,
  XCircle,
  DollarSign,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  Info,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  StatCard,
  Alert,
  EmptyState,
  Skeleton,
  SelectField,
  LoadMoreTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal.vue'

interface Product {
  id: string
  name: string
  image_url?: string | null
  cost_price?: number | string
  purchase_price?: number | string
  default_reorder_level?: number
  is_active?: boolean
  category?: { name: string }
  variants: Variant[]
}

interface Variant {
  id: string
  sku: string
  barcode: string | null
  quantity_on_hand: number
  reorder_level: number
  cost_price: number | string
  selling_price: number | string
  is_active: boolean
  product?: {
    id: string
    name: string
    is_active?: boolean
    cost_price?: number | string
    category?: { name: string }
  }
}

interface PaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

const products = ref<Product[]>([])
const meta = ref<PaginationMeta | null>(null)
const page = ref(1)
const search = ref('')
const stockFilter = ref<string>('all')

const stockFilterOptions = [
  { label: 'All Stock Statuses', value: 'all' },
  { label: 'In Stock Only', value: 'in' },
  { label: 'Low Stock Warning Only', value: 'low' },
  { label: 'Out of Stock Only', value: 'out' },
]

const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const showAuditLegend = ref(false)

// Track which product groups are expanded (by product id)
const expandedGroups = ref<Set<string>>(new Set())

// Flatten helper for stats
const allVariants = computed<Variant[]>(() =>
  products.value.flatMap(p =>
    (p.variants ?? []).map(v => ({
      ...v,
      product: { id: p.id, name: p.name, is_active: p.is_active, cost_price: p.cost_price ?? p.purchase_price, category: p.category },
    }))
  )
)

interface InventoryReportSummary {
  total_skus: number
  total_products: number
  total_units: number
  cost_value: number
  low_stock_count: number
  out_of_stock_count: number
}

const summaryStats = ref<InventoryReportSummary | null>(null)

async function loadSummaryStats() {
  try {
    const res = await api.get('/reports/inventory')
    const d = res.data?.data || res.data
    if (d) {
      summaryStats.value = {
        total_skus: Number(d.total_skus) || 0,
        total_products: Number(d.total_products) || 0,
        total_units: Number(d.total_units) || 0,
        cost_value: Number(d.cost_value) || 0,
        low_stock_count: Number(d.low_stock_count) || 0,
        out_of_stock_count: Number(d.out_of_stock_count) || 0,
      }
    }
  } catch {
    // Graceful fallback to client-side loaded data
  }
}

// Summary stats: server-wide accurate analytics with loaded data fallback
const totalSkus = computed(() => summaryStats.value?.total_skus ?? allVariants.value.length)
const totalProductsCount = computed(() => summaryStats.value?.total_products ?? (meta.value?.total ?? products.value.length))
const lowStockCount = computed(() => summaryStats.value?.low_stock_count ??
  products.value.filter(p => p.is_active !== false && (p.variants ?? []).reduce((s, v) => s + (v.quantity_on_hand || 0), 0) <= (p.default_reorder_level || 5)).length
)
const outOfStockCount = computed(() => summaryStats.value?.out_of_stock_count ??
  products.value.filter(p => p.is_active !== false && (p.variants ?? []).reduce((s, v) => s + (v.quantity_on_hand || 0), 0) === 0).length
)
const totalInventoryUnits = computed(() => summaryStats.value?.total_units ??
  allVariants.value.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
)
const estimatedStockCost = computed(() => summaryStats.value?.cost_value ??
  allVariants.value.reduce(
    (sum, v) => sum + (v.quantity_on_hand || 0) * (parseFloat(String(v.cost_price)) || parseFloat(String(v.product?.cost_price || 0)) || 0),
    0
  )
)

// Filter products by stock status; group survives even if a child variant is filtered out,
// as long as at least one child matches the active filter.
const filteredProducts = computed<Product[]>(() => {
  if (stockFilter.value === 'all') return products.value
  return products.value
    .map(p => {
      const variants = (p.variants ?? []).filter(v => {
        if (stockFilter.value === 'low')
          return v.quantity_on_hand > 0 && v.quantity_on_hand <= v.reorder_level
        if (stockFilter.value === 'out') return v.quantity_on_hand === 0
        if (stockFilter.value === 'in') return v.quantity_on_hand > v.reorder_level
        return true
      })
      return { ...p, variants }
    })
    .filter(p => p.variants.length > 0)
})

// Per-group rollups for the product header row
function productStats(p: Product) {
  const variants = p.variants ?? []
  const units = variants.reduce((s, v) => s + (v.quantity_on_hand || 0), 0)
  const cost = variants.reduce(
    (s, v) => s + (v.quantity_on_hand || 0) * (parseFloat(String(v.cost_price)) || 0),
    0
  )
  const low = variants.filter(v => v.quantity_on_hand > 0 && v.quantity_on_hand <= v.reorder_level).length
  const out = variants.filter(v => v.quantity_on_hand === 0).length
  const worstStatus: 'out' | 'low' | 'ok' = out
    ? 'out'
    : low
      ? 'low'
      : 'ok'
  return { units, cost, low, out, worstStatus, variantCount: variants.length }
}

function isExpanded(productId: string) {
  return expandedGroups.value.has(productId)
}

function toggleGroup(productId: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(productId)) next.delete(productId)
  else next.add(productId)
  expandedGroups.value = next
}

function expandAll() {
  expandedGroups.value = new Set(filteredProducts.value.map(p => p.id))
}

function collapseAll() {
  expandedGroups.value = new Set()
}

// Quick Stock Adjustment Modal State
const showAdjustmentModal = ref(false)
const selectedAdjustmentVariant = ref<Variant | null>(null)
const selectedProductName = ref('')

function openAdjustmentModal(v: Variant, prodName: string) {
  selectedAdjustmentVariant.value = v
  selectedProductName.value = prodName
  showAdjustmentModal.value = true
}

async function loadInventory(append = false) {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }
  error.value = null
  try {
    const params: Record<string, unknown> = { page: page.value }
    if (search.value.trim()) {
      params.search = search.value.trim()
    }

    const res = await api.get('/products', { params })
    const incoming = (res.data.data ?? []) as Product[]
    if (append) {
      const existingIds = new Set(products.value.map(p => p.id))
      products.value = [...products.value, ...incoming.filter(p => !existingIds.has(p.id))]
    } else {
      products.value = incoming
    }
    meta.value = res.data.meta ?? null
    // Auto-expand if list is small or single product
    if (incoming.length <= 5) {
      incoming.forEach(p => expandedGroups.value.add(p.id))
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load inventory ledger.'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function handleLoadMore() {
  if (loadingMore.value || loading.value) return
  if (meta.value && page.value < meta.value.last_page) {
    page.value++
    loadInventory(true)
  }
}

function onRefresh() {
  page.value = 1
  loadInventory(false)
  loadSummaryStats()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadInventory(false)
  }, 300)
}

function onFilterChange() {
  page.value = 1
  // Filtering is client-side via filteredProducts computed; no API reload needed
}

function toggleAllExpanded() {
  if (filteredProducts.value.every(p => isExpanded(p.id))) {
    collapseAll()
  } else {
    expandAll()
  }
}

function stockBadge(v: Variant) {
  if (v.quantity_on_hand === 0) return 'destructive' as const
  if (v.quantity_on_hand <= v.reorder_level) return 'warning' as const
  return 'success' as const
}

function stockLabel(v: Variant) {
  if (v.quantity_on_hand === 0) return 'Out of Stock'
  if (v.quantity_on_hand <= v.reorder_level) return 'Low Stock'
  return 'In Stock'
}

function isRowLowStock(v: Variant) {
  return v.quantity_on_hand <= v.reorder_level
}

function fmtMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

onMounted(() => {
  loadInventory()
  loadSummaryStats()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header & Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Inventory Ledger</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalSkus }} Tracked SKUs
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Real-time SKU stock levels, reorder thresholds, inventory valuation, and batch replenishment.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" @click="showAuditLegend = true">
          <Info :size="14" />
          <span>Audit Reference</span>
        </Button>
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="loading" @click="onRefresh">
          <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />
          <span>Refresh</span>
        </Button>
        <RouterLink to="/restock">
          <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5">
            <ArrowDownToLine :size="15" />
            <span>Restock Intake</span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- KPI Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Tracked SKUs"
        :value="totalSkus"
        :sub="`${totalInventoryUnits.toLocaleString()} units · ${totalProductsCount} products`"
        :icon="Package"
        icon-variant="primary"
      />
      <StatCard
        label="Reorder Needed"
        :value="lowStockCount"
        sub="At or below reorder level"
        :icon="AlertTriangle"
        icon-variant="warning"
      />
      <StatCard
        label="Depleted Stock"
        :value="outOfStockCount"
        sub="0 units available for sale"
        :icon="XCircle"
        icon-variant="error"
      />
      <StatCard
        label="Inventory Cost Value"
        :value="fmtMoney(estimatedStockCost)"
        sub="Estimated wholesale cost"
        :icon="DollarSign"
        icon-variant="success"
      />
    </div>

    <!-- Filter Bar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          id="inventory-search"
          v-model="search"
          type="text"
          placeholder="Search by product name, SKU, or barcode…"
          class="bg-surface"
          @input="onSearchInput"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          class="h-8 px-2 text-xs gap-1"
          @click="toggleAllExpanded"
        >
          <template v-if="filteredProducts.every(p => isExpanded(p.id))">Collapse All</template>
          <template v-else>Expand All</template>
        </Button>
        <SelectField
          id="inventory-stock-filter"
          v-model="stockFilter"
          :options="stockFilterOptions"
          placeholder="All Stock Statuses"
          class="h-9 w-48 bg-surface text-xs"
          @change="onFilterChange"
        />
      </div>
    </div>

    <!-- Error Alert -->
    <Alert v-if="error" variant="error" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" />
        <span>{{ error }}</span>
      </div>
      <Button variant="ghost" size="sm" class="text-xs h-7" @click="onRefresh">Retry</Button>
    </Alert>

    <!-- Inventory Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="loading && products.length === 0" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="allVariants.length === 0"
        :icon="Package"
        title="No inventory items found"
        description="No product variants match your search and filter criteria."
      >
        <template #action>
          <RouterLink to="/restock">
            <Button variant="primary" size="sm" class="gap-1.5">
              <ArrowDownToLine :size="15" />
              <span>Start a Restock Intake</span>
            </Button>
          </RouterLink>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs text-left">
          <thead class="bg-surface-subtle text-muted-foreground text-xs font-bold border-b border-border">
            <tr>
              <th class="px-3 py-2.5">Product / Variation</th>
              <th class="px-2.5 py-2.5 whitespace-nowrap w-28 sm:w-32">Variant SKU</th>
              <th class="px-2.5 py-2.5 whitespace-nowrap w-24 sm:w-28 hidden md:table-cell">Barcode</th>
              <th class="px-2.5 py-2.5 text-right font-mono whitespace-nowrap w-24 sm:w-28">Stock on Hand</th>
              <th class="px-2.5 py-2.5 text-right font-mono whitespace-nowrap w-20 sm:w-24 hidden sm:table-cell">Reorder At</th>
              <th class="px-2.5 py-2.5 text-center whitespace-nowrap w-24 sm:w-28">Stock Status</th>
              <th class="px-2.5 py-2.5 text-right whitespace-nowrap w-28 sm:w-36">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/70">
            <template v-for="product in filteredProducts" :key="product.id">
              <!-- Master Product Group Header Row (Single-line layout) -->
              <tr
                class="transition-colors cursor-pointer group"
                :class="isExpanded(product.id) ? 'bg-surface-subtle/80 border-b border-border' : 'hover:bg-surface-subtle/50'"
                @click="toggleGroup(product.id)"
              >
                <!-- Product, Category, Variant Count & Expand in ONE horizontal line -->
                <td class="px-3 py-2.5 min-w-0">
                  <div class="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                    <div class="w-5.5 h-5.5 rounded-md bg-card border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-cta transition-all shrink-0 shadow-2xs">
                      <ChevronDown
                        class="w-3.5 h-3.5 transition-transform duration-200"
                        :class="{ 'rotate-180 text-primary': isExpanded(product.id) }"
                      />
                    </div>
                    <!-- Product Photo Thumbnail -->
                    <div class="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                      <img
                        v-if="product.image_url"
                        :src="product.image_url"
                        :alt="product.name"
                        class="w-full h-full object-cover"
                        @error="($event.target as HTMLElement).style.display='none'"
                      />
                      <Package v-else :size="15" class="text-muted-foreground/50" />
                    </div>
                    <span class="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                      {{ product.name }}
                    </span>
                    <Badge
                      v-if="product.category"
                      variant="primary"
                      class="text-[11px] px-1.5 py-0.5 rounded-md shrink-0"
                    >
                      {{ product.category.name }}
                    </Badge>
                    <span class="text-[11px] text-muted-foreground font-medium shrink-0">
                      ({{ product.variants.length }} var{{ product.variants.length === 1 ? '' : 's' }} · {{ isExpanded(product.id) ? 'Hide' : 'Show' }})
                    </span>
                  </div>
                </td>

                <!-- SKU Col (Summary indicator) -->
                <td class="px-2.5 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
                  <span class="px-1.5 py-0.5 rounded-md bg-card border border-border text-[11px]">
                    {{ product.variants.length }} SKUs
                  </span>
                </td>

                <!-- Barcode Col (Summary indicator) -->
                <td class="px-2.5 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap hidden md:table-cell">
                  —
                </td>

                <!-- Group Total Units -->
                <td class="px-2.5 py-2.5 text-right font-mono text-xs font-bold text-foreground whitespace-nowrap">
                  <span class="px-2 py-0.5 rounded-md bg-card border border-border shadow-2xs">
                    {{ productStats(product).units }} units
                  </span>
                </td>

                <!-- Group Reorder Alert -->
                <td class="px-2.5 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                  <span v-if="productStats(product).low + productStats(product).out > 0" class="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                    {{ productStats(product).low + productStats(product).out }} need restock
                  </span>
                  <span v-else class="text-muted-foreground text-[11px]">
                    Healthy
                  </span>
                </td>

                <!-- Worst Status Badge -->
                <td class="px-2.5 py-2.5 text-center whitespace-nowrap">
                  <Badge v-if="productStats(product).worstStatus === 'out'" variant="destructive" class="text-[11px] px-2 py-0.5 font-semibold">
                    Out of Stock
                  </Badge>
                  <Badge v-else-if="productStats(product).worstStatus === 'low'" variant="warning" class="text-[11px] px-2 py-0.5 font-semibold">
                    Low Stock
                  </Badge>
                  <Badge v-else variant="success" class="text-[11px] px-2 py-0.5 font-semibold">
                    In Stock
                  </Badge>
                </td>

                <!-- Group Action -->
                <td class="px-2.5 py-2.5 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1" @click.stop>
                    <RouterLink
                      v-if="productStats(product).low > 0 || productStats(product).out > 0"
                      to="/restock"
                      class="inline-flex"
                    >
                      <Button
                        size="sm"
                        class="h-7 px-2 text-xs font-semibold bg-cta text-cta-foreground hover:bg-cta-hover shadow-2xs gap-1 cursor-pointer"
                      >
                        <ArrowDownToLine class="w-3.5 h-3.5" />
                        <span>Restock</span>
                      </Button>
                    </RouterLink>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 px-2 text-xs font-semibold border-border text-muted-foreground hover:text-foreground hover:bg-surface-subtle cursor-pointer"
                      @click="toggleGroup(product.id)"
                    >
                      <span>{{ isExpanded(product.id) ? 'Hide' : 'Show' }}</span>
                    </Button>
                  </div>
                </td>
              </tr>

              <!-- Expanded Nested Child Variant Rows -->
              <template v-if="isExpanded(product.id)">
                <tr
                  v-for="(variant, vIdx) in product.variants"
                  :key="variant.id"
                  class="bg-surface-subtle/30 hover:bg-cta-muted/40 transition-colors"
                  :class="{ 'bg-amber-500/10': isRowLowStock(variant) }"
                >
                  <!-- Tree branch guide & Variant Name/Option -->
                  <td class="px-3 py-2 pl-6 sm:pl-8 min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="text-muted-foreground font-mono text-xs select-none shrink-0">
                        {{ vIdx === product.variants.length - 1 ? '└──' : '├──' }}
                      </span>
                      <span class="font-bold text-xs text-foreground truncate">
                        {{ variant.sku || `Variant #${vIdx + 1}` }}
                      </span>
                    </div>
                  </td>

                  <!-- Variant SKU -->
                  <td class="px-2.5 py-2 font-mono text-xs whitespace-nowrap">
                    <span class="px-1.5 py-0.5 rounded-md bg-card border border-border text-foreground text-[11px]">
                      {{ variant.sku }}
                    </span>
                  </td>

                  <!-- Barcode -->
                  <td class="px-2.5 py-2 font-mono text-xs whitespace-nowrap hidden md:table-cell">
                    <span v-if="variant.barcode" class="px-1.5 py-0.5 rounded-md bg-card border border-border text-foreground text-[11px]">
                      {{ variant.barcode }}
                    </span>
                    <span v-else class="text-muted-foreground">—</span>
                  </td>

                  <!-- Quantity on Hand -->
                  <td class="px-2.5 py-2 text-right font-mono text-xs font-bold text-foreground whitespace-nowrap">
                    {{ variant.quantity_on_hand }} units
                  </td>

                  <!-- Reorder Level -->
                  <td class="px-2.5 py-2 text-right font-mono text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    {{ variant.reorder_level }} units
                  </td>

                  <!-- Variant Stock Status Badge -->
                  <td class="px-2.5 py-2 text-center whitespace-nowrap">
                    <Badge :variant="stockBadge(variant)" class="text-[11px] px-2 py-0.5 font-semibold">
                      {{ stockLabel(variant) }}
                    </Badge>
                  </td>

                  <!-- Actions -->
                  <td class="px-2.5 py-2 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-1.5 sm:px-2 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground hover:bg-surface-subtle"
                        @click.stop="openAdjustmentModal(variant, product.name)"
                      >
                        <SlidersHorizontal class="w-3 h-3" />
                        <span>Adjust</span>
                      </Button>
                      <RouterLink
                        v-if="variant.quantity_on_hand <= variant.reorder_level"
                        to="/restock"
                        class="inline-flex"
                      >
                        <Button
                          size="sm"
                          class="h-7 px-1.5 sm:px-2 text-xs font-semibold bg-cta text-cta-foreground hover:bg-cta-hover gap-1 shadow-2xs cursor-pointer"
                        >
                          <ArrowDownToLine class="w-3 h-3" />
                          <span>Restock</span>
                        </Button>
                      </RouterLink>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Infinite Scroll & Load More Trigger -->
      <LoadMoreTrigger
        :loading="loadingMore"
        :has-more="Boolean(meta && page < meta.last_page)"
        :total-loaded="products.length"
        :total="meta?.total ?? null"
        :error="error"
        @load-more="handleLoadMore"
        @retry="loadInventory(page > 1)"
      />
    </div>

    <!-- Movement Audit Trail Reference Dialog -->
    <Dialog :open="showAuditLegend" @update:open="(val) => showAuditLegend = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <div class="flex items-center justify-between">
            <DialogTitle class="font-display font-bold text-base text-foreground">
              Stock Movement Audit Reference
            </DialogTitle>
            <Badge variant="success" class="text-xs">ACID Ledger</Badge>
          </div>
          <DialogDescription>
            All stock mutations in OmniPOS are atomic and strictly recorded in the stock movements ledger with quantity snapshots.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2.5 py-2">
          <div class="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-subtle">
            <Badge variant="success" class="text-xs font-semibold">RESTOCK</Badge>
            <span class="text-xs text-muted-foreground">Supplier intake replenishment</span>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-subtle">
            <Badge variant="destructive" class="text-xs font-semibold">SALE</Badge>
            <span class="text-xs text-muted-foreground">POS checkout / sales channels</span>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-subtle">
            <Badge variant="warning" class="text-xs font-semibold">ADJUSTMENT</Badge>
            <span class="text-xs text-muted-foreground">Manual stock count / audit fix</span>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-subtle">
            <Badge variant="info" class="text-xs font-semibold">RETURN</Badge>
            <span class="text-xs text-muted-foreground">Customer returns back to stock</span>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-subtle">
            <Badge variant="neutral" class="text-xs font-semibold">DAMAGE</Badge>
            <span class="text-xs text-muted-foreground">Loss / breakage / defective write-off</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" class="w-full text-xs" @click="showAuditLegend = false">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Quick Stock Adjustment Modal -->
    <StockAdjustmentModal
      v-model:open="showAdjustmentModal"
      :variant="selectedAdjustmentVariant"
      :product-name="selectedProductName"
      @success="() => onRefresh()"
    />
  </div>
</template>
