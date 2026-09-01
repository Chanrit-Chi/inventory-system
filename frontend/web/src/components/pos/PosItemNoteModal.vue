<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Tag, FileText, Check } from 'lucide-vue-next'
import type { CartItem } from '@/stores/posStore'

interface Props {
  open: boolean
  item: CartItem | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [itemId: string, discountType: 'none' | 'percentage' | 'flat', discountValue: number, notes: string]
}>()

const discountType = ref<'none' | 'percentage' | 'flat'>('none')
const discountValue = ref<number>(0)
const notes = ref<string>('')

const PRESET_DISCOUNTS = [5, 10, 15, 20, 50]

watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      discountType.value = newItem.discount_type || (newItem.discount > 0 ? 'percentage' : 'none')
      discountValue.value = newItem.discount || 0
      notes.value = newItem.notes || ''
    }
  },
  { immediate: true }
)

function setPreset(val: number) {
  discountType.value = 'percentage'
  discountValue.value = val
}

function handleSave() {
  if (!props.item) return
  emit('save', props.item.id, discountType.value, Number(discountValue.value) || 0, notes.value)
  emit('update:open', false)
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open && item" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="close"
    />

    <!-- Dialog -->
    <div
      class="relative w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-150 text-foreground"
    >
      <!-- Header -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-foreground font-display">Item Options & Discount</h3>
          <p class="text-3xs text-muted-foreground truncate max-w-[280px]">
            {{ item.name }} {{ item.variant_name ? `(${item.variant_name})` : '' }}
          </p>
        </div>

        <button
          type="button"
          @click="close"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 sm:p-5 space-y-3.5">
        <!-- Line Discount Section -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1.5">
            <Tag class="w-3.5 h-3.5 text-primary" />
            <span>Line Discount</span>
          </label>

          <!-- Type Switcher -->
          <div class="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-surface-subtle border border-border mb-2.5">
            <button
              type="button"
              @click="discountType = 'none'"
              :class="[
                'py-1 text-xs font-bold rounded transition-all cursor-pointer',
                discountType === 'none'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              No Discount
            </button>
            <button
              type="button"
              @click="discountType = 'percentage'"
              :class="[
                'py-1 text-xs font-bold rounded transition-all cursor-pointer',
                discountType === 'percentage'
                  ? 'bg-card text-primary shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              Percent (%)
            </button>
            <button
              type="button"
              @click="discountType = 'flat'"
              :class="[
                'py-1 text-xs font-bold rounded transition-all cursor-pointer',
                discountType === 'flat'
                  ? 'bg-card text-primary shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              Flat Amount ($)
            </button>
          </div>

          <!-- Value Input and Quick Presets -->
          <div v-if="discountType !== 'none'" class="space-y-2">
            <div class="relative">
              <input
                v-model.number="discountValue"
                type="number"
                min="0"
                :max="discountType === 'percentage' ? 100 : item.price * item.quantity"
                step="any"
                placeholder="Discount amount..."
                class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground font-mono focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                {{ discountType === 'percentage' ? '%' : '$' }}
              </span>
            </div>

            <div v-if="discountType === 'percentage'" class="flex gap-1">
              <button
                v-for="p in PRESET_DISCOUNTS"
                :key="p"
                type="button"
                @click="setPreset(p)"
                :class="[
                  'flex-1 py-1 text-3xs font-bold rounded-md border transition-all cursor-pointer',
                  discountValue === p
                    ? 'bg-cta-muted text-primary border-border-strong'
                    : 'bg-card text-muted-foreground border-border hover:bg-surface-subtle'
                ]"
              >
                {{ p }}%
              </button>
            </div>
          </div>
        </div>

        <!-- Line Notes Section -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
            <FileText class="w-3.5 h-3.5 text-primary" />
            <span>Line Item Note</span>
          </label>
          <textarea
            v-model="notes"
            rows="2"
            placeholder="e.g. Gift wrap, damaged box, specific flavor..."
            class="w-full px-3 py-1.5 rounded-lg border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden transition-all resize-none"
          />
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-2.5 bg-surface-subtle border-t border-border flex items-center justify-end gap-2">
        <button
          type="button"
          @click="close"
          class="h-8 px-3.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="handleSave"
          class="h-8 px-4 rounded-lg bg-cta text-cta-foreground text-xs font-bold hover:brightness-110 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
        >
          <Check class="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Apply Changes</span>
        </button>
      </div>
    </div>
  </div>
</template>
