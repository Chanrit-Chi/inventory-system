<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import api, { ApiError } from '@/api/axios'
import { useToast } from '@/composables/useToast'
import {
  Calendar,
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
import { Button, Badge, Input, Card, Skeleton } from '@/components/ui'
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
  <div class="space-y-6">
    <!-- Page Header & Date Navigation -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <ShieldCheck class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground font-display">Daily Shift Settlements</h1>
            <p class="text-xs text-muted-foreground">Team cashier drawer reconciliation, daily sales sign-offs, and shift audits</p>
          </div>
        </div>
      </div>

      <!-- Date Navigator Bar -->
      <div class="flex items-center gap-2 bg-card p-1.5 rounded-xl border border-border shadow-2xs">
        <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="handleChangeDate(-1)" title="Previous Day">
          <ChevronLeft class="w-4 h-4" />
        </Button>

        <div class="flex items-center gap-1.5 px-2">
          <Calendar class="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="date"
            v-model="selectedDate"
            class="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden font-mono"
          />
        </div>

        <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="handleChangeDate(1)" title="Next Day">
          <ChevronRight class="w-4 h-4" />
        </Button>

        <Button
          v-if="selectedDate !== todayStr"
          variant="outline"
          size="sm"
          class="h-8 text-xs gap-1 ml-1"
          @click="handleResetToToday"
        >
          <RotateCcw class="w-3 h-3" />
          <span>Today</span>
        </Button>
      </div>
    </div>

    <!-- Summary KPI Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Total Team Sales</span>
          <div class="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <DollarSign class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-black text-foreground font-display mt-2">
          {{ formatMoney(data?.total_team_sales_amount) }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          {{ data?.total_team_orders_count || 0 }} total orders processed
        </span>
      </Card>

      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Active Cashiers</span>
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <Users class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-black text-foreground font-display mt-2">
          {{ data?.active_sellers_with_sales || 0 }} / {{ data?.total_sellers_count || 0 }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          Staff with registered sales today
        </span>
      </Card>

      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Reconciliation Status</span>
          <div class="p-2 rounded-lg bg-info/10 text-info">
            <FileCheck2 class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-black text-foreground font-display mt-2">
          {{ data?.confirmed_sellers_count || 0 }} / {{ data?.active_sellers_with_sales || 0 }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          Cashier shifts confirmed & signed off
        </span>
      </Card>

      <Card class="p-4 bg-card border-border shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Shift Target Date</span>
          <div class="p-2 rounded-lg bg-warning/10 text-warning">
            <Clock class="w-4 h-4" />
          </div>
        </div>
        <div class="text-lg font-bold text-foreground font-mono mt-2">
          {{ selectedDate }}
        </div>
        <span class="text-3xs text-muted-foreground block mt-1">
          {{ selectedDate === todayStr ? '● Active Live Shift Today' : 'Archived Shift Audit' }}
        </span>
      </Card>
    </div>

    <!-- Filters & Table Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3 rounded-xl border border-border">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          v-model="search"
          placeholder="Search by staff name or role..."
          class="pl-9 h-9 text-xs bg-surface"
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
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          ]"
        >
          {{ st.label }}
        </button>
      </div>
    </div>

    <!-- Team Sellers Settlement Table -->
    <div class="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
      <div v-if="loading" class="p-6 space-y-3">
        <Skeleton class="h-10 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
        <Skeleton class="h-12 w-full rounded-lg" />
      </div>

      <div v-else-if="filteredSellers.length === 0" class="p-12 text-center text-muted-foreground text-xs">
        No staff shift settlement records match your filters for {{ selectedDate }}.
      </div>

      <table v-else class="w-full text-xs text-left">
        <thead class="bg-muted/40 text-muted-foreground text-2xs uppercase border-b border-border font-semibold">
          <tr>
            <th class="px-5 py-3">Staff Member</th>
            <th class="px-4 py-3">Role</th>
            <th class="px-4 py-3 text-right">Direct Sales</th>
            <th class="px-4 py-3 text-right">Assisted Sales</th>
            <th class="px-4 py-3 text-right">Total Shift Revenue</th>
            <th class="px-4 py-3">Settlement Status</th>
            <th class="px-4 py-3">Sign-Off By</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="item in filteredSellers"
            :key="item.seller.id"
            class="hover:bg-muted/20 transition-colors"
          >
            <!-- Staff Name -->
            <td class="px-5 py-3 font-semibold text-foreground">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                  {{ item.seller.name ? item.seller.name.charAt(0) : 'U' }}
                </div>
                <div>
                  <span class="block font-bold text-foreground">{{ item.seller.name }}</span>
                  <span v-if="item.seller.email" class="text-3xs text-muted-foreground">{{ item.seller.email }}</span>
                </div>
              </div>
            </td>

            <!-- Role -->
            <td class="px-4 py-3">
              <Badge variant="neutral" class="text-[10px] px-2 py-0">
                {{ item.seller.role || 'Cashier' }}
              </Badge>
            </td>

            <!-- Direct Sales -->
            <td class="px-4 py-3 text-right font-mono font-medium text-foreground">
              <div>{{ formatMoney(item.total_sales_amount > 0 ? (item.direct_orders_count > 0 ? (item.total_sales_amount * (item.direct_orders_count / Math.max(item.total_orders_count, 1))) : 0) : 0) }}</div>
              <span class="text-3xs text-muted-foreground">{{ item.direct_orders_count }} orders</span>
            </td>

            <!-- Assisted Sales -->
            <td class="px-4 py-3 text-right font-mono font-medium text-foreground">
              <div>{{ formatMoney(item.total_sales_amount > 0 ? (item.assisted_orders_count > 0 ? (item.total_sales_amount * (item.assisted_orders_count / Math.max(item.total_orders_count, 1))) : 0) : 0) }}</div>
              <span class="text-3xs text-muted-foreground">{{ item.assisted_orders_count }} orders</span>
            </td>

            <!-- Total Revenue -->
            <td class="px-4 py-3 text-right font-mono font-black text-sm text-foreground">
              <div>{{ formatMoney(item.total_sales_amount) }}</div>
              <span class="text-3xs text-muted-foreground">{{ item.total_orders_count }} total orders</span>
            </td>

            <!-- Status Badge -->
            <td class="px-4 py-3">
              <Badge
                :variant="getStatusBadge(item.status, item.is_confirmed).variant"
                class="text-[11px] px-2.5 py-0.5"
              >
                {{ getStatusBadge(item.status, item.is_confirmed).label }}
              </Badge>
            </td>

            <!-- Sign Off Details -->
            <td class="px-4 py-3 text-muted-foreground text-3xs">
              <div v-if="item.settlement?.confirmed_by">
                <span class="font-semibold text-foreground">{{ item.settlement.confirmed_by.name }}</span>
                <span class="block font-mono">{{ item.settlement.confirmed_at ? new Date(item.settlement.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }}</span>
              </div>
              <span v-else class="text-muted-foreground italic">Unsigned</span>
            </td>

            <!-- Actions -->
            <td class="px-4 py-3 text-right">
              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs gap-1.5"
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

    <!-- Seller Shift Summary Modal -->
    <SellerDailySummaryModal
      v-model:open="detailModalOpen"
      :target-seller-id="selectedSellerId"
      :initial-date="selectedDate"
      @confirmed="() => loadData()"
    />
  </div>
</template>
