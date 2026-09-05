import { defineStore } from 'pinia'
import { ref } from 'vue'
import api, { ApiError } from '@/api/axios'
import {
  getConfiguredReceiptPrinter,
  buildEscPosCommands,
  buildInvoiceEscPosCommands,
  buildQuotationEscPosCommands,
  encodeEscPosBase64,
  getActiveBranding,
} from '@/utils/thermalPrinter'

export interface PrinterConfig {
  ip: string
  port?: number
  name?: string
}

export interface PrintReceiptResult {
  success: boolean
  directPrint: boolean
  message: string
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
   * Print an order receipt.
   * If a thermal printer is configured in settings/localStorage, formats ESC/POS commands
   * and routes through POST /api/v1/printer/raw-print (matching mobile behavior).
   * If no thermal printer is configured or direct print fails, opens the HTML receipt popup.
   */
  async function printReceipt(orderId: string, orderData?: any): Promise<PrintReceiptResult> {
    loading.value = true
    error.value = null

    const printer = getConfiguredReceiptPrinter()

    if (printer && printer.connectionType === 'wifi' && printer.ipAddress) {
      try {
        let order = orderData
        if (!order || !order.items || order.items.length === 0) {
          const res = await api.get(`/orders/${orderId}`)
          order = res.data?.data || res.data
        }

        const commands = buildEscPosCommands(order, printer, getActiveBranding())
        const encoded = encodeEscPosBase64(commands)

        await rawPrint(
          {
            ip: printer.ipAddress,
            port: printer.port || 9100,
            name: printer.name,
          },
          encoded,
          'base64'
        )

        return {
          success: true,
          directPrint: true,
          message: `Receipt sent to thermal printer (${printer.name} @ ${printer.ipAddress}:${printer.port || 9100})`,
        }
      } catch (err: unknown) {
        console.warn('Direct thermal print failed, falling back to browser print:', err)
      } finally {
        loading.value = false
      }
    }

    // Fallback: Open HTML receipt in new popup window for browser printing
    try {
      const baseURL = api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || 'https://inventory-backend-api.fly.dev/api/v1'
      const token = localStorage.getItem('omnipos_token')
      const url = `${baseURL}/orders/${orderId}/receipt`

      const win = window.open(url, '_blank', 'width=400,height=600')
      if (!win) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      win.addEventListener('load', () => {
        if (token) {
          win.localStorage.setItem('omnipos_token', token)
        }
      })

      return {
        success: true,
        directPrint: false,
        message: 'Receipt preview opened for printing',
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to print receipt'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Print an invoice.
   * Direct ESC/POS thermal printing with HTML popup fallback.
   */
  async function printInvoice(invoiceId: string, invoiceData?: any): Promise<PrintReceiptResult> {
    loading.value = true
    error.value = null

    const printer = getConfiguredReceiptPrinter()

    if (printer && printer.connectionType === 'wifi' && printer.ipAddress) {
      try {
        let invoice = invoiceData
        if (!invoice || !invoice.items || invoice.items.length === 0) {
          const res = await api.get(`/invoices/${invoiceId}`)
          invoice = res.data?.data || res.data
        }

        const commands = buildInvoiceEscPosCommands(invoice, printer, getActiveBranding())
        const encoded = encodeEscPosBase64(commands)

        await rawPrint(
          {
            ip: printer.ipAddress,
            port: printer.port || 9100,
            name: printer.name,
          },
          encoded,
          'base64'
        )

        return {
          success: true,
          directPrint: true,
          message: `Invoice sent to thermal printer (${printer.name} @ ${printer.ipAddress}:${printer.port || 9100})`,
        }
      } catch (err: unknown) {
        console.warn('Direct thermal invoice print failed, falling back to browser print:', err)
      } finally {
        loading.value = false
      }
    }

    // Fallback: Open HTML invoice popup
    try {
      const baseURL = api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || 'https://inventory-backend-api.fly.dev/api/v1'
      const token = localStorage.getItem('omnipos_token')
      const url = `${baseURL}/invoices/${invoiceId}/receipt`

      const win = window.open(url, '_blank', 'width=400,height=600')
      if (!win) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      win.addEventListener('load', () => {
        if (token) {
          win.localStorage.setItem('omnipos_token', token)
        }
      })

      return {
        success: true,
        directPrint: false,
        message: 'Invoice preview opened for printing',
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to print invoice'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Print a quotation.
   * Direct ESC/POS thermal printing with HTML popup fallback.
   */
  async function printQuotation(quotationId: string, quotationData?: any): Promise<PrintReceiptResult> {
    loading.value = true
    error.value = null

    const printer = getConfiguredReceiptPrinter()

    if (printer && printer.connectionType === 'wifi' && printer.ipAddress) {
      try {
        let quotation = quotationData
        if (!quotation || !quotation.items || quotation.items.length === 0) {
          const res = await api.get(`/quotations/${quotationId}`)
          quotation = res.data?.data || res.data
        }

        const commands = buildQuotationEscPosCommands(quotation, printer, getActiveBranding())
        const encoded = encodeEscPosBase64(commands)

        await rawPrint(
          {
            ip: printer.ipAddress,
            port: printer.port || 9100,
            name: printer.name,
          },
          encoded,
          'base64'
        )

        return {
          success: true,
          directPrint: true,
          message: `Quotation sent to thermal printer (${printer.name} @ ${printer.ipAddress}:${printer.port || 9100})`,
        }
      } catch (err: unknown) {
        console.warn('Direct thermal quotation print failed, falling back to browser print:', err)
      } finally {
        loading.value = false
      }
    }

    // Fallback: Open HTML quotation popup
    try {
      const baseURL = api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || 'https://inventory-backend-api.fly.dev/api/v1'
      const token = localStorage.getItem('omnipos_token')
      const url = `${baseURL}/quotations/${quotationId}/receipt`

      const win = window.open(url, '_blank', 'width=400,height=600')
      if (!win) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      win.addEventListener('load', () => {
        if (token) {
          win.localStorage.setItem('omnipos_token', token)
        }
      })

      return {
        success: true,
        directPrint: false,
        message: 'Quotation preview opened for printing',
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to print quotation'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    rawPrint,
    printReceipt,
    printInvoice,
    printQuotation,
  }
})
