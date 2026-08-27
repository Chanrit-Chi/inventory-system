<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAttributeStore, type Attribute } from '@/stores/attributeStore'
import { useProductStore } from '@/stores/productStore'

const router = useRouter()
const attrStore = useAttributeStore()
const productStore = useProductStore()

onMounted(() => {
  attrStore.fetchAttributes()
})

// Active Step in Stepper Navigation
const currentStep = ref<number>(1)

// --- Base product form ---
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

// Margin & Profit calculation
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

// --- Attribute selection ---
const selectedAttrs = ref<Record<string, Set<string>>>({}) // attribute_id -> Set of value_ids

function toggleAttr(attr: Attribute) {
  if (selectedAttrs.value[attr.id]) {
    delete selectedAttrs.value[attr.id]
  } else {
    selectedAttrs.value[attr.id] = new Set()
  }
}

function toggleValue(attrId: string, valueId: string) {
  if (!selectedAttrs.value[attrId]) {
    selectedAttrs.value[attrId] = new Set()
  }
  const set = selectedAttrs.value[attrId]
  if (set.has(valueId)) {
    set.delete(valueId)
  } else {
    set.add(valueId)
  }
}

function isAttrActive(attrId: string) {
  return !!selectedAttrs.value[attrId]
}

function isValueActive(attrId: string, valueId: string) {
  return selectedAttrs.value[attrId]?.has(valueId) ?? false
}

// --- Cartesian Matrix Preview ---
interface MatrixRow {
  sku: string
  combination: string[]
  purchasePrice: number
  sellingPrice: number
  reorderLevel: number
}

const matrixPreview = computed<MatrixRow[]>(() => {
  const namePart = form.value.name
    ? form.value.name.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
    : 'PROD'

  const activeAttrEntries = Object.entries(selectedAttrs.value).filter(
    ([, valSet]) => valSet.size > 0
  )

  if (activeAttrEntries.length === 0) return []

  const groups: Array<Array<{ id: string; label: string }>> = []
  for (const [attrId, valSet] of activeAttrEntries) {
    const attr = attrStore.attributes.find(a => a.id === attrId)
    if (!attr) continue
    const valItems = [...valSet].map(vid => {
      const v = attr.values.find(val => val.id === vid)
      return {
        id: vid,
        label: v?.value_name ?? vid,
      }
    })
    groups.push(valItems)
  }

  if (groups.length === 0) return []

  const cartesian = (sets: Array<Array<{ id: string; label: string }>>): Array<Array<{ id: string; label: string }>> =>
    sets.reduce<Array<Array<{ id: string; label: string }>>>(
      (acc, set) => acc.flatMap(combo => set.map(item => [...combo, item])),
      [[]]
    )

  const combinations = cartesian(groups)
  const pPrice = parseFloat(form.value.purchase_price) || 0
  const sPrice = parseFloat(form.value.selling_price) || 0
  const reorder = parseInt(form.value.default_reorder_level) || 5

  return combinations.map(combo => {
    const slug = combo.map(c => c.label.toUpperCase().replace(/\s+/g, '-')).join('-')
    return {
      sku: `${namePart}-${slug}`,
      combination: combo.map(c => c.label),
      purchasePrice: pPrice,
      sellingPrice: sPrice,
      reorderLevel: reorder,
    }
  })
})

// --- Submit ---
const successMessage = ref('')
const submitError = ref('')

