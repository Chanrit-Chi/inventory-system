<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api, { ApiError } from '@/api/axios'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/composables/useToast'
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  User,
  Users,
  FileCheck2,
  ShieldCheck,
  Ban,
  Sparkles,
} from 'lucide-vue-next'
import { Button, Badge, Skeleton, DatePicker, SelectField } from '@/components/ui'

export interface SellerSettlementOrderItem {
  id: string
  order_number: string
  status: string
  total_amount: number
  incentive?: number
  items_count?: number
  customer_name?: string
  channel_name?: string
  created_at: string
  input_by_user?: { id: string; name: string; role?: string } | null
  is_assisted?: boolean
}

export interface SellerDailySettlementRecord {
  id: string
  seller_id: string
  confirmed_date: string
  total_orders_count: number
  total_sales_amount: number
  total_incentive_amount?: number
  status: 'CONFIRMED' | 'REVISED' | string
  confirmed_at: string
  confirmed_by?: string
  confirmer?: { id: string; name: string }
  notes?: string
}

export interface SellerDailySettlementSummary {
  seller: { id: string; name: string; role?: string }
  date: string
  is_today: boolean
  total_orders_count: number
  direct_orders_count: number
  assisted_orders_count: number
  total_sales_amount: number
  total_incentive_amount?: number
  direct_orders: SellerSettlementOrderItem[]
  assisted_orders: SellerSettlementOrderItem[]
  settlement: SellerDailySettlementRecord | null
  is_confirmed: boolean
}

interface Props {
  open: boolean
  targetSellerId?: string | null
  initialDate?: string
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  targetSellerId: null,
  initialDate: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirmed': [summary: SellerDailySettlementSummary]
}>()

const authStore = useAuthStore()
const toast = useToast()

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayStr = formatLocalDate(new Date())
const selectedDate = ref(props.initialDate || todayStr)
const loading = ref(false)
const confirming = ref(false)
const settlementData = ref<SellerDailySettlementSummary | null>(null)
const activeTab = ref<'all' | 'direct' | 'assisted'>('all')
const confirmationNotes = ref('')
const showConfirmPrompt = ref(false)

// Staff selector for managers/admins
interface StaffUser {
  id: string
  name: string
  role?: string
}
const staffList = ref<StaffUser[]>([])
const selectedStaffId = ref<string>('')

const staffOptions = computed(() => staffList.value.map(s => ({
  label: `${s.name} (${s.role || 'Staff'})`,
  value: s.id,
})))

const isManager = computed(() => {
  if (!authStore.user?.role) return false
  const r = authStore.user.role.toUpperCase().trim()
  return r === 'SUPER_ADMIN' || r === 'SUPERADMIN' || r === 'ADMIN' || r === 'MANAGER'
})

const currentSellerId = computed(() => {
  if (!isManager.value) {
    return authStore.user?.id ? String(authStore.user.id) : ''
  }
  return selectedStaffId.value || (props.targetSellerId ? String(props.targetSellerId) : '') || (authStore.user?.id ? String(authStore.user.id) : '')
})

const currentSeller = computed(() => {
  if (settlementData.value?.seller) return settlementData.value.seller
  const found = staffList.value.find((s) => String(s.id) === String(currentSellerId.value))
  if (found) return found
  if (authStore.user && String(authStore.user.id) === String(currentSellerId.value)) {
    return authStore.user
  }
  return null
})

async function fetchStaffUsers() {
  if (!isManager.value) return
  try {
    const res = await api.get('/staff-members')
    const list = res.data?.data || res.data || []
    staffList.value = Array.isArray(list) ? list : []
  } catch {
    // Ignore if not permitted
  }
}

async function loadSettlement() {
  if (!currentSellerId.value) return
  loading.value = true
  try {
    const res = await api.get<{ data: SellerDailySettlementSummary }>('/seller-settlements/summary', {
      params: {
        date: selectedDate.value,
        seller_id: currentSellerId.value,
      },
    })
    const data = res.data?.data || res.data
    settlementData.value = data as SellerDailySettlementSummary
    if (settlementData.value?.settlement?.notes) {
      confirmationNotes.value = settlementData.value.settlement.notes
    } else {
      confirmationNotes.value = ''
    }
  } catch (err) {
    const e = err as ApiError
    console.warn('Failed to fetch seller daily settlement summary:', e)
    toast.error(e.message || 'Could not load shift settlement summary')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.targetSellerId, props.initialDate],
  ([isOpen, targetId, dateVal]) => {
    if (isOpen) {
      if (dateVal) selectedDate.value = String(dateVal)
      if (isManager.value && targetId) {
        selectedStaffId.value = String(targetId)
      } else if (authStore.user?.id) {
        selectedStaffId.value = String(authStore.user.id)
      }
      fetchStaffUsers()
      loadSettlement()
    }
  },
  { immediate: true }
)

