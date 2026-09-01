<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAttributeStore, type Attribute } from '@/stores/attributeStore'
import { useProductStore } from '@/stores/productStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useToast } from '@/composables/useToast'
import {
  ArrowLeft,
  Tag,
  Layers,
  TrendingUp,
  Upload,
  Info,
  ScanBarcode,
  Sparkles,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Switch,
  Card,
} from '@/components/ui'

const router = useRouter()
const toast = useToast()
const attrStore = useAttributeStore()
const productStore = useProductStore()
const categoryStore = useCategoryStore()

const imagePreviewUrl = ref<string>('')

onMounted(() => {
  attrStore.fetchAttributes()
  categoryStore.fetchCategories()
})

function handleImageFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  form.value.image_file = file

  if (file) {
    imagePreviewUrl.value = URL.createObjectURL(file)
  } else {
    imagePreviewUrl.value = ''
  }
}

function removeImage() {
  form.value.image_file = null
  imagePreviewUrl.value = ''
}

// --- Base product form ---
const form = ref({
  product_type: 'SIMPLE' as 'SIMPLE' | 'VARIABLE',
  name: '',
  barcode: '',
  purchase_price: '',
  selling_price: '',
  initial_stock: 0,
  default_reorder_level: '5',
  image_file: null as File | null,
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

// Helper to normalize attribute value name
function getValName(val: string | { id?: string; value_name?: string }): string {
  if (typeof val === 'string') return val
  return val.value_name || val.id || ''
}

// --- Attribute selection ---
const selectedAttrs = ref<Record<string, Set<string>>>({}) // attribute_id -> Set of value strings

function toggleAttr(attr: Attribute) {
  if (selectedAttrs.value[attr.id]) {
    delete selectedAttrs.value[attr.id]
  } else {
    selectedAttrs.value[attr.id] = new Set()
  }
}

function toggleValue(attrId: string, valueName: string) {
  if (!selectedAttrs.value[attrId]) {
    selectedAttrs.value[attrId] = new Set()
  }
  const set = selectedAttrs.value[attrId]
  if (set.has(valueName)) {
    set.delete(valueName)
  } else {
    set.add(valueName)
  }
}

function isAttrActive(attrId: string) {
  return !!selectedAttrs.value[attrId]
}

function isValueActive(attrId: string, valueName: string) {
  return selectedAttrs.value[attrId]?.has(valueName) ?? false
}

// --- Cartesian Matrix Preview & Per-Variant Barcodes ---
interface MatrixItem {
  id: string
  label: string
  attributeId: string
  attributeName: string
}

export interface MatrixRow {
  sku: string
  combination: string[]
  purchasePrice: number
  sellingPrice: number
  reorderLevel: number
  rawCombo: MatrixItem[]
}

const variantBarcodes = ref<Record<string, string>>({})

function getVariantBarcode(sku: string): string {
  return variantBarcodes.value[sku] || ''
}

function setVariantBarcode(sku: string, val: string) {
  variantBarcodes.value[sku] = val
}

function autoGenerateBarcodes() {
  const timestamp = Date.now().toString().slice(-6)
  matrixPreview.value.forEach((row, idx) => {
    if (!variantBarcodes.value[row.sku]) {
      const seq = String(idx + 1).padStart(3, '0')
      variantBarcodes.value[row.sku] = `885${timestamp}${seq}`
    }
  })
}

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
  } catch {
    // Audio feedback is optional enhancement
  }
}

