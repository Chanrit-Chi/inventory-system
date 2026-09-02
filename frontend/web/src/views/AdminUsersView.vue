<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import api, { ApiError } from '@/api/axios'
import { useToast } from '@/composables/useToast'
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Plus,
  Search,
  Edit2,
  Trash2,
  UserCheck,
  Phone,
  Key,
  Check,
  Calculator,
  Briefcase,
  DollarSign,
  TrendingUp,
  BarChart2,
  Lock,
} from 'lucide-vue-next'
import {
  Button,
  Badge,
  Input,
  Switch,
  StatCard,
  Card,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  EmptyState,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DatePicker,
  SelectField,
} from '@/components/ui'

const router = useRouter()
const toast = useToast()

// --- Types ---
type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER'

interface UserStats {
  total_orders?: number
  total_sales?: number
  total_net_paid?: number
}

interface UserAccount {
  id: string
  name: string
  email: string
  phone?: string | null
  role: UserRole
  department?: string | null
  hire_date?: string | null
  notes?: string | null
  base_salary?: number | string | null
  salary_reason?: string | null
  is_active: boolean
  isActive?: boolean
  status?: 'ACTIVE' | 'INACTIVE' | string
  stats?: UserStats
  created_at?: string
  updated_at?: string
}

interface AuditLogEntry {
  id: string
  action: string
  category?: string
  target: string
  by: string
  time: string
  created_at?: string
  details?: string
  ip?: string
  device?: string
}

interface AuditLogApiResponse {
  data?: AuditLogEntry[]
  meta?: {
    current_page: number
    last_page: number
    total: number
  }
}

interface PermissionGroup {
  id: string
  name: string
  slug: UserRole
  description: string
  permissions: string[]
  userCount: number
}

type TabKey = 'staff' | 'permissions' | 'audit'
type AuditCategory =
  | 'ALL'
  | 'Auth'
  | 'Products'
  | 'Orders'
  | 'Customers'
  | 'Expenses'
  | 'Payroll'
  | 'System'

// --- Tabs ---
const activeTab = ref<TabKey>('staff')

// --- Staff State ---
const users = ref<UserAccount[]>([])
const usersLoading = ref(false)
const usersError = ref('')
const userSearch = ref('')

// Form Modal State
const isFormModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const isDetailModalOpen = ref(false)
const isRaiseModalOpen = ref(false)

const editingUser = ref<UserAccount | null>(null)
const deletingUser = ref<UserAccount | null>(null)
const detailUser = ref<UserAccount | null>(null)

const formSaving = ref(false)
const formError = ref('')
const fieldErrors = reactive<Record<string, string>>({})
const deleteLoading = ref(false)
const toggleLoadingId = ref<string>('')

// Password & Copy helpers in Form
const showPassword = ref(false)
const copiedPassword = ref(false)

function generateSecureTemporaryPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  let res = ''
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return res
}

const emptyForm = () => ({
  name: '',
  email: '',
  phone: '',
  role: 'SELLER' as UserRole,
  department: '',
  hire_date: new Date().toISOString().slice(0, 10),
  base_salary: '',
  salary_reason: '',
  notes: '',
  password: '',
  is_active: true,
})

const userForm = reactive<ReturnType<typeof emptyForm>>(emptyForm())

// Live Compensation Accruals in Form
const formDailyRate = computed(() => {
  const sal = parseFloat(userForm.base_salary)
  if (isNaN(sal) || sal <= 0) return '0.00'
  return (sal / 26).toFixed(2)
})

const formThirteenthMonthAccrual = computed(() => {
  const sal = parseFloat(userForm.base_salary)
  if (isNaN(sal) || sal <= 0) return '0.00'
  return (sal / 12).toFixed(2)
})

// Raise Modal State
const raiseSalaryAmount = ref('')
const raiseReason = ref('Annual Performance Merit')
const raiseEffectiveDate = ref(new Date().toISOString().slice(0, 10))
const raiseSaving = ref(false)
const raiseError = ref('')

// Staff Detail Performance Tab State
const detailTab = ref<'overview' | 'performance' | 'salary'>('overview')
const perfPeriod = ref<'today' | '7d' | '30d' | 'month' | 'year'>('30d')
const perfData = ref<{
  total_orders: number
  total_sales: number
  total_revenue?: number
  average_ticket?: number
  total_incentive?: number
} | null>(null)
const perfLoading = ref(false)

// --- Audit Log State ---
const auditLogs = ref<AuditLogEntry[]>([])
const auditLoading = ref(false)
const auditLoadingMore = ref(false)
const auditError = ref('')
const auditPage = ref(1)
const auditLastPage = ref(1)
const auditTotal = ref(0)
const auditHasMore = computed(() => auditPage.value < auditLastPage.value)

const auditSearch = ref('')
const auditCategory = ref<AuditCategory>('ALL')
const auditDateFrom = ref('')
const auditDateTo = ref('')
const auditDatePreset = ref<'all' | 'today' | '7d' | '30d' | 'month' | 'custom'>('all')

const AUDIT_CATEGORIES: AuditCategory[] = [
  'ALL',
  'Auth',
  'Products',
  'Orders',
  'Customers',
  'Expenses',
  'Payroll',
  'System',
]

const auditCategoryOptions = computed(() => AUDIT_CATEGORIES.map(c => ({
  label: c === 'ALL' ? 'All Categories' : c,
  value: c,
})))

const auditDatePresetOptions = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'month' },
  { label: 'Custom Range', value: 'custom' },
]

const ROLE_OPTIONS: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER']
const roleSelectOptions = computed(() => ROLE_OPTIONS.map(r => ({ label: r, value: r })))

const DEPARTMENT_OPTIONS = [
  'Main Counter',
  'Inventory & Warehouse',
  'Sales Floor',
  'Management',
  'Finance & Accounting',
  'IT & Systems',
  'Delivery & Logistics',
  'Marketing',
]

const departmentSelectOptions = computed(() => [
  { label: '— Select Department —', value: '' },
  ...DEPARTMENT_OPTIONS.map(d => ({ label: d, value: d })),
])

// --- Permission Group Definitions ---
const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'grp-super-admin',
    name: 'Super Admin',
    slug: 'SUPER_ADMIN',
    description: 'Full unrestricted system-wide administrative access with root privileges',
    permissions: ['* (Root Wildcard - All Capabilities)'],
    userCount: 0,
  },
  {
    id: 'grp-admin',
    name: 'Administrator',
    slug: 'ADMIN',
    description: 'Operations administrator with broad system management and staff permissions',
    permissions: [
      'products:*',
      'suppliers:*',
      'purchase-orders:*',
      'inventory:*',
      'sales:*',
      'invoices:*',
      'quotations:*',
      'customers:*',
      'expenses:*',
      'payroll:*',
      'reports:*',
      'users:*',
      'roles:manage',
      'settings:*',
    ],
    userCount: 0,
  },
  {
    id: 'grp-manager',
    name: 'Store Manager',
    slug: 'MANAGER',
    description: 'Store manager handling inventory, suppliers, sales, and daily operations',
    permissions: [
      'products:read',
      'suppliers:view',
      'purchase-orders:*',
      'inventory:adjust',
      'inventory:restock',
      'pos:*',
      'sales:*',
      'invoices:*',
      'quotations:*',
      'customers:*',
      'expenses:*',
      'payroll:view',
      'reports:view',
      'reports:export',
    ],
    userCount: 0,
  },
  {
    id: 'grp-seller',
    name: 'Sales Floor / Cashier',
    slug: 'SELLER',
    description: 'Cashier & floor sales associate with POS, quotes, and catalog access',
    permissions: [
      'pos:checkout',
      'products:read',
      'inventory:scan',
      'quotations:create',
      'invoices:view',
      'invoices:record-payment',
      'customers:view',
      'transactions:view',
    ],
    userCount: 0,
  },
]

