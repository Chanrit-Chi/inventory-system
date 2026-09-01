<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useProductStore, type Product } from '@/stores/productStore'
import { useToast } from '@/composables/useToast'
import {
  Plus,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  CheckCircle2,
  Package,
  Edit2,
  Trash2,
  AlertCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Copy,
} from 'lucide-vue-next'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal.vue'
import {
  Button,
  Badge,
  Input,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  StatCard,
  EmptyState,
  Skeleton,
  Alert,
} from '@/components/ui'

const router = useRouter()
const productStore = useProductStore()
const toast = useToast()

const search = ref('')
const activeFilter = ref<string>('all')
const categoryFilter = ref<string>('all')
const page = ref(1)
const viewMode = ref<'table' | 'grid'>('table')
const deletingProduct = ref<Product | null>(null)
const deleteLoading = ref(false)
const isDeleteDialogOpen = ref(false)

const categories = computed(() => {
  const map = new Map<string, { id: string; name: string }>()
  for (const p of productStore.products) {
    if (p.category && p.category.id) {
      map.set(p.category.id, { id: p.category.id, name: p.category.name })
    }
  }
  return Array.from(map.values())
})

const displayedProducts = computed(() => {
  if (categoryFilter.value === 'all') return productStore.products
  return productStore.products.filter(p => p.category?.id === categoryFilter.value)
})

function totalStock(p: Product): number {
  return (p.variants || []).reduce((sum: number, v: any) => sum + (v.quantity_on_hand || 0), 0)
}

function getStockClass(stock: number, reorderLevel = 5): string {
  if (stock <= 0) return 'text-red-700 dark:text-red-300 font-semibold'
  if (stock <= reorderLevel) return 'text-amber-800 dark:text-amber-300 font-semibold'
  return 'text-emerald-700 dark:text-emerald-300'
}

