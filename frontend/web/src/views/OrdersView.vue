<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useOrderStore } from '@/stores/orderStore'
import { usePrintStore } from '@/stores/printStore'
import { useToast } from '@/composables/useToast'
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
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED') return { variant: 'success' as const, label: 'Completed' }
  if (s === 'PENDING') return { variant: 'warning' as const, label: 'Pending' }
  if (s === 'PROCESSING') return { variant: 'info' as const, label: 'Processing' }
  if (s === 'CANCELLED') return { variant: 'destructive' as const, label: 'Cancelled' }
  return { variant: 'neutral' as const, label: status }
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

      <div class="flex items-center gap-2">
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
          <select
            id="order-channel-filter"
            v-model="selectedChannel"
            class="h-9 px-3 text-sm bg-surface border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            @change="onFilterChange"
          >
            <option value="">All Channels</option>
            <option v-for="ch in orderStore.channels" :key="ch.id" :value="ch.id">
              {{ ch.name }}
            </option>
          </select>

          <select
            id="order-status-filter"
            v-model="selectedStatus"
            class="h-9 px-3 text-sm bg-surface border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            @change="onFilterChange"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

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
          <Input id="order-date-from" type="date" v-model="dateFrom" class="h-8 w-36 bg-surface text-xs font-mono" @change="onFilterChange" />
          <span class="text-muted-foreground">to</span>
          <Input id="order-date-to" type="date" v-model="dateTo" class="h-8 w-36 bg-surface text-xs font-mono" @change="onFilterChange" />
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
                <Badge :variant="statusBadge(o.status).variant" class="text-[11px] px-2 py-0.5">
                  {{ statusBadge(o.status).label }}
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
                <Badge :variant="statusBadge(orderStore.selectedOrder.status).variant" class="text-xs">
                  {{ statusBadge(orderStore.selectedOrder.status).label }}
                </Badge>
              </div>
            </div>
            <DialogDescription class="text-xs text-muted-foreground">
              Processed on {{ fmtDate(orderStore.selectedOrder.created_at) }}
            </DialogDescription>
          </DialogHeader>

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
              <div class="space-y-0.5">
                <div class="text-muted-foreground">Channel: <span class="font-semibold text-foreground">{{ orderStore.selectedOrder.channel?.name ?? 'Main POS' }}</span></div>
                <div v-if="orderStore.selectedOrder.notes" class="text-muted-foreground">
                  Notes: <span class="font-medium text-foreground">{{ orderStore.selectedOrder.notes }}</span>
                </div>
                <div class="font-mono text-[10px] text-muted-foreground/80 mt-1">
                  ID: {{ orderStore.selectedOrder.id }}
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

          <DialogFooter class="gap-2 sm:gap-0 mt-4">
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
              Close Order
            </Button>
          </DialogFooter>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
