<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useInvoiceStore, type Invoice } from '@/stores/invoiceStore'
import { usePrintStore } from '@/stores/printStore'
import { useToast } from '@/composables/useToast'
import {
  Receipt,
  Search,
  RefreshCw,
  Eye,
  CreditCard,
  Trash2,
  DollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Printer,
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
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
  SelectField,
} from '@/components/ui'

const toast = useToast()
const store = useInvoiceStore()

const showDetailModal = ref(false)
const showPaymentModal = ref(false)
const selectedInvoice = ref<Invoice | null>(null)
const paymentData = ref({ amount: 0, method: 'cash', reference: '' })

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partial', value: 'partial' },
  { label: 'Overdue', value: 'overdue' },
]

const paymentMethodOptions = [
  { label: 'Cash Tender', value: 'cash' },
  { label: 'ABA PayWay / KHQR', value: 'aba_payway' },
  { label: 'Credit / Debit Card', value: 'card' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'GCash / Digital Wallet', value: 'gcash' },
]

const isDeleteDialogOpen = ref(false)
const deletingInvoiceId = ref<string | null>(null)
const isDeleting = ref(false)

const filters = ref({ page: 1, per_page: 15, search: '', status: '' })
const invoices = computed(() => store.invoices)

// KPI Computations
const totalInvoicesCount = computed(() => store.meta?.total ?? store.invoices.length)
const totalPaidAmount = computed(() =>
  store.invoices.reduce((sum, inv) => sum + (parseFloat(String(inv.amount_paid)) || 0), 0)
)
const totalOutstandingAmount = computed(() =>
  store.invoices.reduce((sum, inv) => {
    const total = parseFloat(String(inv.total_amount)) || 0
    const paid = parseFloat(String(inv.amount_paid)) || 0
    return sum + Math.max(0, total - paid)
  }, 0)
)

