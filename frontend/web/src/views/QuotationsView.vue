<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { useQuotationStore, type Quotation } from '@/stores/quotationStore'
import { usePrintStore } from '@/stores/printStore'
import {
  FileText,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  DollarSign,
  CheckCircle2,
  Clock,
  Eye,
  ShoppingBag,
  X,
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
} from '@/components/ui'

const toast = useToast()
const quotationStore = useQuotationStore()

// Local UI state
const page = ref(1)
const perPage = ref(20)
const search = ref('')
const selectedStatus = ref('ALL')
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const showConvertDialog = ref(false)
const showDeleteDialog = ref(false)
const quotationToDelete = ref<Quotation | null>(null)
const selectedQuotation = ref<Quotation | null>(null)
const submitting = ref(false)

// Form state for create modal
const customerName = ref('')
const customerPhone = ref('')
const customerEmail = ref('')
const notes = ref('')
const discount = ref('0')
const formItems = ref<Array<{
  id: string
  product_name: string
  sku: string
  quantity: number
  unit_price: number
}>>([])

// Computed properties
const quotations = computed(() => quotationStore.quotations)

const filteredQuotations = computed(() => {
  let filtered = quotations.value

  if (selectedStatus.value !== 'ALL') {
    filtered = filtered.filter(q => (q.status || '').toUpperCase() === selectedStatus.value)
  }

  if (search.value.trim()) {
    const searchTerm = search.value.toLowerCase()
    filtered = filtered.filter(q =>
      q.quotation_number?.toLowerCase().includes(searchTerm) ||
      q.customer_name.toLowerCase().includes(searchTerm) ||
      q.customer_phone?.toLowerCase().includes(searchTerm) ||
      q.notes?.toLowerCase().includes(searchTerm) ||
      q.items?.some(item =>
        item.product_name.toLowerCase().includes(searchTerm) ||
        item.sku?.toLowerCase().includes(searchTerm)
      )
    )
  }

  return filtered
})

const statusBadgeVariant = (status: string): 'neutral' | 'info' | 'success' | 'warning' | 'destructive' => {
  const s = (status || '').toUpperCase()
  if (s === 'APPROVED' || s === 'ACCEPTED' || s === 'CONVERTED') return 'success'
  if (s === 'SENT') return 'info'
  if (s === 'EXPIRED') return 'warning'
  if (s === 'REJECTED') return 'destructive'
  return 'neutral'
}

