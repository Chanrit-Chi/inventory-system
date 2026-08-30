<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import api, { ApiError } from '@/api/axios'
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
} from '@/components/ui'

// --- Types ---
type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER'

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
  is_active: boolean
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

// Modal state
const isFormModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const editingUser = ref<UserAccount | null>(null)
const deletingUser = ref<UserAccount | null>(null)
const formSaving = ref(false)
const formError = ref('')
const fieldErrors = reactive<Record<string, string>>({})
const deleteLoading = ref(false)
const toggleLoadingId = ref<string>('')

const emptyForm = () => ({
  name: '',
  email: '',
  phone: '',
  role: 'SELLER' as UserRole,
  department: '',
  hire_date: new Date().toISOString().slice(0, 10),
  base_salary: '',
  notes: '',
  password: '',
  is_active: true,
})

const userForm = reactive<ReturnType<typeof emptyForm>>(emptyForm())

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

const ROLE_OPTIONS: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER']
const DEPARTMENT_OPTIONS = [
  'Main Counter',
  'Inventory & Warehouse',
  'Sales Floor',
  'Management',
  'Finance',
  'IT & Systems',
  'Marketing',
  'Other',
]

// --- Permission Group Definitions ---
const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'grp-super-admin',
    name: 'Super Admin',
    slug: 'SUPER_ADMIN',
    description: 'Full unrestricted system-wide administrative access',
    permissions: ['* (All System Capabilities)'],
    userCount: 0,
  },
  {
    id: 'grp-admin',
    name: 'Administrator',
    slug: 'ADMIN',
    description: 'Operations administrator with broad management access',
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
      (u.department || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    )
  })
})

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
  return isNaN(val) ? '$0.00' : `$${val.toFixed(2)}`
}

function clearFieldErrors() {
  Object.keys(fieldErrors).forEach(k => delete fieldErrors[k])
}

// --- Staff API Calls ---
async function loadUsers() {
  usersLoading.value = true
  usersError.value = ''
  try {
    const res = await api.get('/users')
    const data = res.data?.data
    if (Array.isArray(data)) {
      users.value = data
    } else if (data && Array.isArray(data.data)) {
      users.value = data.data
    } else {
      users.value = []
    }
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
  clearFieldErrors()
  formError.value = ''
  isFormModalOpen.value = true
}

function openEditModal(user: UserAccount) {
  editingUser.value = user
  Object.assign(userForm, {
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    role: (user.role || 'SELLER') as UserRole,
    department: user.department || '',
    hire_date: user.hire_date
      ? user.hire_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    base_salary:
      user.base_salary !== undefined && user.base_salary !== null
        ? String(user.base_salary)
        : '',
    notes: user.notes || '',
    password: '',
    is_active: user.is_active !== false,
  })
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
    fieldErrors.base_salary = 'Base salary must be a number.'
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
      : undefined

  try {
    if (editingUser.value) {
      const payload: Record<string, unknown> = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim() || undefined,
        role: userForm.role,
        department: userForm.department.trim() || undefined,
        hire_date: userForm.hire_date || undefined,
        base_salary: parsedSalary,
        notes: userForm.notes.trim() || undefined,
        is_active: userForm.is_active,
      }
      if (userForm.password && userForm.password.length >= 8) {
        payload.password = userForm.password
      }
      const res = await api.patch(`/users/${editingUser.value.id}`, payload)
      const updated: UserAccount | undefined = res.data?.data
      if (updated) {
        users.value = users.value.map(u => (u.id === updated.id ? updated : u))
      } else {
        await loadUsers()
      }
    } else {
      const payload: Record<string, unknown> = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim() || undefined,
        role: userForm.role,
        department: userForm.department.trim() || undefined,
        hire_date: userForm.hire_date || new Date().toISOString().slice(0, 10),
        base_salary: parsedSalary,
        notes: userForm.notes.trim() || undefined,
        password: userForm.password,
      }
      const res = await api.post('/users', payload)
      const created: UserAccount | undefined = res.data?.data
      if (created) {
        users.value = [created, ...users.value]
      } else {
        await loadUsers()
      }
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
    closeDeleteModal()
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      usersError.value = e.message
    } else if (e instanceof Error) {
      usersError.value = e.message
    } else {
      usersError.value = 'Failed to delete user.'
    }
  } finally {
    deleteLoading.value = false
  }
}

