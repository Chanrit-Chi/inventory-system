import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import {
  getProducts,
  getVariants,
  fetchCategories,
  fetchAttributes,
  scanBarcode,
} from '../../api/endpoints'
import type { Product, ScanResult, ProductCategory, AttributeTaxonomy } from '../../types'

export interface ProductFilters {
  search?: string
  category_id?: string
  is_active?: boolean | string
  include_inactive?: boolean
  page?: number
  per_page?: number
}

/**
 * Fetch products list with automatic caching and filtering
 */
export function useProducts(filters?: ProductFilters) {
  const queryKey = useMemo(
    () => queryKeys.products.list(filters),
    [
      filters?.search,
      filters?.category_id,
      filters?.is_active,
      filters?.include_inactive,
      filters?.page,
      filters?.per_page,
    ]
  )

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await getProducts(filters)
      const raw = res.data
      if (Array.isArray(raw)) {
        return raw as Product[]
      }
      return (raw as { data?: Product[] })?.data ?? []
    },
    staleTime: 1000 * 60 * 2, // 2 mins
  })
}

/**
 * Fetch single product detail by ID from cache or API
 */
export function useProduct(id: string | null | undefined) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null
      // Look up in existing products list cache first for instant load
      const allLists = queryClient.getQueriesData<Product[]>({ queryKey: queryKeys.products.all })
      for (const [, list] of allLists) {
        if (Array.isArray(list)) {
          const found = list.find((p) => p.id === id)
          if (found) return found
        }
      }
      const res = await getProducts({ search: id })
      const raw = res.data
      const list = Array.isArray(raw) ? raw : (raw as { data?: Product[] })?.data ?? []
      return list.find((p: Product) => p.id === id) ?? null
    },
    enabled: Boolean(id),
  })
}

/**
 * Fetch product categories
 */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: async () => {
      const res = await fetchCategories()
      return Array.isArray(res.data) ? res.data : (res.data as unknown as { data?: ProductCategory[] })?.data ?? []
    },
    staleTime: 1000 * 60 * 5, // 5 mins
  })
}

/**
 * Fetch product attributes
 */
export function useAttributes() {
  return useQuery({
    queryKey: queryKeys.attributes.list(),
    queryFn: async () => {
      const res = await fetchAttributes()
      return Array.isArray(res.data) ? res.data : (res.data as unknown as { data?: AttributeTaxonomy[] })?.data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Query for scanning barcode or SKU
 */
export function useBarcodeScanQuery(code: string, enabled = false) {
  return useQuery<ScanResult>({
    queryKey: queryKeys.products.barcode(code),
    queryFn: () => scanBarcode(code),
    enabled: Boolean(code && enabled),
    retry: false,
    staleTime: 1000 * 30,
  })
}