function handleChangeDate(offsetDays: number) {
  const parts = selectedDate.value.split('-').map(Number)
  const current = new Date(parts[0], parts[1] - 1, parts[2])
  current.setDate(current.getDate() + offsetDays)
  selectedDate.value = formatLocalDate(current)
  loadSettlement()
}

function handleResetToToday() {
  selectedDate.value = todayStr
  loadSettlement()
}

const hasNoSales = computed(() => {
  return (settlementData.value?.total_orders_count || 0) === 0
})

const displayedOrders = computed(() => {
  if (!settlementData.value) return []
  const direct = settlementData.value.direct_orders || []
  const assisted = settlementData.value.assisted_orders || []

  if (activeTab.value === 'direct') return direct
  if (activeTab.value === 'assisted') return assisted
  return [...direct, ...assisted]
})

function triggerConfirmSettlement() {
  if (!currentSellerId.value) return
  if (hasNoSales.value) {
    toast.warning('This staff member has no sales recorded on this date. Sign-off is disabled.')
    return
  }
  showConfirmPrompt.value = true
}

async function executeConfirmSettlement() {
  if (!currentSellerId.value) return
  showConfirmPrompt.value = false
  confirming.value = true
  try {
    const payload = {
      seller_id: currentSellerId.value,
      confirmed_date: selectedDate.value,
      notes: confirmationNotes.value.trim() || undefined,
    }
    await api.post('/seller-settlements/confirm', payload)
    toast.success('Daily shift settlement confirmed and signed off successfully!')
    await loadSettlement()
    if (settlementData.value) {
      emit('confirmed', settlementData.value)
    }
  } catch (err) {
    const e = err as ApiError
    toast.error(e.message || 'Failed to confirm daily settlement')
  } finally {
    confirming.value = false
  }
}

function handlePrintSlip() {
  window.print()
}

async function handleShareSummary() {
  if (!settlementData.value) return
  const data = settlementData.value
  const lines = [
    `📊 DAILY SALES CONFIRMATION - ${data.date}`,
    `👤 Seller: ${data.seller?.name || currentSeller.value?.name || 'Staff'}`,
    `💰 Total Sales: $${(data.total_sales_amount || 0).toFixed(2)} (${data.total_orders_count || 0} orders)`,
    `🎁 Estimated Incentive: +$${(data.total_incentive_amount || 0).toFixed(2)}`,
    `🔹 Direct Sales: ${data.direct_orders_count || 0} orders`,
    `🔹 Assisted by Team: ${data.assisted_orders_count || 0} orders`,
    `Status: ${data.is_confirmed ? '✅ CONFIRMED' : '⏳ PENDING SIGN-OFF'}`,
    data.settlement?.confirmed_at ? `Signed at: ${data.settlement.confirmed_at}` : '',
  ].filter(Boolean).join('\n')

  try {
    await navigator.clipboard.writeText(lines)
    toast.success('Shift summary copied to clipboard!')
  } catch {
    toast.info('Summary ready to share')
  }
}

