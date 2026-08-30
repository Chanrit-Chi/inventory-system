import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient, QueryKey } from '@tanstack/react-query'
import { PaginatedData, ApiResponse } from '../../types'

function createDebounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return (...args: A) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), waitMs)
  }
}

export interface UseEntityListOptions<T, F extends Record<string, unknown> = Record<string, unknown>> {
  queryKeyFactory: (params: { page: number; search?: string; filters?: F }) => QueryKey
  queryFn: (params: { page: number; search?: string; filters?: F }) => Promise<ApiResponse<PaginatedData<T>> | ApiResponse<T[]> | T[]>
  initialFilters?: F
  debounceMs?: number
  enabled?: boolean
}

export interface UseEntityListResult<T, F extends Record<string, unknown> = Record<string, unknown>> {
  items: T[]
  loading: boolean
  isRefreshing: boolean
  error: Error | null
  searchTerm: string
  setSearchTerm: (term: string) => void
  filters: F
  setFilters: React.Dispatch<React.SetStateAction<F>>
  updateFilter: <K extends keyof F>(key: K, value: F[K]) => void
  page: number
  setPage: (page: number) => void
  hasMore: boolean
  onRefresh: () => Promise<void>
  refetch: () => Promise<unknown>
}

/**
 * Generalized TanStack Query hook for list management across mobile entities.
 * Handles debounced search, filtering, pagination, and pull-to-refresh.
 */
export function useEntityList<T, F extends Record<string, unknown> = Record<string, unknown>>({
  queryKeyFactory,
  queryFn,
  initialFilters = {} as F,
  debounceMs = 300,
  enabled = true,
}: UseEntityListOptions<T, F>): UseEntityListResult<T, F> {
  const queryClient = useQueryClient()
  const [page, setPage] = useState<number>(1)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [filters, setFilters] = useState<F>(initialFilters)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Debounced search handler
  const debouncedSetSearch = useMemo(
    () =>
      createDebounce((text: string) => {
        setDebouncedSearch(text)
        setPage(1)
      }, debounceMs),
    [debounceMs]
  )

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchTerm(text)
      debouncedSetSearch(text)
    },
    [debouncedSetSearch]
  )

  const updateFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const queryKey = useMemo(
    () => queryKeyFactory({ page, search: debouncedSearch, filters }),
    [queryKeyFactory, page, debouncedSearch, filters]
  )

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => queryFn({ page, search: debouncedSearch, filters }),
    enabled,
  })

  // Normalize data array
  const { items, hasMore } = useMemo(() => {
    if (!data) return { items: [] as T[], hasMore: false }

    if (Array.isArray(data)) {
      return { items: data, hasMore: false }
    }

    if ('data' in data) {
      const payload = data.data
      if (Array.isArray(payload)) {
        return { items: payload, hasMore: false }
      }
      if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data)) {
        const paginated = payload as PaginatedData<T>
        const hasNext = paginated.current_page < paginated.last_page
        return { items: paginated.data, hasMore: hasNext }
      }
    }

    return { items: [] as T[], hasMore: false }
  }, [data])

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }, [refetch])

  return {
    items,
    loading: isLoading,
    isRefreshing,
    error: error as Error | null,
    searchTerm,
    setSearchTerm: handleSearchChange,
    filters,
    setFilters,
    updateFilter,
    page,
    setPage,
    hasMore,
    onRefresh,
    refetch,
  }
}
