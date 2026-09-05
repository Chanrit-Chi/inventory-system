import { useMemo } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import {
  getOrders,
  getOrderDetails,
  getSalesChannels,
  fetchCustomers,
  getCustomerDetails,
  searchCustomers,
} from '../../api/endpoints'
import type { Order, SalesChannel, Customer } from '../../types'

export interface OrderFilters {
  search?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}

/**
 * Fetch orders list with status and date filtering
 */
export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: async () => {
      const res = await getOrders(filters)
      const raw = res.data
      if (Array.isArray(raw)) {
        return raw as Order[]
      }
      return (raw as { data?: Order[] })?.data ?? []
    },
    staleTime: 1000 * 60, // 1 min
  })
}

/**
 * Infinite scroll query for orders list with pagination
 */
export function useInfiniteOrders(filters?: Omit<OrderFilters, 'page'>) {
  const queryKey = useMemo(
    () => queryKeys.orders.infinite(filters),
    [filters?.search, filters?.status, filters?.date_from, filters?.date_to, filters?.per_page]
  )

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const res = await getOrders({ ...filters, page: pageParam as number })
      return res
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage?.meta
      if (!meta) {
        const dataLength = Array.isArray(lastPage?.data)
          ? lastPage.data.length
          : Array.isArray(lastPage)
          ? lastPage.length
          : 0
        return dataLength >= (filters?.per_page ?? 15) ? undefined : undefined
      }
      return meta.current_page < meta.last_page ? meta.current_page + 1 : undefined
    },
    staleTime: 1000 * 60, // 1 min
  })
}

/**
 * Fetch single order detail by ID
 */
export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null
      return getOrderDetails(id)
    },
    enabled: Boolean(id),
  })
}

/**
 * Fetch active sales channels
 */
export function useChannels() {
  return useQuery<SalesChannel[]>({
    queryKey: queryKeys.channels.list(),
    queryFn: () => getSalesChannels(),
    staleTime: 1000 * 60 * 10, // 10 mins
  })
}

/**
 * Fetch customers list
 */
export function useCustomers(params?: { search?: string; page?: number }) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: async () => {
      const res = await fetchCustomers(params)
      const raw = res.data
      if (Array.isArray(raw)) {
        return raw as Customer[]
      }
      return (raw as { data?: Customer[] })?.data ?? []
    },
    staleTime: 1000 * 60 * 3,
  })
}

/**
 * Customer search autocomplete
 */
export function useCustomerSearchQuery(search: string, enabled = true) {
  return useQuery<Customer[]>({
    queryKey: queryKeys.customers.search(search),
    queryFn: ({ signal }) => searchCustomers(search, 10, signal),
    enabled: Boolean(search && search.trim().length >= 2 && enabled),
    staleTime: 1000 * 30,
  })
}
