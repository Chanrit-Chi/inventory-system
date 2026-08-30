<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  icon?: any
  title?: string
  description?: string
  class?: string
}>()
</script>

<template>
  <div :class="cn('flex flex-col items-center justify-center text-center py-14 px-6 text-muted-foreground', $props.class)">
    <div v-if="icon || $slots.icon" class="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground mb-4 border border-border">
      <slot name="icon">
        <component :is="icon" v-if="typeof icon !== 'string'" class="w-7 h-7 text-muted-foreground/70" />
        <span v-else class="text-2xl">{{ icon }}</span>
      </slot>
    </div>
    <h3 v-if="title || $slots.title" class="text-base font-bold text-foreground mb-1.5 font-sans">
      <slot name="title">{{ title }}</slot>
    </h3>
    <p v-if="description || $slots.description" class="text-sm text-muted-foreground max-w-sm mb-4">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="$slots.action" class="flex items-center gap-3">
      <slot name="action" />
    </div>
  </div>
</template>
