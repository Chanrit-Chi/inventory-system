<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import api from '@/api/axios'

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
  if (v.quantity_on_hand === 0) return 'badge--red'
  if (v.quantity_on_hand <= v.reorder_level) return 'badge--yellow'
  return 'badge--green'
}

function stockLabel(v: Variant) {
  if (v.quantity_on_hand === 0) return '✕ Out of Stock'
  if (v.quantity_on_hand <= v.reorder_level) return '⚠️ Low Stock'
  return '✓ In Stock'
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
  <div class="flex-col gap-24">
    <!-- Header & Actions -->
    <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 16px;">
      <div>
        <div class="flex items-center gap-10">
          <h1 class="page-title">Inventory Ledger</h1>
          <span class="badge badge--blue font-semibold tabular-nums">{{ totalSkus }} SKUs</span>
        </div>
        <p class="text-muted text-sm mt-4">
          Real-time SKU stock levels, reorder thresholds, inventory valuation, and batch intake.
        </p>
      </div>

      <div class="flex items-center gap-12">
        <RouterLink to="/restock" class="btn btn--primary" id="btn-goto-restock">
          <span>📥</span>
          <span>+ Restock Batch Intake</span>
        </RouterLink>
      </div>
    </div>

    <!-- KPI Stat Cards -->
    <div class="grid-4 gap-16">
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--primary">
            <span>📦</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Catalog SKUs</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums">{{ totalSkus }}</span>
          <span class="stat-card-label">Tracked SKUs</span>
          <span class="stat-card-sub">{{ totalInventoryUnits }} total units on hand</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--warning">
            <span>⚠️</span>
          </div>
          <div class="trend-pill trend-pill--warning">
            <span>Reorder Needed</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-warning);">
            {{ lowStockCount }}
          </span>
          <span class="stat-card-label">Low Stock Warning</span>
          <span class="stat-card-sub">At or below reorder threshold</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--danger">
            <span>✕</span>
          </div>
          <div class="trend-pill trend-pill--down">
            <span>Depleted</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-error);">
            {{ outOfStockCount }}
          </span>
          <span class="stat-card-label">Out of Stock</span>
          <span class="stat-card-sub">0 units available for sale</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--purple">
            <span>💵</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Valuation</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-purple-text);">
            {{ fmtMoney(estimatedStockCost) }}
          </span>
          <span class="stat-card-label">Inventory Cost Value</span>
          <span class="stat-card-sub">Calculated from supplier cost</span>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <section class="card">
      <div class="flex items-center justify-between gap-16" style="flex-wrap: wrap;">
        <div style="flex: 1; min-width: 260px; max-width: 480px;">
          <input
            id="inventory-search"
            v-model="search"
            type="text"
            placeholder="Search by product name, SKU, or barcode…"
            @input="onSearchInput"
          />
        </div>

        <div class="flex items-center gap-12" style="flex-wrap: wrap;">
          <div class="form-group" style="min-width: 170px;">
            <select id="inventory-stock-filter" v-model="stockFilter" @change="onFilterChange">
              <option value="all">All Stock Statuses</option>
              <option value="in">In Stock Only</option>
              <option value="low">Low Stock Only</option>
              <option value="out">Out of Stock Only</option>
            </select>
          </div>

          <button id="btn-refresh-inventory" class="btn btn--ghost" @click="loadInventory" title="Refresh">
            ↺ Refresh
          </button>
        </div>
      </div>
    </section>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert--error">
      <span>⚠️ {{ error }}</span>
      <button class="btn btn--ghost btn--sm" @click="loadInventory" style="margin-left: auto;">Retry</button>
    </div>

    <!-- Inventory Table -->
    <section class="card" style="padding: 0; overflow: hidden;">
      <div v-if="loading" style="padding: 24px;">
        <div v-for="i in 5" :key="i" class="skeleton-row"></div>
      </div>

      <div v-else-if="variants.length === 0" class="empty-state">
        <div class="empty-icon">📦</div>
        <h3 class="font-bold text-lg mb-8">No inventory items found</h3>
        <p class="text-muted mb-16">No variants match your search and filter parameters.</p>
        <RouterLink to="/restock" class="btn btn--primary">
          Start a Restock Intake
        </RouterLink>
      </div>

      <div v-else class="table-wrap" style="border: none; border-radius: 0; box-shadow: none;">
        <table>
          <thead>
            <tr>
              <th>Product & Category</th>
              <th>Variant SKU</th>
              <th>Barcode</th>
              <th>Quantity On Hand</th>
              <th>Reorder At</th>
              <th>Stock Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="v in variants"
              :key="v.id"
              :class="{ 'row-warning': isRowLowStock(v) }"
            >
              <td>
                <div class="font-semibold">{{ v.product?.name ?? '—' }}</div>
                <div v-if="v.product?.category" class="text-xs text-muted mt-2">
                  <span class="badge badge--neutral" style="font-size: 11px; padding: 2px 6px;">
                    {{ v.product.category.name }}
                  </span>
                </div>
              </td>
              <td>
                <code class="tabular-nums font-semibold" style="font-size: 13px; color: var(--action-primary); background-color: var(--surface-alt); padding: 3px 8px; border-radius: var(--radius-xs); border: 1px solid var(--border-color);">
                  {{ v.sku }}
                </code>
              </td>
              <td>
                <code v-if="v.barcode" class="tabular-nums text-xs" style="background-color: var(--surface-alt); padding: 3px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  {{ v.barcode }}
                </code>
                <span v-else class="text-muted text-xs">—</span>
              </td>
              <td>
                <div class="flex items-center gap-8">
                  <span class="tabular-nums font-bold" style="font-size: 15px;">
                    {{ v.quantity_on_hand }}
                  </span>
                  <span class="text-xs text-muted">units</span>
                </div>
              </td>
              <td class="tabular-nums text-muted">{{ v.reorder_level }} units</td>
              <td>
                <span class="badge" :class="stockBadge(v)">
                  {{ stockLabel(v) }}
                </span>
              </td>
              <td style="text-align: right;">
                <RouterLink
                  v-if="v.quantity_on_hand <= v.reorder_level"
                  to="/restock"
                  class="btn btn--subtle btn--sm"
                  style="color: var(--status-warning-text); font-weight: 600;"
                >
                  + Restock
                </RouterLink>
                <span v-else class="text-xs text-muted">Healthy</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="meta && meta.last_page > 1"
        class="pagination"
        style="padding: 16px 24px; border-top: 1px solid var(--border-color);"
      >
        <button
          class="page-btn"
          :disabled="page <= 1 || loading"
          @click="page--; loadInventory()"
        >
          ‹ Previous
        </button>
        <span class="page-info tabular-nums">
          Page {{ page }} of {{ meta.last_page }} ({{ meta.total }} total)
        </span>
        <button
          class="page-btn"
          :disabled="page >= meta.last_page || loading"
          @click="page++; loadInventory()"
        >
          Next ›
        </button>
      </div>
    </section>

    <!-- Movement Audit Trail Legend -->
    <section class="card">
      <div class="flex items-center justify-between mb-12">
        <h2 class="font-bold text-lg">Stock Movement Types & Audit Reference</h2>
        <span class="badge badge--green font-semibold">Atomic ACID Ledger</span>
      </div>
      <div class="tags mb-12">
        <span class="badge badge--green">RESTOCK (Supplier Intake)</span>
        <span class="badge badge--red">SALE (POS / Checkout)</span>
        <span class="badge badge--yellow">ADJUSTMENT (Audit / Count)</span>
        <span class="badge badge--blue">RETURN (Customer Return)</span>
        <span class="badge badge--red">DAMAGE (Defect / Loss)</span>
      </div>
      <p class="text-muted text-sm" style="line-height: 1.5;">
        All stock mutations in OmniPOS are transactional and strictly recorded in the stock movements ledger with quantity snapshots (before/after).
      </p>
    </section>
  </div>
</template>
