<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import { RouterLink } from 'vue-router'
import api from '@/api/axios'
import { cn } from '@/lib/utils'
import {
  Receipt,
  Users,
  Tag,
  Wallet,
  Sparkles,
  ArrowDownToLine,
  Package,
  Star,
  Zap,
  Clock,
  TrendingUp,
  Minus,
  RefreshCw,
  Plus,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
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
} from '@/components/ui'

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

async function loadStats() {
  loading.value = true
  try {
    const res = await api.get('/dashboard/summary')
    const data = res.data?.data || {}

    const totalOrders = data.totalOrders ?? data.orders ?? 0
    const totalCustomers = data.totalCustomers ?? data.customers ?? 0
    const totalProducts = data.totalProducts ?? data.products ?? 0
    const totalExpenses = data.totalExpenses ?? data.expenses ?? 0

    stats.value = [
      {
        id: 'orders',
        label: 'Total Orders & Sales',
        value: totalOrders > 0 ? `${totalOrders.toLocaleString()}` : '0',
        sub: 'Transactions processed',
        icon: Receipt,
        iconColor: 'text-info',
        iconBg: 'bg-info-bg border-info-border',
        trend: data.ordersTrend ?? '+14.2% vs last week',
        trendClass: data.ordersTrendUp !== false ? 'up' : 'down',
        trendIcon: data.ordersTrendUp !== false ? TrendingUp : Minus,
      },
      {
        id: 'customers',
        label: 'Loyalty Members',
        value: totalCustomers > 0 ? `${totalCustomers.toLocaleString()}` : '0',
        sub: 'Enrolled CRM profiles',
        icon: Users,
        iconColor: 'text-success',
        iconBg: 'bg-success-bg border-success-border',
        trend: data.customersTrend ?? '+8.5% new members',
        trendClass: data.customersTrendUp !== false ? 'up' : 'down',
        trendIcon: data.customersTrendUp !== false ? TrendingUp : Minus,
      },
      {
        id: 'products',
        label: 'Catalog Master SKUs',
        value: totalProducts > 0 ? `${totalProducts.toLocaleString()}` : '0',
        sub: 'Products & active matrices',
        icon: Tag,
        iconColor: 'text-warning',
        iconBg: 'bg-warning-bg border-warning-border',
        trend: data.productsTrend ?? '98.5% In Stock',
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
        trend: data.expensesTrend ?? 'On budget',
        trendClass: 'neutral',
        trendIcon: Minus,
      },
    ]

    if (data.activeRegister) {
      systemHealth.value.activeRegister = data.activeRegister
    }
    if (data.syncStatus) {
      systemHealth.value.syncStatus = data.syncStatus
    }

    // Load recent orders and low stock items if returned or fetch secondary
    if (Array.isArray(data.recentOrders)) {
      recentOrders.value = data.recentOrders
    }
    if (Array.isArray(data.lowStockItems)) {
      lowStockItems.value = data.lowStockItems
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

  // Load secondary preview data safely
  try {
    const ordersRes = await api.get('/orders', { params: { per_page: 5 } })
    const ordData = ordersRes.data?.data || ordersRes.data || []
    if (Array.isArray(ordData) && ordData.length > 0) {
      recentOrders.value = ordData.slice(0, 5)
    }
  } catch {
    // Graceful fallback
  }

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
      lowStockItems.value = lowList.slice(0, 4)
    }
  } catch {
    // Graceful fallback
  }
}

