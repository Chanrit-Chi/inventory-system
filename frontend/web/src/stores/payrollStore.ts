import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface PayrollUser {
  id: string
  name: string
  email: string
  role: string
  department?: string
  avatar_url?: string
}

export interface Payroll {
  id: string
  user_id: string
  user?: PayrollUser
  period_month: number
  period_year: number
  status: 'DRAFT' | 'FINALIZED' | 'PAID' | string
  base_salary: number
  working_days: number
  actual_working_days?: number
  performance_benefit: number
  delivery_benefit: number
  overtime_days: number
  overtime_pay: number
  unpaid_leave_days: number
  unpaid_leave_deduction: number
  collective_benefit?: number
  other_benefits?: number
  incentive_override?: number | null
  incentive_amount?: number
  sales_commission?: number
  overtime_amount?: number
  thirteenth_month_accrual?: number
  thirteenth_month_contribution?: number
  thirteenth_month_payout?: number
  gross_salary: number
  tax_deduction: number
  total_net_pay: number
  payment_method?: string | null
  paid_at?: string | null
  created_at?: string
  updated_at?: string

  // Compatibility aliases for legacy views/tests
  period_start?: string
  period_end?: string
  total_gross?: number
  total_deductions?: number
  total_net?: number
  employee_count?: number
}

export interface StaffThirteenthMonthReserve {
  user_id: string
  name: string
  email: string
  role: string
  department: string
  base_salary: number
  monthly_accrual: number
  months_accrued: number
  accrued_months?: number[]
  monthly_breakdown?: Array<{
    payroll_id?: string
    month?: number
    year?: number
    amount?: number
    status?: string
    [key: string]: any
  }>
  month_specific_accrual?: number | null
  total_accrued: number
  total_disbursed: number
  available_balance: number
  payouts: Array<{
    id: string
    user_id: string
    amount: number
    payout_date: string
    payment_method: string
    notes?: string
  }>
}

export interface CompanyThirteenthMonthReservesData {
  year?: number | null
  kpi: {
    company_total_accrued: number
    company_total_disbursed: number
    company_total_available_balance: number
    eligible_staff_count: number
  }
  staff: StaffThirteenthMonthReserve[]
}

// Alias for backwards compatibility
export type PayrollRun = Payroll

export interface UserSalaryRecord {
  id?: string
  user_id: string
  base_salary: number
  effective_from?: string | null
  currency?: string
  created_at?: string
}

export interface ThirteenthMonthSummary {
  user_id: string
  user_name?: string
  total_accrued: number
  total_paid_out: number
  total_disbursed?: number
  available_balance: number
  history?: Array<{
    id: string
    fiscal_year: number
    amount: number
    notes?: string
    created_at: string
  }>
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from?: number
  to?: number
}

export interface GeneratePayrollPayload {
  month: number
  year: number
  all_staff?: boolean
  user_id?: string
  user_ids?: string[]
  batch?: boolean
  // Legacy compatibility
  period_start?: string
  period_end?: string
}

export interface UpdatePayrollPayload {
  working_days?: number
  performance_benefit?: number
  delivery_benefit?: number
  overtime_days?: number
  unpaid_leave_days?: number
  collective_benefit?: number
  other_benefits?: number
  incentive_override?: number | null
  thirteenth_month_payout?: number
  status?: 'DRAFT' | 'FINALIZED' | 'PAID'
}

