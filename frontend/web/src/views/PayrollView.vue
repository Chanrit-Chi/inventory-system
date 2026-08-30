<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePayrollStore, type PayrollRun } from '@/stores/payrollStore'
import { useToast } from '@/composables/useToast'
import {
  Users,
  Plus,
  RefreshCw,
  Eye,
  Trash2,
  Calendar,
  Gift,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  DollarSign,
  Briefcase,
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
const store = usePayrollStore()

const showGenerateModal = ref(false)
const showEmployeesModal = ref(false)
const showThirteenthModal = ref(false)
const selectedPayroll = ref<PayrollRun | null>(null)

const isDeleteDialogOpen = ref(false)
const deletingPayrollId = ref<string | null>(null)
const isDeleting = ref(false)

const newPayroll = ref({
  period_start: '',
  period_end: '',
})

const filters = ref({
  page: 1,
  per_page: 15,
  status: '' as string,
})

const payrollRuns = computed(() => store.payrollRuns)
const totalRuns = computed(() => store.meta?.total ?? store.payrollRuns.length)
const totalNetDisbursed = computed(() => store.payrollRuns.reduce((sum, p) => sum + (parseFloat(String(p.total_net)) || 0), 0))
const totalStaffCovered = computed(() => store.payrollRuns.reduce((sum, p) => sum + (p.employee_count || 0), 0))

async function loadPayrolls() {
  try {
    await store.fetchPayrollRuns({
      page: filters.value.page,
      per_page: filters.value.per_page,
      status: filters.value.status || undefined,
    })
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load payroll runs')
  }
}

async function handleGenerate() {
  if (!newPayroll.value.period_start || !newPayroll.value.period_end) {
    toast.error('Period start and end dates are required')
    return
  }
  try {
    await store.generatePayroll({
      period_start: newPayroll.value.period_start,
      period_end: newPayroll.value.period_end,
    })
    toast.success('Payroll generated successfully')
    showGenerateModal.value = false
    newPayroll.value = { period_start: '', period_end: '' }
    await loadPayrolls()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to generate payroll')
  }
}

async function handleBulkStatus(status: string) {
  const ids = store.payrollRuns.filter(p => p.status === 'draft' || p.status === 'calculated').map(p => p.id)
  if (!ids.length) {
    toast.info('No pending payrolls to update')
    return
  }
  try {
    await store.bulkUpdateStatus(ids, status)
    toast.success(`Updated ${ids.length} payroll runs`)
    showEmployeesModal.value = false
    await loadPayrolls()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to update payrolls')
  }
}

function confirmDelete(id: string) {
  deletingPayrollId.value = id
  isDeleteDialogOpen.value = true
}

function cancelDelete() {
  deletingPayrollId.value = null
  isDeleteDialogOpen.value = false
}

async function executeDelete() {
  if (!deletingPayrollId.value) return
  isDeleting.value = true
  try {
    await store.deletePayroll(deletingPayrollId.value)
    toast.success('Payroll deleted')
    isDeleteDialogOpen.value = false
    deletingPayrollId.value = null
    await loadPayrolls()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete payroll')
  } finally {
    isDeleting.value = false
  }
}

function viewEmployees(p: PayrollRun) {
  selectedPayroll.value = p
  showEmployeesModal.value = true
}

function viewThirteenth() {
  showThirteenthModal.value = true
}

function statusBadge(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'paid') return { variant: 'success' as const, label: 'Paid' }
  if (s === 'approved') return { variant: 'info' as const, label: 'Approved' }
  if (s === 'calculated') return { variant: 'warning' as const, label: 'Calculated' }
  return { variant: 'neutral' as const, label: 'Draft' }
}

