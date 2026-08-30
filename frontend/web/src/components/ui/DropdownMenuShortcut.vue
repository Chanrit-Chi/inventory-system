<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <span :class="cn('ml-auto text-xs tracking-widest text-muted-foreground font-mono', $props.class)">
    <slot />
  </span>
</template>