export const usePayrollStore = defineStore('payroll', () => {
  const payrolls = ref<Payroll[]>([])
  const currentPayroll = ref<Payroll | null>(null)
  const userSalaries = ref<Record<string, UserSalaryRecord>>({})
  const thirteenthMonthSummaries = ref<Record<string, ThirteenthMonthSummary>>({})
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  // Alias for compatibility
  const payrollRuns = computed(() => payrolls.value)

  function getLastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate()
  }

  function normalizePayroll(p: any): Payroll {
    const periodMonth = parseInt(String(p.period_month ?? (p.period_start ? new Date(p.period_start).getMonth() + 1 : new Date().getMonth() + 1)), 10)
    const periodYear = parseInt(String(p.period_year ?? (p.period_start ? new Date(p.period_start).getFullYear() : new Date().getFullYear())), 10)
    const net = p.total_net_pay ?? p.total_net ?? 0
    const gross = p.gross_salary ?? p.total_gross ?? 0
    const deductions = (p.unpaid_leave_deduction ?? 0) + (p.tax_deduction ?? 0) || (p.total_deductions ?? 0)
    const commission = p.incentive_amount ?? p.sales_commission ?? 0
    const otPay = p.overtime_amount ?? p.overtime_pay ?? 0
    const thirteenthAccrual = p.thirteenth_month_contribution ?? p.thirteenth_month_accrual ?? 0
    const lastDay = getLastDayOfMonth(periodYear, periodMonth)

    return {
      ...p,
      period_month: periodMonth,
      period_year: periodYear,
      status: String(p.status || 'DRAFT').toUpperCase(),
      base_salary: parseFloat(String(p.base_salary ?? gross)) || 0,
      working_days: parseInt(String(p.working_days ?? 26), 10) || 26,
      performance_benefit: parseFloat(String(p.performance_benefit ?? 0)) || 0,
      delivery_benefit: parseFloat(String(p.delivery_benefit ?? 0)) || 0,
      overtime_days: parseFloat(String(p.overtime_days ?? 0)) || 0,
      overtime_pay: parseFloat(String(otPay)) || 0,
      overtime_amount: parseFloat(String(otPay)) || 0,
      unpaid_leave_days: parseFloat(String(p.unpaid_leave_days ?? 0)) || 0,
      unpaid_leave_deduction: parseFloat(String(p.unpaid_leave_deduction ?? 0)) || 0,
      collective_benefit: parseFloat(String(p.collective_benefit ?? 0)) || 0,
      other_benefits: parseFloat(String(p.other_benefits ?? 0)) || 0,
      incentive_amount: parseFloat(String(commission)) || 0,
      incentive_override: p.incentive_override !== null && p.incentive_override !== undefined ? parseFloat(String(p.incentive_override)) : null,
      sales_commission: parseFloat(String(commission)) || 0,
      thirteenth_month_contribution: parseFloat(String(thirteenthAccrual)) || 0,
      thirteenth_month_accrual: parseFloat(String(thirteenthAccrual)) || 0,
      thirteenth_month_payout: parseFloat(String(p.thirteenth_month_payout ?? 0)) || 0,
      gross_salary: parseFloat(String(gross)) || 0,
      tax_deduction: parseFloat(String(p.tax_deduction ?? 0)) || 0,
      total_net_pay: parseFloat(String(net)) || 0,
      // Dynamic period range
      period_start: p.period_start || `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`,
      period_end: p.period_end || `${periodYear}-${String(periodMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      total_gross: parseFloat(String(gross)) || 0,
      total_deductions: parseFloat(String(deductions)) || 0,
      total_net: parseFloat(String(net)) || 0,
      employee_count: p.employee_count ?? 1,
    }
  }

  async function fetchPayrolls(params?: {
    month?: number | string
    year?: number | string
    status?: string
    page?: number
    per_page?: number
  }) {
    loading.value = true
    error.value = null
    try {
      const cleanParams: Record<string, unknown> = {}
      if (params) {
        if (params.month && params.month !== 'ALL') cleanParams.month = params.month
        if (params.year && params.year !== 'ALL') cleanParams.year = params.year
        if (params.page) cleanParams.page = params.page
        if (params.per_page) cleanParams.per_page = params.per_page
      }

      const res = await api.get('/payrolls', { params: cleanParams })
      const rawList = res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
      payrolls.value = rawList.map(normalizePayroll)
      meta.value = res.data?.meta ?? null
      return payrolls.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch payrolls'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Alias
  const fetchPayrollRuns = fetchPayrolls

  async function fetchPayroll(id: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/payrolls/${id}`)
      const raw = res.data?.data ?? res.data
      const normalized = normalizePayroll(raw)
      currentPayroll.value = normalized
      return normalized
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch payroll'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function generatePayroll(payload: GeneratePayrollPayload) {
    mutating.value = true
    error.value = null
    try {
      let reqPayload: Record<string, unknown> = { ...payload }
      if (payload.period_start && (!payload.month || !payload.year)) {
        const d = new Date(payload.period_start)
        reqPayload.month = d.getMonth() + 1
        reqPayload.year = d.getFullYear()
        reqPayload.all_staff = true
      }

      const res = await api.post('/payrolls/generate', reqPayload)
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to generate payroll'
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function updatePayroll(id: string, payload: UpdatePayrollPayload) {
    mutating.value = true
    error.value = null
    try {
      const res = await api.put(`/payrolls/${id}`, payload)
      const updated = normalizePayroll(res.data?.data ?? res.data)
      const idx = payrolls.value.findIndex(p => p.id === id)
      if (idx !== -1) {
        payrolls.value[idx] = updated
      }
      if (currentPayroll.value?.id === id) {
        currentPayroll.value = updated
      }
      return updated
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to update payroll'
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function bulkUpdateStatus(ids: string[], status: string) {
    mutating.value = true
    error.value = null
    try {
      const res = await api.post('/payrolls/bulk-status', {
        ids,
        status: status.toUpperCase(),
      })
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to bulk update payrolls'
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function deletePayroll(id: string) {
    mutating.value = true
    error.value = null
    try {
      await api.delete(`/payrolls/${id}`)
      payrolls.value = payrolls.value.filter(p => p.id !== id)
      if (currentPayroll.value?.id === id) {
        currentPayroll.value = null
      }
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to delete payroll'
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function fetchUserSalary(userId: string) {
    try {
      const res = await api.get(`/users/${userId}/salary`)
      const data = res.data?.data ?? res.data
      if (data) {
        userSalaries.value[userId] = data
      }
      return data
    } catch (e: unknown) {
      console.warn('Could not fetch salary for user:', userId, e)
      return null
    }
  }

  async function setUserSalary(userId: string, payload: { base_salary: number; effective_from?: string; currency?: string }) {
    mutating.value = true
    try {
      const res = await api.post(`/users/${userId}/salary`, payload)
      const data = res.data?.data ?? res.data
      userSalaries.value[userId] = data
      return data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to set salary'
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function fetchThirteenthMonthSavings(userId: string) {
    try {
      const res = await api.get(`/users/${userId}/savings`)
      const data = res.data?.data ?? res.data
      if (data) {
        thirteenthMonthSummaries.value[userId] = data
      }
      return data
    } catch (e: unknown) {
      console.warn('Could not fetch 13th month savings for user:', userId, e)
      return null
    }
  }

  async function recordStandalonePayout(userId: string, payload: { amount: number; notes?: string; fiscal_year?: number }) {
    mutating.value = true
    try {
      const res = await api.post(`/users/${userId}/savings/payout`, payload)
      await fetchThirteenthMonthSavings(userId)
      return res.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to record payout'
      throw e
    } finally {
      mutating.value = false
    }
  }

  const companyReserves = ref<CompanyThirteenthMonthReservesData | null>(null)
  const loadingReserves = ref(false)

  async function fetchCompanyReserves(year?: number | 'ALL', month?: number | 'ALL') {
    loadingReserves.value = true
    try {
      const params = {
        year: year && year !== 'ALL' ? year : undefined,
        month: month && month !== 'ALL' ? month : undefined,
      }
      let res
      try {
        res = await api.get('/payrolls/13th-month-reserves', { params })
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 405 || status === 404) {
          try {
            res = await api.get('/payrolls/company-thirteenth-month-reserves', { params })
          } catch {
            res = await api.get('/payrolls/reserves', { params })
          }
        } else {
          throw err
        }
      }
      const data = res.data?.data ?? res.data
      companyReserves.value = data
      return data
    } catch (e: unknown) {
      console.warn('Could not fetch company 13th month reserves:', e)
      return null
    } finally {
      loadingReserves.value = false
    }
  }

  const isLoading = computed(() => loading.value || mutating.value)

  return {
    payrolls,
    payrollRuns,
    currentPayroll,
    userSalaries,
    thirteenthMonthSummaries,
    companyReserves,
    loadingReserves,
    meta,
    loading,
    mutating,
    error,
    isLoading,
    fetchPayrolls,
    fetchPayrollRuns,
    fetchPayroll,
    generatePayroll,
    updatePayroll,
    bulkUpdateStatus,
    deletePayroll,
    fetchUserSalary,
    setUserSalary,
    fetchThirteenthMonthSavings,
    recordStandalonePayout,
    fetchCompanyReserves,
  }
})