async function submit() {
  submitError.value = ''
  successMessage.value = ''

  if (!form.value.name.trim()) {
    submitError.value = 'Product name is required.'
    currentStep.value = 1
    return
  }

  const pPrice = parseFloat(form.value.purchase_price)
  const sPrice = parseFloat(form.value.selling_price)

  if (isNaN(pPrice) || pPrice < 0) {
    submitError.value = 'Valid purchase price is required.'
    currentStep.value = 1
    return
  }
  if (isNaN(sPrice) || sPrice <= 0) {
    submitError.value = 'Selling price must be greater than $0.00.'
    currentStep.value = 1
    return
  }

  const attributes = Object.entries(selectedAttrs.value)
    .filter(([, vals]) => vals.size > 0)
    .map(([attribute_id, vals]) => ({
      attribute_id,
      value_ids: [...vals],
    }))

  const payload = {
    name: form.value.name.trim(),
    barcode: form.value.barcode.trim() || undefined,
    purchase_price: pPrice,
    selling_price: sPrice,
    default_reorder_level: parseInt(form.value.default_reorder_level) || 5,
    image_url: form.value.image_url.trim() || undefined,
    description: form.value.description.trim() || undefined,
    is_active: form.value.is_active,
    attributes: attributes.length > 0 ? attributes : undefined,
  }

  try {
    await productStore.createProduct(payload)
    successMessage.value = 'Product created successfully! Redirecting to catalog…'
    setTimeout(() => {
      router.push('/products')
    }, 1000)
  } catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : 'Failed to create product.'
  }
}

function fmtMoney(num: number): string {
  return `$${num.toFixed(2)}`
}
</script>