function formatMoney(n: number | string | undefined | null) {
  const val = typeof n === 'string' ? parseFloat(n) : (n || 0)
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function nextPage() {
  if (store.meta && filters.value.page < store.meta.last_page) {
    filters.value.page += 1
    loadPayrolls()
  }
}
function prevPage() {
  if (filters.value.page > 1) {
    filters.value.page -= 1
    loadPayrolls()
  }
}

onMounted(loadPayrolls)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Staff Payroll</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalRuns }} Runs
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage staff salary disbursements, tax deductions, and statutory 13th-month bonus payouts.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" @click="viewThirteenth">
          <Gift :size="14" />
          <span>13th-Month</span>
        </Button>
        <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="showGenerateModal = true">
          <Plus :size="15" />
          <span>Generate Payroll</span>
        </Button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Payroll Runs"
        :value="totalRuns"
        sub="Completed salary cycles"
        :icon="Calendar"
        icon-variant="primary"
      />
      <StatCard
        label="Net Payouts Disbursed"
        :value="formatMoney(totalNetDisbursed)"
        sub="Net staff compensation"
        :icon="DollarSign"
        icon-variant="success"
      />
      <StatCard
        label="Staff Coverage"
        :value="totalStaffCovered"
        sub="Employee disbursements"
        :icon="Briefcase"
        icon-variant="warning"
      />
    </div>

    <!-- Filter Toolbar -->
    <div class="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <label class="text-xs text-muted-foreground font-medium">Status Filter:</label>
        <select
          v-model="filters.status"
          class="h-8 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
          @change="loadPayrolls"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="calculated">Calculated</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <Button variant="outline" size="sm" class="h-8 px-2.5 text-xs gap-1" :disabled="store.loading" @click="loadPayrolls">
        <RefreshCw :size="13" :class="{ 'animate-spin': store.loading }" />
        <span>Refresh</span>
      </Button>
    </div>

    <!-- Payroll Runs Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading" class="p-6 space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!payrollRuns.length"
        :icon="Users"
        title="No payroll runs found"
        description="No staff payroll cycles have been generated for this period."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5 mt-2" @click="showGenerateModal = true">
            <Plus :size="15" />
            <span>Generate First Payroll</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead>Pay Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="font-mono text-center">Employees</TableHead>
              <TableHead class="font-mono">Gross Total</TableHead>
              <TableHead class="font-mono">Deductions</TableHead>
              <TableHead class="font-mono">Net Payout</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="p in payrollRuns" :key="p.id" class="hover:bg-surface-subtle/80 transition-colors">
              <TableCell class="font-mono text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar :size="14" class="text-primary flex-shrink-0" />
                <span>{{ p.period_start }} → {{ p.period_end }}</span>
              </TableCell>
              <TableCell>
                <Badge :variant="statusBadge(p.status).variant" class="text-[10px] px-2 py-0.5">
                  {{ statusBadge(p.status).label }}
                </Badge>
              </TableCell>
              <TableCell class="font-mono text-xs text-center font-bold text-foreground tabular-nums">
                {{ p.employee_count }}
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground tabular-nums">
                {{ formatMoney(p.total_gross) }}
              </TableCell>
              <TableCell class="font-mono text-xs text-destructive tabular-nums">
                - {{ formatMoney(p.total_deductions) }}
              </TableCell>
              <TableCell class="font-mono text-sm font-bold text-primary tabular-nums">
                {{ formatMoney(p.total_net) }}
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" class="h-8 px-2.5 text-xs gap-1" @click="viewEmployees(p)">
                    <Eye :size="13" />
                    <span>View</span>
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" @click="confirmDelete(p.id)">
                    <Trash2 :size="14" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
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

    <!-- Generate Modal Dialog -->
    <Dialog :open="showGenerateModal" @update:open="(val) => showGenerateModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">Generate Payroll Run</DialogTitle>
          <DialogDescription>
            Compute salary and commission payouts for all active staff for the designated period.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3 py-2">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Period Start *</label>
            <Input type="date" v-model="newPayroll.period_start" class="h-9 bg-surface text-sm font-mono" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Period End *</label>
            <Input type="date" v-model="newPayroll.period_end" class="h-9 bg-surface text-sm font-mono" />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showGenerateModal = false">Cancel</Button>
          <Button variant="primary" @click="handleGenerate">Generate Run</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Employees / Payroll Details Dialog -->
    <Dialog :open="showEmployeesModal" @update:open="(val) => showEmployeesModal = val">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="font-display">Payroll Run Details</DialogTitle>
          <DialogDescription>
            Cycle: <strong>{{ selectedPayroll?.period_start }} → {{ selectedPayroll?.period_end }}</strong>
          </DialogDescription>
        </DialogHeader>

        <div class="py-2 space-y-3">
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div class="p-3 rounded-lg border border-border bg-surface-subtle">
              <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Employees</span>
              <span class="font-bold text-base text-foreground font-mono">{{ selectedPayroll?.employee_count }}</span>
            </div>
            <div class="p-3 rounded-lg border border-border bg-surface-subtle">
              <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Gross Total</span>
              <span class="font-bold text-base text-foreground font-mono">{{ formatMoney(selectedPayroll?.total_gross) }}</span>
            </div>
            <div class="p-3 rounded-lg border border-border bg-surface-subtle">
              <span class="text-muted-foreground block text-[10px] uppercase font-semibold">Net Payout</span>
              <span class="font-bold text-base text-primary font-mono">{{ formatMoney(selectedPayroll?.total_net) }}</span>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 mt-4">
          <Button variant="outline" size="sm" class="text-xs" @click="handleBulkStatus('calculated')">Mark Calculated</Button>
          <Button variant="primary" size="sm" class="text-xs gap-1" @click="handleBulkStatus('approved')">
            <CheckCircle2 :size="14" />
            <span>Approve All</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 13th Month Modal Dialog -->
    <Dialog :open="showThirteenthModal" @update:open="(val) => showThirteenthModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <Gift :size="18" class="text-primary" />
            <span>13th-Month Statutory Payouts</span>
          </DialogTitle>
          <DialogDescription>
            Annual statutory bonus and 13th-month salary entitlement calculation.
          </DialogDescription>
        </DialogHeader>
        <div class="py-3 text-xs text-muted-foreground">
          13th-month calculations are computed based on prorated service tenure across active employee profiles.
        </div>
        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showThirteenthModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Payroll Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this payroll run? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isDeleting" @click="cancelDelete">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="isDeleting" @click="executeDelete">
            <span v-if="isDeleting" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isDeleting ? 'Deleting…' : 'Delete Payroll' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
