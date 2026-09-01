<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePayrollStore, type Payroll } from '@/stores/payrollStore'
import { useUserStore } from '@/stores/userStore'
import { useToast } from '@/composables/useToast'
import {
  Users,
  Plus,
  RefreshCw,
  Trash2,
  Calendar,
  Gift,
  CheckCircle2,
  DollarSign,
  Printer,
  Sparkles,
  Check,
  CreditCard,
  Edit3,
  Search,
  RotateCcw,
  Clock,
  Lock,
  TrendingUp,
  Zap,
  Trophy,
  Bike,
  PlusCircle,
  Receipt,
  Banknote,
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
  Alert,
  SelectField,
} from '@/components/ui'

const toast = useToast()
const store = usePayrollStore()
const userStore = useUserStore()

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Current date defaults
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

// Modals
const showGenerateModal = ref(false)
const showDetailModal = ref(false)
const showSalaryModal = ref(false)
const showThirteenthModal = ref(false)
const showPayslipModal = ref(false)
const showStandaloneModal = ref(false)

// Delete Dialog
const isDeleteDialogOpen = ref(false)
const deletingPayrollId = ref<string | null>(null)
const isDeleting = ref(false)

// Filters
const filterMonth = ref<number | 'ALL'>('ALL')
const filterYear = ref<number | 'ALL'>('ALL')
const filterStatus = ref<string>('ALL')
const search = ref('')

// Selection
const selectedIds = ref<Set<string>>(new Set())

// Editing Payroll State
const editingPayroll = ref<Payroll | null>(null)
const workingDays = ref(26)
const perfBenefit = ref(0)
const delivBenefit = ref(0)
const otDays = ref(0)
const unpaidDays = ref(0)
const collecBenefit = ref(0)
const otherBenefit = ref(0)
const incentiveMode = ref<'AUTO' | 'MANUAL'>('AUTO')
const manualIncentive = ref(0)
const includeThirteenthPayout = ref(false)
const thirteenthPayoutAmount = ref(0)
const isSavingDetail = ref(false)

// Payment Method for Mark Paid
const paymentMethod = ref('cash')

// Generate Modal State
const generateMode = ref<'BATCH' | 'MULTI' | 'SINGLE'>('BATCH')
const generateMonth = ref(currentMonth)
const generateYear = ref(currentYear)
const singleStaffId = ref('')
const multiSelectedStaffIds = ref<Set<string>>(new Set())
const isGenerating = ref(false)

// Base Salary Management State
const salaryDrafts = ref<Record<string, number>>({})
const salarySavingUser = ref<string | null>(null)

// Standalone 13th-Month Payout State
const standaloneUserId = ref('')
const standaloneAmount = ref(0)
const standaloneNotes = ref('Annual Seniority / Festival Bonus Payout')
const isSavingStandalone = ref(false)

// Payslip Print State
const payslipPayroll = ref<Payroll | null>(null)
const payslipFormat = ref<'THERMAL' | 'A4'>('A4')

// Available years
const availableYears = computed(() => {
  const years = new Set<number>([currentYear, currentYear - 1, currentYear + 1])
  for (const p of store.payrolls) {
    if (p.period_year) years.add(p.period_year)
  }
  return Array.from(years).sort((a, b) => b - a)
})

// Filtered list
const filteredPayrolls = computed(() => {
  let list = store.payrolls || []

  if (filterMonth.value !== 'ALL') {
    list = list.filter(p => p.period_month === filterMonth.value)
  }
  if (filterYear.value !== 'ALL') {
    list = list.filter(p => p.period_year === filterYear.value)
  }
  if (filterStatus.value !== 'ALL') {
    list = list.filter(p => (p.status || '').toUpperCase() === filterStatus.value.toUpperCase())
  }

  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(p => {
      const name = (p.user?.name || '').toLowerCase()
      const email = (p.user?.email || '').toLowerCase()
      const role = (p.user?.role || '').toLowerCase()
      const dept = (p.user?.department || '').toLowerCase()
      return name.includes(q) || email.includes(q) || role.includes(q) || dept.includes(q)
    })
  }

  return list
})

// KPIs
const totalRuns = computed(() => filteredPayrolls.value.length)
const totalNetDisbursed = computed(() =>
  filteredPayrolls.value.reduce((sum, p) => sum + (parseFloat(String(p.total_net_pay || p.total_net || 0)) || 0), 0)
)
const totalCommissions = computed(() =>
  filteredPayrolls.value.reduce((sum, p) => sum + (parseFloat(String(p.sales_commission || p.incentive_override || 0)) || 0), 0)
)
const totalThirteenthAccrual = computed(() =>
  filteredPayrolls.value.reduce((sum, p) => sum + (parseFloat(String(p.thirteenth_month_accrual || 0)) || 0), 0)
)

// Active staff members
const activeStaffUsers = computed(() => {
  return (userStore.users || []).filter(u => {
    // Backend returns status as 'ACTIVE'/'INACTIVE' (uppercase) — compare case-insensitively
    const isActive = (u as any).is_active === true
      || String(u.status).toUpperCase() === 'ACTIVE'
      || (!u.status && !(u as any).is_active === false)
    // Exclude super_admin from payroll
    const role = String(u.role || '').toUpperCase().replace(/[-\s]/g, '_')
    const notAdmin = role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN'
    return isActive && notAdmin
  })
})


// Map of staff who already have payroll generated for the modal month/year
const existingPayrollStaffMap = computed(() => {
  const map = new Map<string, Payroll>()
  const m = generateMonth.value
  const y = generateYear.value
  for (const p of store.payrolls) {
    if (p.period_month === m && p.period_year === y) {
      map.set(p.user_id, p)
    }
  }
  return map
})

const eligibleStaffUsers = computed(() => {
  return activeStaffUsers.value.filter(u => !existingPayrollStaffMap.value.has(u.id))
})

const filterMonthOptions = computed(() => [
  { label: 'All Months', value: 'ALL' },
  ...MONTH_NAMES.map((mName, idx) => ({ label: mName, value: idx + 1 })),
])

const generateMonthOptions = computed(() => [
  ...MONTH_NAMES.map((mName, idx) => ({ label: mName, value: idx + 1 })),
])

const filterYearOptions = computed(() => [
  { label: 'All Years', value: 'ALL' },
  ...availableYears.value.map(yr => ({ label: String(yr), value: yr })),
])

const generateYearOptions = computed(() => [
  ...availableYears.value.map(yr => ({ label: String(yr), value: yr })),
])

const filterStatusOptions = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Finalized', value: 'FINALIZED' },
  { label: 'Paid', value: 'PAID' },
]

const singleStaffOptions = computed(() => [
  { label: '-- Choose Employee --', value: '' },
  ...activeStaffUsers.value.map(u => ({
    label: `${u.name} (${u.role})${existingPayrollStaffMap.value.has(u.id) ? ' • Already Generated' : ''}`,
    value: u.id,
  })),
])