const groupsWithCounts = computed<PermissionGroup[]>(() =>
  PERMISSION_GROUPS.map(g => ({
    ...g,
    userCount: users.value.filter(u => u.role === g.slug).length,
  }))
)

// --- Computed: filtered staff ---
const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(u => {
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    )
  })
})

// --- Role & Status Normalization Helpers ---
function normalizeUserRole(raw: string | undefined | null): UserRole {
  const upper = String(raw || '').toUpperCase().trim()
  if (upper === 'SUPER_ADMIN' || upper === 'SUPERADMIN' || upper === 'SUPER-ADMIN' || upper === 'ROOT') {
    return 'SUPER_ADMIN'
  }
  if (upper === 'ADMIN' || upper === 'ADMINISTRATOR') {
    return 'ADMIN'
  }
  if (upper === 'MANAGER' || upper === 'STORE_MANAGER' || upper === 'STORE-MANAGER') {
    return 'MANAGER'
  }
  return 'SELLER'
}

function isUserActive(u: UserAccount | Record<string, unknown> | undefined | null): boolean {
  if (!u) return true
  if (u.status === 'INACTIVE' || u.status === 'inactive' || u.status === 'DEACTIVATED') return false
  if (u.is_active === false || u.isActive === false) return false
  return true
}

const activeUsersCount = computed(() => users.value.filter(u => isUserActive(u)).length)
const adminUsersCount = computed(() => users.value.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'MANAGER').length)
const totalPayrollBase = computed(() =>
  users.value.reduce((sum, u) => sum + (parseFloat(String(u.base_salary || 0)) || 0), 0)
)

