<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('relative w-full overflow-auto rounded-xl border border-border bg-card shadow-xs', $props.class)">
    <table class="w-full caption-bottom text-sm text-left border-collapse">
      <slot />
    </table>
  </div>
</template>
