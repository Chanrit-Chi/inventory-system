import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Attribute {
  id: string
  name: string
  slug: string
  type: 'text' | 'color' | 'size' | 'number'
  values: string[]
  created_at: string
  updated_at: string
}

export const useAttributeStore = defineStore('attribute', () => {
  const attributes = ref<Attribute[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAttributes() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/attributes')
      attributes.value = res.data.data || []
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch attributes'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createAttribute(data: Partial<Attribute>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/attributes', data)
      const attribute = res.data.data as Attribute
      attributes.value.push(attribute)
      return attribute
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create attribute'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateAttribute(id: string, data: Partial<Attribute>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/attributes/${id}`, data)
      const attribute = res.data.data as Attribute
      const idx = attributes.value.findIndex(a => a.id === id)
      if (idx !== -1) attributes.value[idx] = attribute
      return attribute
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update attribute'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteAttribute(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/attributes/${id}`)
      attributes.value = attributes.value.filter(a => a.id !== id)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete attribute'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const attributeList = computed(() => attributes.value)

  return {
    attributes,
    loading,
    error,
    isLoading,
    attributeList,
    fetchAttributes,
    createAttribute,
    updateAttribute,
    deleteAttribute,
  }
})