// --- Helpers ---
function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function categoryIcon(cat: string | undefined): string {
  const c = (cat || '').toLowerCase()
  if (c.includes('auth') || c.includes('security')) return '🔐'
  if (c.includes('product')) return '🏷️'
  if (c.includes('inventory') || c.includes('stock')) return '📦'
  if (c.includes('order') || c.includes('sale')) return '🧾'
  if (c.includes('customer')) return '👥'
  if (c.includes('expense')) return '💰'
  if (c.includes('payroll')) return '💵'
  if (c.includes('system')) return '⚙️'
  if (c.includes('user') || c.includes('role') || c.includes('staff')) return '👤'
  return '📋'
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDateOnly(d: string | undefined | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtMoney(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '$0.00'
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return isNaN(val) ? '$0.00' : `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function clearFieldErrors() {
  Object.keys(fieldErrors).forEach(k => delete fieldErrors[k])
}

// Password Generator and Copy
function handleRegeneratePassword() {
  userForm.password = generateSecureTemporaryPassword(10)
  toast.info('Generated new secure temporary password')
}

async function handleCopyPassword() {
  if (!userForm.password) return
  try {
    await navigator.clipboard.writeText(userForm.password)
    copiedPassword.value = true
    toast.success('Password copied to clipboard')
    setTimeout(() => {
      copiedPassword.value = false
    }, 2000)
  } catch {
    toast.error('Failed to copy password to clipboard')
  }
}

// --- Staff API Calls ---
async function loadUsers() {
  usersLoading.value = true
  usersError.value = ''
  try {
    const res = await api.get('/users')
    const rawList = Array.isArray(res.data?.data)
      ? res.data.data
      : (Array.isArray(res.data) ? res.data : (res.data?.data?.data || []))

    users.value = rawList.map((u: Record<string, unknown>) => {
      const canonicalRole = normalizeUserRole(u.role as string)
      const active = isUserActive(u)
      return {
        ...u,
        role: canonicalRole,
        is_active: active,
        isActive: active,
        status: active ? 'ACTIVE' : 'INACTIVE',
      } as UserAccount
    })
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      usersError.value = e.message
    } else if (e instanceof Error) {
      usersError.value = e.message
    } else {
      usersError.value = 'Failed to load staff accounts.'
    }
    users.value = []
  } finally {
    usersLoading.value = false
  }
}

function openCreateModal() {
  editingUser.value = null
  Object.assign(userForm, emptyForm())
  userForm.password = generateSecureTemporaryPassword(10)
  showPassword.value = true
  clearFieldErrors()
  formError.value = ''
  isFormModalOpen.value = true
}

function openEditModal(user: UserAccount) {
  editingUser.value = user
  const canonicalRole = normalizeUserRole(user.role)
  const active = isUserActive(user)

  Object.assign(userForm, {
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    role: canonicalRole,
    department: user.department || '',
    hire_date: user.hire_date
      ? user.hire_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    base_salary:
      user.base_salary !== undefined && user.base_salary !== null && Number(user.base_salary) > 0
        ? String(user.base_salary)
        : '',
    salary_reason: user.salary_reason || '',
    notes: user.notes || '',
    password: '',
    is_active: active,
  })
  showPassword.value = false
  clearFieldErrors()
  formError.value = ''
  isFormModalOpen.value = true
}

function closeFormModal() {
  isFormModalOpen.value = false
  editingUser.value = null
  clearFieldErrors()
  formError.value = ''
}

function validateForm(): boolean {
  clearFieldErrors()
  if (!userForm.name.trim()) {
    fieldErrors.name = 'Full name is required.'
  }
  if (!userForm.email.trim()) {
    fieldErrors.email = 'Email address is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) {
    fieldErrors.email = 'Please enter a valid email address.'
  }
  if (!editingUser.value && (!userForm.password || userForm.password.length < 8)) {
    fieldErrors.password = 'Password must be at least 8 characters.'
  }
  if (userForm.base_salary && isNaN(parseFloat(userForm.base_salary))) {
    fieldErrors.base_salary = 'Base salary must be a valid number.'
  }
  return Object.keys(fieldErrors).length === 0
}

async function submitUserForm() {
  if (!validateForm()) return

  formSaving.value = true
  formError.value = ''
  clearFieldErrors()

  const parsedSalary =
    userForm.base_salary && !isNaN(parseFloat(userForm.base_salary))
      ? parseFloat(userForm.base_salary)
      : 0

  try {
    if (editingUser.value) {
      const payload: Record<string, unknown> = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim() || null,
        role: userForm.role,
        department: userForm.department.trim() || null,
        hire_date: userForm.hire_date || null,
        base_salary: parsedSalary,
        salary_reason: userForm.salary_reason.trim() || undefined,
        notes: userForm.notes.trim() || null,
        is_active: Boolean(userForm.is_active),
        isActive: Boolean(userForm.is_active),
      }
      if (userForm.password && userForm.password.length >= 8) {
        payload.password = userForm.password
      }
      const res = await api.patch(`/users/${editingUser.value.id}`, payload)
      const updated: UserAccount | undefined = res.data?.data
      if (updated) {
        users.value = users.value.map(u => (u.id === updated.id ? { ...u, ...updated } : u))
      } else {
        await loadUsers()
      }
      toast.success(`Staff member "${userForm.name}" updated successfully.`)
    } else {
      const payload: Record<string, unknown> = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim() || null,
        role: userForm.role,
        department: userForm.department.trim() || null,
        hire_date: userForm.hire_date || new Date().toISOString().slice(0, 10),
        base_salary: parsedSalary,
        salary_reason: userForm.salary_reason.trim() || 'Initial Starting Salary Package',
        notes: userForm.notes.trim() || null,
        password: userForm.password,
      }
      const res = await api.post('/users', payload)
      const created: UserAccount | undefined = res.data?.data
      if (created) {
        users.value = [created, ...users.value]
      } else {
        await loadUsers()
      }
      toast.success(`Staff member "${userForm.name}" created successfully.`)
    }
    closeFormModal()
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      formError.value = e.message
      if (e.errors) {
        Object.entries(e.errors).forEach(([key, msgs]) => {
          if (Array.isArray(msgs) && msgs.length > 0) {
            fieldErrors[key] = msgs[0]
          }
        })
      }
    } else if (e instanceof Error) {
      formError.value = e.message
    } else {
      formError.value = 'Failed to save staff account.'
    }
    toast.error(formError.value)
  } finally {
    formSaving.value = false
  }
}

function openDeleteModal(user: UserAccount) {
  deletingUser.value = user
  isDeleteModalOpen.value = true
}

function closeDeleteModal() {
  isDeleteModalOpen.value = false
  deletingUser.value = null
}

async function executeDelete() {
  if (!deletingUser.value) return
  deleteLoading.value = true
  try {
    await api.delete(`/users/${deletingUser.value.id}`)
    users.value = users.value.filter(u => u.id !== deletingUser.value!.id)
    toast.success(`Staff account "${deletingUser.value.name}" deleted.`)
    closeDeleteModal()
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      usersError.value = e.message
    } else if (e instanceof Error) {
      usersError.value = e.message
    } else {
      usersError.value = 'Failed to delete user.'
    }
    toast.error(usersError.value)
  } finally {
    deleteLoading.value = false
  }
}

async function toggleUserActive(user: UserAccount) {
  if (user.role === 'SUPER_ADMIN') {
    toast.warning('The Super Admin account cannot be deactivated.')
    return
  }
  toggleLoadingId.value = user.id
  const currentActive = user.is_active !== false && user.isActive !== false
  const newActive = !currentActive

  // Optimistic update
  users.value = users.value.map(u => (u.id === user.id ? { ...u, is_active: newActive, isActive: newActive } : u))
  try {
    await api.patch(`/users/${user.id}/status`, { is_active: newActive })
    toast.success(`Staff account "${user.name}" is now ${newActive ? 'Active' : 'Inactive'}.`)
  } catch (e: unknown) {
    // Revert on failure
    users.value = users.value.map(u =>
      u.id === user.id ? { ...u, is_active: currentActive, isActive: currentActive } : u
    )
    const err = e instanceof ApiError ? e.message : 'Failed to update user status.'
    toast.error(err)
  } finally {
    toggleLoadingId.value = ''
  }
}

// Staff Detail Drawer / Modal
async function openDetailModal(user: UserAccount) {
  detailUser.value = user
  detailTab.value = 'overview'
  isDetailModalOpen.value = true
  await loadPerformanceData()
}

async function loadPerformanceData() {
  if (!detailUser.value) return
  perfLoading.value = true
  try {
    const res = await api.get(`/dashboard/staff-performance`, {
      params: { staff_id: detailUser.value.id, period: perfPeriod.value },
    })
    const data = res.data?.data || res.data
    perfData.value = data || null
  } catch {
    // Fallback calculation from user stats
    perfData.value = {
      total_orders: detailUser.value.stats?.total_orders || 0,
      total_sales: detailUser.value.stats?.total_sales || 0,
      total_revenue: detailUser.value.stats?.total_sales || 0,
    }
  } finally {
    perfLoading.value = false
  }
}

watch(perfPeriod, () => {
  if (isDetailModalOpen.value && detailTab.value === 'performance') {
    loadPerformanceData()
  }
})

// Give Salary Raise
function openRaiseModal() {
  if (!detailUser.value) return
  raiseSalaryAmount.value = String(detailUser.value.base_salary || '')
  raiseReason.value = 'Annual Performance Merit Raise'
  raiseEffectiveDate.value = new Date().toISOString().slice(0, 10)
  raiseError.value = ''
  isRaiseModalOpen.value = true
}

async function submitRaise() {
  if (!detailUser.value) return
  const sal = parseFloat(raiseSalaryAmount.value)
  if (isNaN(sal) || sal <= 0) {
    raiseError.value = 'Please enter a valid salary amount.'
    return
  }

  raiseSaving.value = true
  raiseError.value = ''
  try {
    const res = await api.patch(`/users/${detailUser.value.id}`, {
      base_salary: sal,
      salary_reason: raiseReason.value,
      hire_date: raiseEffectiveDate.value,
    })
    const updated = res.data?.data
    const currentName = detailUser.value?.name || 'staff member'
    if (updated && detailUser.value) {
      detailUser.value = { ...detailUser.value, ...updated }
      users.value = users.value.map(u => (u.id === updated.id ? { ...u, ...updated } : u))
    }
    toast.success(`Salary adjusted for ${currentName} to $${sal.toFixed(2)}/mo`)
    isRaiseModalOpen.value = false
  } catch (e: unknown) {
    raiseError.value = e instanceof ApiError ? e.message : 'Failed to record salary raise'
    toast.error(raiseError.value)
  } finally {
    raiseSaving.value = false
  }
}

// --- Audit Log API Calls ---
function computeDatePresetBounds(preset: typeof auditDatePreset.value): { from: string; to: string } {
  const today = new Date()
  const toStr = today.toISOString().slice(0, 10)
  if (preset === 'today') return { from: toStr, to: toStr }
  if (preset === '7d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    return { from: d.toISOString().slice(0, 10), to: toStr }
  }
  if (preset === '30d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 29)
    return { from: d.toISOString().slice(0, 10), to: toStr }
  }
  if (preset === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: first.toISOString().slice(0, 10), to: toStr }
  }
  if (preset === 'custom') {
    return { from: auditDateFrom.value, to: auditDateTo.value }
  }
  return { from: '', to: '' }
}

async function loadAuditLogs(reset = true) {
  if (reset) {
    auditLoading.value = true
    auditPage.value = 1
  } else {
    auditLoadingMore.value = true
  }
  auditError.value = ''

  try {
    const params: Record<string, string | number> = {
      page: reset ? 1 : auditPage.value + 1,
      per_page: 15,
    }
    if (auditSearch.value.trim()) {
      params.search = auditSearch.value.trim()
    }
    if (auditCategory.value !== 'ALL') {
      params.category = auditCategory.value
    }
    const bounds = computeDatePresetBounds(auditDatePreset.value)
    if (bounds.from) params.date_from = bounds.from
    if (bounds.to) params.date_to = bounds.to

    const res = await api.get('/audit-logs', { params })
    const body = res.data as AuditLogApiResponse | { data?: AuditLogEntry[] }
    const list: AuditLogEntry[] = Array.isArray(body?.data)
      ? body.data
      : []
    const meta = (body as AuditLogApiResponse)?.meta

    if (reset) {
      auditLogs.value = list
    } else {
      const existingIds = new Set(auditLogs.value.map(l => l.id))
      const unique = list.filter(l => !existingIds.has(l.id))
      auditLogs.value = [...auditLogs.value, ...unique]
      if (list.length > 0) {
        auditPage.value = auditPage.value + 1
      }
    }

    if (meta) {
      auditPage.value = meta.current_page
      auditLastPage.value = meta.last_page
      auditTotal.value = meta.total
    } else {
      auditLastPage.value = reset ? 1 : auditPage.value
      auditTotal.value = list.length
    }
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      auditError.value = e.message
    } else if (e instanceof Error) {
      auditError.value = e.message
    } else {
      auditError.value = 'Failed to load audit log entries.'
    }
    if (reset) {
      auditLogs.value = []
    }
  } finally {
    auditLoading.value = false
    auditLoadingMore.value = false
  }
}

function loadMoreAudit() {
  if (auditHasMore.value && !auditLoadingMore.value && !auditLoading.value) {
    loadAuditLogs(false)
  }
}

function applyDatePreset(preset: typeof auditDatePreset.value) {
  auditDatePreset.value = preset
  if (preset === 'custom') {
    return
  }
  loadAuditLogs(true)
}

function onCustomDateChange() {
  if (auditDateFrom.value && auditDateTo.value) {
    auditDatePreset.value = 'custom'
    loadAuditLogs(true)
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onAuditSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadAuditLogs(true)
  }, 400)
}

function onCategoryChange() {
  loadAuditLogs(true)
}

function clearAuditFilters() {
  auditSearch.value = ''
  auditCategory.value = 'ALL'
  auditDatePreset.value = 'all'
  auditDateFrom.value = ''
  auditDateTo.value = ''
  loadAuditLogs(true)
}

function getRoleVariant(role: string): 'purple' | 'destructive' | 'info' | 'success' | 'neutral' {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'purple'
    case 'ADMIN':
      return 'destructive'
    case 'MANAGER':
      return 'info'
    case 'SELLER':
      return 'success'
    default:
      return 'neutral'
  }
}

function getCategoryVariant(cat: string | undefined): 'purple' | 'info' | 'success' | 'warning' | 'destructive' | 'neutral' {
  const c = (cat || '').toLowerCase()
  if (c.includes('auth') || c.includes('login')) return 'purple'
  if (c.includes('product') || c.includes('inventory')) return 'info'
  if (c.includes('order') || c.includes('pos')) return 'success'
  if (c.includes('expense') || c.includes('finance')) return 'warning'
  if (c.includes('payroll') || c.includes('salary')) return 'destructive'
  return 'neutral'
}

// --- Mount ---
onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-12">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Staff & Users</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ users.length }} Staff Profiles
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage staff roster, compensation packages, role security access, and performance analytics.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button
          id="btn-refresh-admin-users"
          variant="outline"
          size="sm"
          class="h-9 px-3 gap-1.5 text-xs"
          :disabled="usersLoading"
          @click="loadUsers"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': usersLoading }" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="activeTab === 'staff'"
          id="btn-open-create-user"
          variant="primary"
          size="sm"
          class="h-9 px-3.5 gap-1.5 font-bold"
          @click="openCreateModal"
        >
          <Plus :size="15" />
          <span>Add Staff Member</span>
        </Button>
      </div>
    </div>

    <!-- Top KPI StatCards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Staff"
        :value="users.length"
        sub="Registered accounts"
        :icon="Users"
        icon-variant="primary"
      />
      <StatCard
        label="Active Accounts"
        :value="activeUsersCount"
        sub="Authorized to login"
        :icon="UserCheck"
        icon-variant="success"
      />
      <StatCard
        label="Monthly Payroll Base"
        :value="fmtMoney(totalPayrollBase)"
        sub="Base salary commitment"
        :icon="DollarSign"
        icon-variant="warning"
      />
      <StatCard
        label="Management Tier"
        :value="adminUsersCount"
        sub="Super Admin, Admin, Manager"
        :icon="ShieldCheck"
        icon-variant="purple"
      />
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-border gap-2 overflow-x-auto no-scrollbar">
      <button
        id="tab-staff"
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer"
        :class="activeTab === 'staff' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'staff'"
      >
        <Users :size="14" />
        <span>Staff Management ({{ users.length }})</span>
      </button>

      <button
        id="tab-permissions"
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer"
        :class="activeTab === 'permissions' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'permissions'"
      >
        <Shield :size="14" />
        <span>Role Permissions Matrix</span>
      </button>

      <button
        id="tab-audit"
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer"
        :class="activeTab === 'audit' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'audit'; if (!auditLogs.length) loadAuditLogs(true)"
      >
        <ShieldAlert :size="14" />
        <span>Audit Logs</span>
      </button>
    </div>

    <!-- Error Alert -->
    <Alert v-if="usersError" variant="error">
      <div class="flex items-center justify-between w-full">
        <span>{{ usersError }}</span>
        <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="loadUsers">
          Retry
        </Button>
      </div>
    </Alert>

    <!-- ============ STAFF TAB ============ -->
    <template v-if="activeTab === 'staff'">
      <!-- Staff Search Filter -->
      <div class="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex-1 max-w-md">
          <Input
            id="staff-search-input"
            v-model="userSearch"
            type="text"
            placeholder="Search by name, email, phone, role, or department…"
            class="bg-surface font-mono text-xs"
          >
            <template #prefix>
              <Search :size="15" class="text-muted-foreground" />
            </template>
          </Input>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <Badge variant="success" class="font-mono text-xs px-2.5 py-0.5">
            {{ activeUsersCount }} Active
          </Badge>
          <Badge variant="neutral" class="font-mono text-xs px-2.5 py-0.5">
            {{ users.length - activeUsersCount }} Inactive
          </Badge>
        </div>
      </div>

      <!-- Staff Table -->
      <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div v-if="usersLoading" class="p-6 space-y-3">
          <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
        </div>

        <EmptyState
          v-else-if="filteredUsers.length === 0"
          :icon="Users"
          title="No staff members found"
          :description="userSearch.trim() ? 'No staff match your search query.' : 'Add your first staff member to start managing your team.'"
        >
          <template #action>
            <Button v-if="!userSearch.trim()" variant="primary" size="sm" class="gap-1.5 font-bold" @click="openCreateModal">
              <Plus :size="15" />
              <span>Add Staff Member</span>
            </Button>
          </template>
        </EmptyState>

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40">
                <TableHead>Staff Profile</TableHead>
                <TableHead>Email & Contact</TableHead>
                <TableHead>Access Role</TableHead>
                <TableHead>Department / Branch</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead class="font-mono">Monthly Base</TableHead>
                <TableHead class="text-center">Status</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="u in filteredUsers" :key="u.id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell>
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-cta-muted text-primary border border-border-strong flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {{ getInitials(u.name) }}
                    </div>
                    <div>
                      <div class="font-semibold text-foreground text-sm flex items-center gap-1.5">
                        <span>{{ u.name }}</span>
                      </div>
                      <div v-if="u.notes" class="text-xs text-muted-foreground truncate max-w-[200px]" :title="u.notes">
                        {{ u.notes }}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="text-xs font-medium text-foreground">{{ u.email }}</div>
                  <div v-if="u.phone" class="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                    <Phone :size="11" />
                    <span>{{ u.phone }}</span>
                  </div>
                  <div v-else class="text-[11px] text-muted-foreground">—</div>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-1.5">
                    <Badge :variant="getRoleVariant(u.role)" class="text-[11px] px-2.5 py-0.5 font-mono font-bold flex items-center gap-1">
                      <span v-if="u.role === 'SUPER_ADMIN'">👑 Super Admin</span>
                      <span v-else-if="u.role === 'ADMIN'">🛡️ Admin</span>
                      <span v-else-if="u.role === 'MANAGER'">👔 Manager</span>
                      <span v-else>💳 Cashier</span>
                    </Badge>
                  </div>
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">
                  <span v-if="u.department" class="px-2 py-0.5 rounded bg-surface border border-border/70 text-xs">
                    {{ u.department }}
                  </span>
                  <span v-else>—</span>
                </TableCell>
                <TableCell class="text-xs font-mono text-muted-foreground">
                  {{ fmtDateOnly(u.hire_date) }}
                </TableCell>
                <TableCell class="font-mono text-xs font-semibold text-foreground tabular-nums">
                  {{ fmtMoney(u.base_salary) }}
                </TableCell>
                <TableCell class="text-center">
                  <div class="inline-flex items-center justify-center gap-2">
                    <Badge
                      :variant="isUserActive(u) ? 'success' : 'neutral'"
                      dot
                      class="text-[10px] font-bold font-mono px-2 py-0.5"
                    >
                      {{ isUserActive(u) ? 'ACTIVE' : 'INACTIVE' }}
                    </Badge>
                    <Switch
                      :checked="isUserActive(u)"
                      :disabled="toggleLoadingId === u.id || u.role === 'SUPER_ADMIN'"
                      @update:checked="() => toggleUserActive(u)"
                    />
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2 text-xs gap-1 text-primary hover:bg-surface-subtle hover:text-cta"
                      title="View Performance & Salary Raises"
                      @click="openDetailModal(u)"
                    >
                      <BarChart2 :size="13" />
                      <span>Details</span>
                    </Button>
                    <Button
                      :id="`btn-edit-user-${u.id}`"
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2.5 text-xs gap-1"
                      @click="openEditModal(u)"
                    >
                      <Edit2 :size="13" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      :id="`btn-delete-user-${u.id}`"
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      :disabled="u.role === 'SUPER_ADMIN'"
                      :title="u.role === 'SUPER_ADMIN' ? 'Super Admin cannot be deleted' : 'Delete staff member'"
                      @click="openDeleteModal(u)"
                    >
                      <Trash2 :size="14" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>

    <!-- ============ PERMISSIONS TAB ============ -->
    <template v-else-if="activeTab === 'permissions'">
      <Card class="p-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="font-display font-bold text-base text-foreground">Role Permission Matrix</h2>
            <p class="text-xs text-muted-foreground mt-0.5">
              Overview of security grant templates assigned to each role. Customize permissions live in the dedicated Roles console.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="purple" class="font-mono text-xs">
              {{ PERMISSION_GROUPS.length }} Roles
            </Badge>
            <Button
              variant="primary"
              size="sm"
              class="h-8 px-3 gap-1.5 text-xs font-bold"
              @click="router.push('/roles')"
            >
              <Key :size="13" />
              <span>Configure Grants</span>
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div
            v-for="group in groupsWithCounts"
            :key="group.id"
            class="p-4 rounded-xl border border-border bg-surface text-xs flex flex-col gap-2.5"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Badge :variant="getRoleVariant(group.slug)" class="font-mono text-xs">
                  {{ group.slug }}
                </Badge>
                <h3 class="font-display font-bold text-sm text-foreground">{{ group.name }}</h3>
              </div>
              <Badge variant="neutral" class="font-mono text-xs">
                {{ group.userCount }} {{ group.userCount === 1 ? 'user' : 'users' }}
              </Badge>
            </div>
            <p class="text-muted-foreground text-xs">{{ group.description }}</p>
            <div class="flex items-center gap-2 pt-1">
              <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Default Role Capabilities:</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="perm in group.permissions"
                :key="perm"
                variant="info"
                class="text-xs font-mono"
              >
                <ShieldCheck :size="12" />
                <span>{{ perm }}</span>
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </template>

    <!-- ============ AUDIT LOG TAB ============ -->
    <template v-else>
      <!-- Audit Filters -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col gap-3">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Search</label>
            <Input
              id="audit-search-input"
              v-model="auditSearch"
              type="text"
              placeholder="Search action, target, or user…"
              class="h-8 bg-surface text-xs font-mono"
              @input="onAuditSearchInput"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Category</label>
            <SelectField
              id="audit-category-filter"
              v-model="auditCategory"
              :options="auditCategoryOptions"
              placeholder="All Categories"
              class="w-full h-8 bg-surface text-xs"
              @change="onCategoryChange"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Quick Date Range</label>
            <SelectField
              id="audit-date-preset"
              v-model="auditDatePreset"
              :options="auditDatePresetOptions"
              placeholder="All Time"
              class="w-full h-8 bg-surface text-xs"
              @change="applyDatePreset(auditDatePreset)"
            />
          </div>
        </div>

        <div v-if="auditDatePreset === 'custom'" class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2 border-t border-border/50">
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Date From</label>
            <DatePicker
              id="audit-date-from"
              v-model="auditDateFrom"
              placeholder="From date"
              class="h-8 w-full bg-surface text-xs"
              @change="onCustomDateChange"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Date To</label>
            <DatePicker
              id="audit-date-to"
              v-model="auditDateTo"
              placeholder="To date"
              class="h-8 w-full bg-surface text-xs"
              @change="onCustomDateChange"
            />
          </div>
          <div>
            <Button
              id="btn-clear-audit-filters"
              variant="outline"
              size="sm"
              class="w-full h-8 text-xs"
              @click="clearAuditFilters"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        <div v-else class="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
          <Button
            id="btn-clear-audit-filters"
            variant="ghost"
            size="sm"
            class="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            @click="clearAuditFilters"
          >
            Reset Filters
          </Button>
          <span class="text-xs text-muted-foreground font-mono">
            {{ auditTotal }} total entries
          </span>
        </div>
      </div>

      <!-- Audit Error -->
      <Alert v-if="auditError" variant="error">
        <div class="flex items-center justify-between w-full">
          <span>{{ auditError }}</span>
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="loadAuditLogs(true)">
            Retry
          </Button>
        </div>
      </Alert>

      <!-- Audit Log Table -->
      <div class="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div v-if="auditLoading" class="p-6 space-y-3">
          <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
        </div>

        <EmptyState
          v-else-if="auditLogs.length === 0"
          :icon="ShieldAlert"
          title="No audit entries found"
          description="No system activity matches the current filters. Try widening the date range or clearing the search."
        />

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/40">
                <TableHead class="w-12 text-center">Type</TableHead>
                <TableHead>Action / Details</TableHead>
                <TableHead>Category</TableHead>
                <TableHead class="font-mono">Target</TableHead>
                <TableHead>By User</TableHead>
                <TableHead class="font-mono">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="log in auditLogs" :key="log.id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell class="text-center font-bold text-base">
                  {{ categoryIcon(log.category || log.action) }}
                </TableCell>
                <TableCell>
                  <div class="font-semibold text-foreground text-xs">{{ log.action || '—' }}</div>
                  <div v-if="log.details" class="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                    {{ log.details }}
                  </div>
                  <div v-if="log.ip || log.device" class="text-[10px] text-muted-foreground font-mono mt-0.5">
                    <span v-if="log.ip">IP: {{ log.ip }}</span>
                    <span v-if="log.ip && log.device"> &bull; </span>
                    <span v-if="log.device">{{ log.device }}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge v-if="log.category" :variant="getCategoryVariant(log.category)" class="text-[10px] px-2 py-0.5">
                    {{ log.category }}
                  </Badge>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell>
                  <span v-if="log.target" class="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground">
                    {{ log.target }}
                  </span>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell class="text-xs font-semibold text-foreground">
                  {{ log.by || '—' }}
                </TableCell>
                <TableCell class="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {{ fmtDate(log.time || log.created_at) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- Load More -->
        <div
          v-if="auditLogs.length > 0"
          class="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-subtle/50 text-xs text-muted-foreground"
        >
          <span class="font-mono">
            Showing {{ auditLogs.length }} of {{ auditTotal }} entries
          </span>
          <Button
            id="btn-load-more-audit"
            variant="outline"
            size="sm"
            class="h-8 px-3 text-xs"
            :disabled="!auditHasMore || auditLoadingMore"
            @click="loadMoreAudit"
          >
            <span v-if="auditLoadingMore" class="animate-spin mr-1">⏳</span>
            <span>{{ auditLoadingMore ? 'Loading…' : (auditHasMore ? 'Load More' : 'No More Entries') }}</span>
          </Button>
        </div>
      </div>
    </template>

    <!-- ============ COMPREHENSIVE STAFF FORM MODAL ============ -->
    <Dialog :open="isFormModalOpen" @update:open="(val) => { if (!val) closeFormModal(); }">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-cta-muted border border-border-strong flex items-center justify-center text-primary shadow-2xs">
              <Users class="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle class="font-display text-lg">
                {{ editingUser ? 'Edit Staff Profile' : 'Add New Staff Member' }}
              </DialogTitle>
              <DialogDescription class="text-xs">
                {{ editingUser ? 'Update employment details, security credentials, and payroll terms.' : 'Create a staff login, assign security role permissions, and configure starting compensation.' }}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form @submit.prevent="submitUserForm" class="space-y-4 py-2">
          <!-- SECTION 1: ACCOUNT CREDENTIALS & PROFILE -->
          <div class="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-2xs">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-2">
              <UserCheck :size="15" class="text-primary" />
              <span>1. Account Credentials & Contact</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
                <Input
                  id="form-user-name"
                  v-model="userForm.name"
                  type="text"
                  placeholder="e.g. Sophy Chen"
                  class="h-9 bg-surface text-xs"
                />
                <span v-if="fieldErrors.name" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.name }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">Email Address (Login ID) *</label>
                <Input
                  id="form-user-email"
                  v-model="userForm.email"
                  type="email"
                  placeholder="e.g. sophy@company.com"
                  class="h-9 bg-surface text-xs"
                />
                <span v-if="fieldErrors.email" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.email }}</span>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">Contact Phone</label>
                <Input
                  id="form-user-phone"
                  v-model="userForm.phone"
                  type="tel"
                  placeholder="e.g. +855 12 345 678"
                  class="h-9 bg-surface text-xs font-mono"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">
                  {{ editingUser ? 'Reset Password (optional)' : 'Password *' }}
                </label>
                <div class="relative">
                  <Input
                    id="form-user-password"
                    v-model="userForm.password"
                    :type="showPassword ? 'text' : 'password'"
                    :placeholder="editingUser ? 'Leave blank to keep unchanged' : 'Min 6 characters'"
                    class="h-9 bg-surface text-xs pr-8 font-mono"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    @click="showPassword = !showPassword"
                  >
                    <Lock :size="13" class="text-primary" />
                  </button>
                </div>
                <span v-if="fieldErrors.password" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.password }}</span>
              </div>
            </div>

            <!-- Fast Generated Password Banner -->
            <div v-if="!editingUser" class="flex items-center justify-between p-2 rounded-lg bg-surface border border-border/80 text-xs">
              <span class="text-muted-foreground text-[11px]">Quick random password generator:</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-xs text-primary font-bold hover:underline cursor-pointer"
                  @click="handleRegeneratePassword"
                >
                  ⚡ Regenerate
                </button>
                <span class="text-border text-xs">|</span>
                <button
                  type="button"
                  class="text-xs text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                  @click="handleCopyPassword"
                >
                  {{ copiedPassword ? '✓ Copied!' : '📋 Copy' }}
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-border/50">
              <div>
                <span class="text-xs font-semibold text-foreground block">Account Active Status</span>
                <span class="text-[11px] text-muted-foreground">Inactive staff cannot log into POS registers or admin console</span>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
                  :class="userForm.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-muted text-muted-foreground border border-border'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="userForm.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'"></span>
                  <span>{{ userForm.is_active ? 'ACTIVE' : 'INACTIVE' }}</span>
                </span>
                <Switch
                  :checked="userForm.is_active"
                  @update:checked="(val) => userForm.is_active = val"
                />
              </div>
            </div>
          </div>

          <!-- SECTION 2: EMPLOYMENT & STORE ASSIGNMENT -->
          <div class="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-2xs">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary border-b border-border/60 pb-2">
              <Briefcase :size="15" class="text-primary" />
              <span>2. Employment & Store Assignment</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">Department / Branch</label>
                <SelectField
                  id="form-user-department"
                  v-model="userForm.department"
                  :options="departmentSelectOptions"
                  placeholder="— Select Department —"
                  class="w-full h-9 bg-surface text-xs"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">Hire Date</label>
                <DatePicker
                  id="form-user-hire-date"
                  v-model="userForm.hire_date"
                  placeholder="Select hire date"
                  class="h-9 w-full bg-surface text-xs"
                />
              </div>
            </div>

            <!-- Role Selector Buttons -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-xs font-semibold text-foreground">Assigned Security Access Role *</label>
                <SelectField
                  id="form-user-role"
                  v-model="userForm.role"
                  :options="roleSelectOptions"
                  placeholder="Select role"
                  class="text-xs h-7 w-36 bg-surface"
                />
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="r in ROLE_OPTIONS"
                  :key="r"
                  type="button"
                  class="p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer select-none"
                  :class="[
                    userForm.role === r
                      ? 'bg-cta-muted border-cta ring-1 ring-cta/30 text-primary'
                      : 'bg-surface border-border text-muted-foreground hover:bg-surface-subtle hover:text-foreground'
                  ]"
                  @click="userForm.role = r"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-xs">{{ r }}</span>
                    <Check v-if="userForm.role === r" :size="12" class="text-cta" />
                  </div>
                  <span class="text-[10px] text-muted-foreground line-clamp-1 leading-tight">
                    {{ r === 'SUPER_ADMIN' ? 'Root access' : (r === 'ADMIN' ? 'Full admin' : (r === 'MANAGER' ? 'Store operations' : 'Cashier/POS')) }}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Internal Employment Notes / Shift Schedule</label>
              <textarea
                id="form-user-notes"
                v-model="userForm.notes"
                rows="2"
                placeholder="e.g. Morning counter lead, handles register reconciliation and petty cash…"
                class="w-full px-3 py-2 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              ></textarea>
            </div>
          </div>

          <!-- SECTION 3: COMPENSATION & SALARY SETUP -->
          <div class="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-2xs">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 border-b border-border/60 pb-2">
              <DollarSign :size="15" class="text-emerald-600 dark:text-emerald-400" />
              <span>3. Compensation & Base Salary Setup</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">Monthly Base Salary ($ USD)</label>
                <Input
                  id="form-user-salary"
                  v-model="userForm.base_salary"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 350.00"
                  class="h-9 bg-surface text-xs font-mono"
                >
                  <template #prefix>
                    <span class="text-xs text-muted-foreground">$</span>
                  </template>
                </Input>
                <span v-if="fieldErrors.base_salary" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.base_salary }}</span>
              </div>
              <div>
                <label class="block text-xs font-semibold text-foreground mb-1">Salary Package / Adjustment Reason</label>
                <Input
                  v-model="userForm.salary_reason"
                  type="text"
                  placeholder="e.g. Starting Base / Annual Merit Review"
                  class="h-9 bg-surface text-xs"
                />
              </div>
            </div>

            <!-- Live Compensation Accruals Card -->
            <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex flex-col gap-2">
              <div class="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Calculator :size="13" class="text-emerald-600 dark:text-emerald-400" />
                <span>Live Compensation Accruals</span>
              </div>
              <div class="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-emerald-500/10">
                <div>
                  <span class="text-[10px] text-muted-foreground font-semibold uppercase block">Daily Rate (26 working days)</span>
                  <span class="font-mono font-bold text-foreground text-xs">${{ formDailyRate }} / day</span>
                </div>
                <div>
                  <span class="text-[10px] text-muted-foreground font-semibold uppercase block">13th Month Monthly Reserve</span>
                  <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">+${{ formThirteenthMonthAccrual }} / mo</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter class="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              id="btn-cancel-user-form"
              variant="outline"
              :disabled="formSaving"
              @click="closeFormModal"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              id="btn-save-user"
              variant="primary"
              class="font-bold"
              :disabled="formSaving"
            >
              <span v-if="formSaving" class="animate-spin mr-1">⏳</span>
              <span>{{ formSaving ? 'Saving…' : (editingUser ? 'Save All Changes' : 'Create Staff Member') }}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- ============ STAFF DETAIL & PERFORMANCE MODAL ============ -->
    <Dialog :open="isDetailModalOpen" @update:open="(val) => { if (!val) isDetailModalOpen = false; }">
      <DialogContent class="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader v-if="detailUser">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-cta-muted text-primary border border-border-strong flex items-center justify-center font-bold text-sm">
              {{ getInitials(detailUser.name) }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <DialogTitle class="font-display text-base">{{ detailUser.name }}</DialogTitle>
                <Badge :variant="getRoleVariant(detailUser.role)" class="font-mono text-3xs font-bold">{{ detailUser.role }}</Badge>
              </div>
              <DialogDescription class="text-xs">
                {{ detailUser.email }} {{ detailUser.phone ? `· ${detailUser.phone}` : '' }} · {{ detailUser.department || 'Main Counter' }}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <!-- Modal Tabs -->
        <div class="flex border-b border-border gap-2 text-xs font-semibold">
          <button
            type="button"
            class="px-3 py-2 border-b-2 transition-colors cursor-pointer"
            :class="detailTab === 'overview' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
            @click="detailTab = 'overview'"
          >
            Overview & Stats
          </button>
          <button
            type="button"
            class="px-3 py-2 border-b-2 transition-colors cursor-pointer"
            :class="detailTab === 'performance' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
            @click="detailTab = 'performance'; loadPerformanceData();"
          >
            Sales Analytics
          </button>
          <button
            type="button"
            class="px-3 py-2 border-b-2 transition-colors cursor-pointer"
            :class="detailTab === 'salary' ? 'border-cta text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
            @click="detailTab = 'salary'"
          >
            Compensation & Raises
          </button>
        </div>

        <div v-if="detailUser" class="py-2">
          <!-- Overview Tab -->
          <div v-if="detailTab === 'overview'" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-lg border border-border bg-surface flex flex-col gap-1">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Total Sales Closed</span>
                <span class="text-base font-bold font-mono text-foreground">${{ (detailUser.stats?.total_sales || 0).toFixed(2) }}</span>
              </div>
              <div class="p-3 rounded-lg border border-border bg-surface flex flex-col gap-1">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Orders Processed</span>
                <span class="text-base font-bold font-mono text-foreground">{{ detailUser.stats?.total_orders || 0 }}</span>
              </div>
              <div class="p-3 rounded-lg border border-border bg-surface flex flex-col gap-1">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Monthly Base Salary</span>
                <span class="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{{ fmtMoney(detailUser.base_salary) }}</span>
              </div>
            </div>

            <div class="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
              <div class="flex justify-between py-1 border-b border-border/50">
                <span class="text-muted-foreground">Hire Date</span>
                <span class="font-mono font-medium">{{ fmtDateOnly(detailUser.hire_date) }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-border/50">
                <span class="text-muted-foreground">Department / Branch</span>
                <span class="font-medium">{{ detailUser.department || 'Main Counter' }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-border/50">
                <span class="text-muted-foreground">Account Status</span>
                <Badge :variant="detailUser.is_active !== false && detailUser.isActive !== false ? 'success' : 'neutral'" class="text-3xs">
                  {{ detailUser.is_active !== false && detailUser.isActive !== false ? 'Active' : 'Inactive' }}
                </Badge>
              </div>
              <div v-if="detailUser.notes" class="pt-1">
                <span class="text-muted-foreground block text-3xs font-bold uppercase mb-1">Employment Notes</span>
                <p class="text-xs text-foreground bg-surface-subtle p-2 rounded border border-border/60">{{ detailUser.notes }}</p>
              </div>
            </div>
          </div>

          <!-- Performance Tab -->
          <div v-else-if="detailTab === 'performance'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-foreground">Sales Performance</span>
              <div class="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs font-semibold">
                <button
                  v-for="p in (['today', '7d', '30d', 'month', 'year'] as const)"
                  :key="p"
                  type="button"
                  class="px-2 py-0.5 rounded text-3xs transition-all cursor-pointer uppercase font-mono"
                  :class="perfPeriod === p ? 'bg-card shadow-2xs text-primary font-bold' : 'text-muted-foreground hover:text-foreground'"
                  @click="perfPeriod = p"
                >
                  {{ p }}
                </button>
              </div>
            </div>

            <div v-if="perfLoading" class="py-6 flex justify-center">
              <RefreshCw :size="20" class="animate-spin text-muted-foreground" />
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-lg border border-border bg-card">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Revenue Generated</span>
                <div class="text-base font-bold font-mono text-primary mt-0.5">
                  ${{ (perfData?.total_revenue ?? perfData?.total_sales ?? 0).toFixed(2) }}
                </div>
              </div>
              <div class="p-3 rounded-lg border border-border bg-card">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Orders Completed</span>
                <div class="text-base font-bold font-mono text-foreground mt-0.5">
                  {{ perfData?.total_orders ?? 0 }}
                </div>
              </div>
              <div class="p-3 rounded-lg border border-border bg-card">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Est. Ticket Size</span>
                <div class="text-base font-bold font-mono text-foreground mt-0.5">
                  ${{ ((perfData?.total_sales ?? 0) / Math.max(perfData?.total_orders ?? 1, 1)).toFixed(2) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Salary & Raises Tab -->
          <div v-else class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-foreground">Compensation Package</h4>
                <p class="text-[11px] text-muted-foreground">Current base salary & benefit accruals.</p>
              </div>
              <Button variant="primary" size="sm" class="h-7 px-3 text-xs font-bold" @click="openRaiseModal">
                <TrendingUp :size="12" class="mr-1" />
                <span>Give Salary Raise</span>
              </Button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-lg border border-border bg-card">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Monthly Base</span>
                <div class="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {{ fmtMoney(detailUser.base_salary) }}
                </div>
              </div>
              <div class="p-3 rounded-lg border border-border bg-card">
                <span class="text-3xs text-muted-foreground uppercase font-bold">Daily Rate (26d)</span>
                <div class="text-base font-bold font-mono text-foreground mt-0.5">
                  ${{ ((parseFloat(String(detailUser.base_salary || 0)) || 0) / 26).toFixed(2) }}
                </div>
              </div>
              <div class="p-3 rounded-lg border border-border bg-card">
                <span class="text-3xs text-muted-foreground uppercase font-bold">13th Mo. Reserve</span>
                <div class="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +${{ ((parseFloat(String(detailUser.base_salary || 0)) || 0) / 12).toFixed(2) }}/mo
                </div>
              </div>
            </div>

            <div v-if="detailUser.salary_reason" class="p-3 rounded-lg bg-surface border border-border text-xs">
              <span class="text-muted-foreground text-3xs uppercase font-bold block mb-0.5">Latest Adjustment Reason</span>
              <span class="text-foreground font-medium">{{ detailUser.salary_reason }}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" @click="isDetailModalOpen = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ============ GIVE SALARY RAISE MODAL ============ -->
    <Dialog :open="isRaiseModalOpen" @update:open="(val) => { if (!val) isRaiseModalOpen = false; }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-display flex items-center gap-2">
            <TrendingUp class="w-5 h-5 text-emerald-600" />
            <span>Grant Salary Raise — {{ detailUser?.name }}</span>
          </DialogTitle>
          <DialogDescription>
            Update base monthly compensation package and record merit history.
          </DialogDescription>
        </DialogHeader>

        <Alert v-if="raiseError" variant="error" class="mb-2">
          {{ raiseError }}
        </Alert>

        <form @submit.prevent="submitRaise" class="space-y-3 py-1">
          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">New Monthly Base Salary ($ USD) *</label>
            <Input
              v-model="raiseSalaryAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 400.00"
              class="h-9 bg-surface text-xs font-mono"
            >
              <template #prefix>
                <span class="text-xs text-muted-foreground">$</span>
              </template>
            </Input>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Raise Reason / Merit Note *</label>
            <Input
              v-model="raiseReason"
              type="text"
              placeholder="e.g. Annual Merit Promotion / Sales Target Achievement"
              class="h-9 bg-surface text-xs"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Effective Date</label>
            <DatePicker
              v-model="raiseEffectiveDate"
              placeholder="Select effective date"
              class="h-9 w-full bg-surface text-xs"
            />
          </div>

          <DialogFooter class="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" type="button" :disabled="raiseSaving" @click="isRaiseModalOpen = false">Cancel</Button>
            <Button variant="primary" type="submit" class="font-bold" :disabled="raiseSaving">
              <span v-if="raiseSaving" class="animate-spin mr-1">⏳</span>
              <span>{{ raiseSaving ? 'Saving…' : 'Record Raise' }}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- ============ DELETE CONFIRMATION MODAL ============ -->
    <Dialog :open="isDeleteModalOpen" @update:open="(val) => { if (!val) closeDeleteModal(); }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive font-display">Confirm Staff Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete staff account <strong>"{{ deletingUser?.name }}"</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert v-if="deletingUser?.role === 'SUPER_ADMIN'" variant="error" class="my-2">
          The Super Admin account is protected and cannot be deleted.
        </Alert>

        <DialogFooter class="gap-2 sm:gap-0 mt-4">
          <Button
            id="btn-cancel-delete-user"
            variant="outline"
            :disabled="deleteLoading"
            @click="closeDeleteModal"
          >
            Cancel
          </Button>
          <Button
            id="btn-confirm-delete-user"
            variant="destructive"
            :disabled="deleteLoading || deletingUser?.role === 'SUPER_ADMIN'"
            @click="executeDelete"
          >
            <span v-if="deleteLoading" class="animate-spin mr-1">⏳</span>
            <span>{{ deleteLoading ? 'Deleting…' : 'Delete Staff Account' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

