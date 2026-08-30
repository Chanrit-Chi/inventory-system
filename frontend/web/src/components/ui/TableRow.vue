<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <tr :class="cn('border-b border-border transition-colors hover:bg-surface-subtle/80 data-[state=selected]:bg-muted', $props.class)">
    <slot />
  </tr>
</template>
