import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/axios'

export interface AttributeValue {
  id: string
  attribute_id: string
  value_name: string
  is_active?: boolean
}

export interface Attribute {
  id: string
  name: string
  is_active?: boolean
  values: AttributeValue[]
}

export const useAttributeStore = defineStore('attributes', () => {
  const attributes = ref<Attribute[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAttributes() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/attributes')
      attributes.value = res.data.data ?? []
      return attributes.value
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch attributes.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createAttribute(payload: { name: string; values?: string[] }) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/attributes', payload)
      await fetchAttributes()
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to create attribute.'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    attributes,
    loading,
    error,
    fetchAttributes,
    createAttribute,
  }
})
