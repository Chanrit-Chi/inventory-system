import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface CustomerOrder {
  id: string
  order_number: string
  channel_id: string
  customer_id: string
  status: string
  total_amount: number | string
  created_at: string
  channel?: { id: string; name: string }
  payments?: Array<{
    id: string
    payment_method: string
    amount: number | string
    status: string
  }>
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string
  address: string | null
  total_purchased: number
  total_spent: number | string
  last_purchase_at: string | null
  created_at?: string
  orders?: CustomerOrder[]
}

export interface CustomerPaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export const useCustomerStore = defineStore('customers', () => {
  const customers = ref<Customer[]>([])
  const selectedCustomer = ref<Customer | null>(null)
  const meta = ref<CustomerPaginationMeta | null>(null)
  const loading = ref(false)
  const detailLoading = ref(false)
  const error = ref<string | null>(null)

  const summaryStats = computed(() => {
    const totalCustomers = meta.value?.total ?? customers.value.length
    const totalSpend = customers.value.reduce((acc, c) => acc + (parseFloat(String(c.total_spent)) || 0), 0)
    const avgLtv = customers.value.length > 0 ? totalSpend / customers.value.length : 0
    return {
      totalCustomers,
      totalSpend,
      avgLtv,
    }
  })

  async function fetchCustomers(params: {
    page?: number
    search?: string
  } = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/customers', { params })
      customers.value = res.data.data ?? []
      meta.value = res.data.meta ?? null
      return customers.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to fetch customers.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchCustomer(id: string) {
    detailLoading.value = true
    error.value = null
    try {
      const res = await api.get(`/customers/${id}`)
      selectedCustomer.value = res.data.data
      return selectedCustomer.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to fetch customer details.'
      }
      throw e
    } finally {
      detailLoading.value = false
    }
  }

  return {
    customers,
    selectedCustomer,
    meta,
    loading,
    detailLoading,
    error,
    summaryStats,
    fetchCustomers,
    fetchCustomer,
  }
})
