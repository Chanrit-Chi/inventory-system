<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useProductStore } from '@/stores/productStore'

const route = useRoute()
const productStore = useProductStore()

const productId = route.params.id as string

const form = ref({
  name: '',
  barcode: '',
  purchase_price: '',
  selling_price: '',
  default_reorder_level: '5',
  image_url: '',
  description: '',
  is_active: true,
})

const successMessage = ref('')
const submitError = ref('')

const grossProfit = computed(() => {
  const p = parseFloat(form.value.purchase_price) || 0
  const s = parseFloat(form.value.selling_price) || 0
  return s - p
})

const grossMarginPercent = computed(() => {
  const s = parseFloat(form.value.selling_price) || 0
  if (s <= 0) return 0
  return Math.round((grossProfit.value / s) * 100)
})

const totalStockOnHand = computed(() => {
  if (!productStore.selectedProduct?.variants) return 0
  return productStore.selectedProduct.variants.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
})

const totalStockValue = computed(() => {
  if (!productStore.selectedProduct?.variants) return 0
  return productStore.selectedProduct.variants.reduce(
    (sum, v) => sum + (v.quantity_on_hand || 0) * (parseFloat(String(v.selling_price)) || 0),
    0
  )
})

async function loadProduct() {
  try {
    const prod = await productStore.fetchProduct(productId)
    if (prod) {
      form.value = {
        name: prod.name || '',
        barcode: prod.barcode || '',
        purchase_price: prod.purchase_price !== undefined ? String(prod.purchase_price) : '',
        selling_price: prod.selling_price !== undefined ? String(prod.selling_price) : '',
        default_reorder_level: prod.default_reorder_level !== undefined ? String(prod.default_reorder_level) : '5',
        image_url: prod.image_url || '',
        description: prod.description || '',
        is_active: prod.is_active ?? true,
      }
    }
  } catch {
    // Handled in store
  }
}

async function save() {
  submitError.value = ''
  successMessage.value = ''

  if (!form.value.name.trim()) {
    submitError.value = 'Product name cannot be empty.'
    return
  }

  const pPrice = parseFloat(form.value.purchase_price)
  const sPrice = parseFloat(form.value.selling_price)

  if (isNaN(pPrice) || pPrice < 0) {
    submitError.value = 'Valid purchase price is required.'
    return
  }
  if (isNaN(sPrice) || sPrice <= 0) {
    submitError.value = 'Selling price must be greater than $0.00.'
    return
  }

  const payload = {
    name: form.value.name.trim(),
    barcode: form.value.barcode.trim() || null,
    purchase_price: pPrice,
    selling_price: sPrice,
    default_reorder_level: parseInt(form.value.default_reorder_level) || 0,
    image_url: form.value.image_url.trim() || null,
    description: form.value.description.trim() || null,
    is_active: form.value.is_active,
  }

  try {
    await productStore.updateProduct(productId, payload)
    successMessage.value = 'Product updated successfully!'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : 'Failed to update product.'
  }
}

