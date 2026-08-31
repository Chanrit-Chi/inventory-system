<script setup lang="ts">
import { computed } from 'vue'
import ListPickerModal from './ListPickerModal.vue'

interface DeliveryZone {
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
}

const props = withDefaults(defineProps<Props>(), {
  selectedId: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [zone: DeliveryZone]
}>()

const items = computed(() =>
  props.zones.map((z) => {
    const zoneName = z.name || z.zone_name || 'Standard Delivery'
    const feeVal = parseFloat(String(z.cost ?? z.fee ?? 0)) || 0
    const est = z.estimated_days ? ` · Est. ${z.estimated_days} days` : ''
    const desc = feeVal > 0 ? `$${feeVal.toFixed(2)}${est}` : `Free${est}`
    return {
      id: z.id,
      name: zoneName,
      description: desc,
      icon: '📦',
    }
  })
)
</script>

<template>
  <ListPickerModal
    :open="props.open"
    title="Select Delivery Zone"
    :items="items"
    :selected-id="props.selectedId ?? null"
    searchable
    @update:open="emit('update:open', $event)"
    @select="(item) => {
      const zone = props.zones.find((z) => z.id === item.id)
      if (zone) emit('select', zone)
    }"
  />
</template>
