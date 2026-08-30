<script setup lang="ts">
import { computed } from 'vue'
import { useToastStore } from '@/stores/toastStore'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const toastStore = useToastStore()
const toasts = computed(() => toastStore.toasts)

function dismiss(id: string) {
  toastStore.remove(id)
}
</script>

<template>
  <div class="fixed z-50 flex w-full flex-col pointer-events-none p-4 bottom-4 right-4 sm:top-4 sm:bottom-auto sm:right-4 sm:w-auto sm:max-w-md gap-2">
    <transition-group
      name="toast"
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2 sm:-translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="cn(
          'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-lg border pointer-events-auto bg-card',
          toast.variant === 'success' && 'border-success-border bg-success-bg/80 text-success-text',
          toast.variant === 'error' && 'border-error-border bg-error-bg/80 text-error-text',
          toast.variant === 'warning' && 'border-warning-border bg-warning-bg/80 text-warning-text',
          (!toast.variant || toast.variant === 'info') && 'border-info-border bg-info-bg/80 text-info-text',
        )"
        role="alert"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 v-if="toast.variant === 'success'" class="w-5 h-5 flex-shrink-0 text-success" />
          <AlertCircle v-else-if="toast.variant === 'error'" class="w-5 h-5 flex-shrink-0 text-destructive" />
          <AlertTriangle v-else-if="toast.variant === 'warning'" class="w-5 h-5 flex-shrink-0 text-warning" />
          <Info v-else class="w-5 h-5 flex-shrink-0 text-info" />

          <span class="text-sm font-medium leading-snug break-words">{{ toast.message }}</span>
        </div>

        <button
          @click="dismiss(toast.id)"
          class="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors cursor-pointer flex-shrink-0"
          aria-label="Dismiss"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </transition-group>
  </div>
</template>