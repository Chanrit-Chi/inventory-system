<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api, { ApiError } from '@/api/axios'
import { useToast } from '@/composables/useToast'
import {
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-vue-next'
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'

export type StockAdjustmentReason = 'Audit' | 'Damaged' | 'Shrinkage' | 'Restock' | 'Return'

interface VariantOption {
  id: string
  product_id?: string
  product_name?: string
  name?: string
  sku: string
  quantity_on_hand: number
}

interface Props {
  open: boolean
  variant?: VariantOption | null
  productName?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  variant: null,
  productName: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'success': [variantId: string, newQty: number]
}>()

const toast = useToast()

const newQuantity = ref<number>(0)
const selectedReason = ref<StockAdjustmentReason>('Audit')
const notes = ref<string>('')
const loading = ref(false)

const reasons: Array<{ key: StockAdjustmentReason; label: string; desc: string }> = [
  { key: 'Audit', label: 'Physical Audit', desc: 'Routine cycle count verification' },
  { key: 'Damaged', label: 'Damaged / Defect', desc: 'Broken or unsellable stock removal' },
  { key: 'Shrinkage', label: 'Lost / Shrinkage', desc: 'Missing or unaccounted inventory' },
  { key: 'Restock', label: 'Restock Correction', desc: 'Adjust previous supplier delivery discrepancy' },
  { key: 'Return', label: 'Customer Return', desc: 'Item returned to active inventory stock' },
]

const currentQty = computed(() => {
  return props.variant?.quantity_on_hand ?? 0
})

const difference = computed(() => {
  return Number(newQuantity.value) - currentQty.value
})

watch(
  () => [props.open, props.variant],
  ([isOpen]) => {
    if (isOpen && props.variant) {
      newQuantity.value = props.variant.quantity_on_hand ?? 0
      selectedReason.value = 'Audit'
      notes.value = ''
    }
  },
  { immediate: true }
)

async function handleSaveAdjustment() {
  if (!props.variant?.id) {
    toast.error('No variant selected for adjustment')
    return
  }

  if (newQuantity.value < 0) {
    toast.error('Stock quantity cannot be negative')
    return
  }

  loading.value = true
  try {
    const payload = {
      variant_id: props.variant.id,
      new_quantity: Number(newQuantity.value),
      reason: selectedReason.value,
      notes: notes.value.trim() || undefined,
      client_mutation_id: crypto.randomUUID(),
    }

    await api.post('/inventory/adjust', payload)
    toast.success(`Inventory updated for SKU ${props.variant.sku}!`)
    emit('success', props.variant.id, Number(newQuantity.value))
    emit('update:open', false)
  } catch (err) {
    const e = err as ApiError
    console.error('Stock adjust error:', e)
    toast.error(e.message || 'Failed to adjust stock')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal class="w-4 h-4" />
          </div>
          <div>
            <DialogTitle class="font-display">Adjust Stock Quantity</DialogTitle>
            <DialogDescription>
              Record physical inventory count adjustments & ledger movements.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div v-if="variant" class="space-y-4 py-2">
        <!-- Target SKU Info Banner -->
        <div class="p-3 bg-muted/30 rounded-xl border border-border flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-foreground block">
              {{ productName || variant.product_name || 'Product Variant' }}
            </span>
            <span class="text-3xs text-muted-foreground font-mono">
              SKU: {{ variant.sku }} <span v-if="variant.name">({{ variant.name }})</span>
            </span>
          </div>

          <div class="text-right">
            <span class="text-3xs uppercase font-bold text-muted-foreground block">Current Stock</span>
            <span class="text-base font-black font-mono text-foreground">{{ currentQty }} units</span>
          </div>
        </div>

        <!-- New Quantity Input & Delta Calculation -->
        <div class="grid grid-cols-2 gap-3 items-end">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">New Physical Count *</label>
            <Input
              v-model.number="newQuantity"
              type="number"
              min="0"
              class="h-10 text-sm font-mono font-bold bg-surface"
              placeholder="0"
            />
          </div>

          <div>
            <label class="block text-2xs font-semibold text-muted-foreground mb-1">Inventory Delta</label>
            <div class="h-10 px-3 rounded-lg border border-border bg-card flex items-center justify-between font-mono font-bold text-xs">
              <span class="text-muted-foreground">Variance:</span>
              <span
                :class="[
                  difference > 0 ? 'text-emerald-600' : difference < 0 ? 'text-destructive' : 'text-foreground'
                ]"
              >
                {{ difference > 0 ? `+${difference}` : difference }} units
              </span>
            </div>
          </div>
        </div>

        <!-- Adjustment Reason Selector -->
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1.5">Adjustment Reason *</label>
          <div class="grid grid-cols-1 gap-1.5">
            <label
              v-for="r in reasons"
              :key="r.key"
              :class="[
                'p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all',
                selectedReason === r.key
                  ? 'bg-primary/10 border-primary text-foreground font-semibold ring-1 ring-primary/30'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/20'
              ]"
            >
              <div class="flex items-center gap-2">
                <input
                  type="radio"
                  name="adj_reason"
                  :value="r.key"
                  v-model="selectedReason"
                  class="text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>{{ r.label }}</span>
              </div>
              <span class="text-3xs text-muted-foreground">{{ r.desc }}</span>
            </label>
          </div>
        </div>

        <!-- Optional Notes -->
        <div>
          <label class="block text-xs font-semibold text-foreground mb-1">Audit / Inspection Notes</label>
          <input
            v-model="notes"
            type="text"
            placeholder="e.g. Broken in storage bay B2 during restocking..."
            class="w-full h-9 px-3 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <DialogFooter class="flex items-center justify-between border-t border-border pt-3">
        <Button variant="outline" size="sm" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          class="gap-1.5"
          :disabled="loading || difference === 0"
          @click="handleSaveAdjustment"
        >
          <div v-if="loading" class="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          <CheckCircle2 v-else class="w-4 h-4" />
          <span>Save Adjustment</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
