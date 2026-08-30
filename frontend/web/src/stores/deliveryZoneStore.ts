import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface DeliveryCompany {
  id: string
  name: string
  phone?: string
  email?: string
  website?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DeliveryZone {
  id: string
  company_id: string
  company_name?: string
  zone_name: string
  fee: number
  estimated_days: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const useDeliveryZoneStore = defineStore('deliveryZone', () => {
  const companies = ref<DeliveryCompany[]>([])
  const zones = ref<DeliveryZone[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCompanies() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/delivery-companies')
      companies.value = res.data.data || []
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch delivery companies'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchZones() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/delivery-zones')
      zones.value = res.data.data || []
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch delivery zones'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createCompany(data: Partial<DeliveryCompany>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/delivery-companies', data)
      const company = res.data.data as DeliveryCompany
      companies.value.push(company)
      return company
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create delivery company'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createZone(data: Partial<DeliveryZone>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/delivery-zones', data)
      const zone = res.data.data as DeliveryZone
      zones.value.push(zone)
      return zone
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create delivery zone'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateCompany(id: string, data: Partial<DeliveryCompany>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/delivery-companies/${id}`, data)
      const company = res.data.data as DeliveryCompany
      const idx = companies.value.findIndex(c => c.id === id)
      if (idx !== -1) companies.value[idx] = company
      return company
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update delivery company'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateZone(id: string, data: Partial<DeliveryZone>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/delivery-zones/${id}`, data)
      const zone = res.data.data as DeliveryZone
      const idx = zones.value.findIndex(z => z.id === id)
      if (idx !== -1) zones.value[idx] = zone
      return zone
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update delivery zone'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteCompany(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/delivery-companies/${id}`)
      companies.value = companies.value.filter(c => c.id !== id)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete delivery company'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteZone(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/delivery-zones/${id}`)
      zones.value = zones.value.filter(z => z.id !== id)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete delivery zone'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)

  return {
    companies,
    zones,
    loading,
    error,
    isLoading,
    fetchCompanies,
    fetchZones,
    createCompany,
    createZone,
    updateCompany,
    updateZone,
    deleteCompany,
    deleteZone,
  }
})
