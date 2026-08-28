import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryKeys'
import {
  fetchUsers,
  fetchRoles,
  fetchPermissions,
  fetchStaffPerformance,
  fetchStaffIncentives,
  fetchAnalyticsReport,
  AnalyticsReportData,
} from '../../api/endpoints'
import type { UserAccount, RoleItem, PermissionItem } from '../../types'

/**
 * Query for staff users directory
 */
export function useStaffUsers() {
  return useQuery<UserAccount[]>({
    queryKey: queryKeys.users.list(),
    queryFn: () => fetchUsers(),
    staleTime: 1000 * 60 * 3,
  })
}

/**
 * Query for roles catalog
 */
export function useRoles() {
  return useQuery<RoleItem[]>({
    queryKey: queryKeys.roles.list(),
    queryFn: async () => {
      const res = await fetchRoles()
      return res.data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Query for available permissions catalog
 */
export function usePermissionsList() {
  return useQuery<PermissionItem[]>({
    queryKey: queryKeys.roles.permissions(),
    queryFn: async () => {
      const res = await fetchPermissions()
      return res.data ?? []
    },
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * Query for staff performance analytics
 */
export function useStaffPerformanceQuery(userId: string | null | undefined, params?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.staff.performance({ userId, ...params }),
    queryFn: async () => {
      if (!userId) return null
      const res = await fetchStaffPerformance(userId, params as any)
      return res.data
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  })
}

/**
 * Query for real-time analytics report
 */
export function useAnalyticsReportQuery(params?: Record<string, any>) {
  return useQuery<AnalyticsReportData>({
    queryKey: queryKeys.reports.analytics(params),
    queryFn: async () => {
      const res = await fetchAnalyticsReport(params as any)
      return res.data
    },
    staleTime: 1000 * 60 * 2,
  })
}
