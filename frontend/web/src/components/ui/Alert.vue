<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-vue-next'

type Variant = 'info' | 'success' | 'warning' | 'error' | 'destructive'

interface Props {
  variant?: Variant
  title?: string
  dismissable?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info',
  dismissable: false,
})

defineEmits<{ (e: 'dismiss'): void }>()

const variantClass = computed(() => {
  switch (props.variant) {
    case 'error':
    case 'destructive':
      return 'bg-error-bg text-error-text border-error-border'
    case 'success':
      return 'bg-success-bg text-success-text border-success-border'
    case 'warning':
      return 'bg-warning-bg text-warning-text border-warning-border'
    case 'info':
    default:
      return 'bg-info-bg text-info-text border-info-border'
  }
})

const iconComponent = computed(() => {
  switch (props.variant) {
    case 'error':
    case 'destructive':
      return AlertCircle
    case 'success':
      return CheckCircle2
    case 'warning':
      return AlertTriangle
    case 'info':
    default:
      return Info
  }
})
</script>

<template>
  <div
    :class="cn(
      'relative flex items-start gap-3 p-4 rounded-xl text-sm border leading-relaxed',
      variantClass,
      $attrs.class as string,
    )"
    role="alert"
  >
    <component :is="iconComponent" class="w-5 h-5 flex-shrink-0 mt-0.5" />
    <div class="flex-1 min-w-0">
      <h5 v-if="title || $slots.title" class="font-bold mb-1 leading-tight text-foreground font-sans">
        <slot name="title">{{ title }}</slot>
      </h5>
      <div class="text-sm">
        <slot />
      </div>
    </div>
    <button
      v-if="dismissable"
      type="button"
      class="rounded-md p-1 opacity-70 hover:opacity-100 hover:bg-black/5 transition-opacity"
      aria-label="Dismiss alert"
      @click="$emit('dismiss')"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>
