<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useProductStore } from '@/stores/productStore'
import { useToast } from '@/composables/useToast'
import {
  ArrowLeft,
  Package,
  Layers,
  DollarSign,
  TrendingUp,
  Save,
  ScanBarcode,
  Sparkles,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Switch,
  StatCard,
  Card,
  ImageUploader,
} from '@/components/ui'

const route = useRoute()
const toast = useToast()
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

const grossProfit = computed(() => {
  const p = parseFloat(form.value.purchase_price) || 0
  const s = parseFloat(form.value.selling_price) || 0
  return s - p
})

export interface EditVariantRow {
  id: string
  sku: string
  name: string
  barcode: string
  cost_price: number | string
  selling_price: number | string
  quantity_on_hand: number
  reorder_level: number
  is_active: boolean
  attributeValues?: any[]
}

const variantRows = ref<EditVariantRow[]>([])

const activeScanIndex = ref<number | null>(null)
const barcodeInputRefs = ref<Record<number, HTMLInputElement | null>>({})

function setBarcodeInputRef(el: any, index: number) {
  if (el) {
    barcodeInputRefs.value[index] = (el.$el ? el.$el.querySelector('input') || el.$el : el) as HTMLInputElement
  }
}

function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
  } catch {}
}

function focusVariantBarcode(index: number) {
  activeScanIndex.value = index
  setTimeout(() => {
    const input = barcodeInputRefs.value[index] || document.getElementById(`edit-variant-barcode-${index}`) as HTMLInputElement
    if (input) {
      input.focus()
      if (typeof input.select === 'function') input.select()
    }
  }, 10)
}

function handleBarcodeKeyDown(e: KeyboardEvent, index: number) {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    playScanBeep()

    if (e.shiftKey) {
      if (index > 0) {
        focusVariantBarcode(index - 1)
      }
    } else {
      if (index < displayVariants.value.length - 1) {
        focusVariantBarcode(index + 1)
      } else {
        activeScanIndex.value = null
        const btn = document.getElementById('btn-save-product')
        if (btn) btn.focus()
      }
    }
  } else if (e.key === 'ArrowDown') {
    if (index < displayVariants.value.length - 1) {
      e.preventDefault()
      focusVariantBarcode(index + 1)
    }
  } else if (e.key === 'ArrowUp') {
    if (index > 0) {
      e.preventDefault()
      focusVariantBarcode(index - 1)
    }
  }
}

function autoGenerateVariantBarcodes() {
  const timestamp = Date.now().toString().slice(-6)
  variantRows.value.forEach((v, idx) => {
    if (!v.barcode) {
      const seq = String(idx + 1).padStart(3, '0')
      v.barcode = `885${timestamp}${seq}`
    }
  })
}

function clearVariantBarcodes() {
  variantRows.value.forEach(v => {
    v.barcode = ''
  })
}

const duplicateBarcodeVariantIds = computed<Set<string>>(() => {
  const duplicates = new Set<string>()
  const seen = new Map<string, string>()

  for (const v of displayVariants.value) {
    const code = v.barcode?.trim()
    if (!code) continue
    if (seen.has(code)) {
      duplicates.add(v.id)
      duplicates.add(seen.get(code)!)
    } else {
      seen.set(code, v.id)
    }
  }
  return duplicates
})

const grossMarginPercent = computed(() => {
  const s = parseFloat(form.value.selling_price) || 0
  if (s <= 0) return 0
  return Math.round((grossProfit.value / s) * 100)
})

const totalStockOnHand = computed(() => {
  if (variantRows.value.length > 0) {
    return variantRows.value.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
  }
  if (!productStore.selectedProduct?.variants) return 0
  return productStore.selectedProduct.variants.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
})

