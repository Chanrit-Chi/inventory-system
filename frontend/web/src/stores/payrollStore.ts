import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface PayrollRun {
  id: string
  period_start: string
  period_end: string
  status: 'draft' | 'calculated' | 'approved' | 'paid'
  total_gross: number
  total_deductions: number
  total_net: number
  employee_count: number
  generated_by: string
  created_at: string
  updated_at: string
}

export interface PayrollEmployee {
  id: string
  user_id: string
  user_name: string
  base_salary: number
  allowance: number
  overtime_pay: number
  gross_salary: number
  deductions: number
  net_salary: number
  status: string
}

export interface ThirteenthMonthPayout {
  id: string
  user_id: string
  user_name: string
  fiscal_year: number
  amount: number
  paid_out: boolean
  paid_at?: string
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from?: number
  to?: number
}

export const usePayrollStore = defineStore('payroll', () => {
  const payrollRuns = ref<PayrollRun[]>([])
  const currentPayroll = ref<PayrollRun | null>(null)
  const employees = ref<PayrollEmployee[]>([])
  const thirteenthMonth = ref<ThirteenthMonthPayout[]>([])
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPayrollRuns(params?: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/payrolls', { params })
      payrollRuns.value = res.data.data || []
      meta.value = res.data.meta || null
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch payroll runs'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchPayroll(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/payrolls/${id}`)
      currentPayroll.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch payroll'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function generatePayroll(payload: { period_start: string; period_end: string }) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/payrolls/generate', payload)
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to generate payroll'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function bulkUpdateStatus(ids: string[], status: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/payrolls/bulk-status', { ids, status })
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update payroll status'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deletePayroll(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/payrolls/${id}`)
      payrollRuns.value = payrollRuns.value.filter(p => p.id !== id)
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete payroll'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)

  return {
    payrollRuns,
    currentPayroll,
    employees,
    thirteenthMonth,
    meta,
    loading,
    error,
    isLoading,
    fetchPayrollRuns,
    fetchPayroll,
    generatePayroll,
    bulkUpdateStatus,
    deletePayroll,
  }
})
