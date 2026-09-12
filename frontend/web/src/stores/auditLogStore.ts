import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface AuditLog {
  id: string
  action: string
  category?: string
  target?: string
  actor_name?: string
  actor_role?: string
  details?: string
  metadata?: Record<string, unknown>
  occurred_at?: string
  created_at?: string
  by?: string
  time?: string
  ip?: string
  ip_address?: string
  device?: string
  user_id?: string
  user_name?: string
  description?: string
  subject_type?: string
  subject_id?: string
}

export interface AuditLogFilters {
  page?: number
  per_page?: number
  user_id?: string
  category?: string
  action?: string
  date_from?: string
  date_to?: string
  from?: string
  to?: string
  search?: string
}

export const useAuditLogStore = defineStore('auditLog', () => {
  const logs = ref<AuditLog[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  const meta = ref<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null)

  async function fetchLogs(filters: AuditLogFilters = {}, append = false) {
    if (append) {
      loadingMore.value = true
    } else {
      loading.value = true
    }
    error.value = null
    try {
      const res = await api.get('/audit-logs', { params: filters })
      const incoming = res.data.data || []
      if (append) {
        const existingIds = new Set(logs.value.map(l => l.id))
        logs.value = [...logs.value, ...incoming.filter((l: AuditLog) => !existingIds.has(l.id))]
      } else {
        logs.value = incoming
      }
      meta.value = res.data.meta
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch audit logs'
      throw e
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  const isLoading = computed(() => loading.value)
  const logList = computed(() => logs.value)

  return {
    logs,
    loading,
    loadingMore,
    error,
    meta,
    isLoading,
    logList,
    fetchLogs,
  }
})