const totalStockValue = computed(() => {
  if (variantRows.value.length > 0) {
    return variantRows.value.reduce(
      (sum, v) => sum + (v.quantity_on_hand || 0) * (parseFloat(String(v.selling_price)) || 0),
      0
    )
  }
  if (!productStore.selectedProduct?.variants) return 0
  return productStore.selectedProduct.variants.reduce(
    (sum, v) => sum + (v.quantity_on_hand || 0) * (parseFloat(String(v.selling_price)) || 0),
    0
  )
})

const displayVariants = computed<EditVariantRow[]>(() => {
  if (variantRows.value.length > 0) return variantRows.value
  if (!productStore.selectedProduct?.variants) return []
  return productStore.selectedProduct.variants.map(v => ({
    id: v.id,
    sku: v.sku || '',
    name: (v as any).name || '',
    barcode: v.barcode || '',
    cost_price: v.cost_price,
    selling_price: v.selling_price,
    quantity_on_hand: v.quantity_on_hand,
    reorder_level: v.reorder_level,
    is_active: v.is_active ?? true,
    attributeValues: v.attributeValues || v.attribute_values,
  }))
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

      if (prod.variants && Array.isArray(prod.variants)) {
        variantRows.value = prod.variants.map(v => ({
          id: v.id,
          sku: v.sku || '',
          name: (v as any).name || '',
          barcode: v.barcode || '',
          cost_price: v.cost_price,
          selling_price: v.selling_price,
          quantity_on_hand: v.quantity_on_hand,
          reorder_level: v.reorder_level,
          is_active: v.is_active ?? true,
          attributeValues: v.attributeValues || v.attribute_values,
        }))
      }
    }
  } catch {
    // Handled in store
  }
}

async function save() {
  if (!form.value.name.trim()) {
    toast.error('Product name cannot be empty.')
    return
  }

  const pPrice = parseFloat(form.value.purchase_price)
  const sPrice = parseFloat(form.value.selling_price)

  if (isNaN(pPrice) || pPrice < 0) {
    toast.error('Valid purchase price is required.')
    return
  }
  if (isNaN(sPrice) || sPrice <= 0) {
    toast.error('Selling price must be greater than $0.00.')
    return
  }

  const payload: any = {
    name: form.value.name.trim(),
    barcode: form.value.barcode.trim() || null,
    purchase_price: pPrice,
    selling_price: sPrice,
    default_reorder_level: parseInt(form.value.default_reorder_level) || 0,
    image_url: form.value.image_url.trim() || null,
    description: form.value.description.trim() || null,
    is_active: form.value.is_active,
  }

  if (variantRows.value.length > 0) {
    payload.variants = variantRows.value.map(v => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      barcode: v.barcode ? v.barcode.trim() : null,
      selling_price: parseFloat(String(v.selling_price)) || undefined,
      cost_price: parseFloat(String(v.cost_price)) || undefined,
      reorder_level: parseInt(String(v.reorder_level)) || 0,
      is_active: v.is_active,
    }))
  }

  try {
    await productStore.updateProduct(productId, payload)
    toast.success('Product & variants updated successfully!')
  } catch (e: unknown) {
    const msg = productStore.error || (e instanceof Error ? e.message : 'Failed to update product.')
    toast.error(msg)
  }
}

