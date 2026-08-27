<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import api from '@/api/axios'

interface MetricStat {
  id: string
  label: string
  value: string | number
  sub: string
  icon: string
  iconBadgeClass: string
  trend: string
  trendClass: string
  trendIcon: string
}

interface ActivityEvent {
  id: string
  title: string
  desc: string
  time: string
  icon: string
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

const recentEvents = ref<ActivityEvent[]>([
  {
    id: 'e1',
    title: 'POS Shift Checkout #ORD-1092',
    desc: 'Cashier processed $45.00 via ABA PayWay QR',
    time: '2 mins ago',
    icon: '🧾',
    badgeText: 'Completed',
    badgeClass: 'badge--green',
  },
  {
    id: 'e2',
    title: 'Supplier Restock Session #RS-8802',
    desc: 'Intake batch received +120 units across 4 SKUs',
    time: '35 mins ago',
    icon: '📥',
    badgeText: 'Restocked',
    badgeClass: 'badge--blue',
  },
  {
    id: 'e3',
    title: 'Loyalty Upgrade: Sophia Chan',
    desc: 'Customer reached 1,200 lifetime points -> Gold Tier',
    time: '1 hour ago',
    icon: '⭐',
    badgeText: 'Gold Tier',
    badgeClass: 'badge-tier-gold',
  },
  {
    id: 'e4',
    title: 'Store Utility Expense Recorded',
    desc: 'Log store electricity & internet expense ($185.00)',
    time: '3 hours ago',
    icon: '💰',
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
        icon: '🧾',
        iconBadgeClass: 'icon-badge--primary',
        trend: '+14.2% vs last week',
        trendClass: 'trend-pill--up',
        trendIcon: '▲',
      },
      {
        id: 'customers',
        label: 'Loyalty Members',
        value: totalCustomers > 0 ? `${totalCustomers.toLocaleString()}` : '0',
        sub: 'Enrolled CRM profiles',
        icon: '👥',
        iconBadgeClass: 'icon-badge--success',
        trend: '+8.5% new members',
        trendClass: 'trend-pill--up',
        trendIcon: '▲',
      },
      {
        id: 'products',
        label: 'Catalog Master SKUs',
        value: totalProducts > 0 ? `${totalProducts.toLocaleString()}` : '0',
        sub: 'Products & active matrices',
        icon: '🏷️',
        iconBadgeClass: 'icon-badge--warning',
        trend: '98.5% In Stock',
        trendClass: 'trend-pill--neutral',
        trendIcon: '●',
      },
      {
        id: 'expenses',
        label: 'Expenses Logged',
        value: totalExpenses > 0 ? `${totalExpenses.toLocaleString()}` : '0',
        sub: 'Operational entries',
        icon: '💰',
        iconBadgeClass: 'icon-badge--purple',
        trend: 'On budget',
        trendClass: 'trend-pill--neutral',
        trendIcon: '●',
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
    icon: '🏷️',
    color: 'var(--action-primary)',
    badge: 'Catalog',
  },
  {
    to: '/products/create',
    title: 'New Product',
    desc: 'Define new master product line with multi-tier pricing and SKU barcodes.',
    icon: '✨',
    color: 'var(--status-purple)',
    badge: 'Creator',
  },
  {
    to: '/restock',
    title: 'Restock Intake',
    desc: 'Intake supplier batches with barcode scanning and auto-commit to stock on hand.',
    icon: '📥',
    color: 'var(--status-success)',
    badge: 'Logistics',
  },
  {
    to: '/inventory',
    title: 'Inventory Ledger',
    desc: 'Monitor real-time SKU stock levels, reorder thresholds, and stock movements.',
    icon: '📦',
    color: 'var(--status-warning)',
    badge: 'Stock Audit',
  },
  {
    to: '/orders',
    title: 'Orders & Sales',
    desc: 'Review sales transactions, payment receipts, delivery details, and POS audits.',
    icon: '🧾',
    color: 'var(--action-primary)',
    badge: 'Transactions',
  },
  {
    to: '/customers',
    title: 'Customers & CRM',
    desc: 'Inspect customer purchase histories, lifetime value, and loyalty tier rankings.',
    icon: '👥',
    color: 'var(--status-info)',
    badge: 'Loyalty CRM',
  },
  {
    to: '/expenses',
    title: 'Expenses Tracker',
    desc: 'Log store utilities, supplier invoices, store rent, and operational costs.',
    icon: '💰',
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
          <span class="badge badge--green font-semibold">● System Healthy</span>
        </div>
        <p class="text-muted text-sm mt-4">
          Omnichannel POS register & inventory administration overview.
          <span v-if="lastRefreshed" class="text-xs" style="color: var(--text-disabled); margin-left: 8px;">
            Last synced: {{ lastRefreshed }}
          </span>
        </p>
      </div>

      <div class="flex items-center gap-12">
        <button class="btn btn--ghost" :disabled="loading" @click="loadStats">
          <span :class="{ spinner: loading, 'spinner--dark': loading }"></span>
          <span v-if="!loading">↺ Refresh Metrics</span>
          <span v-else>Updating...</span>
        </button>
        <RouterLink to="/products/create" class="btn btn--primary">
          <span>+</span>
          <span>New Product</span>
        </RouterLink>
      </div>
    </div>

    <!-- Elevated Stat Cards with Soft Tinted Backdrops & Trend Indicators -->
    <div class="grid-4 gap-16">
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="card flex-col gap-12" style="min-height: 130px;">
          <div class="flex items-center justify-between">
            <div class="skeleton-box" style="width: 42px; height: 42px; border-radius: var(--radius-md);"></div>
            <div class="skeleton-box" style="width: 70px; height: 22px; border-radius: var(--radius-full);"></div>
          </div>
          <div class="skeleton-box" style="width: 50%; height: 28px;"></div>
          <div class="skeleton-box" style="width: 80%; height: 14px;"></div>
        </div>
      </template>

      <template v-else>
        <div
          v-for="s in stats"
          :key="s.id"
          class="stat-card"
        >
          <div class="stat-card-header">
            <div class="icon-badge" :class="s.iconBadgeClass">
              <span>{{ s.icon }}</span>
            </div>
            <div class="trend-pill" :class="s.trendClass">
              <span>{{ s.trendIcon }}</span>
              <span>{{ s.trend }}</span>
            </div>
          </div>

          <div class="stat-card-body">
            <span class="stat-card-value tabular-nums">{{ s.value }}</span>
            <span class="stat-card-label">{{ s.label }}</span>
            <span class="stat-card-sub">{{ s.sub }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- Quick Operations & Management Hub -->
    <section class="card">
      <div class="flex items-center justify-between mb-16">
        <div>
          <h2 class="font-bold text-lg">Quick Operations Hub</h2>
          <p class="text-muted text-sm mt-4">High-frequency workflows and management modules</p>
        </div>
        <span class="badge badge--neutral">7 Modules Available</span>
      </div>

      <div class="grid-3 gap-16">
        <RouterLink
          v-for="card in quickNavCards"
          :key="card.to"
          :to="card.to"
          class="card card--interactive flex-col gap-8"
          style="text-decoration: none; padding: 20px; border-color: var(--border-color);"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-10 font-bold text-lg" :style="{ color: card.color }">
              <span style="font-size: 22px;">{{ card.icon }}</span>
              <span>{{ card.title }}</span>
            </div>
            <span class="badge badge--neutral" style="font-size: 11px;">{{ card.badge }}</span>
          </div>
          <p class="text-muted text-sm" style="line-height: 1.45;">
            {{ card.desc }}
          </p>
        </RouterLink>
      </div>
    </section>

    <!-- Operational Health & Activity Grid -->
    <div class="grid-2 gap-20">
      <!-- Live Channel Status & Diagnostics -->
      <section class="card flex-col gap-16">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-10">
            <div class="icon-badge icon-badge--success" style="width: 32px; height: 32px; font-size: 16px;">
              <span>⚡</span>
            </div>
            <h3 class="font-bold text-lg">Live Channel Diagnostics</h3>
          </div>
          <span class="badge badge--green">Connected</span>
        </div>

        <div class="flex-col gap-12">
          <div class="flex items-center justify-between" style="padding: 10px 14px; background-color: var(--surface-alt); border-radius: var(--radius-md);">
            <span class="text-muted text-sm font-semibold">Active Register</span>
            <span class="font-semibold text-sm">{{ systemHealth.activeRegister }}</span>
          </div>

          <div class="flex items-center justify-between" style="padding: 10px 14px; background-color: var(--surface-alt); border-radius: var(--radius-md);">
            <span class="text-muted text-sm font-semibold">Offline Sync Hook</span>
            <div class="flex items-center gap-6">
              <span class="channel-dot" style="width: 7px; height: 7px;"></span>
              <span class="text-sm font-semibold" style="color: var(--status-success);">{{ systemHealth.syncStatus }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between" style="padding: 10px 14px; background-color: var(--surface-alt); border-radius: var(--radius-md);">
            <span class="text-muted text-sm font-semibold">Database Engine Latency</span>
            <span class="text-sm font-semibold tabular-nums" style="color: var(--action-primary);">{{ systemHealth.dbLatency }}</span>
          </div>

          <div class="flex items-center justify-between" style="padding: 10px 14px; background-color: var(--surface-alt); border-radius: var(--radius-md);">
            <span class="text-muted text-sm font-semibold">Security & Idempotency Check</span>
            <span class="text-sm font-semibold" style="color: var(--text-primary);">UUID v4 Locks Active</span>
          </div>
        </div>
      </section>

      <!-- Recent System Events & Activity Log -->
      <section class="card flex-col gap-16">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-10">
            <div class="icon-badge icon-badge--primary" style="width: 32px; height: 32px; font-size: 16px;">
              <span>🕒</span>
            </div>
            <h3 class="font-bold text-lg">Recent Operational Feed</h3>
          </div>
          <span class="text-xs text-muted">Auto-refreshed</span>
        </div>

        <div class="flex-col gap-12">
          <div
            v-for="event in recentEvents"
            :key="event.id"
            class="flex items-start gap-12"
            style="padding: 10px 12px; border-radius: var(--radius-md); transition: background-color var(--transition);"
          >
            <span style="font-size: 20px; margin-top: 2px;">{{ event.icon }}</span>
            <div class="flex-1 min-width-0">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-sm">{{ event.title }}</span>
                <span class="badge badge--sm" :class="event.badgeClass">{{ event.badgeText }}</span>
              </div>
              <p class="text-muted text-xs mt-4">{{ event.desc }}</p>
              <span class="text-xs" style="color: var(--text-disabled); font-size: 11px;">{{ event.time }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

