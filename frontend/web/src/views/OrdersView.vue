<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'

const orderStore = useOrderStore()

const search = ref('')
const selectedChannel = ref('')
const selectedStatus = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)

const isCopied = ref(false)
const showPrintReceipt = ref(false)

// KPI Summary Computations
const totalOrdersCount = computed(() => orderStore.meta?.total ?? orderStore.orders.length)
const totalGrossSales = computed(() =>
  orderStore.orders.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)
)
const completedOrdersCount = computed(() =>
  orderStore.orders.filter(o => o.status === 'COMPLETED').length
)
const pendingOrdersCount = computed(() =>
  orderStore.orders.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING').length
)

async function loadOrders() {
  const params: Record<string, unknown> = {
    page: page.value,
  }

  if (search.value.trim()) params.search = search.value.trim()
  if (selectedChannel.value) params.channel_id = selectedChannel.value
  if (selectedStatus.value) params.status = selectedStatus.value
  if (dateFrom.value) params.date_from = dateFrom.value
  if (dateTo.value) params.date_to = dateTo.value

  await orderStore.fetchOrders(params)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadOrders()
  }, 300)
}

function onFilterChange() {
  page.value = 1
  loadOrders()
}

function resetFilters() {
  search.value = ''
  selectedChannel.value = ''
  selectedStatus.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
  loadOrders()
}

function openOrderDetails(orderId: string) {
  showPrintReceipt.value = false
  orderStore.fetchOrder(orderId)
}

function closeModal() {
  orderStore.clearSelectedOrder()
  isCopied.value = false
  showPrintReceipt.value = false
}

function copyOrderNumber(orderNumber: string) {
  navigator.clipboard.writeText(orderNumber)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: 'badge--green',
    PENDING: 'badge--yellow',
    PROCESSING: 'badge--blue',
    CANCELLED: 'badge--red',
  }
  return map[status.toUpperCase()] ?? 'badge--neutral'
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

onMounted(() => {
  orderStore.fetchChannels()
  loadOrders()
})
</script>

