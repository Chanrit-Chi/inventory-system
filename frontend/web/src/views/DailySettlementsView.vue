<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import api, { ApiError } from '@/api/axios'
import { useToast } from '@/composables/useToast'
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  DollarSign,
  Users,
  ShieldCheck,
  Search,
  FileCheck2,
  Eye,
} from 'lucide-vue-next'
import { Button, Badge, Input, Skeleton, DatePicker, StatCard } from '@/components/ui'
import SellerDailySummaryModal from '@/components/seller/SellerDailySummaryModal.vue'

export interface TeamSellerStatusItem {
  seller: {
    id: string
    name: string
    role: string
    email?: string
    department?: string
  }
  total_orders_count: number
  direct_orders_count: number
  assisted_orders_count: number
  total_sales_amount: number
  total_incentive_amount?: number
  is_confirmed: boolean
  status: 'CONFIRMED' | 'PENDING' | 'REVISED' | 'NO_SALES' | string
  settlement?: {
    id: string
    status: string
    confirmed_at?: string
    confirmed_by?: { id: string; name: string } | null
    notes?: string | null
  } | null
}

export interface TeamDailySettlementSummary {
  date: string
  is_today: boolean
  total_sellers_count: number
  active_sellers_with_sales: number
  confirmed_sellers_count: number
  total_team_sales_amount: number
  total_team_incentive_amount?: number
  total_team_orders_count: number
  sellers: TeamSellerStatusItem[]
}

const toast = useToast()

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayStr = formatLocalDate(new Date())
const selectedDate = ref<string>(todayStr)
const loading = ref(false)
const data = ref<TeamDailySettlementSummary | null>(null)
const search = ref('')
const statusFilter = ref<'ALL' | 'CONFIRMED' | 'PENDING' | 'REVISED' | 'NO_SALES'>('ALL')

// Detail modal
const detailModalOpen = ref(false)
const selectedSellerId = ref<string | null>(null)