// Calculations in Detail Modal
const liveCalculations = computed(() => {
  if (!editingPayroll.value) return { dailyRate: 0, gross: 0, otPay: 0, unpaidDeduction: 0, net: 0, tax: 0, benefits: 0, commission: 0, thirteenthPayout: 0, thirteenthAccrual: 0 }

  const base = editingPayroll.value.base_salary || 0
  const days = Math.max(1, workingDays.value || 26)
  const dailyRate = base / days

  const otPay = (otDays.value || 0) * dailyRate
  const unpaidDeduction = (unpaidDays.value || 0) * dailyRate
  const benefits = (perfBenefit.value || 0) + (delivBenefit.value || 0) + (collecBenefit.value || 0) + (otherBenefit.value || 0)

  let commission = 0
  if (incentiveMode.value === 'MANUAL') {
    commission = manualIncentive.value || 0
  } else {
    commission = editingPayroll.value.sales_commission || 0
  }

  const thirteenthPayout = includeThirteenthPayout.value ? (thirteenthPayoutAmount.value || 0) : 0
  // 13th month = base salary ÷ 12 months (matches backend PayrollCalculatorService)
  const thirteenthAccrual = Math.round((base / 12) * 100) / 100

  const gross = base + otPay + benefits + commission
  const tax = editingPayroll.value.tax_deduction || 0
  const net = gross - unpaidDeduction - tax + thirteenthPayout

  return {
    dailyRate,
    otPay,
    unpaidDeduction,
    benefits,
    commission,
    thirteenthPayout,
    thirteenthAccrual,
    gross,
    tax,
    net: Math.max(0, net)
  }
})

// Format currency
function formatMoney(n: number | string | undefined | null) {
  const val = typeof n === 'string' ? parseFloat(n) : (n || 0)
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function getStaffName(p: Payroll): string {
  if (p.user?.name) return p.user.name
  const found = userStore.users.find(u => u.id === p.user_id)
  return found?.name || 'Staff Member'
}

function getStaffRole(p: Payroll): string {
  return p.user?.role || userStore.users.find(u => u.id === p.user_id)?.role || 'Staff'
}

function getStaffDept(p: Payroll): string {
  return p.user?.department || 'Operations'
}

function statusBadge(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'PAID') return { variant: 'success' as const, label: 'Paid' }
  if (s === 'FINALIZED') return { variant: 'info' as const, label: 'Finalized' }
  return { variant: 'neutral' as const, label: 'Draft' }
}

async function loadData() {
  try {
    await Promise.all([
      store.fetchPayrolls({
        month: filterMonth.value !== 'ALL' ? filterMonth.value : undefined,
        year: filterYear.value !== 'ALL' ? filterYear.value : undefined,
        status: filterStatus.value !== 'ALL' ? filterStatus.value : undefined,
      }),
      userStore.fetchUsers()
    ])
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to load payroll data')
  }
}

// Multi Selection Handlers
function toggleSelectAll() {
  if (selectedIds.value.size === filteredPayrolls.value.length) {
    selectedIds.value.clear()
  } else {
    selectedIds.value = new Set(filteredPayrolls.value.map(p => p.id))
  }
}

function toggleSelectRow(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

// Bulk Actions
async function handleBulkStatus(status: 'FINALIZED' | 'PAID') {
  const ids = Array.from(selectedIds.value)
  if (!ids.length) {
    toast.info('Please select at least one payroll row')
    return
  }
  try {
    await store.bulkUpdateStatus(ids, status)
    toast.success(`Updated ${ids.length} payroll(s) to ${status}`)
    selectedIds.value.clear()
    await loadData()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to bulk update status')
  }
}

// Open Detail Modal
async function openDetail(p: Payroll) {
  editingPayroll.value = { ...p }
  workingDays.value = p.working_days || 26
  perfBenefit.value = p.performance_benefit || 0
  delivBenefit.value = p.delivery_benefit || 0
  otDays.value = p.overtime_days || 0
  unpaidDays.value = p.unpaid_leave_days || 0
  collecBenefit.value = p.collective_benefit || 0
  otherBenefit.value = p.other_benefits || 0

  if (p.incentive_override !== null && p.incentive_override !== undefined) {
    incentiveMode.value = 'MANUAL'
    manualIncentive.value = p.incentive_override
  } else {
    incentiveMode.value = 'AUTO'
    manualIncentive.value = p.sales_commission || 0
  }

  includeThirteenthPayout.value = (p.thirteenth_month_payout || 0) > 0
  thirteenthPayoutAmount.value = p.thirteenth_month_payout || 0
  paymentMethod.value = p.payment_method || 'cash'

  showDetailModal.value = true

  // Fetch 13th month reserve for user
  if (p.user_id) {
    await store.fetchThirteenthMonthSavings(p.user_id)
  }
}

// Save Detail
async function handleSaveDetail(targetStatus: 'DRAFT' | 'FINALIZED' | 'PAID') {
  if (!editingPayroll.value) return
  isSavingDetail.value = true
  try {
    const payload = {
      working_days: workingDays.value,
      performance_benefit: perfBenefit.value,
      delivery_benefit: delivBenefit.value,
      overtime_days: otDays.value,
      unpaid_leave_days: unpaidDays.value,
      collective_benefit: collecBenefit.value,
      other_benefits: otherBenefit.value,
      incentive_override: incentiveMode.value === 'MANUAL' ? manualIncentive.value : null,
      thirteenth_month_payout: includeThirteenthPayout.value ? thirteenthPayoutAmount.value : 0,
      status: targetStatus,
    }

    await store.updatePayroll(editingPayroll.value.id, payload)
    toast.success(`Payroll saved as ${targetStatus}`)
    showDetailModal.value = false
    await loadData()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to update payroll')
  } finally {
    isSavingDetail.value = false
  }
}

// Quick Transition Button in Table
async function quickTransition(p: Payroll, targetStatus: 'FINALIZED' | 'PAID' | 'DRAFT') {
  try {
    await store.updatePayroll(p.id, { status: targetStatus })
    toast.success(`Payroll for ${getStaffName(p)} updated to ${targetStatus}`)
    await loadData()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Status transition failed')
  }
}

// Generate Payroll
async function handleGenerate() {
  isGenerating.value = true
  try {
    let payload: any = {
      month: generateMonth.value,
      year: generateYear.value,
    }

    if (generateMode.value === 'BATCH') {
      payload.batch = true
      payload.all_staff = true
    } else if (generateMode.value === 'MULTI') {
      const ids = Array.from(multiSelectedStaffIds.value)
      if (!ids.length) {
        toast.error('Please select at least one staff member')
        isGenerating.value = false
        return
      }
      payload.user_ids = ids
    } else if (generateMode.value === 'SINGLE') {
      if (!singleStaffId.value) {
        toast.error('Please select a staff member')
        isGenerating.value = false
        return
      }
      payload.user_id = singleStaffId.value
    }

    const res = await store.generatePayroll(payload)
    toast.success(res.message || 'Payroll generated successfully')
    showGenerateModal.value = false
    await loadData()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to generate payroll')
  } finally {
    isGenerating.value = false
  }
}

// Delete Handlers
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
    toast.success('Payroll record deleted')
    isDeleteDialogOpen.value = false
    deletingPayrollId.value = null
    await loadData()
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to delete payroll')
  } finally {
    isDeleting.value = false
  }
}

