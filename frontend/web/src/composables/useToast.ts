import { useToastStore } from '@/stores/toastStore'

/**
 * Composable for triggering toasts from within components.
 * Use this in setup() or <script setup>
 *
 * @example
 * const toast = useToast()
 * toast.success('Saved!')
 * toast.error('Failed to load')
 */
export function useToast() {
  const toastStore = useToastStore()

  return {
    success: toastStore.success,
    error: toastStore.error,
    warning: toastStore.warning,
    info: toastStore.info,
  }
}