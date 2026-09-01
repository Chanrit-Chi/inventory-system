<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { X } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnBackdrop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closeOnBackdrop: true,
})

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'max-w-sm'
    case 'lg': return 'max-w-3xl'
    case 'xl': return 'max-w-5xl'
    default:   return 'max-w-xl'
  }
})

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 sm:p-6"
        @click.self="closeOnBackdrop && close()"
      >
        <div
          :class="cn(
            'w-full bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto',
            sizeClass,
          )"
          role="dialog"
          aria-modal="true"
        >
          <div v-if="title || $slots.header" class="flex items-start justify-between mb-5">
            <div class="space-y-1">
              <h2 v-if="title" class="text-lg font-bold tracking-tight text-foreground font-sans">{{ title }}</h2>
              <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
              <slot name="header" />
            </div>
            <button
              class="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors cursor-pointer"
              aria-label="Close modal"
              @click="close"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          <div>
            <slot />
          </div>
          <div v-if="$slots.footer" class="mt-6 pt-4 border-t border-border flex items-center justify-end gap-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-enter-active > div, .modal-leave-active > div {
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div, .modal-leave-to > div { transform: scale(0.96) translateY(8px); }
</style>