async function loadInvoices() {
  try {
    await store.fetchInvoices({
      page: filters.value.page,
      per_page: filters.value.per_page,
      search: filters.value.search || undefined,
      status: filters.value.status || undefined,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load invoices')
  }
}

const printStore = usePrintStore()

function viewInvoice(inv: Invoice) {
  selectedInvoice.value = inv
  showDetailModal.value = true
}

async function handlePrintInvoice(inv: Invoice) {
  try {
    const res = await printStore.printInvoice(inv.id, inv)
    toast.success(res.message || 'Invoice printed')
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to print invoice')
  }
}

function openPayment(inv: Invoice) {
  selectedInvoice.value = inv
  paymentData.value = {
    amount: Math.max(0, (parseFloat(String(inv.total_amount)) || 0) - (parseFloat(String(inv.amount_paid)) || 0)),
    method: 'cash',
    reference: '',
  }
  showPaymentModal.value = true
}

async function recordPayment() {
  if (!selectedInvoice.value) return
  try {
    await store.recordPayment(selectedInvoice.value.id, paymentData.value)
    toast.success('Payment recorded successfully')
    showPaymentModal.value = false
    await loadInvoices()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to record payment')
  }
}

function confirmDelete(id: string) {
  deletingInvoiceId.value = id
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingInvoiceId.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingInvoiceId.value) return
  isDeleting.value = true
  try {
    await store.deleteInvoice(deletingInvoiceId.value)
    toast.success('Invoice deleted')
    isDeleteDialogOpen.value = false
    deletingInvoiceId.value = null
    await loadInvoices()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete invoice')
  } finally {
    isDeleting.value = false
  }
}

function nextPage() {
  if (store.meta && filters.value.page < store.meta.last_page) {
    filters.value.page += 1
    loadInvoices()
  }
}
function prevPage() {
  if (filters.value.page > 1) {
    filters.value.page -= 1
    loadInvoices()
  }
}

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function statusBadge(s: string) {
  const status = (s || '').toLowerCase()
  if (status === 'paid') return { variant: 'success' as const, label: 'Paid' }
  if (status === 'sent') return { variant: 'info' as const, label: 'Sent' }
  if (status === 'partial') return { variant: 'warning' as const, label: 'Partial' }
  if (status === 'overdue') return { variant: 'destructive' as const, label: 'Overdue' }
  if (status === 'draft') return { variant: 'neutral' as const, label: 'Draft' }
  return { variant: 'neutral' as const, label: s }
}

onMounted(loadInvoices)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Customer Invoices</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalInvoicesCount }} Invoices
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage B2B and store customer invoices, due dates, settlement tracking, and payment receipts.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="store.loading" @click="loadInvoices">
          <RefreshCw :size="14" :class="{ 'animate-spin': store.loading }" />
          <span>Refresh</span>
        </Button>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Invoices"
        :value="totalInvoicesCount"
        sub="Records in ledger"
        :icon="Receipt"
        icon-variant="primary"
      />
      <StatCard
        label="Collected Payments"
        :value="fmtMoney(totalPaidAmount)"
        sub="Settled invoice funds"
        :icon="CheckCircle2"
        icon-variant="success"
      />
      <StatCard
        label="Outstanding Balance"
        :value="fmtMoney(totalOutstandingAmount)"
        sub="Pending collection"
        :icon="DollarSign"
        icon-variant="warning"
      />
    </div>

    <!-- Filter Bar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          v-model="filters.search"
          type="text"
          placeholder="Search by invoice # or customer name…"
          class="bg-surface"
          @keyup.enter="loadInvoices"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap">
        <SelectField
          v-model="filters.status"
          :options="statusOptions"
          placeholder="All Statuses"
          class="h-9 w-36 bg-surface text-xs"
          @change="loadInvoices"
        />

        <Button variant="outline" size="sm" class="h-9 px-3.5 text-xs gap-1.5" @click="loadInvoices">
          Search
        </Button>
      </div>
    </div>

    <!-- Invoices Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!invoices.length"
        :icon="Receipt"
        title="No invoices found"
        description="No customer invoices match your filter criteria or have been issued yet."
      />

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="font-mono">Total</TableHead>
              <TableHead class="font-mono">Paid</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="inv in invoices" :key="inv.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell class="font-mono text-xs font-semibold text-primary">
                {{ inv.invoice_number }}
              </TableCell>
              <TableCell class="font-semibold text-foreground">
                {{ inv.customer_name }}
              </TableCell>
              <TableCell>
                <Badge :variant="statusBadge(inv.status).variant" class="text-[11px] px-2 py-0.5">
                  {{ statusBadge(inv.status).label }}
                </Badge>
              </TableCell>
              <TableCell class="font-mono text-sm font-bold text-foreground tabular-nums">
                {{ fmtMoney(inv.total_amount) }}
              </TableCell>
              <TableCell class="font-mono text-xs text-success font-semibold tabular-nums">
                {{ fmtMoney(inv.amount_paid) }}
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ inv.due_date || '—' }}
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" title="Print Invoice" @click="handlePrintInvoice(inv)">
                    <Printer :size="13" />
                    <span>Print</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="viewInvoice(inv)">
                    <Eye :size="13" />
                    <span>View</span>
                  </Button>
                  <Button
                    v-if="inv.status !== 'paid' && inv.status !== 'cancelled'"
                    variant="primary"
                    size="sm"
                    class="h-8 px-2.5 text-xs gap-1"
                    @click="openPayment(inv)"
                  >
                    <CreditCard :size="13" />
                    <span>Pay</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDelete(inv.id)">
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination Bar -->
      <div
        v-if="store.meta && store.meta.last_page > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
      >
        <span class="font-mono">
          Page {{ filters.page }} of {{ store.meta.last_page }}
        </span>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="filters.page === 1"
            @click="prevPage"
          >
            <ChevronLeft :size="14" />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="!store.meta || filters.page >= store.meta.last_page"
            @click="nextPage"
          >
            <span>Next</span>
            <ChevronRight :size="14" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Invoice Detail Dialog -->
    <Dialog :open="showDetailModal" @update:open="(val) => showDetailModal = val">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center justify-between">
            <span>Invoice {{ selectedInvoice?.invoice_number }}</span>
            <Badge v-if="selectedInvoice" :variant="statusBadge(selectedInvoice.status).variant" class="text-xs">
              {{ statusBadge(selectedInvoice.status).label }}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Billed to: <strong>{{ selectedInvoice?.customer_name }}</strong> &bull; Due: {{ selectedInvoice?.due_date || 'N/A' }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedInvoice" class="py-2">
          <div class="border border-border rounded-lg overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-muted/40 text-muted-foreground border-b border-border">
                  <th class="py-2.5 px-3">Product</th>
                  <th class="py-2.5 px-3">SKU</th>
                  <th class="py-2.5 px-3 text-center">Qty</th>
                  <th class="py-2.5 px-3 font-mono text-right">Unit Price</th>
                  <th class="py-2.5 px-3 font-mono text-right">Line Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/60">
                <tr v-for="(item, i) in selectedInvoice.items" :key="i">
                  <td class="py-2.5 px-3 font-semibold text-foreground">{{ item.product_name }}</td>
                  <td class="py-2.5 px-3 font-mono text-muted-foreground">{{ item.sku }}</td>
                  <td class="py-2.5 px-3 font-mono text-center font-bold">{{ item.quantity }}</td>
                  <td class="py-2.5 px-3 font-mono text-right text-muted-foreground">{{ fmtMoney(item.unit_price) }}</td>
                  <td class="py-2.5 px-3 font-mono text-right font-bold text-foreground">{{ fmtMoney(item.line_total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex justify-end mt-4">
            <div class="w-64 space-y-1.5 text-xs">
              <div class="flex justify-between text-muted-foreground">
                <span>Total Amount:</span>
                <span class="font-mono font-bold text-foreground">{{ fmtMoney(selectedInvoice.total_amount) }}</span>
              </div>
              <div class="flex justify-between text-muted-foreground">
                <span>Amount Paid:</span>
                <span class="font-mono font-bold text-success">{{ fmtMoney(selectedInvoice.amount_paid) }}</span>
              </div>
              <div class="flex justify-between border-t border-border pt-1.5 font-bold text-sm text-primary">
                <span>Balance Due:</span>
                <span class="font-mono">{{ fmtMoney(Math.max(0, (parseFloat(String(selectedInvoice.total_amount)) || 0) - (parseFloat(String(selectedInvoice.amount_paid)) || 0))) }}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4 flex items-center justify-between sm:justify-between">
          <Button v-if="selectedInvoice" variant="outline" size="sm" class="gap-1.5" @click="handlePrintInvoice(selectedInvoice)">
            <Printer :size="14" />
            <span>Print Invoice</span>
          </Button>
          <Button variant="outline" size="sm" @click="showDetailModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Payment Recording Dialog -->
    <Dialog :open="showPaymentModal" @update:open="(val) => showPaymentModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">Record Customer Payment</DialogTitle>
          <DialogDescription>
            Record payment settlement for invoice <strong>{{ selectedInvoice?.invoice_number }}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3.5 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Payment Amount ($) *</label>
            <Input v-model.number="paymentData.amount" type="number" step="0.01" class="h-9 bg-surface text-sm font-mono" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Payment Tender Method</label>
            <SelectField
              v-model="paymentData.method"
              :options="paymentMethodOptions"
              placeholder="Select payment method"
              class="w-full h-9 bg-surface text-xs"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Transaction Reference (Optional)</label>
            <Input v-model="paymentData.reference" type="text" placeholder="e.g. TXN-998822 or Receipt #" class="h-9 bg-surface text-sm font-mono" />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showPaymentModal = false">Cancel</Button>
          <Button variant="primary" @click="recordPayment">Confirm Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Invoice Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this invoice? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete Invoice' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
