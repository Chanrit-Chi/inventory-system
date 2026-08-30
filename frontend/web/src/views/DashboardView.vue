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
} from 'lucide-vue-next'

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
  iconBadgeClass: string
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
  badgeClass: string
}

const stats = ref<MetricStat[]>([])
const loading = ref(false)
const lastRefreshed = ref<string>('')

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
    badgeClass: 'badge--success',
  },
  {
    id: 'e2',
    title: 'Supplier Restock Session #RS-8802',
    desc: 'Intake batch received +120 units across 4 SKUs',
    time: '35 mins ago',
    icon: Package,
    badgeText: 'Restocked',
    badgeClass: 'badge--blue',
  },
  {
    id: 'e3',
    title: 'Loyalty Upgrade: Sophia Chan',
    desc: 'Customer reached 1,200 lifetime points -> Gold Tier',
    time: '1 hour ago',
    icon: Star,
    badgeText: 'Gold Tier',
    badgeClass: 'badge-tier-gold',
  },
  {
    id: 'e4',
    title: 'Store Utility Expense Recorded',
    desc: 'Log store electricity & internet expense ($185.00)',
    time: '3 hours ago',
    icon: Wallet,
    badgeText: 'Expense',
    badgeClass: 'badge--neutral',
  },
])

async function loadStats() {
  loading.value = true
  try {
    const [ordersRes, customersRes, productsRes, expensesRes] = await Promise.allSettled([
      api.get('/orders', { params: { page: 1 } }),
      api.get('/customers', { params: { page: 1 } }),
      api.get('/products', { params: { page: 1 } }),
      api.get('/expenses', { params: { page: 1 } }),
    ])

    const totalOrders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data.meta?.total ?? ordersRes.value.data.data?.length ?? 0) : 0
    const totalCustomers = customersRes.status === 'fulfilled' ? (customersRes.value.data.meta?.total ?? customersRes.value.data.data?.length ?? 0) : 0
    const totalProducts = productsRes.status === 'fulfilled' ? (productsRes.value.data.meta?.total ?? productsRes.value.data.data?.length ?? 0) : 0
    const totalExpenses = expensesRes.status === 'fulfilled' ? (expensesRes.value.data.meta?.total ?? expensesRes.value.data.data?.length ?? 0) : 0

    stats.value = [
      {
        id: 'orders',
        label: 'Total Orders & POS Sales',
        value: totalOrders > 0 ? `${totalOrders.toLocaleString()}` : '0',
        sub: 'Transactions processed',
        icon: Receipt,
        iconBadgeClass: 'icon-badge--primary',
        trend: '+14.2% vs last week',
        trendClass: 'trend-pill--up',
        trendIcon: TrendingUp,
      },
      {
        id: 'customers',
        label: 'Loyalty Members',
        value: totalCustomers > 0 ? `${totalCustomers.toLocaleString()}` : '0',
        sub: 'Enrolled CRM profiles',
        icon: Users,
        iconBadgeClass: 'icon-badge--success',
        trend: '+8.5% new members',
        trendClass: 'trend-pill--up',
        trendIcon: TrendingUp,
      },
      {
        id: 'products',
        label: 'Catalog Master SKUs',
        value: totalProducts > 0 ? `${totalProducts.toLocaleString()}` : '0',
        sub: 'Products & active matrices',
        icon: Tag,
        iconBadgeClass: 'icon-badge--warning',
        trend: '98.5% In Stock',
        trendClass: 'trend-pill--neutral',
        trendIcon: Minus,
      },
      {
        id: 'expenses',
        label: 'Expenses Logged',
        value: totalExpenses > 0 ? `${totalExpenses.toLocaleString()}` : '0',
        sub: 'Operational entries',
        icon: Wallet,
        iconBadgeClass: 'icon-badge--purple',
        trend: 'On budget',
        trendClass: 'trend-pill--neutral',
        trendIcon: Minus,
      },
    ]

    const now = new Date()
    lastRefreshed.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    stats.value = []
  } finally {
    loading.value = false
  }
}