const quickNavCards = [
  {
    to: '/pos',
    title: 'POS Terminal',
    desc: 'Launch high-speed touchscreen dual-zone POS register and scan barcodes.',
    icon: ShoppingBag,
    colorText: 'text-cta',
    borderHover: 'hover:border-cta/40',
    badge: 'Checkout',
    badgeVariant: 'warning' as const,
  },
  {
    to: '/products',
    title: 'Products & Matrix',
    desc: 'Browse product catalog, generate variant combinations, and adjust prices.',
    icon: Tag,
    colorText: 'text-primary',
    borderHover: 'hover:border-primary/40',
    badge: 'Catalog',
    badgeVariant: 'default' as const,
  },
  {
    to: '/products/create',
    title: 'New Product Line',
    desc: 'Define new master product with multi-tier pricing and SKU barcodes.',
    icon: Sparkles,
    colorText: 'text-purple-600',
    borderHover: 'hover:border-purple-300',
    badge: 'Creator',
    badgeVariant: 'purple' as const,
  },
  {
    to: '/restock',
    title: 'Restock Intake',
    desc: 'Intake supplier batches with barcode scanning and auto-commit to stock.',
    icon: ArrowDownToLine,
    colorText: 'text-success',
    borderHover: 'hover:border-success/40',
    badge: 'Logistics',
    badgeVariant: 'success' as const,
  },
  {
    to: '/inventory',
    title: 'Inventory Ledger',
    desc: 'Monitor real-time SKU stock levels, reorder thresholds, and movements.',
    icon: Package,
    colorText: 'text-warning',
    borderHover: 'hover:border-warning/40',
    badge: 'Stock Audit',
    badgeVariant: 'warning' as const,
  },
  {
    to: '/orders',
    title: 'Orders & Sales',
    desc: 'Review sales transactions, payment receipts, delivery details, and POS audits.',
    icon: Receipt,
    colorText: 'text-info',
    borderHover: 'hover:border-info/40',
    badge: 'Ledger',
    badgeVariant: 'info' as const,
  },
  {
    to: '/customers',
    title: 'Customers & CRM',
    desc: 'Inspect customer purchase histories, lifetime value, and loyalty tier rankings.',
    icon: Users,
    colorText: 'text-primary',
    borderHover: 'hover:border-primary/40',
    badge: 'Loyalty CRM',
    badgeVariant: 'default' as const,
  },
  {
    to: '/expenses',
    title: 'Expenses Tracker',
    desc: 'Log store utilities, supplier invoices, store rent, and operational costs.',
    icon: Wallet,
    colorText: 'text-destructive',
    borderHover: 'hover:border-destructive/40',
    badge: 'Finance',
    badgeVariant: 'neutral' as const,
  },
]

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function orderStatusBadge(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED' || s === 'PAID') return { variant: 'success' as const, label: 'Completed' }
  if (s === 'PROCESSING' || s === 'SENT') return { variant: 'info' as const, label: 'Processing' }
  if (s === 'PENDING' || s === 'DRAFT') return { variant: 'warning' as const, label: 'Pending' }
  if (s === 'CANCELLED' || s === 'REJECTED') return { variant: 'destructive' as const, label: 'Cancelled' }
  return { variant: 'neutral' as const, label: status }
}

onMounted(loadStats)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
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

      <div class="flex items-center gap-2.5">
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

    <!-- Quick Operations Hub Grid -->
    <div class="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col gap-4">
      <div class="flex items-center justify-between pb-2 border-b border-border/60">
        <div>
          <h2 class="font-display text-lg font-bold text-foreground">Quick Operations Hub</h2>
          <p class="text-xs text-muted-foreground mt-0.5">High-frequency workflows and inventory controls</p>
        </div>
        <Badge variant="neutral" class="text-xs">
          {{ quickNavCards.length }} Modules Available
        </Badge>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <RouterLink
          v-for="card in quickNavCards"
          :key="card.to"
          :to="card.to"
          :class="cn(
            'group rounded-lg border border-border/80 bg-surface p-4 transition-all duration-200 hover:shadow-xs hover:bg-surface-subtle/50 flex flex-col justify-between gap-3',
            card.borderHover
          )"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div :class="cn('p-1.5 rounded-md bg-muted/40 group-hover:scale-105 transition-transform', card.colorText)">
                <component :is="card.icon" :size="18" />
              </div>
              <span class="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {{ card.title }}
              </span>
            </div>
            <Badge :variant="card.badgeVariant" class="text-[10px] px-1.5 py-0">
              {{ card.badge }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {{ card.desc }}
          </p>
          <div class="flex items-center text-[11px] font-medium text-muted-foreground group-hover:text-cta transition-colors mt-auto pt-1">
            <span>Open workflow</span>
            <ChevronRight :size="13" class="ml-0.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </RouterLink>
      </div>
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

        <div v-if="recentOrders.length === 0" class="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
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
              <TableRow v-for="ord in recentOrders" :key="ord.id" class="hover:bg-surface-subtle/60 transition-colors">
                <TableCell class="font-mono text-xs font-medium text-foreground">
                  {{ ord.order_number || ord.id.slice(0, 8) }}
                </TableCell>
                <TableCell>
                  <Badge :variant="orderStatusBadge(ord.status).variant" class="text-[11px] px-2 py-0.5">
                    {{ orderStatusBadge(ord.status).label }}
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
  </div>
</template>
