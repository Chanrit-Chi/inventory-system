import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { ApiError } from '@/api/axios'

export interface SalesChartBar {
  label: string
  val: number
}

export interface TopProductItem {
  name: string
  sales?: number
  quantity?: number
  revenue: number
}

export interface PaymentBreakdownItem {
  method: string
  count: number
  total: number
  percentage: number
}

export interface SalesReport {
  period: string
  date_from?: string
  date_to?: string
  revenue: number
  total_revenue: number
  ordersCount: number
  total_orders: number
  avgTicket: number
  avg_order_value: number
  total_tax?: number
  total_discounts?: number
  cogs?: number
  profit: number
  gross_profit: number
  gross_margin_pct?: number
  expenses: number
  total_expenses: number
  netProfit: number
  net_profit: number
  net_margin_pct?: number
  topProducts?: TopProductItem[]
  top_products?: TopProductItem[]
  paymentBreakdown?: PaymentBreakdownItem[]
  payment_breakdown?: PaymentBreakdownItem[]
  chartBars?: SalesChartBar[]
}

export interface InventoryCategoryItem {
  category: string
  items_count: number
  total_units: number
  cost_value: number
  retail_value: number
}

export interface DeadStockItem {
  sku: string
  name: string
  category: string
  quantity: number
  cost_value: number
}

export interface InventoryReport {
  total_skus: number
  total_products: number
  total_units: number
  cost_value: number
  retail_value: number
  potential_profit: number
  potential_margin_pct: number
  healthy_count: number
  low_stock_count: number
  out_of_stock_count: number
  categories_breakdown: InventoryCategoryItem[]
  dead_stock_items: DeadStockItem[]
}

export interface StaffPerformanceItem {
  rank?: number
  user_id: string
  user_name: string
  staff_name?: string
  staff_role?: string
  orders_count: number
  total_orders: number
  total_revenue: number
  total_sales: number
  avg_basket: number
  avg_order_value: number
  units_sold: number
  top_products_sold?: number
}

export const useReportStore = defineStore('report', () => {
  const salesReport = ref<SalesReport | null>(null)
  const inventoryReport = ref<InventoryReport | null>(null)
  const staffReport = ref<StaffPerformanceItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSalesAnalytics(params?: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/reports/analytics', { params })
      const raw = res.data.data || {}
      salesReport.value = {
        period: raw.period || '30d',
        date_from: raw.date_from,
        date_to: raw.date_to,
        revenue: raw.revenue ?? raw.total_revenue ?? 0,
        total_revenue: raw.total_revenue ?? raw.revenue ?? 0,
        ordersCount: raw.ordersCount ?? raw.total_orders ?? 0,
        total_orders: raw.total_orders ?? raw.ordersCount ?? 0,
        avgTicket: raw.avgTicket ?? raw.avg_order_value ?? 0,
        avg_order_value: raw.avg_order_value ?? raw.avgTicket ?? 0,
        total_tax: raw.total_tax ?? 0,
        total_discounts: raw.total_discounts ?? 0,
        cogs: raw.cogs ?? 0,
        profit: raw.profit ?? raw.gross_profit ?? 0,
        gross_profit: raw.gross_profit ?? raw.profit ?? 0,
        gross_margin_pct: raw.gross_margin_pct ?? 0,
        expenses: raw.expenses ?? raw.total_expenses ?? 0,
        total_expenses: raw.total_expenses ?? raw.expenses ?? 0,
        netProfit: raw.netProfit ?? raw.net_profit ?? 0,
        net_profit: raw.net_profit ?? raw.netProfit ?? 0,
        net_margin_pct: raw.net_margin_pct ?? 0,
        topProducts: raw.topProducts || raw.top_products || [],
        top_products: raw.top_products || raw.topProducts || [],
        paymentBreakdown: raw.paymentBreakdown || raw.payment_breakdown || [],
        payment_breakdown: raw.payment_breakdown || raw.payment_breakdown || [],
        chartBars: raw.chartBars || [],
      }
      return salesReport.value
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
      const rawList = res.data.data?.leaderboard || (Array.isArray(res.data.data) ? res.data.data : [])
      staffReport.value = rawList.map((s: Record<string, unknown>, idx: number) => ({
        rank: Number(s.rank || idx + 1),
        user_id: String(s.user_id || ''),
        user_name: String(s.staff_name || s.user_name || 'Staff Member'),
        staff_name: String(s.staff_name || s.user_name || 'Staff Member'),
        staff_role: String(s.staff_role || 'Cashier'),
        orders_count: Number(s.orders_count || s.total_orders || 0),
        total_orders: Number(s.total_orders || s.orders_count || 0),
        total_revenue: Number(s.total_revenue || s.total_sales || 0),
        total_sales: Number(s.total_sales || s.total_revenue || 0),
        avg_basket: Number(s.avg_basket || s.avg_order_value || 0),
        avg_order_value: Number(s.avg_order_value || s.avg_basket || 0),
        units_sold: Number(s.units_sold || 0),
        top_products_sold: Number(s.top_products_sold || s.units_sold || 0),
      }))
      return staffReport.value
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch staff performance'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchInventoryAnalytics() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/reports/inventory')
      inventoryReport.value = res.data.data
      return res.data.data
    } catch (e: unknown) {
      error.value = e instanceof ApiError ? e.message : 'Failed to fetch inventory analytics'
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
    fetchInventoryAnalytics,
  }
})

