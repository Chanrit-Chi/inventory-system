<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <tfoot :class="cn('border-t border-border bg-surface-subtle font-medium [&>tr]:last:border-b-0', $props.class)">
    <slot />
  </tfoot>
</template>
