<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { X, Check, MapPin, Clock, SlidersHorizontal } from 'lucide-vue-next'

export interface DeliveryZone {
  id: string
  company_id?: string | null
  company_name?: string | null
  name?: string
  zone_name?: string
  cost?: number | string
  fee?: number | string
  estimated_days?: string
  is_active?: boolean
}

interface Props {
  open: boolean
  zones: DeliveryZone[]
  selectedId?: string | null
  initialCost?: number
}

const props = withDefaults(defineProps<Props>(), {
  selectedId: null,
  initialCost: undefined,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [zone: DeliveryZone, customCost?: number]
  close: []
}>()

const CUSTOM_ZONE: DeliveryZone = {
  id: 'custom',
  name: 'Custom / Negotiated Rate',
  cost: 0,
  fee: 0,
  estimated_days: 'Flexible',
  is_active: true,
}

const searchQuery = ref('')
const selectedZoneId = ref<string | null>(props.selectedId ?? null)
const customFee = ref<number>(0)
const isCustomFeeEdited = ref(false)
const feeInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      searchQuery.value = ''
      selectedZoneId.value = props.selectedId ?? null
      if (props.selectedId === 'custom') {
        customFee.value = props.initialCost !== undefined ? props.initialCost : 0
      } else if (props.selectedId) {
        const found = props.zones.find((z) => z.id === props.selectedId)
        if (found) {
          const std = parseFloat(String(found.cost ?? found.fee ?? 0)) || 0
          customFee.value = props.initialCost !== undefined ? props.initialCost : std
        }
      } else if (props.zones.length > 0) {
        selectedZoneId.value = props.zones[0].id
        const std = parseFloat(String(props.zones[0].cost ?? props.zones[0].fee ?? 0)) || 0
        customFee.value = props.initialCost !== undefined ? props.initialCost : std
      } else {
        selectedZoneId.value = 'custom'
        customFee.value = props.initialCost !== undefined ? props.initialCost : 0
      }
    }
  },
  { immediate: true }
)

const allZones = computed<DeliveryZone[]>(() => {
  return [...props.zones, CUSTOM_ZONE]
})

const filteredZones = computed(() => {
  if (!searchQuery.value.trim()) return allZones.value
  const q = searchQuery.value.toLowerCase().trim()
  return allZones.value.filter((z) => {
    const name = (z.name || z.zone_name || '').toLowerCase()
    const est = (z.estimated_days || '').toLowerCase()
    return name.includes(q) || est.includes(q) || (z.id === 'custom' && 'custom manual'.includes(q))
  })
})

const currentSelectedZone = computed(() => {
  if (selectedZoneId.value === 'custom') {
    return {
      ...CUSTOM_ZONE,
      cost: customFee.value,
      fee: customFee.value,
    }
  }
  return props.zones.find((z) => z.id === selectedZoneId.value) || null
})

function handleSelectZone(z: DeliveryZone) {
  selectedZoneId.value = z.id
  if (z.id === 'custom') {
    if (props.initialCost !== undefined && !isCustomFeeEdited.value) {
      customFee.value = props.initialCost
    }
    nextTick(() => {
      feeInputRef.value?.focus()
      feeInputRef.value?.select()
    })
  } else {
    const std = parseFloat(String(z.cost ?? z.fee ?? 0)) || 0
    customFee.value = std
    isCustomFeeEdited.value = false
  }
}

function handleApply() {
  if (!currentSelectedZone.value) return
  const finalFee = Math.max(0, customFee.value || 0)
  emit('select', { ...currentSelectedZone.value, cost: finalFee, fee: finalFee }, finalFee)
  close()
}

function setPresetFee(fee: number) {
  customFee.value = Math.max(0, fee)
  isCustomFeeEdited.value = true
}

