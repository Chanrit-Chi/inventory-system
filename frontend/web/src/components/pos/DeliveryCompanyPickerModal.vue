<script setup lang="ts">
import { computed } from 'vue'
import ListPickerModal from './ListPickerModal.vue'

interface DeliveryCompany {
  id: string
  name: string
  phone?: string
  email?: string
  website?: string
  is_active: boolean
}

interface Props {
  open: boolean
  companies: DeliveryCompany[]
  selectedId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  selectedId: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [company: DeliveryCompany]
}>()

const items = computed(() =>
  props.companies.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.phone ? `📞 ${c.phone}` : undefined,
    icon: '🚚',
  }))
)
</script>

<template>
  <ListPickerModal
    :open="props.open"
    title="Select Delivery Company"
    :items="items"
    :selected-id="props.selectedId ?? null"
    searchable
    @update:open="emit('update:open', $event)"
    @select="(item) => {
      const company = props.companies.find((c) => c.id === item.id)
      if (company) emit('select', company)
    }"
  />
</template>
