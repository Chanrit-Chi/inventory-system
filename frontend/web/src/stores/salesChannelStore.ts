import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface SalesChannel {
  id: string
  name: string
  platform: 'telegram' | 'facebook' | 'instagram' | 'tiktok' | 'pos' | 'web' | 'online'
  code?: string
  type?: string
  image_url?: string
  is_active: boolean
  is_default: boolean
  created_at?: string
  updated_at?: string
}

export interface SalesChannelPaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export const useSalesChannelStore = defineStore('salesChannels', () => {
  const salesChannels = ref<SalesChannel[]>([])
  const meta = ref<SalesChannelPaginationMeta | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const mutating = ref(false)

  async function fetchSalesChannels(params: {
    page?: number
    search?: string
    filter_type?: string
  } = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/sales-channels', { params })
      salesChannels.value = res.data.data ?? []
      meta.value = res.data.meta ?? null
      return salesChannels.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to load sales channels.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createSalesChannel(payload: Partial<SalesChannel>) {
    mutating.value = true
    error.value = null
    try {
      const res = await api.post('/sales-channels', payload)
      await fetchSalesChannels() // Refresh list
      return res.data.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to create sales channel.'
      }
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function updateSalesChannel(id: string, payload: Partial<SalesChannel>) {
    mutating.value = true
    error.value = null
    try {
      const res = await api.put(`/sales-channels/${id}`, payload)
      await fetchSalesChannels() // Refresh list
      return res.data.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to update sales channel.'
      }
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function deleteSalesChannel(id: string) {
    mutating.value = true
    error.value = null
    try {
      const res = await api.delete(`/sales-channels/${id}`)
      await fetchSalesChannels() // Refresh list
      return res.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to delete sales channel.'
      }
      throw e
    } finally {
      mutating.value = false
    }
  }

  // Get active channels only
  const activeChannels = computed(() =>
    salesChannels.value.filter(channel => channel.is_active)
  )

  // Get default channels by type
  const defaultChannels = computed(() => {
    const defaults: Record<string, SalesChannel> = {}
    salesChannels.value.forEach(channel => {
      if (channel.is_default && channel.type) {
        defaults[channel.type] = channel
      }
    })
    return defaults
  })

  return {
    salesChannels,
    meta,
    loading,
    error,
    mutating,
    fetchSalesChannels,
    createSalesChannel,
    updateSalesChannel,
    deleteSalesChannel,
    activeChannels,
    defaultChannels
  }
})