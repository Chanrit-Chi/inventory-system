<script setup lang="ts">
import { computed } from 'vue'
import { SelectIcon, SelectTrigger, type SelectTriggerProps, useForwardProps } from 'radix-vue'
import { ChevronDown } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<SelectTriggerProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 cursor-pointer transition-all duration-150',
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
    </SelectIcon>
  </SelectTrigger>
</template>
