<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenuLabel,
  type DropdownMenuLabelProps,
  useForwardProps,
} from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<
  DropdownMenuLabelProps & { class?: string; inset?: boolean }
>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuLabel
    v-bind="forwardedProps"
    :class="
      cn(
        'px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground',
        inset && 'pl-8',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuLabel>
</template>
