import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import { fetchInvoices, fetchQuotations } from '../../api/endpoints'
import type { Invoice, Quotation } from '../../types'

export interface InvoiceFilters {
  search?: string
  status?: string
  page?: number
  per_page?: number
}

/**
 * Query for invoices list
 */
export function useInvoices(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: async () => {
      const res = await fetchInvoices(filters)
      const raw = res.data
      if (Array.isArray(raw)) {
        return raw as Invoice[]
      }
      return (raw as { data?: Invoice[] })?.data ?? []
    },
    staleTime: 1000 * 60 * 2,
  })
}

/**
 * Query for single invoice detail
 */
export function useInvoice(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null
      const res = await fetchInvoices({ search: id })
      const raw = res.data
      const list = Array.isArray(raw) ? raw : (raw as { data?: Invoice[] })?.data ?? []
      return list.find((inv: Invoice) => inv.id === id) ?? null
    },
    enabled: Boolean(id),
  })
}

/**
 * Query for quotations list
 */
export function useQuotations(filters?: { search?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: queryKeys.quotations.list(filters),
    queryFn: async () => {
      const res = await fetchQuotations(filters)
      const raw = res.data
      if (Array.isArray(raw)) {
        return raw as Quotation[]
      }
      return (raw as { data?: Quotation[] })?.data ?? []
    },
    staleTime: 1000 * 60 * 2,
  })
}
