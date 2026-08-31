<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api, { ApiError } from '@/api/axios'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/composables/useToast'
import {
  X,
  Printer,
  CheckCircle2,
  Calendar,
  Clock,
  FileCheck2,
} from 'lucide-vue-next'
import { Button, Badge, Skeleton } from '@/components/ui'

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

const todayStr = new Date().toISOString().split('T')[0]
const selectedDate = ref(props.initialDate || todayStr)
const loading = ref(false)
const confirming = ref(false)
const settlementData = ref<SellerDailySettlementSummary | null>(null)
const activeTab = ref<'all' | 'direct' | 'assisted'>('all')
const confirmationNotes = ref('')

// Staff selector for managers/admins
interface StaffUser {
  id: string
  name: string
  role?: string
}
const staffList = ref<StaffUser[]>([])
const selectedStaffId = ref<string>('')

const currentSellerId = computed(() => {
  return selectedStaffId.value || props.targetSellerId || authStore.user?.id || ''
})

async function fetchStaffUsers() {
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
      if (targetId) selectedStaffId.value = String(targetId)
      else if (!selectedStaffId.value && authStore.user?.id) {
        selectedStaffId.value = authStore.user.id
      }
      fetchStaffUsers()
      loadSettlement()
    }
  },
  { immediate: true }
)

const displayedOrders = computed(() => {
  if (!settlementData.value) return []
  const direct = settlementData.value.direct_orders || []
  const assisted = settlementData.value.assisted_orders || []

  if (activeTab.value === 'direct') return direct
  if (activeTab.value === 'assisted') return assisted
  return [...direct, ...assisted]
})

