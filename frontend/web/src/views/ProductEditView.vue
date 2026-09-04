<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useProductStore } from '@/stores/productStore'
import { useAttributeStore, type Attribute } from '@/stores/attributeStore'
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
  Plus,
  Trash2,
  Tag,
  Info,
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
const attrStore = useAttributeStore()

const productId = route.params.id as string

const form = ref({
  product_type: 'SIMPLE' as 'SIMPLE' | 'VARIABLE',
  name: '',
  sku: '',
  barcode: '',
  purchase_price: '',
  selling_price: '',
  stock: 0,
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

const grossMarginPercent = computed(() => {
  const s = parseFloat(form.value.selling_price) || 0
  if (s <= 0) return 0
  return Math.round((grossProfit.value / s) * 100)
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
      if (index < variantRows.value.length - 1) {
        focusVariantBarcode(index + 1)
      } else {
        activeScanIndex.value = null
        const btn = document.getElementById('btn-save-product')
        if (btn) btn.focus()
      }
    }
  } else if (e.key === 'ArrowDown') {
    if (index < variantRows.value.length - 1) {
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

  for (const v of variantRows.value) {
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

const totalStockOnHand = computed(() => {
  if (form.value.product_type === 'SIMPLE') {
    return Number(form.value.stock) || 0
  }
  return variantRows.value.reduce((sum, v) => sum + (Number(v.quantity_on_hand) || 0), 0)
})

const totalStockValue = computed(() => {
  if (form.value.product_type === 'SIMPLE') {
    const s = parseFloat(form.value.selling_price) || 0
    return (Number(form.value.stock) || 0) * s
  }
  return variantRows.value.reduce(
    (sum, v) => sum + (Number(v.quantity_on_hand) || 0) * (parseFloat(String(v.selling_price)) || 0),
    0
  )
})

// Helper to normalize attribute value name
function getValName(val: string | { id?: string; value_name?: string }): string {
  if (typeof val === 'string') return val
  return val.value_name || val.id || ''
}

// --- Attribute Selection & Combination Generation ---
const selectedAttrs = ref<Record<string, Set<string>>>({})

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

function rehydrateExistingAttributes(variants: any[]) {
  selectedAttrs.value = {}
  if (!variants || !Array.isArray(variants)) return

  variants.forEach(v => {
    const avs = v.attribute_values || v.attributeValues || []
    avs.forEach((av: any) => {
      const attrId = av.attribute?.id || av.attribute_id
      const valName = av.value_name || av.value || ''
      if (attrId && valName) {
        if (!selectedAttrs.value[attrId]) {
          selectedAttrs.value[attrId] = new Set()
        }
        selectedAttrs.value[attrId].add(valName)
      }
    })
  })
}

function generateVariantsFromAttributes() {
  const activeEntries = Object.entries(selectedAttrs.value).filter(([, vals]) => vals.size > 0)
  if (activeEntries.length === 0) {
    toast.error('Please select at least one attribute and value option.')
    return
  }

  const groups: Array<Array<{ label: string; attrId: string; attrName: string; id: string }>> = []
  for (const [attrId, valSet] of activeEntries) {
    const attr = attrStore.attributes.find(a => a.id === attrId)
    if (!attr) continue
    const valItems = [...valSet].map(vStr => {
      const valObj = (attr.values as any[])?.find((v: any) => (typeof v === 'string' ? v : v?.value_name) === vStr)
      return {
        id: typeof valObj === 'object' && valObj?.id ? valObj.id : vStr,
        label: vStr,
        attrId: attr.id,
        attrName: attr.name,
      }
    })
    groups.push(valItems)
  }

  if (groups.length === 0) return

  const cartesian = (sets: any[][]): any[][] =>
    sets.reduce((acc, set) => acc.flatMap(combo => set.map(item => [...combo, item])), [[]])

  const combos = cartesian(groups)
  const pPrice = parseFloat(form.value.purchase_price) || 0
  const sPrice = parseFloat(form.value.selling_price) || 0
  const reorder = parseInt(form.value.default_reorder_level) || 5
  const namePart = (form.value.name || 'SKU').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10)

  const newRows: EditVariantRow[] = combos.map((combo: any[], idx) => {
    const comboNames = combo.map((c: any) => c.label)
    const varName = comboNames.join(' / ')
    const slug = comboNames.map((n: string) => n.toUpperCase().replace(/\s+/g, '-')).join('-')

    // Preserve existing variant if already matched by name
    const existing = variantRows.value.find(v => v.name.toLowerCase() === varName.toLowerCase())
    if (existing) {
      return existing
    }

    return {
      id: `new-${Date.now()}-${idx}`,
      sku: `${namePart}-${slug}`,
      name: varName,
      barcode: '',
      cost_price: pPrice,
      selling_price: sPrice,
      quantity_on_hand: 0,
      reorder_level: reorder,
      is_active: true,
      attributeValues: combo.map((c: any) => ({
        id: c.id,
        value_name: c.label,
        attribute: { id: c.attrId, name: c.attrName }
      })),
    }
  })

  variantRows.value = newRows
  toast.success(`Generated ${newRows.length} variant combination(s).`)
}

function addManualVariant() {
  const pPrice = parseFloat(form.value.purchase_price) || 0
  const sPrice = parseFloat(form.value.selling_price) || 0
  const reorder = parseInt(form.value.default_reorder_level) || 5
  const idx = variantRows.value.length + 1
  const namePart = (form.value.name || 'SKU').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10)

  variantRows.value.push({
    id: `new-${Date.now()}-${idx}`,
    sku: `${namePart}-VAR-${idx}`,
    name: `Variation ${idx}`,
    barcode: '',
    cost_price: pPrice,
    selling_price: sPrice,
    quantity_on_hand: 0,
    reorder_level: reorder,
    is_active: true,
    attributeValues: [],
  })
}

function removeVariantRow(index: number) {
  if (variantRows.value.length <= 1) {
    toast.error('Variable products must have at least one variation.')
    return
  }
  variantRows.value.splice(index, 1)
}

function onSwitchProductType(type: 'SIMPLE' | 'VARIABLE') {
  if (form.value.product_type === type) return

  if (type === 'SIMPLE' && variantRows.value.length > 1) {
    toast.info('Switching to Simple Product will consolidate variations into a single inventory SKU upon saving.')
  }

  form.value.product_type = type

  if (type === 'VARIABLE' && variantRows.value.length === 0) {
    const pPrice = parseFloat(form.value.purchase_price) || 0
    const sPrice = parseFloat(form.value.selling_price) || 0
    const reorder = parseInt(form.value.default_reorder_level) || 5
    const namePart = (form.value.name || 'SKU').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10)

    variantRows.value = [{
      id: `new-${Date.now()}-1`,
      sku: form.value.sku || `${namePart}-STD`,
      name: 'Standard',
      barcode: form.value.barcode || '',
      cost_price: pPrice,
      selling_price: sPrice,
      quantity_on_hand: Number(form.value.stock) || 0,
      reorder_level: reorder,
      is_active: true,
      attributeValues: [],
    }]
  }
}

async function loadProduct() {
  try {
    const prod = await productStore.fetchProduct(productId)
    if (prod) {
      const isVar = (prod.variants && prod.variants.length > 1) ||
        Boolean(prod.variants?.[0]?.attribute_values?.length) ||
        Boolean(prod.variants?.[0]?.attributeValues?.length)

      const firstVar = prod.variants?.[0]

      form.value = {
        product_type: isVar ? 'VARIABLE' : 'SIMPLE',
        name: prod.name || '',
        sku: (prod as any).sku || firstVar?.sku || '',
        barcode: prod.barcode || firstVar?.barcode || '',
        purchase_price: prod.purchase_price !== undefined ? String(prod.purchase_price) : '',
        selling_price: prod.selling_price !== undefined ? String(prod.selling_price) : '',
        stock: firstVar?.quantity_on_hand ?? 0,
        default_reorder_level: prod.default_reorder_level !== undefined ? String(prod.default_reorder_level) : '5',
        image_url: prod.image_url || '',
        description: prod.description || '',
        is_active: prod.is_active ?? true,
      }

      if (prod.variants && Array.isArray(prod.variants)) {
        variantRows.value = prod.variants.map(v => ({
          id: v.id,
          sku: v.sku || '',
          name: (v as any).name || 'Standard',
          barcode: v.barcode || '',
          cost_price: v.cost_price,
          selling_price: v.selling_price,
          quantity_on_hand: v.quantity_on_hand,
          reorder_level: v.reorder_level,
          is_active: v.is_active ?? true,
          attributeValues: v.attributeValues || v.attribute_values || [],
        }))

        if (isVar) {
          rehydrateExistingAttributes(prod.variants)
        }
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
    sku: form.value.sku.trim() || null,
    purchase_price: pPrice,
    selling_price: sPrice,
    default_reorder_level: parseInt(form.value.default_reorder_level) || 0,
    image_url: form.value.image_url.trim() || null,
    description: form.value.description.trim() || null,
    is_active: form.value.is_active,
    product_type: form.value.product_type,
  }

  if (form.value.product_type === 'SIMPLE') {
    const simpleQty = parseInt(String(form.value.stock)) || 0
    payload.quantity_on_hand = simpleQty
    payload.stock = simpleQty
    payload.simple_stock = simpleQty

    const baseVariantId = productStore.selectedProduct?.variants?.[0]?.id
    payload.variants = [{
      id: baseVariantId,
      name: 'Standard',
      sku: form.value.sku.trim() || (productStore.selectedProduct as any)?.sku || `SKU-${Date.now()}`,
      barcode: form.value.barcode.trim() || null,
      selling_price: sPrice,
      cost_price: pPrice,
      quantity_on_hand: simpleQty,
      reorder_level: parseInt(form.value.default_reorder_level) || 5,
      is_active: form.value.is_active,
      attribute_values: [],
    }]
  } else {
    // Variable Product
    if (variantRows.value.length === 0) {
      toast.error('Please add or generate at least one variation for this product.')
      return
    }

    payload.variants = variantRows.value.map(v => ({
      id: v.id && !v.id.startsWith('new-') ? v.id : undefined,
      sku: v.sku,
      name: v.name,
      barcode: v.barcode ? v.barcode.trim() : null,
      selling_price: parseFloat(String(v.selling_price)) || sPrice,
      cost_price: parseFloat(String(v.cost_price)) || pPrice,
      quantity_on_hand: parseInt(String(v.quantity_on_hand)) || 0,
      reorder_level: parseInt(String(v.reorder_level)) || 5,
      is_active: v.is_active,
      attribute_values: v.attributeValues || [],
    }))
  }

  try {
    await productStore.updateProduct(productId, payload)
    toast.success('Product & variations saved successfully!')
    await loadProduct()
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
  attrStore.fetchAttributes()
  loadProduct()
})

defineExpose({
  form,
  variantRows,
  activeScanIndex,
  duplicateBarcodeVariantIds,
  loadProduct,
  save,
  handleBarcodeKeyDown,
  focusVariantBarcode,
  autoGenerateVariantBarcodes,
  clearVariantBarcodes,
  onSwitchProductType,
  generateVariantsFromAttributes,
  addManualVariant,
  removeVariantRow,
  selectedAttrs,
  toggleAttr,
  toggleValue,
  isAttrActive,
  isValueActive,
  getValName,
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
        <Badge :variant="form.product_type === 'VARIABLE' ? 'purple' : 'neutral'" class="text-xs px-2.5 py-1">
          {{ form.product_type === 'VARIABLE' ? 'Variable Product' : 'Simple Product' }}
        </Badge>
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
          label="Product Structure"
          :value="form.product_type === 'VARIABLE' ? `${variantRows.length} Variations` : 'Single SKU'"
          :sub="form.product_type === 'VARIABLE' ? 'Multi-variant matrix' : 'Simple inventory item'"
          :icon="Layers"
          icon-variant="primary"
        />
        <StatCard
          label="Total Stock on Hand"
          :value="totalStockOnHand"
          sub="Available in inventory"
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

      <!-- Step 1 & 2 Grid Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Edit Form Card -->
        <Card class="p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <h2 class="font-display font-bold text-base text-foreground">Base Product Details & Structure</h2>
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

          <!-- Product Type Selector (Simple vs Variable) -->
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1.5">Product Type *</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                class="flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none"
                :class="form.product_type === 'SIMPLE'
                  ? 'bg-cta-muted border-cta ring-1 ring-cta/30 shadow-2xs'
                  : 'bg-surface border-border hover:border-border-strong hover:bg-surface-subtle'"
                @click="onSwitchProductType('SIMPLE')"
              >
                <input
                  type="radio"
                  name="product_type"
                  value="SIMPLE"
                  :checked="form.product_type === 'SIMPLE'"
                  class="mt-0.5"
                  @click.stop
                  @change="onSwitchProductType('SIMPLE')"
                />
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package :size="13" class="text-primary" />
                    <span>Simple Product</span>
                  </span>
                  <span class="text-[11px] text-muted-foreground mt-0.5">Single SKU inventory item (one barcode & price)</span>
                </div>
              </div>

              <div
                class="flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none"
                :class="form.product_type === 'VARIABLE'
                  ? 'bg-cta-muted border-cta ring-1 ring-cta/30 shadow-2xs'
                  : 'bg-surface border-border hover:border-border-strong hover:bg-surface-subtle'"
                @click="onSwitchProductType('VARIABLE')"
              >
                <input
                  type="radio"
                  name="product_type"
                  value="VARIABLE"
                  :checked="form.product_type === 'VARIABLE'"
                  class="mt-0.5"
                  @click.stop
                  @change="onSwitchProductType('VARIABLE')"
                />
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers :size="13" class="text-primary" />
                    <span>Variable Product</span>
                  </span>
                  <span class="text-[11px] text-muted-foreground mt-0.5">Multi-variant matrix (Color, Size, Options)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SIMPLE PRODUCT SPECIFIC FIELDS -->
          <div v-if="form.product_type === 'SIMPLE'" class="p-3.5 rounded-xl border border-border bg-surface-subtle/70 flex flex-col gap-3">
            <h3 class="font-bold text-xs text-foreground flex items-center gap-1.5">
              <Package :size="14" class="text-primary" />
              <span>Simple Inventory Details</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1 whitespace-nowrap truncate" title="Barcode / UPC">Barcode / UPC</label>
                <Input
                  id="product-edit-barcode"
                  v-model="form.barcode"
                  type="text"
                  placeholder="e.g. 8859123456789"
                  class="h-9 bg-surface text-sm font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-foreground mb-1 whitespace-nowrap truncate" title="Store SKU">Store SKU</label>
                <Input
                  id="product-edit-sku"
                  v-model="form.sku"
                  type="text"
                  placeholder="e.g. CHG-ANK-01"
                  class="h-9 bg-surface text-sm font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-foreground mb-1 whitespace-nowrap truncate" title="Stock on Hand">Stock on Hand</label>
                <Input
                  id="product-edit-stock"
                  v-model="form.stock"
                  type="number"
                  min="0"
                  class="h-9 bg-surface text-sm font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <!-- Right: Variant Attributes Selector (Visible for all, disabled if SIMPLE) -->
        <Card
          class="p-5 flex flex-col gap-4 bg-card border-border shadow-2xs rounded-xl transition-all"
          :class="form.product_type === 'SIMPLE' ? 'opacity-55 select-none bg-surface-subtle/40' : ''"
        >
          <div class="flex items-center justify-between pb-2 border-b border-border">
            <div class="flex items-center gap-2">
              <Tag :size="16" class="text-primary" />
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
            class="p-3.5 rounded-lg bg-surface-subtle border border-border text-xs text-muted-foreground flex items-center gap-2.5"
          >
            <Info :size="16" class="text-primary shrink-0" />
            <span>This product is currently configured as a <strong>Simple Product</strong>. Switch <strong>Product Type</strong> on the left to <strong>Variable Product</strong> to enable multi-variant attribute matrix generation.</span>
          </div>

          <div v-else class="flex flex-col gap-4">
            <p class="text-xs text-muted-foreground leading-relaxed">
              Select attributes (e.g. Size, Color) and click specific value chips to automatically generate Cartesian variant combinations, or add custom variations manually below.
            </p>

            <div v-if="attrStore.loading" class="py-6 space-y-2">
              <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-surface-subtle animate-pulse" />
            </div>

            <div v-else-if="attrStore.attributes.length === 0" class="py-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
              <Tag :size="28" class="text-muted-foreground/50 stroke-1" />
              <span>No attributes defined in system yet.</span>
            </div>

            <div v-else class="flex flex-col gap-3">
              <div
                v-for="attr in attrStore.attributes"
                :key="attr.id"
                class="p-3 rounded-xl border transition-all"
                :class="isAttrActive(attr.id) ? 'border-cta/50 bg-surface-subtle/80' : 'border-border bg-card hover:border-border-strong'"
              >
                <!-- Attribute Header / Toggle -->
                <div class="flex items-center justify-between">
                  <button
                    type="button"
                    :id="`attr-toggle-${attr.id}`"
                    class="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                    :class="isAttrActive(attr.id)
                      ? 'bg-cta text-cta-foreground shadow-2xs'
                      : 'bg-surface-subtle border border-border text-muted-foreground hover:text-foreground hover:bg-card'"
                    @click="toggleAttr(attr)"
                  >
                    <span>{{ isAttrActive(attr.id) ? '✓' : '+' }}</span>
                    <span>{{ attr.name }}</span>
                  </button>

                  <span v-if="isAttrActive(attr.id)" class="text-3xs font-mono font-bold text-primary">
                    {{ selectedAttrs[attr.id]?.size || 0 }} of {{ attr.values.length }} selected
                  </span>
                </div>

                <!-- Value Chips -->
                <div v-if="isAttrActive(attr.id)" class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-dashed border-border">
                  <button
                    type="button"
                    v-for="val in attr.values"
                    :key="getValName(val)"
                    :id="`val-toggle-${getValName(val)}`"
                    class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    :class="isValueActive(attr.id, getValName(val))
                      ? 'bg-cta text-cta-foreground font-bold shadow-2xs'
                      : 'bg-card border border-border text-muted-foreground hover:border-cta hover:text-foreground'"
                    @click="toggleValue(attr.id, getValName(val))"
                  >
                    {{ getValName(val) }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Action Buttons: Generate & Add Manual -->
            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8.5 px-3 text-xs gap-1.5 border-cta/40 hover:bg-cta-muted"
                @click="generateVariantsFromAttributes"
              >
                <Sparkles :size="13" class="text-cta" />
                <span>Generate / Update from Attributes</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8.5 px-3 text-xs gap-1.5"
                @click="addManualVariant"
              >
                <Plus :size="13" />
                <span>+ Add Custom Variation</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <!-- Variable Product Variant Inventory Matrix -->
      <div v-if="form.product_type === 'VARIABLE'" class="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div class="p-4 border-b border-border bg-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <span>Variant Inventory Matrix</span>
              <span class="px-2 py-0.5 rounded-md bg-cta-muted text-primary border border-border-strong font-mono text-3xs font-semibold">
                {{ variantRows.length }} SKUs
              </span>
            </h2>
            <p class="text-3xs text-muted-foreground mt-0.5">
              Edit individual barcodes, prices, stock-on-hand, and reorder levels for each variation.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-7.5 px-2.5 text-xs gap-1.5 border-border"
              @click="addManualVariant"
            >
              <Plus :size="13" />
              <span>Add Variation</span>
            </Button>
            <Button
              v-if="variantRows.length > 0"
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
              v-if="variantRows.length > 0"
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

        <div v-if="variantRows.length === 0" class="p-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <Layers :size="32" class="text-muted-foreground/40" />
          <span>No variants defined. Select attributes above and click "Generate / Update from Attributes", or click "+ Add Variation".</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="mt-2 text-xs h-8"
            @click="addManualVariant"
          >
            <Plus :size="13" class="mr-1" /> Add First Variation
          </Button>
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
            <table class="w-full text-xs text-left min-w-[960px]">
              <thead class="bg-surface-subtle text-muted-foreground text-xs font-bold border-b border-border">
                <tr>
                  <th class="px-3 py-3 min-w-[170px]">Variant Details</th>
                  <th class="px-3 py-3 min-w-[180px]">Variant SKU</th>
                  <th class="px-3 py-3 min-w-[220px]">Barcode (Editable) *</th>
                  <th class="px-3 py-3 text-right w-28 font-mono">Cost ($)</th>
                  <th class="px-3 py-3 text-right w-28 font-mono">Selling Price ($)</th>
                  <th class="px-3 py-3 text-right w-24 font-mono">Stock</th>
                  <th class="px-3 py-3 text-right w-24 font-mono">Reorder</th>
                  <th class="px-3 py-3 text-center w-24">Status</th>
                  <th class="px-3 py-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/70">
                <tr
                  v-for="(v, idx) in variantRows"
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
                  <td class="px-3 py-2.5">
                    <div class="font-semibold text-foreground text-xs">
                      <input
                        v-model="v.name"
                        type="text"
                        placeholder="Variant name"
                        class="h-7 text-xs bg-transparent border-0 border-b border-transparent hover:border-border focus:border-cta focus:outline-none w-full font-medium"
                      />
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
                  <td class="px-3 py-2.5 font-mono text-xs">
                    <Input
                      v-model="v.sku"
                      type="text"
                      placeholder="SKU"
                      class="h-7 text-xs font-mono bg-surface border-border/80 w-full"
                    />
                  </td>
                  <td class="px-3 py-2 min-w-[220px]">
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
                  <td class="px-3 py-2 text-right">
                    <Input
                      v-model="v.cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      class="h-7 text-xs font-mono text-right w-24 bg-surface"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <Input
                      v-model="v.selling_price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      class="h-7 text-xs font-mono font-bold text-primary text-right w-24 bg-surface"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <Input
                      v-model="v.quantity_on_hand"
                      type="number"
                      min="0"
                      class="h-7 text-xs font-mono font-bold text-foreground text-right w-20 bg-surface"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <Input
                      v-model="v.reorder_level"
                      type="number"
                      min="0"
                      class="h-7 text-xs font-mono text-muted-foreground text-right w-20 bg-surface"
                    />
                  </td>
                  <td class="px-3 py-2.5 text-center whitespace-nowrap">
                    <Badge :variant="stockBadge(Number(v.quantity_on_hand) || 0, Number(v.reorder_level) || 0)" class="text-xs px-2 py-0.5 font-semibold">
                      {{ stockLabel(Number(v.quantity_on_hand) || 0, Number(v.reorder_level) || 0) }}
                    </Badge>
                  </td>
                  <td class="px-3 py-2.5 text-center whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete variation"
                      @click="removeVariantRow(idx)"
                    >
                      <Trash2 :size="13" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Simple Product Information Banner -->
      <div
        v-else
        class="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      >
        <div class="flex items-center gap-2.5 text-muted-foreground">
          <Package :size="18" class="text-primary shrink-0" />
          <span>This product is managed as a <strong>Simple Product</strong> with a single SKU. Inventory counts, pricing, and barcodes are configured in the form above.</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-7.5 px-3 text-xs gap-1.5 shrink-0"
          @click="onSwitchProductType('VARIABLE')"
        >
          <Layers :size="13" />
          <span>Switch to Variable Product</span>
        </Button>
      </div>

      <!-- Bottom Action Bar -->
      <div class="flex items-center justify-end gap-3 pt-2 pb-8">
        <RouterLink to="/products">
          <Button variant="outline" size="sm" class="h-9 px-4 text-xs font-semibold">
            Cancel
          </Button>
        </RouterLink>
        <Button
          id="btn-save-product-bottom"
          variant="primary"
          size="sm"
          class="h-9 px-5 text-xs gap-1.5 font-semibold shadow-2xs"
          :disabled="productStore.mutating"
          @click="save"
        >
          <span v-if="productStore.mutating" class="animate-spin mr-1">⏳</span>
          <Save v-else :size="14" />
          <span>{{ productStore.mutating ? 'Saving Changes…' : 'Save Changes' }}</span>
        </Button>
      </div>
    </template>
  </div>
</template>
