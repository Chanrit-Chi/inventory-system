import { useQuery } from '@tanstack/react-query'
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
