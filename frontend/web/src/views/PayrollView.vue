<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { usePayrollStore, type Payroll, type StaffThirteenthMonthReserve } from '@/stores/payrollStore'
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
  History,
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

// Sub-Tab Navigation
const activeMainTab = ref<'MONTHLY' | 'RESERVES'>('MONTHLY')
const reservesSearch = ref('')
const reservesYear = ref<number | 'ALL'>(currentYear)
const reservesMonth = ref<number | 'ALL'>('ALL')
const historyStaff = ref<StaffThirteenthMonthReserve | null>(null)
const showHistoryModal = ref(false)

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

// Available years (dynamically computed from current date, history, and reserves)
const availableYears = computed(() => {
  const curr = new Date().getFullYear()
  const years = new Set<number>([curr + 1, curr, curr - 1, curr - 2, curr - 3])
  for (const p of store.payrolls) {
    if (p.period_year) years.add(Number(p.period_year))
  }
  const staff = store.companyReserves?.staff || []
  for (const s of staff) {
    for (const b of (s.monthly_breakdown || [])) {
      if (b.year) years.add(Number(b.year))
    }
    for (const p of (s.payouts || [])) {
      if (p.payout_date) {
        const y = new Date(p.payout_date).getFullYear()
        if (!isNaN(y)) years.add(y)
      }
    }
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
  filteredPayrolls.value.reduce((sum, p) => sum + (parseFloat(String(p.incentive_override ?? p.sales_commission ?? p.incentive_amount ?? 0)) || 0), 0)
)
const totalThirteenthAccrual = computed(() =>
  filteredPayrolls.value.reduce((sum, p) => sum + (parseFloat(String(p.thirteenth_month_contribution ?? p.thirteenth_month_accrual ?? 0)) || 0), 0)
)

// Active staff members
const activeStaffUsers = computed(() => {
  return (userStore.users || []).filter(u => {
    // Backend returns status as 'ACTIVE'/'INACTIVE' (uppercase) — compare case-insensitively
    const isActive = (u as any).is_active === true
      || String(u.status).toUpperCase() === 'ACTIVE'
      || (!u.status && !(u as any).is_active === false)
    // Exclude super_admin and test accounts from payroll
    const role = String(u.role || '').toUpperCase().replace(/[-\s]/g, '_')
    const notAdmin = role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN'
    const notTest = !(u as any).is_test_account && !(u as any).isTestAccount
    return isActive && notAdmin && notTest
  })
})

// Period Date Calculation (accurately calculates last day of each month)
function getPeriodRange(year: number | string, month: number | string) {
  const y = Number(year) || currentYear
  const m = Number(month) || currentMonth
  const lastDay = new Date(y, m, 0).getDate()
  const mStr = String(m).padStart(2, '0')
  const start = `${y}-${mStr}-01`
  const end = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`
  const monthName = MONTH_NAMES[m - 1] || `Month ${m}`
  return { start, end, lastDay, label: `${monthName} ${y}`, formatted: `${start} → ${end}` }
}

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
    commission = editingPayroll.value.incentive_override !== null && editingPayroll.value.incentive_override !== undefined
      ? (editingPayroll.value.incentive_override || 0)
      : (editingPayroll.value.sales_commission ?? editingPayroll.value.incentive_amount ?? 0)
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
const selectedPayrolls = computed(() => {
  return (filteredPayrolls.value || []).filter(p => selectedIds.value.has(p.id))
})

const selectedDraftCount = computed(() => {
  return selectedPayrolls.value.filter(p => p.status === 'DRAFT').length
})

const selectedFinalizedCount = computed(() => {
  return selectedPayrolls.value.filter(p => p.status === 'FINALIZED').length
})

const selectedPaidCount = computed(() => {
  return selectedPayrolls.value.filter(p => p.status === 'PAID').length
})

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
async function handleBulkStatus(targetStatus: 'FINALIZED' | 'PAID' | 'DRAFT') {
  let eligibleIds: string[] = []
  if (targetStatus === 'FINALIZED') {
    // Only DRAFT rows can be finalized
    eligibleIds = selectedPayrolls.value.filter(p => p.status === 'DRAFT').map(p => p.id)
    if (!eligibleIds.length) {
      toast.info('No draft payrolls selected to finalize.')
      return
    }
  } else if (targetStatus === 'PAID') {
    // Only FINALIZED rows can be marked paid
    eligibleIds = selectedPayrolls.value.filter(p => p.status === 'FINALIZED').map(p => p.id)
    if (!eligibleIds.length) {
      toast.info('No finalized payrolls selected to mark as paid.')
      return
    }
  } else if (targetStatus === 'DRAFT') {
    // Only FINALIZED rows can be reopened to draft
    eligibleIds = selectedPayrolls.value.filter(p => p.status === 'FINALIZED').map(p => p.id)
    if (!eligibleIds.length) {
      toast.info('No finalized payrolls selected to reopen.')
      return
    }
  }

  try {
    await store.bulkUpdateStatus(eligibleIds, targetStatus)
    toast.success(`Updated ${eligibleIds.length} payroll(s) to ${targetStatus}`)
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
    manualIncentive.value = p.sales_commission || p.incentive_amount || 0
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
  if (editingPayroll.value.status === 'PAID') {
    toast.error('Paid payrolls are settled and cannot be modified or reopened.')
    return
  }

  isSavingDetail.value = true
  try {
    if (editingPayroll.value.status === 'FINALIZED') {
      // Finalized payrolls only permit status transitions (e.g. reopen as DRAFT or mark as PAID)
      await store.updatePayroll(editingPayroll.value.id, { status: targetStatus })
      toast.success(`Payroll ${targetStatus === 'DRAFT' ? 'reopened as Draft' : 'marked as Paid'}`)
    } else {
      // Draft payrolls can update all calculation inputs and status
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
    }
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
  if (p.status === 'PAID') {
    toast.error('Paid payroll is settled and locked. It cannot be reopened.')
    return
  }
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

// 13th-Month Reserves Tab Handlers
async function switchTabToReserves() {
  activeMainTab.value = 'RESERVES'
  await store.fetchCompanyReserves(reservesYear.value, reservesMonth.value)
}

function openStaffHistory(staff: StaffThirteenthMonthReserve) {
  historyStaff.value = staff
  showHistoryModal.value = true
}

const filteredCompanyStaffReserves = computed(() => {
  const list = store.companyReserves?.staff || []
  const q = reservesSearch.value.toLowerCase().trim()
  if (!q) return list
  return list.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.department || '').toLowerCase().includes(q) ||
    (s.role || '').toLowerCase().includes(q) ||
    (s.email || '').toLowerCase().includes(q)
  )
})

// Open 13th-Month Reserve Modal
function openThirteenthModal() {
  for (const u of activeStaffUsers.value) {
    store.fetchThirteenthMonthSavings(u.id)
  }
  showThirteenthModal.value = true
}

function openStandalonePayout(userId: string, customAmount?: number) {
  standaloneUserId.value = userId
  if (customAmount !== undefined) {
    standaloneAmount.value = customAmount
  } else {
    const summary = store.thirteenthMonthSummaries[userId]
    const reserveStaff = store.companyReserves?.staff?.find(s => s.user_id === userId)
    standaloneAmount.value = summary?.available_balance ?? reserveStaff?.available_balance ?? 0
  }
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
      fiscal_year: reservesYear.value !== 'ALL' ? Number(reservesYear.value) : currentYear,
    })
    toast.success('Standalone bonus payout recorded')
    showStandaloneModal.value = false
    await Promise.allSettled([
      store.fetchThirteenthMonthSavings(standaloneUserId.value),
      store.fetchCompanyReserves(reservesYear.value, reservesMonth.value),
      loadData(),
    ])
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

watch([reservesYear, reservesMonth], ([newYear, newMonth]) => {
  store.fetchCompanyReserves(newYear, newMonth)
})

onMounted(async () => {
  await loadData()
  store.fetchCompanyReserves(reservesYear.value, reservesMonth.value)
})
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

    <!-- Sub-Tab Segment Switcher -->
    <div class="flex items-center gap-2 border-b border-border pb-2">
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
        :class="activeMainTab === 'MONTHLY' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'"
        @click="activeMainTab = 'MONTHLY'"
      >
        <Calendar :size="16" />
        <span>Monthly Payroll</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
        :class="activeMainTab === 'RESERVES' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'"
        @click="switchTabToReserves"
      >
        <Gift :size="16" />
        <span>13th-Month & Seniority Reserves</span>
        <Badge v-if="store.companyReserves?.staff?.length" variant="secondary" class="ml-1 text-[10px] px-1.5 py-0">
          {{ store.companyReserves.staff.length }}
        </Badge>
      </button>
    </div>

    <!-- VIEW 1: MONTHLY PAYROLL -->
    <template v-if="activeMainTab === 'MONTHLY'">
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
        <div v-if="selectedIds.size > 0" class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border bg-primary/5 -mx-4 -mb-4 p-3 rounded-b-xl">
          <div class="flex items-center gap-2 flex-wrap">
            <Badge variant="primary" class="font-mono text-xs font-bold">{{ selectedIds.size }} Selected</Badge>
            <div class="flex items-center gap-1.5 text-xs">
              <span v-if="selectedDraftCount > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[11px]">
                {{ selectedDraftCount }} Draft
              </span>
              <span v-if="selectedFinalizedCount > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-info-bg text-info-text border border-info-border font-mono text-[11px]">
                {{ selectedFinalizedCount }} Finalized
              </span>
              <span v-if="selectedPaidCount > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success-bg text-success-text border border-success-border font-mono text-[11px]">
                {{ selectedPaidCount }} Paid (Locked)
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Finalize Drafts Button -->
            <Button
              v-if="selectedDraftCount > 0"
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1 font-medium"
              @click="handleBulkStatus('FINALIZED')"
            >
              <Check :size="12" />
              <span>Finalize {{ selectedDraftCount }} Draft{{ selectedDraftCount > 1 ? 's' : '' }}</span>
            </Button>

            <!-- Reopen Finalized as Draft Button -->
            <Button
              v-if="selectedFinalizedCount > 0"
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 font-medium"
              @click="handleBulkStatus('DRAFT')"
            >
              <RotateCcw :size="12" />
              <span>Reopen {{ selectedFinalizedCount }} Finalized</span>
            </Button>

            <!-- Mark Paid Button -->
            <Button
              v-if="selectedFinalizedCount > 0"
              variant="primary"
              size="sm"
              class="h-7 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-xs font-semibold"
              @click="handleBulkStatus('PAID')"
            >
              <CheckCircle2 :size="12" />
              <span>Mark {{ selectedFinalizedCount }} Paid</span>
            </Button>

            <!-- When all selected are PAID -->
            <span v-if="selectedDraftCount === 0 && selectedFinalizedCount === 0 && selectedPaidCount > 0" class="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              All selected records are already settled & locked
            </span>

            <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" @click="selectedIds.clear()">
              Clear Selection
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
                      <div class="text-3xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>{{ getStaffRole(p) }}</span>
                        <span>•</span>
                        <span>{{ getStaffDept(p) }}</span>
                        <template v-if="p.user?.is_on_probation">
                          <span>•</span>
                          <Badge variant="warning" class="text-[9.5px] px-1.5 py-0 font-medium leading-tight">
                            Probation
                          </Badge>
                        </template>
                      </div>
                    </div>
                  </div>
                </TableCell>

                <!-- Period -->
                <TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  <div class="font-medium text-foreground">
                    {{ (p.period_month && p.period_year) ? `${MONTH_NAMES[p.period_month - 1]} ${p.period_year}` : (p.period_start ? `${p.period_start} → ${p.period_end}` : '—') }}
                  </div>
                  <div v-if="p.period_start && p.period_end" class="text-3xs text-muted-foreground opacity-80">
                    {{ p.period_start }} → {{ p.period_end }}
                  </div>
                </TableCell>

                <!-- Status -->
                <TableCell>
                  <Badge :variant="statusBadge(p.status).variant" class="text-3xs font-semibold">
                    {{ statusBadge(p.status).label }}
                  </Badge>
                </TableCell>

                <!-- Base Salary -->
                <TableCell class="font-mono text-xs font-medium text-foreground">
                  {{ formatMoney(p.base_salary) }}
                </TableCell>

                <!-- Commission / OT -->
                <TableCell class="font-mono text-xs">
                  <div class="flex flex-col gap-0.5">
                    <span v-if="p.incentive_override ?? p.sales_commission ?? p.incentive_amount" class="text-amber-600 dark:text-amber-400 font-medium">
                      +{{ formatMoney(p.incentive_override ?? p.sales_commission ?? p.incentive_amount) }} comm
                    </span>
                    <span v-if="p.overtime_amount ?? p.overtime_pay" class="text-indigo-600 dark:text-indigo-400">
                      +{{ formatMoney(p.overtime_amount ?? p.overtime_pay) }} OT
                    </span>
                    <span v-if="!(p.incentive_override ?? p.sales_commission ?? p.incentive_amount) && !(p.overtime_amount ?? p.overtime_pay)" class="text-muted-foreground">
                      —
                    </span>
                  </div>
                </TableCell>

                <!-- Deductions -->
                <TableCell class="font-mono text-xs">
                  <div class="flex flex-col gap-0.5">
                    <span v-if="p.unpaid_leave_deduction" class="text-rose-600 dark:text-rose-400">
                      -{{ formatMoney(p.unpaid_leave_deduction) }} leave
                    </span>
                    <span v-if="p.tax_deduction" class="text-rose-600 dark:text-rose-400">
                      -{{ formatMoney(p.tax_deduction) }} tax
                    </span>
                    <span v-if="!p.unpaid_leave_deduction && !p.tax_deduction" class="text-muted-foreground">
                      $0.00
                    </span>
                  </div>
                </TableCell>

                <!-- Net Payout -->
                <TableCell class="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right">
                  {{ formatMoney(p.total_net_pay || p.total_net) }}
                </TableCell>

                <!-- Row Actions -->
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <!-- DRAFT Row Actions: Finalize + Edit + Slip + Delete -->
                    <template v-if="p.status === 'DRAFT'">
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 px-2.5 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10 font-medium"
                        title="Finalize Payroll"
                        @click="quickTransition(p, 'FINALIZED')"
                      >
                        <Check :size="12" />
                        <span>Finalize</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        title="View / Edit Calculation"
                        @click="openDetail(p)"
                      >
                        <Edit3 :size="12" />
                        <span>Edit</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        title="Print Payslip"
                        @click="openPayslip(p)"
                      >
                        <Printer :size="12" />
                        <span>Slip</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        title="Delete Draft"
                        @click="confirmDelete(p.id)"
                      >
                        <Trash2 :size="13" />
                      </Button>
                    </template>

                    <!-- FINALIZED Row Actions: Reopen + Pay + View + Slip -->
                    <template v-else-if="p.status === 'FINALIZED'">
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground font-medium"
                        title="Reopen as Draft"
                        @click="quickTransition(p, 'DRAFT')"
                      >
                        <RotateCcw :size="12" />
                        <span>Reopen</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        class="h-7 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-xs font-semibold"
                        title="Mark as Paid"
                        @click="quickTransition(p, 'PAID')"
                      >
                        <CheckCircle2 :size="12" />
                        <span>Pay</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        title="View Calculation"
                        @click="openDetail(p)"
                      >
                        <Edit3 :size="12" />
                        <span>View</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        title="Print Payslip"
                        @click="openPayslip(p)"
                      >
                        <Printer :size="12" />
                        <span>Slip</span>
                      </Button>
                    </template>

                    <!-- PAID Row Actions: View + Payslip (No reopen, clean & easy to read) -->
                    <template v-else-if="p.status === 'PAID'">
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 px-2.5 text-xs gap-1 text-foreground border-border hover:bg-muted font-medium"
                        title="View Details"
                        @click="openDetail(p)"
                      >
                        <Edit3 :size="12" />
                        <span>View</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 px-2.5 text-xs gap-1 text-primary border-primary/20 hover:bg-primary/10 font-medium"
                        title="Print Payslip"
                        @click="openPayslip(p)"
                      >
                        <Printer :size="12" />
                        <span>Payslip</span>
                      </Button>
                    </template>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>

    <!-- VIEW 2: 13TH-MONTH RESERVES DASHBOARD & TABLE -->
    <template v-else-if="activeMainTab === 'RESERVES'">
      <!-- 13th-Month KPI Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Available Reserves"
          :value="formatMoney(store.companyReserves?.kpi?.company_total_available_balance)"
          sub="Company reserve liability pool"
          :icon="Gift"
          icon-variant="primary"
        />
        <StatCard
          label="Total Accrued YTD"
          :value="formatMoney(store.companyReserves?.kpi?.company_total_accrued)"
          sub="Total accumulated from monthly payroll"
          :icon="TrendingUp"
          icon-variant="success"
        />
        <StatCard
          label="Total Disbursed"
          :value="formatMoney(store.companyReserves?.kpi?.company_total_disbursed)"
          sub="Bonuses and payouts paid out"
          :icon="DollarSign"
          icon-variant="warning"
        />
        <StatCard
          label="Active Personnel"
          :value="store.companyReserves?.kpi?.eligible_staff_count || 0"
          sub="Eligible operational staff"
          :icon="Users"
          icon-variant="primary"
        />
      </div>

      <!-- 13th-Month Filter & Search Toolbar -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-muted-foreground mr-1">Period:</span>
            <SelectField
              v-model="reservesMonth"
              :options="filterMonthOptions"
              placeholder="All Months"
              class="h-8 w-32 bg-surface text-xs font-medium"
              @change="store.fetchCompanyReserves(reservesYear, reservesMonth)"
            />

            <SelectField
              v-model="reservesYear"
              :options="filterYearOptions"
              placeholder="All Years"
              class="h-8 w-28 bg-surface text-xs font-medium font-mono"
              @change="store.fetchCompanyReserves(reservesYear, reservesMonth)"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="min-w-[220px] sm:min-w-[280px]">
            <Input
              v-model="reservesSearch"
              type="text"
              placeholder="Search staff name or department…"
              class="h-8 text-xs bg-surface"
            >
              <template #prefix>
                <Search :size="13" />
              </template>
            </Input>
          </div>

          <Button
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs gap-1"
            :disabled="store.loadingReserves"
            @click="store.fetchCompanyReserves(reservesYear, reservesMonth)"
          >
            <RefreshCw :size="13" :class="{ 'animate-spin': store.loadingReserves }" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <!-- 13th-Month Reserves Table -->
      <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div v-if="store.loadingReserves && !filteredCompanyStaffReserves.length" class="p-6 space-y-3">
          <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
        </div>

        <EmptyState
          v-else-if="!filteredCompanyStaffReserves.length"
          :icon="Gift"
          title="No 13th-Month reserve records found"
          description="No active operational personnel matching your search criteria."
        />

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40">
                <TableHead>Staff Member</TableHead>
                <TableHead class="font-mono">Base Salary & Rate</TableHead>
                <TableHead>Accrual Progress & 12-Mo Schedule</TableHead>
                <TableHead class="font-mono">Accrued YTD</TableHead>
                <TableHead class="font-mono">Disbursed</TableHead>
                <TableHead class="font-mono text-right">Available Reserve</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="s in filteredCompanyStaffReserves"
                :key="s.user_id"
                class="hover:bg-surface-subtle/80 transition-colors"
              >
                <!-- Staff Info -->
                <TableCell>
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {{ (s.name || 'S').slice(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-semibold text-xs text-foreground">{{ s.name }}</div>
                      <div class="text-3xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span class="font-medium text-primary">{{ s.role }}</span>
                        <span>•</span>
                        <span>{{ s.department || 'General' }}</span>
                        <template v-if="s.is_on_probation">
                          <span>•</span>
                          <Badge variant="warning" class="text-[9.5px] px-1.5 py-0 font-medium leading-tight">
                            Probation (Mo {{ Math.min(3, (s.seniority_months ?? 0) + 1) }}/3)
                          </Badge>
                        </template>
                      </div>
                    </div>
                  </div>
                </TableCell>

                <!-- Base Salary & Accrual Rate -->
                <TableCell class="font-mono text-xs">
                  <div class="font-semibold text-foreground">{{ formatMoney(s.base_salary) }}</div>
                  <div class="text-[11px] text-muted-foreground flex items-center gap-1 font-normal">
                    <span v-if="s.is_on_probation" class="text-amber-600 font-medium">$0.00/mo (Probation)</span>
                    <span v-else class="text-primary font-medium">+{{ formatMoney(s.monthly_accrual) }}</span>/mo
                  </div>
                </TableCell>

                <!-- Accrual Progress & 12-Month Schedule -->
                <TableCell class="w-68">
                  <div class="flex flex-col gap-1.5 py-0.5">
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="font-medium text-foreground">
                        {{ s.months_accrued }}<span class="text-muted-foreground">/12 months</span>
                      </span>
                      <span class="font-mono font-semibold text-xs text-muted-foreground">
                        {{ Math.min(100, Math.round((s.months_accrued / 12) * 100)) }}%
                      </span>
                    </div>
                    <!-- Progress Track -->
                    <div class="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-300"
                        :class="s.months_accrued >= 12 ? 'bg-success' : 'bg-primary'"
                        :style="{ width: `${Math.min(100, Math.max(5, (s.months_accrued / 12) * 100))}%` }"
                      ></div>
                    </div>
                    <!-- 12-Month Indicator Matrix -->
                    <div class="flex items-center gap-1 pt-0.5">
                      <span
                        v-for="mIdx in 12"
                        :key="mIdx"
                        class="w-4.5 h-4.5 rounded text-[10px] flex items-center justify-center font-mono font-bold transition-colors"
                        :class="s.accrued_months?.includes(mIdx)
                          ? 'bg-primary text-primary-foreground shadow-2xs'
                          : 'bg-muted/60 text-muted-foreground/50 border border-border/40'"
                        :title="`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mIdx - 1]}: ${s.accrued_months?.includes(mIdx) ? 'Accrued' : 'Pending'}`"
                      >
                        {{ ['J','F','M','A','M','J','J','A','S','O','N','D'][mIdx - 1] }}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <!-- Accrued YTD -->
                <TableCell class="font-mono text-xs font-semibold">
                  <span class="text-success-text dark:text-success">+{{ formatMoney(s.total_accrued) }}</span>
                </TableCell>

                <!-- Disbursed -->
                <TableCell class="font-mono text-xs font-semibold">
                  <span v-if="s.total_disbursed > 0" class="text-warning-text dark:text-warning">-{{ formatMoney(s.total_disbursed) }}</span>
                  <span v-else class="text-muted-foreground/60 font-normal">$0.00</span>
                </TableCell>

                <!-- Available Reserve Balance -->
                <TableCell class="font-mono text-right">
                  <span
                    v-if="s.available_balance > 0"
                    class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-emerald-700 text-white dark:bg-emerald-600 dark:text-white shadow-2xs"
                  >
                    {{ formatMoney(s.available_balance) }}
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono text-muted-foreground/70 bg-muted/60"
                  >
                    $0.00
                  </span>
                </TableCell>

                <!-- Actions -->
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      class="h-8 px-3 text-xs gap-1 font-semibold"
                      :disabled="s.available_balance <= 0"
                      @click="openStandalonePayout(s.user_id, s.available_balance)"
                    >
                      <DollarSign :size="13" />
                      <span>Disburse Payout</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      class="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground font-medium"
                      @click="openStaffHistory(s)"
                    >
                      <History :size="13" />
                      <span>History ({{ s.payouts?.length || 0 }})</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>

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

          <!-- Target Period Range Banner -->
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle border border-border text-xs text-muted-foreground">
            <Calendar :size="13" class="text-primary shrink-0" />
            <span>Target Period: <strong class="font-mono text-foreground">{{ getPeriodRange(generateYear, generateMonth).start }} → {{ getPeriodRange(generateYear, generateMonth).end }}</strong> ({{ getPeriodRange(generateYear, generateMonth).lastDay }} days)</span>
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
                {{ editingPayroll ? `${getPeriodRange(editingPayroll.period_year, editingPayroll.period_month).formatted} (${MONTH_NAMES[editingPayroll.period_month - 1]} ${editingPayroll.period_year})` : '' }} • {{ editingPayroll ? getStaffRole(editingPayroll) : '' }}
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
                <span class="font-bold text-emerald-600 font-mono">+{{ formatMoney(editingPayroll.sales_commission ?? editingPayroll.incentive_amount ?? 0) }}</span>
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
              Period: {{ getPeriodRange(payslipPayroll.period_year, payslipPayroll.period_month).formatted }} ({{ MONTH_NAMES[payslipPayroll.period_month - 1] }} {{ payslipPayroll.period_year }})
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
              <span class="text-slate-600">Base Salary ({{ payslipPayroll.working_days || 26 }} working days):</span>
              <span class="font-mono font-semibold text-slate-900">{{ formatMoney(payslipPayroll.base_salary) }}</span>
            </div>
            <div v-if="(payslipPayroll.overtime_pay || payslipPayroll.overtime_amount || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Overtime Pay ({{ payslipPayroll.overtime_days || 0 }} days):</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.overtime_pay || payslipPayroll.overtime_amount) }}</span>
            </div>
            <div v-if="(payslipPayroll.incentive_override ?? payslipPayroll.sales_commission ?? payslipPayroll.incentive_amount ?? 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Sales Commission / Incentive:</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.incentive_override ?? payslipPayroll.sales_commission ?? payslipPayroll.incentive_amount) }}</span>
            </div>
            <div v-if="(payslipPayroll.performance_benefit || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Performance Benefit:</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.performance_benefit) }}</span>
            </div>
            <div v-if="(payslipPayroll.delivery_benefit || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Delivery Benefit:</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.delivery_benefit) }}</span>
            </div>
            <div v-if="(payslipPayroll.collective_benefit || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Collective Benefit:</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.collective_benefit) }}</span>
            </div>
            <div v-if="(payslipPayroll.other_benefits || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Other Benefits:</span>
              <span class="font-mono font-semibold text-emerald-600">+ {{ formatMoney(payslipPayroll.other_benefits) }}</span>
            </div>
            <div v-if="(payslipPayroll.thirteenth_month_payout || 0) > 0" class="flex justify-between py-1 bg-emerald-50 px-2 rounded border border-emerald-200">
              <span class="text-emerald-800 font-semibold">🎁 13th Month / Seniority Payout:</span>
              <span class="font-mono font-bold text-emerald-700">+ {{ formatMoney(payslipPayroll.thirteenth_month_payout) }}</span>
            </div>
          </div>

          <!-- Deductions -->
          <div v-if="(payslipPayroll.unpaid_leave_deduction || 0) + (payslipPayroll.tax_deduction || 0) > 0" class="space-y-1 text-xs border-t border-slate-200 pt-2">
            <div class="font-bold text-[11px] text-slate-700 uppercase tracking-wider">Deductions</div>
            <div v-if="(payslipPayroll.unpaid_leave_deduction || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Unpaid Leave ({{ payslipPayroll.unpaid_leave_days || 0 }} days):</span>
              <span class="font-mono font-semibold text-rose-600">- {{ formatMoney(payslipPayroll.unpaid_leave_deduction) }}</span>
            </div>
            <div v-if="(payslipPayroll.tax_deduction || 0) > 0" class="flex justify-between py-0.5">
              <span class="text-slate-600">Tax Deduction:</span>
              <span class="font-mono font-semibold text-rose-600">- {{ formatMoney(payslipPayroll.tax_deduction) }}</span>
            </div>
          </div>

          <!-- Monthly Accrual Info -->
          <div class="flex justify-between items-center py-1 border-t border-slate-100 text-[10px] text-slate-500 italic">
            <span>Monthly Seniority Accrual into Reserve Fund:</span>
            <span class="font-mono font-medium text-slate-600">+{{ formatMoney(payslipPayroll.thirteenth_month_contribution || payslipPayroll.thirteenth_month_accrual || Math.round((payslipPayroll.base_salary / 12) * 100) / 100) }}/mo</span>
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

    <!-- 13th-Month Staff Payout History Dialog -->
    <Dialog :open="showHistoryModal" @update:open="(val) => showHistoryModal = val">
      <DialogContent class="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <History :size="18" class="text-primary" />
            <span>13th-Month Payout History</span>
          </DialogTitle>
          <DialogDescription v-if="historyStaff">
            Past disbursements for <span class="font-semibold text-foreground">{{ historyStaff.name }}</span> ({{ historyStaff.role }} • {{ historyStaff.department || 'General' }})
          </DialogDescription>
        </DialogHeader>

        <div v-if="historyStaff" class="py-2 flex-1 overflow-y-auto space-y-3">
          <!-- Summary Badge Box -->
          <div class="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-lg border border-border text-center">
            <div>
              <span class="text-3xs text-muted-foreground block">Total Accrued</span>
              <span class="text-xs font-bold text-emerald-600 font-mono">+{{ formatMoney(historyStaff.total_accrued) }}</span>
            </div>
            <div>
              <span class="text-3xs text-muted-foreground block">Disbursed</span>
              <span class="text-xs font-bold text-amber-600 font-mono">-{{ formatMoney(historyStaff.total_disbursed) }}</span>
            </div>
            <div>
              <span class="text-3xs text-muted-foreground block">Available</span>
              <span class="text-xs font-bold text-primary font-mono">{{ formatMoney(historyStaff.available_balance) }}</span>
            </div>
          </div>

          <!-- History List -->
          <div v-if="historyStaff.payouts && historyStaff.payouts.length > 0" class="divide-y divide-border border border-border rounded-lg bg-surface overflow-hidden">
            <div
              v-for="payout in historyStaff.payouts"
              :key="payout.id"
              class="p-3 flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <div class="font-semibold text-foreground flex items-center gap-2">
                  <span>{{ payout.payout_date ? new Date(payout.payout_date).toLocaleDateString() : 'N/A' }}</span>
                  <Badge variant="outline" class="text-[10px] px-1.5 py-0">{{ payout.payment_method || 'Cash' }}</Badge>
                </div>
                <div class="text-muted-foreground text-3xs mt-0.5">{{ payout.notes || '13th Month / Seniority Payout' }}</div>
              </div>
              <div class="font-mono font-bold text-amber-600 text-sm text-right">
                -{{ formatMoney(payout.amount) }}
              </div>
            </div>
          </div>

          <div v-else class="text-center py-6 text-muted-foreground text-xs italic">
            No past payout disbursements recorded for this employee yet.
          </div>
        </div>

        <DialogFooter class="mt-2">
          <Button variant="outline" @click="showHistoryModal = false">Close</Button>
          <Button
            v-if="historyStaff && historyStaff.available_balance > 0"
            variant="primary"
            class="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            @click="() => { const uid = historyStaff?.user_id; const bal = historyStaff?.available_balance; showHistoryModal = false; if (uid) openStandalonePayout(uid, bal); }"
          >
            <DollarSign :size="14" />
            <span>Disburse Payout</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
