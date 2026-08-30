<script setup lang="ts">
import { computed } from 'vue'
import ListPickerModal from './ListPickerModal.vue'

interface DeliveryZone {
  id: string
  company_id: string
  company_name?: string
  zone_name: string
  fee: number
  estimated_days: string
  is_active: boolean
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
  props.zones.map((z) => ({
    id: z.id,
    name: z.zone_name,
    description: z.fee > 0 ? `₱${z.fee.toFixed(2)} · Est. ${z.estimated_days} days` : `Free · Est. ${z.estimated_days} days`,
    icon: '📦',
  }))
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