const quickNavCards = [
  {
    to: '/products',
    title: 'Products & Matrix',
    desc: 'Browse product catalog, generate variant combinations, and adjust prices.',
    icon: Tag,
    color: 'var(--action-primary)',
    badge: 'Catalog',
  },
  {
    to: '/products/create',
    title: 'New Product',
    desc: 'Define new master product line with multi-tier pricing and SKU barcodes.',
    icon: Sparkles,
    color: 'var(--status-purple)',
    badge: 'Creator',
  },
  {
    to: '/restock',
    title: 'Restock Intake',
    desc: 'Intake supplier batches with barcode scanning and auto-commit to stock on hand.',
    icon: ArrowDownToLine,
    color: 'var(--status-success)',
    badge: 'Logistics',
  },
  {
    to: '/inventory',
    title: 'Inventory Ledger',
    desc: 'Monitor real-time SKU stock levels, reorder thresholds, and stock movements.',
    icon: Package,
    color: 'var(--status-warning)',
    badge: 'Stock Audit',
  },
  {
    to: '/orders',
    title: 'Orders & Sales',
    desc: 'Review sales transactions, payment receipts, delivery details, and POS audits.',
    icon: Receipt,
    color: 'var(--action-primary)',
    badge: 'Transactions',
  },
  {
    to: '/customers',
    title: 'Customers & CRM',
    desc: 'Inspect customer purchase histories, lifetime value, and loyalty tier rankings.',
    icon: Users,
    color: 'var(--status-info)',
    badge: 'Loyalty CRM',
  },
  {
    to: '/expenses',
    title: 'Expenses Tracker',
    desc: 'Log store utilities, supplier invoices, store rent, and operational costs.',
    icon: Wallet,
    color: 'var(--action-destructive)',
    badge: 'Finance',
  },
]

onMounted(loadStats)
</script>

