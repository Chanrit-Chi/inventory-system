<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useCustomerStore } from '@/stores/customerStore'

const customerStore = useCustomerStore()

const search = ref('')
const page = ref(1)

// Tier thresholds
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 100,
  GOLD: 250,
  PLATINUM: 500,
}

// VIP counts
const vipCount = computed(() =>
  customerStore.customers.filter(c => (parseFloat(String(c.total_spent)) || 0) >= TIER_THRESHOLDS.GOLD).length
)

async function loadCustomers() {
  const params: Record<string, unknown> = {
    page: page.value,
  }
  if (search.value.trim()) {
    params.search = search.value.trim()
  }

  await customerStore.fetchCustomers(params)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadCustomers()
  }, 300)
}

function openCustomerModal(id: string) {
  customerStore.fetchCustomer(id)
}

function closeModal() {
  customerStore.selectedCustomer = null
}

function getTier(totalSpent: number | string | undefined): {
  name: string
  class: string
  icon: string
  nextTier: string | null
  nextThreshold: number
  progressPercent: number
  remainingToNext: number
} {
  const spent = typeof totalSpent === 'string' ? parseFloat(totalSpent) : (totalSpent || 0)

  if (spent >= TIER_THRESHOLDS.PLATINUM) {
    return {
      name: 'Platinum',
      class: 'badge-tier-platinum',
      icon: '💎',
      nextTier: null,
      nextThreshold: TIER_THRESHOLDS.PLATINUM,
      progressPercent: 100,
      remainingToNext: 0,
    }
  }
  if (spent >= TIER_THRESHOLDS.GOLD) {
    const range = TIER_THRESHOLDS.PLATINUM - TIER_THRESHOLDS.GOLD
    const progress = ((spent - TIER_THRESHOLDS.GOLD) / range) * 100
    return {
      name: 'Gold',
      class: 'badge-tier-gold',
      icon: '🥇',
      nextTier: 'Platinum',
      nextThreshold: TIER_THRESHOLDS.PLATINUM,
      progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
      remainingToNext: TIER_THRESHOLDS.PLATINUM - spent,
    }
  }
  if (spent >= TIER_THRESHOLDS.SILVER) {
    const range = TIER_THRESHOLDS.GOLD - TIER_THRESHOLDS.SILVER
    const progress = ((spent - TIER_THRESHOLDS.SILVER) / range) * 100
    return {
      name: 'Silver',
      class: 'badge-tier-silver',
      icon: '🥈',
      nextTier: 'Gold',
      nextThreshold: TIER_THRESHOLDS.GOLD,
      progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
      remainingToNext: TIER_THRESHOLDS.GOLD - spent,
    }
  }
  // Bronze
  const progress = (spent / TIER_THRESHOLDS.SILVER) * 100
  return {
    name: 'Bronze',
    class: 'badge-tier-bronze',
    icon: '🥉',
    nextTier: 'Silver',
    nextThreshold: TIER_THRESHOLDS.SILVER,
    progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
    remainingToNext: TIER_THRESHOLDS.SILVER - spent,
  }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

onMounted(() => {
  loadCustomers()
})
</script>

<template>
  <div class="flex-col gap-24">
    <!-- Header -->
    <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 16px;">
      <div>
        <div class="flex items-center gap-10">
          <h1 class="page-title">Customers & Loyalty CRM</h1>
          <span class="badge badge--blue font-semibold tabular-nums">
            {{ customerStore.summaryStats.totalCustomers }} Profiles
          </span>
        </div>
        <p class="text-muted text-sm mt-4">
          Manage omnichannel customer profiles, loyalty tier progressions, and transaction histories.
        </p>
      </div>

      <button id="btn-refresh-customers" class="btn btn--ghost" @click="loadCustomers">
        ↺ Refresh CRM
      </button>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid-4 gap-16">
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--primary">
            <span>👥</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>CRM Database</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums">
            {{ customerStore.summaryStats.totalCustomers }}
          </span>
          <span class="stat-card-label">Total Customers</span>
          <span class="stat-card-sub">Registered shoppers</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--success">
            <span>💵</span>
          </div>
          <div class="trend-pill trend-pill--up">
            <span>● Lifetime Sales</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-success);">
            {{ fmtMoney(customerStore.summaryStats.totalSpend) }}
          </span>
          <span class="stat-card-label">Combined Revenue</span>
          <span class="stat-card-sub">Total customer lifetime value</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--warning">
            <span>⭐</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Average LTV</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-warning);">
            {{ fmtMoney(customerStore.summaryStats.avgLtv) }}
          </span>
          <span class="stat-card-label">Average Spend</span>
          <span class="stat-card-sub">Spend per registered profile</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--purple">
            <span>💎</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>VIP Tiers</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-purple-text);">
            {{ vipCount }}
          </span>
          <span class="stat-card-label">Gold & Platinum</span>
          <span class="stat-card-sub">High-value loyalty members</span>
        </div>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <section class="card">
      <div class="flex items-center justify-between gap-16">
        <div style="flex: 1; max-width: 480px;">
          <input
            id="customer-search-input"
            v-model="search"
            type="text"
            placeholder="Search by customer name or phone number…"
            @input="onSearchInput"
          />
        </div>
      </div>
    </section>

    <!-- Error Alert -->
    <div v-if="customerStore.error" class="alert alert--error">
      <span>⚠️ {{ customerStore.error }}</span>
      <button class="btn btn--ghost btn--sm" @click="loadCustomers" style="margin-left: auto;">Retry</button>
    </div>

    <!-- Customer Table -->
    <section class="card" style="padding: 0; overflow: hidden;">
      <div v-if="customerStore.loading" style="padding: 24px;">
        <div v-for="i in 5" :key="i" class="skeleton-row"></div>
      </div>

      <div v-else-if="customerStore.customers.length === 0" class="empty-state">
        <div class="empty-icon">👥</div>
        <h3 class="font-bold text-lg mb-8">No customer profiles found</h3>
        <p class="text-muted">Customers will appear here automatically when they provide phone numbers at POS checkouts.</p>
      </div>

      <div v-else class="table-wrap" style="border: none; border-radius: 0; box-shadow: none;">
        <table>
          <thead>
            <tr>
              <th>Customer Profile</th>
              <th>Phone Number</th>
              <th>Orders Count</th>
              <th>Lifetime Spend</th>
              <th>Loyalty Tier & Progression</th>
              <th>Last Purchase</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in customerStore.customers" :key="c.id">
              <td>
                <div class="flex items-center gap-12">
                  <div
                    style="width: 38px; height: 38px; border-radius: var(--radius-full); background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); color: var(--action-primary); font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--action-primary-border);"
                  >
                    {{ getInitials(c.name) }}
                  </div>
                  <div>
                    <div class="font-semibold text-sm">{{ c.name }}</div>
                    <div v-if="c.email" class="text-xs text-muted">{{ c.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <code class="tabular-nums text-xs" style="background-color: var(--surface-alt); padding: 3px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  {{ c.phone }}
                </code>
              </td>
              <td class="tabular-nums font-semibold">{{ c.total_purchased ?? 0 }} orders</td>
              <td class="tabular-nums font-bold" style="font-size: 15px; color: var(--text-primary);">
                {{ fmtMoney(c.total_spent) }}
              </td>
              <td>
                <div class="flex-col gap-4" style="min-width: 170px;">
                  <div class="flex items-center justify-between">
                    <span class="badge" :class="getTier(c.total_spent).class">
                      {{ getTier(c.total_spent).icon }} {{ getTier(c.total_spent).name }}
                    </span>
                    <span v-if="getTier(c.total_spent).nextTier" class="text-xs text-muted tabular-nums">
                      {{ fmtMoney(getTier(c.total_spent).remainingToNext) }} to {{ getTier(c.total_spent).nextTier }}
                    </span>
                    <span v-else class="text-xs font-semibold" style="color: var(--status-purple-text);">
                      Top VIP
                    </span>
                  </div>

                  <!-- Progression Bar -->
                  <div class="tier-progress-track">
                    <div
                      class="tier-progress-fill"
                      :style="{ width: `${getTier(c.total_spent).progressPercent}%` }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="tabular-nums text-muted text-sm">
                {{ fmtDate(c.last_purchase_at) }}
              </td>
              <td style="text-align: right;">
                <button
                  :id="`btn-view-customer-${c.id}`"
                  class="btn btn--ghost btn--sm"
                  @click="openCustomerModal(c.id)"
                >
                  Order History
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="customerStore.meta && customerStore.meta.last_page > 1"
        class="pagination"
        style="padding: 16px 24px; border-top: 1px solid var(--border-color);"
      >
        <button
          class="page-btn"
          :disabled="page <= 1 || customerStore.loading"
          @click="page--; loadCustomers()"
        >
          ‹ Previous
        </button>
        <span class="page-info tabular-nums">
          Page {{ page }} of {{ customerStore.meta.last_page }} ({{ customerStore.meta.total }} total)
        </span>
        <button
          class="page-btn"
          :disabled="page >= customerStore.meta.last_page || customerStore.loading"
          @click="page++; loadCustomers()"
        >
          Next ›
        </button>
      </div>
    </section>

    <!-- Customer History Modal -->
    <div
      v-if="customerStore.selectedCustomer || customerStore.detailLoading"
      class="modal-backdrop"
      @click.self="closeModal"
    >
      <div class="modal modal--lg">
        <div v-if="customerStore.detailLoading" style="padding: 48px; text-align: center;">
          <div class="spinner spinner--dark" style="width: 24px; height: 24px; margin-bottom: 12px;"></div>
          <p class="text-muted">Loading customer purchase history…</p>
        </div>

        <template v-else-if="customerStore.selectedCustomer">
          <!-- Header -->
          <div class="flex items-center justify-between mb-24 pb-16" style="border-bottom: 1px solid var(--border-color);">
            <div class="flex items-center gap-16">
              <div
                style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); color: var(--action-primary); font-weight: 700; font-size: 18px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--action-primary-border);"
              >
                {{ getInitials(customerStore.selectedCustomer.name) }}
              </div>
              <div>
                <h2 class="modal-title" style="margin: 0;">{{ customerStore.selectedCustomer.name }}</h2>
                <span class="text-sm text-muted tabular-nums">📞 {{ customerStore.selectedCustomer.phone }}</span>
              </div>
            </div>

            <span class="badge" :class="getTier(customerStore.selectedCustomer.total_spent).class" style="font-size: 13px; padding: 6px 12px;">
              {{ getTier(customerStore.selectedCustomer.total_spent).icon }} {{ getTier(customerStore.selectedCustomer.total_spent).name }} Member
            </span>
          </div>

          <!-- Customer Metrics Bar -->
          <div class="grid-3 gap-16 mb-24">
            <div class="card" style="padding: 16px; background-color: var(--surface-alt);">
              <span class="form-label mb-4 block">Lifetime Spend</span>
              <span class="font-bold text-xl tabular-nums" style="color: var(--action-primary);">
                {{ fmtMoney(customerStore.selectedCustomer.total_spent) }}
              </span>
            </div>

            <div class="card" style="padding: 16px; background-color: var(--surface-alt);">
              <span class="form-label mb-4 block">Total Orders</span>
              <span class="font-bold text-xl tabular-nums">
                {{ customerStore.selectedCustomer.total_purchased ?? 0 }}
              </span>
            </div>

            <div class="card" style="padding: 16px; background-color: var(--surface-alt);">
              <span class="form-label mb-4 block">Last Purchased</span>
              <span class="font-bold text-lg tabular-nums">
                {{ fmtDate(customerStore.selectedCustomer.last_purchase_at) }}
              </span>
            </div>
          </div>

          <!-- Recent Orders Table -->
          <h3 class="font-bold text-lg mb-12">Recent Order History (Last 10)</h3>

          <div v-if="!customerStore.selectedCustomer.orders || customerStore.selectedCustomer.orders.length === 0" class="empty-state" style="padding: 32px 0;">
            <p class="text-muted">No prior order records found for this customer.</p>
          </div>

          <div v-else class="table-wrap mb-24">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Channel</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in customerStore.selectedCustomer.orders" :key="order.id">
                  <td>
                    <code class="tabular-nums font-semibold" style="font-size: 13px; color: var(--action-primary); background-color: var(--surface-alt); padding: 2px 6px; border-radius: var(--radius-xs);">
                      {{ order.order_number }}
                    </code>
                  </td>
                  <td>
                    <span class="badge badge--blue">
                      {{ order.channel?.name ?? 'POS' }}
                    </span>
                  </td>
                  <td class="tabular-nums font-bold">{{ fmtMoney(order.total_amount) }}</td>
                  <td>
                    <span class="badge badge--green">{{ order.status }}</span>
                  </td>
                  <td class="tabular-nums text-muted text-sm">{{ fmtDate(order.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Close Modal -->
          <div class="flex justify-end">
            <button id="btn-close-customer-modal" class="btn btn--primary" @click="closeModal">
              Close
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tier-progress-track {
  width: 100%;
  height: 6px;
  background-color: var(--border-color);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.tier-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6 0%, #10B981 100%);
  border-radius: var(--radius-full);
  transition: width 300ms ease;
}
</style>
