import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Supplier {
  id: string
  name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupplierFilters {
  page?: number
  per_page?: number
  search?: string
  is_active?: boolean
}

export const useSupplierStore = defineStore('supplier', () => {
  const suppliers = ref<Supplier[]>([])
  const currentSupplier = ref<Supplier | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const meta = ref<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null)

  async function fetchSuppliers(filters: SupplierFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/suppliers', { params: filters })
      suppliers.value = res.data.data || []
      meta.value = res.data.meta
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch suppliers'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchSupplier(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/suppliers/${id}`)
      currentSupplier.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch supplier'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createSupplier(data: Partial<Supplier>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/suppliers', data)
      const supplier = res.data.data as Supplier
      suppliers.value.push(supplier)
      return supplier
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create supplier'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateSupplier(id: string, data: Partial<Supplier>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/suppliers/${id}`, data)
      const supplier = res.data.data as Supplier
      const idx = suppliers.value.findIndex(s => s.id === id)
      if (idx !== -1) suppliers.value[idx] = supplier
      if (currentSupplier.value?.id === id) currentSupplier.value = supplier
      return supplier
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update supplier'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteSupplier(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/suppliers/${id}`)
      suppliers.value = suppliers.value.filter(s => s.id !== id)
      if (currentSupplier.value?.id === id) currentSupplier.value = null
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete supplier'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const supplierList = computed(() => suppliers.value)

  return {
    suppliers,
    currentSupplier,
    loading,
    error,
    meta,
    isLoading,
    supplierList,
    fetchSuppliers,
    fetchSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  }
})
