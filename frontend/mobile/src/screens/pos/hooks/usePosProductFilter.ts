import { useState, useMemo, useCallback } from 'react'
import type { Product } from '../../../types'
import type {
  PosSortOption,
  PosStockOption,
  PosStatusOption,
  PosProductTypeOption,
} from '../components/PosFilterModal'

export interface UsePosProductFilterProps {
  selectedCategory: string
  debouncedSearchQuery: string
}

export interface UsePosProductFilterReturn {
  stockFilter: PosStockOption
  setStockFilter: (v: PosStockOption) => void
  statusFilter: PosStatusOption
  setStatusFilter: (v: PosStatusOption) => void
  productTypeFilter: PosProductTypeOption
  setProductTypeFilter: (v: PosProductTypeOption) => void
  sortBy: PosSortOption
  setSortBy: (v: PosSortOption) => void
  filterModalOpen: boolean
  setFilterModalOpen: (v: boolean) => void
  resolvedIsActive: boolean | undefined
  includeInactive: boolean | undefined
  filterProducts: (products: Product[]) => Product[]
  activeFiltersCount: number
  resetFilters: () => void
  getProductTotalStock: (p: Product) => number
}

export function usePosProductFilter({
  selectedCategory,
  setSelectedCategory,
  debouncedSearchQuery,
}: UsePosProductFilterProps): UsePosProductFilterReturn {
  const [stockFilter, setStockFilter] = useState<PosStockOption>('ALL')
  const [statusFilter, setStatusFilter] = useState<PosStatusOption>('ACTIVE')
  const [productTypeFilter, setProductTypeFilter] = useState<PosProductTypeOption>('ALL')
  const [sortBy, setSortBy] = useState<PosSortOption>('DEFAULT')
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const resolvedIsActive = useMemo(() => {
    if (statusFilter === 'ACTIVE') return true
    if (statusFilter === 'DEACTIVATED') return false
    return undefined
  }, [statusFilter])

  const includeInactive = useMemo(() => {
    return statusFilter === 'ALL' || statusFilter === 'DEACTIVATED' ? true : undefined
  }, [statusFilter])

  const getProductTotalStock = useCallback((p: Product): number => {
    if (p.variants && p.variants.length > 0) {
      return p.variants.reduce((sum, v) => sum + (Number(v.quantity_on_hand) || 0), 0)
    }
    if ((p as any).total_stock !== undefined) {
      return Number((p as any).total_stock) || 0
    }
    if ((p as any).quantity_on_hand !== undefined) {
      return Number((p as any).quantity_on_hand) || 0
    }
    return 0
  }, [])

  const filterProducts = useCallback((productsList: Product[]): Product[] => {
    const result = productsList.filter((p) => {
      // 1. Category Filter
      const matchCat =
        selectedCategory === 'All' ||
        p.category?.name?.toLowerCase() === selectedCategory.toLowerCase()
      if (!matchCat) return false

      // 2. Status Filter
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? p.is_active !== false : p.is_active === false)
      if (!matchStatus) return false

      // 3. Stock Level Filter
      const totalStock = getProductTotalStock(p)
      if (stockFilter === 'IN_STOCK') {
        if (totalStock <= 0) return false
      } else if (stockFilter === 'LOW_STOCK') {
        const reorder = p.default_reorder_level ?? 5
        if (totalStock <= 0 || totalStock > reorder) return false
      } else if (stockFilter === 'OUT_OF_STOCK') {
        if (totalStock > 0) return false
      }

      // 4. Product Type Filter
      const isVariable =
        Boolean(p.variants && p.variants.length > 1) ||
        Boolean(
          p.variants?.[0]?.attribute_values &&
            p.variants[0].attribute_values.length > 0
        )
      if (productTypeFilter === 'SIMPLE' && isVariable) return false
      if (productTypeFilter === 'VARIABLE' && !isVariable) return false

      // 5. Search Filter
      if (!debouncedSearchQuery.trim()) return true
      const q = debouncedSearchQuery.toLowerCase().trim()
      const matchName = p.name?.toLowerCase().includes(q)
      const matchSku = p.sku?.toLowerCase().includes(q)
      const matchBarcode = p.barcode?.toLowerCase().includes(q)
      const matchVariant = p.variants?.some(
        (v) =>
          v.sku?.toLowerCase().includes(q) ||
          v.name?.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q) ||
          v.attribute_values?.some(
            (av) =>
              av.value_name?.toLowerCase().includes(q) ||
              av.attribute?.name?.toLowerCase().includes(q)
          )
      )
      return matchName || matchSku || matchBarcode || matchVariant
    })

    // 6. Sorting
    if (sortBy === 'NAME_ASC') {
      return [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    if (sortBy === 'NAME_DESC') {
      return [...result].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    }
    if (sortBy === 'PRICE_ASC') {
      const getPrice = (prod: Product) => {
        const val = prod.selling_price
        return typeof val === 'number' ? val : parseFloat(String(val || '0')) || 0
      }
      return [...result].sort((a, b) => getPrice(a) - getPrice(b))
    }
    if (sortBy === 'PRICE_DESC') {
      const getPrice = (prod: Product) => {
        const val = prod.selling_price
        return typeof val === 'number' ? val : parseFloat(String(val || '0')) || 0
      }
      return [...result].sort((a, b) => getPrice(b) - getPrice(a))
    }
    if (sortBy === 'STOCK_ASC') {
      return [...result].sort((a, b) => getProductTotalStock(a) - getProductTotalStock(b))
    }
    if (sortBy === 'STOCK_DESC') {
      return [...result].sort((a, b) => getProductTotalStock(b) - getProductTotalStock(a))
    }

    return result
  }, [
    selectedCategory,
    statusFilter,
    stockFilter,
    productTypeFilter,
    debouncedSearchQuery,
    sortBy,
    getProductTotalStock,
  ])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (stockFilter !== 'ALL') count++
    if (statusFilter !== 'ACTIVE') count++
    if (productTypeFilter !== 'ALL') count++
    if (sortBy !== 'DEFAULT') count++
    return count
  }, [stockFilter, statusFilter, productTypeFilter, sortBy])

  const resetFilters = useCallback(() => {
    setStockFilter('ALL')
    setStatusFilter('ACTIVE')
    setProductTypeFilter('ALL')
    setSortBy('DEFAULT')
  }, [])

  return {
    stockFilter,
    setStockFilter,
    statusFilter,
    setStatusFilter,
    productTypeFilter,
    setProductTypeFilter,
    sortBy,
    setSortBy,
    filterModalOpen,
    setFilterModalOpen,
    resolvedIsActive,
    includeInactive,
    filterProducts,
    activeFiltersCount,
    resetFilters,
    getProductTotalStock,
  }
}
