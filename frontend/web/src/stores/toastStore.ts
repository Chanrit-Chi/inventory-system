import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function add(message: string, variant: ToastVariant = 'info', duration = 4000) {
    const id = crypto.randomUUID()
    toasts.value.push({ id, message, variant, duration })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
    return id
  }

  function remove(id: string) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  function success(message: string, duration?: number) { return add(message, 'success', duration) }
  function error(message: string, duration?: number) { return add(message, 'error', duration) }
  function warning(message: string, duration?: number) { return add(message, 'warning', duration) }
  function info(message: string, duration?: number) { return add(message, 'info', duration) }

  return { toasts, add, remove, success, error, warning, info }
})