async function toggleUserActive(user: UserAccount) {
  if (user.role === 'SUPER_ADMIN') {
    usersError.value = 'The Super Admin account cannot be deactivated.'
    return
  }
  toggleLoadingId.value = user.id
  const newActive = !user.is_active
  // Optimistic update
  users.value = users.value.map(u => (u.id === user.id ? { ...u, is_active: newActive } : u))
  try {
    await api.patch(`/users/${user.id}/status`, { is_active: newActive })
  } catch (e: unknown) {
    // Revert on failure
    users.value = users.value.map(u =>
      u.id === user.id ? { ...u, is_active: !newActive } : u
    )
    if (e instanceof ApiError) {
      usersError.value = e.message
    } else if (e instanceof Error) {
      usersError.value = e.message
    } else {
      usersError.value = 'Failed to update user status.'
    }
  } finally {
    toggleLoadingId.value = ''
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
    // Wait for the user to fill both fields and then trigger reload
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

const activeUsersCount = computed(() => users.value.filter(u => u.is_active).length)
const adminUsersCount = computed(() => users.value.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'MANAGER').length)

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
  <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">Admin Users & Permissions</h1>
          <Badge variant="info" class="font-mono text-xs px-2.5 py-0.5">
            {{ users.length }} Staff Members
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage staff rosters, configure role permissions, and review system activity audit trails.
        </p>
      </div>

      <div class="flex items-center gap-2">
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
          class="h-9 px-3.5 gap-1.5"
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
        sub="Registered staff profiles"
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
        label="Management Tier"
        :value="adminUsersCount"
        sub="Admins & Store Managers"
        :icon="ShieldCheck"
        icon-variant="purple"
      />
      <StatCard
        label="Audit Records"
        :value="auditTotal"
        sub="Activity log entries"
        :icon="ShieldAlert"
        icon-variant="primary"
      />
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-border gap-2">
      <button
        id="tab-staff"
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'staff' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'staff'"
      >
        <Users :size="14" />
        <span>Staff Accounts ({{ users.length }})</span>
      </button>

      <button
        id="tab-permissions"
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'permissions' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'permissions'"
      >
        <Shield :size="14" />
        <span>Role Permissions</span>
      </button>

      <button
        id="tab-audit"
        class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5"
        :class="activeTab === 'audit' ? 'border-cta text-cta' : 'border-transparent text-muted-foreground hover:text-foreground'"
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
            placeholder="Search by name, email, role, or department…"
            class="bg-surface"
          >
            <template #prefix>
              <Search :size="16" />
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
            <Button v-if="!userSearch.trim()" variant="primary" size="sm" class="gap-1.5" @click="openCreateModal">
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
                <TableHead>Email & Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead class="font-mono">Base Salary</TableHead>
                <TableHead class="text-center">Active</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="u in filteredUsers" :key="u.id" class="hover:bg-surface-subtle/80 transition-colors">
                <TableCell>
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {{ getInitials(u.name) }}
                    </div>
                    <div>
                      <div class="font-semibold text-foreground text-sm">{{ u.name }}</div>
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
                  <Badge :variant="getRoleVariant(u.role)" class="text-[10px] px-2 py-0.5 font-mono">
                    {{ u.role }}
                  </Badge>
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">
                  {{ u.department || '—' }}
                </TableCell>
                <TableCell class="text-xs font-mono text-muted-foreground">
                  {{ fmtDateOnly(u.hire_date) }}
                </TableCell>
                <TableCell class="font-mono text-xs font-semibold text-foreground tabular-nums">
                  {{ fmtMoney(u.base_salary) }}
                </TableCell>
                <TableCell class="text-center">
                  <Switch
                    :checked="u.is_active"
                    :disabled="toggleLoadingId === u.id || u.role === 'SUPER_ADMIN'"
                    @update:checked="() => toggleUserActive(u)"
                  />
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1.5">
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
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-display font-bold text-base text-foreground">Role Permission Matrix</h2>
            <p class="text-xs text-muted-foreground mt-0.5">
              Read-only preview of capability grants assigned to each role. Edits require Super Admin access in the roles console.
            </p>
          </div>
          <Badge variant="purple" class="font-mono text-xs">
            {{ PERMISSION_GROUPS.length }} Roles
          </Badge>
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
            <div class="flex flex-wrap gap-1.5 pt-1">
              <span
                v-for="perm in group.permissions"
                :key="perm"
                class="px-2 py-0.5 rounded bg-surface-subtle border border-border text-[11px] font-mono text-foreground"
              >
                {{ perm }}
              </span>
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
            <select
              id="audit-category-filter"
              v-model="auditCategory"
              class="w-full h-8 px-2.5 text-xs bg-surface border border-input rounded-md"
              @change="onCategoryChange"
            >
              <option v-for="c in AUDIT_CATEGORIES" :key="c" :value="c">
                {{ c === 'ALL' ? 'All Categories' : c }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Quick Date Range</label>
            <select
              id="audit-date-preset"
              v-model="auditDatePreset"
              class="w-full h-8 px-2.5 text-xs bg-surface border border-input rounded-md"
              @change="applyDatePreset(auditDatePreset)"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        <div v-if="auditDatePreset === 'custom'" class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2 border-t border-border/50">
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Date From</label>
            <Input
              id="audit-date-from"
              v-model="auditDateFrom"
              type="date"
              class="h-8 bg-surface text-xs font-mono"
              @change="onCustomDateChange"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-muted-foreground mb-1">Date To</label>
            <Input
              id="audit-date-to"
              v-model="auditDateTo"
              type="date"
              class="h-8 bg-surface text-xs font-mono"
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

    <!-- ============ STAFF FORM MODAL ============ -->
    <Dialog :open="isFormModalOpen" @update:open="(val) => { if (!val) closeFormModal(); }">
      <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="font-display">
            {{ editingUser ? `Edit Staff — ${editingUser.name}` : 'Create New Staff Member' }}
          </DialogTitle>
          <DialogDescription>
            Configure user personal credentials, role hierarchy tier, and store department assignment.
          </DialogDescription>
        </DialogHeader>

        <!-- Form Error Alert -->
        <Alert v-if="formError" variant="error" class="mb-2">
          {{ formError }}
        </Alert>

        <form @submit.prevent="submitUserForm" class="flex flex-col gap-3 py-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
              <Input
                id="form-user-name"
                v-model="userForm.name"
                type="text"
                placeholder="e.g. Alex Mercer"
                class="h-9 bg-surface text-sm"
              />
              <span v-if="fieldErrors.name" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.name }}</span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Email Address *</label>
              <Input
                id="form-user-email"
                v-model="userForm.email"
                type="email"
                placeholder="e.g. alex@store.com"
                class="h-9 bg-surface text-sm font-mono"
              />
              <span v-if="fieldErrors.email" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.email }}</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
              <Input
                id="form-user-phone"
                v-model="userForm.phone"
                type="tel"
                placeholder="e.g. +855 12 345 678"
                class="h-9 bg-surface text-sm font-mono"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Role *</label>
              <select
                id="form-user-role"
                v-model="userForm.role"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              >
                <option v-for="r in ROLE_OPTIONS" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Department</label>
              <select
                id="form-user-department"
                v-model="userForm.department"
                class="w-full h-9 px-3 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              >
                <option value="">— Select Department —</option>
                <option v-for="d in DEPARTMENT_OPTIONS" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Hire Date</label>
              <Input
                id="form-user-hire-date"
                v-model="userForm.hire_date"
                type="date"
                class="h-9 bg-surface text-sm font-mono"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">Base Salary (USD)</label>
              <Input
                id="form-user-salary"
                v-model="userForm.base_salary"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="h-9 bg-surface text-sm font-mono"
              />
              <span v-if="fieldErrors.base_salary" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.base_salary }}</span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-foreground mb-1">
                {{ editingUser ? 'New Password (leave blank to keep)' : 'Password *' }}
              </label>
              <Input
                id="form-user-password"
                v-model="userForm.password"
                type="password"
                :placeholder="editingUser ? 'Leave blank to keep current' : 'At least 8 characters'"
                class="h-9 bg-surface text-sm font-mono"
              />
              <span v-if="fieldErrors.password" class="text-[11px] text-destructive mt-0.5 block">{{ fieldErrors.password }}</span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-foreground mb-1">Notes</label>
            <textarea
              id="form-user-notes"
              v-model="userForm.notes"
              rows="2"
              placeholder="Internal notes about this staff member (role, shift, etc.)…"
              class="w-full px-3 py-2 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
            ></textarea>
          </div>

          <div
            v-if="!editingUser || editingUser.role !== 'SUPER_ADMIN'"
            class="flex items-center justify-between pt-2 border-t border-border"
          >
            <div>
              <span class="font-semibold text-xs text-foreground block">Account Active</span>
              <span class="text-[11px] text-muted-foreground">
                Inactive accounts cannot sign in or perform operations.
              </span>
            </div>
            <Switch
              :checked="userForm.is_active"
              @update:checked="(val) => userForm.is_active = val"
            />
          </div>

          <DialogFooter class="gap-2 sm:gap-0 mt-4">
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
              :disabled="formSaving"
            >
              <span v-if="formSaving" class="animate-spin mr-1">⏳</span>
              <span>{{ formSaving ? 'Saving…' : (editingUser ? 'Update Staff' : 'Create Staff Account') }}</span>
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
