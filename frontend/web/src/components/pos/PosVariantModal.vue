<script setup lang="ts">
import { ref } from 'vue'
import { X, Check, Package, AlertCircle } from 'lucide-vue-next'

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
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'select': [product: Product, variant: ProductVariant, quantity: number]
}>()

const quantities = ref<Record<string, number>>({})

function getVariantQty(vId: string): number {
  return quantities.value[vId] || 1
}

function setVariantQty(vId: string, qty: number) {
  quantities.value[vId] = Math.max(1, qty)
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

function getStockStatus(stock: number) {
  if (stock <= 0) return { label: 'Out of Stock', class: 'bg-red-50 text-red-700 border-red-200' }
  if (stock <= 5) return { label: `${stock} left`, class: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: `${stock} in stock`, class: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

function handleAddVariant(variant: ProductVariant) {
  if (variant.quantity_on_hand <= 0) return
  if (!props.product) return
  const qty = getVariantQty(variant.id)
  emit('select', props.product, variant, qty)
  emit('update:open', false)
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open && product" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog Body -->
    <div
      class="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-[#E8E2D9] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="px-6 py-4.5 bg-[#FAF7F2] border-b border-[#E8E2D9] flex items-center justify-between">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-xl bg-white border border-[#E8E2D9] overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.name"
              class="w-full h-full object-cover"
            />
            <Package v-else class="w-6 h-6 text-[#924C00]/60" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-[#1A1C1C] font-display leading-tight">
                {{ product.name }}
              </h3>
              <span
                v-if="product.category"
                class="px-2 py-0.5 text-xs font-medium rounded-md bg-[#FFF3E0] text-[#924C00] border border-[#FFDCC4]"
              >
                {{ product.category.name }}
              </span>
            </div>
            <p class="text-xs text-[#6B6358] font-mono mt-0.5">
              Select product variant and options
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="close"
          class="p-2 rounded-xl text-[#6B6358] hover:text-[#1A1C1C] hover:bg-[#F0EAE1] transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Variants List -->
      <div class="p-6 overflow-y-auto space-y-3 divide-y divide-[#F0EAE1]">
        <div
          v-for="variant in product.variants || []"
          :key="variant.id"
          class="pt-3 first:pt-0 flex items-center justify-between gap-4 group"
        >
          <!-- Variant Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="text-sm font-semibold text-[#1A1C1C]">
                {{ getVariantDisplayName(variant) }}
              </span>
              <span
                :class="[
                  'px-2 py-0.5 text-2xs font-semibold rounded-full border',
                  getStockStatus(variant.quantity_on_hand).class
                ]"
              >
                {{ getStockStatus(variant.quantity_on_hand).label }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-[#6B6358] mt-1 font-mono">
              <span>SKU: {{ variant.sku }}</span>
              <span v-if="variant.barcode">· Barcode: {{ variant.barcode }}</span>
            </div>
          </div>

          <!-- Price & Add -->
          <div class="flex items-center gap-4 shrink-0">
            <div class="text-right">
              <div class="text-base font-bold font-display text-[#1A1C1C]">
                {{ formatPrice(variant.selling_price || product.selling_price) }}
              </div>
            </div>

            <!-- Qty Stepper -->
            <div class="flex items-center border border-[#E8E2D9] rounded-xl bg-[#FAF7F2] p-0.5">
              <button
                type="button"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B6358] hover:text-[#1A1C1C] hover:bg-white text-sm font-bold disabled:opacity-40 transition-colors"
                :disabled="getVariantQty(variant.id) <= 1"
                @click="setVariantQty(variant.id, getVariantQty(variant.id) - 1)"
              >
                -
              </button>
              <span class="w-8 text-center text-xs font-bold font-mono text-[#1A1C1C]">
                {{ getVariantQty(variant.id) }}
              </span>
              <button
                type="button"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B6358] hover:text-[#1A1C1C] hover:bg-white text-sm font-bold disabled:opacity-40 transition-colors"
                :disabled="getVariantQty(variant.id) >= variant.quantity_on_hand"
                @click="setVariantQty(variant.id, getVariantQty(variant.id) + 1)"
              >
                +
              </button>
            </div>

            <!-- Add Button -->
            <button
              type="button"
              @click="handleAddVariant(variant)"
              :disabled="variant.quantity_on_hand <= 0"
              class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-[#FF8800] text-[#1A1C1C] hover:bg-[#E67A00] active:scale-95"
            >
              <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div
          v-if="!product.variants || product.variants.length === 0"
          class="py-8 text-center text-sm text-[#6B6358]"
        >
          <AlertCircle class="w-8 h-8 mx-auto text-[#924C00]/50 mb-2" />
          No specific variants available for this item.
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3.5 bg-[#FAF7F2] border-t border-[#E8E2D9] flex items-center justify-between text-xs text-[#6B6358]">
        <span>Press <kbd class="px-1.5 py-0.5 rounded bg-white border border-[#E8E2D9] font-mono text-2xs">Esc</kbd> to close</span>
        <button
          type="button"
          @click="close"
          class="px-4 py-1.5 rounded-xl border border-[#E8E2D9] bg-white text-[#1A1C1C] font-semibold hover:bg-[#FAF7F2] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
