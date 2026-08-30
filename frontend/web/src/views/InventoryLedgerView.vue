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

const variants = ref<Variant[]>([])
const meta = ref<PaginationMeta | null>(null)
const page = ref(1)
const search = ref('')
const stockFilter = ref<string>('all')
const loading = ref(false)
const error = ref<string | null>(null)

// Summary stats across loaded variants
const totalSkus = computed(() => meta.value?.total ?? variants.value.length)
const lowStockCount = computed(() =>
  variants.value.filter(v => v.quantity_on_hand > 0 && v.quantity_on_hand <= v.reorder_level).length
)
const outOfStockCount = computed(() =>
  variants.value.filter(v => v.quantity_on_hand === 0).length
)
const totalInventoryUnits = computed(() =>
  variants.value.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
)
const estimatedStockCost = computed(() =>
  variants.value.reduce(
    (sum, v) => sum + (v.quantity_on_hand || 0) * (parseFloat(String(v.cost_price)) || 0),
    0
  )
)

async function loadInventory() {
  loading.value = true
  error.value = null
  try {
    const params: Record<string, unknown> = { page: page.value }
    if (search.value.trim()) {
      params.search = search.value.trim()
    }

    const res = await api.get('/products', { params })
    const products = res.data.data as Array<{
      id: string
      name: string
      category?: { name: string }
      variants: Variant[]
    }>

    let flat: Variant[] = []
    for (const p of products) {
      if (p.variants && Array.isArray(p.variants)) {
        for (const v of p.variants) {
          flat.push({
            ...v,
            product: {
              id: p.id,
              name: p.name,
              category: p.category,
            },
          })
        }
      }
    }

    if (stockFilter.value === 'low') {
      flat = flat.filter(v => v.quantity_on_hand > 0 && v.quantity_on_hand <= v.reorder_level)
    } else if (stockFilter.value === 'out') {
      flat = flat.filter(v => v.quantity_on_hand === 0)
    } else if (stockFilter.value === 'in') {
      flat = flat.filter(v => v.quantity_on_hand > v.reorder_level)
    }

    variants.value = flat
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
  loadInventory()
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
        v-else-if="variants.length === 0"
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
            <TableRow
              v-for="v in variants"
              :key="v.id"
              class="hover:bg-surface-subtle/80 transition-colors"
              :class="{ 'bg-warning/5': isRowLowStock(v) }"
            >
              <TableCell>
                <div class="font-semibold text-foreground">{{ v.product?.name ?? '—' }}</div>
                <div v-if="v.product?.category" class="mt-0.5">
                  <Badge variant="neutral" class="text-[10px] px-1.5 py-0">
                    {{ v.product.category.name }}
                  </Badge>
                </div>
              </TableCell>

              <TableCell class="font-mono text-xs font-semibold text-primary">
                {{ v.sku }}
              </TableCell>

              <TableCell class="font-mono text-xs">
                <span v-if="v.barcode" class="px-2 py-0.5 rounded bg-surface-subtle border border-border text-foreground">
                  {{ v.barcode }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>

              <TableCell class="font-mono text-base font-bold text-foreground tabular-nums">
                {{ v.quantity_on_hand }}
                <span class="text-xs font-normal text-muted-foreground ml-1">units</span>
              </TableCell>

              <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                {{ v.reorder_level }} units
              </TableCell>

              <TableCell>
                <Badge :variant="stockBadge(v)" class="text-[11px] px-2 py-0.5">
                  {{ stockLabel(v) }}
                </Badge>
              </TableCell>

              <TableCell class="text-right">
                <RouterLink
                  v-if="v.quantity_on_hand <= v.reorder_level"
                  to="/restock"
                >
                  <Button variant="outline" size="sm" class="h-7 px-2 text-xs font-semibold border-warning/40 text-warning-foreground hover:bg-warning/10">
                    + Restock
                  </Button>
                </RouterLink>
                <span v-else class="text-xs text-muted-foreground">Healthy</span>
              </TableCell>
            </TableRow>
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