async function loadData() {
  loading.value = true
  try {
    const res = await api.get<{ data: TeamDailySettlementSummary }>('/seller-settlements/team-daily', {
      params: { date: selectedDate.value },
    })
    const resData = res.data?.data || res.data
    data.value = resData as TeamDailySettlementSummary
  } catch (err) {
    const e = err as ApiError
    console.warn('Failed to load team daily settlements:', e)
    toast.error(e.message || 'Could not load team daily settlements')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch(selectedDate, () => {
  loadData()
})

function handleChangeDate(offsetDays: number) {
  const parts = selectedDate.value.split('-').map(Number)
  const current = new Date(parts[0], parts[1] - 1, parts[2])
  current.setDate(current.getDate() + offsetDays)
  selectedDate.value = formatLocalDate(current)
}

function handleResetToToday() {
  selectedDate.value = todayStr
}

const filteredSellers = computed(() => {
  if (!data.value?.sellers) return []
  return data.value.sellers.filter((item) => {
    // Search query
    if (search.value.trim()) {
      const q = search.value.toLowerCase().trim()
      const matchName = item.seller.name?.toLowerCase().includes(q)
      const matchRole = item.seller.role?.toLowerCase().includes(q)
      if (!matchName && !matchRole) return false
    }

    // Status filter
    if (statusFilter.value === 'ALL') return true
    if (statusFilter.value === 'CONFIRMED') return item.is_confirmed || item.status === 'CONFIRMED'
    if (statusFilter.value === 'PENDING') return !item.is_confirmed && item.status === 'PENDING'
    if (statusFilter.value === 'REVISED') return item.status === 'REVISED'
    if (statusFilter.value === 'NO_SALES') return item.status === 'NO_SALES' || item.total_orders_count === 0
    return true
  })
})

function openSellerDetail(sellerId: string) {
  selectedSellerId.value = sellerId
  detailModalOpen.value = true
}

function formatMoney(amount: number | string | undefined): string {
  const val = typeof amount === 'string' ? parseFloat(amount) : (amount || 0)
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getStatusBadge(status: string, isConfirmed: boolean) {
  if (isConfirmed || status === 'CONFIRMED') {
    return { variant: 'success' as const, label: 'Confirmed' }
  }
  if (status === 'REVISED') {
    return { variant: 'info' as const, label: 'Revised' }
  }
  if (status === 'NO_SALES') {
    return { variant: 'neutral' as const, label: 'No Sales' }
  }
  return { variant: 'warning' as const, label: 'Pending Sign-off' }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Page Header & Date Navigation -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-2xs">
            <ShieldCheck class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-lg font-bold text-foreground font-display">Daily Shift Settlements</h1>
            <p class="text-xs text-muted-foreground">Team cashier drawer reconciliation, daily sales sign-offs, and shift audits</p>
          </div>
        </div>
      </div>

      <!-- Date Navigator Bar -->
      <div class="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border shadow-2xs">
        <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-surface-subtle" @click="handleChangeDate(-1)" title="Previous Day">
          <ChevronLeft class="w-4 h-4" />
        </Button>

        <DatePicker
          v-model="selectedDate"
          class="h-8 text-xs font-semibold bg-transparent border-0 shadow-none px-1.5"
          :clearable="false"
        />

        <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-surface-subtle" @click="handleChangeDate(1)" title="Next Day">
          <ChevronRight class="w-4 h-4" />
        </Button>

        <Button
          v-if="selectedDate !== todayStr"
          variant="outline"
          size="sm"
          class="h-8 text-xs gap-1 ml-1 border-border text-foreground hover:bg-surface-subtle"
          @click="handleResetToToday"
        >
          <RotateCcw class="w-3 h-3" />
          <span>Today</span>
        </Button>
      </div>
    </div>

    <!-- Summary KPI Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <StatCard
        label="Total Team Sales"
        :value="formatMoney(data?.total_team_sales_amount)"
        :sub="`${data?.total_team_orders_count || 0} total orders processed`"
        :icon="DollarSign"
        icon-variant="success"
      />

      <StatCard
        label="Active Cashiers"
        :value="`${data?.active_sellers_with_sales || 0} / ${data?.total_sellers_count || 0}`"
        sub="Staff with registered sales today"
        :icon="Users"
        icon-variant="primary"
      />

      <StatCard
        label="Reconciliation Status"
        :value="`${data?.confirmed_sellers_count || 0} / ${data?.active_sellers_with_sales || 0}`"
        sub="Cashier shifts confirmed & signed off"
        :icon="FileCheck2"
        icon-variant="purple"
      />

      <StatCard
        label="Shift Target Date"
        :value="selectedDate"
        :sub="selectedDate === todayStr ? '● Active Live Shift Today' : 'Archived Shift Audit'"
        :icon="Clock"
        icon-variant="warning"
      />
    </div>

    <!-- Filters & Table Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          v-model="search"
          placeholder="Search by staff name or role..."
          class="pl-8.5 h-8.5 text-xs bg-surface-subtle border-border text-foreground focus:bg-card focus:border-cta"
        />
      </div>

      <!-- Status Filter Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          v-for="st in [
            { key: 'ALL', label: 'All Staff' },
            { key: 'CONFIRMED', label: 'Confirmed' },
            { key: 'PENDING', label: 'Pending Sign-Off' },
            { key: 'NO_SALES', label: 'No Sales' },
          ]"
          :key="st.key"
          @click="statusFilter = st.key as any"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
            statusFilter === st.key
              ? 'bg-cta text-cta-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle border border-border'
          ]"
        >
          {{ st.label }}
        </button>
      </div>
    </div>

    <!-- Team Sellers Settlement Table -->
    <div class="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton class="h-9 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
      </div>

      <div v-else-if="filteredSellers.length === 0" class="p-12 text-center text-muted-foreground text-xs">
        No staff shift settlement records match your filters for {{ selectedDate }}.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs text-left min-w-[880px]">
          <thead class="bg-surface-subtle text-muted-foreground text-xs font-bold border-b border-border">
            <tr>
              <th class="px-5 py-3">Staff Member</th>
              <th class="px-4 py-3 w-28">Role</th>
              <th class="px-4 py-3 text-right w-32">Direct Sales</th>
              <th class="px-4 py-3 text-right w-32">Assisted Sales</th>
              <th class="px-4 py-3 text-right w-36">Total Shift Revenue</th>
              <th class="px-4 py-3 w-32">Settlement Status</th>
              <th class="px-4 py-3 w-28">Sign-Off By</th>
              <th class="px-5 py-3 text-right w-36">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/70">
            <tr
              v-for="item in filteredSellers"
              :key="item.seller.id"
              class="hover:bg-surface-subtle/60 transition-colors"
            >
              <!-- Staff Name -->
              <td class="px-5 py-3 font-semibold text-foreground">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-cta-muted border border-border-strong text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-2xs">
                    {{ item.seller.name ? item.seller.name.charAt(0) : 'U' }}
                  </div>
                  <div class="min-w-0">
                    <span class="block font-bold text-foreground text-xs truncate">{{ item.seller.name }}</span>
                    <span v-if="item.seller.email" class="text-xs text-muted-foreground font-mono truncate block">{{ item.seller.email }}</span>
                  </div>
                </div>
              </td>

              <!-- Role -->
              <td class="px-4 py-3">
                <span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold uppercase bg-surface-subtle border border-border text-muted-foreground">
                  {{ item.seller.role || 'Cashier' }}
                </span>
              </td>

              <!-- Direct Sales -->
              <td class="px-4 py-3 text-right">
                <div class="text-xs font-bold font-mono text-foreground">
                  {{ formatMoney(item.total_sales_amount > 0 ? (item.direct_orders_count > 0 ? (item.total_sales_amount * (item.direct_orders_count / Math.max(item.total_orders_count, 1))) : 0) : 0) }}
                </div>
                <span class="text-xs text-muted-foreground whitespace-nowrap block mt-0.5">{{ item.direct_orders_count }} orders</span>
              </td>

              <!-- Assisted Sales -->
              <td class="px-4 py-3 text-right">
                <div class="text-xs font-bold font-mono text-foreground">
                  {{ formatMoney(item.total_sales_amount > 0 ? (item.assisted_orders_count > 0 ? (item.total_sales_amount * (item.assisted_orders_count / Math.max(item.total_orders_count, 1))) : 0) : 0) }}
                </div>
                <span class="text-xs text-muted-foreground whitespace-nowrap block mt-0.5">{{ item.assisted_orders_count }} orders</span>
              </td>

              <!-- Total Revenue -->
              <td class="px-4 py-3 text-right">
                <div class="text-xs font-bold font-mono text-primary">
                  {{ formatMoney(item.total_sales_amount) }}
                </div>
                <span class="text-xs text-muted-foreground whitespace-nowrap block mt-0.5">{{ item.total_orders_count }} total orders</span>
              </td>

              <!-- Status Badge -->
              <td class="px-4 py-3">
                <Badge
                  :variant="getStatusBadge(item.status, item.is_confirmed).variant"
                  class="text-xs px-2.5 py-0.5 font-semibold"
                >
                  {{ getStatusBadge(item.status, item.is_confirmed).label }}
                </Badge>
              </td>

              <!-- Sign Off Details -->
              <td class="px-4 py-3 text-xs">
                <div v-if="item.settlement?.confirmed_by">
                  <span class="font-semibold text-foreground block truncate">{{ item.settlement.confirmed_by.name }}</span>
                  <span class="block font-mono text-muted-foreground">{{ item.settlement.confirmed_at ? new Date(item.settlement.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }}</span>
                </div>
                <span v-else class="text-muted-foreground italic">Unsigned</span>
              </td>

              <!-- Actions -->
              <td class="px-5 py-3 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7.5 px-2.5 text-xs gap-1 border-border bg-card hover:bg-surface-subtle hover:text-primary transition-colors shadow-2xs cursor-pointer font-semibold"
                  @click="openSellerDetail(item.seller.id)"
                >
                  <Eye class="w-3.5 h-3.5" />
                  <span>Reconcile Shift</span>
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seller Shift Summary Modal -->
    <SellerDailySummaryModal
      v-model:open="detailModalOpen"
      :target-seller-id="selectedSellerId"
      :initial-date="selectedDate"
      @confirmed="() => loadData()"
    />
  </div>
</template>
