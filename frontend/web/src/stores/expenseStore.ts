import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface Expense {
  id: string
  expense_date: string
  category: string
  amount: number | string
  payment_method: string
  notes: string | null
  created_at?: string
}

export interface ExpensePaginationMeta {
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export interface RecordExpensePayload {
  expense_date: string
  category: string
  amount: number
  payment_method: string
  notes?: string
}

export const useExpenseStore = defineStore('expenses', () => {
  const expenses = ref<Expense[]>([])
  const meta = ref<ExpensePaginationMeta | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string[]> | null>(null)

  const kpis = computed(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    let totalAll = 0
    let totalToday = 0
    const catMap: Record<string, number> = {}

    for (const exp of expenses.value) {
      const amt = parseFloat(String(exp.amount)) || 0
      totalAll += amt
      if (exp.expense_date.startsWith(todayStr)) {
        totalToday += amt
      }
      catMap[exp.category] = (catMap[exp.category] || 0) + amt
    }

    let topCategory = 'None'
    let maxCatAmt = 0
    for (const [cat, amt] of Object.entries(catMap)) {
      if (amt > maxCatAmt) {
        maxCatAmt = amt
        topCategory = cat
      }
    }

    return {
      totalAll,
      totalToday,
      topCategory,
    }
  })

  async function fetchExpenses(params: {
    page?: number
    date_from?: string
    date_to?: string
    category?: string
    payment_method?: string
  } = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/expenses', { params })
      expenses.value = res.data.data ?? []
      meta.value = res.data.meta ?? null
      return expenses.value
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to fetch expenses.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function recordExpense(payload: RecordExpensePayload) {
    mutating.value = true
    error.value = null
    fieldErrors.value = null
    try {
      const res = await api.post('/expenses', payload)
      // Refresh or prepend
      await fetchExpenses()
      return res.data.data
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        error.value = e.message
        fieldErrors.value = e.errors || null
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to record expense.'
      }
      throw e
    } finally {
      mutating.value = false
    }
  }

  return {
    expenses,
    meta,
    loading,
    mutating,
    error,
    fieldErrors,
    kpis,
    fetchExpenses,
    recordExpense,
  }
})
