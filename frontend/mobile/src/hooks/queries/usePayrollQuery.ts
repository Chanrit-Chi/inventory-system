import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import {
  fetchPayrolls,
  generatePayroll,
  updatePayroll,
  deletePayroll,
  bulkUpdatePayrollStatus,
  fetchUserSalary,
  fetchSalaryHistory,
} from '../../api/endpoints'
import type { Payroll } from '../../types'

/**
 * Query for payroll records
 */
export function usePayrolls(params?: { month?: number; year?: number }) {
  return useQuery({
    queryKey: queryKeys.payroll.list(params),
    queryFn: async () => {
      const res = await fetchPayrolls(params)
      return res.data ?? []
    },
    staleTime: 1000 * 60 * 3,
  })
}

/**
 * Query for user salary configuration
 */
export function useUserSalary(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['users', userId, 'salary'],
    queryFn: async () => {
      if (!userId) return null
      const res = await fetchUserSalary(userId)
      return res.data
    },
    enabled: Boolean(userId),
  })
}

/**
 * Query for user salary history
 */
export function useUserSalaryHistory(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['users', userId, 'salary-history'],
    queryFn: async () => {
      if (!userId) return null
      const res = await fetchSalaryHistory(userId)
      return res.data
    },
    enabled: Boolean(userId),
  })
}

/**
 * Mutation for generating payrolls
 */
export function useGeneratePayrollMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: {
      user_id?: string
      user_ids?: string[]
      all_staff?: boolean
      batch?: boolean
      month: number
      year: number
    }) => generatePayroll(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
    },
  })
}

/**
 * Mutation for bulk updating payroll statuses
 */
export function useBulkUpdatePayrollStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { ids: string[]; status: 'DRAFT' | 'FINALIZED' | 'PAID' }) =>
      bulkUpdatePayrollStatus(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all })
    },
  })
}
