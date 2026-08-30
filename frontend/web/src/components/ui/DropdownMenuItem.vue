<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenuItem,
  type DropdownMenuItemProps,
  useForwardProps,
} from 'radix-vue'
import { cn } from '@/lib/utils'

const props = defineProps<
  DropdownMenuItemProps & { class?: string; inset?: boolean }
>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuItem
    v-bind="forwardedProps"
    :class="
      cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-1.5 text-sm outline-none transition-colors focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
