import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { uploadMedia } from '../../../api/endpoints'
import { useDebounce } from '../../../hooks/useDebounce'
import { useCollapsibleHeader } from '../../../hooks/useCollapsibleHeader'
import { useProducts, useCategories, useAttributes } from '../../../hooks/queries/useProductsQuery'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../api/queryKeys'
import type { Product, ProductCategory, AttributeTaxonomy } from '../../../types'

export function useProductCatalog() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ALL')
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: rawProducts = [],
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useProducts({ include_inactive: true })

  const { data: rawCategories = [], refetch: refetchCategories } = useCategories()
  const { data: rawAttributes = [], refetch: refetchAttributes } = useAttributes()

  const [products, setProducts] = useState<Product[]>([])

  // Keep local products state synced with TanStack query data
  useEffect(() => {
    if (rawProducts) {
      setProducts(rawProducts)
    }
  }, [rawProducts])

  const [managedCategories, setManagedCategories] = useState<ProductCategory[]>([])
  const [managedAttributes, setManagedAttributes] = useState<AttributeTaxonomy[]>([])

  useEffect(() => {
    if (Array.isArray(rawCategories) && rawCategories.length > 0) {
      const mappedCats: ProductCategory[] = rawCategories.map((item: any) => ({
        id: item.id || `cat-${Date.now()}`,
        name: item.name,
        code: item.code || item.name.substring(0, 3).toUpperCase(),
        description: item.description || '',
        productCount: item.products_count ?? item.product_count ?? 0,
      }))
      setManagedCategories(mappedCats)
    }
  }, [rawCategories])

  useEffect(() => {
    if (Array.isArray(rawAttributes) && rawAttributes.length > 0) {
      const formatted: AttributeTaxonomy[] = rawAttributes.map((attr: any) => ({
        id: attr.id,
        name: attr.name,
        code: attr.code || attr.name.toUpperCase().replace(/\s+/g, '_'),
        values: attr.values?.map((v: any) => v.value_name || v.value || v) || [],
        productCount: attr.product_count || 0,
      }))
      setManagedAttributes(formatted)
    }
  }, [rawAttributes])

  const loading = productsLoading
  const catalogError = productsError ? (productsError as Error).message : null

  const { headerTranslateY, headerOpacity, onScroll, onLayoutHeader, headerHeight } =
    useCollapsibleHeader({ initialHeaderHeight: 125 })

  const pendingOfflinePhotosRef = useRef<
    Array<{ productId: string; file: { uri: string; name: string; type: string } }>
  >([])

  const syncPendingOfflinePhotos = useCallback(async () => {
    if (pendingOfflinePhotosRef.current.length === 0) return
    const remaining: Array<{ productId: string; file: { uri: string; name: string; type: string } }> = []
    for (const item of pendingOfflinePhotosRef.current) {
      try {
        const uploadRes = await uploadMedia(item.file, 'products')
        if (uploadRes?.data?.url) {
          const cloudUrl = uploadRes.data.url
          setProducts((prev) => prev.map((p) => (p.id === item.productId ? { ...p, image_url: cloudUrl } : p)))
        } else {
          remaining.push(item)
        }
      } catch (err) {
        console.warn('[useProductCatalog] Failed to upload pending photo:', err)
        remaining.push(item)
      }
    }
    pendingOfflinePhotosRef.current = remaining
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.allSettled([
      refetchProducts(),
      refetchCategories(),
      refetchAttributes(),
    ])
    syncPendingOfflinePhotos()
    setRefreshing(false)
  }, [refetchProducts, refetchCategories, refetchAttributes, syncPendingOfflinePhotos])

  const loadProducts = useCallback(() => {
    refetchProducts()
  }, [refetchProducts])

  const loadTaxonomyData = useCallback(() => {
    refetchCategories()
    refetchAttributes()
  }, [refetchCategories, refetchAttributes])

  const missingBarcodeCount = useMemo(() =>
    products.filter((p) => {
      const isVar = (p.variants && p.variants.length > 1) || (p.variants?.[0]?.attribute_values && p.variants[0].attribute_values.length > 0)
      return isVar ? p.variants?.some((v) => !v.barcode) : !p.barcode && !p.variants?.[0]?.barcode
    }).length,
  [products])

  const filterCategoryOptions = useMemo(() => {
    const list = ['ALL']
    if (missingBarcodeCount > 0) list.push('NEEDS_BARCODE')
    managedCategories.forEach((c) => { if (c.name && !list.includes(c.name)) list.push(c.name) })
    products.forEach((p) => { const cat = p.category?.name; if (cat && !list.includes(cat)) list.push(cat) })
    return list
  }, [managedCategories, products, missingBarcodeCount])

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return products.filter((p) => {
      const matchSearch =
        !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q)) ||
        p.variants?.some(
          (v) =>
            (v.name && v.name.toLowerCase().includes(q)) ||
            (v.sku && v.sku.toLowerCase().includes(q)) ||
            (v.barcode && v.barcode.toLowerCase().includes(q)) ||
            v.attribute_values?.some(
              (av: any) =>
                (av.value && av.value.toLowerCase().includes(q)) ||
                (av.value_name && av.value_name.toLowerCase().includes(q)) ||
                (av.attribute?.name && av.attribute.name.toLowerCase().includes(q))
            )
        )
      let matchCat = true
      if (categoryFilter === 'NEEDS_BARCODE') {
        const isVar = (p.variants && p.variants.length > 1) || (p.variants?.[0]?.attribute_values && p.variants[0].attribute_values.length > 0)
        matchCat = isVar ? Boolean(p.variants?.some((v) => !v.barcode)) : Boolean(!p.barcode && !p.variants?.[0]?.barcode)
      } else if (categoryFilter !== 'ALL') {
        matchCat = Boolean(p.category?.name && p.category.name.toLowerCase() === categoryFilter.toLowerCase())
      }
      const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? p.is_active !== false : p.is_active === false)
      return matchSearch && matchCat && matchStatus
    })
  }, [products, debouncedSearch, categoryFilter, statusFilter])

  return {
    products, setProducts,
    managedCategories, setManagedCategories,
    managedAttributes, setManagedAttributes,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    loading, refreshing,
    catalogError,
    filteredProducts, filterCategoryOptions, missingBarcodeCount,
    loadProducts, loadTaxonomyData, onRefresh,
    pendingOfflinePhotosRef, syncPendingOfflinePhotos,
    headerTranslateY, headerOpacity, onScroll, onLayoutHeader, headerHeight,
  }
}