function calcMargin(selling: number | string | undefined | null, cost: number | string | undefined | null): number | null {
  const s = parseFloat(String(selling || 0)) || 0
  const c = parseFloat(String(cost || 0)) || 0
  if (s <= 0) return null
  return Math.round(((s - c) / s) * 100)
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${label} "${text}" to clipboard!`)
  } catch {
    toast.info(`${label}: ${text}`)
  }
}

// Quick Stock Adjustment Modal State
const showAdjustmentModal = ref(false)
const selectedAdjustmentVariant = ref<any>(null)
const selectedAdjustmentProductName = ref('')

function openStockAdjust(p: Product) {
  selectedAdjustmentProductName.value = p.name
  const variants = p.variants || []
  const variant = variants.length > 0 ? variants[0] : null
  selectedAdjustmentVariant.value = variant ? {
    id: variant.id,
    product_name: p.name,
    name: (variant as any).name,
    sku: variant.sku || (p as any).barcode || (p as any).sku || '',
    quantity_on_hand: variant.quantity_on_hand ?? totalStock(p),
  } : {
    id: p.id,
    product_name: p.name,
    sku: (p as any).barcode || (p as any).sku || '',
    quantity_on_hand: totalStock(p),
  }
  showAdjustmentModal.value = true
}

// Computed KPIs from loaded products
const totalProductsCount = computed(() => productStore.meta?.total ?? productStore.products.length)
const activeProductsCount = computed(() => productStore.products.filter(p => p.is_active).length)
const totalVariantsCount = computed(() =>
  productStore.products.reduce((acc, p) => acc + (p.variants?.length || 0), 0)
)

async function loadProducts() {
  const params: {
    page?: number
    search?: string
    is_active?: boolean | string
  } = { page: page.value }

  if (search.value.trim()) {
    params.search = search.value.trim()
  }

  if (activeFilter.value === 'active') {
    params.is_active = true
  } else if (activeFilter.value === 'inactive') {
    params.is_active = false
  }

  await productStore.fetchProducts(params)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadProducts()
  }, 300)
}

function onFilterChange(filter: string) {
  activeFilter.value = filter
  page.value = 1
  loadProducts()
}

function changePage(newPage: number) {
  page.value = newPage
  loadProducts()
}

async function handleToggleStatus(product: Product, checked: boolean) {
  try {
    product.is_active = checked
    await productStore.toggleProductStatus(product)
  } catch {
    // Error handled in store
  }
}

function confirmDelete(product: Product) {
  deletingProduct.value = product
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingProduct.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingProduct.value) return
  deleteLoading.value = true
  try {
    await productStore.deleteProduct(deletingProduct.value.id)
    isDeleteDialogOpen.value = false
    deletingProduct.value = null
    if (productStore.products.length === 0 && page.value > 1) {
      page.value--
    }
    await loadProducts()
  } catch {
    // Handled in store
  } finally {
    deleteLoading.value = false
  }
}

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

onMounted(() => {
  loadProducts()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header & Action Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Product Catalog</h1>
          <Badge variant="info" class="tabular-nums font-semibold px-2.5 py-0.5">
            {{ totalProductsCount }} Items
          </Badge>
        </div>
        <p class="text-muted-foreground text-sm mt-1">
          Master catalog, barcodes, margin calculations, and multi-tier Cartesian variant matrices.
        </p>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap">
        <Button
          id="btn-refresh-products"
          variant="outline"
          size="sm"
          class="h-9 px-3 gap-1.5 text-xs"
          :disabled="productStore.loading"
          @click="loadProducts"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': productStore.loading }" />
          <span>Refresh</span>
        </Button>

        <RouterLink to="/products/create">
          <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5 font-semibold">
            <Plus :size="15" />
            <span>New Product</span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- KPI Summary Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Master Products"
        :value="totalProductsCount"
        sub="Items configured in system"
        :icon="Package"
        icon-variant="primary"
      />
      <StatCard
        label="Active for Sale"
        :value="activeProductsCount"
        sub="Enabled for POS & channels"
        :icon="CheckCircle2"
        icon-variant="success"
      />
      <StatCard
        label="Variant Matrix SKUs"
        :value="totalVariantsCount"
        sub="Total size/color combinations"
        :icon="Layers"
        icon-variant="warning"
      />
    </div>

    <!-- Category Filter Pills Carousel / Bar -->
    <div v-if="categories.length > 0" class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      <button
        type="button"
        @click="categoryFilter = 'all'; onFilterChange(activeFilter)"
        :class="[
          'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer',
          categoryFilter === 'all'
            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
            : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-surface-subtle'
        ]"
      >
        All Categories
      </button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        @click="categoryFilter = cat.id; onFilterChange(activeFilter)"
        :class="[
          'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer',
          categoryFilter === cat.id
            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
            : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-surface-subtle'
        ]"
      >
        {{ cat.name }}
      </button>
    </div>

    <!-- Filter & Search Controls -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          id="product-search-input"
          v-model="search"
          type="text"
          placeholder="Search by product name, barcode, or SKU…"
          class="bg-surface"
          @input="onSearchInput"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap">
        <!-- Status Filter Segmented Control -->
        <div class="inline-flex h-9 items-center rounded-lg border border-border bg-surface p-0.5">
          <button
            v-for="filter in [
              { label: 'All', val: 'all' },
              { label: 'Active', val: 'active' },
              { label: 'Inactive', val: 'inactive' }
            ]"
            :key="filter.val"
            class="h-7.5 px-3 flex items-center rounded-md text-xs font-medium transition-colors cursor-pointer"
            :class="activeFilter === filter.val ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="onFilterChange(filter.val)"
          >
            {{ filter.label }}
          </button>
        </div>

        <!-- View Mode Segmented Control -->
        <div class="inline-flex h-9 items-center rounded-lg border border-border bg-surface p-0.5">
          <button
            class="h-7.5 flex items-center gap-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer"
            :class="viewMode === 'table' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
            @click="viewMode = 'table'"
            title="Table View"
          >
            <List :size="14" />
            <span>Table</span>
          </button>
          <button
            class="h-7.5 flex items-center gap-1.5 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer"
            :class="viewMode === 'grid' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
            @click="viewMode = 'grid'"
            title="Cards View"
          >
            <LayoutGrid :size="14" />
            <span>Cards</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <Alert v-if="productStore.error" variant="error" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" />
        <span>{{ productStore.error }}</span>
      </div>
      <Button variant="ghost" size="sm" class="text-xs h-7" @click="loadProducts">Retry</Button>
    </Alert>

    <!-- Main Content Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <!-- Loading Skeleton -->
      <div v-if="productStore.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else-if="productStore.products.length === 0"
        :icon="Package"
        title="No products found"
        description="No products match your current search query or filter criteria. Try adjusting your search or add a new product line."
      >
        <template #action>
          <RouterLink to="/products/create">
            <Button variant="primary" size="sm" class="gap-1.5">
              <Plus :size="15" />
              <span>Create First Product</span>
            </Button>
          </RouterLink>
        </template>
      </EmptyState>

      <!-- Table View -->
      <div v-else-if="viewMode === 'table'" class="overflow-x-auto">
        <table class="w-full text-xs text-left min-w-[980px]">
          <thead class="bg-surface-subtle text-muted-foreground text-xs font-bold border-b border-border">
            <tr>
              <th class="px-4 py-3 w-14">Image</th>
              <th class="px-4 py-3 min-w-[200px]">Product Name</th>
              <th class="px-4 py-3 w-36">Barcode / SKU</th>
              <th class="px-4 py-3 w-40 min-w-[140px]">Variants</th>
              <th class="px-4 py-3 w-36 min-w-[130px]">Stock</th>
              <th class="px-4 py-3 text-right w-28 font-mono">Cost Price</th>
              <th class="px-4 py-3 text-right w-44 min-w-[160px] font-mono">Selling Price & Margin</th>
              <th class="px-4 py-3 text-center w-20">Active</th>
              <th class="px-4 py-3 text-right w-36">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/70">
            <tr
              v-for="p in displayedProducts"
              :key="p.id"
              class="hover:bg-surface-subtle/50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="w-10 h-10 rounded-lg bg-surface-subtle border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  <img
                    v-if="p.image_url"
                    :src="p.image_url"
                    :alt="p.name"
                    class="w-full h-full object-cover"
                    @error="($event.target as HTMLElement).style.display='none'"
                  />
                  <Package v-else :size="18" class="text-primary/50" />
                </div>
              </td>

              <td class="px-4 py-3">
                <div class="font-bold text-xs text-foreground hover:text-primary transition-colors cursor-pointer" @click="router.push(`/products/${p.id}/edit`)">
                  {{ p.name }}
                </div>
                <div v-if="p.category" class="mt-1">
                  <Badge variant="primary" class="text-xs font-semibold">
                    {{ p.category.name }}
                  </Badge>
                </div>
              </td>

              <td class="px-4 py-3 font-mono text-xs">
                <button
                  v-if="p.barcode || (p as any).sku"
                  type="button"
                  @click="copyToClipboard(p.barcode || (p as any).sku, 'Barcode')"
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-subtle border border-border text-foreground hover:border-cta transition-colors cursor-pointer group"
                  title="Click to copy barcode"
                >
                  <span>{{ p.barcode || (p as any).sku }}</span>
                  <Copy :size="12" class="text-muted-foreground opacity-60 group-hover:opacity-100" />
                </button>
                <span v-else class="text-muted-foreground">—</span>
              </td>

              <td class="px-4 py-3">
                <Badge variant="info" class="font-mono text-xs font-semibold">
                  {{ p.variants ? p.variants.length : 0 }} variants
                </Badge>
              </td>

              <td class="px-4 py-3 font-mono text-xs tabular-nums">
                <div class="flex items-center gap-1.5 whitespace-nowrap">
                  <Badge
                    v-if="totalStock(p) > 0"
                    :variant="totalStock(p) <= 5 ? 'warning' : 'neutral'"
                    class="font-mono font-bold text-xs px-2 py-0.5"
                  >
                    {{ totalStock(p) }} units
                  </Badge>
                  <Badge
                    v-else
                    variant="error"
                    class="font-mono font-bold text-xs px-2 py-0.5"
                  >
                    Out of stock
                  </Badge>
                </div>
              </td>

              <td class="px-4 py-3 text-right font-mono text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
                {{ fmtMoney(p.purchase_price) }}
              </td>

              <td class="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                <div class="flex flex-col items-end">
                  <span class="font-mono text-xs font-bold text-primary">
                    {{ fmtMoney(p.selling_price) }}
                  </span>
                  <Badge
                    v-if="calcMargin(p.selling_price, p.purchase_price) !== null"
                    :variant="(calcMargin(p.selling_price, p.purchase_price) ?? 0) > 20 ? 'success' : 'warning'"
                    class="text-xs font-mono font-semibold mt-1"
                  >
                    {{ (calcMargin(p.selling_price, p.purchase_price) ?? 0) > 0 ? `+${calcMargin(p.selling_price, p.purchase_price)}%` : `${calcMargin(p.selling_price, p.purchase_price)}%` }} Margin
                  </Badge>
                </div>
              </td>

              <td class="px-4 py-3 text-center">
                <Switch
                  :checked="p.is_active"
                  :disabled="productStore.mutating"
                  @update:checked="(checked) => handleToggleStatus(p, checked)"
                />
              </td>

              <td class="px-4 py-3 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7.5 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-surface-subtle font-semibold"
                    title="Quick Stock Adjustment"
                    @click="openStockAdjust(p)"
                  >
                    <SlidersHorizontal :size="13" />
                    <span>Adjust</span>
                  </Button>
                  <Button
                    :id="`btn-edit-product-${p.id}`"
                    variant="ghost"
                    size="sm"
                    class="h-7.5 px-2 text-xs gap-1 text-muted-foreground hover:text-primary hover:bg-surface-subtle font-semibold"
                    @click="router.push(`/products/${p.id}/edit`)"
                  >
                    <Edit2 :size="13" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    :id="`btn-delete-product-${p.id}`"
                    variant="ghost"
                    size="sm"
                    class="h-7.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    @click="confirmDelete(p)"
                  >
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Cards Grid View -->
      <div v-else class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="p in displayedProducts"
          :key="p.id"
          class="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between gap-3 hover:shadow-xs hover:border-border-strong transition-all"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="w-12 h-12 rounded-xl bg-surface-subtle border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                v-if="p.image_url"
                :src="p.image_url"
                :alt="p.name"
                class="w-full h-full object-cover"
                @error="($event.target as HTMLElement).style.display='none'"
              />
              <Package v-else :size="22" class="text-muted-foreground/60" />
            </div>

            <div class="flex flex-col items-end gap-1">
              <Badge :variant="p.is_active ? 'success' : 'neutral'" class="text-[10px] px-2 py-0.5">
                {{ p.is_active ? 'Active' : 'Inactive' }}
              </Badge>
              <Badge variant="info" class="text-[10px] font-mono px-1.5 py-0">
                {{ p.variants ? p.variants.length : 0 }} variants
              </Badge>
            </div>
          </div>

          <div>
            <h3 class="font-semibold text-sm text-foreground line-clamp-1 hover:text-primary cursor-pointer" @click="router.push(`/products/${p.id}/edit`)">
              {{ p.name }}
            </h3>
            <div v-if="p.barcode || (p as any).sku" class="text-xs font-mono text-muted-foreground mt-0.5">
              <button
                type="button"
                @click="copyToClipboard(p.barcode || (p as any).sku, 'Barcode')"
                class="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer group"
              >
                <span>Barcode: {{ p.barcode || (p as any).sku }}</span>
                <Copy :size="10" class="opacity-60 group-hover:opacity-100" />
              </button>
            </div>
            <div class="text-xs mt-1" :class="getStockClass(totalStock(p))">
              <span v-if="totalStock(p) > 0">{{ totalStock(p) }} units in stock</span>
              <span v-else>Out of stock</span>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-border/60">
            <div>
              <span class="text-[10px] text-muted-foreground block uppercase font-medium">Selling Price</span>
              <div class="flex items-baseline gap-1.5">
                <span class="font-mono font-bold text-base text-primary tabular-nums">
                  {{ fmtMoney(p.selling_price) }}
                </span>
                <span
                  v-if="calcMargin(p.selling_price, p.purchase_price) !== null"
                  class="text-3xs font-bold font-mono text-emerald-600"
                >
                  {{ (calcMargin(p.selling_price, p.purchase_price) ?? 0) > 0 ? `+${calcMargin(p.selling_price, p.purchase_price)}%` : `${calcMargin(p.selling_price, p.purchase_price)}%` }}
                </span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-muted-foreground block uppercase font-medium">Cost</span>
              <span class="font-mono text-xs text-muted-foreground tabular-nums">
                {{ fmtMoney(p.purchase_price) }}
              </span>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2 text-xs gap-1"
              @click="openStockAdjust(p)"
            >
              <SlidersHorizontal :size="12" />
              <span>Adjust</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-xs gap-1"
              @click="router.push(`/products/${p.id}/edit`)"
            >
              <Edit2 :size="12" />
              <span>Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
              @click="confirmDelete(p)"
            >
              <Trash2 :size="13" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Pagination Bar -->
      <div
        v-if="productStore.meta && productStore.meta.last_page > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
      >
        <span class="font-mono">
          Page {{ productStore.meta.current_page }} of {{ productStore.meta.last_page }} ({{ productStore.meta.total }} total)
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page <= 1 || productStore.loading"
            @click="changePage(page - 1)"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page >= productStore.meta.last_page || productStore.loading"
            @click="changePage(page + 1)"
          >
            <span>Next</span>
            <ChevronRight :size="14" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Radix Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Product Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete product <strong>"{{ deletingProduct?.name }}"</strong>?
            This will soft-delete the master line and remove associated SKU variant combinations from active POS registers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="deleteLoading" @click="cancelDelete">
            Cancel
          </Button>
          <Button
            id="btn-confirm-delete-product"
            variant="destructive"
            :disabled="deleteLoading"
            @click="executeDelete"
          >
            <span v-if="deleteLoading" class="animate-spin mr-1.5">⏳</span>
            <span>{{ deleteLoading ? 'Deleting…' : 'Delete Product' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Quick Stock Adjustment Modal -->
    <StockAdjustmentModal
      v-model:open="showAdjustmentModal"
      :variant="selectedAdjustmentVariant"
      :product-name="selectedAdjustmentProductName"
      @success="loadProducts"
    />
  </div>
</template>