function focusVariantBarcode(index: number) {
  activeScanIndex.value = index
  setTimeout(() => {
    const input = barcodeInputRefs.value[index] || document.getElementById(`variant-barcode-${index}`) as HTMLInputElement
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
      if (index < matrixPreview.value.length - 1) {
        focusVariantBarcode(index + 1)
      } else {
        activeScanIndex.value = null
        const btn = document.getElementById('btn-create-product')
        if (btn) btn.focus()
      }
    }
  } else if (e.key === 'ArrowDown') {
    if (index < matrixPreview.value.length - 1) {
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

function clearVariantBarcodes() {
  variantBarcodes.value = {}
}

const duplicateBarcodeSkus = computed<Set<string>>(() => {
  const duplicates = new Set<string>()
  const seen = new Map<string, string>()

  for (const row of matrixPreview.value) {
    const code = variantBarcodes.value[row.sku]?.trim()
    if (!code) continue
    if (seen.has(code)) {
      duplicates.add(row.sku)
      duplicates.add(seen.get(code)!)
    } else {
      seen.set(code, row.sku)
    }
  }
  return duplicates
})

const matrixPreview = computed<MatrixRow[]>(() => {
  const namePart = form.value.name
    ? form.value.name.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
    : 'PROD'

  const activeAttrEntries = Object.entries(selectedAttrs.value).filter(
    ([, valSet]) => valSet.size > 0
  )

  if (activeAttrEntries.length === 0) return []

  const groups: Array<Array<MatrixItem>> = []
  for (const [attrId, valSet] of activeAttrEntries) {
    const attr = attrStore.attributes.find(a => a.id === attrId)
    if (!attr) continue
    const valItems: MatrixItem[] = [...valSet].map(vStr => {
      const valObj = (attr.values as any[])?.find((v: any) => (typeof v === 'string' ? v : v?.value_name) === vStr)
      const valId = typeof valObj === 'object' && valObj?.id ? valObj.id : vStr
      return {
        id: valId,
        label: vStr,
        attributeId: attr.id,
        attributeName: attr.name,
      }
    })
    groups.push(valItems)
  }

  if (groups.length === 0) return []

  const cartesian = (sets: Array<Array<MatrixItem>>): Array<Array<MatrixItem>> =>
    sets.reduce<Array<Array<MatrixItem>>>(
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
      rawCombo: combo,
    }
  })
})

// --- Submit ---
async function submit() {
  if (!form.value.name.trim()) {
    toast.error('Product name is required.')
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

  const attributes = Object.entries(selectedAttrs.value)
    .filter(([, vals]) => vals.size > 0)
    .map(([attribute_id, vals]) => ({
      attribute_id,
      value_ids: [...vals],
    }))

  const isVariable = form.value.product_type === 'VARIABLE' && matrixPreview.value.length > 0
  let variantsPayload: any[] | undefined = undefined

  if (isVariable) {
    variantsPayload = matrixPreview.value.map(row => ({
      name: row.combination.join(' / '),
      sku: row.sku,
      barcode: variantBarcodes.value[row.sku]?.trim() || null,
      selling_price: sPrice,
      cost_price: pPrice,
      reorder_level: parseInt(form.value.default_reorder_level) || 5,
      quantity_on_hand: form.value.initial_stock || 0,
      attribute_values: row.rawCombo.map(item => ({
        attribute_id: item.attributeId,
        value_name: item.label,
        id: item.id,
      })),
    }))
  }

  // Use FormData when we have an image file to upload
  if (form.value.image_file) {
    const formData = new FormData()
    formData.append('name', form.value.name.trim())
    if (form.value.barcode.trim()) {
      formData.append('barcode', form.value.barcode.trim())
    }
    formData.append('purchase_price', pPrice.toString())
    formData.append('selling_price', sPrice.toString())
    formData.append('default_reorder_level', (parseInt(form.value.default_reorder_level) || 5).toString())
    formData.append('description', form.value.description.trim() || '')
    formData.append('is_active', form.value.is_active ? '1' : '0')
    formData.append('product_type', form.value.product_type)
    formData.append('initial_stock', form.value.initial_stock.toString())
    formData.append('image_file', form.value.image_file)

    if (variantsPayload && variantsPayload.length > 0) {
      formData.append('variants', JSON.stringify(variantsPayload))
    } else if (attributes.length > 0) {
      formData.append('attributes', JSON.stringify(attributes))
    }

    try {
      await productStore.createProduct(formData)
      toast.success('Product created successfully! Redirecting…')
      setTimeout(() => {
        router.push('/products')
      }, 500)
    } catch (e: unknown) {
      const msg = productStore.error || (e instanceof Error ? e.message : 'Failed to create product.')
      toast.error(msg)
    }
  } else {
    // Original JSON payload when no image
    const payload: any = {
      name: form.value.name.trim(),
      barcode: form.value.barcode.trim() || undefined,
      purchase_price: pPrice,
      selling_price: sPrice,
      default_reorder_level: parseInt(form.value.default_reorder_level) || 5,
      description: form.value.description.trim() || undefined,
      is_active: Boolean(form.value.is_active),
      product_type: form.value.product_type,
      initial_stock: form.value.initial_stock,
    }

    if (variantsPayload && variantsPayload.length > 0) {
      payload.variants = variantsPayload
    } else if (attributes.length > 0) {
      payload.attributes = attributes
    }

    try {
      await productStore.createProduct(payload)
      toast.success('Product created successfully! Redirecting…')
      setTimeout(() => {
        router.push('/products')
      }, 500)
    } catch (e: unknown) {
      const msg = productStore.error || (e instanceof Error ? e.message : 'Failed to create product.')
      toast.error(msg)
    }
  }
}

function fmtMoney(num: number): string {
  return `$${num.toFixed(2)}`
}

defineExpose({
  form,
  attrStore,
  matrixPreview,
  variantBarcodes,
  activeScanIndex,
  duplicateBarcodeSkus,
  toggleValue,
  toggleAttr,
  getVariantBarcode,
  setVariantBarcode,
  autoGenerateBarcodes,
  clearVariantBarcodes,
  handleBarcodeKeyDown,
  focusVariantBarcode,
  submit,
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto w-full">
    <!-- Breadcrumb & Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <RouterLink to="/products">
          <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs">
            <ArrowLeft :size="14" />
            <span>Back to Catalog</span>
          </Button>
        </RouterLink>
        <div>
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Create Product Line</h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Configure master pricing, assign variant options, and generate SKU matrices.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Badge v-if="matrixPreview.length > 0" variant="success" class="font-mono text-xs px-2.5 py-1">
          ✓ {{ matrixPreview.length }} SKUs ready
        </Badge>
      </div>
    </div>

    <!-- Step 1 & 2 Grid Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left: Base Product Details Form -->
      <Card class="p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold font-mono">1</div>
            <h2 class="font-display font-bold text-base text-foreground">Base Product Details</h2>
          </div>
          <span class="text-[11px] text-muted-foreground font-medium">* Required</span>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Product Name *</label>
            <Input
              id="product-name"
              v-model="form.name"
              type="text"
              placeholder="Enter product name"
              class="h-9 bg-surface"
              :error="!!productStore.fieldErrors?.name"
            />
            <span v-if="productStore.fieldErrors?.name" class="text-xs text-destructive mt-1 block">
              {{ productStore.fieldErrors.name[0] }}
            </span>
          </div>
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1.5">Product Type *</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                class="flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none"
                :class="form.product_type === 'SIMPLE'
                  ? 'bg-cta-muted border-cta ring-1 ring-cta/30 shadow-2xs'
                  : 'bg-surface border-border hover:border-border-strong hover:bg-surface-subtle'"
              >
                <input
                  type="radio"
                  name="product_type"
                  value="SIMPLE"
                  :checked="form.product_type === 'SIMPLE'"
                  @change="form.product_type = 'SIMPLE'"
                  class="mt-0.5"
                />
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-foreground">Simple Product</span>
                  <span class="text-[11px] text-muted-foreground">Single SKU inventory item</span>
                </div>
              </label>

              <label
                class="flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none"
                :class="form.product_type === 'VARIABLE'
                  ? 'bg-cta-muted border-cta ring-1 ring-cta/30 shadow-2xs'
                  : 'bg-surface border-border hover:border-border-strong hover:bg-surface-subtle'"
              >
                <input
                  type="radio"
                  name="product_type"
                  value="VARIABLE"
                  :checked="form.product_type === 'VARIABLE'"
                  @change="form.product_type = 'VARIABLE'"
                  class="mt-0.5"
                />
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-foreground">Variable Product</span>
                  <span class="text-[11px] text-muted-foreground">Multi-variant matrix (size/color)</span>
                </div>
              </label>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Master Barcode</label>
              <Input
                id="product-barcode"
                v-model="form.barcode"
                type="text"
                placeholder="e.g. 8859123456789"
                class="h-9 bg-surface text-sm font-mono"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Initial Stock</label>
              <Input
                id="product-initial-stock"
                v-model.number="form.initial_stock"
                type="number"
                min="0"
                placeholder="0"
                class="h-9 bg-surface text-sm font-mono"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Cost Price ($) *</label>
              <Input
                id="product-purchase-price"
                v-model="form.purchase_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="h-9 bg-surface text-sm font-mono"
                :error="!!productStore.fieldErrors?.purchase_price"
              />
              <span v-if="productStore.fieldErrors?.purchase_price" class="text-xs text-destructive mt-1 block">
                {{ productStore.fieldErrors.purchase_price[0] }}
              </span>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Selling Price ($) *</label>
              <Input
                id="product-selling-price"
                v-model="form.selling_price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                class="h-9 bg-surface text-sm font-mono"
                :error="!!productStore.fieldErrors?.selling_price"
              />
              <span v-if="productStore.fieldErrors?.selling_price" class="text-xs text-destructive mt-1 block">
                {{ productStore.fieldErrors.selling_price[0] }}
              </span>
            </div>
          </div>

          <!-- Profit Margin Gauge Banner -->
          <div
            v-if="form.selling_price && form.purchase_price"
            class="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-surface-subtle/80 text-xs"
          >
            <div class="flex items-center gap-1.5 text-muted-foreground font-medium">
              <TrendingUp :size="14" class="text-primary" />
              <span>Estimated Profit:</span>
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
            <label class="block text-xs font-semibold text-foreground mb-1">Product Image</label>
            <div class="flex flex-col items-start gap-2">
              <div
                class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-muted-foreground file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
              >
                <Upload :size="14" />
                <input
                  type="file"
                  accept="image/*"
                  @change="handleImageFile"
                  class="file:cursor-pointer w-full cursor-pointer"
                />
              </div>
              <div v-if="form.image_file && imagePreviewUrl" class="flex items-center gap-3 mt-2">
                <img :src="imagePreviewUrl" alt="Product preview" class="w-24 h-20 object-cover rounded border border-border" />
                <span class="text-xs text-muted-foreground truncate max-w-[100px]" title="form.image_file.name">{{ form.image_file.name }}</span>
                <button
                  type="button"
                  @click="removeImage"
                  class="text-xs text-destructive underline hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Description</label>
            <textarea
              id="product-description"
              v-model="form.description"
              rows="3"
              placeholder="Detailed product descriptions, material specs, or care notes…"
              class="w-full px-3 py-2 text-sm bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            ></textarea>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-border/60">
            <div>
              <span class="text-xs font-semibold text-foreground block">Active for Sale</span>
              <span class="text-[11px] text-muted-foreground">Available on POS registers & channels</span>
            </div>
            <Switch
              :checked="form.is_active"
              @update:checked="(val) => form.is_active = val"
            />
          </div>
        </div>
      </Card>

      <!-- Right: Variant Attributes Selector (Visible for all, disabled if SIMPLE) -->
      <Card
        class="p-5 flex flex-col gap-4 bg-card border-border shadow-2xs rounded-xl transition-all"
        :class="form.product_type === 'SIMPLE' ? 'opacity-55 select-none bg-surface-subtle/40' : ''"
      >
        <div class="flex items-center justify-between pb-2 border-b border-border">
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold font-mono transition-colors"
              :class="form.product_type === 'SIMPLE'
                ? 'bg-muted text-muted-foreground border border-border'
                : 'bg-cta-muted text-primary border border-border-strong'"
            >
              2
            </div>
            <h2 class="font-display font-bold text-sm text-foreground">Variant Attributes</h2>
          </div>
          <span
            class="px-2 py-0.5 rounded-md font-mono text-3xs font-semibold"
            :class="form.product_type === 'SIMPLE'
              ? 'bg-muted text-muted-foreground border border-border'
              : 'bg-cta-muted text-primary border border-border-strong'"
          >
            {{ form.product_type === 'SIMPLE' ? 'Disabled (Simple Product)' : `${attrStore.attributes.length} Available` }}
          </span>
        </div>

        <div
          v-if="form.product_type === 'SIMPLE'"
          class="p-3 rounded-lg bg-surface-subtle border border-border text-xs text-muted-foreground flex items-center gap-2"
        >
          <Info :size="15" class="text-primary shrink-0" />
          <span>This product is configured as <strong>Simple</strong>. Switch <strong>Product Type</strong> to <strong>Variable</strong> to enable variant attributes and SKU matrix generation.</span>
        </div>
        <p v-else class="text-xs text-muted-foreground leading-relaxed">
          Select attributes (e.g. Size, Color) and click specific value chips to automatically generate Cartesian variant combinations.
        </p>

        <div v-if="attrStore.loading" class="py-6 space-y-2">
          <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-surface-subtle animate-pulse" />
        </div>

        <div v-else-if="attrStore.attributes.length === 0" class="py-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <Tag :size="28" class="text-muted-foreground/50 stroke-1" />
          <span>No attributes defined in system yet.</span>
        </div>

        <div v-else class="flex flex-col gap-3" :class="form.product_type === 'SIMPLE' ? 'pointer-events-none' : ''">
          <div
            v-for="attr in attrStore.attributes"
            :key="attr.id"
            class="p-3.5 rounded-xl border transition-all"
            :class="isAttrActive(attr.id) ? 'border-cta/50 bg-surface-subtle/80' : 'border-border bg-card hover:border-border-strong'"
          >
            <!-- Attribute Header / Toggle -->
            <div class="flex items-center justify-between">
              <button
                type="button"
                :id="`attr-toggle-${attr.id}`"
                :disabled="form.product_type === 'SIMPLE'"
                class="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1 transition-all"
                :class="[
                  form.product_type === 'SIMPLE'
                    ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                    : isAttrActive(attr.id)
                      ? 'bg-cta text-cta-foreground shadow-2xs cursor-pointer'
                      : 'bg-surface-subtle border border-border text-muted-foreground hover:text-foreground hover:bg-card cursor-pointer'
                ]"
                @click="form.product_type === 'VARIABLE' && toggleAttr(attr)"
              >
                <span>{{ isAttrActive(attr.id) ? '✓' : '+' }}</span>
                <span>{{ attr.name }}</span>
              </button>

              <span v-if="isAttrActive(attr.id)" class="text-3xs font-mono font-bold text-primary">
                {{ selectedAttrs[attr.id]?.size || 0 }} of {{ attr.values.length }} selected
              </span>
            </div>

            <!-- Value Chips -->
            <div v-if="isAttrActive(attr.id)" class="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-dashed border-border">
              <button
                type="button"
                v-for="val in attr.values"
                :key="getValName(val)"
                :id="`val-toggle-${getValName(val)}`"
                :disabled="form.product_type === 'SIMPLE'"
                class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                :class="[
                  form.product_type === 'SIMPLE'
                    ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                    : isValueActive(attr.id, getValName(val))
                      ? 'bg-cta text-cta-foreground font-bold shadow-2xs cursor-pointer'
                      : 'bg-card border border-border text-muted-foreground hover:border-cta hover:text-foreground cursor-pointer'
                ]"
                @click="form.product_type === 'VARIABLE' && toggleValue(attr.id, getValName(val))"
              >
                {{ getValName(val) }}
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Step 3: Live Cartesian Matrix Preview Table -->
    <Card class="p-5 flex flex-col gap-4 bg-card border-border shadow-2xs rounded-xl">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-border gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-xs font-bold font-mono">3</div>
          <div>
            <h2 class="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <span>Live Cartesian Variant Matrix Preview</span>
              <span v-if="matrixPreview.length > 0" class="px-2 py-0.5 rounded-md bg-cta-muted text-primary border border-border-strong font-mono text-3xs font-semibold">
                {{ matrixPreview.length }} SKUs
              </span>
            </h2>
            <p class="text-3xs text-muted-foreground mt-0.5">
              Assign individual barcodes, stock levels, and review SKU combinations before saving.
            </p>
          </div>
        </div>

        <div v-if="matrixPreview.length > 0 && form.product_type === 'VARIABLE'" class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-7.5 px-2.5 text-xs gap-1.5 border-border"
            @click="autoGenerateBarcodes"
          >
            <Sparkles :size="13" class="text-cta" />
            <span>Auto-fill Barcodes</span>
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

      <div v-if="matrixPreview.length === 0" class="py-10 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
        <Layers :size="32" class="text-muted-foreground/50 stroke-1" />
        <span class="font-semibold text-foreground text-sm">
          {{ form.product_type === 'SIMPLE' ? 'Simple Product Mode' : 'No attributes selected' }}
        </span>
        <span class="text-muted-foreground">
          {{ form.product_type === 'SIMPLE'
            ? 'A single master SKU will be generated. Switch Product Type to Variable above to generate Cartesian variant combinations.'
            : 'Select one or more attribute values in Variant Attributes above to generate SKU combinations.'
          }}
        </span>
      </div>

      <div v-else class="flex flex-col gap-3">
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
                <th class="px-4 py-3 min-w-[170px]">Generated SKU</th>
                <th class="px-4 py-3 min-w-[220px]">Option Combinations</th>
                <th class="px-4 py-3 min-w-[240px]">Variant Barcode *</th>
                <th class="px-4 py-3 text-right w-28 font-mono">Cost</th>
                <th class="px-4 py-3 text-right w-32 font-mono">Selling Price</th>
                <th class="px-4 py-3 text-right w-32 font-mono">Reorder Level</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/70">
              <tr
                v-for="(row, idx) in matrixPreview"
                :key="row.sku"
                class="transition-colors duration-150"
                :class="[
                  activeScanIndex === idx
                    ? 'bg-cta-muted ring-1 ring-cta'
                    : duplicateBarcodeSkus.has(row.sku)
                      ? 'bg-red-500/15'
                      : 'hover:bg-surface-subtle/50'
                ]"
              >
                <td class="px-4 py-2.5 font-mono text-xs font-bold text-foreground whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <span>{{ row.sku }}</span>
                    <span v-if="activeScanIndex === idx" class="px-1.5 py-0.2 rounded bg-cta text-cta-foreground text-[9px] font-sans font-bold">
                      SCANNING
                    </span>
                  </div>
                </td>
                <td class="px-4 py-2.5 min-w-[220px]">
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="opt in row.combination"
                      :key="opt"
                      class="px-2.5 py-0.5 rounded-md bg-surface-subtle border border-border text-xs font-semibold text-foreground"
                    >
                      {{ opt }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-2 min-w-[240px]">
                  <div class="relative flex flex-col gap-1">
                    <div class="relative flex items-center">
                      <Input
                        :id="`variant-barcode-${idx}`"
                        :ref="(el) => setBarcodeInputRef(el, idx)"
                        :model-value="getVariantBarcode(row.sku)"
                        @update:model-value="(val) => setVariantBarcode(row.sku, String(val))"
                        @keydown="(e: any) => handleBarcodeKeyDown(e, idx)"
                        @focus="activeScanIndex = idx"
                        @blur="activeScanIndex === idx && (activeScanIndex = null)"
                        placeholder="Scan / type barcode (Enter ↵)"
                        class="h-8 text-xs font-mono bg-surface pl-2.5 pr-7 w-full border-border/80 focus:border-cta"
                        :class="duplicateBarcodeSkus.has(row.sku) ? 'border-destructive focus:border-destructive text-destructive font-bold' : (activeScanIndex === idx ? 'border-cta ring-1 ring-cta' : undefined)"
                      />
                      <ScanBarcode :size="14" class="text-muted-foreground/60 absolute right-2 pointer-events-none" />
                    </div>
                    <span v-if="duplicateBarcodeSkus.has(row.sku)" class="text-[10px] text-destructive font-semibold">
                      ⚠ Duplicate barcode detected
                    </span>
                  </div>
                </td>
                <td class="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
                  {{ fmtMoney(row.purchasePrice) }}
                </td>
                <td class="px-4 py-2.5 text-right font-mono text-xs font-bold text-primary tabular-nums whitespace-nowrap">
                  {{ fmtMoney(row.sellingPrice) }}
                </td>
                <td class="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {{ row.reorderLevel }} units
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>

    <!-- Submit Action Bar -->
    <div class="flex items-center justify-end gap-3 pb-8">
      <RouterLink to="/products">
        <Button variant="outline" size="sm" class="h-8.5 px-4 text-xs font-bold border-border text-foreground hover:bg-surface-subtle">
          Cancel
        </Button>
      </RouterLink>

      <Button
        id="btn-create-product"
        variant="primary"
        size="sm"
        class="h-8.5 px-5 text-xs gap-1.5 font-bold shadow-2xs cursor-pointer text-white"
        :disabled="productStore.mutating"
        @click="submit"
      >
        <span v-if="productStore.mutating" class="animate-spin mr-1">⏳</span>
        <span>{{ productStore.mutating ? 'Saving Product…' : '✓ Save Product Line' }}</span>
      </Button>
    </div>
  </div>
</template>
