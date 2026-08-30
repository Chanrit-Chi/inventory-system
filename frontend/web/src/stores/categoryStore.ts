import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  parent_id?: string
  product_count?: number
  created_at: string
  updated_at: string
}

export const useCategoryStore = defineStore('category', () => {
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCategories() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/categories')
      categories.value = res.data.data || []
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch categories'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createCategory(data: Partial<Category>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/categories', data)
      const category = res.data.data as Category
      categories.value.push(category)
      return category
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to create category'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateCategory(id: string, data: Partial<Category>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.patch(`/categories/${id}`, data)
      const category = res.data.data as Category
      const idx = categories.value.findIndex(c => c.id === id)
      if (idx !== -1) categories.value[idx] = category
      return category
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update category'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteCategory(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/categories/${id}`)
      categories.value = categories.value.filter(c => c.id !== id)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete category'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const categoryList = computed(() => categories.value)

  return {
    categories,
    loading,
    error,
    isLoading,
    categoryList,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }
})
