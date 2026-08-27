import { defineStore } from 'pinia'
import { ref } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface OrderItem {
  id: string
  order_id?: string
  variant_id: string
  quantity: number
  unit_price: number | string
  total_price: number | string
  variant?: {
    id: string
    sku: string
    barcode: string | null
    cost_price?: number | string
    selling_price?: number | string
    product?: {
      id: string
      name: string
    }
    attribute_values?: Array<{
      value_name: string
      attribute?: { name: string }
    }>
    attributeValues?: Array<{
      value_name: string
      attribute?: { name: string }
    }>
  }
}

export interface Payment {
  id: string
  order_id?: string
  payment_method: string
  amount: number | string
  status: string
  transaction_ref?: string | null
  proof_image_url?: string | null
  paid_at?: string | null
}

export interface SalesChannel {
  id: string
  name: string
  image_url?: string | null
  is_active: boolean
}

export interface Order {
  id: string
  order_number: string
  channel_id: string
  customer_id: string | null
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | string
  subtotal: number | string
  discount: number | string
  delivery_cost: number | string
  total_amount: number | string
  notes?: string | null
  created_at: string
  channel?: SalesChannel
  customer?: {
    id: string
    name: string
    phone: string
    email?: string | null
    address?: string | null
  } | null
  items?: OrderItem[]
  payments?: Payment[]
}

export interface OrderPaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const selectedOrder = ref<Order | null>(null)
  const meta = ref<OrderPaginationMeta | null>(null)
  const channels = ref<SalesChannel[]>([])
  const loading = ref(false)
  const detailLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchChannels() {
    try {
      const res = await api.get('/sales-channels')
      channels.value = res.data.data ?? []
      return channels.value
    } catch {
      channels.value = []
      return []
    }
  }

  async function fetchOrders(params: {
    page?: number
    status?: string
    channel_id?: string
    date_from?: string
    date_to?: string
    search?: string
  } = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/orders', { params })
      orders.value = res.data.data ?? []
      meta.value = res.data.meta ?? null
      return orders.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to load orders.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchOrder(id: string) {
    detailLoading.value = true
    error.value = null
    try {
      const res = await api.get(`/orders/${id}`)
      selectedOrder.value = res.data.data
      return selectedOrder.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to load order details.'
      }
      throw e
    } finally {
      detailLoading.value = false
    }
  }

  function clearSelectedOrder() {
    selectedOrder.value = null
  }

  return {
    orders,
    selectedOrder,
    meta,
    channels,
    loading,
    detailLoading,
    error,
    fetchChannels,
    fetchOrders,
    fetchOrder,
    clearSelectedOrder,
  }
})
