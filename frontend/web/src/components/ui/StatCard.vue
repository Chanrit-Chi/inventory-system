<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'

type IconVariant = 'primary' | 'cta' | 'amber' | 'success' | 'warning' | 'error' | 'purple' | 'neutral'
type TrendVariant = 'up' | 'down' | 'neutral' | 'warning'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon?: any
  iconVariant?: IconVariant
  trend?: string
  trendVariant?: TrendVariant
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  iconVariant: 'primary',
  trendVariant: 'neutral',
})

const iconBg = computed(() => {
  switch (props.iconVariant) {
    case 'cta':
      return 'bg-cta-muted text-primary border-[#FFE4CC]'
    case 'amber':
    case 'primary':
      return 'bg-accent text-primary border-[#FFDCC4]'
    case 'success':
      return 'bg-success-bg text-success-text border-success-border'
    case 'warning':
      return 'bg-warning-bg text-warning-text border-warning-border'
    case 'error':
      return 'bg-error-bg text-error-text border-error-border'
    case 'purple':
      return 'bg-purple-bg text-purple-text border-purple-border'
    case 'neutral':
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
})

const trendClass = computed(() => {
  switch (props.trendVariant) {
    case 'up':
      return 'bg-success-bg text-success-foreground border-success-border'
    case 'down':
      return 'bg-error-bg text-error-foreground border-error-border'
    case 'warning':
      return 'bg-warning-bg text-warning-foreground border-warning-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
})
</script>

<template>
  <div
    :class="cn(
      'rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-3.5',
      'transition-all duration-150 hover:shadow-sm hover:border-border-strong hover:-translate-y-px',
      $attrs.class as string,
    )"
  >
    <div class="flex items-center justify-between">
      <div :class="cn('inline-flex items-center justify-center w-11 h-11 rounded-xl text-xl border', iconBg)">
        <component :is="icon" v-if="typeof icon !== 'string' && icon" class="w-5 h-5" />
        <span v-else>{{ icon }}</span>
      </div>
      <span v-if="trend" :class="cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', trendClass)">
        <TrendingUp v-if="trendVariant === 'up'" class="w-3 h-3" />
        <TrendingDown v-else-if="trendVariant === 'down'" class="w-3 h-3" />
        {{ trend }}
      </span>
    </div>
    <div class="flex flex-col gap-1">
      <span class="text-2xl font-bold tracking-tight tabular-nums text-foreground leading-tight font-sans">{{ value }}</span>
      <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{{ label }}</span>
      <span v-if="sub" class="text-xs text-muted-foreground">{{ sub }}</span>
    </div>
  </div>
</template>
