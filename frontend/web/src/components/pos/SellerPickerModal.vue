<script setup lang="ts">
import { computed } from 'vue'
import type { StaffMember } from '@/stores/posStore'
import ListPickerModal from './ListPickerModal.vue'

interface Props {
  open: boolean
  staffMembers: StaffMember[]
  selectedId?: number | string | null
}

const props = withDefaults(defineProps<Props>(), {
  selectedId: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [member: StaffMember]
}>()

const staffList = computed(() => Array.isArray(props.staffMembers) ? props.staffMembers : [])

const items = computed(() =>
  staffList.value.map((s) => ({
    id: String(s.id),
    name: s.name,
    description: s.role + (s.department ? ` · ${s.department}` : ''),
    icon: '👤',
  }))
)
</script>

<template>
  <ListPickerModal
    :open="props.open"
    title="Select Seller / Staff"
    :items="items"
    :selected-id="props.selectedId != null ? String(props.selectedId) : null"
    searchable
    @update:open="emit('update:open', $event)"
    @select="(item) => {
      const member = staffList.find((s: StaffMember) => String(s.id) === item.id)
      if (member) emit('select', member)
    }"
  />
</template>
