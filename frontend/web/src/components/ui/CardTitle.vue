<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <h3 :class="cn('text-lg font-bold leading-snug tracking-normal text-foreground font-sans', $props.class)">
    <slot />
  </h3>
</template>
