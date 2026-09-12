<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { Loader2, ArrowDownCircle, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import Button from './Button.vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    hasMore?: boolean
    totalLoaded?: number
    total?: number | null
    autoScroll?: boolean
    error?: string | null
  }>(),
  {
    loading: false,
    hasMore: false,
    totalLoaded: 0,
    total: null,
    autoScroll: true,
    error: null,
  }
)

const emit = defineEmits<{
  (e: 'loadMore'): void
  (e: 'retry'): void
}>()

const sentinelRef = ref<HTMLElement | null>(null)
let cooldownTimer: ReturnType<typeof setTimeout> | null = null

function triggerLoad() {
  if (props.loading || !props.hasMore || props.error) return
  if (cooldownTimer) return
  cooldownTimer = setTimeout(() => {
    cooldownTimer = null
  }, 400)
  emit('loadMore')
}

// Observe sentinel element entering viewport
useIntersectionObserver(
  sentinelRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting && props.autoScroll && props.hasMore && !props.loading) {
      triggerLoad()
    }
  },
  {
    rootMargin: '120px',
  }
)
</script>

<template>
  <div
    class="w-full border-t border-border/70 bg-surface/30 px-4 h-12 flex items-center justify-between text-xs text-muted-foreground select-none relative"
    style="overflow-anchor: none;"
  >
    <!-- Sentinel element for auto infinite scroll anchored at top of footer -->
    <div
      ref="sentinelRef"
      class="absolute top-0 left-0 w-full pointer-events-none opacity-0 h-1"
      aria-hidden="true"
    />

    <!-- Left: Records count summary (fixed height, no wrap) -->
    <div class="flex items-center gap-2 truncate">
      <span v-if="total !== null && total !== undefined" class="font-medium">
        Showing <strong class="text-foreground tabular-nums">{{ totalLoaded }}</strong> of
        <strong class="text-foreground tabular-nums">{{ total }}</strong> records
      </span>
      <span v-else-if="totalLoaded > 0" class="font-medium">
        Showing <strong class="text-foreground tabular-nums">{{ totalLoaded }}</strong> records
      </span>
    </div>

    <!-- Right: Fixed-height status area to guarantee zero layout shift -->
    <div class="flex items-center justify-end gap-2 h-8 min-w-[140px] shrink-0">
      <!-- Error State -->
      <div v-if="error" class="flex items-center gap-1.5 text-destructive">
        <AlertCircle :size="14" class="shrink-0" />
        <span class="max-w-[160px] truncate">{{ error }}</span>
        <Button variant="outline" size="sm" class="h-7 px-2 text-xs" @click="emit('retry')">
          Retry
        </Button>
      </div>

      <!-- Loading State (steady spinner, height matches button exactly) -->
      <div v-else-if="loading" class="flex items-center gap-1.5 text-primary font-medium px-2 h-8">
        <Loader2 :size="14" class="animate-spin text-primary shrink-0" />
        <span>Loading more...</span>
      </div>

      <!-- Has More: Load More Button -->
      <Button
        v-else-if="hasMore"
        variant="outline"
        size="sm"
        class="h-8 px-3 text-xs gap-1.5 font-medium border-dashed hover:border-solid hover:bg-surface-subtle shrink-0"
        :disabled="loading"
        @click="triggerLoad"
      >
        <ArrowDownCircle :size="14" />
        <span>Load More</span>
      </Button>

      <!-- All Records Loaded -->
      <div v-else-if="totalLoaded > 0" class="flex items-center gap-1.5 text-muted-foreground/80 font-medium px-2 h-8">
        <CheckCircle2 :size="13" class="text-emerald-500 shrink-0" />
        <span>All records loaded</span>
      </div>
    </div>
  </div>
</template>