// Open Base Salary Modal
function openSalaryManagement() {
  salaryDrafts.value = {}
  for (const u of activeStaffUsers.value) {
    store.fetchUserSalary(u.id).then(res => {
      if (res?.base_salary) {
        salaryDrafts.value[u.id] = parseFloat(String(res.base_salary))
      }
    })
  }
  showSalaryModal.value = true
}

async function saveSalaryForUser(userId: string) {
  const amount = salaryDrafts.value[userId]
  if (amount === undefined || isNaN(amount) || amount < 0) {
    toast.error('Please enter a valid base salary')
    return
  }
  salarySavingUser.value = userId
  try {
    await store.setUserSalary(userId, { base_salary: amount, currency: 'USD' })
    toast.success('Base salary updated')
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save base salary')
  } finally {
    salarySavingUser.value = null
  }
}

// Open 13th-Month Reserve Modal
function openThirteenthModal() {
  for (const u of activeStaffUsers.value) {
    store.fetchThirteenthMonthSavings(u.id)
  }
  showThirteenthModal.value = true
}

function openStandalonePayout(userId: string) {
  standaloneUserId.value = userId
  standaloneAmount.value = store.thirteenthMonthSummaries[userId]?.available_balance || 0
  showStandaloneModal.value = true
}

async function handleSaveStandalone() {
  if (!standaloneUserId.value || standaloneAmount.value <= 0) {
    toast.error('Please enter a valid payout amount')
    return
  }
  isSavingStandalone.value = true
  try {
    await store.recordStandalonePayout(standaloneUserId.value, {
      amount: standaloneAmount.value,
      notes: standaloneNotes.value,
      fiscal_year: filterYear.value !== 'ALL' ? Number(filterYear.value) : currentYear,
    })
    toast.success('Standalone bonus payout recorded')
    showStandaloneModal.value = false
    await store.fetchThirteenthMonthSavings(standaloneUserId.value)
  } catch (err) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to record payout')
  } finally {
    isSavingStandalone.value = false
  }
}

// Payslip Modal
function openPayslip(p: Payroll) {
  payslipPayroll.value = p
  showPayslipModal.value = true
}

function triggerPrint() {
  window.print()
}

onMounted(loadData)
</script>