function fmtMoney(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '$0.00'
  const val = typeof num === 'string' ? parseFloat(num) : num
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function stockBadge(qty: number, reorder: number) {
  if (qty === 0) return 'destructive' as const
  if (qty <= reorder) return 'warning' as const
  return 'success' as const
}

function stockLabel(qty: number, reorder: number) {
  if (qty === 0) return 'Out of Stock'
  if (qty <= reorder) return 'Low Stock'
  return 'In Stock'
}

onMounted(() => {
  loadProduct()
})

defineExpose({
  form,
  variantRows,
  displayVariants,
  activeScanIndex,
  duplicateBarcodeVariantIds,
  loadProduct,
  save,
  handleBarcodeKeyDown,
  focusVariantBarcode,
  autoGenerateVariantBarcodes,
  clearVariantBarcodes,
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto w-full">
    <!-- Header & Navigation -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <RouterLink to="/products">
          <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs">
            <ArrowLeft :size="14" />
            <span>Back to Catalog</span>
          </Button>
        </RouterLink>
        <div>
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">
            Edit: {{ productStore.selectedProduct?.name || 'Product' }}
          </h1>
          <span class="text-xs font-mono text-muted-foreground">ID: {{ productId }}</span>
        </div>
      </div>

      <div v-if="productStore.selectedProduct" class="flex items-center gap-2">
        <Badge :variant="form.is_active ? 'success' : 'neutral'" class="text-xs px-2.5 py-1">
          {{ form.is_active ? '● Active in POS' : '○ Inactive' }}
        </Badge>
      </div>
    </div>

    <div v-if="productStore.loading" class="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3">
      <div v-for="i in 4" :key="i" class="h-12 rounded-md bg-muted/50 animate-pulse" />
    </div>

    <template v-else-if="productStore.selectedProduct">
      <!-- KPI Stats Banner for Product -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Active SKUs"
          :value="productStore.selectedProduct.variants?.length || 0"
          sub="Variant matrix combinations"
          :icon="Layers"
          icon-variant="primary"
        />
        <StatCard
          label="Total Stock on Hand"
          :value="totalStockOnHand"
          sub="Across all variations"
          :icon="Package"
          icon-variant="success"
        />
        <StatCard
          label="Retail Valuation"
          :value="fmtMoney(totalStockValue)"
          sub="Total on-shelf inventory"
          :icon="DollarSign"
          icon-variant="warning"
        />
      </div>

      <!-- Edit Form Card -->
      <Card class="p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <h2 class="font-display font-bold text-base text-foreground">Base Product Details & Pricing</h2>
          <span class="text-[11px] text-muted-foreground">Syncs with POS terminal</span>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Product Name *</label>
            <Input
              id="product-edit-name"
              v-model="form.name"
              type="text"
              class="h-9 bg-surface text-sm"
              :error="!!productStore.fieldErrors?.name"
            />
            <span v-if="productStore.fieldErrors?.name" class="text-xs text-destructive mt-1 block">
              {{ productStore.fieldErrors.name[0] }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Master Barcode</label>
              <Input
                id="product-edit-barcode"
                v-model="form.barcode"
                type="text"
                placeholder="e.g. 8859123456789"
                class="h-9 bg-surface text-sm font-mono"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Default Reorder Level</label>
              <Input
                id="product-edit-reorder"
                v-model="form.default_reorder_level"
                type="number"
                min="0"
                class="h-9 bg-surface text-sm font-mono"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Cost Price ($) *</label>
              <Input
                id="product-edit-purchase-price"
                v-model="form.purchase_price"
                type="number"
                step="0.01"
                min="0"
                class="h-9 bg-surface text-sm font-mono"
                :error="!!productStore.fieldErrors?.purchase_price"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Selling Price ($) *</label>
              <Input
                id="product-edit-selling-price"
                v-model="form.selling_price"
                type="number"
                step="0.01"
                min="0.01"
                class="h-9 bg-surface text-sm font-mono"
                :error="!!productStore.fieldErrors?.selling_price"
              />
            </div>
          </div>

          <!-- Profit Margin Gauge Banner -->
          <div
            v-if="form.selling_price && form.purchase_price"
            class="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-surface-subtle/80 text-xs"
          >
            <div class="flex items-center gap-1.5 text-muted-foreground font-medium">
              <TrendingUp :size="14" class="text-primary" />
              <span>Gross Margin:</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold" :class="grossProfit >= 0 ? 'text-success' : 'text-destructive'">
                {{ fmtMoney(grossProfit) }} / unit
              </span>
              <Badge :variant="grossProfit >= 0 ? 'success' : 'destructive'" class="text-[10px] font-mono px-1.5 py-0">
                {{ grossMarginPercent }}% Margin
              </Badge>
            </div>
          </div>

          <div>
            <ImageUploader
              id="product-edit-image"
              v-model="form.image_url"
              label="Product Image"
              folder="products"
              help-text="PNG, JPG, WEBP, or GIF up to 10MB"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Description</label>
            <textarea
              id="product-edit-description"
              v-model="form.description"
              rows="3"
              class="w-full px-3 py-2 text-sm bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            ></textarea>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-border/60">
            <div>
              <span class="text-xs font-semibold text-foreground block">Active in POS & Catalog</span>
              <span class="text-[11px] text-muted-foreground">Inactive products cannot be sold at register checkout</span>
            </div>
            <Switch
              :checked="form.is_active"
              @update:checked="(val) => form.is_active = val"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <RouterLink to="/products">
            <Button variant="outline" size="sm" class="h-9 px-4 text-xs">
              Cancel
            </Button>
          </RouterLink>
          <Button
            id="btn-save-product"
            variant="primary"
            size="sm"
            class="h-9 px-5 text-xs gap-1.5"
            :disabled="productStore.mutating"
            @click="save"
          >
            <span v-if="productStore.mutating" class="animate-spin mr-1">⏳</span>
            <Save v-else :size="14" />
            <span>{{ productStore.mutating ? 'Saving Changes…' : 'Save Changes' }}</span>
          </Button>
        </div>
      </Card>

      <!-- Variants & Live Stock Table -->
      <div class="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div class="p-4 border-b border-border bg-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <span>Variant Inventory Matrix</span>
              <span class="px-2 py-0.5 rounded-md bg-cta-muted text-primary border border-border-strong font-mono text-3xs font-semibold">
                {{ variantRows.length || productStore.selectedProduct.variants?.length || 0 }} SKUs
              </span>
            </h2>
            <p class="text-3xs text-muted-foreground mt-0.5">
              Edit individual barcodes, prices, stock-on-hand, and reorder levels for each variation.
            </p>
          </div>

          <div v-if="variantRows.length > 0" class="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-7.5 px-2.5 text-xs gap-1.5 border-border"
              @click="autoGenerateVariantBarcodes"
            >
              <Sparkles :size="13" class="text-cta" />
              <span>Auto-fill Missing Barcodes</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-7.5 px-2 text-xs text-muted-foreground hover:text-destructive"
              @click="clearVariantBarcodes"
            >
              <span>Clear</span>
            </Button>
          </div>
        </div>

        <div v-if="(!variantRows || variantRows.length === 0) && (!productStore.selectedProduct.variants || productStore.selectedProduct.variants.length === 0)" class="p-8 text-center text-muted-foreground text-xs">
          No variants associated with this product.
        </div>

        <div v-else class="flex flex-col gap-3 p-4">
          <!-- Rapid Scanning Equipment Helper Banner -->
          <div class="flex items-center justify-between p-2.5 px-3 rounded-lg border border-cta/30 bg-cta-muted/60 text-xs text-foreground shadow-2xs">
            <div class="flex items-center gap-2">
              <ScanBarcode class="w-4 h-4 text-primary shrink-0" />
              <span>
                <strong class="text-primary font-bold">⚡ Rapid Scan Auto-Advance Active:</strong> Scan with hardware scanner or press <kbd class="px-1.5 py-0.5 rounded bg-surface border border-border-strong text-foreground font-mono text-[10px] font-bold shadow-2xs">Enter</kbd> to automatically jump to the next variant row.
              </span>
            </div>
            <span class="text-[11px] text-muted-foreground hidden md:inline font-mono">
              <kbd class="px-1 py-0.5 bg-surface rounded border border-border-strong text-foreground text-[10px] font-bold">↑</kbd> <kbd class="px-1 py-0.5 bg-surface rounded border border-border-strong text-foreground text-[10px] font-bold">↓</kbd> or <kbd class="px-1 py-0.5 bg-surface rounded border border-border-strong text-foreground text-[10px] font-bold">Shift+Enter</kbd> to navigate
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left min-w-[900px]">
              <thead class="bg-surface-subtle text-muted-foreground text-xs font-bold border-b border-border">
                <tr>
                  <th class="px-4 py-3 min-w-[180px]">Variant SKU</th>
                  <th class="px-4 py-3 min-w-[240px]">Barcode (Editable) *</th>
                  <th class="px-4 py-3 text-right w-28 font-mono">Cost</th>
                  <th class="px-4 py-3 text-right w-32 font-mono">Selling Price</th>
                  <th class="px-4 py-3 text-right w-36 font-mono">Stock on Hand</th>
                  <th class="px-4 py-3 text-right w-32 font-mono">Reorder Level</th>
                  <th class="px-4 py-3 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/70">
                <tr
                  v-for="(v, idx) in displayVariants"
                  :key="v.id"
                  class="transition-colors duration-150"
                  :class="[
                    activeScanIndex === idx
                      ? 'bg-cta-muted ring-1 ring-cta'
                      : duplicateBarcodeVariantIds.has(v.id)
                        ? 'bg-red-500/15'
                        : 'hover:bg-surface-subtle/50'
                  ]"
                >
                  <td class="px-4 py-2.5 font-mono text-xs font-bold text-foreground whitespace-nowrap">
                    <div class="flex items-center gap-1.5">
                      <span>{{ v.sku }}</span>
                      <span v-if="activeScanIndex === idx" class="px-1.5 py-0.2 rounded bg-cta text-cta-foreground text-[9px] font-sans font-bold">
                        SCANNING
                      </span>
                    </div>
                    <div v-if="v.attributeValues && v.attributeValues.length > 0" class="flex flex-wrap gap-1 mt-1 font-sans font-normal">
                      <span
                        v-for="av in v.attributeValues"
                        :key="av.id || av.value_name"
                        class="px-1.5 py-0.2 rounded bg-surface-subtle border border-border text-[10px] text-muted-foreground"
                      >
                        {{ av.value_name || av.value || av.name }}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2 min-w-[240px]">
                    <div class="relative flex flex-col gap-1">
                      <div class="relative flex items-center">
                        <Input
                          :id="`edit-variant-barcode-${idx}`"
                          :ref="(el) => setBarcodeInputRef(el, idx)"
                          :model-value="v.barcode ?? ''"
                          @update:model-value="(val) => v.barcode = String(val)"
                          @keydown="(e: any) => handleBarcodeKeyDown(e, idx)"
                          @focus="activeScanIndex = idx"
                          @blur="activeScanIndex === idx && (activeScanIndex = null)"
                          type="text"
                          placeholder="Scan / type barcode (Enter ↵)"
                          class="h-8 text-xs font-mono bg-surface pl-2.5 pr-7 w-full border-border/80 focus:border-cta"
                          :class="duplicateBarcodeVariantIds.has(v.id) ? 'border-destructive focus:border-destructive text-destructive font-bold' : (activeScanIndex === idx ? 'border-cta ring-1 ring-cta' : undefined)"
                        />
                        <ScanBarcode :size="14" class="text-muted-foreground/60 absolute right-2 pointer-events-none" />
                      </div>
                      <span v-if="duplicateBarcodeVariantIds.has(v.id)" class="text-[10px] text-destructive font-semibold">
                        ⚠ Duplicate barcode detected
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
                    {{ fmtMoney(v.cost_price) }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono text-xs font-bold text-primary tabular-nums whitespace-nowrap">
                    {{ fmtMoney(v.selling_price) }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                    {{ v.quantity_on_hand }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {{ v.reorder_level }} units
                  </td>
                  <td class="px-4 py-2.5 text-center whitespace-nowrap">
                    <Badge :variant="stockBadge(v.quantity_on_hand, v.reorder_level)" class="text-xs px-2.5 py-0.5 font-semibold">
                      {{ stockLabel(v.quantity_on_hand, v.reorder_level) }}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
