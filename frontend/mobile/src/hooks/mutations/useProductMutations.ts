import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../api/endpoints'
import type { Product } from '../../types'

/**
 * Mutation for creating a new product
 */
export function useCreateProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: any) => createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

/**
 * Mutation for updating an existing product
 */
export function useUpdateProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateProduct(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(variables.id) })
    },
  })
}

/**
 * Mutation for deleting / deactivating a product
 */
export function useDeleteProductMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

/**
 * Mutation for adjusting inventory stock
 */
export function useAdjustStockMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: {
      variant_id: string
      new_quantity: number
      current_quantity?: number
      difference?: number
      reason: string
      notes?: string
      adjusted_at?: string
    }) => adjustStock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
    },
  })
}

/**
 * Mutation for creating a category
 */
export function useCreateCategoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { name: string; code?: string; description?: string }) => createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

/**
 * Mutation for updating a category
 */
export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; code?: string; description?: string } }) =>
      updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

/**
 * Mutation for deleting a category
 */
export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}
