<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useProductStore } from '@/stores/productStore'
import {
  ArrowLeft,
  Check,
  Package,
  Layers,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Save,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Switch,
  StatCard,
  Card,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui'

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
            <label class="block text-xs font-semibold text-foreground mb-1">Product Image URL</label>
            <Input
              id="product-edit-image"
              v-model="form.image_url"
              type="url"
              placeholder="https://example.com/image.jpg"
              class="h-9 bg-surface text-sm"
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
      <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div class="p-4 border-b border-border bg-surface-subtle/40 flex items-center justify-between">
          <div>
            <h2 class="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span>Variant Inventory Matrix</span>
              <Badge variant="info" class="font-mono text-xs">
                {{ productStore.selectedProduct.variants?.length || 0 }} SKUs
              </Badge>
            </h2>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              Individual barcodes, stock-on-hand, and reorder levels for each variation.
            </p>
          </div>
        </div>

        <div v-if="!productStore.selectedProduct.variants || productStore.selectedProduct.variants.length === 0" class="p-8 text-center text-muted-foreground text-xs">
          No variants associated with this product.
        </div>

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40">
                <TableHead>Variant SKU</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Stock on Hand</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="v in productStore.selectedProduct.variants" :key="v.id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell class="font-mono text-xs font-semibold text-primary">
                  {{ v.sku }}
                </TableCell>
                <TableCell class="font-mono text-xs">
                  <span v-if="v.barcode" class="px-2 py-0.5 rounded bg-surface-subtle border border-border text-foreground">
                    {{ v.barcode }}
                  </span>
                  <span v-else class="text-muted-foreground">—</span>
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                  {{ fmtMoney(v.cost_price) }}
                </TableCell>
                <TableCell class="font-mono text-xs font-bold text-foreground tabular-nums">
                  {{ fmtMoney(v.selling_price) }}
                </TableCell>
                <TableCell class="font-mono text-sm font-bold text-foreground tabular-nums">
                  {{ v.quantity_on_hand }}
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                  {{ v.reorder_level }} units
                </TableCell>
                <TableCell>
                  <Badge :variant="stockBadge(v.quantity_on_hand, v.reorder_level)" class="text-[11px] px-2 py-0.5">
                    {{ stockLabel(v.quantity_on_hand, v.reorder_level) }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>
  </div>
</template>