function close() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-100 p-4" @click.self="close">
        <div class="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-foreground">
          <!-- Header -->
          <header class="flex items-center justify-between px-5 py-4 bg-surface-subtle border-b border-border">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-cta-muted border border-border-strong flex items-center justify-center text-primary">
                <MapPin class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-foreground">Select Delivery Zone</h3>
                <p class="text-3xs text-muted-foreground">Choose shipping zone and customize negotiated rate</p>
              </div>
            </div>
            <button
              type="button"
              @click="close"
              class="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-surface-subtle flex items-center justify-center transition-colors cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <!-- Search & Filter -->
          <div class="p-3 bg-card border-b border-border">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search zones or destinations..."
              class="w-full px-3 py-1.5 rounded-xl border border-input bg-surface-subtle text-xs text-foreground focus:bg-card focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden"
            />
          </div>

          <!-- Body: List of Zones -->
          <div class="flex-1 overflow-y-auto p-4 space-y-2 max-h-60 divide-y divide-border/40 bg-background">
            <div
              v-for="zone in filteredZones"
              :key="zone.id"
              @click="handleSelectZone(zone)"
              :class="[
                'p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between',
                selectedZoneId === zone.id
                  ? 'bg-cta-muted border-cta ring-2 ring-cta/20 text-primary'
                  : 'bg-card border-border text-foreground hover:bg-surface-subtle'
              ]"
            >
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
                    selectedZoneId === zone.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-surface-subtle'
                  ]"
                >
                  <Check v-if="selectedZoneId === zone.id" class="w-3 h-3 stroke-[3]" />
                </div>
                <div>
                  <span class="text-xs font-bold block">{{ zone.name || zone.zone_name || 'Standard Zone' }}</span>
                  <div class="flex items-center gap-2 text-3xs text-muted-foreground mt-0.5">
                    <span v-if="zone.id === 'custom'" class="flex items-center gap-0.5 text-primary font-medium">
                      <SlidersHorizontal class="w-3 h-3 text-primary" />
                      Manual negotiated price
                    </span>
                    <span v-else-if="zone.estimated_days" class="flex items-center gap-0.5">
                      <Clock class="w-3 h-3 text-muted-foreground" />
                      {{ zone.estimated_days }} days
                    </span>
                  </div>
                </div>
              </div>

              <div class="text-right">
                <span v-if="zone.id === 'custom'" class="text-xs font-mono font-bold block text-primary">
                  ${{ (customFee || 0).toFixed(2) }}
                </span>
                <span v-else class="text-xs font-mono font-bold block text-foreground">
                  ${{ (parseFloat(String(zone.cost ?? zone.fee ?? 0)) || 0).toFixed(2) }}
                </span>
                <span class="text-[9px] text-muted-foreground uppercase font-bold">
                  {{ zone.id === 'custom' ? 'Custom Rate' : 'Standard Rate' }}
                </span>
              </div>
            </div>

            <div v-if="filteredZones.length === 0" class="text-center py-6 text-xs text-muted-foreground">
              No delivery zones found
            </div>
          </div>

          <!-- Bottom Panel: Negotiated / Custom Delivery Cost Adjustment -->
          <div v-if="currentSelectedZone" class="p-4 bg-surface-subtle border-t border-border space-y-3">
            <div class="flex items-center justify-between">
              <label class="block text-3xs font-bold text-foreground uppercase tracking-wider">
                Negotiated Shipping Rate ($)
              </label>
              <span class="text-3xs text-muted-foreground">
                Zone: <strong class="text-foreground">{{ currentSelectedZone.name || currentSelectedZone.zone_name }}</strong>
              </span>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                <input
                  ref="feeInputRef"
                  v-model.number="customFee"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full pl-7 pr-3 py-2 rounded-xl border border-input bg-card text-sm font-mono font-bold text-foreground focus:border-cta focus:ring-2 focus:ring-cta/20 outline-hidden"
                />
              </div>

              <!-- Quick Discount Presets for shipping negotiations -->
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="setPresetFee(0)"
                  class="px-2.5 py-2 rounded-xl text-3xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                  title="Waive shipping (Free)"
                >
                  Free ($0)
                </button>
                <button
                  v-if="currentSelectedZone.id !== 'custom'"
                  type="button"
                  @click="setPresetFee(parseFloat(String(currentSelectedZone?.cost ?? currentSelectedZone?.fee ?? 0)) || 0)"
                  class="px-2.5 py-2 rounded-xl text-3xs font-bold bg-card text-muted-foreground border border-border hover:bg-surface-subtle transition-colors cursor-pointer"
                  title="Reset to standard rate"
                >
                  Standard
                </button>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <footer class="p-4 bg-surface-subtle border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              @click="close"
              class="px-4 py-2 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleApply"
              :disabled="!currentSelectedZone"
              class="px-5 py-2 rounded-xl bg-cta text-cta-foreground text-xs font-bold hover:brightness-110 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check class="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Apply Zone & Rate</span>
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
