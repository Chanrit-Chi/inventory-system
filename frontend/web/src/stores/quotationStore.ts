import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Quotation {
  id: string
  quotation_number: string
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  subtotal: number
  discount?: number
  tax_amount: number
  total_amount: number
  valid_until: string
  notes?: string | null
  items: Array<{
    product_name: string
    sku: string
    quantity: number
    unit_price: number
    line_total: number
  }>
  created_at: string
  updated_at: string
}

export interface QuotationFilters {
  page?: number
  per_page?: number
  search?: string
  status?: string
  from?: string
  to?: string
}

export const useQuotationStore = defineStore('quotation', () => {
  const quotations = ref<Quotation[]>([])
  const quotation = ref<Quotation | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const meta = ref<{
    current_page: number
    last_page: number
    per_page: number
    total: number
  } | null>(null)

  // Fetch quotations with pagination and filters
  async function fetchQuotations(filters: QuotationFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/quotations', { params: filters })
      quotations.value = res.data.data || []
      meta.value = res.data.meta
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch quotations'
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error('Failed to fetch quotations')
    } finally {
      loading.value = false
    }
  }

  // Fetch single quotation by ID
  async function fetchQuotation(id: string) {
    loading.value = true
    try {
      const res = await api.get(`/quotations/${id}`)
      quotation.value = res.data.data as Quotation
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error(`Failed to fetch quotation ${id}`)
    } finally {
      loading.value = false
    }
  }

  // Create new quotation
  async function createQuotation(data: Omit<Quotation, 'id' | 'quotation_number' | 'created_at' | 'updated_at'>) {
    loading.value = true
    try {
      const res = await api.post('/quotations', data)
      quotation.value = res.data.data as Quotation
      return quotation.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error('Failed to create quotation')
    } finally {
      loading.value = false
    }
  }

  // Update quotation
  async function updateQuotation(id: string, data: Partial<Quotation>) {
    loading.value = true
    try {
      const res = await api.patch(`/quotations/${id}`, data)
      quotation.value = res.data.data as Quotation

      // Update in list if exists
      const index = quotations.value.findIndex(q => q.id === id)
      if (index !== -1) {
        quotations.value[index] = quotation.value
      }

      return quotation.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error(`Failed to update quotation ${id}`)
    } finally {
      loading.value = false
    }
  }

  // Delete quotation
  async function deleteQuotation(id: string) {
    loading.value = true
    try {
      await api.delete(`/quotations/${id}`)

      // Remove from list
      quotations.value = quotations.value.filter(q => q.id !== id)

      // Clear current quotation if it was the deleted one
      if (quotation.value?.id === id) {
        quotation.value = null
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error(`Failed to delete quotation ${id}`)
    } finally {
      loading.value = false
    }
  }

  // Accept quotation
  async function acceptQuotation(id: string) {
    loading.value = true
    try {
      const res = await api.patch(`/quotations/${id}/status`, { status: 'accepted' })

      // Update quotation if it's the current one
      if (quotation.value?.id === id) {
        quotation.value.status = 'accepted'
      }

      // Update in list
      const index = quotations.value.findIndex(q => q.id === id)
      if (index !== -1) {
        quotations.value[index].status = 'accepted'
      }

      return res.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error(`Failed to accept quotation ${id}`)
    } finally {
      loading.value = false
    }
  }

  // Reject quotation
  async function rejectQuotation(id: string) {
    loading.value = true
    try {
      const res = await api.patch(`/quotations/${id}/status`, { status: 'rejected' })

      // Update quotation if it's the current one
      if (quotation.value?.id === id) {
        quotation.value.status = 'rejected'
      }

      // Update in list
      const index = quotations.value.findIndex(q => q.id === id)
      if (index !== -1) {
        quotations.value[index].status = 'rejected'
      }

      return res.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error(`Failed to reject quotation ${id}`)
    } finally {
      loading.value = false
    }
  }

  // Convert quotation to order
  async function convertQuotation(id: string) {
    loading.value = true
    try {
      const res = await api.post(`/quotations/${id}/convert`)
      return res.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        throw e
      }
      throw new Error(`Failed to convert quotation ${id}`)
    } finally {
      loading.value = false
    }
  }

  // Clear quotation state
  function clearQuotation() {
    quotation.value = null
  }

  // Getters
  const quotationList = computed(() => quotations.value)
  const currentQuotation = computed(() => quotation.value)
  const isLoading = computed(() => loading.value)
  const pagination = computed(() => meta.value)

  return {
    // State
    quotations,
    quotation,
    loading,
    error,
    meta,

    // Actions
    fetchQuotations,
    fetchQuotation,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    acceptQuotation,
    rejectQuotation,
    convertQuotation,
    clearQuotation,

    // Getters
    quotationList,
    currentQuotation,
    isLoading,
    pagination
  }
})