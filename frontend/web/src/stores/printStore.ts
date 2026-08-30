import { defineStore } from 'pinia'
import { ref } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface PrinterConfig {
  ip: string
  port?: number
  name?: string
}

export const usePrintStore = defineStore('print', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Send raw ESC/POS data to a network printer.
   * The `data` field should be base64-encoded if it contains binary control bytes.
   */
  async function rawPrint(printer: PrinterConfig, data: string, encoding: 'base64' | 'raw' = 'base64') {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/printer/raw-print', {
        ip: printer.ip,
        port: printer.port ?? 9100,
        data,
        encoding,
      })
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to print'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Open a browser print dialog for the given order ID.
   * The backend renders the receipt as HTML, and we open it in a new window.
   */
  async function printReceipt(orderId: string) {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://backend.test/api/v1'
    const token = localStorage.getItem('omnipos_token')
    const url = `${baseURL}/orders/${orderId}/receipt`

    const win = window.open(url, '_blank', 'width=400,height=600')
    if (!win) {
      throw new Error('Popup blocked. Please allow popups for this site.')
    }

    // Inject token header via localStorage (receipt endpoint reads it)
    win.addEventListener('load', () => {
      if (token) {
        win.localStorage.setItem('omnipos_token', token)
      }
      win.print()
    })
  }

  return {
    loading,
    error,
    rawPrint,
    printReceipt,
  }
})
