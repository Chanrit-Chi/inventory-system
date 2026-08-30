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
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  StatCard,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
} from '@/components/ui'

const toast = useToast()
const store = useReportStore()

const activeTab = ref<'sales' | 'staff' | 'inventory'>('sales')
const filters = ref({
  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  group_by: 'day' as 'day' | 'week' | 'month',
})

const sales = computed(() => store.salesReport)
const staff = computed(() => store.staffReport)

async function loadSales() {
  try {
    await store.fetchSalesAnalytics({
      from: filters.value.from,
      to: filters.value.to,
      group_by: filters.value.group_by,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load sales analytics')
  }
}

async function loadStaff() {
  try {
    await store.fetchStaffPerformance({
      from: filters.value.from,
      to: filters.value.to,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load staff performance')
  }
}

function switchTab(tab: typeof activeTab.value) {
  activeTab.value = tab
  if (tab === 'sales') loadSales()
  if (tab === 'staff') loadStaff()
}

function exportCSV(kind: string) {
  toast.info(`Exporting ${kind} report as CSV...`)
}

function formatMoney(n: number | string | undefined | null) {
  const val = typeof n === 'string' ? parseFloat(n) : (n || 0)
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

onMounted(loadSales)
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
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" @click="exportCSV(activeTab)">
          <Download :size="14" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3">
      <div class="flex items-center gap-3 flex-wrap">
        <div>
          <label class="block text-[11px] font-semibold text-muted-foreground mb-1">From Date</label>
          <Input type="date" v-model="filters.from" class="h-8 w-36 bg-surface text-xs font-mono" />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-muted-foreground mb-1">To Date</label>
          <Input type="date" v-model="filters.to" class="h-8 w-36 bg-surface text-xs font-mono" />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Group By</label>
          <select
            v-model="filters.group_by"
            class="h-8 px-2.5 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        class="h-8 px-4 text-xs gap-1.5"
        :disabled="store.loading"
        @click="activeTab === 'sales' ? loadSales() : loadStaff()"
      >
        <RefreshCw :size="13" :class="{ 'animate-spin': store.loading }" />
        <span>Apply Filters</span>
      </Button>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-border gap-2">
      <button
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'sales' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('sales')"
      >
        <BarChart3 :size="14" />
        <span>Sales & Revenue</span>
      </button>

      <button
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'staff' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('staff')"
      >
        <Users :size="14" />
        <span>Staff Performance</span>
      </button>

      <button
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'inventory' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('inventory')"
      >
        <Package :size="14" />
        <span>Inventory Summary</span>
      </button>
    </div>

    <!-- Tab 1: Sales Analytics -->
    <div v-if="activeTab === 'sales'" class="space-y-6">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
      </div>

      <template v-else-if="sales">
        <!-- Sales KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Orders"
            :value="sales.total_orders ?? 0"
            sub="Transactions"
            :icon="ShoppingBag"
            icon-variant="primary"
          />
          <StatCard
            label="Total Revenue"
            :value="formatMoney(sales.total_revenue)"
            sub="Net sales volume"
            :icon="DollarSign"
            icon-variant="success"
          />
          <StatCard
            label="Avg Order Value"
            :value="formatMoney(sales.avg_order_value)"
            sub="Per receipt ticket"
            :icon="TrendingUp"
            icon-variant="warning"
          />
          <StatCard
            label="Tax Collected"
            :value="formatMoney(sales.total_tax)"
            sub="VAT / GST amount"
            :icon="Receipt"
            icon-variant="purple"
          />
        </div>

        <!-- Top Selling Products Table -->
        <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div class="p-4 border-b border-border bg-surface-subtle/40">
            <h3 class="font-display font-bold text-sm text-foreground">Top Selling Products</h3>
            <p class="text-[11px] text-muted-foreground">Ranked by overall sales revenue for selected date window.</p>
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
                <TableRow class="bg-muted/40">
                  <TableHead>Product Name</TableHead>
                  <TableHead class="font-mono text-center">Quantity Sold</TableHead>
                  <TableHead class="font-mono text-right">Revenue Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(p, i) in (sales.top_products || [])" :key="i" class="hover:bg-surface-subtle/80 transition-colors">
                  <TableCell class="font-semibold text-foreground">
                    {{ p.name }}
                  </TableCell>
                  <TableCell class="font-mono text-xs text-center font-bold tabular-nums">
                    {{ p.quantity }}
                  </TableCell>
                  <TableCell class="font-mono text-sm font-bold text-success text-right tabular-nums">
                    {{ formatMoney(p.revenue) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </template>
    </div>

    <!-- Tab 2: Staff Performance -->
    <div v-if="activeTab === 'staff'" class="space-y-4">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <div v-else class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div class="p-4 border-b border-border bg-surface-subtle/40">
          <h3 class="font-display font-bold text-sm text-foreground">Staff Register Performance</h3>
          <p class="text-[11px] text-muted-foreground">Orders processed, gross sales volume, and ticket averages per cashier.</p>
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
              <TableRow class="bg-muted/40">
                <TableHead>Staff Member</TableHead>
                <TableHead class="font-mono text-center">Orders Count</TableHead>
                <TableHead class="font-mono">Total Sales</TableHead>
                <TableHead class="font-mono">Avg Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="s in staff" :key="s.user_id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell class="font-semibold text-foreground flex items-center gap-2">
                  <Users :size="14" class="text-primary" />
                  <span>{{ s.user_name }}</span>
                </TableCell>
                <TableCell class="font-mono text-xs text-center font-bold tabular-nums">
                  {{ s.total_orders }}
                </TableCell>
                <TableCell class="font-mono text-sm font-bold text-success tabular-nums">
                  {{ formatMoney(s.total_sales) }}
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                  {{ formatMoney(s.avg_order_value) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

    <!-- Tab 3: Inventory Analytics -->
    <div v-if="activeTab === 'inventory'" class="rounded-xl border border-border bg-card p-6 shadow-xs text-center space-y-3">
      <div class="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
        <Package :size="24" />
      </div>
      <h3 class="font-display font-bold text-base text-foreground">Inventory Analytics Dashboard</h3>
      <p class="text-xs text-muted-foreground max-w-md mx-auto">
        Real-time inventory turns, dead stock valuation, and reorder projections are available directly via the Inventory Ledger view.
      </p>
    </div>
  </div>
</template>
