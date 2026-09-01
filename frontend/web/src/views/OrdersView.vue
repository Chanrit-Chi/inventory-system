<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { getOrderStatus } from '@/utils/orderStatus'
import { usePrintStore } from '@/stores/printStore'
import { useToast } from '@/composables/useToast'
import api from '@/api/axios'
import {
  Receipt,
  Search,
  RefreshCw,
  Printer,
  DollarSign,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  User,
  Calendar,
  AlertCircle,
  Ban,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  DatePicker,
  SelectField,
} from '@/components/ui'

const orderStore = useOrderStore()
const printStore = usePrintStore()
const toast = useToast()

const search = ref('')
const selectedChannel = ref('')
const selectedStatus = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)

const channelOptions = computed(() => [
  { label: 'All Channels', value: '' },
  ...(orderStore.channels || []).map((ch: any) => ({ label: ch.name, value: ch.id })),
])

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'COMPLETED', value: 'COMPLETED' },
  { label: 'PENDING', value: 'PENDING' },
  { label: 'PROCESSING', value: 'PROCESSING' },
  { label: 'CANCELLED', value: 'CANCELLED' },
]

const isCopied = ref(false)
const showPrintReceipt = ref(false)

// KPI Summary Computations
const totalOrdersCount = computed(() => orderStore.meta?.total ?? (Array.isArray(orderStore.orders) ? orderStore.orders.length : 0))
const totalGrossSales = computed(() => {
  const list = Array.isArray(orderStore.orders) ? orderStore.orders : []
  return list.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)
})
const completedOrdersCount = computed(() => {
  const list = Array.isArray(orderStore.orders) ? orderStore.orders : []
  return list.filter(o => o.status === 'COMPLETED').length
})
const pendingOrdersCount = computed(() => {
  const list = Array.isArray(orderStore.orders) ? orderStore.orders : []
  return list.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING').length
})

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
  isCancelModalOpen.value = false
}

// Order Cancellation State
const isCancelModalOpen = ref(false)
const cancelReason = ref('Customer changed mind / cancelled')
const isCancelling = ref(false)

function openCancelModal() {
  cancelReason.value = 'Customer changed mind / cancelled'
  isCancelModalOpen.value = true
}

