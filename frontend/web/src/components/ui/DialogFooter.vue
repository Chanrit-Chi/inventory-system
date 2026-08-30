<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 pt-4 border-t border-border', $props.class)">
    <slot />
  </div>
</template>
