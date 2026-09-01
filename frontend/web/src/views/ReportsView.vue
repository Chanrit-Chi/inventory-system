<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useReportStore } from '@/stores/reportStore'
import { useToast } from '@/composables/useToast'
import {
  BarChart3,
  Users,
  Package,
  Download,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Receipt,
  RefreshCw,
  CreditCard,
  Wallet,
  Building2,
  Layers,
  Archive,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  StatCard,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
  DatePicker,
} from '@/components/ui'

const toast = useToast()
const store = useReportStore()

const activeTab = ref<'sales' | 'staff' | 'inventory'>('sales')
const selectedPeriod = ref<'today' | '7d' | '30d' | 'year' | 'custom'>('30d')

const filters = ref({
  from: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
})

const hoveredBar = ref<{ label: string; val: number } | null>(null)

const sales = computed(() => store.salesReport)
const staff = computed(() => store.staffReport)
const inventory = computed(() => store.inventoryReport)

const maxChartValue = computed(() => {
  if (!sales.value?.chartBars?.length) return 100
  const max = Math.max(...sales.value.chartBars.map(b => b.val || 0))
  return max > 0 ? max : 100
})

function selectPeriod(period: 'today' | '7d' | '30d' | 'year' | 'custom') {
  selectedPeriod.value = period
  const now = new Date()
  if (period === 'today') {
    filters.value.from = now.toISOString().slice(0, 10)
    filters.value.to = now.toISOString().slice(0, 10)
  } else if (period === '7d') {
    const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
    filters.value.from = d.toISOString().slice(0, 10)
    filters.value.to = now.toISOString().slice(0, 10)
  } else if (period === '30d') {
    const d = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    filters.value.from = d.toISOString().slice(0, 10)
    filters.value.to = now.toISOString().slice(0, 10)
  } else if (period === 'year') {
    const d = new Date(now.getFullYear(), 0, 1)
    filters.value.from = d.toISOString().slice(0, 10)
    filters.value.to = now.toISOString().slice(0, 10)
  }
  refreshAll()
}

async function loadSales() {
  try {
    const params: Record<string, unknown> = {}
    if (selectedPeriod.value === 'custom') {
      params.period = 'custom'
      params.date_from = filters.value.from
      params.date_to = filters.value.to
    } else {
      params.period = selectedPeriod.value
    }
    await store.fetchSalesAnalytics(params)
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load sales analytics')
  }
}

async function loadStaff() {
  try {
    const params: Record<string, unknown> = {}
    if (selectedPeriod.value === 'custom') {
      params.period = 'custom'
      params.date_from = filters.value.from
      params.date_to = filters.value.to
    } else {
      params.period = selectedPeriod.value
    }
    await store.fetchStaffPerformance(params)
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load staff performance')
  }
}

async function loadInventory() {
  try {
    if (typeof store.fetchInventoryAnalytics !== 'function') {
      console.warn('[ReportsView] fetchInventoryAnalytics not available yet')
      return
    }
    await store.fetchInventoryAnalytics()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load inventory valuation')
  }
}

async function refreshAll() {
  await Promise.allSettled([loadSales(), loadStaff(), loadInventory()])
}

function switchTab(tab: typeof activeTab.value) {
  activeTab.value = tab
  if (tab === 'sales' && !sales.value) loadSales()
  else if (tab === 'staff' && !staff.value.length) loadStaff()
  else if (tab === 'inventory' && !inventory.value) loadInventory()
}

