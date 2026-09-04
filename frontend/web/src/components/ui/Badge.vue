<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

type Variant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'amber'
  | 'success'
  | 'warning'
  | 'error'
  | 'destructive'
  | 'info'
  | 'purple'
  | 'neutral'
  | 'outline'

interface Props {
  variant?: Variant
  dot?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  dot: false,
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-cta-muted text-primary border-cta/30 dark:border-cta/40'
    case 'secondary':
    case 'neutral':
      return 'bg-muted text-muted-foreground border-border'
    case 'amber':
      return 'bg-accent text-primary border-border-strong'
    case 'success':
      return 'bg-success-bg text-success-text border-success-border'
    case 'warning':
      return 'bg-warning-bg text-warning-text border-warning-border'
    case 'error':
    case 'destructive':
      return 'bg-error-bg text-error-text border-error-border'
    case 'info':
      return 'bg-info-bg text-info-text border-info-border'
    case 'purple':
      return 'bg-purple-bg text-purple-text border-purple-border'
    case 'outline':
      return 'bg-transparent text-foreground border-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
})

const dotColorClass = computed(() => {
  switch (props.variant) {
    case 'primary': return 'bg-cta'
    case 'secondary':
    case 'neutral': return 'bg-muted-foreground'
    case 'amber': return 'bg-primary'
    case 'success': return 'bg-emerald-500 dark:bg-emerald-400'
    case 'warning': return 'bg-amber-500 dark:bg-amber-400'
    case 'error':
    case 'destructive': return 'bg-red-500 dark:bg-red-400'
    case 'info': return 'bg-sky-500 dark:bg-sky-400'
    case 'purple': return 'bg-purple-500 dark:bg-purple-400'
    default: return 'bg-muted-foreground'
  }
})
</script>

<template>
  <span
    :class="cn(
      'inline-flex items-center justify-center gap-1.5 px-2.5 py-1 min-h-[22px] rounded-full text-xs font-semibold border whitespace-nowrap leading-none tracking-[0.02em] transition-colors shadow-2xs select-none',
      variantClass,
      props.class,
      $attrs.class as string,
    )"
  >
    <span v-if="dot" aria-hidden="true" :class="cn('w-1.5 h-1.5 rounded-full shrink-0', dotColorClass)" />
    <slot />
  </span>
</template>
