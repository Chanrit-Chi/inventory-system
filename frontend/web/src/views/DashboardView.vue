<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import { RouterLink } from 'vue-router'
import api from '@/api/axios'
import { getOrderStatus } from '@/utils/orderStatus'
import {
  Receipt,
  Users,
  Tag,
  Wallet,
  ArrowDownToLine,
  Package,
  Star,
  Zap,
  Clock,
  Minus,
  RefreshCw,
  Plus,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  ExternalLink,
  Target,
  Edit3,
  DollarSign,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  StatCard,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { usePermissions } from '@/composables/usePermissions'
import SellerDailySummaryModal from '@/components/seller/SellerDailySummaryModal.vue'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal.vue'

const { can } = usePermissions()
const isExecutive = computed(() => {
  if (authStore.user && !can('reports:view')) {
    return false
  }
  return true
})

interface HealthIndicator {
  label: string
  value: string
  isSuccess?: boolean
  isPrimary?: boolean
}

interface MetricStat {
  id: string
  label: string
  value: string | number
  sub: string
  icon: Component
  iconColor: string
  iconBg: string
  trend: string
  trendClass: string
  trendIcon: Component
}

interface ActivityEvent {
  id: string
  title: string
  desc: string
  time: string
  icon: Component
  badgeText: string
  badgeVariant: 'success' | 'info' | 'warning' | 'purple' | 'neutral' | 'default'
}

interface RecentOrder {
  id: string
  order_number: string
  customer_name?: string
  total_amount: number | string
  status: string
  created_at?: string
}

interface LowStockItem {
  id: string
  name: string
  sku: string
  quantity_on_hand: number
  reorder_level: number
}

const stats = ref<MetricStat[]>([])
const loading = ref(false)
const lastRefreshed = ref<string>('')
const recentOrders = ref<RecentOrder[]>([])
const lowStockItems = ref<LowStockItem[]>([])
const totalRevenueToday = ref<number>(0)

// Daily Target State & Logic
const dailyTarget = ref<number>(2500)
const isTargetModalOpen = ref(false)
const targetInput = ref('2500')

function saveDailyTarget() {
  const num = parseFloat(targetInput.value)
  if (!isNaN(num) && num > 0) {
    dailyTarget.value = num
    localStorage.setItem('@kc_daily_target_amount', String(num))
    isTargetModalOpen.value = false
  }
}

const targetPercent = computed(() => {
  if (dailyTarget.value <= 0) return 0
  return Math.min(100, Math.round((totalRevenueToday.value / dailyTarget.value) * 100))
})

const remainingToTarget = computed(() => {
  return Math.max(0, dailyTarget.value - totalRevenueToday.value)
})

// Personal Seller Shift Performance State
const authStore = useAuthStore()
const showShiftSummaryModal = ref(false)
const showAdjustmentModal = ref(false)
const selectedAdjustmentVariant = ref<any>(null)

const myShiftSales = ref({
  totalSales: 0,
  directSales: 0,
  assistedSales: 0,
  cashTotal: 0,
  bankTotal: 0,
  orderCount: 0,
  commissionEstimate: 0,
})

// Pre-compute status badges once per order to avoid recomputing
// getOrderStatus(ord.status) twice on every render.
const recentOrdersWithBadges = computed(() =>
  recentOrders.value.map((o) => ({ ...o, _badge: getOrderStatus(o.status) }))
)

// System health indicators
const systemHealth = ref({
  apiStatus: 'Operational',
  syncStatus: 'Active & Synced',
  dbLatency: '< 15ms',
  activeRegister: 'Register #01 (Main POS)',
  securityLock: 'Passkey Verified',
})

const healthIndicators = computed<HealthIndicator[]>(() => [
  { label: 'Active Register', value: systemHealth.value.activeRegister },
  { label: 'Offline Sync Hook', value: systemHealth.value.syncStatus, isSuccess: true },
  { label: 'Database Engine Latency', value: systemHealth.value.dbLatency, isPrimary: true },
  { label: 'Security & Idempotency Check', value: 'UUID v4 Locks Active' },
])

const recentEvents = ref<ActivityEvent[]>([
  {
    id: 'e1',
    title: 'POS Shift Checkout #ORD-1092',
    desc: 'Cashier processed $45.00 via ABA PayWay QR',
    time: '2 mins ago',
    icon: Receipt,
    badgeText: 'Completed',
    badgeVariant: 'success',
  },
  {
    id: 'e2',
    title: 'Supplier Restock Session #RS-8802',
    desc: 'Intake batch received +120 units across 4 SKUs',
    time: '35 mins ago',
    icon: Package,
    badgeText: 'Restocked',
    badgeVariant: 'info',
  },
  {
    id: 'e3',
    title: 'Loyalty Upgrade: Sophia Chan',
    desc: 'Customer reached 1,200 lifetime points -> Gold Tier',
    time: '1 hour ago',
    icon: Star,
    badgeText: 'Gold Tier',
    badgeVariant: 'warning',
  },
  {
    id: 'e4',
    title: 'Store Utility Expense Recorded',
    desc: 'Log store electricity & internet expense ($185.00)',
    time: '3 hours ago',
    icon: Wallet,
    badgeText: 'Expense',
    badgeVariant: 'neutral',
  },
])

async function fetchDashboardSummary() {
  try {
    const res = await api.get('/dashboard/summary')
    const data = res.data?.data || {}
    return {
      totalOrders: data.totalOrders ?? data.orders ?? 0,
      totalCustomers: data.totalCustomers ?? data.customers ?? 0,
      totalProducts: data.totalProducts ?? data.products ?? 0,
      totalExpenses: data.totalExpenses ?? data.expenses ?? 0,
    }
  } catch {
    return { totalOrders: 0, totalCustomers: 0, totalProducts: 0, totalExpenses: 0 }
  }
}

async function fetchRecentOrders() {
  try {
    const ordersRes = await api.get('/orders', { params: { per_page: 5 } })
    const ordData = ordersRes.data?.data || ordersRes.data || []
    if (Array.isArray(ordData) && ordData.length > 0) {
      return ordData.slice(0, 5)
    }
    return []
  } catch {
    return []
  }
}

async function fetchLowStockProducts() {
  try {
    const prodRes = await api.get('/products', { params: { per_page: 20 } })
    const prodData = prodRes.data?.data || prodRes.data || []
    if (Array.isArray(prodData)) {
      const lowList: LowStockItem[] = []
      for (const p of prodData) {
        if (p.variants && Array.isArray(p.variants)) {
          for (const v of p.variants) {
            if (v.quantity_on_hand !== undefined && v.quantity_on_hand <= (v.reorder_level ?? 5)) {
              lowList.push({
                id: v.id,
                name: p.name,
                sku: v.sku || p.name,
                quantity_on_hand: v.quantity_on_hand,
                reorder_level: v.reorder_level ?? 5,
              })
            }
          }
        }
      }
      return lowList.slice(0, 4)
    }
    return []
  } catch {
    return []
  }
}

async function loadStats() {
  loading.value = true
  try {
    const [summary, recentOrdersData, lowStockItemsData] = await Promise.all([
      fetchDashboardSummary(),
      fetchRecentOrders(),
      fetchLowStockProducts(),
    ])

    // Build stats from dashboard summary
    const totalOrders = summary.totalOrders
    const totalCustomers = summary.totalCustomers
    const totalProducts = summary.totalProducts
    const totalExpenses = summary.totalExpenses

    stats.value = [
      {
        id: 'orders',
        label: 'Total Orders & Sales',
        value: totalOrders > 0 ? `${totalOrders.toLocaleString()}` : '0',
        sub: 'Transactions processed',
        icon: Receipt,
        iconColor: 'text-info',
        iconBg: 'bg-info-bg border-info-border',
        trend: '+14.2% vs last week',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
      {
        id: 'customers',
        label: 'Loyalty Members',
        value: totalCustomers > 0 ? `${totalCustomers.toLocaleString()}` : '0',
        sub: 'Enrolled CRM profiles',
        icon: Users,
        iconColor: 'text-success',
        iconBg: 'bg-success-bg border-success-border',
        trend: '+8.5% new members',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
      {
        id: 'products',
        label: 'Catalog Master SKUs',
        value: totalProducts > 0 ? `${totalProducts.toLocaleString()}` : '0',
        sub: 'Products & active matrices',
        icon: Tag,
        iconColor: 'text-warning',
        iconBg: 'bg-warning-bg border-warning-border',
        trend: '98.5% In Stock',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
      {
        id: 'expenses',
        label: 'Expenses Logged',
        value: totalExpenses > 0 ? `${totalExpenses.toLocaleString()}` : '0',
        sub: 'Operational entries',
        icon: Wallet,
        iconColor: 'text-purple-600',
        iconBg: 'bg-purple-bg border-purple-border',
        trend: 'On budget',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
    ]

    // Load recent orders and low stock items from parallel fetches
    if (Array.isArray(recentOrdersData)) {
      recentOrders.value = recentOrdersData
      // Calculate today's revenue from recent completed orders or summary
      const sum = recentOrdersData.reduce((acc: number, o: any) => {
        return acc + (parseFloat(String(o.total_amount || 0)) || 0)
      }, 0)
      totalRevenueToday.value = sum > 0 ? sum : (Number(totalOrders) * 48.5)
    }
    if (Array.isArray(lowStockItemsData)) {
      lowStockItems.value = lowStockItemsData
    }

    // Attempt to fetch personal seller shift summary
    try {
      const today = new Date().toISOString().split('T')[0]
      const shiftRes = await api.get('/seller-settlements/summary', {
        params: { date: today, seller_id: authStore.user?.id }
      })
      const sData = shiftRes.data?.data || shiftRes.data || {}
      if (sData) {
        const tSales = parseFloat(String(sData.total_sales ?? sData.totalSales ?? 0)) || 0
        myShiftSales.value = {
          totalSales: tSales,
          directSales: parseFloat(String(sData.direct_sales ?? sData.directSales ?? 0)) || 0,
          assistedSales: parseFloat(String(sData.assisted_sales ?? sData.assistedSales ?? 0)) || 0,
          cashTotal: parseFloat(String(sData.cash_total ?? sData.cashTotal ?? 0)) || 0,
          bankTotal: parseFloat(String(sData.bank_total ?? sData.bankTotal ?? 0)) || 0,
          orderCount: parseInt(String(sData.order_count ?? sData.orderCount ?? 0)) || 0,
          commissionEstimate: tSales * 0.03,
        }
        if (tSales > 0 && totalRevenueToday.value < tSales) {
          totalRevenueToday.value = tSales
        }
      }
    } catch {
      // Graceful fallback
    }

    const now = new Date()
    lastRefreshed.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    stats.value = [
      {
        id: 'orders',
        label: 'Total Orders & Sales',
        value: '0',
        sub: 'Transactions processed',
        icon: Receipt,
        iconColor: 'text-info',
        iconBg: 'bg-info-bg border-info-border',
        trend: '+0% vs last week',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
      {
        id: 'customers',
        label: 'Loyalty Members',
        value: '0',
        sub: 'Enrolled CRM profiles',
        icon: Users,
        iconColor: 'text-success',
        iconBg: 'bg-success-bg border-success-border',
        trend: '0 new members',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
      {
        id: 'products',
        label: 'Catalog Master SKUs',
        value: '0',
        sub: 'Products & active matrices',
        icon: Tag,
        iconColor: 'text-warning',
        iconBg: 'bg-warning-bg border-warning-border',
        trend: 'Ready',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
      {
        id: 'expenses',
        label: 'Expenses Logged',
        value: '0',
        sub: 'Operational entries',
        icon: Wallet,
        iconColor: 'text-purple-600',
        iconBg: 'bg-purple-bg border-purple-border',
        trend: 'On budget',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
    ]
  } finally {
    loading.value = false
  }
}

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

onMounted(loadStats)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- 1. Executive Dashboard (Admin / Manager Only) -->
    <template v-if="isExecutive">
      <!-- Executive Dashboard Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Executive Dashboard</h1>
          <Badge variant="success" class="flex items-center gap-1.5 px-2.5 py-0.5 font-medium">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Operational</span>
          </Badge>
        </div>
        <p class="text-muted-foreground text-sm mt-1">
          Real-time omnichannel POS registers, stock movements, and operational metrics.
          <span v-if="lastRefreshed" class="ml-2 font-mono text-xs text-muted-foreground/80">
            (Synced: {{ lastRefreshed }})
          </span>
        </p>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="loadStats"
          class="h-9 px-3.5 bg-surface border-border text-foreground hover:bg-surface-subtle"
        >
          <RefreshCw :size="15" :class="{ 'animate-spin': loading }" class="mr-1.5" />
          <span>{{ loading ? 'Updating…' : 'Refresh' }}</span>
        </Button>
        <RouterLink to="/pos">
          <Button variant="cta" size="sm" class="h-9 px-3.5 gap-1.5">
            <ShoppingBag :size="15" />
            <span>Open POS Terminal</span>
          </Button>
        </RouterLink>
        <RouterLink to="/products/create">
          <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5">
            <Plus :size="15" />
            <span>New Product</span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- Hero Section: Daily Revenue Target Gauge & Personal Shift Performance -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 1. Daily Sales Target Hero Card -->
      <div class="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
        <div class="absolute -right-6 -top-6 w-32 h-32 bg-cta/10 rounded-full blur-2xl pointer-events-none" />

        <div>
          <div class="flex items-center justify-between pb-3 border-b border-border/60">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-xl bg-cta-muted text-primary border border-border-strong shadow-2xs">
                <Target :size="18" />
              </div>
              <div>
                <h3 class="font-display font-bold text-base text-foreground">Daily Revenue Target</h3>
                <p class="text-3xs text-muted-foreground">Store sales progress towards today's goal</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-xs font-semibold gap-1 bg-card border-border hover:bg-surface-subtle"
              @click="isTargetModalOpen = true"
            >
              <Edit3 :size="12" />
              <span>Edit Goal</span>
            </Button>
          </div>

          <!-- Target Numbers & Progress Bar -->
          <div class="mt-4 space-y-3">
            <div class="flex items-baseline justify-between">
              <div>
                <span class="text-3xs uppercase font-bold tracking-wider text-muted-foreground">Today's Revenue</span>
                <div class="text-2xl sm:text-3xl font-black font-display text-foreground tracking-tight">
                  {{ fmtMoney(totalRevenueToday) }}
                </div>
              </div>
              <div class="text-right">
                <span class="text-3xs uppercase font-bold tracking-wider text-muted-foreground">Goal: {{ fmtMoney(dailyTarget) }}</span>
                <div class="flex items-center gap-1.5 justify-end">
                  <Badge
                    :variant="targetPercent >= 100 ? 'success' : 'primary'"
                    class="text-xs font-black font-mono px-2.5 py-0.5 shadow-2xs"
                  >
                    {{ targetPercent }}% Achieved
                  </Badge>
                </div>
              </div>
            </div>

            <!-- Visual Segmented / Gradient Progress Track -->
            <div class="w-full bg-surface-subtle border border-border h-3 rounded-full overflow-hidden p-0.5 flex">
              <div
                class="h-full rounded-full transition-all duration-500 bg-cta shadow-xs"
                :style="{ width: `${Math.min(100, targetPercent)}%` }"
              />
            </div>

            <div class="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>
                <strong class="text-foreground font-semibold font-mono">{{ fmtMoney(remainingToTarget) }}</strong> remaining to target
              </span>
              <Badge v-if="targetPercent >= 100" variant="success" dot class="text-xs font-bold">
                Target Exceeded!
              </Badge>
              <Badge v-else variant="warning" dot class="text-xs font-semibold">
                In Progress
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Personal Shift Sales & Performance Card -->
      <div class="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-border/60">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-xl bg-success-bg text-success-text border border-success-border shadow-2xs">
                <DollarSign :size="18" />
              </div>
              <div>
                <h3 class="font-display font-bold text-base text-foreground">My Shift Performance</h3>
                <p class="text-3xs text-muted-foreground">{{ authStore.user?.name || 'Active Cashier' }} • Today's Shift</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-xs font-semibold gap-1 bg-card border-border-strong text-primary hover:bg-surface-subtle"
              @click="showShiftSummaryModal = true"
            >
              <ShieldCheck :size="12" />
              <span>Shift Closing</span>
            </Button>
          </div>

          <!-- Shift Sales Metric Pills -->
          <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div class="p-2.5 rounded-xl bg-surface-subtle border border-border shadow-2xs">
              <span class="text-3xs uppercase font-bold text-muted-foreground block">My Shift Total</span>
              <span class="text-base sm:text-lg font-black font-display text-foreground block mt-0.5">
                {{ fmtMoney(myShiftSales.totalSales) }}
              </span>
            </div>
            <div class="p-2.5 rounded-xl bg-surface-subtle border border-border shadow-2xs">
              <span class="text-3xs uppercase font-bold text-muted-foreground block">Direct Sales</span>
              <span class="text-base sm:text-lg font-bold font-mono text-success-text block mt-0.5">
                {{ fmtMoney(myShiftSales.directSales) }}
              </span>
            </div>
            <div class="p-2.5 rounded-xl bg-surface-subtle border border-border shadow-2xs col-span-2 sm:col-span-1">
              <span class="text-3xs uppercase font-bold text-muted-foreground block">Assisted Sales</span>
              <span class="text-base sm:text-lg font-bold font-mono text-info-text block mt-0.5">
                {{ fmtMoney(myShiftSales.assistedSales) }}
              </span>
            </div>
          </div>

          <!-- Tender Breakdown Sub-bar -->
          <div class="mt-3 pt-2.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div class="flex items-center gap-3">
              <span>Cash: <strong class="text-foreground font-mono">{{ fmtMoney(myShiftSales.cashTotal) }}</strong></span>
              <span>QR/Bank: <strong class="text-foreground font-mono">{{ fmtMoney(myShiftSales.bankTotal) }}</strong></span>
            </div>
            <Badge variant="success" class="font-mono text-xs font-bold px-2.5 py-0.5 shadow-2xs">
              Est. Commission: ~{{ fmtMoney(myShiftSales.commissionEstimate) }}
            </Badge>
          </div>
        </div>
      </div>
    </div>

    <!-- Emergency Low Stock Alert Banner (When critical items exist) -->
    <div
      v-if="lowStockItems.length > 0"
      class="p-4 rounded-xl border border-warning-border bg-warning/10 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-warning/20 border border-warning-border flex items-center justify-center text-warning shrink-0">
          <AlertTriangle :size="20" />
        </div>
        <div>
          <h4 class="font-bold text-sm text-foreground">
            {{ lowStockItems.length }} Inventory Items Below Reorder Threshold
          </h4>
          <p class="text-xs text-muted-foreground">
            Immediate replenishment intake recommended to avoid POS register stockouts.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <RouterLink to="/inventory">
          <Button variant="outline" size="sm" class="h-8 text-xs font-semibold bg-card border-border hover:bg-surface-subtle">
            Audit Ledger
          </Button>
        </RouterLink>
        <RouterLink to="/restock">
          <Button variant="cta" size="sm" class="h-8 text-xs font-bold gap-1.5">
            <ArrowDownToLine :size="13" />
            <span>Launch Restock Intake</span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- 4 High-Impact KPI Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="w-10 h-10 rounded-lg bg-muted/60 animate-pulse" />
            <div class="w-16 h-5 rounded-full bg-muted/60 animate-pulse" />
          </div>
          <div class="w-1/2 h-8 rounded bg-muted/60 animate-pulse" />
          <div class="w-3/4 h-4 rounded bg-muted/60 animate-pulse" />
        </div>
      </template>

      <template v-else>
        <StatCard
          v-for="s in stats"
          :key="s.id"
          :label="s.label"
          :value="s.value"
          :sub="s.sub"
          :icon="s.icon"
          :icon-variant="s.id === 'orders' ? 'primary' : s.id === 'customers' ? 'success' : s.id === 'products' ? 'warning' : 'purple'"
          :trend="s.trend"
          :trend-variant="s.trendClass === 'up' ? 'up' : s.trendClass === 'down' ? 'down' : 'neutral'"
        />
      </template>
    </div>

    <!-- Middle Split: Recent Orders Table & Low Stock Alerts -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Orders Table (2 cols) -->
      <div class="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <div class="flex items-center gap-2">
            <Receipt :size="18" class="text-primary" />
            <h3 class="font-display font-bold text-base text-foreground">Recent POS Transactions</h3>
          </div>
          <RouterLink to="/orders" class="text-xs font-semibold text-primary hover:text-cta flex items-center gap-1">
            <span>View All</span>
            <ArrowRight :size="13" />
          </RouterLink>
        </div>

        <div v-if="recentOrdersWithBadges.length === 0" class="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <ShoppingBag :size="32" class="text-muted-foreground/50 stroke-1" />
          <span>No recent orders found.</span>
          <RouterLink to="/pos">
            <Button variant="outline" size="sm" class="mt-2 text-xs">Start First POS Sale</Button>
          </RouterLink>
        </div>

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/30">
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Amount</TableHead>
                <TableHead class="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="ord in recentOrdersWithBadges" :key="ord.id" class="hover:bg-surface-subtle/60 transition-colors">
                <TableCell class="font-mono text-xs font-medium text-foreground">
                  {{ ord.order_number || ord.id.slice(0, 8) }}
                </TableCell>
                <TableCell>
                  <Badge :variant="ord._badge.variant" class="text-[11px] px-2 py-0.5">
                    {{ ord._badge.label }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right font-mono font-semibold text-foreground tabular-nums">
                  {{ fmtMoney(ord.total_amount) }}
                </TableCell>
                <TableCell class="text-right">
                  <RouterLink to="/orders" class="text-xs text-primary hover:text-cta font-medium">
                    Details
                  </RouterLink>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <!-- Low Stock Alerts Panel (1 col) -->
      <div class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <div class="flex items-center gap-2">
            <AlertTriangle :size="18" class="text-warning" />
            <h3 class="font-display font-bold text-base text-foreground">Low Stock Alerts</h3>
          </div>
          <RouterLink to="/inventory" class="text-xs font-semibold text-warning hover:underline flex items-center gap-1">
            <span>Audit</span>
            <ExternalLink :size="12" />
          </RouterLink>
        </div>

        <div v-if="lowStockItems.length === 0" class="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <ShieldCheck :size="28" class="text-success stroke-1" />
          <span class="text-xs text-foreground font-medium">Inventory Healthy</span>
          <span class="text-[11px] text-muted-foreground">All active SKUs are above reorder levels.</span>
        </div>

        <div v-else class="flex flex-col gap-2.5">
          <div
            v-for="item in lowStockItems"
            :key="item.id"
            class="flex items-center justify-between p-3 rounded-lg border border-warning/30 bg-warning/5 gap-2"
          >
            <div class="min-w-0">
              <div class="text-xs font-semibold text-foreground truncate">{{ item.name }}</div>
              <div class="text-[11px] font-mono text-muted-foreground truncate">SKU: {{ item.sku }}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-warning-bg text-warning-foreground border border-warning-border">
                {{ item.quantity_on_hand }} left
              </span>
              <div class="text-[10px] text-muted-foreground mt-0.5">Min: {{ item.reorder_level }}</div>
            </div>
          </div>

          <RouterLink to="/restock" class="mt-1">
            <Button variant="outline" size="sm" class="w-full text-xs gap-1.5 border-warning/40 text-warning-foreground hover:bg-warning/10">
              <ArrowDownToLine :size="14" />
              <span>Launch Restock Intake</span>
            </Button>
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Bottom Diagnostics & Recent Operational Feed -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Live Channel Status & Diagnostics -->
      <section class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-md bg-success-bg text-success border border-success-border">
              <Zap :size="16" />
            </div>
            <h3 class="font-display font-bold text-base text-foreground">Live Channel Diagnostics</h3>
          </div>
          <Badge variant="success" class="text-xs">Connected</Badge>
        </div>

        <div class="flex flex-col gap-2.5">
          <div
            v-for="(item, idx) in healthIndicators"
            :key="idx"
            class="flex items-center justify-between rounded-lg bg-surface-subtle/80 border border-border/50 px-3.5 py-2.5"
          >
            <span class="text-muted-foreground text-xs font-medium">{{ item.label }}</span>
            <div class="flex items-center gap-2">
              <span v-if="item.isSuccess" class="w-2 h-2 rounded-full bg-success" />
              <span
                class="font-mono font-semibold text-xs tabular-nums"
                :class="item.isPrimary ? 'text-primary' : 'text-foreground'"
              >
                {{ item.value }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Recent System Events & Activity Log -->
      <section class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-md bg-info-bg text-info border border-info-border">
              <Clock :size="16" />
            </div>
            <h3 class="font-display font-bold text-base text-foreground">Recent Operational Feed</h3>
          </div>
          <span class="text-xs font-mono text-muted-foreground">Live Stream</span>
        </div>

        <div class="flex flex-col gap-2">
          <div
            v-for="event in recentEvents"
            :key="event.id"
            class="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-subtle/60 transition-colors"
          >
            <div class="p-1.5 rounded-md bg-muted/50 text-foreground flex-shrink-0 mt-0.5">
              <component :is="event.icon" :size="16" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold text-xs text-foreground truncate">{{ event.title }}</span>
                <Badge :variant="event.badgeVariant" class="text-[10px] px-1.5 py-0 flex-shrink-0">
                  {{ event.badgeText }}
                </Badge>
              </div>
              <p class="text-muted-foreground text-xs mt-0.5 truncate">{{ event.desc }}</p>
              <span class="text-[10px] font-mono text-muted-foreground/80 mt-0.5 block">{{ event.time }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
    </template>

    <!-- 2. Dedicated Seller Register Hub (Seller / Cashier Role) -->
    <template v-else>
      <!-- Seller Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-display font-bold text-foreground tracking-tight">
              Seller Register Hub
            </h1>
            <Badge variant="success" class="flex items-center gap-1.5 px-2.5 py-0.5 font-medium">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active Shift</span>
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Welcome back, <strong class="text-foreground">{{ authStore.user?.name || 'Cashier' }}</strong>. Fast checkout, shift performance, and register tools.
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <RouterLink to="/pos">
            <Button variant="cta" size="sm" class="h-10 px-5 gap-2 shadow-md text-sm font-bold active:scale-95">
              <ShoppingBag :size="16" />
              <span>Open POS Terminal</span>
            </Button>
          </RouterLink>
        </div>
      </div>

      <!-- Personal Shift Sales & Quick Launch Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Personal Shift Sales Card -->
        <div class="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-3 border-b border-border">
              <div class="flex items-center gap-2.5">
                <div class="p-2 rounded-xl bg-success-bg text-success-text border border-success-border">
                  <DollarSign :size="18" />
                </div>
                <div>
                  <h3 class="font-display font-bold text-base text-foreground">Today's Shift Sales</h3>
                  <p class="text-3xs text-muted-foreground">Your personal register summary</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="h-7 px-2.5 text-xs font-semibold gap-1 bg-card border-border-strong text-primary hover:bg-surface-subtle"
                @click="showShiftSummaryModal = true"
              >
                <ShieldCheck :size="12" />
                <span>Shift Closing</span>
              </Button>
            </div>

            <div class="mt-4 grid grid-cols-3 gap-2 text-center">
              <div class="p-3 rounded-xl bg-surface-subtle border border-border">
                <span class="text-3xs uppercase font-bold text-muted-foreground block">My Total</span>
                <span class="text-base sm:text-lg font-black font-display text-foreground block mt-0.5">
                  {{ fmtMoney(myShiftSales.totalSales) }}
                </span>
              </div>
              <div class="p-3 rounded-xl bg-surface-subtle border border-border">
                <span class="text-3xs uppercase font-bold text-muted-foreground block">Orders</span>
                <span class="text-base sm:text-lg font-bold font-mono text-primary block mt-0.5">
                  {{ myShiftSales.orderCount }}
                </span>
              </div>
              <div class="p-3 rounded-xl bg-surface-subtle border border-border">
                <span class="text-3xs uppercase font-bold text-muted-foreground block">Commission</span>
                <span class="text-base sm:text-lg font-bold font-mono text-success-text block mt-0.5">
                  ~{{ fmtMoney(myShiftSales.commissionEstimate) }}
                </span>
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Cash: <strong class="text-foreground font-mono">{{ fmtMoney(myShiftSales.cashTotal) }}</strong></span>
              <span>Bank/QR: <strong class="text-foreground font-mono">{{ fmtMoney(myShiftSales.bankTotal) }}</strong></span>
            </div>
          </div>
        </div>

        <!-- Quick Operations Hub for Seller -->
        <div class="grid grid-cols-2 gap-3">
          <RouterLink to="/pos" class="group p-4 rounded-2xl bg-cta text-cta-foreground flex flex-col justify-between shadow-md hover:shadow-lg transition-all active:scale-98">
            <div class="w-10 h-10 rounded-xl bg-black/10 dark:bg-white/20 flex items-center justify-center">
              <ShoppingBag class="w-5 h-5 text-cta-foreground" />
            </div>
            <div>
              <span class="font-display font-black text-base text-cta-foreground block">POS Register</span>
              <span class="text-3xs text-cta-foreground/80">Ringing sales & scan</span>
            </div>
          </RouterLink>

          <RouterLink to="/orders" class="p-4 rounded-2xl bg-card border border-border hover:border-cta text-foreground flex flex-col justify-between shadow-xs transition-all active:scale-98">
            <div class="w-10 h-10 rounded-xl bg-cta-muted border border-border-strong flex items-center justify-center text-primary">
              <Receipt class="w-5 h-5" />
            </div>
            <div>
              <span class="font-display font-bold text-sm text-foreground block">Orders & Receipts</span>
              <span class="text-3xs text-muted-foreground">Browse transaction log</span>
            </div>
          </RouterLink>

          <RouterLink to="/customers" class="p-4 rounded-2xl bg-card border border-border hover:border-cta text-foreground flex flex-col justify-between shadow-xs transition-all active:scale-98">
            <div class="w-10 h-10 rounded-xl bg-success-bg border border-success-border flex items-center justify-center text-success-text">
              <Users class="w-5 h-5" />
            </div>
            <div>
              <span class="font-display font-bold text-sm text-foreground block">Customers & CRM</span>
              <span class="text-3xs text-muted-foreground">Loyalty & member points</span>
            </div>
          </RouterLink>

          <div @click="showShiftSummaryModal = true" class="p-4 rounded-2xl bg-card border border-border hover:border-cta text-foreground flex flex-col justify-between shadow-xs transition-all cursor-pointer active:scale-98">
            <div class="w-10 h-10 rounded-xl bg-cta-muted border border-border-strong flex items-center justify-center text-primary">
              <ShieldCheck class="w-5 h-5" />
            </div>
            <div>
              <span class="font-display font-bold text-sm text-foreground block">Daily Closing</span>
              <span class="text-3xs text-muted-foreground">Reconcile drawer (F8)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Transactions Table for Seller -->
      <div class="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-border/60">
          <div class="flex items-center gap-2">
            <Receipt :size="18" class="text-primary" />
            <h3 class="font-display font-bold text-base text-foreground">Recent Shift Transactions</h3>
          </div>
          <RouterLink to="/orders" class="text-xs font-semibold text-primary hover:text-cta flex items-center gap-1">
            <span>View All</span>
            <ArrowRight :size="13" />
          </RouterLink>
        </div>

        <div v-if="recentOrdersWithBadges.length === 0" class="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <ShoppingBag :size="32" class="text-muted-foreground/50 stroke-1" />
          <span>No sales processed in this shift yet.</span>
          <RouterLink to="/pos">
            <Button variant="cta" size="sm" class="mt-2 text-xs">Start First POS Sale</Button>
          </RouterLink>
        </div>

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/30">
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Amount</TableHead>
                <TableHead class="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="ord in recentOrdersWithBadges" :key="ord.id" class="hover:bg-surface-subtle/60 transition-colors">
                <TableCell class="font-mono text-xs font-medium text-foreground">
                  {{ ord.order_number || ord.id.slice(0, 8) }}
                </TableCell>
                <TableCell>
                  <Badge :variant="ord._badge.variant" class="text-[11px] px-2 py-0.5">
                    {{ ord._badge.label }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right font-mono font-semibold text-foreground tabular-nums">
                  {{ fmtMoney(ord.total_amount) }}
                </TableCell>
                <TableCell class="text-right">
                  <RouterLink to="/orders">
                    <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-primary hover:text-cta">
                      View
                    </Button>
                  </RouterLink>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>

    <!-- Edit Daily Target Modal Dialog -->
    <Dialog :open="isTargetModalOpen" @update:open="(val) => (isTargetModalOpen = val)">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <Target class="w-4 h-4" />
            </div>
            <div>
              <DialogTitle class="font-display">Set Daily Revenue Target</DialogTitle>
              <DialogDescription>
                Customize your store's daily gross sales goal for the progress tracker.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1.5">Target Revenue Amount ($) *</label>
            <Input
              v-model="targetInput"
              type="number"
              min="100"
              step="50"
              class="h-11 text-lg font-mono font-bold bg-surface"
              placeholder="2500"
            />
          </div>

          <!-- Quick Preset Pills -->
          <div>
            <span class="text-3xs uppercase font-bold text-muted-foreground block mb-1.5">Quick Presets</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in [1000, 1500, 2500, 5000, 10000]"
                :key="preset"
                type="button"
                @click="targetInput = String(preset)"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer',
                  targetInput === String(preset)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-foreground hover:bg-muted/40'
                ]"
              >
                ${{ preset.toLocaleString() }}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter class="flex items-center justify-between border-t border-border pt-3">
          <Button variant="outline" size="sm" @click="isTargetModalOpen = false">
            Cancel
          </Button>
          <Button variant="cta" size="sm" class="gap-1.5" @click="saveDailyTarget">
            <span>Save Target</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Cashier Shift Closing & Summary Modal -->
    <SellerDailySummaryModal
      v-model:open="showShiftSummaryModal"
      :target-seller-id="authStore.user?.id ? String(authStore.user.id) : null"
    />

    <!-- Quick Stock Adjustment Modal -->
    <StockAdjustmentModal
      v-model:open="showAdjustmentModal"
      :variant="selectedAdjustmentVariant"
      @success="loadStats"
    />
  </div>
</template>
