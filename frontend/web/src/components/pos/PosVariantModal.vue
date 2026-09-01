<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, Check, Package, AlertCircle, Search } from 'lucide-vue-next'

export interface ProductVariant {
  id: string
  sku: string
  barcode?: string | null
  selling_price: number | string | null
  cost_price?: number | string | null
  quantity_on_hand: number
  is_active?: boolean
  attribute_values?: Array<{
    id?: string
    value_name?: string
    name?: string
    attribute?: { id?: string; name: string }
  }>
  attributeValues?: Array<{
    id?: string
    value_name?: string
    name?: string
    attribute?: { id?: string; name: string }
  }>
}

export interface Product {
  id: string
  name: string
  selling_price?: number | string | null
  image_url?: string | null
  sku?: string | null
  category?: { id: string; name: string } | null
  variants?: ProductVariant[]
  description?: string | null
}

interface Props {
  open: boolean
  product: Product | null
  cartItems?: Array<{ product_id: string; variant_id?: string; sku?: string; quantity: number }>
}

const props = withDefaults(defineProps<Props>(), {
  cartItems: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'select': [product: Product, variant: ProductVariant, quantity: number]
}>()

const quantities = ref<Record<string, number>>({})
const variantSearch = ref('')

function getCartQuantity(v: ProductVariant): number {
  if (!props.cartItems || !props.product) return 0
  const item = props.cartItems.find(
    (i) => i.product_id === props.product?.id && (i.variant_id === v.id || i.sku === v.sku)
  )
  return item ? item.quantity : 0
}

function getEffectiveAvailableStock(v: ProductVariant): number {
  const inCart = getCartQuantity(v)
  return Math.max(0, (v.quantity_on_hand || 0) - inCart)
}

function getVariantQty(variant: ProductVariant): number {
  const max = getEffectiveAvailableStock(variant)
  if (max <= 0) return 0
  const cur = quantities.value[variant.id] || 1
  return Math.min(cur, max)
}

function setVariantQty(variant: ProductVariant, qty: number) {
  const max = getEffectiveAvailableStock(variant)
  if (max <= 0) {
    quantities.value[variant.id] = 0
    return
  }
  quantities.value[variant.id] = Math.min(Math.max(1, qty), max)
}

function formatPrice(val: number | string | null | undefined): string {
  if (val == null) return '$0.00'
  const num = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`
}

function getVariantDisplayName(variant: ProductVariant): string {
  const attrs = variant.attribute_values || variant.attributeValues || []
  if (attrs.length > 0) {
    return attrs
      .map((a) => {
        const attrName = a.attribute?.name
        const valName = a.value_name || a.name || ''
        return attrName ? `${attrName}: ${valName}` : valName
      })
      .filter(Boolean)
      .join(' · ')
  }
  return variant.sku || 'Default Variant'
}

function getVariantAttributes(variant: ProductVariant): Array<{ name: string; value: string }> {
  const attrs = variant.attribute_values || variant.attributeValues || []
  if (attrs.length > 0) {
    return attrs
      .map((a) => ({
        name: a.attribute?.name || 'Option',
        value: a.value_name || a.name || ''
      }))
      .filter((a) => Boolean(a.value))
  }
  return []
}

function getStockStatus(variant: ProductVariant) {
  const inCart = getCartQuantity(variant)
  const remaining = getEffectiveAvailableStock(variant)
  if (variant.quantity_on_hand <= 0) {
    return { label: 'Out of Stock', class: 'bg-error-bg text-error-text border-error-border' }
  }
  if (remaining <= 0) {
    return { label: `Max in cart (${inCart}/${variant.quantity_on_hand})`, class: 'bg-warning-bg text-warning-text border-warning-border' }
  }
  if (inCart > 0) {
    return { label: `${remaining} left (${inCart} in cart)`, class: 'bg-success-bg text-success-text border-success-border' }
  }
  if (variant.quantity_on_hand <= 5) {
    return { label: `${variant.quantity_on_hand} left`, class: 'bg-warning-bg text-warning-text border-warning-border' }
  }
  return { label: `${variant.quantity_on_hand} in stock`, class: 'bg-success-bg text-success-text border-success-border' }
}

const filteredVariants = computed(() => {
  const list = props.product?.variants || []
  const q = variantSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((v) => {
    const sku = (v.sku || '').toLowerCase()
    const barcode = (v.barcode || '').toLowerCase()
    const attrs = getVariantAttributes(v).map(a => `${a.name} ${a.value}`.toLowerCase()).join(' ')
    return sku.includes(q) || barcode.includes(q) || attrs.includes(q)
  })
})

function handleAddVariant(variant: ProductVariant) {
  const available = getEffectiveAvailableStock(variant)
  if (available <= 0) return
  if (!props.product) return
  const qty = getVariantQty(variant)
  if (qty <= 0) return
  emit('select', props.product, variant, qty)
  emit('update:open', false)
}

function close() {
  emit('update:open', false)
  variantSearch.value = ''
}
</script>

<template>
  <div v-if="open && product" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog Body -->
    <div
      class="relative w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in-0 zoom-in-95 duration-150 text-foreground"
    >
      <!-- Header -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-card border border-border overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.name"
              class="w-full h-full object-cover"
            />
            <Package v-else class="w-5 h-5 text-primary/60" />
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-bold text-foreground font-display leading-tight">
                {{ product.name }}
              </h3>
              <span
                v-if="product.category"
                class="px-2 py-0.5 text-3xs font-semibold rounded-md bg-cta-muted text-primary border border-border-strong"
              >
                {{ product.category.name }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              Select product variant and quantity
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Quick Search Filter if more than 3 variants -->
      <div v-if="(product.variants?.length || 0) > 3" class="px-5 pt-3 pb-1 border-b border-border/70 bg-card">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="variantSearch"
            type="text"
            placeholder="Search size, color, or barcode..."
            class="w-full pl-8.5 pr-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground placeholder:text-muted-foreground/60 focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
          />
        </div>
      </div>

      <!-- Variants List -->
      <div class="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 bg-background">
        <div
          v-for="variant in filteredVariants"
          :key="variant.id"
          class="p-3 rounded-xl border border-border bg-card hover:border-cta hover:shadow-2xs transition-all flex items-center justify-between gap-3 group"
        >
          <!-- Variant Info -->
          <div class="flex-1 min-w-0">
            <!-- Attribute badges / Variant Name -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold text-foreground">
                {{ getVariantDisplayName(variant) }}
              </span>

              <!-- Stock Badge -->
              <span
                :class="[
                  'px-2 py-0.5 text-3xs font-semibold rounded-full border',
                  getStockStatus(variant).class
                ]"
              >
                {{ getStockStatus(variant).label }}
              </span>
            </div>

            <!-- SKU & Barcode chips (Compact & Non-breaking) -->
            <div class="flex items-center gap-2 text-3xs text-muted-foreground mt-1 font-mono">
              <span>SKU: {{ variant.sku }}</span>
              <span v-if="variant.barcode">· Barcode: {{ variant.barcode }}</span>
            </div>
          </div>

          <!-- Price & Stepper & Add Action -->
          <div class="flex items-center gap-2.5 shrink-0">
            <!-- Price -->
            <div class="text-right">
              <span class="text-xs font-bold font-mono text-primary">
                {{ formatPrice(variant.selling_price || product.selling_price) }}
              </span>
            </div>

            <!-- Qty Stepper -->
            <div class="flex items-center border border-border rounded-lg bg-surface-subtle p-0.5">
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-card text-xs font-bold disabled:opacity-40 transition-colors cursor-pointer"
                :disabled="getVariantQty(variant) <= 1"
                @click="setVariantQty(variant, getVariantQty(variant) - 1)"
              >
                -
              </button>
              <span class="w-6 text-center text-xs font-bold font-mono text-foreground">
                {{ getVariantQty(variant) }}
              </span>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-card text-xs font-bold disabled:opacity-40 transition-colors cursor-pointer"
                :disabled="getVariantQty(variant) >= getEffectiveAvailableStock(variant)"
                @click="setVariantQty(variant, getVariantQty(variant) + 1)"
              >
                +
              </button>
            </div>

            <!-- Add Button -->
            <button
              type="button"
              @click="handleAddVariant(variant)"
              :disabled="getEffectiveAvailableStock(variant) <= 0"
              class="h-7.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-cta text-cta-foreground hover:brightness-110 active:scale-95"
            >
              <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div
          v-if="filteredVariants.length === 0"
          class="py-8 text-center text-xs text-muted-foreground"
        >
          <AlertCircle class="w-6 h-6 mx-auto text-primary/50 mb-1.5" />
          No matching variants found.
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-2.5 bg-surface-subtle border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Press <kbd class="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-3xs text-foreground">Esc</kbd> to close</span>
        <button
          type="button"
          @click="close"
          class="h-8 px-3.5 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-surface-subtle transition-colors cursor-pointer text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
