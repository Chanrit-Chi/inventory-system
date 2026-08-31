<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useCustomerStore } from '@/stores/customerStore'
import {
  Users,
  Search,
  RefreshCw,
  DollarSign,
  Star,
  Crown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  StatCard,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import { getTier as computeTier, type Tier } from '@/utils/loyalty'

const customerStore = useCustomerStore()

const search = ref('')
const page = ref(1)
const sortBy = ref('total_spent')

// Tier thresholds (aligned with mobile reference: dual-criteria spent OR orders)
const TIER_THRESHOLDS: Record<Exclude<Tier, 'BRONZE'>, { spent: number; orders: number }> = {
  SILVER:   { spent: 200,  orders: 3 },
  GOLD:     { spent: 500,  orders: 10 },
  PLATINUM: { spent: 1000, orders: 20 },
}

// VIP counts — Gold & Platinum tier members (dual-criteria)
const vipCount = computed(() =>
  customerStore.customers.filter(c => {
    const spent = parseFloat(String(c.total_spent)) || 0
    const orders = c.total_purchased ?? 0
    const t = getTier(spent, orders)
    return t.name === 'Gold' || t.name === 'Platinum'
  }).length
)

async function loadCustomers() {
  const params: Record<string, unknown> = {
    page: page.value,
    sort_by: sortBy.value,
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

const expandedOrders = ref<Record<string, boolean>>({})

function toggleOrderExpand(orderId: string) {
  expandedOrders.value[orderId] = !expandedOrders.value[orderId]
}

function openCustomerModal(id: string) {
  expandedOrders.value = {}
  customerStore.fetchCustomer(id)
}

const sortedModalOrders = computed(() => {
  if (!customerStore.selectedCustomer?.orders) return []
  return [...customerStore.selectedCustomer.orders].sort(
    (a, b) => (parseFloat(String(b.total_amount)) || 0) - (parseFloat(String(a.total_amount)) || 0)
  )
})

function closeModal() {
  customerStore.selectedCustomer = null
  expandedOrders.value = {}
}

function getTier(totalSpent: number | string | undefined, totalPurchased: number = 0): {
  name: string
  variant: 'purple' | 'warning' | 'info' | 'neutral'
  nextTier: string | null
  nextThreshold: number
  progressPercent: number
  remainingToNext: number
} {
  const spent = typeof totalSpent === 'string' ? parseFloat(totalSpent) : (totalSpent || 0)
  const orders = totalPurchased

  // Get tier from shared utility (dual-criteria)
  const tier = computeTier(spent, orders)

  switch (tier) {
    case 'PLATINUM': {
      return {
        name: 'Platinum',
        variant: 'purple',
        nextTier: null,
        nextThreshold: TIER_THRESHOLDS.PLATINUM.spent,
        progressPercent: 100,
        remainingToNext: 0,
      }
    }
    case 'GOLD': {
      const nextThreshold = TIER_THRESHOLDS.PLATINUM.spent
      const range = nextThreshold - TIER_THRESHOLDS.GOLD.spent
      const progress = ((spent - TIER_THRESHOLDS.GOLD.spent) / range) * 100
      return {
        name: 'Gold',
        variant: 'warning',
        nextTier: 'Platinum',
        nextThreshold,
        progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
        remainingToNext: Math.max(0, nextThreshold - spent),
      }
    }
    case 'SILVER': {
      const nextThreshold = TIER_THRESHOLDS.GOLD.spent
      const range = nextThreshold - TIER_THRESHOLDS.SILVER.spent
      const progress = ((spent - TIER_THRESHOLDS.SILVER.spent) / range) * 100
      return {
        name: 'Silver',
        variant: 'info',
        nextTier: 'Gold',
        nextThreshold,
        progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
        remainingToNext: Math.max(0, nextThreshold - spent),
      }
    }
    case 'BRONZE':
    default: {
      const nextThreshold = TIER_THRESHOLDS.SILVER.spent
      const progress = (spent / nextThreshold) * 100
      return {
        name: 'Bronze',
        variant: 'neutral',
        nextTier: 'Silver',
        nextThreshold,
        progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
        remainingToNext: Math.max(0, nextThreshold - spent),
      }
    }
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
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Customers & Loyalty CRM</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ customerStore.summaryStats.totalCustomers }} Profiles
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Omnichannel CRM profiles, loyalty tier progression bars, lifetime spend, and transaction logs.
        </p>
      </div>

      <Button
        id="btn-refresh-customers"
        variant="outline"
        size="sm"
        class="h-9 px-3 gap-1.5 text-xs"
        :disabled="customerStore.loading"
        @click="loadCustomers"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': customerStore.loading }" />
        <span>Refresh CRM</span>
      </Button>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Customers"
        :value="customerStore.summaryStats.totalCustomers"
        sub="Registered shoppers"
        :icon="Users"
        icon-variant="primary"
      />
      <StatCard
        label="Lifetime Sales"
        :value="fmtMoney(customerStore.summaryStats.totalSpend)"
        sub="Total customer revenue"
        :icon="DollarSign"
        icon-variant="success"
      />
      <StatCard
        label="Average Spend (LTV)"
        :value="fmtMoney(customerStore.summaryStats.avgLtv)"
        sub="Spend per profile"
        :icon="Star"
        icon-variant="warning"
      />
      <StatCard
        label="VIP Tier Members"
        :value="vipCount"
        sub="Gold & Platinum tier"
        :icon="Crown"
        icon-variant="purple"
      />
    </div>

    <!-- Search & Filter Controls -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          id="customer-search-input"
          v-model="search"
          type="text"
          placeholder="Search by customer name or phone number…"
          class="bg-surface"
          @input="onSearchInput"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>

      <div class="flex items-center gap-2">
        <label for="customer-sort-select" class="text-xs text-muted-foreground font-medium">Sort by:</label>
        <select
          id="customer-sort-select"
          v-model="sortBy"
          class="h-9 px-3 text-sm bg-surface border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          @change="page = 1; loadCustomers()"
        >
          <option value="total_spent">Highest Lifetime Spend ($)</option>
          <option value="total_purchased">Most Orders Count</option>
          <option value="latest">Newest Registered</option>
          <option value="name">Customer Name (A-Z)</option>
        </select>
      </div>
    </div>

    <!-- Error Alert -->
    <Alert v-if="customerStore.error" variant="error" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" />
        <span>{{ customerStore.error }}</span>
      </div>
      <Button variant="ghost" size="sm" class="text-xs h-7" @click="loadCustomers">Retry</Button>
    </Alert>

    <!-- Customers Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="customerStore.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="customerStore.customers.length === 0"
        :icon="Users"
        title="No customer profiles found"
        description="Customers are created automatically when entering contact details at POS checkout."
      />

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Customer Profile</TableHead>
              <TableHead class="font-mono">Phone</TableHead>
              <TableHead class="font-mono">Orders</TableHead>
              <TableHead class="font-mono">Lifetime Spend</TableHead>
              <TableHead>Loyalty Tier & Progression</TableHead>
              <TableHead class="font-mono">Last Purchase</TableHead>
              <TableHead class="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="c in customerStore.customers"
              :key="c.id"
              class="hover:bg-surface-subtle/80 transition-colors"
            >
              <TableCell>
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {{ getInitials(c.name) }}
                  </div>
                  <div>
                    <div class="font-semibold text-foreground text-sm hover:text-primary cursor-pointer" @click="openCustomerModal(c.id)">
                      {{ c.name }}
                    </div>
                    <div v-if="c.email" class="text-xs text-muted-foreground">{{ c.email }}</div>
                  </div>
                </div>
              </TableCell>

              <TableCell class="font-mono text-xs text-foreground">
                {{ c.phone || '—' }}
              </TableCell>

              <TableCell class="font-mono text-xs font-semibold text-foreground tabular-nums">
                {{ c.total_purchased ?? 0 }} orders
              </TableCell>

              <TableCell class="font-mono text-sm font-bold text-foreground tabular-nums">
                {{ fmtMoney(c.total_spent) }}
              </TableCell>

              <TableCell class="min-w-[180px]">
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <Badge :variant="getTier(c.total_spent, c.total_purchased).variant" class="text-[10px] px-1.5 py-0 font-semibold">
                      {{ getTier(c.total_spent, c.total_purchased).name }}
                    </Badge>
                    <span v-if="getTier(c.total_spent, c.total_purchased).nextTier" class="text-[10px] text-muted-foreground font-mono">
                      {{ fmtMoney(getTier(c.total_spent, c.total_purchased).remainingToNext) }} to {{ getTier(c.total_spent, c.total_purchased).nextTier }}
                    </span>
                    <span v-else class="text-[10px] font-bold text-purple-600">
                      Top VIP
                    </span>
                  </div>

                  <!-- Progress Bar -->
                  <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      class="h-full bg-primary transition-all duration-300 rounded-full"
                      :style="{ width: `${getTier(c.total_spent, c.total_purchased).progressPercent}%` }"
                    />
                  </div>
                </div>
              </TableCell>

              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ fmtDate(c.last_purchase_at) }}
              </TableCell>

              <TableCell class="text-right">
                <Button
                  :id="`btn-view-customer-${c.id}`"
                  variant="ghost"
                  size="sm"
                  class="h-8 px-2.5 text-xs text-primary hover:text-cta"
                  @click="openCustomerModal(c.id)"
                >
                  Order History
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
      <div
        v-if="customerStore.meta && customerStore.meta.last_page > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
      >
        <span class="font-mono">
          Page {{ page }} of {{ customerStore.meta.last_page }} ({{ customerStore.meta.total }} total)
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page <= 1 || customerStore.loading"
            @click="page--; loadCustomers()"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page >= customerStore.meta.last_page || customerStore.loading"
            @click="page++; loadCustomers()"
          >
            <span>Next</span>
            <ChevronRight :size="14" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Customer History Modal Dialog -->
    <Dialog :open="!!customerStore.selectedCustomer || customerStore.detailLoading" @update:open="(val) => { if (!val) closeModal(); }">
      <DialogContent class="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <div v-if="customerStore.detailLoading" class="py-12 text-center text-muted-foreground text-xs space-y-2">
          <div class="animate-spin text-lg">⏳</div>
          <span>Loading customer purchase history…</span>
        </div>

        <template v-else-if="customerStore.selectedCustomer">
          <DialogHeader>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm">
                  {{ getInitials(customerStore.selectedCustomer.name) }}
                </div>
                <div>
                  <DialogTitle class="font-display text-lg font-bold text-foreground">
                    {{ customerStore.selectedCustomer.name }}
                  </DialogTitle>
                  <div class="flex items-center gap-2 text-xs font-mono text-muted-foreground mt-0.5">
                    <span v-if="customerStore.selectedCustomer.phone">📞 {{ customerStore.selectedCustomer.phone }}</span>
                    <span v-if="customerStore.selectedCustomer.email">✉️ {{ customerStore.selectedCustomer.email }}</span>
                  </div>
                </div>
              </div>

              <Badge :variant="getTier(customerStore.selectedCustomer.total_spent).variant" class="text-xs px-2.5 py-1">
                {{ getTier(customerStore.selectedCustomer.total_spent).name }} Member
              </Badge>
            </div>
          </DialogHeader>

          <!-- Customer Metrics Bar -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
            <div class="p-3 rounded-lg border border-border bg-surface-subtle text-xs">
              <span class="text-muted-foreground uppercase text-[10px] font-semibold block">Lifetime Spend</span>
              <span class="font-display font-bold text-lg text-primary tabular-nums">
                {{ fmtMoney(customerStore.selectedCustomer.total_spent) }}
              </span>
            </div>
            <div class="p-3 rounded-lg border border-border bg-surface-subtle text-xs">
              <span class="text-muted-foreground uppercase text-[10px] font-semibold block">Total Orders</span>
              <span class="font-display font-bold text-lg text-foreground tabular-nums">
                {{ customerStore.selectedCustomer.total_purchased ?? 0 }}
              </span>
            </div>
            <div class="p-3 rounded-lg border border-border bg-surface-subtle text-xs">
              <span class="text-muted-foreground uppercase text-[10px] font-semibold block">Last Purchase</span>
              <span class="font-mono text-sm font-semibold text-foreground mt-0.5 block">
                {{ fmtDate(customerStore.selectedCustomer.last_purchase_at) }}
              </span>
            </div>
          </div>

          <!-- Order History Table -->
          <div class="py-2">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-foreground mb-2">Order History</h4>

            <div v-if="!customerStore.selectedCustomer.orders || customerStore.selectedCustomer.orders.length === 0" class="py-8 text-center text-muted-foreground text-xs">
              No prior order records found for this customer.
            </div>

            <div v-else class="border border-border rounded-lg overflow-hidden">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-muted/40 text-muted-foreground border-b border-border">
                    <th class="py-2.5 px-3">Order #</th>
                    <th class="py-2.5 px-3">Channel</th>
                    <th class="py-2.5 px-3 font-mono text-right">Amount</th>
                    <th class="py-2.5 px-3">Status</th>
                    <th class="py-2.5 px-3 font-mono">Date</th>
                    <th class="py-2.5 px-3 text-right">Items</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/60 font-sans">
                  <template v-for="order in sortedModalOrders" :key="order.id">
                    <tr class="hover:bg-surface-subtle/60 transition-colors">
                      <td class="py-2.5 px-3 font-mono font-semibold text-primary">
                        {{ order.order_number }}
                      </td>
                      <td class="py-2.5 px-3 text-muted-foreground">
                        {{ order.channel?.name ?? 'Main POS' }}
                      </td>
                      <td class="py-2.5 px-3 font-mono text-right font-bold text-foreground">
                        {{ fmtMoney(order.total_amount) }}
                      </td>
                      <td class="py-2.5 px-3">
                        <Badge variant="success" class="text-[10px] px-1.5 py-0">
                          {{ order.status }}
                        </Badge>
                      </td>
                      <td class="py-2.5 px-3 font-mono text-muted-foreground">
                        {{ fmtDate(order.created_at) }}
                      </td>
                      <td class="py-2.5 px-3 text-right">
                        <Button
                          :id="`btn-toggle-order-items-${order.id}`"
                          variant="ghost"
                          size="sm"
                          class="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          @click="toggleOrderExpand(order.id)"
                        >
                          <span>{{ order.items?.length ?? 0 }} items</span>
                          <ChevronUp v-if="expandedOrders[order.id]" :size="12" />
                          <ChevronDown v-else :size="12" />
                        </Button>
                      </td>
                    </tr>

                    <!-- Collapsible nested line items -->
                    <tr v-if="expandedOrders[order.id]" class="bg-surface-subtle/80">
                      <td colspan="6" class="p-3 border-t border-border/40">
                        <div class="bg-card border border-border rounded p-2.5 space-y-1.5">
                          <div
                            v-for="item in (order.items || [])"
                            :key="item.id"
                            class="flex items-center justify-between text-[11px] text-muted-foreground"
                          >
                            <span class="font-medium text-foreground">{{ item.product?.name || 'Product' }} ({{ item.variant?.sku || 'SKU' }})</span>
                            <span class="font-mono">{{ item.quantity }} × {{ fmtMoney(item.unit_price) }} = <strong class="text-foreground">{{ fmtMoney(item.total_price) }}</strong></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter class="mt-4">
            <Button id="btn-close-customer-modal" variant="primary" size="sm" @click="closeModal">
              Close Profile
            </Button>
          </DialogFooter>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
