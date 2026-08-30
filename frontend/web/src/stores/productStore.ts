import { defineStore } from 'pinia'
import { ref } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface ProductVariant {
  id: string
  product_id: string
  sku: string
  barcode: string | null
  cost_price: number | string
  selling_price: number | string
  quantity_on_hand: number
  reorder_level: number
  is_active: boolean
  attribute_values?: Array<{
    id: string
    value_name: string
    attribute?: { id: string; name: string }
  }>
  attributeValues?: Array<{
    id: string
    value_name: string
    attribute?: { id: string; name: string }
  }>
  product?: {
    id: string
    name: string
  }
}

export interface Product {
  id: string
  name: string
  barcode: string | null
  purchase_price: number | string
  selling_price: number | string
  default_reorder_level: number
  image_url: string | null
  is_active: boolean
  category_id: string | null
  description: string | null
  category?: { id: string; name: string } | null
  variants?: ProductVariant[]
  created_at?: string
  updated_at?: string
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export interface CreateProductPayload {
  name: string
  barcode?: string
  purchase_price: number
  selling_price: number
  default_reorder_level?: number
  image_url?: string
  is_active?: boolean
  category_id?: string
  description?: string
  attributes?: Array<{
    attribute_id: string
    value_ids: string[]
  }>
  product_type?: string
  initial_stock?: number
}

export type CreateProductRequest = CreateProductPayload | FormData

export interface UpdateProductPayload {
  name?: string
  barcode?: string | null
  purchase_price?: number
  selling_price?: number
  default_reorder_level?: number
  image_url?: string | null
  is_active?: boolean
  description?: string | null
}

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const selectedProduct = ref<Product | null>(null)
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]> | null>(null)

  async function fetchProducts(params: {
    page?: number
    search?: string
    is_active?: boolean | string
    category_id?: string
  } = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/products', { params })
      products.value = res.data.data ?? []
      meta.value = res.data.meta ?? null
      return products.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to load products.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchProduct(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/products/${id}`)
      selectedProduct.value = res.data.data
      return selectedProduct.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to load product.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createProduct(payload: CreateProductRequest) {
    mutating.value = true
    error.value = null
    fieldErrors.value = null
    try {
      const config = payload instanceof FormData
        ? { headers: { 'Content-Type': 'multipart/form-data' } }
        : undefined
      const res = await api.post('/products', payload, config)
      return res.data.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        fieldErrors.value = e.errors || null
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to create product.'
      }
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function updateProduct(id: string, payload: UpdateProductPayload) {
    mutating.value = true
    error.value = null
    fieldErrors.value = null
    try {
      const res = await api.put(`/products/${id}`, payload)
      if (selectedProduct.value && selectedProduct.value.id === id) {
        selectedProduct.value = { ...selectedProduct.value, ...res.data.data }
      }
      // Update in products array if present
      const index = products.value.findIndex(p => p.id === id)
      if (index !== -1) {
        products.value[index] = { ...products.value[index], ...res.data.data }
      }
      return res.data.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        fieldErrors.value = e.errors || null
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to update product.'
      }
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function deleteProduct(id: string) {
    mutating.value = true
    error.value = null
    try {
      await api.delete(`/products/${id}`)
      products.value = products.value.filter(p => p.id !== id)
      if (selectedProduct.value?.id === id) {
        selectedProduct.value = null
      }
      if (meta.value) {
        meta.value.total = Math.max(0, meta.value.total - 1)
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to delete product.'
      }
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function toggleProductStatus(product: Product) {
    return updateProduct(product.id, { is_active: !product.is_active })
  }

  return {
    products,
    selectedProduct,
    meta,
    loading,
    mutating,
    error,
    fieldErrors,
    fetchProducts,
    fetchProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductStatus,
  }
})