async function handleConfirmSettlement() {
  if (!currentSellerId.value) return
  confirming.value = true
  try {
    const payload = {
      seller_id: currentSellerId.value,
      confirmed_date: selectedDate.value,
      notes: confirmationNotes.value.trim() || undefined,
    }
    await api.post('/seller-settlements/confirm', payload)
    toast.success('Daily shift settlement confirmed successfully!')
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
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      @click="emit('update:open', false)"
    />

    <!-- Dialog Body -->
    <div class="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150">
      <!-- Header -->
      <div class="px-6 py-4 bg-muted/40 border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <FileCheck2 class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-foreground font-display">Daily Shift Settlement</h3>
              <Badge
                v-if="settlementData?.is_confirmed"
                variant="success"
                class="text-[11px] px-2 py-0.5"
              >
                Settlement Confirmed
              </Badge>
              <Badge
                v-else
                variant="warning"
                class="text-[11px] px-2 py-0.5"
              >
                Pending Sign-Off
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground">Reconcile shift orders, payment breakdowns, and register totals</p>
          </div>
        </div>

        <button
          type="button"
          @click="emit('update:open', false)"
          class="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Controls Filter Bar -->
      <div class="px-6 py-3 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <!-- Date selector -->
          <div class="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1 text-xs">
            <Calendar class="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="date"
              v-model="selectedDate"
              @change="loadSettlement"
              class="bg-transparent text-xs font-medium text-foreground focus:outline-hidden"
            />
          </div>

          <!-- Staff user selector (if manager / multi-staff) -->
          <div v-if="staffList.length > 0" class="flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground">Seller:</span>
            <select
              v-model="selectedStaffId"
              @change="loadSettlement"
              class="h-8 px-2.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option v-for="s in staffList" :key="s.id" :value="s.id">
                {{ s.name }} ({{ s.role || 'Staff' }})
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="h-8 text-xs gap-1.5" @click="loadSettlement">
            <Clock class="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button variant="outline" size="sm" class="h-8 text-xs gap-1.5" @click="handlePrintSlip">
            <Printer class="w-3.5 h-3.5" />
            <span>Print Closing Slip</span>
          </Button>
        </div>
      </div>

      <!-- Main Body Content -->
      <div class="p-6 overflow-y-auto space-y-6 flex-1">
        <div v-if="loading" class="space-y-4">
          <Skeleton class="h-24 w-full rounded-xl" />
          <Skeleton class="h-48 w-full rounded-xl" />
        </div>

        <template v-else-if="settlementData">
          <!-- KPI Stats Summary Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-4 rounded-xl bg-card border border-border shadow-2xs">
              <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Total Shift Sales</span>
              <div class="text-2xl font-black text-foreground font-display">
                {{ formatMoney(settlementData.total_sales_amount) }}
              </div>
              <span class="text-3xs text-muted-foreground block mt-1">
                {{ settlementData.total_orders_count }} orders processed
              </span>
            </div>

            <div class="p-4 rounded-xl bg-card border border-border shadow-2xs">
              <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Direct POS Register Sales</span>
              <div class="text-2xl font-black text-emerald-600 font-display">
                {{ formatMoney(settlementData.direct_orders.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)) }}
              </div>
              <span class="text-3xs text-muted-foreground block mt-1">
                {{ settlementData.direct_orders_count }} direct orders
              </span>
            </div>

            <div class="p-4 rounded-xl bg-card border border-border shadow-2xs">
              <span class="text-2xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Assisted / Channel Sales</span>
              <div class="text-2xl font-black text-info font-display">
                {{ formatMoney(settlementData.assisted_orders.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)) }}
              </div>
              <span class="text-3xs text-muted-foreground block mt-1">
                {{ settlementData.assisted_orders_count }} assisted orders
              </span>
            </div>
          </div>

          <!-- Tab Selector: All Orders / Direct / Assisted -->
          <div>
            <div class="flex items-center justify-between border-b border-border pb-2">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="activeTab = 'all'"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                    activeTab === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  ]"
                >
                  All Orders ({{ (settlementData.direct_orders.length + settlementData.assisted_orders.length) }})
                </button>
                <button
                  type="button"
                  @click="activeTab = 'direct'"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                    activeTab === 'direct'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  ]"
                >
                  Direct Register ({{ settlementData.direct_orders.length }})
                </button>
                <button
                  type="button"
                  @click="activeTab = 'assisted'"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                    activeTab === 'assisted'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  ]"
                >
                  Assisted / Remote ({{ settlementData.assisted_orders.length }})
                </button>
              </div>

              <span class="text-2xs text-muted-foreground font-mono">
                Date: {{ settlementData.date }}
              </span>
            </div>

            <!-- Orders Table List -->
            <div class="mt-3 rounded-xl border border-border overflow-hidden bg-card">
              <div v-if="displayedOrders.length === 0" class="p-8 text-center text-muted-foreground text-xs">
                No orders recorded for this filter on {{ settlementData.date }}.
              </div>

              <table v-else class="w-full text-xs text-left">
                <thead class="bg-muted/40 text-muted-foreground text-2xs uppercase border-b border-border font-semibold">
                  <tr>
                    <th class="px-4 py-2.5">Order #</th>
                    <th class="px-4 py-2.5">Customer</th>
                    <th class="px-4 py-2.5">Channel</th>
                    <th class="px-4 py-2.5">Time</th>
                    <th class="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr v-for="order in displayedOrders" :key="order.id" class="hover:bg-muted/20 transition-colors">
                    <td class="px-4 py-2.5 font-mono font-bold text-foreground">
                      {{ order.order_number }}
                    </td>
                    <td class="px-4 py-2.5 text-foreground">
                      {{ order.customer_name || 'Walk-in Customer' }}
                    </td>
                    <td class="px-4 py-2.5">
                      <Badge variant="neutral" class="text-[10px] px-2 py-0">
                        {{ order.channel_name || 'POS' }}
                      </Badge>
                    </td>
                    <td class="px-4 py-2.5 text-muted-foreground font-mono">
                      {{ formatTime(order.created_at) }}
                    </td>
                    <td class="px-4 py-2.5 text-right font-mono font-bold text-foreground">
                      {{ formatMoney(order.total_amount) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Sign-Off & Settlement Confirmation Section -->
          <div class="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-foreground">Reconciliation & Manager Sign-Off</h4>
                <p class="text-3xs text-muted-foreground">Sign off on the daily shift register cash and card collections</p>
              </div>

              <Badge
                v-if="settlementData.settlement"
                variant="success"
                class="text-xs px-2.5 py-0.5 gap-1"
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span>Confirmed by {{ settlementData.settlement.confirmer?.name || 'Manager' }}</span>
              </Badge>
            </div>

            <div v-if="!settlementData.is_confirmed" class="space-y-2">
              <input
                v-model="confirmationNotes"
                type="text"
                placeholder="Optional closing notes (e.g. Cash drawer balanced, petty cash $50 remaining)..."
                class="w-full px-3 py-2 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
            <div v-else-if="settlementData.settlement?.notes" class="text-xs text-muted-foreground bg-card p-2.5 rounded-lg border border-border">
              <strong>Notes:</strong> {{ settlementData.settlement.notes }}
            </div>
          </div>
        </template>
      </div>

      <!-- Footer CTA -->
      <div class="px-6 py-4 bg-muted/40 border-t border-border flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" @click="emit('update:open', false)">
          Close
        </Button>

        <div class="flex items-center gap-2">
          <Button
            v-if="settlementData && !settlementData.is_confirmed"
            variant="primary"
            size="sm"
            class="gap-1.5"
            :disabled="confirming"
            @click="handleConfirmSettlement"
          >
            <div v-if="confirming" class="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            <CheckCircle2 v-else class="w-4 h-4" />
            <span>Confirm & Sign Off Shift</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  body * {
    visibility: hidden;
  }
  .relative {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    visibility: visible;
  }
  .relative * {
    visibility: visible;
  }
}
</style>