function fmtMoney(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '$0.00'
  const val = typeof num === 'string' ? parseFloat(num) : num
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function stockBadge(qty: number, reorder: number) {
  if (qty === 0) return 'badge--red'
  if (qty <= reorder) return 'badge--yellow'
  return 'badge--green'
}

function stockLabel(qty: number, reorder: number) {
  if (qty === 0) return 'Out of Stock'
  if (qty <= reorder) return 'Low Stock'
  return 'In Stock'
}

onMounted(() => {
  loadProduct()
})
</script>

<template>
  <div class="flex-col gap-24" style="max-width: 1080px;">
    <!-- Header & Navigation -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-12">
        <RouterLink to="/products" class="btn btn--ghost btn--sm">
          ← Back to Catalog
        </RouterLink>
        <div>
          <h1 class="page-title" style="margin: 0;">
            Edit: {{ productStore.selectedProduct?.name || 'Loading Product…' }}
          </h1>
          <span class="text-xs text-muted">ID: {{ productId }}</span>
        </div>
      </div>

      <div v-if="productStore.selectedProduct" class="flex items-center gap-8">
        <span class="badge" :class="form.is_active ? 'badge--green' : 'badge--neutral'">
          {{ form.is_active ? '● Active in POS' : '○ Inactive' }}
        </span>
      </div>
    </div>

    <!-- Alert Notifications -->
    <div v-if="submitError || productStore.error" class="alert alert--error">
      <span>⚠️ {{ submitError || productStore.error }}</span>
    </div>

    <div v-if="successMessage" class="alert alert--success">
      <span>✓ {{ successMessage }}</span>
    </div>

    <div v-if="productStore.loading" class="card">
      <div v-for="i in 4" :key="i" class="skeleton-row"></div>
    </div>

    <template v-else-if="productStore.selectedProduct">
      <!-- KPI Stats Banner for Product -->
      <div class="grid-3 gap-16">
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="icon-badge icon-badge--primary">
              <span>🧬</span>
            </div>
            <span class="badge badge--blue">Variants</span>
          </div>
          <div class="stat-card-body">
            <span class="stat-card-value tabular-nums">{{ productStore.selectedProduct.variants?.length || 0 }}</span>
            <span class="stat-card-label">Active SKUs</span>
            <span class="stat-card-sub">Variant matrix combinations</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="icon-badge icon-badge--success">
              <span>📦</span>
            </div>
            <span class="badge badge--green">Live Stock</span>
          </div>
          <div class="stat-card-body">
            <span class="stat-card-value tabular-nums" style="color: var(--status-success);">
              {{ totalStockOnHand }}
            </span>
            <span class="stat-card-label">Total Units on Hand</span>
            <span class="stat-card-sub">Across all variant SKUs</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="icon-badge icon-badge--warning">
              <span>💵</span>
            </div>
            <span class="badge badge--neutral">Valuation</span>
          </div>
          <div class="stat-card-body">
            <span class="stat-card-value tabular-nums" style="color: var(--action-primary);">
              {{ fmtMoney(totalStockValue) }}
            </span>
            <span class="stat-card-label">Inventory Retail Value</span>
            <span class="stat-card-sub">Total on-shelf stock value</span>
          </div>
        </div>
      </div>

      <!-- Edit Form Card -->
      <section class="card flex-col gap-16">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-lg">Base Product Details & Pricing</h2>
          <span class="text-xs text-muted">Last updated in database</span>
        </div>

        <div class="flex-col gap-16">
          <div class="form-group">
            <label class="form-label">Product Name *</label>
            <input
              id="product-edit-name"
              v-model="form.name"
              type="text"
              :class="{ 'input--error': productStore.fieldErrors?.name }"
            />
            <span v-if="productStore.fieldErrors?.name" class="form-error-text">
              {{ productStore.fieldErrors.name[0] }}
            </span>
          </div>

          <div class="grid-2 gap-16">
            <div class="form-group">
              <label class="form-label">Master Barcode</label>
              <input
                id="product-edit-barcode"
                v-model="form.barcode"
                type="text"
                placeholder="e.g. 8859123456789"
                :class="{ 'input--error': productStore.fieldErrors?.barcode }"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Default Reorder Level</label>
              <input
                id="product-edit-reorder"
                v-model="form.default_reorder_level"
                type="number"
                min="0"
              />
            </div>
          </div>

          <div class="grid-2 gap-16">
            <div class="form-group">
              <label class="form-label">Purchase Cost ($) *</label>
              <input
                id="product-edit-purchase-price"
                v-model="form.purchase_price"
                type="number"
                step="0.01"
                min="0"
                class="tabular-nums"
                :class="{ 'input--error': productStore.fieldErrors?.purchase_price }"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Selling Price ($) *</label>
              <input
                id="product-edit-selling-price"
                v-model="form.selling_price"
                type="number"
                step="0.01"
                min="0.01"
                class="tabular-nums"
                :class="{ 'input--error': productStore.fieldErrors?.selling_price }"
              />
            </div>
          </div>

          <!-- Profit Margin Gauge Banner -->
          <div
            v-if="form.selling_price && form.purchase_price"
            class="flex items-center justify-between"
            style="padding: 10px 14px; background-color: var(--surface-alt); border-radius: var(--radius-md); border: 1px solid var(--border-color);"
          >
            <span class="text-xs text-muted font-semibold">Unit Gross Profit Margin:</span>
            <div class="flex items-center gap-8">
              <span class="font-bold tabular-nums" :style="{ color: grossProfit >= 0 ? 'var(--status-success)' : 'var(--status-error)' }">
                {{ fmtMoney(grossProfit) }} / unit
              </span>
              <span class="badge" :class="grossProfit >= 0 ? 'badge--green' : 'badge--red'">
                {{ grossMarginPercent }}% Margin
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Image URL</label>
            <input
              id="product-edit-image"
              v-model="form.image_url"
              type="url"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              id="product-edit-description"
              v-model="form.description"
              rows="3"
            ></textarea>
          </div>

          <div class="flex items-center gap-12 pt-8" style="border-top: 1px solid var(--border-subtle);">
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.is_active" />
              <span class="toggle-slider"></span>
            </label>
            <div>
              <span class="font-semibold text-sm block">Product Active in POS & Online Catalog</span>
              <span class="text-xs text-muted">Inactive products cannot be sold through register checkouts</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-12 mt-16 pt-16" style="border-top: 1px solid var(--border-color);">
          <RouterLink to="/products" class="btn btn--ghost">
            Cancel
          </RouterLink>
          <button
            id="btn-save-product"
            class="btn btn--primary"
            :disabled="productStore.mutating"
            @click="save"
          >
            <span v-if="productStore.mutating" class="spinner"></span>
            {{ productStore.mutating ? 'Saving Changes…' : '✓ Save Changes' }}
          </button>
        </div>
      </section>

      <!-- Variants & Live Stock Table -->
      <section class="card" style="padding: 0; overflow: hidden;">
        <div class="flex items-center justify-between" style="padding: 18px 24px; border-bottom: 1px solid var(--border-color);">
          <div>
            <h2 class="font-bold text-lg">
              Variant Inventory Matrix
              <span class="badge badge--blue tabular-nums" style="margin-left: 8px;">
                {{ productStore.selectedProduct.variants?.length || 0 }} SKUs
              </span>
            </h2>
            <p class="text-muted text-xs mt-2">
              Individual SKUs, barcodes, and live stock levels for each variation.
            </p>
          </div>
        </div>

        <div v-if="!productStore.selectedProduct.variants || productStore.selectedProduct.variants.length === 0" class="empty-state" style="padding: 32px 0;">
          <p class="text-muted">No variants associated with this product.</p>
        </div>

        <div v-else class="table-wrap" style="border: none; border-radius: 0; box-shadow: none;">
          <table>
            <thead>
              <tr>
                <th>Variant SKU</th>
                <th>Barcode</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Stock On Hand</th>
                <th>Reorder Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in productStore.selectedProduct.variants" :key="v.id">
                <td>
                  <code class="tabular-nums font-semibold" style="font-size: 13px; color: var(--action-primary);">
                    {{ v.sku }}
                  </code>
                </td>
                <td>
                  <code v-if="v.barcode" class="tabular-nums text-xs" style="background-color: var(--surface-alt); padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    {{ v.barcode }}
                  </code>
                  <span v-else class="text-muted text-xs">—</span>
                </td>
                <td class="tabular-nums text-muted">{{ fmtMoney(v.cost_price) }}</td>
                <td class="tabular-nums font-bold" style="color: var(--action-primary);">{{ fmtMoney(v.selling_price) }}</td>
                <td class="tabular-nums font-bold" style="font-size: 14.5px;">
                  {{ v.quantity_on_hand }}
                </td>
                <td class="tabular-nums text-muted">{{ v.reorder_level }} units</td>
                <td>
                  <span class="badge" :class="stockBadge(v.quantity_on_hand, v.reorder_level)">
                    {{ stockLabel(v.quantity_on_hand, v.reorder_level) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
