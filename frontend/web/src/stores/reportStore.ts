import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface SalesReport {
  period: string
  total_orders: number
  total_revenue: number
  total_discounts: number
  total_tax: number
  avg_order_value: number
  top_products: Array<{ name: string; quantity: number; revenue: number }>
}

export interface InventoryReport {
  total_products: number
  total_variants: number
  low_stock_count: number
  out_of_stock_count: number
  total_stock_value: number
  categories_breakdown: Array<{ name: string; count: number }>
}

export interface StaffPerformanceReport {
  user_id: string
  user_name: string
  total_orders: number
  total_sales: number
  avg_order_value: number
  top_products_sold: number
}

export const useReportStore = defineStore('report', () => {
  const salesReport = ref<SalesReport | null>(null)
  const inventoryReport = ref<InventoryReport | null>(null)
  const staffReport = ref<StaffPerformanceReport[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSalesAnalytics(params?: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/reports/analytics', { params })
      salesReport.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch sales analytics'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchStaffPerformance(params?: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/dashboard/staff-performance', { params })
      staffReport.value = res.data.data || []
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch staff performance'
      throw e
    } finally {
      loading.value = false
    }
  }

  const isLoading = computed(() => loading.value)

  return {
    salesReport,
    inventoryReport,
    staffReport,
    loading,
    error,
    isLoading,
    fetchSalesAnalytics,
    fetchStaffPerformance,
  }
})
