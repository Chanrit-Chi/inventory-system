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

function triggerLoad() {
  if (props.loading || !props.hasMore || props.error) return
  emit('loadMore')
}

// Observe sentinel element entering viewport
useIntersectionObserver(
  sentinelRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting && props.autoScroll) {
      triggerLoad()
    }
  },
  {
    rootMargin: '200px', // Pre-fetch 200px before reaching bottom
  }
)
</script>

<template>
  <div class="w-full border-t border-border/70 bg-surface/30 px-4 py-3">
    <!-- Sentinel element for auto infinite scroll -->
    <div ref="sentinelRef" class="h-1 w-full" aria-hidden="true" />

    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
      <!-- Records count summary -->
      <div class="flex items-center gap-2">
        <span v-if="total !== null && total !== undefined" class="font-medium">
          Showing <strong class="text-foreground tabular-nums">{{ totalLoaded }}</strong> of
          <strong class="text-foreground tabular-nums">{{ total }}</strong> records
        </span>
        <span v-else-if="totalLoaded > 0" class="font-medium">
          Showing <strong class="text-foreground tabular-nums">{{ totalLoaded }}</strong> records
        </span>
      </div>

      <!-- Action / Status area -->
      <div class="flex items-center gap-2">
        <!-- Error State -->
        <div v-if="error" class="flex items-center gap-2 text-destructive">
          <AlertCircle :size="14" />
          <span class="max-w-[240px] truncate">{{ error }}</span>
          <Button variant="outline" size="sm" class="h-7 px-2.5 text-xs gap-1" @click="emit('retry')">
            Retry
          </Button>
        </div>

        <!-- Loading State -->
        <div v-else-if="loading" class="flex items-center gap-2 text-primary font-medium">
          <Loader2 :size="14" class="animate-spin" />
          <span>Loading more...</span>
        </div>

        <!-- Has More: Load More Button -->
        <Button
          v-else-if="hasMore"
          variant="outline"
          size="sm"
          class="h-8 px-3 text-xs gap-1.5 font-medium border-dashed hover:border-solid hover:bg-surface-subtle"
          :disabled="loading"
          @click="triggerLoad"
        >
          <ArrowDownCircle :size="14" />
          <span>Load More</span>
        </Button>

        <!-- All Records Loaded -->
        <div v-else-if="totalLoaded > 0" class="flex items-center gap-1.5 text-muted-foreground/80 font-medium">
          <CheckCircle2 :size="13" class="text-emerald-500" />
          <span>All records loaded</span>
        </div>
      </div>
    </div>
  </div>
</template>
