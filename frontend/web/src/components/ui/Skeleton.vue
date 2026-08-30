<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <div
    :class="cn('animate-pulse rounded-md bg-muted/80', $props.class)"
  />
</template>
