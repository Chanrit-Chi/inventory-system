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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  StatCard,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

interface Product {
  id: string
  name: string
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
const loading = ref(false)
const error = ref<string | null>(null)

// Track which product groups are expanded (by product id)
const expandedGroups = ref<Set<string>>(new Set())

// Flatten helper for stats
const allVariants = computed<Variant[]>(() =>
  products.value.flatMap(p =>
    (p.variants ?? []).map(v => ({
      ...v,
      product: { id: p.id, name: p.name, category: p.category },
    }))
  )
)

// Summary stats across loaded variants
const totalSkus = computed(() => meta.value?.total ?? allVariants.value.length)
const lowStockCount = computed(() =>
  allVariants.value.filter(v => v.quantity_on_hand > 0 && v.quantity_on_hand <= v.reorder_level).length
)
const outOfStockCount = computed(() =>
  allVariants.value.filter(v => v.quantity_on_hand === 0).length
)
const totalInventoryUnits = computed(() =>
  allVariants.value.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
)
const estimatedStockCost = computed(() =>
  allVariants.value.reduce(
    (sum, v) => sum + (v.quantity_on_hand || 0) * (parseFloat(String(v.cost_price)) || 0),
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

async function loadInventory() {
  loading.value = true
  error.value = null
  try {
    const params: Record<string, unknown> = { page: page.value }
    if (search.value.trim()) {
      params.search = search.value.trim()
    }

    const res = await api.get('/products', { params })
    products.value = (res.data.data ?? []) as Product[]
    meta.value = res.data.meta ?? null
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load inventory ledger.'
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadInventory()
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

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="loading" @click="loadInventory">
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
        :sub="`${totalInventoryUnits} total units on hand`"
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

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-8 px-2 text-xs gap-1"
          @click="toggleAllExpanded"
        >
          <template v-if="filteredProducts.every(p => isExpanded(p.id))">Collapse All</template>
          <template v-else>Expand All</template>
        </Button>
        <select
          id="inventory-stock-filter"
          v-model="stockFilter"
          class="h-9 px-3 text-sm bg-surface border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          @change="onFilterChange"
        >
          <option value="all">All Stock Statuses</option>
          <option value="in">In Stock Only</option>
          <option value="low">Low Stock Warning Only</option>
          <option value="out">Out of Stock Only</option>
        </select>
      </div>
    </div>

    <!-- Error Alert -->
    <Alert v-if="error" variant="error" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" />
        <span>{{ error }}</span>
      </div>
      <Button variant="ghost" size="sm" class="text-xs h-7" @click="loadInventory">Retry</Button>
    </Alert>

    <!-- Inventory Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="loading" class="p-6 space-y-3">
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
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Product & Category</TableHead>
              <TableHead>Variant SKU</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead class="font-mono">Stock on Hand</TableHead>
              <TableHead class="font-mono">Reorder At</TableHead>
              <TableHead>Stock Status</TableHead>
              <TableHead class="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="product in filteredProducts" :key="product.id">
              <!-- Expanded product group: header row + variant rows -->
              <template v-if="isExpanded(product.id)">
                <TableRow class="bg-muted/20 cursor-pointer" @click="toggleGroup(product.id)">
                  <TableCell>
                    <div class="flex items-center gap-3">
                      <ChevronUp class="size-4 text-muted-foreground transition-transform duration-200" />
                      <div class="flex flex-col">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-foreground">{{ product.name }}</span>
                          <Badge v-if="product.category" variant="neutral" class="text-[10px] px-1.5 py-0">
                            {{ product.category.name }}
                          </Badge>
                        </div>
                        <div class="text-xs text-muted-foreground mt-0.5">
                          {{ product.variants.length }} variant{{ product.variants.length === 1 ? '' : 's' }}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell colspan="2" class="text-xs text-muted-foreground font-mono">
                    Group total
                  </TableCell>
                  <TableCell class="text-center font-mono text-sm font-semibold tabular-nums">
                    {{ productStats(product).units }}
                    <span class="text-xs font-normal text-muted-foreground ml-1">units</span>
                  </TableCell>
                  <TableCell class="text-center font-mono text-xs text-muted-foreground tabular-nums">
                    {{ productStats(product).low + productStats(product).out }} need restock
                  </TableCell>
                  <TableCell>
                    <Badge v-if="productStats(product).worstStatus === 'out'" variant="destructive" class="text-[10px]">
                      Out of Stock
                    </Badge>
                    <Badge v-else-if="productStats(product).worstStatus === 'low'" variant="warning" class="text-[10px]">
                      Low Stock
                    </Badge>
                    <Badge v-else variant="success" class="text-[10px]">
                      In Stock
                    </Badge>
                  </TableCell>
                  <TableCell class="text-right">
                    <Button
                      v-if="productStats(product).low > 0 || productStats(product).out > 0"
                      variant="outline"
                      size="sm"
                      class="h-7 px-2 text-xs font-semibold border-warning/40 text-warning-foreground hover:bg-warning/10"
                      to="/restock"
                    >
                      + Restock
                    </Button>
                    <span v-else class="text-xs text-muted-foreground">Healthy</span>
                  </TableCell>
                </TableRow>

                <!-- Product variants -->
                <TableRow
                  v-for="variant in product.variants"
                  :key="variant.id"
                  class="hover:bg-surface-subtle/80 transition-colors"
                  :class="{ 'bg-warning/5': isRowLowStock(variant) }"
                >
                  <TableCell class="pl-10">
                    <div class="text-sm font-mono text-foreground/80">{{ variant.sku }}</div>
                  </TableCell>

                  <TableCell class="font-mono text-xs" colspan="2">
                    <span v-if="variant.barcode" class="px-2 py-0.5 rounded bg-surface-subtle border border-border text-foreground">
                      {{ variant.barcode }}
                    </span>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>

                  <TableCell class="font-mono text-base font-bold text-foreground tabular-nums">
                    {{ variant.quantity_on_hand }}
                    <span class="text-xs font-normal text-muted-foreground ml-1">units</span>
                  </TableCell>

                  <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                    {{ variant.reorder_level }} units
                  </TableCell>

                  <TableCell>
                    <Badge :variant="stockBadge(variant)" class="text-[11px] px-2 py-0.5">
                      {{ stockLabel(variant) }}
                    </Badge>
                  </TableCell>

                  <TableCell class="text-right">
                    <RouterLink
                      v-if="variant.quantity_on_hand <= variant.reorder_level"
                      to="/restock"
                    >
                      <Button variant="outline" size="sm" class="h-7 px-2 text-xs font-semibold border-warning/40 text-warning-foreground hover:bg-warning/10">
                        + Restock
                      </Button>
                    </RouterLink>
                    <span v-else class="text-xs text-muted-foreground">Healthy</span>
                  </TableCell>
                </TableRow>
              </template>

              <!-- Collapsed product group: single summary row -->
              <TableRow v-else class="bg-muted/20 cursor-pointer hover:bg-muted/40" @click="toggleGroup(product.id)">
                <TableCell>
                  <div class="flex items-center gap-3">
                    <ChevronDown class="size-4 text-muted-foreground transition-transform duration-200" />
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-foreground">{{ product.name }}</span>
                        <Badge v-if="product.category" variant="neutral" class="text-[10px] px-1.5 py-0">
                          {{ product.category.name }}
                        </Badge>
                      </div>
                      <div class="text-xs text-muted-foreground mt-0.5">
                        {{ product.variants.length }} variant{{ product.variants.length === 1 ? '' : 's' }}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell colspan="2" class="text-xs text-muted-foreground font-mono">
                  Click to expand
                </TableCell>
                <TableCell class="text-center font-mono text-sm font-semibold tabular-nums">
                  {{ productStats(product).units }}
                  <span class="text-xs font-normal text-muted-foreground ml-1">units</span>
                </TableCell>
                <TableCell class="text-center font-mono text-xs text-muted-foreground tabular-nums">
                  {{ productStats(product).low + productStats(product).out }} need restock
                </TableCell>
                <TableCell>
                  <Badge v-if="productStats(product).worstStatus === 'out'" variant="destructive" class="text-[10px]">
                    Out of Stock
                  </Badge>
                  <Badge v-else-if="productStats(product).worstStatus === 'low'" variant="warning" class="text-[10px]">
                    Low Stock
                  </Badge>
                  <Badge v-else variant="success" class="text-[10px]">
                    In Stock
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    v-if="productStats(product).low > 0 || productStats(product).out > 0"
                    variant="outline"
                    size="sm"
                    class="h-7 px-2 text-xs font-semibold border-warning/40 text-warning-foreground hover:bg-warning/10"
                    to="/restock"
                  >
                    + Restock
                  </Button>
                  <span v-else class="text-xs text-muted-foreground">Healthy</span>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
      <div
        v-if="meta && meta.last_page > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
      >
        <span class="font-mono">
          Page {{ page }} of {{ meta.last_page }} ({{ meta.total }} total)
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page <= 1 || loading"
            @click="page--; loadInventory()"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page >= meta.last_page || loading"
            @click="page++; loadInventory()"
          >
            <span>Next</span>
            <ChevronRight :size="14" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Movement Audit Trail Legend -->
    <div class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="font-display font-bold text-sm text-foreground">Stock Movement Types & Audit Reference</h3>
        <Badge variant="success" class="text-[10px]">ACID Audit Ledger</Badge>
      </div>
      <div class="flex flex-wrap gap-2">
        <Badge variant="success" class="text-xs">RESTOCK (Supplier Intake)</Badge>
        <Badge variant="destructive" class="text-xs">SALE (POS / Checkout)</Badge>
        <Badge variant="warning" class="text-xs">ADJUSTMENT (Audit / Count)</Badge>
        <Badge variant="info" class="text-xs">RETURN (Customer Return)</Badge>
        <Badge variant="neutral" class="text-xs">DAMAGE (Loss / Defect)</Badge>
      </div>
      <p class="text-xs text-muted-foreground">
        All stock mutations in OmniPOS are atomic and strictly recorded in the stock movements ledger with quantity snapshots.
      </p>
    </div>
  </div>
</template>