<template>
  <div class="flex flex-col gap-6 max-w-6xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Staff Payroll</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ totalRuns }} Records
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Omnichannel compensation: base salary, sales commissions, overtime, benefits, and 13th-month seniority reserves.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" @click="openSalaryManagement">
          <CreditCard :size="14" />
          <span>Base Salaries</span>
        </Button>
        <Button variant="outline" size="sm" class="h-9 px-3 gap-1.5 text-xs" @click="openThirteenthModal">
          <Gift :size="14" />
          <span>13th-Month Reserves</span>
        </Button>
        <Button variant="primary" size="sm" class="h-9 px-3.5 gap-1.5" @click="showGenerateModal = true">
          <Plus :size="15" />
          <span>Generate Payroll</span>
        </Button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Payrolls"
        :value="totalRuns"
        sub="Current period cycles"
        :icon="Calendar"
        icon-variant="primary"
      />
      <StatCard
        label="Net Payouts"
        :value="formatMoney(totalNetDisbursed)"
        sub="Net staff compensation"
        :icon="DollarSign"
        icon-variant="success"
      />
      <StatCard
        label="Sales Commissions"
        :value="formatMoney(totalCommissions)"
        sub="POS sales incentives"
        :icon="Sparkles"
        icon-variant="warning"
      />
      <StatCard
        label="13th-Month Accrual"
        :value="formatMoney(totalThirteenthAccrual)"
        sub="5% seniority reserve"
        :icon="Gift"
        icon-variant="primary"
      />
    </div>

    <!-- Filter & Selection Toolbar -->
    <div class="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col gap-3">
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- Month, Year & Status Pickers -->
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-muted-foreground mr-1">Period:</span>
            <SelectField
              v-model="filterMonth"
              :options="filterMonthOptions"
              placeholder="All Months"
              class="h-8 w-32 bg-surface text-xs font-medium"
              @change="loadData"
            />

            <SelectField
              v-model="filterYear"
              :options="filterYearOptions"
              placeholder="All Years"
              class="h-8 w-28 bg-surface text-xs font-medium font-mono"
              @change="loadData"
            />
          </div>

          <div class="h-4 w-[1px] bg-border mx-1 hidden sm:block"></div>

          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-muted-foreground mr-1">Status:</span>
            <SelectField
              v-model="filterStatus"
              :options="filterStatusOptions"
              placeholder="All Statuses"
              class="h-8 w-32 bg-surface text-xs font-medium"
              @change="loadData"
            />
          </div>
        </div>

        <!-- Search & Refresh -->
        <div class="flex items-center gap-2">
          <div class="min-w-[200px] sm:min-w-[240px]">
            <Input
              v-model="search"
              type="text"
              placeholder="Search staff name or role…"
              class="h-8 text-xs bg-surface"
            >
              <template #prefix>
                <Search :size="13" />
              </template>
            </Input>
          </div>

          <Button variant="outline" size="sm" class="h-8 px-2.5 text-xs gap-1" :disabled="store.loading" @click="loadData">
            <RefreshCw :size="13" :class="{ 'animate-spin': store.loading }" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <!-- Bulk Action Bar when rows are selected -->
      <div v-if="selectedIds.size > 0" class="flex items-center justify-between pt-2 border-t border-border bg-primary/5 -mx-4 -mb-4 p-3 rounded-b-xl">
        <div class="flex items-center gap-2">
          <Badge variant="primary" class="font-mono text-xs">{{ selectedIds.size }} Selected</Badge>
          <span class="text-xs text-muted-foreground">Perform batch status operations on selected staff:</span>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="h-7 px-2.5 text-xs" @click="handleBulkStatus('FINALIZED')">
            Finalize Selected
          </Button>
          <Button variant="primary" size="sm" class="h-7 px-2.5 text-xs gap-1" @click="handleBulkStatus('PAID')">
            <CheckCircle2 :size="12" />
            <span>Mark Paid</span>
          </Button>
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-muted-foreground" @click="selectedIds.clear()">
            Clear
          </Button>
        </div>
      </div>
    </div>

    <!-- Payroll Records Table Container -->
    <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div v-if="store.loading && !filteredPayrolls.length" class="p-6 space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
      </div>

      <EmptyState
        v-else-if="!filteredPayrolls.length"
        :icon="Users"
        title="No payroll records found"
        description="No staff payroll entries found for the selected period or filter criteria."
      >
        <template #action>
          <Button variant="primary" size="sm" class="gap-1.5 mt-2" @click="showGenerateModal = true">
            <Plus :size="15" />
            <span>Generate Payroll</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40">
              <TableHead class="w-10 text-center">
                <input
                  type="checkbox"
                  class="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  :checked="selectedIds.size > 0 && selectedIds.size === filteredPayrolls.length"
                  @change="toggleSelectAll"
                />
              </TableHead>
              <TableHead>Staff Member</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="font-mono">Base Salary</TableHead>
              <TableHead class="font-mono">Commission / OT</TableHead>
              <TableHead class="font-mono">Deductions</TableHead>
              <TableHead class="font-mono text-right">Net Payout</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="p in filteredPayrolls"
              :key="p.id"
              :class="[
                'hover:bg-surface-subtle/80 transition-colors',
                selectedIds.has(p.id) && 'bg-primary/5'
              ]"
            >
              <!-- Checkbox -->
              <TableCell class="text-center">
                <input
                  type="checkbox"
                  class="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  :checked="selectedIds.has(p.id)"
                  @change="toggleSelectRow(p.id)"
                />
              </TableCell>

              <!-- Staff Info -->
              <TableCell>
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    {{ getStaffName(p).slice(0, 2).toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-semibold text-xs text-foreground">{{ getStaffName(p) }}</div>
                    <div class="text-3xs text-muted-foreground flex items-center gap-1.5">
                      <span>{{ getStaffRole(p) }}</span>
                      <span>•</span>
                      <span>{{ getStaffDept(p) }}</span>
                    </div>
                  </div>
                </div>
              </TableCell>

              <!-- Period -->
              <TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
                {{ p.period_start ? p.period_start : `${MONTH_NAMES[p.period_month - 1]} ${p.period_year}` }}
                <span v-if="p.period_end" class="text-3xs text-muted-foreground/70 block">→ {{ p.period_end }}</span>
              </TableCell>

              <!-- Status Badge -->
              <TableCell>
                <Badge :variant="statusBadge(p.status).variant" class="text-[10px] px-2 py-0.5 font-bold">
                  {{ statusBadge(p.status).label }}
                </Badge>
              </TableCell>

              <!-- Base Salary -->
              <TableCell class="font-mono text-xs tabular-nums text-foreground">
                {{ formatMoney(p.base_salary) }}
              </TableCell>

              <!-- Commission & OT -->
              <TableCell class="font-mono text-xs tabular-nums text-muted-foreground">
                <div class="flex items-center gap-1">
                  <Sparkles v-if="(p.sales_commission || 0) > 0" :size="11" class="text-amber-500" />
                  <span>{{ formatMoney((p.sales_commission || p.incentive_override || 0) + (p.overtime_pay || 0)) }}</span>
                </div>
              </TableCell>

              <!-- Deductions -->
              <TableCell class="font-mono text-xs tabular-nums text-destructive">
                <span v-if="(p.unpaid_leave_deduction || 0) + (p.tax_deduction || 0) > 0">
                  - {{ formatMoney((p.unpaid_leave_deduction || 0) + (p.tax_deduction || 0)) }}
                </span>
                <span v-else class="text-muted-foreground">$0.00</span>
              </TableCell>

              <!-- Net Payout -->
              <TableCell class="font-mono text-sm font-bold text-primary text-right tabular-nums">
                {{ formatMoney(p.total_net_pay || p.total_net) }}
              </TableCell>

              <!-- Actions -->
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <!-- Quick status change buttons -->
                  <Button
                    v-if="p.status === 'DRAFT'"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                    title="Finalize Payroll"
                    @click="quickTransition(p, 'FINALIZED')"
                  >
                    <Check :size="13" />
                  </Button>
                  <Button
                    v-else-if="p.status === 'FINALIZED'"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-500/10"
                    title="Mark as Paid"
                    @click="quickTransition(p, 'PAID')"
                  >
                    <CheckCircle2 :size="13" />
                  </Button>
                  <Button
                    v-else-if="p.status === 'PAID'"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs text-muted-foreground hover:bg-muted"
                    title="Reopen Draft"
                    @click="quickTransition(p, 'DRAFT')"
                  >
                    <RotateCcw :size="12" />
                  </Button>

                  <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" title="View / Edit Calculation" @click="openDetail(p)">
                    <Edit3 :size="13" />
                  </Button>

                  <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" title="Print Payslip" @click="openPayslip(p)">
                    <Printer :size="13" />
                  </Button>

                  <Button
                    v-if="p.status === 'DRAFT'"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                    title="Delete Draft"
                    @click="confirmDelete(p.id)"
                  >
                    <Trash2 :size="13" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- MODAL 1: GENERATE PAYROLL                                                 -->
    <!-- ========================================================================= -->
    <Dialog :open="showGenerateModal" @update:open="(val) => showGenerateModal = val">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="font-display">Generate Staff Payroll</DialogTitle>
          <DialogDescription>
            Compute salary, POS commission, benefits, and deductions for active personnel.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <!-- Month & Year Selectors -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Payroll Month *</label>
              <SelectField
                v-model="generateMonth"
                :options="generateMonthOptions"
                placeholder="Select Month"
                class="w-full h-9 bg-surface text-xs font-medium"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Payroll Year *</label>
              <SelectField
                v-model="generateYear"
                :options="generateYearOptions"
                placeholder="Select Year"
                class="w-full h-9 bg-surface text-xs font-mono"
              />
            </div>
          </div>

          <!-- Mode Selector Tabs -->
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1.5">Generation Scope</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                :class="[
                  'py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all',
                  generateMode === 'BATCH'
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-surface border-border text-muted-foreground hover:border-border/80'
                ]"
                @click="generateMode = 'BATCH'"
              >
                All Staff
              </button>
              <button
                type="button"
                :class="[
                  'py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all',
                  generateMode === 'MULTI'
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-surface border-border text-muted-foreground hover:border-border/80'
                ]"
                @click="generateMode = 'MULTI'"
              >
                Selected Staff
              </button>
              <button
                type="button"
                :class="[
                  'py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all',
                  generateMode === 'SINGLE'
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-surface border-border text-muted-foreground hover:border-border/80'
                ]"
                @click="generateMode = 'SINGLE'"
              >
                Single Staff
              </button>
            </div>
          </div>

          <!-- Mode-specific Content -->
          <div v-if="generateMode === 'BATCH'" class="p-3.5 rounded-xl border border-border bg-surface-subtle space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted-foreground">Total Active Personnel:</span>
              <span class="font-bold text-foreground font-mono">{{ activeStaffUsers.length }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted-foreground">Eligible for Generation:</span>
              <span class="font-bold text-emerald-600 font-mono">{{ eligibleStaffUsers.length }}</span>
            </div>
            <div v-if="existingPayrollStaffMap.size > 0" class="text-3xs text-muted-foreground pt-1 border-t border-border">
              {{ existingPayrollStaffMap.size }} staff already have payroll for this period and will be skipped to prevent duplicates.
            </div>
          </div>

          <div v-else-if="generateMode === 'MULTI'" class="space-y-2">
            <span class="text-xs text-muted-foreground block">Select staff members to generate:</span>
            <div class="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-surface">
              <div
                v-for="u in activeStaffUsers"
                :key="u.id"
                class="flex items-center justify-between p-2.5 hover:bg-surface-subtle transition-colors cursor-pointer"
                @click="() => {
                  if (multiSelectedStaffIds.has(u.id)) multiSelectedStaffIds.delete(u.id)
                  else multiSelectedStaffIds.add(u.id)
                }"
              >
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                    :checked="multiSelectedStaffIds.has(u.id)"
                  />
                  <div>
                    <span class="text-xs font-semibold text-foreground block">{{ u.name }}</span>
                    <span class="text-3xs text-muted-foreground">{{ u.role }} • {{ u.department || 'Operations' }}</span>
                  </div>
                </div>
                <Badge v-if="existingPayrollStaffMap.has(u.id)" variant="neutral" class="text-[9px]">Already Generated</Badge>
              </div>
            </div>
          </div>

          <div v-else-if="generateMode === 'SINGLE'" class="space-y-2">
            <label class="block text-xs font-semibold text-foreground">Select Staff Member *</label>
            <SelectField
              v-model="singleStaffId"
              :options="singleStaffOptions"
              placeholder="-- Choose Employee --"
              class="w-full h-9 bg-surface text-xs font-medium"
            />
            <Alert v-if="singleStaffId && existingPayrollStaffMap.has(singleStaffId)" variant="warning" class="text-xs py-2">
              Payroll has already been generated for this employee for {{ MONTH_NAMES[generateMonth - 1] }} {{ generateYear }}.
            </Alert>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isGenerating" @click="showGenerateModal = false">Cancel</Button>
          <Button variant="primary" :disabled="isGenerating" @click="handleGenerate">
            <span v-if="isGenerating" class="animate-spin mr-1.5">⏳</span>
            <span>{{ isGenerating ? 'Generating…' : 'Generate Payroll' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ========================================================================= -->
    <!-- MODAL 2: PAYROLL CALCULATION & DETAIL EDITOR                              -->
    <!-- ========================================================================= -->
    <Dialog :open="showDetailModal" @update:open="(val) => showDetailModal = val">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div class="flex items-center justify-between pr-4">
            <div>
              <DialogTitle class="font-display flex items-center gap-2">
                <span>{{ editingPayroll ? getStaffName(editingPayroll) : '' }}</span>
                <Badge :variant="statusBadge(editingPayroll?.status || 'DRAFT').variant" class="text-[10px] px-2 py-0.5">
                  {{ statusBadge(editingPayroll?.status || 'DRAFT').label }}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {{ editingPayroll ? `${MONTH_NAMES[editingPayroll.period_month - 1]} ${editingPayroll.period_year}` : '' }} • {{ editingPayroll ? getStaffRole(editingPayroll) : '' }}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div v-if="editingPayroll" class="py-3 space-y-4 text-xs">
          <!-- Status Banner -->
          <div
            :class="[
              'flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium border',
              editingPayroll.status === 'PAID'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : editingPayroll.status === 'FINALIZED'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-500'
            ]"
          >
            <CheckCircle2 v-if="editingPayroll.status === 'PAID'" :size="15" class="shrink-0 mt-0.5" />
            <Lock v-else-if="editingPayroll.status === 'FINALIZED'" :size="15" class="shrink-0 mt-0.5" />
            <Edit3 v-else :size="15" class="shrink-0 mt-0.5" />
            <span>
              <template v-if="editingPayroll.status === 'DRAFT'">
                <strong>Draft Mode</strong> — All fields are editable. Review the live payslip breakdown below.
              </template>
              <template v-else-if="editingPayroll.status === 'FINALIZED'">
                <strong>Finalized</strong> — Calculations are locked. Reopen as Draft to modify fields.
              </template>
              <template v-else>
                <strong>Paid &amp; Settled</strong> — This record is locked. Disbursed via {{ editingPayroll.payment_method || 'Cash' }}.
              </template>
            </span>
          </div>

          <!-- CARD 1: Working Days & Daily Rate -->
          <div class="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Calendar :size="14" class="text-primary" />
              <span>Working Days &amp; Daily Rate</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-lg border border-border bg-surface-subtle p-3">
                <span class="text-[10px] text-muted-foreground uppercase font-semibold block">Base Salary</span>
                <span class="font-bold text-sm text-foreground font-mono">{{ formatMoney(editingPayroll.base_salary) }}</span>
              </div>
              <div class="rounded-lg border border-primary/25 bg-primary/5 p-3">
                <span class="text-[10px] text-muted-foreground uppercase font-semibold block">Calculated Daily Rate</span>
                <span class="font-bold text-sm text-primary font-mono">{{ formatMoney(liveCalculations.dailyRate) }}/day</span>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1.5">Standard Working Days in Month</label>
              <Input
                v-model.number="workingDays"
                type="number"
                min="1"
                max="31"
                class="h-9 font-mono"
                :disabled="editingPayroll.status !== 'DRAFT'"
                placeholder="26"
              />
            </div>
          </div>

          <!-- CARD 2: Attendance, OT & Leave -->
          <div class="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Clock :size="14" class="text-primary" />
              <span>Attendance, OT &amp; Leave</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1.5">Overtime (Days)</label>
                <Input
                  v-model.number="otDays"
                  type="number"
                  min="0"
                  step="0.5"
                  class="h-9 font-mono"
                  :disabled="editingPayroll.status !== 'DRAFT'"
                  placeholder="0"
                />
                <span class="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1 font-medium">
                  +{{ formatMoney(liveCalculations.otPay) }} ({{ otDays }} days @ {{ formatMoney(liveCalculations.dailyRate) }})
                </span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1.5">Unpaid Leave (Days)</label>
                <Input
                  v-model.number="unpaidDays"
                  type="number"
                  min="0"
                  step="0.5"
                  class="h-9 font-mono"
                  :disabled="editingPayroll.status !== 'DRAFT'"
                  placeholder="0"
                />
                <span class="text-[10px] text-destructive block mt-1 font-medium">
                  -{{ formatMoney(liveCalculations.unpaidDeduction) }} ({{ unpaidDays }} days @ {{ formatMoney(liveCalculations.dailyRate) }})
                </span>
              </div>
            </div>
          </div>

          <!-- CARD 3: Sales Commission / Order Incentive -->
          <div class="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <TrendingUp :size="14" class="text-primary" />
              <span>Sales Commission / Order Incentive</span>
            </div>

            <div class="flex items-center gap-1.5 bg-surface border border-border rounded-lg p-1">
              <button
                type="button"
                :class="[
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-md transition-all',
                  incentiveMode === 'AUTO'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                ]"
                :disabled="editingPayroll.status !== 'DRAFT'"
                @click="incentiveMode = 'AUTO'"
              >
                <Zap :size="12" />
                Auto from Orders
              </button>
              <button
                type="button"
                :class="[
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-md transition-all',
                  incentiveMode === 'MANUAL'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                ]"
                :disabled="editingPayroll.status !== 'DRAFT'"
                @click="incentiveMode = 'MANUAL'"
              >
                <Edit3 :size="12" />
                Manual Override
              </button>
            </div>

            <div v-if="incentiveMode === 'AUTO'" class="rounded-lg border border-border bg-surface-subtle p-3 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted-foreground">Auto Calculated Commission:</span>
                <span class="font-bold text-emerald-600 font-mono">+{{ formatMoney(editingPayroll.sales_commission || 0) }}</span>
              </div>
              <p class="text-[10px] text-muted-foreground leading-relaxed">
                Tier-based on completed orders: $1–30: $0.25 • $30–50: $0.50 • $50–60: $0.75 • $60–80: $1.00 • &gt;$80: $2.00
              </p>
            </div>

            <div v-else class="space-y-1.5">
              <label class="block text-xs font-semibold text-foreground">Manual Incentive Amount ($)</label>
              <Input
                v-model.number="manualIncentive"
                type="number"
                min="0"
                step="5"
                class="h-9 font-mono"
                :disabled="editingPayroll.status !== 'DRAFT'"
                placeholder="0.00"
              />
            </div>
          </div>

          <!-- CARD 4: Benefits & Allowances (2×2 grid) -->
          <div class="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Gift :size="14" class="text-primary" />
              <span>Benefits &amp; Allowances</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <!-- Performance -->
              <div>
                <label class="flex items-center gap-1 text-xs font-semibold text-foreground mb-1.5">
                  <Trophy :size="11" class="text-amber-500" />
                  Performance
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">$</span>
                  <Input
                    v-model.number="perfBenefit"
                    type="number"
                    min="0"
                    step="5"
                    class="h-9 font-mono pl-6"
                    :disabled="editingPayroll.status !== 'DRAFT'"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <!-- Delivery / Gas -->
              <div>
                <label class="flex items-center gap-1 text-xs font-semibold text-foreground mb-1.5">
                  <Bike :size="11" class="text-primary" />
                  Delivery / Gas
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">$</span>
                  <Input
                    v-model.number="delivBenefit"
                    type="number"
                    min="0"
                    step="5"
                    class="h-9 font-mono pl-6"
                    :disabled="editingPayroll.status !== 'DRAFT'"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <!-- Collective -->
              <div>
                <label class="flex items-center gap-1 text-xs font-semibold text-foreground mb-1.5">
                  <Users :size="11" class="text-primary" />
                  Collective
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">$</span>
                  <Input
                    v-model.number="collecBenefit"
                    type="number"
                    min="0"
                    step="5"
                    class="h-9 font-mono pl-6"
                    :disabled="editingPayroll.status !== 'DRAFT'"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <!-- Other Benefits -->
              <div>
                <label class="flex items-center gap-1 text-xs font-semibold text-foreground mb-1.5">
                  <PlusCircle :size="11" class="text-primary" />
                  Other Benefits
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">$</span>
                  <Input
                    v-model.number="otherBenefit"
                    type="number"
                    min="0"
                    step="5"
                    class="h-9 font-mono pl-6"
                    :disabled="editingPayroll.status !== 'DRAFT'"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- CARD 5: 13th-Month Seniority Reserve Payout -->
          <div class="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Trophy :size="14" class="text-emerald-500" />
              <span>13th Month / Seniority Reserve Payout</span>
            </div>

            <!-- Reserve Balance Banner -->
            <div class="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3.5 py-2.5 gap-3">
              <div>
                <span class="text-[10px] text-muted-foreground uppercase font-semibold block">Accumulated Reserve Available</span>
                <span class="font-bold text-base text-emerald-600 font-mono">
                  {{ formatMoney(store.thirteenthMonthSummaries[editingPayroll.user_id]?.available_balance || 0) }}
                </span>
              </div>
              <span class="text-[10px] text-emerald-600 font-semibold bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-1 shrink-0">
                +{{ formatMoney(liveCalculations.thirteenthAccrual) }}/mo accrued
              </span>
            </div>

            <!-- Include Payout Toggle -->
            <div class="flex items-center justify-between gap-3 py-1">
              <div>
                <div class="text-xs font-semibold text-foreground">Include Payout in this Payroll</div>
                <div class="text-[10px] text-muted-foreground mt-0.5">E.g. Bi-annual Khmer New Year or Year-end disbursement</div>
              </div>
              <button
                type="button"
                :class="[
                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none',
                  includeThirteenthPayout ? 'bg-emerald-500' : 'bg-border',
                  editingPayroll.status !== 'DRAFT' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                ]"
                role="switch"
                :aria-checked="includeThirteenthPayout"
                :disabled="editingPayroll.status !== 'DRAFT'"
                @click="() => { if (editingPayroll!.status === 'DRAFT') includeThirteenthPayout = !includeThirteenthPayout }"
              >
                <span
                  :class="[
                    'pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform',
                    includeThirteenthPayout ? 'translate-x-4' : 'translate-x-0.5'
                  ]"
                />
              </button>
            </div>

            <div v-if="includeThirteenthPayout" class="space-y-2 pt-1 border-t border-border">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-foreground">Disbursement Amount ($)</label>
                <button
                  v-if="(store.thirteenthMonthSummaries[editingPayroll.user_id]?.available_balance || 0) > 0 && editingPayroll.status === 'DRAFT'"
                  type="button"
                  class="text-[10px] font-bold text-primary hover:underline"
                  @click="thirteenthPayoutAmount = store.thirteenthMonthSummaries[editingPayroll.user_id]?.available_balance || 0"
                >
                  Pay Full ({{ formatMoney(store.thirteenthMonthSummaries[editingPayroll.user_id]?.available_balance || 0) }})
                </button>
              </div>
              <Input
                v-model.number="thirteenthPayoutAmount"
                type="number"
                min="0"
                step="10"
                class="h-9 font-mono"
                :disabled="editingPayroll.status !== 'DRAFT'"
                placeholder="0.00"
              />
              <p class="text-[10px] text-muted-foreground">
                Remaining reserve for next cycle:
                <strong class="text-foreground">
                  {{ formatMoney(Math.max(0, (store.thirteenthMonthSummaries[editingPayroll.user_id]?.available_balance || 0) - (thirteenthPayoutAmount || 0))) }}
                </strong>
              </p>
            </div>
          </div>

          <!-- CARD 6: Live Payslip Breakdown -->
          <div class="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Receipt :size="14" class="text-primary" />
                <span>Live Payslip Breakdown</span>
              </div>
              <span class="text-[9px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">Live Math</span>
            </div>

            <div class="flex items-center justify-between py-1 border-b border-primary/10">
              <span class="text-xs text-muted-foreground">Base Monthly Salary</span>
              <span class="font-mono font-semibold text-foreground">{{ formatMoney(editingPayroll.base_salary) }}</span>
            </div>

            <div class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">
                Order Incentive {{ incentiveMode === 'MANUAL' ? '(Manual)' : '(Auto)' }}
              </span>
              <span class="font-mono font-semibold text-emerald-600">+{{ formatMoney(liveCalculations.commission) }}</span>
            </div>

            <div v-if="(perfBenefit || 0) > 0" class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">Performance Benefit</span>
              <span class="font-mono font-semibold text-emerald-600">+{{ formatMoney(perfBenefit) }}</span>
            </div>

            <div v-if="(delivBenefit || 0) > 0" class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">Delivery Benefit</span>
              <span class="font-mono font-semibold text-emerald-600">+{{ formatMoney(delivBenefit) }}</span>
            </div>

            <div v-if="(otDays || 0) > 0" class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">Overtime ({{ otDays }} days)</span>
              <span class="font-mono font-semibold text-emerald-600">+{{ formatMoney(liveCalculations.otPay) }}</span>
            </div>

            <div v-if="(collecBenefit || 0) > 0" class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">Collective Benefit</span>
              <span class="font-mono font-semibold text-emerald-600">+{{ formatMoney(collecBenefit) }}</span>
            </div>

            <div v-if="(otherBenefit || 0) > 0" class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">Other Benefits</span>
              <span class="font-mono font-semibold text-emerald-600">+{{ formatMoney(otherBenefit) }}</span>
            </div>

            <div
              v-if="includeThirteenthPayout && (thirteenthPayoutAmount || 0) > 0"
              class="flex items-center justify-between py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25"
            >
              <span class="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">🎁 13th Month / Seniority Payout</span>
              <span class="font-mono font-bold text-emerald-600">+{{ formatMoney(thirteenthPayoutAmount) }}</span>
            </div>

            <div v-if="(unpaidDays || 0) > 0" class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">Unpaid Leave ({{ unpaidDays }} days)</span>
              <span class="font-mono font-semibold text-destructive">-{{ formatMoney(liveCalculations.unpaidDeduction) }}</span>
            </div>

            <div v-if="(liveCalculations.tax || 0) > 0" class="flex items-center justify-between py-0.5">
              <span class="text-xs text-muted-foreground">Tax Deduction</span>
              <span class="font-mono font-semibold text-destructive">-{{ formatMoney(liveCalculations.tax) }}</span>
            </div>

            <div class="flex items-center justify-between py-1 border-t border-primary/15">
              <span class="text-[10px] text-muted-foreground italic">Monthly Accrual into Reserve Fund</span>
              <span class="font-mono text-[10px] text-muted-foreground">+{{ formatMoney(liveCalculations.thirteenthAccrual) }}/mo</span>
            </div>

            <!-- Grand Total Net Pay -->
            <div class="flex items-center justify-between py-3 px-4 rounded-xl bg-primary text-primary-foreground">
              <div>
                <span class="text-[11px] font-bold uppercase tracking-wider block">Total Net Pay</span>
                <span class="text-[9px] opacity-75">
                  Base + Benefits + OT{{ includeThirteenthPayout && (thirteenthPayoutAmount || 0) > 0 ? ' + 13th Payout' : '' }} &minus; Leave Deductions
                </span>
              </div>
              <span class="font-mono font-bold text-xl">{{ formatMoney(liveCalculations.net) }}</span>
            </div>
          </div>
        </div>

        <!-- Lifecycle-aware Action Bar -->
        <DialogFooter class="gap-2 mt-4 flex-wrap sm:flex-nowrap">
          <!-- DRAFT: Delete (left) | Save Draft | Finalize -->
          <template v-if="editingPayroll?.status === 'DRAFT'">
            <Button
              variant="outline"
              class="text-destructive border-destructive/40 hover:bg-destructive/8 gap-1 sm:mr-auto"
              :disabled="isSavingDetail"
              @click="() => { showDetailModal = false; confirmDelete(editingPayroll!.id) }"
            >
              <Trash2 :size="13" />
              Delete
            </Button>
            <Button variant="outline" :disabled="isSavingDetail" @click="handleSaveDetail('DRAFT')">
              Save Draft
            </Button>
            <Button variant="primary" class="gap-1" :disabled="isSavingDetail" @click="handleSaveDetail('FINALIZED')">
              <Lock :size="13" />
              <span>{{ isSavingDetail ? 'Saving…' : 'Finalize' }}</span>
            </Button>
          </template>

          <!-- FINALIZED: Close | Reopen Draft | Mark as Paid -->
          <template v-else-if="editingPayroll?.status === 'FINALIZED'">
            <Button variant="outline" @click="showDetailModal = false">Close</Button>
            <Button variant="outline" :disabled="isSavingDetail" class="gap-1" @click="handleSaveDetail('DRAFT')">
              <RotateCcw :size="13" />
              Reopen Draft
            </Button>
            <Button
              class="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              :disabled="isSavingDetail"
              @click="handleSaveDetail('PAID')"
            >
              <Banknote :size="14" />
              <span>{{ isSavingDetail ? 'Processing…' : 'Mark as Paid' }}</span>
            </Button>
          </template>

          <!-- PAID: Done -->
          <template v-else-if="editingPayroll?.status === 'PAID'">
            <Button variant="primary" class="w-full sm:w-auto" @click="showDetailModal = false">Done</Button>
          </template>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ========================================================================= -->
    <!-- MODAL 3: STAFF BASE SALARY RATES                                          -->
    <!-- ========================================================================= -->
    <Dialog :open="showSalaryModal" @update:open="(val) => showSalaryModal = val">
      <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="font-display">Staff Base Salary Rates</DialogTitle>
          <DialogDescription>
            Configure monthly base pay in USD across all active staff profiles.
          </DialogDescription>
        </DialogHeader>

        <div class="py-2 space-y-2 text-xs">
          <div class="rounded-lg border border-border divide-y divide-border bg-surface">
            <div
              v-for="u in activeStaffUsers"
              :key="u.id"
              class="flex items-center justify-between p-3 gap-3"
            >
              <div>
                <div class="font-semibold text-foreground text-xs">{{ u.name }}</div>
                <div class="text-3xs text-muted-foreground">{{ u.role }} • {{ u.department || 'Operations' }}</div>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground font-mono">$</span>
                <Input
                  v-model.number="salaryDrafts[u.id]"
                  type="number"
                  min="0"
                  step="10"
                  placeholder="e.g. 500"
                  class="h-8 w-28 text-xs font-mono font-bold"
                />
                <Button
                  variant="primary"
                  size="sm"
                  class="h-8 px-2.5 text-xs"
                  :disabled="salarySavingUser === u.id"
                  @click="saveSalaryForUser(u.id)"
                >
                  <span v-if="salarySavingUser === u.id">⏳</span>
                  <span v-else>Save</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showSalaryModal = false">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ========================================================================= -->
    <!-- MODAL 4: 13th-MONTH SENIORITY RESERVES                                    -->
    <!-- ========================================================================= -->
    <Dialog :open="showThirteenthModal" @update:open="(val) => showThirteenthModal = val">
      <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <Gift :size="18" class="text-primary" />
            <span>13th-Month Seniority Reserves</span>
          </DialogTitle>
          <DialogDescription>
            Cumulative monthly seniority accruals (base salary ÷ 12 per month) and standalone bonus disbursements.
          </DialogDescription>
        </DialogHeader>

        <div class="py-2 space-y-2 text-xs">
          <div class="rounded-lg border border-border divide-y divide-border bg-surface">
            <div
              v-for="u in activeStaffUsers"
              :key="u.id"
              class="flex items-center justify-between p-3 gap-3"
            >
              <div>
                <div class="font-semibold text-foreground text-xs">{{ u.name }}</div>
                <div class="text-3xs text-muted-foreground">
                  Accrued: {{ formatMoney(store.thirteenthMonthSummaries[u.id]?.total_accrued || 0) }} • Paid: {{ formatMoney(store.thirteenthMonthSummaries[u.id]?.total_paid_out || store.thirteenthMonthSummaries[u.id]?.total_disbursed || 0) }}
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="text-right">
                  <span class="text-3xs text-muted-foreground block font-semibold">Available</span>
                  <span class="font-bold text-xs font-mono text-primary">
                    {{ formatMoney(store.thirteenthMonthSummaries[u.id]?.available_balance || 0) }}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-xs gap-1"
                  @click="openStandalonePayout(u.id)"
                >
                  <Gift :size="12" />
                  <span>Disburse</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showThirteenthModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Standalone Payout Dialog -->
    <Dialog :open="showStandaloneModal" @update:open="(val) => showStandaloneModal = val">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display">Record Standalone Bonus</DialogTitle>
          <DialogDescription>
            Disburse seniority bonus (e.g. Khmer New Year or Year-End bonus).
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2 text-xs">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Payout Amount ($) *</label>
            <Input v-model.number="standaloneAmount" type="number" min="1" step="10" class="h-9 font-mono" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Purpose / Notes</label>
            <Input v-model="standaloneNotes" class="h-9" placeholder="e.g. Khmer New Year bonus" />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" :disabled="isSavingStandalone" @click="showStandaloneModal = false">Cancel</Button>
          <Button variant="primary" :disabled="isSavingStandalone" @click="handleSaveStandalone">
            <span v-if="isSavingStandalone">⏳</span>
            <span v-else>Record Payout</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ========================================================================= -->
    <!-- MODAL 5: DIGITAL PAYSLIP / PRINT PREVIEW                                  -->
    <!-- ========================================================================= -->
    <Dialog :open="showPayslipModal" @update:open="(val) => showPayslipModal = val">
      <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div class="flex items-center justify-between pr-4">
            <DialogTitle class="font-display">Staff Payslip Slip</DialogTitle>
            <div class="flex items-center gap-1 bg-surface border border-border rounded-md p-0.5 text-3xs">
              <button
                type="button"
                :class="['px-2 py-0.5 rounded font-semibold', payslipFormat === 'A4' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground']"
                @click="payslipFormat = 'A4'"
              >
                A4 Slip
              </button>
              <button
                type="button"
                :class="['px-2 py-0.5 rounded font-semibold', payslipFormat === 'THERMAL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground']"
                @click="payslipFormat = 'THERMAL'"
              >
                Thermal (80mm)
              </button>
            </div>
          </div>
        </DialogHeader>

        <div v-if="payslipPayroll" id="printable-payslip" class="p-4 rounded-xl border border-border bg-white text-slate-900 font-sans space-y-3">
          <!-- Header -->
          <div class="text-center border-b border-slate-200 pb-3">
            <h2 class="font-bold text-base tracking-tight uppercase">Salary Payslip</h2>
            <div class="text-xs text-slate-500 font-medium">
              Period: {{ MONTH_NAMES[payslipPayroll.period_month - 1] }} {{ payslipPayroll.period_year }}
            </div>
          </div>

          <!-- Staff Details -->
          <div class="grid grid-cols-2 gap-2 text-xs py-1 border-b border-slate-200">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Employee</span>
              <span class="font-bold text-slate-800">{{ getStaffName(payslipPayroll) }}</span>
            </div>
            <div class="text-right">
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Role / Dept</span>
              <span class="font-semibold text-slate-700">{{ getStaffRole(payslipPayroll) }}</span>
            </div>
          </div>

          <!-- Earnings Table -->
          <div class="space-y-1 text-xs">
            <div class="font-bold text-[11px] text-slate-700 uppercase tracking-wider">Earnings</div>
            <div class="flex justify-between py-0.5">
              <span class="text-slate-600">Base Salary:</span>
              <span class="font-mono font-semibold">{{ formatMoney(payslipPayroll.base_salary) }}</span>
            </div>
            <div v-if="(payslipPayroll.overtime_pay || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Overtime Pay ({{ payslipPayroll.overtime_days }}d):</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.overtime_pay) }}</span>
            </div>
            <div v-if="(payslipPayroll.sales_commission || payslipPayroll.incentive_override || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Sales Commission:</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.sales_commission || payslipPayroll.incentive_override) }}</span>
            </div>
            <div v-if="(payslipPayroll.performance_benefit || 0) + (payslipPayroll.delivery_benefit || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Benefits & Allowances:</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney((payslipPayroll.performance_benefit || 0) + (payslipPayroll.delivery_benefit || 0)) }}</span>
            </div>
          </div>

          <!-- Deductions -->
          <div v-if="(payslipPayroll.unpaid_leave_deduction || 0) + (payslipPayroll.tax_deduction || 0) > 0" class="space-y-1 text-xs border-t border-slate-200 pt-2">
            <div class="font-bold text-[11px] text-slate-700 uppercase tracking-wider">Deductions</div>
            <div v-if="(payslipPayroll.unpaid_leave_deduction || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Unpaid Leave ({{ payslipPayroll.unpaid_leave_days }}d):</span>
              <span class="font-mono font-semibold text-rose-600">- {{ formatMoney(payslipPayroll.unpaid_leave_deduction) }}</span>
            </div>
          </div>

          <!-- Total Net -->
          <div class="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-sm font-bold">
            <span class="uppercase tracking-wider">Net Amount Paid:</span>
            <span class="text-base font-mono text-emerald-700">{{ formatMoney(payslipPayroll.total_net_pay || payslipPayroll.total_net) }}</span>
          </div>

          <!-- Signature Section for A4 -->
          <div v-if="payslipFormat === 'A4'" class="grid grid-cols-2 gap-6 pt-6 mt-4 border-t border-slate-200 text-center text-3xs text-slate-500">
            <div>
              <div class="h-10 border-b border-slate-300"></div>
              <span class="mt-1 block">Prepared By (Admin)</span>
            </div>
            <div>
              <div class="h-10 border-b border-slate-300"></div>
              <span class="mt-1 block">Employee Signature</span>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" @click="showPayslipModal = false">Close</Button>
          <Button variant="primary" class="gap-1.5" @click="triggerPrint">
            <Printer :size="14" />
            <span>Print Payslip</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="isDeleteDialogOpen" @update:open="(val) => { isDeleteDialogOpen = val; if (!val) cancelDelete(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Payroll Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this payroll record? This action cannot be undone.
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
