<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenuSeparator,
  type DropdownMenuSeparatorProps,
} from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<
  DropdownMenuSeparatorProps & {
    class?: string
  }
>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DropdownMenuSeparator
    v-bind="delegatedProps"
    :class="cn('-mx-1 my-1 h-px bg-border', props.class)"
  />
</template>