async function confirmCancelOrder() {
  if (!orderStore.selectedOrder) return
  isCancelling.value = true
  try {
    const orderId = orderStore.selectedOrder.id
    const reasonText = cancelReason.value.trim() || 'Cancelled by manager'
    
    let updatedOrder: any = null
    if (typeof (orderStore as any).updateOrderStatus === 'function') {
      updatedOrder = await orderStore.updateOrderStatus(orderId, 'CANCELLED', reasonText)
    } else {
      const res = await api.patch(`/orders/${orderId}/status`, {
        status: 'CANCELLED',
        notes: reasonText,
      })
      updatedOrder = res.data.data
    }

    if (orderStore.selectedOrder && orderStore.selectedOrder.id === orderId) {
      orderStore.selectedOrder = {
        ...orderStore.selectedOrder,
        ...(updatedOrder || {}),
        status: 'CANCELLED',
        notes: reasonText,
      }
    }

    const idx = orderStore.orders.findIndex(o => o.id === orderId)
    if (idx !== -1) {
      orderStore.orders[idx] = {
        ...orderStore.orders[idx],
        ...(updatedOrder || {}),
        status: 'CANCELLED',
      }
    }

    toast.success(`Order #${orderStore.selectedOrder?.order_number || ''} cancelled. Stock automatically restored to inventory!`)
    isCancelModalOpen.value = false
    await orderStore.fetchOrders({
      page: page.value,
      status: selectedStatus.value,
      channel_id: selectedChannel.value,
      date_from: dateFrom.value,
      date_to: dateTo.value,
      search: search.value,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel order.'
    toast.error(msg)
  } finally {
    isCancelling.value = false
  }
}

function printReceipt(orderId: string) {
  if (!orderId) return
  printStore.printReceipt(orderId)
  showPrintReceipt.value = true
  toast.success('Print command sent to thermal printer')
}

function printReceiptForSelected() {
  const completedOrders = orderStore.orders.filter(o => o.status === 'COMPLETED')
  if (completedOrders.length === 0) {
    toast.info('No completed orders to print')
    return
  }
  const lastCompleted = completedOrders[0]
  printReceipt(lastCompleted.id)
}

function copyOrderNumber(orderNumber: string) {
  navigator.clipboard.writeText(orderNumber)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

function statusBadge(status: string) {
  return getOrderStatus(status)
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

defineExpose({
  statusBadge,
  copyOrderNumber,
  isCopied,
  getOrderStatus,
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Orders & Sales</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalOrdersCount }} Orders
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Omnichannel transaction ledger across physical POS registers, ABA PayWay checkouts, and online storefronts.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button
          id="btn-refresh-orders"
          variant="outline"
          size="sm"
          class="h-9 px-3 gap-1.5 text-xs"
          :disabled="orderStore.loading"
          @click="loadOrders"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': orderStore.loading }" />
          <span>Refresh</span>
        </Button>

        <Button
          v-if="orderStore.orders.length > 0"
          variant="primary"
          size="sm"
          class="h-9 px-3.5 gap-1.5"
          @click="printReceiptForSelected"
        >
          <Printer :size="15" />
          <span>Print Receipt</span>
        </Button>
      </div>
    </div>

    <!-- KPI Summary Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Transactions"
        :value="totalOrdersCount"
        sub="Across all registers"
        :icon="Receipt"
        icon-variant="primary"
      />
      <StatCard
        label="Gross Sales"
        :value="fmtMoney(totalGrossSales)"
        sub="Completed revenue"
        :icon="DollarSign"
        icon-variant="success"
      />
      <StatCard
        label="Completed Orders"
        :value="completedOrdersCount"
        sub="Settled & fulfilled"
        :icon="CheckCircle2"
        icon-variant="warning"
      />
      <StatCard
        label="Pending / Open"
        :value="pendingOrdersCount"
        sub="Awaiting fulfillment"
        :icon="Clock"
        icon-variant="purple"
      />
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col gap-3">
      <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div class="flex-1 max-w-md">
          <Input
            id="order-search-input"
            v-model="search"
            type="text"
            placeholder="Search order # or customer…"
            class="bg-surface font-mono"
            @input="onSearchInput"
          >
            <template #prefix>
              <Search :size="16" />
            </template>
          </Input>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <SelectField
            id="order-channel-filter"
            v-model="selectedChannel"
            :options="channelOptions"
            placeholder="All Channels"
            class="h-9 w-40 bg-surface text-xs"
            @change="onFilterChange"
          />

          <SelectField
            id="order-status-filter"
            v-model="selectedStatus"
            :options="statusOptions"
            placeholder="All Statuses"
            class="h-9 w-40 bg-surface text-xs"
            @change="onFilterChange"
          />

          <Button id="btn-reset-orders" variant="outline" size="sm" class="h-9 text-xs px-3" @click="resetFilters">
            Reset Filters
          </Button>
        </div>
      </div>

      <div class="flex items-center gap-3 pt-2 border-t border-border/50 flex-wrap text-xs">
        <div class="flex items-center gap-1.5 text-muted-foreground">
          <Calendar :size="14" />
          <span>Date Range:</span>
        </div>
        <div class="flex items-center gap-2">
          <DatePicker id="order-date-from" v-model="dateFrom" placeholder="From date" class="h-8 w-36 bg-surface text-xs" @change="onFilterChange" />
          <span class="text-muted-foreground">to</span>
          <DatePicker id="order-date-to" v-model="dateTo" placeholder="To date" class="h-8 w-36 bg-surface text-xs" @change="onFilterChange" />
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <Alert v-if="orderStore.error" variant="error" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <AlertCircle :size="16" />
        <span>{{ orderStore.error }}</span>
      </div>
      <Button variant="ghost" size="sm" class="text-xs h-7" @click="loadOrders">Retry</Button>
    </Alert>

    <!-- Orders Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="orderStore.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="orderStore.orders.length === 0"
        :icon="Receipt"
        title="No orders found"
        description="No sales transactions match your current search or date filter criteria."
      />

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Order #</TableHead>
              <TableHead>Sales Channel</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead class="font-mono">Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="font-mono">Date</TableHead>
              <TableHead class="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="o in orderStore.orders"
              :key="o.id"
              class="hover:bg-surface-subtle/80 transition-colors"
            >
              <TableCell class="font-mono text-xs font-semibold text-primary">
                {{ o.order_number }}
              </TableCell>
              <TableCell>
                <Badge variant="neutral" class="text-[11px] px-2 py-0.5 font-medium">
                  {{ o.channel?.name ?? 'Main POS' }}
                </Badge>
              </TableCell>
              <TableCell>
                <div v-if="o.customer" class="font-semibold text-foreground flex items-center gap-1.5">
                  <User :size="13" class="text-muted-foreground" />
                  <span>{{ o.customer.name }}</span>
                </div>
                <span v-else class="text-xs text-muted-foreground italic">Walk-in Customer</span>
              </TableCell>
              <TableCell class="font-mono text-sm font-bold text-foreground tabular-nums">
                {{ fmtMoney(o.total_amount) }}
              </TableCell>
              <TableCell>
                <Badge :variant="getOrderStatus(o.status).variant" class="text-[11px] px-2 py-0.5">
                  {{ getOrderStatus(o.status).label }}
                </Badge>
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ fmtDate(o.created_at) }}
              </TableCell>
              <TableCell class="text-right">
                <Button
                  :id="`btn-view-order-${o.id}`"
                  variant="ghost"
                  size="sm"
                  class="h-8 px-2.5 text-xs text-primary hover:text-cta"
                  @click="openOrderDetails(o.id)"
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
      <div
        v-if="orderStore.meta && orderStore.meta.last_page > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
      >
        <span class="font-mono">
          Page {{ page }} of {{ orderStore.meta.last_page }} ({{ orderStore.meta.total }} total)
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page <= 1 || orderStore.loading"
            @click="page--; loadOrders()"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="page >= orderStore.meta.last_page || orderStore.loading"
            @click="page++; loadOrders()"
          >
            <span>Next</span>
            <ChevronRight :size="14" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Order Detail Dialog -->
    <Dialog :open="!!orderStore.selectedOrder || orderStore.detailLoading" @update:open="(val) => { if (!val) closeModal(); }">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div v-if="orderStore.detailLoading" class="py-12 text-center text-muted-foreground text-xs space-y-2">
          <div class="animate-spin text-lg">⏳</div>
          <span>Loading order breakdown & receipt…</span>
        </div>

        <template v-else-if="orderStore.selectedOrder">
          <DialogHeader>
            <div class="flex items-center justify-between">
              <div>
                <span class="text-[11px] uppercase tracking-wider text-muted-foreground block font-semibold">Transaction Record</span>
                <DialogTitle class="font-display text-xl font-bold flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-primary">{{ orderStore.selectedOrder.order_number }}</span>
                  <button
                    class="p-1 rounded hover:bg-surface-subtle text-muted-foreground hover:text-foreground transition-colors"
                    @click="copyOrderNumber(orderStore.selectedOrder.order_number)"
                    title="Copy Order #"
                  >
                    <Check v-if="isCopied" :size="14" class="text-success" />
                    <Copy v-else :size="14" />
                  </button>
                </DialogTitle>
              </div>
              <div class="flex items-center gap-2">
                <Badge variant="neutral" class="text-xs">
                  {{ orderStore.selectedOrder.channel?.name ?? 'POS Register' }}
                </Badge>
                <Badge :variant="getOrderStatus(orderStore.selectedOrder.status).variant" class="text-xs">
                  {{ getOrderStatus(orderStore.selectedOrder.status).label }}
                </Badge>
              </div>
            </div>
            <DialogDescription class="text-xs text-muted-foreground">
              Processed on {{ fmtDate(orderStore.selectedOrder.created_at) }}
            </DialogDescription>
          </DialogHeader>

          <!-- Order Cancelled Status Alert -->
          <Alert v-if="orderStore.selectedOrder.status === 'CANCELLED'" variant="error" class="my-1 text-xs">
            <div class="flex flex-col gap-0.5">
              <div class="font-bold flex items-center gap-1.5 text-destructive">
                <Ban :size="14" />
                <span>Order Cancelled & Stock Returned</span>
              </div>
              <p class="text-muted-foreground text-[11px]">
                All line items have been restored to active inventory (CANCELLATION_REVERSAL). Customer VIP lifetime spending has been reversed.
              </p>
              <div v-if="orderStore.selectedOrder.notes" class="text-foreground font-medium mt-0.5">
                Cancellation Notes: <span class="italic font-normal">{{ orderStore.selectedOrder.notes }}</span>
              </div>
            </div>
          </Alert>

          <!-- Customer & Order Meta -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div class="p-3 rounded-lg border border-border/80 bg-surface-subtle/60 text-xs">
              <span class="font-semibold text-foreground uppercase tracking-wider text-[10px] block mb-1">Customer Profile</span>
              <div v-if="orderStore.selectedOrder.customer" class="space-y-0.5">
                <div class="font-bold text-sm text-foreground">{{ orderStore.selectedOrder.customer.name }}</div>
                <div class="font-mono text-muted-foreground">📞 {{ orderStore.selectedOrder.customer.phone || 'N/A' }}</div>
                <div v-if="orderStore.selectedOrder.customer.email" class="text-muted-foreground">
                  ✉️ {{ orderStore.selectedOrder.customer.email }}
                </div>
              </div>
              <div v-else class="text-muted-foreground italic">
                Walk-in Counter Guest (No CRM profile)
              </div>
            </div>

            <div class="p-3 rounded-lg border border-border/80 bg-surface-subtle/60 text-xs">
              <span class="font-semibold text-foreground uppercase tracking-wider text-[10px] block mb-1">Transaction Details</span>
              <div class="space-y-1">
                <div class="text-muted-foreground flex items-center justify-between">
                  <span>Sales Channel:</span>
                  <span class="font-semibold text-foreground">{{ orderStore.selectedOrder.channel?.name ?? 'Main POS' }}</span>
                </div>
                <div class="text-muted-foreground flex items-center justify-between">
                  <span>Processed By:</span>
                  <span class="font-semibold text-foreground">{{ orderStore.selectedOrder.seller?.name || orderStore.selectedOrder.user?.name || 'System Cashier' }}</span>
                </div>
                <div class="text-muted-foreground flex items-center justify-between">
                  <span>Date & Time:</span>
                  <span class="font-medium text-foreground">{{ fmtDate(orderStore.selectedOrder.created_at) }}</span>
                </div>
                <div v-if="orderStore.selectedOrder.notes" class="text-muted-foreground pt-0.5 border-t border-border/50">
                  <span class="font-medium text-foreground">Note:</span> {{ orderStore.selectedOrder.notes }}
                </div>
              </div>
            </div>
          </div>

          <!-- Items Breakdown -->
          <div class="py-2">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-foreground mb-2">Purchased Items Breakdown</h4>
            <div class="border border-border rounded-lg overflow-hidden">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-muted/40 text-muted-foreground border-b border-border">
                    <th class="py-2.5 px-3">Product / SKU</th>
                    <th class="py-2.5 px-3 text-right font-mono">Unit Price</th>
                    <th class="py-2.5 px-3 text-center font-mono">Qty</th>
                    <th class="py-2.5 px-3 text-right font-mono">Line Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/60 font-sans">
                  <tr v-for="item in orderStore.selectedOrder.items" :key="item.id">
                    <td class="py-2.5 px-3">
                      <div class="font-semibold text-foreground">{{ item.variant?.product?.name ?? 'Product' }}</div>
                      <span class="font-mono text-[10px] text-primary">{{ item.variant?.sku ?? 'SKU-N/A' }}</span>
                    </td>
                    <td class="py-2.5 px-3 font-mono text-right text-muted-foreground">{{ fmtMoney(item.unit_price) }}</td>
                    <td class="py-2.5 px-3 font-mono text-center font-bold text-foreground">{{ item.quantity }}</td>
                    <td class="py-2.5 px-3 font-mono text-right font-bold text-foreground">{{ fmtMoney(item.total_price) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Payment & Financial Totals -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div class="p-3 rounded-lg border border-border/80 bg-surface-subtle/40 text-xs">
              <span class="font-semibold text-foreground uppercase tracking-wider text-[10px] block mb-2">Payment Receipts</span>
              <div v-if="!orderStore.selectedOrder.payments || orderStore.selectedOrder.payments.length === 0" class="text-muted-foreground text-xs italic">
                No payment transactions recorded.
              </div>
              <div v-else class="space-y-1.5">
                <div
                  v-for="p in orderStore.selectedOrder.payments"
                  :key="p.id"
                  class="flex items-center justify-between p-2 rounded bg-surface border border-border text-xs"
                >
                  <div>
                    <span class="font-semibold text-foreground capitalize">{{ p.payment_method }}</span>
                    <div v-if="p.transaction_ref" class="text-[10px] font-mono text-muted-foreground">Ref: {{ p.transaction_ref }}</div>
                  </div>
                  <div class="text-right">
                    <span class="font-mono font-bold text-foreground">{{ fmtMoney(p.amount) }}</span>
                    <Badge variant="success" class="text-[10px] px-1 py-0 block mt-0.5">Paid</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-3 rounded-lg border border-border/80 bg-surface-subtle/40 text-xs space-y-1.5">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span class="font-mono font-semibold text-foreground">{{ fmtMoney(orderStore.selectedOrder.subtotal) }}</span>
              </div>
              <div class="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span class="font-mono font-semibold text-destructive">- {{ fmtMoney(orderStore.selectedOrder.discount) }}</span>
              </div>
              <div class="flex justify-between text-muted-foreground">
                <span>Delivery Fee</span>
                <span class="font-mono font-semibold text-foreground">{{ fmtMoney(orderStore.selectedOrder.delivery_cost) }}</span>
              </div>
              <div class="flex justify-between border-t border-border pt-1.5 font-bold text-sm text-primary">
                <span>Grand Total</span>
                <span class="font-mono text-base">{{ fmtMoney(orderStore.selectedOrder.total_amount) }}</span>
              </div>
            </div>
          </div>

          <DialogFooter class="gap-2 sm:gap-0 mt-4 flex-wrap justify-between">
            <div>
              <Button
                v-if="orderStore.selectedOrder.status !== 'CANCELLED'"
                id="btn-cancel-order"
                variant="destructive"
                size="sm"
                class="gap-1.5 text-xs"
                @click="openCancelModal"
              >
                <Ban :size="14" />
                <span>Cancel Order</span>
              </Button>
            </div>

            <div class="flex items-center gap-2">
              <Button
                id="btn-print-order"
                variant="outline"
                size="sm"
                class="gap-1.5 text-xs"
                @click="printReceipt(orderStore.selectedOrder.id)"
              >
                <Printer :size="14" />
                <span>Print Receipt</span>
              </Button>
              <Button id="btn-close-order-modal" variant="primary" size="sm" @click="closeModal">
                Close
              </Button>
            </div>
          </DialogFooter>
        </template>
      </DialogContent>
    </Dialog>

    <!-- Order Cancellation Confirmation Modal -->
    <Dialog :open="isCancelModalOpen" @update:open="(val) => { isCancelModalOpen = val }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display text-destructive flex items-center gap-2">
            <AlertCircle :size="18" />
            <span>Cancel Order & Restore Stock</span>
          </DialogTitle>
          <DialogDescription class="text-xs">
            Cancelling order <strong class="font-mono text-foreground">#{{ orderStore.selectedOrder?.order_number }}</strong> will immediately return all item quantities to warehouse stock and record an audited ledger reversal.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3 py-2 text-xs">
          <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-900 text-xs">
            <strong>Inventory Impact:</strong> {{ orderStore.selectedOrder?.items?.length }} line item(s) will be returned to stock (+quantity) via a <code class="font-mono font-bold">CANCELLATION_REVERSAL</code> movement.
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Cancellation Reason / Notes *</label>
            <Input
              v-model="cancelReason"
              placeholder="e.g. Customer changed mind, defect return, accidental order"
              class="h-9 bg-surface text-xs"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-3">
          <Button variant="outline" size="sm" :disabled="isCancelling" @click="isCancelModalOpen = false">
            Keep Active
          </Button>
          <Button
            variant="destructive"
            size="sm"
            :disabled="isCancelling"
            class="gap-1.5"
            @click="confirmCancelOrder"
          >
            <span v-if="isCancelling" class="animate-spin mr-1">⏳</span>
            <Ban v-else :size="14" />
            <span>{{ isCancelling ? 'Cancelling…' : 'Confirm Cancellation' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