function formatMoney(amount: number | string | undefined): string {
  const val = typeof amount === 'string' ? parseFloat(amount) : (amount || 0)
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(isoStr: string | undefined): string {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="emit('update:open', false)"
    />

    <!-- Dialog Body -->
    <div class="relative w-full max-w-3xl rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150 text-foreground">
      <!-- Header -->
      <div class="px-5 py-3.5 bg-surface-subtle border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-2xs shrink-0">
            <FileCheck2 class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-bold text-foreground font-display truncate">Daily Shift Settlement</h3>
              <Badge
                v-if="settlementData?.is_confirmed"
                variant="success"
                class="text-3xs px-2 py-0.5"
              >
                Confirmed & Signed Off
              </Badge>
              <Badge
                v-else-if="settlementData?.settlement?.status === 'REVISED'"
                variant="warning"
                class="text-3xs px-2 py-0.5"
              >
                Orders Revised
              </Badge>
              <Badge
                v-else
                variant="warning"
                class="text-3xs px-2 py-0.5"
              >
                Pending Sign-Off
              </Badge>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <!-- Role-aware seller indicator/switcher -->
              <div v-if="isManager && staffList.length > 0" class="flex items-center gap-1.5">
                <span class="text-3xs text-muted-foreground font-bold uppercase">Seller:</span>
                <SelectField
                  v-model="selectedStaffId"
                  :options="staffOptions"
                  placeholder="Select seller"
                  class="h-7 w-44 px-2 text-xs bg-card border-border font-semibold"
                  @change="loadSettlement"
                />
              </div>
              <div v-else class="flex items-center gap-1 text-3xs text-primary font-bold bg-cta-muted px-2 py-0.5 rounded-full border border-border-strong">
                <User class="w-3 h-3" />
                <span>{{ settlementData?.seller?.name || authStore.user?.name || 'My Shift Sales' }}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="emit('update:open', false)"
          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Controls Filter Bar (Date Navigator & Action Buttons) -->
      <div class="px-5 py-2.5 bg-card border-b border-border flex flex-wrap items-center justify-between gap-2.5">
        <!-- Date Navigator -->
        <div class="flex items-center gap-1 bg-surface-subtle p-1 rounded-xl border border-border">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-card"
            @click="handleChangeDate(-1)"
            title="Previous Day"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
          </Button>

          <DatePicker
            v-model="selectedDate"
            class="h-7 text-xs font-semibold bg-transparent border-0 shadow-none px-1.5"
            :clearable="false"
            @change="loadSettlement"
          />

          <Button
            variant="ghost"
            size="sm"
            class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-card"
            @click="handleChangeDate(1)"
            title="Next Day"
          >
            <ChevronRight class="w-3.5 h-3.5" />
          </Button>

          <Button
            v-if="selectedDate !== todayStr"
            variant="outline"
            size="sm"
            class="h-7 text-3xs gap-1 ml-1 border-border text-foreground bg-card hover:bg-surface-subtle"
            @click="handleResetToToday"
          >
            <RotateCcw class="w-2.5 h-2.5" />
            <span>Today</span>
          </Button>
        </div>

        <!-- Quick Actions: Refresh, Share, Print -->
        <div class="flex items-center gap-1.5">
          <Button variant="outline" size="sm" class="h-7.5 px-2.5 text-xs gap-1 border-border text-foreground hover:bg-surface-subtle" @click="loadSettlement">
            <Clock class="w-3 h-3" />
            <span>Refresh</span>
          </Button>
          <Button variant="outline" size="sm" class="h-7.5 px-2.5 text-xs gap-1 border-border text-foreground hover:bg-surface-subtle" @click="handleShareSummary">
            <Share2 class="w-3 h-3 text-primary" />
            <span>Share</span>
          </Button>
          <Button variant="outline" size="sm" class="h-7.5 px-2.5 text-xs gap-1 border-border text-foreground hover:bg-surface-subtle" @click="handlePrintSlip">
            <Printer class="w-3 h-3 text-primary" />
            <span>Print Daily Slip</span>
          </Button>
        </div>
      </div>

      <!-- Main Body Content -->
      <div class="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
        <div v-if="loading" class="space-y-3">
          <Skeleton class="h-20 w-full rounded-xl" />
          <Skeleton class="h-40 w-full rounded-xl" />
        </div>

        <template v-else-if="settlementData">
          <!-- Proof / Confirmation Status Banner -->
          <div
            v-if="settlementData.is_confirmed"
            class="p-3.5 rounded-xl bg-success-bg border border-success-border flex items-start gap-3 text-success-text shadow-2xs"
          >
            <CheckCircle2 class="w-5 h-5 text-success-text shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-bold text-success-text">Confirmed & Signed Off</h4>
              <p class="text-xs text-success-text/90 mt-0.5 leading-relaxed">
                Proof locked at {{ settlementData.settlement?.confirmed_at ? formatTime(settlementData.settlement.confirmed_at) : 'Today' }}
                by <strong class="text-success-text font-bold">{{ settlementData.settlement?.confirmer?.name || settlementData.seller?.name || 'Staff' }}</strong>
              </p>
              <p v-if="settlementData.settlement?.notes" class="text-xs text-success-text italic mt-1.5 bg-card/70 p-2 rounded-md border border-success-border">
                Note: "{{ settlementData.settlement.notes }}"
              </p>
            </div>
          </div>

          <div
            v-else-if="settlementData.settlement?.status === 'REVISED'"
            class="p-3.5 rounded-xl bg-warning-bg border border-warning-border flex items-start gap-3 text-warning-text shadow-2xs"
          >
            <AlertCircle class="w-5 h-5 text-warning-text shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-bold text-warning-text">Orders Revised - Re-confirmation Needed</h4>
              <p class="text-xs text-warning-text/90 mt-0.5 leading-relaxed">
                An order was modified or reassigned after your previous sign-off. Please review and re-confirm today's sales.
              </p>
            </div>
          </div>

          <div
            v-else
            class="p-3.5 rounded-xl bg-warning-bg border border-warning-border flex items-start gap-3 text-warning-text shadow-2xs"
          >
            <Clock class="w-5 h-5 text-warning-text shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-bold text-warning-text">Pending Daily Shift Confirmation</h4>
              <p class="text-xs text-warning-text/90 mt-0.5 leading-relaxed">
                Please review all credited orders below and click "Confirm & Sign Off Shift" to lock in your daily incentive and register totals.
              </p>
            </div>
          </div>

          <!-- KPI Glance Cards Matrix -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <!-- Total Sales -->
            <div class="p-3 rounded-xl bg-surface-subtle border border-border shadow-2xs">
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Total Sales</span>
              <div class="text-base font-bold text-foreground font-mono leading-tight">
                {{ formatMoney(settlementData.total_sales_amount) }}
              </div>
              <span class="text-[10px] text-muted-foreground block mt-0.5">
                {{ settlementData.total_orders_count }} orders
              </span>
            </div>

            <!-- Est. Incentive -->
            <div class="p-3 rounded-xl bg-cta-muted border border-border-strong shadow-2xs">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-primary">Incentive</span>
                <Sparkles class="w-3 h-3 text-primary" />
              </div>
              <div class="text-base font-bold text-primary font-mono leading-tight">
                +{{ formatMoney(settlementData.total_incentive_amount ?? (settlementData.total_sales_amount * 0.03)) }}
              </div>
              <span class="text-[10px] text-primary/80 block mt-0.5">Commission credit</span>
            </div>

            <!-- Direct Sales -->
            <div class="p-3 rounded-xl bg-surface-subtle border border-border shadow-2xs">
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Direct Sales</span>
              <div class="text-base font-bold text-success-text font-mono leading-tight">
                {{ formatMoney(settlementData.direct_orders.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)) }}
              </div>
              <span class="text-[10px] text-muted-foreground block mt-0.5">
                {{ settlementData.direct_orders_count }} direct
              </span>
            </div>

            <!-- Assisted Sales -->
            <div class="p-3 rounded-xl bg-surface-subtle border border-border shadow-2xs">
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Team Assisted</span>
              <div class="text-base font-bold text-info-text font-mono leading-tight">
                {{ formatMoney(settlementData.assisted_orders.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)) }}
              </div>
              <span class="text-[10px] text-muted-foreground block mt-0.5">
                {{ settlementData.assisted_orders_count }} assisted
              </span>
            </div>
          </div>

          <!-- Attribution Split Pills -->
          <div class="flex items-center gap-2">
            <div class="flex-1 px-3 py-2 rounded-lg bg-cta-muted border border-border-strong flex items-center justify-between shadow-2xs">
              <div class="flex items-center gap-1.5 text-primary">
                <User class="w-3.5 h-3.5 shrink-0" />
                <span class="text-xs font-semibold">Direct Register Orders</span>
              </div>
              <span class="text-xs font-bold font-mono text-primary">{{ settlementData.direct_orders_count }}</span>
            </div>

            <div class="flex-1 px-3 py-2 rounded-lg bg-purple-bg border border-purple-border flex items-center justify-between shadow-2xs">
              <div class="flex items-center gap-1.5 text-purple-text">
                <Users class="w-3.5 h-3.5 shrink-0" />
                <span class="text-xs font-semibold">Input by Team on Behalf</span>
              </div>
              <span class="text-xs font-bold font-mono text-purple-text">{{ settlementData.assisted_orders_count }}</span>
            </div>
          </div>

          <!-- Credited Orders Breakdown Tabs & List -->
          <div>
            <div class="flex items-center justify-between border-b border-border pb-2">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  @click="activeTab = 'all'"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                    activeTab === 'all'
                      ? 'bg-cta text-cta-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle border border-border'
                  ]"
                >
                  All ({{ (settlementData.direct_orders.length + settlementData.assisted_orders.length) }})
                </button>
                <button
                  type="button"
                  @click="activeTab = 'direct'"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                    activeTab === 'direct'
                      ? 'bg-cta text-cta-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle border border-border'
                  ]"
                >
                  Direct ({{ settlementData.direct_orders.length }})
                </button>
                <button
                  type="button"
                  @click="activeTab = 'assisted'"
                  :class="[
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                    activeTab === 'assisted'
                      ? 'bg-cta text-cta-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle border border-border'
                  ]"
                >
                  Assisted ({{ settlementData.assisted_orders.length }})
                </button>
              </div>

              <span class="text-3xs text-muted-foreground font-mono">
                Date: {{ settlementData.date }}
              </span>
            </div>

            <!-- Orders Table List -->
            <div class="mt-2.5 rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
              <div v-if="displayedOrders.length === 0" class="p-8 text-center text-muted-foreground text-xs space-y-1">
                <Ban class="w-8 h-8 mx-auto text-muted-foreground/40" />
                <p class="font-bold text-foreground">No orders recorded in this category</p>
                <p class="text-3xs text-muted-foreground">No sales match your current tab filter on {{ settlementData.date }}.</p>
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full text-xs text-left min-w-[560px]">
                  <thead class="bg-surface-subtle text-muted-foreground text-3xs uppercase border-b border-border font-bold tracking-wider">
                    <tr>
                      <th class="px-3.5 py-2">Order #</th>
                      <th class="px-3 py-2">Customer</th>
                      <th class="px-3 py-2">Channel</th>
                      <th class="px-3 py-2">Time</th>
                      <th class="px-3.5 py-2 text-right">Incentive</th>
                      <th class="px-3.5 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border/70">
                    <tr v-for="order in displayedOrders" :key="order.id" class="hover:bg-surface-subtle/50 transition-colors">
                      <td class="px-3.5 py-2.5 font-mono font-bold text-foreground">
                        <div>{{ order.order_number }}</div>
                        <!-- Assisted operator badge -->
                        <div
                          v-if="order.is_assisted && order.input_by_user"
                          class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-bg border border-purple-border text-purple-text text-[10px] font-sans font-semibold"
                        >
                          <Users class="w-3 h-3 text-purple-text" />
                          <span>Input by {{ order.input_by_user.name }} ({{ order.input_by_user.role || 'Staff' }})</span>
                        </div>
                      </td>
                      <td class="px-3 py-2.5 text-foreground">
                        {{ order.customer_name || 'Walk-in Customer' }}
                      </td>
                      <td class="px-3 py-2.5">
                        <span class="inline-block px-1.5 py-0.2 rounded text-3xs font-semibold uppercase bg-surface-subtle border border-border text-muted-foreground">
                          {{ order.channel_name || 'POS' }}
                        </span>
                      </td>
                      <td class="px-3 py-2.5 text-muted-foreground font-mono text-3xs">
                        {{ formatTime(order.created_at) }}
                      </td>
                      <td class="px-3.5 py-2.5 text-right font-mono text-xs text-success-text font-bold">
                        +{{ formatMoney(order.incentive ?? (order.total_amount * 0.03)) }}
                      </td>
                      <td class="px-3.5 py-2.5 text-right font-mono font-bold text-foreground">
                        {{ formatMoney(order.total_amount) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Sign-Off & Settlement Confirmation Section -->
          <div class="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-foreground">Shift Sign-Off & Closing Notes</h4>
                <p class="text-3xs text-muted-foreground">Record audit notes and confirm shift drawer balances</p>
              </div>

              <Badge
                v-if="settlementData.settlement"
                variant="success"
                class="text-3xs px-2 py-0.5 gap-1 font-semibold"
              >
                <CheckCircle2 class="w-3 h-3" />
                <span>Signed off by {{ settlementData.settlement.confirmer?.name || 'Manager' }}</span>
              </Badge>
            </div>

            <div v-if="!settlementData.is_confirmed" class="space-y-2">
              <input
                v-model="confirmationNotes"
                type="text"
                placeholder="Optional closing notes (e.g. Cash drawer balanced, petty cash $50 remaining)..."
                class="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-hidden focus:border-cta"
              />
            </div>
            <div v-else-if="settlementData.settlement?.notes" class="text-xs text-muted-foreground bg-card p-2 rounded-lg border border-border">
              <strong class="text-foreground">Notes:</strong> {{ settlementData.settlement.notes }}
            </div>
          </div>
        </template>
      </div>

      <!-- Footer CTA -->
      <div class="px-5 py-3 bg-surface-subtle border-t border-border flex items-center justify-between gap-2.5">
        <Button variant="outline" size="sm" class="h-8 px-3.5 rounded-lg border-border bg-card text-foreground hover:bg-surface-subtle text-xs font-bold cursor-pointer" @click="emit('update:open', false)">
          Close
        </Button>

        <div class="flex items-center gap-2">
          <button
            v-if="settlementData"
            type="button"
            :class="[
              'h-8 px-4 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors',
              hasNoSales
                ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                : 'bg-cta text-cta-foreground hover:bg-cta-hover cursor-pointer'
            ]"
            :disabled="confirming || hasNoSales"
            @click="triggerConfirmSettlement"
          >
            <div v-if="confirming" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <ShieldCheck v-else class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>
              {{ hasNoSales ? 'No Sales to Sign Off' : settlementData.is_confirmed ? 'Re-Confirm & Update Sign-Off' : "Confirm & Sign Off Today's Sales" }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal Dialog Prompt -->
    <div v-if="showConfirmPrompt" class="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60">
      <div class="bg-card rounded-2xl p-5 max-w-sm w-full border border-border shadow-2xl space-y-3 text-foreground">
        <div class="flex items-center gap-2.5 text-primary">
          <ShieldCheck class="w-6 h-6" />
          <h4 class="font-bold text-sm text-foreground">Confirm Today's Sales Sign-Off</h4>
        </div>
        <p class="text-xs text-muted-foreground">
          Are you sure you want to sign off on <strong>{{ settlementData?.total_orders_count || 0 }} orders</strong> totaling <strong>{{ formatMoney(settlementData?.total_sales_amount) }}</strong> with estimated incentive of <strong>+{{ formatMoney(settlementData?.total_incentive_amount ?? ((settlementData?.total_sales_amount || 0) * 0.03)) }}</strong>?
        </p>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" @click="showConfirmPrompt = false">Cancel</Button>
          <Button size="sm" variant="cta" @click="executeConfirmSettlement">
            Confirm & Sign Off
          </Button>
        </div>
      </div>
    </div>

    <!-- Printable Slip (80mm Thermal Simulation for window.print) -->
    <div id="daily-slip-print" class="hidden font-mono text-xs text-[#1A1C1C] p-4">
      <div class="text-center pb-3 border-b border-dashed border-black">
        <h2 class="font-bold text-sm uppercase">DAILY SALES SETTLEMENT SLIP</h2>
        <p class="text-2xs">Date: {{ settlementData?.date }}</p>
        <p class="text-2xs">Seller: {{ settlementData?.seller?.name || currentSeller?.name }}</p>
      </div>

      <div class="py-3 border-b border-dashed border-black space-y-1">
        <div class="flex justify-between">
          <span>Total Sales:</span>
          <span class="font-bold">{{ formatMoney(settlementData?.total_sales_amount) }}</span>
        </div>
        <div class="flex justify-between">
          <span>Total Orders:</span>
          <span>{{ settlementData?.total_orders_count }}</span>
        </div>
        <div class="flex justify-between">
          <span>Direct Orders:</span>
          <span>{{ settlementData?.direct_orders_count }}</span>
        </div>
        <div class="flex justify-between">
          <span>Assisted Orders:</span>
          <span>{{ settlementData?.assisted_orders_count }}</span>
        </div>
        <div class="flex justify-between">
          <span>Est. Incentive:</span>
          <span>+{{ formatMoney(settlementData?.total_incentive_amount) }}</span>
        </div>
      </div>

      <div class="py-3 border-b border-dashed border-black">
        <div class="font-bold text-2xs uppercase mb-1">Orders Breakdown:</div>
        <div v-for="o in displayedOrders" :key="o.id" class="flex justify-between text-2xs py-0.5">
          <span>{{ o.order_number }} ({{ o.customer_name || 'Walk-in' }})</span>
          <span>{{ formatMoney(o.total_amount) }}</span>
        </div>
      </div>

      <div class="pt-4 text-center text-2xs space-y-4">
        <div>
          <span>Status: {{ settlementData?.is_confirmed ? 'CONFIRMED' : 'PENDING' }}</span>
        </div>
        <div class="pt-6 border-t border-dotted border-black">
          <p>Staff / Manager Signature</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  body * {
    visibility: hidden !important;
  }
  #daily-slip-print,
  #daily-slip-print * {
    visibility: visible !important;
  }
  #daily-slip-print {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 80mm !important;
  }
}
</style>

