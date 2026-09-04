<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
  padded?: boolean
  elevated?: boolean
  interactive?: boolean
}

withDefaults(defineProps<Props>(), {
  padded: true,
  elevated: false,
  interactive: false,
})
</script>

<template>
  <div
    :class="cn(
      'rounded-xl border border-border bg-card text-card-foreground shadow-xs transition-colors transition-shadow duration-150',
      padded && 'p-4 sm:p-6',
      elevated && 'shadow-sm',
      interactive && 'cursor-pointer hover:shadow-md hover:border-border-strong',
      $attrs.class as string,
    )"
  >
    <slot />
  </div>
</template>
