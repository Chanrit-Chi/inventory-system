<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useProductStore, type Product } from '@/stores/productStore'

const router = useRouter()
const productStore = useProductStore()

const search = ref('')
const activeFilter = ref<string>('all')
const page = ref(1)
const viewMode = ref<'table' | 'grid'>('table')
const deletingProduct = ref<Product | null>(null)
const deleteLoading = ref(false)

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

function onFilterChange() {
  page.value = 1
  loadProducts()
}

function changePage(newPage: number) {
  page.value = newPage
  loadProducts()
}

async function handleToggleStatus(product: Product) {
  try {
    await productStore.toggleProductStatus(product)
  } catch {
    // Error handled in store
  }
}

function confirmDelete(product: Product) {
  deletingProduct.value = product
}

function cancelDelete() {
  deletingProduct.value = null
}

async function executeDelete() {
  if (!deletingProduct.value) return
  deleteLoading.value = true
  try {
    await productStore.deleteProduct(deletingProduct.value.id)
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
  <div class="flex-col gap-24">
    <!-- Header & Action Toolbar -->
    <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 16px;">
      <div>
        <div class="flex items-center gap-10">
          <h1 class="page-title">Product Catalog</h1>
          <span class="badge badge--blue tabular-nums font-semibold">{{ totalProductsCount }} Items</span>
        </div>
        <p class="text-muted text-sm mt-4">
          Manage master product lines, barcodes, pricing margins, and variant matrices.
        </p>
      </div>

      <div class="flex items-center gap-12">
        <button
          class="btn btn--ghost btn--sm"
          :class="{ 'btn--subtle': viewMode === 'table' }"
          @click="viewMode = 'table'"
          title="Table View"
        >
          <span>☰ Table</span>
        </button>
        <button
          class="btn btn--ghost btn--sm"
          :class="{ 'btn--subtle': viewMode === 'grid' }"
          @click="viewMode = 'grid'"
          title="Grid View"
        >
          <span>⊞ Cards</span>
        </button>

        <RouterLink to="/products/create" class="btn btn--primary" id="btn-new-product">
          <span>+</span>
          <span>New Product</span>
        </RouterLink>
      </div>
    </div>

    <!-- KPI Summary Stat Cards -->
    <div class="grid-3 gap-16">
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--primary">
            <span>🏷️</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Master Catalog</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums">{{ totalProductsCount }}</span>
          <span class="stat-card-label">Total Products</span>
          <span class="stat-card-sub">Items configured in system</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--success">
            <span>✓</span>
          </div>
          <div class="trend-pill trend-pill--up">
            <span>● Active in POS</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-success);">
            {{ activeProductsCount }}
          </span>
          <span class="stat-card-label">Active For Sale</span>
          <span class="stat-card-sub">Available on POS & channels</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--warning">
            <span>📦</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Cartesian Matrix</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-warning);">
            {{ totalVariantsCount }}
          </span>
          <span class="stat-card-label">Total Variant SKUs</span>
          <span class="stat-card-sub">Combinations across active products</span>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <section class="card">
      <div class="flex items-center justify-between gap-16" style="flex-wrap: wrap;">
        <div style="flex: 1; min-width: 260px; max-width: 480px;">
          <input
            id="product-search-input"
            v-model="search"
            type="text"
            placeholder="Search by product name, barcode, or SKU…"
            @input="onSearchInput"
          />
        </div>

        <div class="flex items-center gap-12" style="flex-wrap: wrap;">
          <div class="form-group" style="min-width: 150px;">
            <select id="product-status-filter" v-model="activeFilter" @change="onFilterChange">
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <button id="btn-refresh-products" class="btn btn--ghost" @click="loadProducts" title="Refresh Catalog">
            ↺ Refresh
          </button>
        </div>
      </div>
    </section>

    <!-- Error Alert -->
    <div v-if="productStore.error" class="alert alert--error">
      <span>⚠️ {{ productStore.error }}</span>
      <button class="btn btn--ghost btn--sm" @click="loadProducts" style="margin-left: auto;">Retry</button>
    </div>

    <!-- Products Content (Table View / Grid View) -->
    <section class="card" style="padding: 0; overflow: hidden;">
      <div v-if="productStore.loading" style="padding: 24px;">
        <div v-for="i in 5" :key="i" class="skeleton-row"></div>
      </div>

      <div v-else-if="productStore.products.length === 0" class="empty-state">
        <div class="empty-icon">🏷️</div>
        <h3 class="font-bold text-lg mb-8">No products found</h3>
        <p class="text-muted mb-16">No products match your current search and filter criteria.</p>
        <RouterLink to="/products/create" class="btn btn--primary">
          Create Your First Product
        </RouterLink>
      </div>

      <!-- Table View -->
      <div v-else-if="viewMode === 'table'" class="table-wrap" style="border: none; border-radius: 0; box-shadow: none;">
        <table>
          <thead>
            <tr>
              <th style="width: 64px;">Image</th>
              <th>Product Name</th>
              <th>Master Barcode</th>
              <th>Variants</th>
              <th>Purchase Price</th>
              <th>Selling Price</th>
              <th>Active</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in productStore.products" :key="p.id">
              <td>
                <div
                  style="width: 40px; height: 40px; border-radius: var(--radius-md); background-color: var(--surface-alt); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border-color);"
                >
                  <img
                    v-if="p.image_url"
                    :src="p.image_url"
                    :alt="p.name"
                    style="width: 100%; height: 100%; object-fit: cover;"
                    @error="($event.target as HTMLElement).style.display='none'"
                  />
                  <span v-else style="font-size: 18px; color: var(--text-disabled);">🏷️</span>
                </div>
              </td>
              <td>
                <div class="font-semibold" style="font-size: 14.5px;">{{ p.name }}</div>
                <div v-if="p.category" class="text-xs text-muted mt-2">
                  <span class="badge badge--neutral" style="font-size: 11px; padding: 2px 6px;">
                    {{ p.category.name }}
                  </span>
                </div>
              </td>
              <td>
                <code v-if="p.barcode" class="tabular-nums" style="font-size: 12px; background-color: var(--surface-alt); padding: 3px 8px; border-radius: var(--radius-xs); border: 1px solid var(--border-color);">
                  {{ p.barcode }}
                </code>
                <span v-else class="text-muted text-xs">—</span>
              </td>
              <td>
                <span class="badge badge--blue tabular-nums">
                  {{ p.variants ? p.variants.length : 0 }} variants
                </span>
              </td>
              <td class="tabular-nums text-muted">{{ fmtMoney(p.purchase_price) }}</td>
              <td class="tabular-nums font-bold" style="font-size: 14.5px; color: var(--action-primary);">
                {{ fmtMoney(p.selling_price) }}
              </td>
              <td>
                <label class="toggle-switch" :title="p.is_active ? 'Active' : 'Inactive'">
                  <input
                    type="checkbox"
                    :checked="p.is_active"
                    :disabled="productStore.mutating"
                    @change="handleToggleStatus(p)"
                  />
                  <span class="toggle-slider"></span>
                </label>
              </td>
              <td style="text-align: right;">
                <div class="flex items-center justify-end gap-8">
                  <button
                    :id="`btn-edit-product-${p.id}`"
                    class="btn btn--ghost btn--sm"
                    @click="router.push(`/products/${p.id}/edit`)"
                  >
                    Edit
                  </button>
                  <button
                    :id="`btn-delete-product-${p.id}`"
                    class="btn btn--ghost btn--sm"
                    style="color: var(--action-destructive);"
                    @click="confirmDelete(p)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Grid Cards View -->
      <div v-else style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
        <div
          v-for="p in productStore.products"
          :key="p.id"
          class="card flex-col gap-12"
          style="padding: 16px; border-color: var(--border-color); background-color: var(--surface-base);"
        >
          <div class="flex items-start justify-between gap-12">
            <div
              style="width: 52px; height: 52px; border-radius: var(--radius-md); background-color: var(--surface-alt); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border-color); flex-shrink: 0;"
            >
              <img
                v-if="p.image_url"
                :src="p.image_url"
                :alt="p.name"
                style="width: 100%; height: 100%; object-fit: cover;"
                @error="($event.target as HTMLElement).style.display='none'"
              />
              <span v-else style="font-size: 24px; color: var(--text-disabled);">🏷️</span>
            </div>

            <div class="flex-col items-end gap-4">
              <span class="badge" :class="p.is_active ? 'badge--green' : 'badge--neutral'">
                {{ p.is_active ? 'Active' : 'Inactive' }}
              </span>
              <span class="badge badge--blue tabular-nums" style="font-size: 11px;">
                {{ p.variants ? p.variants.length : 0 }} variants
              </span>
            </div>
          </div>

          <div>
            <div class="font-bold text-base">{{ p.name }}</div>
            <div v-if="p.barcode" class="text-xs text-muted tabular-nums mt-2">
              Barcode: <code>{{ p.barcode }}</code>
            </div>
          </div>

          <div class="flex items-center justify-between pt-8" style="border-top: 1px solid var(--border-subtle);">
            <div>
              <span class="text-xs text-muted block">Selling Price</span>
              <span class="font-bold tabular-nums text-lg" style="color: var(--action-primary);">
                {{ fmtMoney(p.selling_price) }}
              </span>
            </div>
            <div class="text-right">
              <span class="text-xs text-muted block">Cost</span>
              <span class="tabular-nums text-sm text-muted">
                {{ fmtMoney(p.purchase_price) }}
              </span>
            </div>
          </div>

          <div class="flex items-center justify-end gap-8 pt-8" style="border-top: 1px solid var(--border-subtle);">
            <button
              :id="`btn-edit-product-${p.id}`"
              class="btn btn--ghost btn--sm"
              @click="router.push(`/products/${p.id}/edit`)"
            >
              Edit
            </button>
            <button
              :id="`btn-delete-product-${p.id}`"
              class="btn btn--ghost btn--sm"
              style="color: var(--action-destructive);"
              @click="confirmDelete(p)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div
        v-if="productStore.meta && productStore.meta.last_page > 1"
        class="pagination"
        style="padding: 16px 24px; border-top: 1px solid var(--border-color);"
      >
        <button
          class="page-btn"
          :disabled="page <= 1 || productStore.loading"
          @click="changePage(page - 1)"
        >
          ‹ Previous
        </button>
        <span class="page-info tabular-nums">
          Page {{ productStore.meta.current_page }} of {{ productStore.meta.last_page }} ({{ productStore.meta.total }} total)
        </span>
        <button
          class="page-btn"
          :disabled="page >= productStore.meta.last_page || productStore.loading"
          @click="changePage(page + 1)"
        >
          Next ›
        </button>
      </div>
    </section>

    <!-- Delete Confirmation Modal -->
    <div v-if="deletingProduct" class="modal-backdrop" @click.self="cancelDelete">
      <div class="modal">
        <h2 class="modal-title" style="color: var(--action-destructive);">Confirm Product Deletion</h2>
        <p class="mb-16 text-secondary">
          Are you sure you want to delete product <strong>"{{ deletingProduct.name }}"</strong>?
          This action will remove the product from active catalogs and soft-delete its associated variant matrices.
        </p>

        <div class="flex justify-end gap-12">
          <button class="btn btn--ghost" :disabled="deleteLoading" @click="cancelDelete">
            Cancel
          </button>
          <button
            id="btn-confirm-delete-product"
            class="btn btn--destructive"
            :disabled="deleteLoading"
            @click="executeDelete"
          >
            <span v-if="deleteLoading" class="spinner"></span>
            {{ deleteLoading ? 'Deleting…' : 'Delete Product' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