<template>
  <div class="flex-col gap-24" style="max-width: 1140px;">
    <!-- Breadcrumb & Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-12">
        <RouterLink to="/products" class="btn btn--ghost btn--sm">
          ← Back to Catalog
        </RouterLink>
        <div>
          <h1 class="page-title" style="margin: 0;">Create Product Line</h1>
          <p class="text-muted text-xs mt-2">
            Configure master pricing, assign variant options, and generate SKU matrices.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-8">
        <span v-if="matrixPreview.length > 0" class="badge badge--green tabular-nums">
          ✓ {{ matrixPreview.length }} SKUs ready
        </span>
      </div>
    </div>

    <!-- Stepper Navigation Header -->
    <section class="card" style="padding: 16px 24px; background-color: var(--surface-base);">
      <div class="stepper-nav">
        <div
          class="step-item"
          :class="{ 'step-item--active': currentStep === 1, 'step-item--done': form.name && form.selling_price }"
          @click="currentStep = 1"
        >
          <div class="step-num">1</div>
          <div class="step-info">
            <div class="step-title">Base Details & Pricing</div>
            <div class="step-sub">Name, barcodes & margins</div>
          </div>
        </div>

        <div class="step-divider"></div>

        <div
          class="step-item"
          :class="{ 'step-item--active': currentStep === 2, 'step-item--done': matrixPreview.length > 0 }"
          @click="currentStep = 2"
        >
          <div class="step-num">2</div>
          <div class="step-info">
            <div class="step-title">Variant Options</div>
            <div class="step-sub">Sizes, colors, attributes</div>
          </div>
        </div>

        <div class="step-divider"></div>

        <div
          class="step-item"
          :class="{ 'step-item--active': currentStep === 3 }"
          @click="currentStep = 3"
        >
          <div class="step-num">3</div>
          <div class="step-info">
            <div class="step-title">Cartesian Matrix</div>
            <div class="step-sub">Review generated SKUs</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Alert Notifications -->
    <div v-if="submitError || productStore.error" class="alert alert--error">
      <span>⚠️ {{ submitError || productStore.error }}</span>
    </div>

    <div v-if="successMessage" class="alert alert--success">
      <span>✓ {{ successMessage }}</span>
    </div>

    <!-- Step 1 & 2 Grid Section -->
    <div class="grid-2 gap-24">
      <!-- Left: Base Product Details Form -->
      <section class="card flex-col gap-16">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-8">
            <div class="icon-badge icon-badge--sm icon-badge--primary">1</div>
            <h2 class="font-bold text-lg">Base Product Details</h2>
          </div>
          <span class="badge badge--neutral text-xs">Required Fields *</span>
        </div>

        <div class="flex-col gap-16">
          <div class="form-group">
            <label class="form-label">Product Name *</label>
            <input
              id="product-name"
              v-model="form.name"
              type="text"
              placeholder="e.g. Classic Oxford Cotton Shirt"
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
                id="product-barcode"
                v-model="form.barcode"
                type="text"
                placeholder="e.g. 8859123456789"
                :class="{ 'input--error': productStore.fieldErrors?.barcode }"
              />
              <span v-if="productStore.fieldErrors?.barcode" class="form-error-text">
                {{ productStore.fieldErrors.barcode[0] }}
              </span>
            </div>

            <div class="form-group">
              <label class="form-label">Default Reorder Level</label>
              <input
                id="product-reorder"
                v-model="form.default_reorder_level"
                type="number"
                min="0"
                placeholder="5"
              />
            </div>
          </div>

          <div class="grid-2 gap-16">
            <div class="form-group">
              <label class="form-label">Purchase Price ($) *</label>
              <input
                id="product-purchase-price"
                v-model="form.purchase_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="tabular-nums"
                :class="{ 'input--error': productStore.fieldErrors?.purchase_price }"
              />
              <span v-if="productStore.fieldErrors?.purchase_price" class="form-error-text">
                {{ productStore.fieldErrors.purchase_price[0] }}
              </span>
            </div>

            <div class="form-group">
              <label class="form-label">Selling Price ($) *</label>
              <input
                id="product-selling-price"
                v-model="form.selling_price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                class="tabular-nums"
                :class="{ 'input--error': productStore.fieldErrors?.selling_price }"
              />
              <span v-if="productStore.fieldErrors?.selling_price" class="form-error-text">
                {{ productStore.fieldErrors.selling_price[0] }}
              </span>
            </div>
          </div>

          <!-- Profit Margin Gauge Banner -->
          <div
            v-if="form.selling_price && form.purchase_price"
            class="flex items-center justify-between"
            style="padding: 10px 14px; background-color: var(--surface-alt); border-radius: var(--radius-md); border: 1px solid var(--border-color);"
          >
            <span class="text-xs text-muted font-semibold">Estimated Gross Profit:</span>
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
            <label class="form-label">Product Image URL</label>
            <input
              id="product-image"
              v-model="form.image_url"
              type="url"
              placeholder="https://images.unsplash.com/photo-..."
            />
          </div>

          <div class="form-group">
            <label class="form-label">Product Description</label>
            <textarea
              id="product-description"
              v-model="form.description"
              rows="3"
              placeholder="Detailed product descriptions, material specs, or care notes…"
            ></textarea>
          </div>

          <div class="flex items-center gap-12 pt-8" style="border-top: 1px solid var(--border-subtle);">
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.is_active" />
              <span class="toggle-slider"></span>
            </label>
            <div>
              <span class="font-semibold text-sm block">Active in POS & Online Store</span>
              <span class="text-xs text-muted">Toggle availability for sales channels and register scans</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Right: Variant Attributes Selector -->
      <section class="card flex-col gap-16">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-8">
            <div class="icon-badge icon-badge--sm icon-badge--warning">2</div>
            <h2 class="font-bold text-lg">Variant Attributes</h2>
          </div>
          <span class="badge badge--blue tabular-nums">
            {{ attrStore.attributes.length }} Available
          </span>
        </div>

        <p class="text-muted text-sm">
          Select attributes (e.g. Size, Color) and pick specific values to automatically generate Cartesian combinations.
        </p>

        <div v-if="attrStore.loading" class="text-muted" style="padding: 16px 0;">
          <div v-for="i in 3" :key="i" class="skeleton-row"></div>
        </div>

        <div v-else-if="attrStore.attributes.length === 0" class="empty-state" style="padding: 24px 0;">
          <div class="empty-icon" style="font-size: 32px;">🏷️</div>
          <p class="text-muted">No attributes configured in system.</p>
        </div>

        <div v-else class="flex-col gap-16">
          <div
            v-for="attr in attrStore.attributes"
            :key="attr.id"
            class="attr-card"
            :class="{ 'attr-card--selected': isAttrActive(attr.id) }"
          >
            <!-- Attribute Header / Toggle -->
            <div class="flex items-center justify-between">
              <span
                :id="`attr-toggle-${attr.id}`"
                class="tag font-semibold"
                :class="isAttrActive(attr.id) ? 'tag--active' : 'tag--inactive'"
                @click="toggleAttr(attr)"
              >
                {{ isAttrActive(attr.id) ? '✓ ' : '+ ' }} {{ attr.name }}
              </span>

              <span v-if="isAttrActive(attr.id)" class="text-xs font-semibold" style="color: var(--action-primary);">
                {{ selectedAttrs[attr.id]?.size || 0 }} of {{ attr.values.length }} selected
              </span>
            </div>

            <!-- Value Chips -->
            <div v-if="isAttrActive(attr.id)" class="tags" style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
              <span
                v-for="val in attr.values"
                :key="val.id"
                :id="`val-toggle-${val.id}`"
                class="tag"
                :class="isValueActive(attr.id, val.id) ? 'tag--active' : 'tag--inactive'"
                @click="toggleValue(attr.id, val.id)"
              >
                {{ val.value_name }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Step 3: Live Cartesian Matrix Preview Table -->
    <section class="card">
      <div class="flex items-center justify-between mb-16" style="flex-wrap: wrap; gap: 12px;">
        <div class="flex items-center gap-10">
          <div class="icon-badge icon-badge--sm icon-badge--success">3</div>
          <div>
            <h2 class="font-bold text-lg">
              Live Cartesian Variant Matrix Preview
              <span v-if="matrixPreview.length > 0" class="badge badge--blue tabular-nums" style="margin-left: 8px;">
                {{ matrixPreview.length }} Combinations
              </span>
            </h2>
            <p class="text-muted text-xs mt-2">
              Real-time preview of SKU variants that will be generated upon saving.
            </p>
          </div>
        </div>
      </div>

      <div v-if="matrixPreview.length === 0" class="empty-state" style="padding: 36px 0;">
        <div class="empty-icon" style="font-size: 36px;">🧬</div>
        <h4 class="font-semibold text-base mb-4">No attributes selected</h4>
        <p class="text-muted text-sm">
          Select one or more attribute values in Step 2 above to generate Cartesian variant matrix rows.
        </p>
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Generated SKU</th>
              <th>Option Combinations</th>
              <th>Unit Cost</th>
              <th>Selling Price</th>
              <th>Reorder At</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in matrixPreview" :key="row.sku">
              <td>
                <code class="tabular-nums font-semibold" style="font-size: 13px; color: var(--action-primary); background-color: var(--surface-alt); padding: 3px 8px; border-radius: var(--radius-xs); border: 1px solid var(--border-color);">
                  {{ row.sku }}
                </code>
              </td>
              <td>
                <div class="tags">
                  <span v-for="opt in row.combination" :key="opt" class="badge badge--neutral">
                    {{ opt }}
                  </span>
                </div>
              </td>
              <td class="tabular-nums text-muted">{{ fmtMoney(row.purchasePrice) }}</td>
              <td class="tabular-nums font-bold" style="color: var(--action-primary);">{{ fmtMoney(row.sellingPrice) }}</td>
              <td class="tabular-nums text-muted">{{ row.reorderLevel }} units</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Form Submit Action Bar -->
    <div class="flex items-center justify-end gap-12 mt-8">
      <RouterLink to="/products" class="btn btn--ghost">
        Cancel
      </RouterLink>

      <button
        id="btn-create-product"
        class="btn btn--primary btn--lg"
        :disabled="productStore.mutating"
        @click="submit"
      >
        <span v-if="productStore.mutating" class="spinner"></span>
        {{ productStore.mutating ? 'Saving Product & Matrix…' : '✓ Save & Generate Product' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.stepper-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  transition: all var(--transition);
  flex: 1;
}

.step-item:hover {
  background-color: var(--surface-hover);
}

.step-item--active {
  background-color: var(--action-primary-bg);
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background-color: var(--surface-alt);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-item--active .step-num {
  background-color: var(--action-primary);
  border-color: var(--action-primary);
  color: #ffffff;
}

.step-item--done .step-num {
  background-color: var(--status-success);
  border-color: var(--status-success);
  color: #ffffff;
}

.step-info {
  display: flex;
  flex-direction: column;
}

.step-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.step-divider {
  width: 32px;
  height: 1px;
  background-color: var(--border-color);
  flex-shrink: 0;
}

.attr-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
  background-color: var(--surface-base);
  transition: all var(--transition);
}

.attr-card--selected {
  border-color: var(--action-primary-border);
  background-color: #FAFCFF;
}
</style>
