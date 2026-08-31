<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAttributeStore, type Attribute } from '@/stores/attributeStore'
import { useProductStore } from '@/stores/productStore'
import { useCategoryStore } from '@/stores/categoryStore'
import {
  ArrowLeft,
  Check,
  Tag,
  Layers,
  AlertCircle,
  TrendingUp,
  Upload,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Switch,
  Card,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui'

const router = useRouter()
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

// Active Step in Stepper Navigation
const currentStep = ref<number>(1)

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
    const valItems = [...valSet].map(vStr => ({
      id: vStr,
      label: vStr,
    }))
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

  // Use FormData when we have an image file to upload
  if (form.value.image_file) {
    const formData = new FormData()
    formData.append('name', form.value.name.trim())
    formData.append('barcode', form.value.barcode.trim() || '')
    formData.append('purchase_price', pPrice.toString())
    formData.append('selling_price', sPrice.toString())
    formData.append('default_reorder_level', (parseInt(form.value.default_reorder_level) || 5).toString())
    formData.append('description', form.value.description.trim() || '')
    formData.append('is_active', form.value.is_active.toString())
    formData.append('product_type', form.value.product_type)
    formData.append('initial_stock', form.value.initial_stock.toString())
    formData.append('image_file', form.value.image_file)

    // Append attributes as JSON string
    if (attributes.length > 0) {
      formData.append('attributes', JSON.stringify(attributes))
    }

    try {
      await productStore.createProduct(formData)
      successMessage.value = 'Product created successfully! Redirecting to catalog…'
      setTimeout(() => {
        router.push('/products')
      }, 1000)
    } catch (e: unknown) {
      submitError.value = e instanceof Error ? e.message : 'Failed to create product.'
    }
  } else {
    // Original JSON payload when no image
    const payload = {
      name: form.value.name.trim(),
      barcode: form.value.barcode.trim() || undefined,
      purchase_price: pPrice,
      selling_price: sPrice,
      default_reorder_level: parseInt(form.value.default_reorder_level) || 5,
      description: form.value.description.trim() || undefined,
      is_active: form.value.is_active,
      product_type: form.value.product_type,
      initial_stock: form.value.initial_stock,
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
}

function fmtMoney(num: number): string {
  return `$${num.toFixed(2)}`
}
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

    <!-- Stepper Navigation Header -->
    <div class="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          type="button"
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1 text-left"
          :class="currentStep === 1 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-surface-subtle'"
          @click="currentStep = 1"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors"
            :class="form.name && form.selling_price ? 'bg-success text-success-foreground' : currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <Check v-if="form.name && form.selling_price" :size="14" />
            <span v-else>1</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Base Details & Pricing</div>
            <div class="text-[11px] text-muted-foreground">Name, barcodes & margins</div>
          </div>
        </button>

        <div class="hidden sm:block w-8 h-px bg-border flex-shrink-0" />

        <button
          type="button"
          :disabled="form.product_type !== 'VARIABLE'"
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1 text-left"
          :class="form.product_type !== 'VARIABLE' ? 'opacity-50 cursor-not-allowed text-muted-foreground' : (currentStep === 2 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-surface-subtle')"
          @click="form.product_type === 'VARIABLE' && (currentStep = 2)"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors"
            :class="matrixPreview.length > 0 ? 'bg-success text-success-foreground' : currentStep === 2 ? 'bg-primary text-primary-foreground' : (form.product_type !== 'VARIABLE' ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground')"
          >
            <Check v-if="matrixPreview.length > 0" :size="14" />
            <span v-else>2</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Variant Options</div>
            <div class="text-[11px] text-muted-foreground">Sizes, colors, attributes</div>
          </div>
        </button>

        <div class="hidden sm:block w-8 h-px bg-border flex-shrink-0" />

        <button
          type="button"
          class="flex items-center gap-3 p-2 rounded-lg transition-colors flex-1 text-left"
          :class="currentStep === 3 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-surface-subtle'"
          @click="currentStep = 3"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors"
            :class="currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          >
            <span>3</span>
          </div>
          <div>
            <div class="text-xs font-bold text-foreground">Cartesian Matrix</div>
            <div class="text-[11px] text-muted-foreground">Review generated SKUs</div>
          </div>
        </button>
      </div>
    </div>

    <!-- Alert Notifications -->
    <Alert v-if="submitError || productStore.error" variant="error">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" class="flex-shrink-0" />
        <span>{{ submitError || productStore.error }}</span>
      </div>
    </Alert>

    <Alert v-if="successMessage" variant="success">
      <div class="flex items-center gap-2">
        <Check :size="16" class="flex-shrink-0" />
        <span>{{ successMessage }}</span>
      </div>
    </Alert>

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
            <label class="block text-xs font-semibold text-foreground mb-1">Product Type *</label>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="radio"
                  name="product_type"
                  :value="'SIMPLE'"
                  :class="form.product_type === 'SIMPLE' ? 'h-4 w-4 text-primary-600 rounded-full' : 'h-4 w-4 text-muted-foreground rounded-full'"
                  @change="form.product_type = 'SIMPLE'"
                />
                <span>Simple</span>
              </label>
              <label class="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="radio"
                  name="product_type"
                  :value="'VARIABLE'"
                  :class="form.product_type === 'VARIABLE' ? 'h-4 w-4 text-primary-600 rounded-full' : 'h-4 w-4 text-muted-foreground rounded-full'"
                  @change="form.product_type = 'VARIABLE'"
                />
                <span>Variable</span>
              </label>
            </div>
            <span v-if="form.product_type === 'VARIABLE'" class="text-xs text-muted-foreground font-mono mt-1 block">
              Select attributes to generate variant combinations
            </span>
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
                <img :src="imagePreviewUrl" alt="Product preview" class="w-24 h-20 object-cover rounded border" />
                <span class="text-xs text-muted-foreground truncate max-w-[100px]" title="form.image_file.name">{{ form.image_file.name }}</span>
                <button
                  type="button"
                  @click="removeImage"
                  class="text-xs text-destructive underline hover:underline"
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

      <!-- Right: Variant Attributes Selector (only for VARIABLE products) -->
      <Card v-if="form.product_type === 'VARIABLE'" class="p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-warning text-warning-foreground flex items-center justify-center text-xs font-bold font-mono">2</div>
            <h2 class="font-display font-bold text-base text-foreground">Variant Attributes</h2>
          </div>
          <Badge variant="info" class="font-mono text-xs">
            {{ attrStore.attributes.length }} Available
          </Badge>
        </div>

        <p class="text-xs text-muted-foreground leading-relaxed">
          Select attributes (e.g. Size, Color) and click specific value chips to automatically generate Cartesian variant combinations.
        </p>

        <div v-if="attrStore.loading" class="py-6 space-y-2">
          <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-muted/50 animate-pulse" />
        </div>

        <div v-else-if="attrStore.attributes.length === 0" class="py-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <Tag :size="28" class="text-muted-foreground/60 stroke-1" />
          <span>No attributes defined in system yet.</span>
        </div>

        <div v-else class="flex flex-col gap-3">
          <div
            v-for="attr in attrStore.attributes"
            :key="attr.id"
            class="p-3.5 rounded-lg border transition-all"
            :class="isAttrActive(attr.id) ? 'border-primary/40 bg-surface-subtle' : 'border-border bg-surface hover:border-border-strong'"
          >
            <!-- Attribute Header / Toggle -->
            <div class="flex items-center justify-between">
              <button
                type="button"
                :id="`attr-toggle-${attr.id}`"
                class="flex items-center gap-2 text-xs font-semibold rounded-md px-2.5 py-1 transition-colors"
                :class="isAttrActive(attr.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'"
                @click="toggleAttr(attr)"
              >
                <span>{{ isAttrActive(attr.id) ? '✓' : '+' }}</span>
                <span>{{ attr.name }}</span>
              </button>

              <span v-if="isAttrActive(attr.id)" class="text-[11px] font-mono font-medium text-primary">
                {{ selectedAttrs[attr.id]?.size || 0 }} of {{ attr.values.length }} selected
              </span>
            </div>

            <!-- Value Chips -->
            <div v-if="isAttrActive(attr.id)" class="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-dashed border-border/80">
              <button
                type="button"
                v-for="val in attr.values"
                :key="getValName(val)"
                :id="`val-toggle-${getValName(val)}`"
                class="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                :class="isValueActive(attr.id, getValName(val))
                  ? 'bg-cta text-cta-foreground font-semibold shadow-xs'
                  : 'bg-surface border border-border text-foreground hover:border-border-strong'"
                @click="toggleValue(attr.id, getValName(val))"
              >
                {{ getValName(val) }}
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Step 3: Live Cartesian Matrix Preview Table -->
    <Card class="p-5 flex flex-col gap-4">
      <div class="flex items-center justify-between pb-2 border-b border-border/60">
        <div class="flex items-center gap-2.5">
          <div class="w-6 h-6 rounded-md bg-success text-success-foreground flex items-center justify-center text-xs font-bold font-mono">3</div>
          <div>
            <h2 class="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span>Live Cartesian Variant Matrix Preview</span>
              <Badge v-if="matrixPreview.length > 0" variant="info" class="font-mono text-xs">
                {{ matrixPreview.length }} SKUs
              </Badge>
            </h2>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              Real-time generated SKU variant catalog combinations based on selected attributes.
            </p>
          </div>
        </div>
      </div>

      <div v-if="matrixPreview.length === 0" class="py-10 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
        <Layers :size="32" class="text-muted-foreground/50 stroke-1" />
        <span class="font-medium text-foreground text-sm">No attributes selected</span>
        <span class="text-muted-foreground">Select one or more attribute values in Step 2 to generate SKU combinations.</span>
      </div>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Generated SKU</TableHead>
              <TableHead>Option Combinations</TableHead>
              <TableHead class="font-mono">Cost</TableHead>
              <TableHead class="font-mono">Selling Price</TableHead>
              <TableHead class="font-mono">Reorder Level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in matrixPreview" :key="row.sku" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell class="font-mono text-xs font-semibold text-primary">
                {{ row.sku }}
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="opt in row.combination" :key="opt" variant="neutral" class="text-[10px] px-1.5 py-0">
                    {{ opt }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                {{ fmtMoney(row.purchasePrice) }}
              </TableCell>
              <TableCell class="font-mono text-xs font-bold text-foreground tabular-nums">
                {{ fmtMoney(row.sellingPrice) }}
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                {{ row.reorderLevel }} units
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <!-- Submit Action Bar -->
    <div class="flex items-center justify-end gap-3 pb-8">
      <RouterLink to="/products">
        <Button variant="outline" size="sm" class="h-9 px-4 text-xs">
          Cancel
        </Button>
      </RouterLink>

      <Button
        id="btn-create-product"
        variant="primary"
        size="sm"
        class="h-9 px-5 text-xs gap-1.5"
        :disabled="productStore.mutating"
        @click="submit"
      >
        <span v-if="productStore.mutating" class="animate-spin mr-1">⏳</span>
        <span>{{ productStore.mutating ? 'Saving Product…' : '✓ Save Product Line' }}</span>
      </Button>
    </div>
  </div>
</template>