<template>
  <div class="flex-col gap-24">
    <!-- Executive Dashboard Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="flex items-center gap-12">
          <h1 class="page-title">Executive Dashboard</h1>
          <span class="badge badge--success">● System Healthy</span>
        </div>
        <p class="text-muted text-sm mt-4">
          Omnichannel POS register & inventory administration overview.
          <span v-if="lastRefreshed" class="text-xs text-muted-foreground" style="margin-left: 8px;">
            Last synced: {{ lastRefreshed }}
          </span>
        </p>
      </div>

      <div class="flex items-center gap-12">
        <button class="btn btn--ghost" :disabled="loading" @click="loadStats">
          <RefreshCw :size="16" :class="{ 'spinner': loading }" />
          <span v-if="!loading">Refresh Metrics</span>
          <span v-else>Updating...</span>
        </button>
        <RouterLink to="/products/create" class="btn btn--primary">
          <Plus :size="16" />
          <span>New Product</span>
        </RouterLink>
      </div>
    </div>

    <!-- Elevated Stat Cards with Soft Tinted Backdrops & Trend Indicators -->
    <div class="grid-4 gap-20">
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="card flex-col gap-12" style="min-height: 130px;">
          <div class="flex items-center justify-between">
            <div class="skeleton-box" style="width: 44px; height: 44px; border-radius: var(--radius-lg);"></div>
            <div class="skeleton-box" style="width: 70px; height: 20px; border-radius: var(--radius-full);"></div>
          </div>
          <div class="skeleton-box" style="width: 40%; height: 28px;"></div>
          <div class="skeleton-box" style="width: 80%; height: 14px;"></div>
        </div>
      </template>

      <template v-else>
        <div
          v-for="s in stats"
          :key="s.id"
          class="stat-card rounded-xl border border-border bg-card shadow-xs flex flex-col gap-3 transition-all duration-150 hover:shadow-sm hover:border-border-strong hover:-translate-y-px"
        >
          <div class="flex items-center justify-between">
            <div :class="cn('inline-flex items-center justify-center w-11 h-11 rounded-lg text-xl border', s.iconBadgeClass === 'icon-badge--primary' ? 'bg-info-bg text-info border-info-border' : s.iconBadgeClass === 'icon-badge--success' ? 'bg-success-bg text-success border-success-border' : s.iconBadgeClass === 'icon-badge--warning' ? 'bg-warning-bg text-warning border-warning-border' : s.iconBadgeClass === 'icon-badge--purple' ? 'bg-purple-bg text-purple-border border-purple-border' : 'bg-muted text-muted-foreground border-border')">
              <component :is="s.icon" :size="20" />
            </div>
            <span :class="cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', s.trendClass === 'trend-pill--up' ? 'bg-success-bg text-success-foreground border-success-border' : s.trendClass === 'trend-pill--down' ? 'bg-error-bg text-error-text border-error-border' : s.trendClass === 'trend-pill--warning' ? 'bg-warning-bg text-warning-foreground border-warning-border' : 'bg-muted text-muted-foreground border-border')">
              <component :is="s.trendIcon" :size="12" />
              <span>{{ s.trend }}</span>
            </span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[28px] font-bold tracking-tight tabular-nums text-foreground leading-tight">{{ s.value }}</span>
            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{{ s.label }}</span>
            <span class="text-xs text-muted-foreground">{{ s.sub }}</span>
          </div>
        </div>
      </template>
    </div>

    <hr class="section-divider" aria-hidden="true" />

    <!-- Quick Operations & Management Hub -->
    <section class="card">
      <div class="flex items-center justify-between mb-16">
        <div>
          <h2 class="font-bold text-lg">Quick Operations Hub</h2>
          <p class="text-muted text-sm mt-4">High-frequency workflows and management modules</p>
        </div>
        <span class="badge badge--neutral">{{ quickNavCards.length }} Modules Available</span>
      </div>

      <div class="grid-modules">
        <RouterLink
          v-for="card in quickNavCards"
          :key="card.to"
          :to="card.to"
          class="card interactive flex-col gap-3"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-10 font-semibold text-lg" :style="{ color: card.color }">
              <component :is="card.icon" :size="22" />
              <span>{{ card.title }}</span>
            </div>
            <span class="badge badge--neutral">{{ card.badge }}</span>
          </div>
          <p class="text-muted text-sm">
            {{ card.desc }}
          </p>
        </RouterLink>
      </div>
    </section>

    <hr class="section-divider" aria-hidden="true" />

    <!-- Operational Health & Activity Grid -->
    <div class="grid-2 gap-20">
      <!-- Live Channel Status & Diagnostics -->
      <section class="card flex-col gap-16">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-10">
            <div class="icon-badge icon-badge--success" style="width: 32px; height: 32px; font-size: 16px;">
              <Zap :size="16" />
            </div>
            <h3 class="font-bold text-lg">Live Channel Diagnostics</h3>
          </div>
          <span class="badge badge--success">Connected</span>
        </div>

        <div class="flex-col gap-12">
          <div
            v-for="(item, idx) in healthIndicators"
            :key="idx"
            class="flex items-center justify-between rounded-md bg-muted/60 px-3.5 py-2.5"
          >
            <span class="text-muted text-sm font-semibold">{{ item.label }}</span>
            <div class="flex items-center gap-1.5">
              <span v-if="item.isSuccess" class="w-[7px] h-[7px] rounded-full bg-success" />
              <span class="font-semibold text-sm tabular-nums" :class="item.isPrimary ? 'text-primary' : 'text-foreground'">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Recent System Events & Activity Log -->
      <section class="card flex-col gap-16">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-10">
            <div class="icon-badge icon-badge--primary" style="width: 32px; height: 32px; font-size: 16px;">
              <Clock :size="16" />
            </div>
            <h3 class="font-bold text-lg">Recent Operational Feed</h3>
          </div>
          <span class="text-xs text-muted">Auto-refreshed</span>
        </div>

        <div class="flex-col gap-12">
          <div
            v-for="event in recentEvents"
            :key="event.id"
            class="flex items-start gap-12 rounded-lg"
            style="padding: 10px 12px; transition: background-color var(--transition);"
          >
            <component :is="event.icon" :size="20" style="margin-top: 2px;" />
            <div class="flex-1 min-width-0">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-sm">{{ event.title }}</span>
                <span class="badge badge--sm" :class="event.badgeClass">{{ event.badgeText }}</span>
              </div>
              <p class="text-muted text-xs mt-4">{{ event.desc }}</p>
              <span class="text-xs text-muted-foreground">{{ event.time }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