const fmtMoney = (amount: number | string | undefined | null): string => {
  if (amount === undefined || amount === null) return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

const fmtDate = (d: string | undefined): string => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const calculateTotals = () => {
  const subtotal = formItems.value.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
  const discountAmount = parseFloat(discount.value) || 0
  return {
    subtotal,
    discount: discountAmount,
    total: Math.max(0, subtotal - discountAmount)
  }
}

const fetchQuotations = async () => {
  try {
    const filters = {
      page: page.value,
      per_page: perPage.value,
      search: search.value.trim() || undefined,
      status: selectedStatus.value === 'ALL' ? undefined : selectedStatus.value,
    }
    await quotationStore.fetchQuotations(filters)
  } catch {
    toast.error('Failed to load quotations')
  }
}

const openCreateModal = () => {
  customerName.value = ''
  customerPhone.value = ''
  customerEmail.value = ''
  notes.value = ''
  discount.value = '0'
  formItems.value = [
    {
      id: `item-${Date.now()}`,
      product_name: '',
      sku: '',
      quantity: 1,
      unit_price: 0,
    }
  ]
  showCreateModal.value = true
}

const addFormItem = () => {
  formItems.value.push({
    id: `item-${Date.now()}`,
    product_name: '',
    sku: '',
    quantity: 1,
    unit_price: 0,
  })
}

const removeFormItem = (index: number) => {
  formItems.value.splice(index, 1)
}

const handleCreateQuotation = async () => {
  if (!customerName.value.trim()) {
    toast.error('Customer name is required')
    return
  }
  if (formItems.value.length === 0 || !formItems.value[0].product_name.trim()) {
    toast.error('At least one item is required')
    return
  }

  submitting.value = true
  try {
    const payload = {
      customer_name: customerName.value.trim(),
      customer_phone: customerPhone.value.trim() || undefined,
      customer_email: customerEmail.value.trim() || undefined,
      discount: parseFloat(discount.value) || 0,
      notes: notes.value.trim() || undefined,
      items: formItems.value.map(item => ({
        product_name: item.product_name,
        sku: item.sku || undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    }

    await quotationStore.createQuotation(payload as any)
    await fetchQuotations()
    showCreateModal.value = false
    toast.success('Quotation created successfully!')
  } catch (err: any) {
    toast.error(err.message || 'Failed to create quotation')
  } finally {
    submitting.value = false
  }
}

const printStore = usePrintStore()

const openDetailModal = (quotation: Quotation) => {
  selectedQuotation.value = quotation
  showDetailModal.value = true
}

const handlePrintQuotation = async (quotation: Quotation) => {
  try {
    const res = await printStore.printQuotation(quotation.id, quotation)
    toast.success(res.message || 'Quotation printed')
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to print quotation')
  }
}

const handleUpdateStatus = async (quotation: Quotation, newStatus: Quotation['status']) => {
  try {
    if (newStatus === 'accepted') {
      await quotationStore.acceptQuotation(quotation.id)
    } else if (newStatus === 'rejected') {
      await quotationStore.rejectQuotation(quotation.id)
    } else {
      await quotationStore.updateQuotation(quotation.id, { status: newStatus } as any)
    }
    if (selectedQuotation.value) {
      selectedQuotation.value.status = newStatus
    }
    await fetchQuotations()
    toast.success(`Quotation updated to ${newStatus}`)
  } catch {
    toast.error('Failed to update status')
  }
}

const convertQuotation = async () => {
  if (!selectedQuotation.value) return
  try {
    await quotationStore.convertQuotation(selectedQuotation.value.id)
    await fetchQuotations()
    showConvertDialog.value = false
    showDetailModal.value = false
    toast.success('Quotation converted to sale order!')
  } catch {
    toast.error('Failed to convert quotation')
  }
}

const openDeleteModal = (quotation: Quotation) => {
  quotationToDelete.value = quotation
  showDeleteDialog.value = true
}

const confirmDeleteQuotation = async () => {
  if (!quotationToDelete.value) return
  submitting.value = true
  try {
    await quotationStore.deleteQuotation(quotationToDelete.value.id)
    showDeleteDialog.value = false
    showDetailModal.value = false
    quotationToDelete.value = null
    await fetchQuotations()
    toast.success('Quotation deleted successfully!')
  } catch {
    toast.error('Failed to delete quotation')
  } finally {
    submitting.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchQuotations()
  }, 300)
}

onMounted(() => {
  fetchQuotations()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Quotations</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ filteredQuotations.length }} Quotations
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Issue formal price quotations, track approvals, and seamlessly convert accepted bids into sales orders.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" :disabled="quotationStore.loading" @click="fetchQuotations">
          <RefreshCw :size="14" :class="{ 'animate-spin': quotationStore.loading }" />
          <span>Refresh</span>
        </Button>
        <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="openCreateModal">
          <Plus :size="15" />
          <span>New Quotation</span>
        </Button>
      </div>
    </div>

    <!-- KPI Summary Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Quotes"
        :value="filteredQuotations.length"
        sub="Recorded bids"
        :icon="FileText"
        icon-variant="primary"
      />
      <StatCard
        label="Quotation Pipeline"
        :value="fmtMoney(filteredQuotations.reduce((sum, q) => sum + (parseFloat(String(q.total_amount)) || 0), 0))"
        sub="Combined proposed value"
        :icon="DollarSign"
        icon-variant="success"
      />
      <StatCard
        label="Active Pending"
        :value="filteredQuotations.filter(q => (q.status || '').toLowerCase() === 'draft' || (q.status || '').toLowerCase() === 'sent').length"
        sub="Awaiting customer signoff"
        :icon="Clock"
        icon-variant="warning"
      />
      <StatCard
        label="Converted Orders"
        :value="filteredQuotations.filter(q => (q.status || '').toLowerCase() === 'accepted' || (q.status || '').toLowerCase() === 'converted').length"
        sub="Converted into sales"
        :icon="CheckCircle2"
        icon-variant="purple"
      />
    </div>

    <!-- Filter Bar -->
    <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex-1 max-w-md">
        <Input
          v-model="search"
          type="text"
          placeholder="Search by quote #, customer, phone, product…"
          class="bg-surface font-mono"
          @input="onSearchInput"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </Input>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="selectedStatus"
          class="h-9 px-3 text-sm bg-surface border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          @change="fetchQuotations"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="CONVERTED">Converted</option>
          <option value="EXPIRED">Expired</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
    </div>

    <!-- Quotations Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="quotationStore.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!filteredQuotations.length"
        :icon="FileText"
        title="No quotations found"
        description="No quotations match the filter or none have been drafted yet."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5" @click="openCreateModal">
            <Plus :size="15" />
            <span>Draft First Quotation</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Quote #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead class="font-mono">Subtotal</TableHead>
              <TableHead class="font-mono">Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="font-mono">Date</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="q in filteredQuotations" :key="q.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell class="font-mono text-xs font-semibold text-primary">
                {{ q.quotation_number || `QT-${q.id.slice(0, 6)}` }}
              </TableCell>
              <TableCell>
                <div class="font-semibold text-foreground">{{ q.customer_name }}</div>
                <div v-if="q.customer_phone" class="font-mono text-xs text-muted-foreground">{{ q.customer_phone }}</div>
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                {{ fmtMoney(q.subtotal) }}
              </TableCell>
              <TableCell class="font-mono text-sm font-bold text-foreground tabular-nums">
                {{ fmtMoney(q.total_amount) }}
              </TableCell>
              <TableCell>
                <Badge :variant="statusBadgeVariant(q.status)" class="text-[11px] px-2 py-0.5 uppercase">
                  {{ q.status }}
                </Badge>
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ fmtDate(q.created_at) }}
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" title="Print Quotation" @click="handlePrintQuotation(q)">
                    <Printer :size="13" />
                    <span>Print</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="openDetailModal(q)">
                    <Eye :size="13" />
                    <span>View</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Create Quotation Modal Dialog -->
    <Dialog :open="showCreateModal" @update:open="(val) => showCreateModal = val">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="font-display">Draft New Quotation</DialogTitle>
          <DialogDescription>
            Prepare a customized price quotation with line items and discounts.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Customer Name *</label>
              <Input v-model="customerName" placeholder="Client or Company Name" class="h-9 bg-surface text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
              <Input v-model="customerPhone" placeholder="+855 ..." class="h-9 bg-surface text-sm font-mono" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Email</label>
              <Input v-model="customerEmail" type="email" placeholder="client@example.com" class="h-9 bg-surface text-sm" />
            </div>
          </div>

          <!-- Items Matrix -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-foreground">Line Items</label>
              <Button variant="outline" size="sm" class="h-7 px-2 text-xs gap-1" @click="addFormItem">
                <Plus :size="12" />
                <span>Add Item</span>
              </Button>
            </div>

            <div class="space-y-2 border border-border rounded-lg p-3 bg-surface-subtle/40">
              <div
                v-for="(item, idx) in formItems"
                :key="item.id"
                class="flex items-center gap-2 flex-wrap sm:flex-nowrap"
              >
                <Input v-model="item.product_name" placeholder="Item Name *" class="h-8 text-xs flex-2 bg-surface" />
                <Input v-model="item.sku" placeholder="SKU" class="h-8 text-xs flex-1 bg-surface font-mono" />
                <Input v-model.number="item.quantity" type="number" min="1" placeholder="Qty" class="h-8 w-20 text-xs bg-surface font-mono text-center" />
                <Input v-model.number="item.unit_price" type="number" step="0.01" min="0" placeholder="Price ($)" class="h-8 w-24 text-xs bg-surface font-mono text-right" />
                <span class="font-mono text-xs font-bold w-24 text-right tabular-nums text-foreground">
                  {{ fmtMoney(item.quantity * item.unit_price) }}
                </span>
                <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-destructive" @click="removeFormItem(idx)">
                  <X :size="14" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Discount and Total Summary -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Quotation Notes</label>
              <textarea
                v-model="notes"
                rows="2"
                placeholder="Payment terms, validity dates (e.g. valid for 14 days)…"
                class="w-full px-3 py-1.5 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              ></textarea>
            </div>

            <div class="p-3 rounded-lg border border-border bg-surface text-xs space-y-1.5">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span class="font-mono font-semibold text-foreground">{{ fmtMoney(calculateTotals().subtotal) }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">Discount ($):</span>
                <Input v-model="discount" type="number" step="0.01" min="0" class="h-7 w-24 text-xs font-mono text-right bg-surface" />
              </div>
              <div class="flex justify-between border-t border-border pt-1.5 font-bold text-sm text-primary">
                <span>Proposed Total:</span>
                <span class="font-mono">{{ fmtMoney(calculateTotals().total) }}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="submitting" @click="showCreateModal = false">Cancel</Button>
          <Button variant="primary" :disabled="submitting" @click="handleCreateQuotation">
            {{ submitting ? 'Saving Quote…' : 'Create Quotation' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Quotation Detail Dialog -->
    <Dialog :open="showDetailModal" @update:open="(val) => showDetailModal = val">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <div class="flex items-center justify-between">
            <div>
              <DialogTitle class="font-display flex items-center gap-2">
                <span class="font-mono text-primary">{{ selectedQuotation?.quotation_number || 'Quotation' }}</span>
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                Client: <strong>{{ selectedQuotation?.customer_name }}</strong> &bull; {{ fmtDate(selectedQuotation?.created_at) }}
              </DialogDescription>
            </div>
            <Badge v-if="selectedQuotation" :variant="statusBadgeVariant(selectedQuotation.status)" class="text-xs uppercase">
              {{ selectedQuotation.status }}
            </Badge>
          </div>
        </DialogHeader>

        <div v-if="selectedQuotation" class="py-2 space-y-4">
          <div class="border border-border rounded-lg overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-muted/40 text-muted-foreground border-b border-border">
                  <th class="py-2.5 px-3">Item Description</th>
                  <th class="py-2.5 px-3">SKU</th>
                  <th class="py-2.5 px-3 text-center">Qty</th>
                  <th class="py-2.5 px-3 font-mono text-right">Unit Price</th>
                  <th class="py-2.5 px-3 font-mono text-right">Line Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/60">
                <tr v-for="(item, i) in selectedQuotation.items" :key="i">
                  <td class="py-2.5 px-3 font-semibold text-foreground">{{ item.product_name }}</td>
                  <td class="py-2.5 px-3 font-mono text-muted-foreground">{{ item.sku || '—' }}</td>
                  <td class="py-2.5 px-3 font-mono text-center font-bold">{{ item.quantity }}</td>
                  <td class="py-2.5 px-3 font-mono text-right text-muted-foreground">{{ fmtMoney(item.unit_price) }}</td>
                  <td class="py-2.5 px-3 font-mono text-right font-bold text-foreground">{{ fmtMoney((item.quantity * Number(item.unit_price))) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex justify-between items-start">
            <div v-if="selectedQuotation.notes" class="max-w-xs text-xs text-muted-foreground">
              <span class="font-semibold block text-foreground mb-0.5">Notes:</span>
              <span>{{ selectedQuotation.notes }}</span>
            </div>
            <div class="w-60 space-y-1 text-xs ml-auto">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span class="font-mono font-semibold text-foreground">{{ fmtMoney(selectedQuotation.subtotal) }}</span>
              </div>
              <div v-if="Number(selectedQuotation.discount) > 0" class="flex justify-between text-muted-foreground">
                <span>Discount:</span>
                <span class="font-mono font-semibold text-destructive">- {{ fmtMoney(selectedQuotation.discount) }}</span>
              </div>
              <div class="flex justify-between border-t border-border pt-1 font-bold text-sm text-primary">
                <span>Grand Total:</span>
                <span class="font-mono">{{ fmtMoney(selectedQuotation.total_amount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10 mr-auto text-xs" @click="openDeleteModal(selectedQuotation!)">
            <Trash2 :size="13" class="mr-1" />
            <span>Delete</span>
          </Button>

          <Button
            v-if="selectedQuotation"
            variant="outline"
            size="sm"
            class="text-xs gap-1 mr-1.5"
            @click="handlePrintQuotation(selectedQuotation)"
          >
            <Printer :size="13" />
            <span>Print Quote</span>
          </Button>

          <Button
            v-if="(selectedQuotation?.status as string) !== 'accepted' && (selectedQuotation?.status as string) !== 'converted'"
            variant="outline"
            size="sm"
            class="text-xs"
            @click="handleUpdateStatus(selectedQuotation!, 'accepted')"
          >
            Mark Accepted
          </Button>

          <Button
            v-if="(selectedQuotation?.status as string) === 'accepted' || (selectedQuotation?.status as string) === 'approved'"
            variant="primary"
            size="sm"
            class="text-xs gap-1"
            @click="convertQuotation"
          >
            <ShoppingBag :size="13" />
            <span>Convert to Sale Order</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Quotation Confirmation Dialog -->
    <Dialog :open="showDeleteDialog" @update:open="(val) => showDeleteDialog = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <Trash2 class="text-destructive w-5 h-5" />
            <span>Delete Quotation</span>
          </DialogTitle>
          <DialogDescription class="text-sm text-muted-foreground mt-2">
            Are you sure you want to delete quotation <strong class="font-mono text-foreground">{{ quotationToDelete?.quotation_number || quotationToDelete?.id }}</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="submitting" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" :disabled="submitting" @click="confirmDeleteQuotation">
            {{ submitting ? 'Deleting…' : 'Delete Quotation' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>