<template>
  <div class="flex-col gap-24">
    <!-- Header -->
    <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 16px;">
      <div>
        <div class="flex items-center gap-10">
          <h1 class="page-title">Orders & Sales Transactions</h1>
          <span class="badge badge--blue font-semibold tabular-nums">{{ totalOrdersCount }} Orders</span>
        </div>
        <p class="text-muted text-sm mt-4">
          Monitor sales across physical POS registers, ABA PayWay mobile checkouts, and online channels.
        </p>
      </div>

      <button id="btn-refresh-orders" class="btn btn--ghost" @click="loadOrders">
        ↺ Refresh Orders
      </button>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid-4 gap-16">
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--primary">
            <span>🧾</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Volume</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums">{{ totalOrdersCount }}</span>
          <span class="stat-card-label">Total Transactions</span>
          <span class="stat-card-sub">Recorded across all channels</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--success">
            <span>💵</span>
          </div>
          <div class="trend-pill trend-pill--up">
            <span>● Net Sales</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-success);">
            {{ fmtMoney(totalGrossSales) }}
          </span>
          <span class="stat-card-label">Gross Revenue</span>
          <span class="stat-card-sub">Completed sales volume</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--warning">
            <span>✓</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Fulfilled</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-warning);">
            {{ completedOrdersCount }}
          </span>
          <span class="stat-card-label">Completed Orders</span>
          <span class="stat-card-sub">Paid and delivered orders</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div class="icon-badge icon-badge--purple">
            <span>⏳</span>
          </div>
          <div class="trend-pill trend-pill--neutral">
            <span>Open</span>
          </div>
        </div>
        <div class="stat-card-body">
          <span class="stat-card-value tabular-nums" style="color: var(--status-purple-text);">
            {{ pendingOrdersCount }}
          </span>
          <span class="stat-card-label">Pending / In Progress</span>
          <span class="stat-card-sub">Awaiting payment or delivery</span>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <section class="card">
      <div class="grid-4 gap-12" style="grid-template-columns: 2fr 1fr 1fr 1fr; align-items: flex-end;">
        <div class="form-group">
          <label class="form-label">Search Order #</label>
          <input
            id="order-search-input"
            v-model="search"
            type="text"
            placeholder="e.g. ORD-2026-..."
            @input="onSearchInput"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Sales Channel</label>
          <select id="order-channel-filter" v-model="selectedChannel" @change="onFilterChange">
            <option value="">All Channels</option>
            <option v-for="ch in orderStore.channels" :key="ch.id" :value="ch.id">
              {{ ch.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Status</label>
          <select id="order-status-filter" v-model="selectedStatus" @change="onFilterChange">
            <option value="">All Statuses</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div class="flex items-center gap-8">
          <button id="btn-reset-orders" class="btn btn--ghost" style="width: 100%;" @click="resetFilters">
            Reset
          </button>
        </div>
      </div>

      <div class="grid-2 gap-12 mt-12" style="max-width: 480px;">
        <div class="form-group">
          <label class="form-label">Date From</label>
          <input id="order-date-from" type="date" v-model="dateFrom" @change="onFilterChange" />
        </div>
        <div class="form-group">
          <label class="form-label">Date To</label>
          <input id="order-date-to" type="date" v-model="dateTo" @change="onFilterChange" />
        </div>
      </div>
    </section>

    <!-- Error Alert -->
    <div v-if="orderStore.error" class="alert alert--error">
      <span>⚠️ {{ orderStore.error }}</span>
      <button class="btn btn--ghost btn--sm" @click="loadOrders" style="margin-left: auto;">Retry</button>
    </div>

    <!-- Orders Table -->
    <section class="card" style="padding: 0; overflow: hidden;">
      <div v-if="orderStore.loading" style="padding: 24px;">
        <div v-for="i in 5" :key="i" class="skeleton-row"></div>
      </div>

      <div v-else-if="orderStore.orders.length === 0" class="empty-state">
        <div class="empty-icon">🧾</div>
        <h3 class="font-bold text-lg mb-8">No orders found</h3>
        <p class="text-muted">No orders match the selected search or filter conditions.</p>
      </div>

      <div v-else class="table-wrap" style="border: none; border-radius: 0; box-shadow: none;">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Sales Channel</th>
              <th>Customer</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Order Date</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in orderStore.orders" :key="o.id">
              <td>
                <code class="tabular-nums font-semibold" style="font-size: 13px; color: var(--action-primary); background-color: var(--surface-alt); padding: 3px 8px; border-radius: var(--radius-xs); border: 1px solid var(--border-color);">
                  {{ o.order_number }}
                </code>
              </td>
              <td>
                <span class="badge badge--blue">
                  {{ o.channel?.name ?? 'Main POS' }}
                </span>
              </td>
              <td>
                <div v-if="o.customer" class="font-semibold">{{ o.customer.name }}</div>
                <span v-else class="text-muted text-xs">Walk-in Counter Guest</span>
              </td>
              <td class="tabular-nums font-bold" style="font-size: 15px; color: var(--text-primary);">
                {{ fmtMoney(o.total_amount) }}
              </td>
              <td>
                <span class="badge" :class="statusBadge(o.status)">
                  {{ o.status }}
                </span>
              </td>
              <td class="tabular-nums text-muted text-sm">
                {{ fmtDate(o.created_at) }}
              </td>
              <td style="text-align: right;">
                <button
                  :id="`btn-view-order-${o.id}`"
                  class="btn btn--ghost btn--sm"
                  @click="openOrderDetails(o.id)"
                >
                  View Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="orderStore.meta && orderStore.meta.last_page > 1"
        class="pagination"
        style="padding: 16px 24px; border-top: 1px solid var(--border-color);"
      >
        <button
          class="page-btn"
          :disabled="page <= 1 || orderStore.loading"
          @click="page--; loadOrders()"
        >
          ‹ Previous
        </button>
        <span class="page-info tabular-nums">
          Page {{ page }} of {{ orderStore.meta.last_page }} ({{ orderStore.meta.total }} total)
        </span>
        <button
          class="page-btn"
          :disabled="page >= orderStore.meta.last_page || orderStore.loading"
          @click="page++; loadOrders()"
        >
          Next ›
        </button>
      </div>
    </section>

    <!-- Slide-Over Drawer / Order Details Modal -->
    <div
      v-if="orderStore.selectedOrder || orderStore.detailLoading"
      class="modal-backdrop"
      @click.self="closeModal"
    >
      <div class="modal modal--lg slide-drawer">
        <div v-if="orderStore.detailLoading" style="padding: 48px; text-align: center;">
          <div class="spinner spinner--dark" style="width: 28px; height: 28px; margin-bottom: 12px;"></div>
          <p class="text-muted">Loading order timeline & breakdown…</p>
        </div>

        <template v-else-if="orderStore.selectedOrder">
          <!-- Drawer Header -->
          <div class="flex items-center justify-between mb-20 pb-16" style="border-bottom: 1px solid var(--border-color);">
            <div class="flex items-center gap-12">
              <div>
                <span class="text-xs text-muted block">Transaction Record</span>
                <h2 class="modal-title" style="margin: 0;">
                  {{ orderStore.selectedOrder.order_number }}
                </h2>
              </div>
              <button
                class="btn btn--ghost btn--sm"
                @click="copyOrderNumber(orderStore.selectedOrder.order_number)"
                title="Copy Order #"
              >
                {{ isCopied ? '✓ Copied' : '📋 Copy #' }}
              </button>
            </div>

            <div class="flex items-center gap-8">
              <span class="badge badge--blue">
                {{ orderStore.selectedOrder.channel?.name ?? 'POS Register' }}
              </span>
              <span class="badge" :class="statusBadge(orderStore.selectedOrder.status)">
                {{ orderStore.selectedOrder.status }}
              </span>
              <button class="modal-close-btn" @click="closeModal" title="Close Drawer">
                ✕
              </button>
            </div>
          </div>

          <!-- Order Timeline Progress Tracker -->
          <div class="timeline-bar mb-24">
            <div class="timeline-step timeline-step--done">
              <div class="timeline-dot">✓</div>
              <div class="timeline-label">Order Created</div>
              <div class="timeline-time">{{ fmtDate(orderStore.selectedOrder.created_at) }}</div>
            </div>
            <div class="timeline-line timeline-line--done"></div>
            <div class="timeline-step" :class="{ 'timeline-step--done': orderStore.selectedOrder.payments?.length }">
              <div class="timeline-dot">{{ orderStore.selectedOrder.payments?.length ? '✓' : '2' }}</div>
              <div class="timeline-label">Payment Settled</div>
              <div class="timeline-time">
                {{ orderStore.selectedOrder.payments?.[0]?.payment_method || 'Pending' }}
              </div>
            </div>
            <div class="timeline-line" :class="{ 'timeline-line--done': orderStore.selectedOrder.status === 'COMPLETED' }"></div>
            <div class="timeline-step" :class="{ 'timeline-step--done': orderStore.selectedOrder.status === 'COMPLETED' }">
              <div class="timeline-dot">{{ orderStore.selectedOrder.status === 'COMPLETED' ? '✓' : '3' }}</div>
              <div class="timeline-label">Fulfilled & Closed</div>
              <div class="timeline-time">{{ orderStore.selectedOrder.status }}</div>
            </div>
          </div>

          <!-- Customer & Order Details -->
          <div class="grid-2 gap-16 mb-24">
            <div class="card" style="padding: 16px; background-color: var(--surface-alt);">
              <span class="form-label mb-8 block">Customer Profile</span>
              <div v-if="orderStore.selectedOrder.customer">
                <div class="font-bold text-base">{{ orderStore.selectedOrder.customer.name }}</div>
                <div class="text-sm text-muted tabular-nums mt-2">📞 {{ orderStore.selectedOrder.customer.phone }}</div>
                <div v-if="orderStore.selectedOrder.customer.email" class="text-sm text-muted">
                  ✉️ {{ orderStore.selectedOrder.customer.email }}
                </div>
                <div v-if="orderStore.selectedOrder.customer.address" class="text-sm text-muted mt-4">
                  📍 {{ orderStore.selectedOrder.customer.address }}
                </div>
              </div>
              <div v-else class="text-muted text-sm">
                Walk-in Counter Guest (No CRM profile linked)
              </div>
            </div>

            <div class="card" style="padding: 16px; background-color: var(--surface-alt);">
              <span class="form-label mb-8 block">Transaction Overview</span>
              <div class="text-sm mb-4">
                <span class="text-muted">Placed Date: </span>
                <span class="tabular-nums font-semibold">{{ fmtDate(orderStore.selectedOrder.created_at) }}</span>
              </div>
              <div v-if="orderStore.selectedOrder.notes" class="text-sm mt-4">
                <span class="text-muted">Order Notes: </span>
                <span class="font-medium">{{ orderStore.selectedOrder.notes }}</span>
              </div>
              <div class="mt-8">
                <span class="badge badge--green text-xs">ACID Transaction ID: {{ orderStore.selectedOrder.id.slice(0, 8) }}…</span>
              </div>
            </div>
          </div>

          <!-- Line Items Table -->
          <h3 class="font-bold text-lg mb-12">Purchased Items Breakdown</h3>
          <div class="table-wrap mb-24">
            <table>
              <thead>
                <tr>
                  <th>Product / Variant SKU</th>
                  <th style="width: 110px; text-align: right;">Unit Price</th>
                  <th style="width: 80px; text-align: center;">Qty</th>
                  <th style="width: 130px; text-align: right;">Line Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in orderStore.selectedOrder.items" :key="item.id">
                  <td>
                    <div class="font-semibold">{{ item.variant?.product?.name ?? 'Product' }}</div>
                    <code class="tabular-nums text-xs" style="color: var(--action-primary); background-color: var(--surface-alt); padding: 2px 6px; border-radius: var(--radius-xs);">
                      {{ item.variant?.sku ?? 'SKU-N/A' }}
                    </code>
                  </td>
                  <td class="tabular-nums text-right">{{ fmtMoney(item.unit_price) }}</td>
                  <td class="tabular-nums text-center font-bold">{{ item.quantity }}</td>
                  <td class="tabular-nums font-bold text-right" style="color: var(--text-primary);">
                    {{ fmtMoney(item.total_price) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Financial Breakdown & Payment Transactions -->
          <div class="grid-2 gap-16 mb-24">
            <!-- Payment Transactions -->
            <div class="card" style="padding: 16px;">
              <span class="form-label mb-12 block">Payment Methods & Receipts</span>
              <div v-if="!orderStore.selectedOrder.payments || orderStore.selectedOrder.payments.length === 0" class="text-muted text-sm">
                No payment transactions recorded.
              </div>
              <div v-else class="flex-col gap-8">
                <div
                  v-for="p in orderStore.selectedOrder.payments"
                  :key="p.id"
                  style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; background-color: var(--surface-alt);"
                >
                  <div>
                    <div class="font-semibold text-sm">{{ p.payment_method }}</div>
                    <div v-if="p.transaction_ref" class="text-xs text-muted tabular-nums">Ref: {{ p.transaction_ref }}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold tabular-nums">{{ fmtMoney(p.amount) }}</div>
                    <span class="badge badge--green text-xs">{{ p.status }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Financial Summary -->
            <div class="card" style="padding: 16px; background-color: var(--surface-alt);">
              <span class="form-label mb-12 block">Order Total Breakdown</span>
              <div class="flex-col gap-8 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted">Subtotal</span>
                  <span class="tabular-nums font-semibold">{{ fmtMoney(orderStore.selectedOrder.subtotal) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted">Discount</span>
                  <span class="tabular-nums" style="color: var(--status-error);">
                    - {{ fmtMoney(orderStore.selectedOrder.discount) }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted">Delivery Fee</span>
                  <span class="tabular-nums">{{ fmtMoney(orderStore.selectedOrder.delivery_cost) }}</span>
                </div>
                <div
                  class="flex justify-between pt-12 mt-8"
                  style="border-top: 2px solid var(--border-color); font-weight: 700; font-size: 19px;"
                >
                  <span>Grand Total</span>
                  <span class="tabular-nums" style="color: var(--action-primary);">
                    {{ fmtMoney(orderStore.selectedOrder.total_amount) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Drawer Action Footer -->
          <div class="flex items-center justify-between pt-16" style="border-top: 1px solid var(--border-color);">
            <div class="flex items-center gap-8">
              <span class="text-xs text-muted">OmniPOS POS Transaction Record</span>
            </div>

            <div class="flex items-center gap-12">
              <button id="btn-close-order-modal" class="btn btn--primary" @click="closeModal">
                Close Order
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background-color: var(--surface-alt);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.timeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}

.timeline-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--surface-base);
  border: 2px solid var(--border-strong);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-step--done .timeline-dot {
  background-color: var(--status-success);
  border-color: var(--status-success);
  color: #ffffff;
}

.timeline-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.timeline-time {
  font-size: 11px;
  color: var(--text-muted);
}

.timeline-line {
  flex: 1;
  height: 2px;
  background-color: var(--border-strong);
  margin: 0 12px;
  margin-bottom: 24px;
}

.timeline-line--done {
  background-color: var(--status-success);
}
</style>
