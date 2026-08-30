import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled'
  subtotal: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  due_date: string
  notes?: string
  items: Array<{
    product_name: string
    sku: string
    quantity: number
    unit_price: number
    line_total: number
  }>
  payments?: Array<{
    id: string
    amount: number
    method: string
    paid_at: string
    reference?: string
  }>
  created_at: string
  updated_at: string
}

export interface InvoiceFilters {
  page?: number
  per_page?: number
  search?: string
  status?: string
  from?: string
  to?: string
}

export const useInvoiceStore = defineStore('invoice', () => {
  const invoices = ref<Invoice[]>([])
  const currentInvoice = ref<Invoice | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const meta = ref<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null)

  async function fetchInvoices(filters: InvoiceFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/invoices', { params: filters })
      invoices.value = res.data.data || []
      meta.value = res.data.meta
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch invoices'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchInvoice(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/invoices/${id}`)
      currentInvoice.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch invoice'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createInvoice(data: Partial<Invoice>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/invoices', data)
      const invoice = res.data.data as Invoice
      invoices.value.push(invoice)
      return invoice
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create invoice'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function recordPayment(id: string, data: { amount: number; method: string; reference?: string }) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post(`/invoices/${id}/payments`, data)
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to record payment'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteInvoice(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/invoices/${id}`)
      invoices.value = invoices.value.filter(i => i.id !== id)
      if (currentInvoice.value?.id === id) currentInvoice.value = null
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete invoice'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const invoiceList = computed(() => invoices.value)

  return {
    invoices,
    currentInvoice,
    loading,
    error,
    meta,
    isLoading,
    invoiceList,
    fetchInvoices,
    fetchInvoice,
    createInvoice,
    recordPayment,
    deleteInvoice,
  }
})