function formatMoney(n: number | string | undefined | null) {
  const val = typeof n === 'string' ? parseFloat(n) : (n || 0)
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csvContent = rows
    .map(row =>
      row
        .map(field => {
          const str = String(field ?? '')
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    )
    .join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportCSV(kind: string) {
  const todayStr = new Date().toISOString().slice(0, 10)
  if (kind === 'sales') {
    if (!sales.value) {
      toast.error('No sales data available to export.')
      return
    }
    const rows: (string | number)[][] = [
      ['OmniPOS Sales & Revenue Analytics Report'],
      ['Exported Date', todayStr],
      ['Period', selectedPeriod.value],
      ['Date Range', `${filters.value.from} to ${filters.value.to}`],
      [],
      ['--- KEY PERFORMANCE INDICATORS ---'],
      ['Total Revenue ($)', sales.value.total_revenue],
      ['Total Completed Orders', sales.value.total_orders],
      ['Average Ticket Size ($)', sales.value.avg_order_value],
      ['Total Tax Collected ($)', sales.value.total_tax ?? 0],
      ['Total Discounts ($)', sales.value.total_discounts ?? 0],
      ['Cost of Goods Sold (COGS) ($)', sales.value.cogs ?? 0],
      ['Gross Profit ($)', sales.value.gross_profit],
      ['Gross Margin (%)', `${sales.value.gross_margin_pct ?? 0}%`],
      ['Operational Expenses ($)', sales.value.total_expenses],
      ['Net Profit ($)', sales.value.net_profit],
      ['Net Margin (%)', `${sales.value.net_margin_pct ?? 0}%`],
      [],
      ['--- TOP SELLING PRODUCTS ---'],
      ['Rank', 'Product Name', 'Units Sold', 'Revenue ($)'],
    ]

    const products = sales.value.top_products || sales.value.topProducts || []
    products.forEach((p, i) => {
      rows.push([i + 1, p.name, p.quantity ?? p.sales ?? 0, p.revenue])
    })

    rows.push([])
    rows.push(['--- PAYMENT METHODS BREAKDOWN ---'])
    rows.push(['Payment Method', 'Transactions Count', 'Total Volume ($)', 'Share (%)'])
    const payments = sales.value.payment_breakdown || sales.value.paymentBreakdown || []
    payments.forEach(pay => {
      rows.push([pay.method, pay.count, pay.total, `${pay.percentage}%`])
    })

    downloadCSV(`sales-report-${todayStr}.csv`, rows)
    toast.success('Sales report exported to CSV successfully.')
  } else if (kind === 'staff') {
    if (!staff.value?.length) {
      toast.error('No staff performance data available to export.')
      return
    }
    const rows: (string | number)[][] = [
      ['OmniPOS Staff Register Productivity Report'],
      ['Exported Date', todayStr],
      ['Date Range', `${filters.value.from} to ${filters.value.to}`],
      [],
      ['Rank', 'Staff Member', 'Role', 'Orders Processed', 'Total Sales Volume ($)', 'Units Sold', 'Average Basket ($)'],
    ]

    staff.value.forEach(s => {
      rows.push([
        s.rank ?? '',
        s.user_name || s.staff_name || 'Staff',
        s.staff_role || 'Cashier',
        s.total_orders,
        s.total_sales,
        s.units_sold,
        s.avg_order_value,
      ])
    })

    downloadCSV(`staff-performance-${todayStr}.csv`, rows)
    toast.success('Staff performance report exported to CSV.')
  } else if (kind === 'inventory') {
    if (!inventory.value) {
      toast.error('No inventory analytics data available to export.')
      return
    }
    const rows: (string | number)[][] = [
      ['OmniPOS Inventory Valuation & Stock Health Report'],
      ['Exported Date', todayStr],
      [],
      ['--- ASSET VALUATION METRICS ---'],
      ['Total Tracked SKUs', inventory.value.total_skus],
      ['Total Units on Hand', inventory.value.total_units],
      ['Wholesale Cost Valuation ($)', inventory.value.cost_value],
      ['Estimated Retail Value ($)', inventory.value.retail_value],
      ['Unrealized Gross Margin ($)', inventory.value.potential_profit],
      ['Gross Profit Margin (%)', `${inventory.value.potential_margin_pct}%`],
      ['Healthy In-Stock SKUs', inventory.value.healthy_count],
      ['Low Stock Alert SKUs', inventory.value.low_stock_count],
      ['Depleted / Out-of-Stock SKUs', inventory.value.out_of_stock_count],
      [],
      ['--- CATEGORY VALUATION BREAKDOWN ---'],
      ['Category Name', 'Items Count', 'Total Units', 'Wholesale Cost ($)', 'Retail Value ($)'],
    ]

    inventory.value.categories_breakdown.forEach(cat => {
      rows.push([cat.category, cat.items_count, cat.total_units, cat.cost_value, cat.retail_value])
    })

    if (inventory.value.dead_stock_items?.length) {
      rows.push([])
      rows.push(['--- SLOW MOVING & DEAD STOCK (30+ DAYS NO SALES) ---'])
      rows.push(['SKU', 'Product Name', 'Category', 'Quantity on Hand', 'Tied-up Cost Capital ($)'])
      inventory.value.dead_stock_items.forEach(d => {
        rows.push([d.sku, d.name, d.category, d.quantity, d.cost_value])
      })
    }

    downloadCSV(`inventory-valuation-${todayStr}.csv`, rows)
    toast.success('Inventory valuation report exported to CSV.')
  }
}

onMounted(() => {
  loadSales()
  loadStaff()
  loadInventory()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Reports & Analytics</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            Business Intelligence
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Omnichannel revenue performance, staff register productivity, and inventory turn analytics.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs shadow-2xs" @click="exportCSV(activeTab)">
          <Download :size="14" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>

    <!-- Period Selector & Filter Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      <!-- Quick Range Presets -->
      <div class="inline-flex h-9 items-center rounded-lg border border-border bg-surface-subtle p-0.5 gap-0.5 flex-wrap">
        <button
          v-for="p in [
            { label: 'Today', val: 'today' },
            { label: 'Last 7 Days', val: '7d' },
            { label: 'Last 30 Days', val: '30d' },
            { label: 'This Year', val: 'year' },
            { label: 'Custom Range', val: 'custom' },
          ]"
          :key="p.val"
          class="h-7.5 px-3 flex items-center rounded-md text-xs font-medium transition-all cursor-pointer"
          :class="selectedPeriod === p.val
            ? 'bg-cta text-cta-foreground font-semibold shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'"
          @click="selectPeriod(p.val as any)"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Custom Date Inputs (when Custom Range selected) -->
      <div class="flex items-center gap-2.5 flex-wrap">
        <div v-if="selectedPeriod === 'custom'" class="flex items-center gap-2">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground font-medium">From:</span>
            <DatePicker v-model="filters.from" placeholder="From date" class="h-8 w-34 bg-surface text-xs" />
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground font-medium">To:</span>
            <DatePicker v-model="filters.to" placeholder="To date" class="h-8 w-34 bg-surface text-xs" />
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          class="h-8.5 px-3.5 text-xs gap-1.5 cursor-pointer ml-auto sm:ml-0"
          :disabled="store.loading"
          @click="refreshAll"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': store.loading }" />
          <span>Refresh Data</span>
        </Button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-border gap-2 overflow-x-auto no-scrollbar">
      <button
        class="px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer"
        :class="activeTab === 'sales' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('sales')"
      >
        <BarChart3 :size="15" />
        <span>Sales & Revenue</span>
      </button>

      <button
        class="px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer"
        :class="activeTab === 'staff' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('staff')"
      >
        <Users :size="15" />
        <span>Staff Performance</span>
      </button>

      <button
        class="px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer"
        :class="activeTab === 'inventory' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('inventory')"
      >
        <Package :size="15" />
        <span>Inventory Valuation</span>
      </button>
    </div>

    <!-- TAB 1: Sales & Revenue -->
    <div v-if="activeTab === 'sales'" class="space-y-6 min-h-[480px]">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
      </div>

      <template v-else-if="sales">
        <!-- Sales KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Gross Revenue"
            :value="formatMoney(sales.total_revenue)"
            :sub="`${sales.total_orders} completed orders`"
            :icon="DollarSign"
            icon-variant="success"
          />
          <StatCard
            label="Completed Orders"
            :value="sales.total_orders"
            sub="Registered transactions"
            :icon="ShoppingBag"
            icon-variant="primary"
          />
          <StatCard
            label="Avg Ticket Value"
            :value="formatMoney(sales.avg_order_value)"
            sub="Average receipt basket"
            :icon="TrendingUp"
            icon-variant="warning"
          />
          <StatCard
            label="Tax Collected"
            :value="formatMoney(sales.total_tax)"
            sub="VAT & sales taxes"
            :icon="Receipt"
            icon-variant="neutral"
          />
        </div>

        <!-- Interactive Revenue Trend Chart Card -->
        <div class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 class="font-display font-bold text-sm text-foreground">Revenue Trend Over Time</h3>
              <p class="text-[11px] text-muted-foreground">Aggregated order volume across the selected time period.</p>
            </div>
            <Badge variant="neutral" class="font-mono text-xs">
              {{ sales.chartBars?.length ?? 0 }} Data Points
            </Badge>
          </div>

          <!-- SVG Interactive Bar Visualizer -->
          <div v-if="sales.chartBars?.length" class="space-y-2">
            <div class="relative h-48 sm:h-56 w-full flex items-end gap-1.5 sm:gap-3 pt-6 pb-2 border-b border-border/80 px-2 bg-surface-subtle/50 rounded-lg">
              <!-- Bar Columns -->
              <div
                v-for="(bar, idx) in sales.chartBars"
                :key="idx"
                class="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                @mouseenter="hoveredBar = bar"
                @mouseleave="hoveredBar = null"
              >
                <!-- Tooltip on hover -->
                <div
                  v-if="hoveredBar?.label === bar.label"
                  class="absolute -top-9 z-20 bg-foreground text-background text-[11px] font-mono py-1 px-2 rounded-md shadow-md whitespace-nowrap pointer-events-none"
                >
                  {{ bar.label }}: {{ formatMoney(bar.val) }}
                </div>

                <!-- Vertical Bar -->
                <div
                  class="w-full max-w-[36px] rounded-t-md transition-all duration-300 group-hover:brightness-95 group-hover:scale-y-105 origin-bottom"
                  :class="bar.val > 0 ? 'bg-cta' : 'bg-border h-1'"
                  :style="{
                    height: bar.val > 0 ? `${Math.max(8, (bar.val / maxChartValue) * 100)}%` : '4px'
                  }"
                />
              </div>
            </div>

            <!-- Horizontal Labels -->
            <div class="flex items-center justify-between text-[10px] sm:text-xs font-mono text-muted-foreground px-2">
              <span v-for="(bar, idx) in sales.chartBars" :key="idx" class="flex-1 text-center truncate px-0.5">
                {{ bar.label }}
              </span>
            </div>
          </div>

          <EmptyState
            v-else
            :icon="BarChart3"
            title="No trend data"
            description="No transaction records available for this selected date interval."
          />
        </div>

        <!-- Profit & Loss and Payment Distribution Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Profit & Loss Summary Card -->
          <div class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h3 class="font-display font-bold text-sm text-foreground">Profit &amp; Loss</h3>
                <p class="text-[11px] text-muted-foreground mt-0.5">Revenue minus COGS and operational expenses.</p>
              </div>
              <Badge
                :variant="(sales.net_margin_pct ?? 0) >= 0 ? 'success' : 'error'"
                class="text-xs font-semibold shrink-0 whitespace-nowrap"
              >
                {{ sales.net_margin_pct ?? 0 }}% Net Margin
              </Badge>
            </div>

            <div class="space-y-2.5 bg-surface-subtle/80 p-4 rounded-xl border border-border">
              <!-- Gross Revenue -->
              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground font-medium min-w-0 truncate">Gross Revenue</span>
                <span class="font-mono font-bold text-foreground shrink-0">{{ formatMoney(sales.total_revenue) }}</span>
              </div>
              <!-- COGS -->
              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground font-medium min-w-0 truncate">COGS</span>
                <span class="font-mono font-semibold text-rose-600 dark:text-rose-400 shrink-0">-{{ formatMoney(sales.cogs) }}</span>
              </div>
              <div class="h-px bg-border" />
              <!-- Gross Profit -->
              <div class="flex items-center justify-between gap-4 text-xs">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-bold text-foreground">Gross Profit</span>
                  <span class="text-[10px] text-muted-foreground shrink-0">({{ sales.gross_margin_pct ?? 0 }}%)</span>
                </div>
                <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{{ formatMoney(sales.gross_profit) }}</span>
              </div>
              <!-- Expenses -->
              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground font-medium min-w-0 truncate">Operational Expenses</span>
                <span class="font-mono font-semibold text-rose-600 dark:text-rose-400 shrink-0">-{{ formatMoney(sales.total_expenses) }}</span>
              </div>
              <div class="h-px bg-border" />
              <!-- Net Profit -->
              <div class="flex items-center justify-between gap-4 pt-0.5">
                <span class="font-bold text-sm text-foreground">Net Profit</span>
                <span
                  class="font-mono font-extrabold text-base shrink-0"
                  :class="(sales.net_profit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                >
                  {{ formatMoney(sales.net_profit) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Payment Methods Breakdown -->
          <div class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between gap-4">
            <div>
              <div class="flex items-center justify-between">
                <h3 class="font-display font-bold text-sm text-foreground">Payment Methods Breakdown</h3>
                <Badge variant="neutral" class="text-xs font-mono">
                  {{ sales.payment_breakdown?.length ?? 0 }} Methods
                </Badge>
              </div>
              <p class="text-[11px] text-muted-foreground mt-0.5">Distribution of collected payments by tender type.</p>
            </div>

            <div v-if="sales.payment_breakdown?.length" class="space-y-3">
              <div
                v-for="p in sales.payment_breakdown"
                :key="p.method"
                class="p-3 rounded-lg border border-border bg-card shadow-2xs flex items-center justify-between gap-3"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-center text-primary">
                    <Wallet v-if="p.method.toLowerCase().includes('cash')" :size="16" />
                    <CreditCard v-else-if="p.method.toLowerCase().includes('card')" :size="16" />
                    <Building2 v-else :size="16" />
                  </div>
                  <div>
                    <div class="font-bold text-xs text-foreground">{{ p.method }}</div>
                    <div class="text-[11px] text-muted-foreground">{{ p.count }} transaction{{ p.count === 1 ? '' : 's' }}</div>
                  </div>
                </div>

                <div class="text-right">
                  <div class="font-mono font-bold text-xs text-foreground">{{ formatMoney(p.total) }}</div>
                  <div class="text-[10px] font-mono text-muted-foreground font-semibold">{{ p.percentage }}% share</div>
                </div>
              </div>
            </div>

            <EmptyState
              v-else
              :icon="Receipt"
              title="No payment records"
              description="No completed payment transactions recorded in this period."
            />
          </div>
        </div>

        <!-- Top Selling Products Leaderboard -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div class="p-4 border-b border-border bg-surface-subtle">
            <h3 class="font-display font-bold text-sm text-foreground">Top Selling Products Leaderboard</h3>
            <p class="text-[11px] text-muted-foreground">Ranked by overall sales revenue for the active date range.</p>
          </div>

          <EmptyState
            v-if="!sales.top_products?.length"
            :icon="Package"
            title="No product sales recorded"
            description="No product sales records found in this selected date range."
          />

          <div v-else class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-surface-subtle text-muted-foreground border-b border-border">
                  <TableHead class="w-12 text-center">Rank</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead class="font-mono text-center w-32">Units Sold</TableHead>
                  <TableHead class="font-mono text-right w-44">Revenue Generated</TableHead>
                  <TableHead class="w-36 text-right">Revenue Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody class="divide-y divide-border/70">
                <TableRow
                  v-for="(p, i) in (sales.top_products || [])"
                  :key="i"
                  class="hover:bg-surface-subtle/60 transition-colors"
                >
                  <TableCell class="text-center font-bold font-mono text-xs text-muted-foreground">
                    <span
                      v-if="i === 0"
                      class="inline-flex w-5 h-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold"
                    >1</span>
                    <span
                      v-else-if="i === 1"
                      class="inline-flex w-5 h-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px] font-bold"
                    >2</span>
                    <span
                      v-else-if="i === 2"
                      class="inline-flex w-5 h-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-bold"
                    >3</span>
                    <span v-else>{{ i + 1 }}</span>
                  </TableCell>
                  <TableCell class="font-bold text-xs text-foreground">
                    {{ p.name }}
                  </TableCell>
                  <TableCell class="font-mono text-xs text-center font-bold tabular-nums">
                    <span class="px-2 py-0.5 rounded-md bg-card border border-border text-foreground">
                      {{ p.quantity ?? p.sales ?? 0 }} units
                    </span>
                  </TableCell>
                  <TableCell class="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                    {{ formatMoney(p.revenue) }}
                  </TableCell>
                  <TableCell class="text-right font-mono text-xs">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-16 h-2 rounded-full bg-surface-subtle border border-border overflow-hidden">
                        <div
                          class="h-full bg-cta"
                          :style="{
                            width: `${sales.total_revenue > 0 ? Math.min(100, Math.round((p.revenue / sales.total_revenue) * 100)) : 0}%`
                          }"
                        />
                      </div>
                      <span class="text-[11px] text-muted-foreground font-semibold w-8 text-right">
                        {{ sales.total_revenue > 0 ? Math.round((p.revenue / sales.total_revenue) * 100) : 0 }}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </template>
    </div>

    <!-- TAB 2: Staff Performance -->
    <div v-if="activeTab === 'staff'" class="space-y-6 min-h-[480px]">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
      </div>

      <div v-else class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div class="p-4 border-b border-border bg-surface-subtle flex items-center justify-between">
          <div>
            <h3 class="font-display font-bold text-sm text-foreground">Cashier & Staff Register Productivity</h3>
            <p class="text-[11px] text-muted-foreground">Transactions processed, sales volume, and ticket averages per team member.</p>
          </div>
          <Badge variant="neutral" class="font-mono text-xs">
            {{ staff.length }} Active Staff
          </Badge>
        </div>

        <EmptyState
          v-if="!staff.length"
          :icon="Users"
          title="No staff checkout records"
          description="No cashier checkout transactions found for this selected period."
        />

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-surface-subtle text-muted-foreground border-b border-border">
                <TableHead class="w-14 text-center">Rank</TableHead>
                <TableHead>Staff Member</TableHead>
                <TableHead class="w-32">Role</TableHead>
                <TableHead class="font-mono text-center w-32">Orders Count</TableHead>
                <TableHead class="font-mono text-center w-28">Units Sold</TableHead>
                <TableHead class="font-mono text-right w-36">Total Sales Volume</TableHead>
                <TableHead class="font-mono text-right w-32">Avg Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody class="divide-y divide-border/70">
              <TableRow
                v-for="s in staff"
                :key="s.user_id"
                class="hover:bg-surface-subtle/60 transition-colors"
              >
                <TableCell class="text-center font-bold font-mono text-xs">
                  <span
                    v-if="s.rank === 1"
                    class="inline-flex w-6 h-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold"
                  >🥇</span>
                  <span
                    v-else-if="s.rank === 2"
                    class="inline-flex w-6 h-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold"
                  >🥈</span>
                  <span
                    v-else-if="s.rank === 3"
                    class="inline-flex w-6 h-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold"
                  >🥉</span>
                  <span v-else class="text-muted-foreground font-semibold">#{{ s.rank }}</span>
                </TableCell>
                <TableCell class="font-semibold text-foreground">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-cta-muted border border-border-strong flex items-center justify-center text-primary font-bold text-xs">
                      {{ (s.user_name || s.staff_name || 'U').charAt(0).toUpperCase() }}
                    </div>
                    <span>{{ s.user_name || s.staff_name }}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="neutral" class="text-[11px] capitalize">
                    {{ s.staff_role || 'Staff' }}
                  </Badge>
                </TableCell>
                <TableCell class="font-mono text-xs text-center font-bold tabular-nums">
                  {{ s.total_orders }}
                </TableCell>
                <TableCell class="font-mono text-xs text-center tabular-nums text-muted-foreground">
                  {{ s.units_sold }}
                </TableCell>
                <TableCell class="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                  {{ formatMoney(s.total_sales) }}
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground text-right tabular-nums">
                  {{ formatMoney(s.avg_order_value) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

    <!-- TAB 3: Inventory Valuation -->
    <div v-if="activeTab === 'inventory'" class="space-y-6 min-h-[480px]">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
      </div>

      <template v-else-if="inventory">
        <!-- Inventory Asset KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Tracked SKU Count"
            :value="inventory.total_skus"
            :sub="`${inventory.total_products} unique product lines`"
            :icon="Package"
            icon-variant="primary"
          />
          <StatCard
            label="Total Units on Hand"
            :value="inventory.total_units"
            sub="Physical stock across warehouse"
            :icon="Layers"
            icon-variant="neutral"
          />
          <StatCard
            label="Wholesale Stock Value"
            :value="formatMoney(inventory.cost_value)"
            sub="Total cost capital tied up"
            :icon="DollarSign"
            icon-variant="warning"
          />
          <StatCard
            label="Estimated Retail Value"
            :value="formatMoney(inventory.retail_value)"
            :sub="`${formatMoney(inventory.potential_profit)} unrealized margin`"
            :icon="TrendingUp"
            icon-variant="success"
          />
        </div>

        <!-- Stock Health Distribution Bar -->
        <div class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="font-display font-bold text-sm text-foreground">Stock Health & Threshold Status</h3>
            <span class="text-xs text-muted-foreground font-mono">{{ inventory.total_skus }} SKUs Tracked</span>
          </div>

          <!-- Multi-color Segmented Progress Bar -->
          <div class="h-4 w-full bg-surface-subtle border border-border rounded-full overflow-hidden flex shadow-inner">
            <div
              class="bg-emerald-500 transition-all duration-300"
              :style="{ width: `${inventory.total_skus > 0 ? (inventory.healthy_count / inventory.total_skus) * 100 : 0}%` }"
              title="Healthy Stock"
            />
            <div
              class="bg-amber-500 transition-all duration-300"
              :style="{ width: `${inventory.total_skus > 0 ? (inventory.low_stock_count / inventory.total_skus) * 100 : 0}%` }"
              title="Low Stock"
            />
            <div
              class="bg-rose-500 transition-all duration-300"
              :style="{ width: `${inventory.total_skus > 0 ? (inventory.out_of_stock_count / inventory.total_skus) * 100 : 0}%` }"
              title="Depleted / Out of Stock"
            />
          </div>

          <!-- Status Legend Badges -->
          <div class="flex items-center gap-4 flex-wrap text-xs pt-1">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span class="font-medium text-foreground">Healthy Stock:</span>
              <span class="font-mono font-bold">{{ inventory.healthy_count }} SKUs</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span class="font-medium text-foreground">Low Stock Alert:</span>
              <span class="font-mono font-bold">{{ inventory.low_stock_count }} SKUs</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span class="font-medium text-foreground">Out of Stock:</span>
              <span class="font-mono font-bold">{{ inventory.out_of_stock_count }} SKUs</span>
            </div>
          </div>
        </div>

        <!-- Category Valuation Breakdown Table -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div class="p-4 border-b border-border bg-surface-subtle flex items-center justify-between">
            <div>
              <h3 class="font-display font-bold text-sm text-foreground">Category Asset Valuation</h3>
              <p class="text-[11px] text-muted-foreground">Inventory distribution, units on hand, and wholesale cost per product category.</p>
            </div>
            <Badge variant="neutral" class="font-mono text-xs">
              {{ inventory.categories_breakdown?.length ?? 0 }} Categories
            </Badge>
          </div>

          <EmptyState
            v-if="!inventory.categories_breakdown?.length"
            :icon="Package"
            title="No category records"
            description="No inventory categorized yet."
          />

          <div v-else class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-surface-subtle text-muted-foreground border-b border-border">
                  <TableHead>Category</TableHead>
                  <TableHead class="font-mono text-center w-28">Items Count</TableHead>
                  <TableHead class="font-mono text-center w-32">Units on Hand</TableHead>
                  <TableHead class="font-mono text-right w-36">Wholesale Cost</TableHead>
                  <TableHead class="font-mono text-right w-36">Retail Asset Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody class="divide-y divide-border/70">
                <TableRow
                  v-for="cat in inventory.categories_breakdown"
                  :key="cat.category"
                  class="hover:bg-surface-subtle/60 transition-colors"
                >
                  <TableCell class="font-bold text-xs text-foreground">
                    {{ cat.category }}
                  </TableCell>
                  <TableCell class="font-mono text-xs text-center font-bold tabular-nums">
                    {{ cat.items_count }}
                  </TableCell>
                  <TableCell class="font-mono text-xs text-center font-bold tabular-nums">
                    <span class="px-2 py-0.5 rounded-md bg-card border border-border text-foreground">
                      {{ cat.total_units }} units
                    </span>
                  </TableCell>
                  <TableCell class="font-mono text-xs font-semibold text-foreground text-right tabular-nums">
                    {{ formatMoney(cat.cost_value) }}
                  </TableCell>
                  <TableCell class="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                    {{ formatMoney(cat.retail_value) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <!-- Dead Stock / Slow Movers Alert Section -->
        <div v-if="inventory.dead_stock_items?.length" class="rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-xs overflow-hidden">
          <div class="p-4 border-b border-amber-500/30 bg-amber-500/15 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Archive class="w-4 h-4 text-amber-700 dark:text-amber-300" />
              <div>
                <h3 class="font-display font-bold text-sm text-amber-900 dark:text-amber-100">Slow Moving & Dead Stock Watchlist</h3>
                <p class="text-[11px] text-amber-800 dark:text-amber-300">SKUs with positive inventory count but zero sales recorded over the last 30 days.</p>
              </div>
            </div>
            <Badge variant="warning" class="text-xs font-bold">
              {{ inventory.dead_stock_items.length }} Flagged SKUs
            </Badge>
          </div>

          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-amber-500/10 text-amber-900 dark:text-amber-200 border-b border-amber-500/20">
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead class="font-mono text-center w-28">Stock on Hand</TableHead>
                  <TableHead class="font-mono text-right w-36">Tied Capital Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody class="divide-y divide-amber-500/20">
                <TableRow v-for="d in inventory.dead_stock_items" :key="d.sku" class="hover:bg-amber-500/15 transition-colors">
                  <TableCell class="font-mono text-xs font-semibold text-amber-900 dark:text-amber-100">
                    <span class="px-2 py-0.5 rounded-md bg-card border border-border text-foreground">
                      {{ d.sku }}
                    </span>
                  </TableCell>
                  <TableCell class="font-bold text-xs text-amber-900 dark:text-amber-100">
                    {{ d.name }}
                  </TableCell>
                  <TableCell class="text-xs text-amber-800 dark:text-amber-300">
                    {{ d.category }}
                  </TableCell>
                  <TableCell class="font-mono text-xs text-center font-bold text-amber-900 dark:text-amber-100">
                    {{ d.quantity }} units
                  </TableCell>
                  <TableCell class="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 text-right">
                    {{ formatMoney(d.cost_value) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

