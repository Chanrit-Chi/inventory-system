import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import { fetchExpenses, createExpense, deleteExpense, BackendExpense } from '../../api/endpoints'
import type { PaginatedData } from '../../types'

export interface ExpenseFilters {
  search?: string
  category?: string
  date_from?: string
  date_to?: string
  payment_method?: string
  page?: number
  per_page?: number
}

/**
 * Query for operational expenses
 */
export function useExpenses(filters?: ExpenseFilters) {
  return useQuery({
    queryKey: queryKeys.expenses.list(filters),
    queryFn: async () => {
      const res = await fetchExpenses(filters)
      const raw = res.data
      if (Array.isArray(raw)) {
        return raw as BackendExpense[]
      }
      return (raw as PaginatedData<BackendExpense>)?.data ?? [] as BackendExpense[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

/**
 * Mutation for recording an expense
 */
export function useCreateExpenseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: {
      title?: string
      expense_date: string
      category: string
      amount: number
      payment_method: string
      notes?: string
    }) => createExpense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}

/**
 * Mutation for deleting an expense
 */
export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}
