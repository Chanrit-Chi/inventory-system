import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { UserAccount, UserRole, PermissionGroup, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { adminUserSchema, AdminUserFormValues } from '../utils/validation'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'
import { copyToClipboard } from '../utils/clipboard'
import { generateSecureTemporaryPassword } from '../utils/password'
import {
  fetchUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  fetchAuditLogs,
  type AuditLogEntry,
} from '../api/endpoints'
import { StaffDetailModal } from '../components/StaffDetailModal'
import { styles } from './admin_users/AdminUsersScreen.styles'
import { AuditCalendarModal } from './admin_users/components/AuditCalendarModal'
import { UserFormModal } from './admin_users/components/UserFormModal'
import {
  AuditLogTab,
  DateRangeMode,
  AuditCategory,
} from './admin_users/components/AuditLogTab'
import { StaffManagementTab } from './admin_users/components/StaffManagementTab'
import { PermissionsMatrixTab } from './admin_users/components/PermissionsMatrixTab'

export interface AdminUsersScreenProps {
  onNavigate: (tab: TabType) => void
}

const DEFAULT_GROUPS: PermissionGroup[] = [
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

export const AdminUsersScreen: React.FC<AdminUsersScreenProps> = ({ onNavigate }) => {
  const { showToast } = useToast()
  const { currentUser } = useAuth()
  const { can } = usePermissions()
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'audit'>('users')
  const [users, setUsers] = useState<UserAccount[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const groups = useMemo<PermissionGroup[]>(() => {
    return DEFAULT_GROUPS.map((grp) => ({
      ...grp,
      userCount: users.filter((u) => u.role === grp.slug).length,
    }))
  }, [users])

  // Audit Log State with Infinite Scrolling & Filters
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditRefreshing, setAuditRefreshing] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditHasMore, setAuditHasMore] = useState(true)
  const [auditLoadingMore, setAuditLoadingMore] = useState(false)

  const [auditSearchQuery, setAuditSearchQuery] = useState('')
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<AuditCategory>('ALL')
  const [auditDateRange, setAuditDateRange] = useState<DateRangeMode>('all')
  const [auditSingleDate, setAuditSingleDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [auditCustomFrom, setAuditCustomFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  )
  const [auditCustomTo, setAuditCustomTo] = useState<string>(new Date().toISOString().split('T')[0])

  // Custom Calendar Modal State
  const [customRangeModalOpen, setCustomRangeModalOpen] = useState(false)
  const [tempMode, setTempMode] = useState<'single' | 'custom'>('custom')
  const [tempSingleDate, setTempSingleDate] = useState(auditSingleDate)
  const [tempCustomFrom, setTempCustomFrom] = useState(auditCustomFrom)
  const [tempCustomTo, setTempCustomTo] = useState(auditCustomTo)

  const debouncedAuditSearch = useDebounce(auditSearchQuery, 500)

  // Calculate active date bounds for backend and client filtering
  const activeAuditDateBounds = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (auditDateRange === 'today') {
      return { from: todayStr, to: todayStr }
    }
    if (auditDateRange === '7d') {
      const fromStr = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
      return { from: fromStr, to: todayStr }
    }
    if (auditDateRange === '30d') {
      const fromStr = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
      return { from: fromStr, to: todayStr }
    }
    if (auditDateRange === 'year') {
      const thisYear = new Date().getFullYear()
      return { from: `${thisYear}-01-01`, to: todayStr }
    }
    if (auditDateRange === 'single') {
      return { from: auditSingleDate, to: auditSingleDate }
    }
    if (auditDateRange === 'custom') {
      return { from: auditCustomFrom, to: auditCustomTo }
    }
    return { from: undefined, to: undefined }
  }, [auditDateRange, auditSingleDate, auditCustomFrom, auditCustomTo])

  // Create / Edit User Modal
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [, setSaving] = useState(false)

  // Post-Creation Credentials Modal
  const [createdCredentialsModalOpen, setCreatedCredentialsModalOpen] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string
    email: string
    role: string
    temporaryPassword: string
  } | null>(null)
  const [showCreatedPassword, setShowCreatedPassword] = useState(true)

  // Staff Detail & Performance Modal
  const [selectedDetailUser, setSelectedDetailUser] = useState<UserAccount | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  const { control, handleSubmit, reset, watch, setValue } = useForm<AdminUserFormValues>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'SELLER',
      department: 'Main Counter',
      hire_date: new Date().toISOString().split('T')[0],
      notes: '',
      base_salary: '',
      salary_reason: 'Initial Starting Salary Package',
      isActive: true,
    },
  })

  const formRole = watch('role')
  const formIsActive = watch('isActive')
  const formSalary = watch('base_salary')
  const numericSalary = parseFloat(formSalary || '0') || 0
  const formDailyRate = numericSalary > 0 ? (numericSalary / 26).toFixed(2) : '0.00'
  const formThirteenthMonthAccrual = numericSalary > 0 ? (numericSalary / 12).toFixed(2) : '0.00'

  // Load users from API on mount
  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch {
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Fetch Audit Logs with Pagination & Infinite Scroll
  const fetchAuditLogsData = useCallback(
    async (pageNum = 1, isLoadMore = false) => {
      try {
        if (pageNum === 1) {
          setAuditLoading(true)
        } else {
          setAuditLoadingMore(true)
        }

        const res = await fetchAuditLogs({
          page: pageNum,
          per_page: 15,
          search: debouncedAuditSearch.trim() || undefined,
          category: auditCategoryFilter === 'ALL' ? undefined : auditCategoryFilter,
          date_from: activeAuditDateBounds.from,
          date_to: activeAuditDateBounds.to,
        })

        let rawList: AuditLogEntry[] = [];
        if (Array.isArray(res)) {
          rawList = res;
        } else if (res && Array.isArray(res.data)) {
          rawList = res.data;
        } else if (res && (res as any).data && Array.isArray((res as any).data.data)) {
          rawList = (res as any).data.data;
        }

        if (pageNum === 1) {
          setAuditLogs(rawList)
        } else {
          if (rawList.length > 0) {
            setAuditLogs((prev) => {
              const existingIds = new Set(prev.map((l) => l.id))
              const uniqueNew = rawList.filter((l) => !existingIds.has(l.id))
              return [...prev, ...uniqueNew]
            })
          }
        }

        setAuditHasMore(rawList.length >= 15)
        setAuditPage(pageNum)
      } catch {
        if (pageNum === 1) {
          setAuditLogs([])
        }
        setAuditHasMore(false)
      } finally {
        setAuditLoading(false)
        setAuditLoadingMore(false)
        setAuditRefreshing(false)
      }
    },
    [debouncedAuditSearch, auditCategoryFilter, activeAuditDateBounds.from, activeAuditDateBounds.to]
  )

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogsData(1, false)
    }
  }, [activeTab, fetchAuditLogsData])

  const onAuditRefresh = useCallback(() => {
    setAuditRefreshing(true)
    fetchAuditLogsData(1, false)
  }, [fetchAuditLogsData])

  // Category counts
  const auditCounts = useMemo(() => {
    const all = auditLogs.length
    let security = 0
    let inventory = 0
    let orders = 0
    let billing = 0
    let staff = 0
    for (const log of auditLogs) {
      const cat = log.category || ''
      const act = log.action || ''
      if (cat === 'SECURITY' || act.includes('LOGIN') || act.includes('AUTH')) security++
      else if (cat === 'INVENTORY' || act.includes('STOCK') || act.includes('RESTOCK') || act.includes('ADJUST')) inventory++
      else if (cat === 'ORDERS' || act.includes('ORDER') || act.includes('SALE')) orders++
      else if (cat === 'BILLING' || act.includes('INVOICE') || act.includes('EXPENSE')) billing++
      else if (cat === 'STAFF' || act.includes('USER') || act.includes('ROLE')) staff++
    }
    return { all, security, inventory, orders, billing, staff }
  }, [auditLogs])

  // Client filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Category filter
      if (auditCategoryFilter !== 'ALL') {
        const cat = log.category || ''
        const act = log.action || ''
        if (auditCategoryFilter === 'SECURITY' && !(cat === 'SECURITY' || act.includes('LOGIN') || act.includes('AUTH'))) return false
        if (auditCategoryFilter === 'INVENTORY' && !(cat === 'INVENTORY' || act.includes('STOCK') || act.includes('RESTOCK') || act.includes('ADJUST'))) return false
        if (auditCategoryFilter === 'ORDERS' && !(cat === 'ORDERS' || act.includes('ORDER') || act.includes('SALE'))) return false
        if (auditCategoryFilter === 'BILLING' && !(cat === 'BILLING' || act.includes('INVOICE') || act.includes('EXPENSE'))) return false
        if (auditCategoryFilter === 'STAFF' && !(cat === 'STAFF' || act.includes('USER') || act.includes('ROLE'))) return false
      }

      // Client date bounds filter if created_at exists
      if (log.created_at && (activeAuditDateBounds.from || activeAuditDateBounds.to)) {
        const datePart = log.created_at.split('T')[0]
        if (activeAuditDateBounds.from && datePart < activeAuditDateBounds.from) return false
        if (activeAuditDateBounds.to && datePart > activeAuditDateBounds.to) return false
      }

      // Search query filter
      if (debouncedAuditSearch.trim()) {
        const q = debouncedAuditSearch.toLowerCase().trim()
        const match =
          (log.action || '').toLowerCase().includes(q) ||
          (log.target || '').toLowerCase().includes(q) ||
          (log.by || '').toLowerCase().includes(q) ||
          (log.category || '').toLowerCase().includes(q) ||
          (log.details && log.details.toLowerCase().includes(q))
        if (!match) return false
      }

      return true
    })
  }, [auditLogs, auditCategoryFilter, activeAuditDateBounds, debouncedAuditSearch])

  // Date picker helpers
  const handleOpenCustomModal = () => {
    setTempMode(auditDateRange === 'single' ? 'single' : 'custom')
    setTempSingleDate(auditSingleDate)
    setTempCustomFrom(auditCustomFrom)
    setTempCustomTo(auditCustomTo)
    setCustomRangeModalOpen(true)
  }

  const handleApplyCustomDates = () => {
    if (tempMode === 'single') {
      setAuditDateRange('single')
      setAuditSingleDate(tempSingleDate)
    } else {
      setAuditDateRange('custom')
      setAuditCustomFrom(tempCustomFrom)
      setAuditCustomTo(tempCustomTo)
    }
    setCustomRangeModalOpen(false)
  }

  const handleDayPress = (day: { dateString: string }) => {
    const selected = day.dateString
    if (tempMode === 'single') {
      setTempSingleDate(selected)
      return
    }

    if (!tempCustomFrom || (tempCustomFrom && tempCustomTo)) {
      setTempCustomFrom(selected)
      setTempCustomTo('')
    } else {
      if (selected < tempCustomFrom) {
        setTempCustomTo(tempCustomFrom)
        setTempCustomFrom(selected)
      } else {
        setTempCustomTo(selected)
      }
    }
  }

  const getRangeMarkedDates = () => {
    const marks: Record<string, {
      startingDay?: boolean;
      endingDay?: boolean;
      color: string;
      textColor: string;
      selected: boolean;
      selectedColor: string;
    }> = {}
    if (tempCustomFrom) {
      marks[tempCustomFrom] = {
        startingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: 'white',
        selected: true,
        selectedColor: tokens.colors.primaryContainer,
      }
    }
    if (tempCustomTo) {
      marks[tempCustomTo] = {
        endingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: 'white',
        selected: true,
        selectedColor: tokens.colors.primaryContainer,
      }

      let curr = new Date(tempCustomFrom)
      curr.setDate(curr.getDate() + 1)
      const end = new Date(tempCustomTo)
      while (curr < end) {
        const dateStr = curr.toISOString().split('T')[0]
        marks[dateStr] = {
          color: tokens.colors.primaryContainer + '40',
          textColor: tokens.colors.onBackground,
          selected: true,
          selectedColor: tokens.colors.primaryContainer + '40',
        }
        curr.setDate(curr.getDate() + 1)
      }
    }
    return marks
  }

  const getDateLabel = () => {
    if (auditDateRange === 'single') return auditSingleDate
    if (auditDateRange === 'custom') {
      return `${new Date(auditCustomFrom).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${new Date(auditCustomTo).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`
    }
    if (auditDateRange === 'today') return 'Today'
    if (auditDateRange === '7d') return '7 Days'
    if (auditDateRange === '30d') return '30 Days'
    if (auditDateRange === 'year') return 'Year'
    return 'All Time'
  }

  const handleOpenCreate = () => {
    const initialTempPass = generateSecureTemporaryPassword(10)
    setEditingUser(null)
    reset({
      name: '',
      email: '',
      phone: '',
      password: initialTempPass,
      role: 'SELLER',
      department: 'Main Counter',
      hire_date: new Date().toISOString().split('T')[0],
      notes: '',
      base_salary: '',
      salary_reason: 'Initial Starting Salary Package',
      isActive: true,
      is_test_account: false,
    })
    setUserModalOpen(true)
  }

  const handleOpenEdit = (u: UserAccount) => {
    setEditingUser(u)
    reset({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      password: '',
      role: u.role,
      department: u.department || 'Main Counter',
      hire_date: u.hire_date || new Date().toISOString().split('T')[0],
      notes: u.notes || '',
      base_salary: u.base_salary !== undefined && u.base_salary !== null ? String(u.base_salary) : '',
      salary_reason: u.salary_reason || 'Salary Adjustment',
      isActive: u.isActive,
      is_test_account: Boolean(u.is_test_account ?? u.isTestAccount),
    })
    setUserModalOpen(true)
  }

  const onSubmit = async (data: AdminUserFormValues) => {
    setSaving(true)
    try {
      const parsedSalary = data.base_salary && !isNaN(Number(data.base_salary)) ? Number(data.base_salary) : undefined

      if (editingUser) {
        let updated: UserAccount
        try {
          updated = await updateUser(editingUser.id, {
            name: data.name,
            email: data.email,
            phone: data.phone || '',
            role: data.role,
            department: data.department || '',
            hire_date: data.hire_date || '',
            notes: data.notes || '',
            base_salary: parsedSalary,
            salary_reason: data.salary_reason || '',
            isActive: data.isActive,
            is_test_account: data.is_test_account,
          })
        } catch {
          updated = {
            ...editingUser,
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            department: data.department,
            hire_date: data.hire_date,
            notes: data.notes,
            base_salary: parsedSalary,
            salary_reason: data.salary_reason,
            isActive: data.isActive,
            is_test_account: data.is_test_account,
            isTestAccount: data.is_test_account,
          }
        }
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)))
        if (selectedDetailUser?.id === editingUser.id) {
          setSelectedDetailUser(updated)
        }
        showToast(`${data.name} updated.`, 'success')
        setUserModalOpen(false)
      } else {
        const temporaryPassword = data.password && data.password.length >= 8
          ? data.password
          : generateSecureTemporaryPassword(10)

        let newU: UserAccount
        try {
          newU = await createUser({
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            password: temporaryPassword,
            department: data.department || 'Main Counter',
            hire_date: data.hire_date || new Date().toISOString().split('T')[0],
            notes: data.notes,
            base_salary: parsedSalary,
            salary_reason: data.salary_reason || 'Initial Starting Salary Package',
            is_test_account: data.is_test_account,
          })
        } catch {
          newU = {
            id: `usr-${Date.now()}`,
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            department: data.department || 'Main Counter',
            hire_date: data.hire_date || new Date().toISOString().split('T')[0],
            notes: data.notes,
            base_salary: parsedSalary || 0,
            salary_reason: data.salary_reason,
            isActive: true,
            is_test_account: data.is_test_account,
            isTestAccount: data.is_test_account,
            must_change_password: true,
            mustChangePassword: true,
            createdAt: new Date().toISOString(),
          }
        }
        setUsers((prev) => [newU, ...prev])
        setCreatedCredentials({
          name: data.name,
          email: data.email,
          role: data.role,
          temporaryPassword: (newU as any).temporary_password || temporaryPassword,
        })
        setUserModalOpen(false)
        setCreatedCredentialsModalOpen(true)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = (user: UserAccount) => {
    if (user.role === 'SUPER_ADMIN') {
      Alert.alert('Action Denied', 'The Super Admin account cannot be deleted.')
      return
    }
    Alert.alert(
      'Delete Staff Account',
      `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUsers((prev) => prev.filter((u) => u.id !== user.id))
            try {
              await deleteUser(user.id)
              showToast(`${user.name} deleted.`, 'success')
            } catch {
              showToast(`${user.name} deleted.`, 'success')
            }
          },
        },
      ]
    )
  }

  const handleToggleActive = async (user: UserAccount) => {
    if (user.role === 'SUPER_ADMIN') {
      Alert.alert('Protected Account', 'The Super Admin account cannot be deactivated.')
      return
    }
    const newActive = !user.isActive
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: newActive } : u)))
    try {
      await toggleUserStatus(user.id, newActive)
      showToast(`${user.name} is now ${newActive ? 'Active' : 'Deactivated'}.`, 'info')
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !newActive } : u)))
      showToast('Failed to update status. Please try again.', 'error')
    }
  }

  if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN') {
    return (
      <View style={[styles.container, styles.unauthorizedContainer]}>
        <View style={styles.unauthorizedBox}>
          <View style={styles.unauthorizedIconCircle}>
            <Ionicons name="shield-outline" size={36} color={tokens.colors.statusError} />
          </View>
          <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
          <Text style={styles.unauthorizedSub}>
            Staff & User Management is strictly restricted to Administrators.
          </Text>
          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={() => onNavigate('home')}
            activeOpacity={0.85}
          >
            <Ionicons name="home" size={16} color={tokens.colors.onPrimary} />
            <Text style={styles.backHomeBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Compact row: sub-tabs + add user icon */}
      <View style={styles.compactHeaderRow}>
        <View style={styles.subTabs}>
          <TouchableOpacity
            style={[styles.subTabBtn, activeTab === 'users' && styles.subTabBtnActive]}
            onPress={() => setActiveTab('users')}
          >
            <Text style={[styles.subTabText, activeTab === 'users' && styles.subTabTextActive]} numberOfLines={1}>Staff</Text>
          </TouchableOpacity>
          {Boolean(can('roles:manage')) && (
            <TouchableOpacity
              style={[styles.subTabBtn, activeTab === 'permissions' && styles.subTabBtnActive]}
              onPress={() => setActiveTab('permissions')}
            >
              <Text style={[styles.subTabText, activeTab === 'permissions' && styles.subTabTextActive]} numberOfLines={1}>Permissions</Text>
            </TouchableOpacity>
          )}
          {Boolean(can('audit:view')) && (
            <TouchableOpacity
              style={[styles.subTabBtn, activeTab === 'audit' && styles.subTabBtnActive]}
              onPress={() => setActiveTab('audit')}
            >
              <Text style={[styles.subTabText, activeTab === 'audit' && styles.subTabTextActive]} numberOfLines={1}>Audit Log</Text>
            </TouchableOpacity>
          )}
        </View>
        {Boolean(activeTab === 'users' && can('users:manage')) && (
          <TouchableOpacity style={styles.addIconBtn} onPress={handleOpenCreate} accessibilityLabel="Add User">
            <Ionicons name="person-add" size={17} color={tokens.colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* AUDIT LOG TAB */}
      {activeTab === 'audit' ? (
        <AuditLogTab
          filteredAuditLogs={filteredAuditLogs}
          auditSearchQuery={auditSearchQuery}
          setAuditSearchQuery={setAuditSearchQuery}
          auditDateRange={auditDateRange}
          setAuditDateRange={setAuditDateRange}
          auditCategoryFilter={auditCategoryFilter}
          setAuditCategoryFilter={setAuditCategoryFilter}
          auditCounts={auditCounts}
          auditLoading={auditLoading}
          auditLoadingMore={auditLoadingMore}
          auditRefreshing={auditRefreshing}
          auditHasMore={auditHasMore}
          auditPage={auditPage}
          onAuditRefresh={onAuditRefresh}
          onLoadMore={() => fetchAuditLogsData(auditPage + 1, true)}
          onOpenCustomModal={handleOpenCustomModal}
          getDateLabel={getDateLabel}
        />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* USERS ROSTER */}
          {activeTab === 'users' && (
            <StaffManagementTab
              users={users}
              usersLoading={usersLoading}
              canManage={Boolean(can('users:manage'))}
              onSelectUserDetail={(u) => {
                setSelectedDetailUser(u)
                setDetailModalOpen(true)
              }}
              onOpenEdit={handleOpenEdit}
              onToggleActive={handleToggleActive}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {/* PERMISSION MATRIX */}
          {activeTab === 'permissions' && (
            <PermissionsMatrixTab
              groups={groups}
              onNavigate={onNavigate}
            />
          )}
        </ScrollView>
      )}

      {/* User Create / Edit Modal */}
      <UserFormModal
        visible={userModalOpen}
        editingUser={editingUser}
        control={control}
        setValue={setValue}
        formRole={formRole}
        formIsActive={formIsActive}
        formDailyRate={formDailyRate}
        formThirteenthMonthAccrual={formThirteenthMonthAccrual}
        onClose={() => setUserModalOpen(false)}
        onSubmit={handleSubmit(onSubmit)}
      />

      {/* Custom Date Picker Modal */}
      <AuditCalendarModal
        visible={customRangeModalOpen}
        tempMode={tempMode}
        setTempMode={setTempMode}
        tempSingleDate={tempSingleDate}
        setTempSingleDate={setTempSingleDate}
        tempCustomFrom={tempCustomFrom}
        setTempCustomFrom={setTempCustomFrom}
        tempCustomTo={tempCustomTo}
        setTempCustomTo={setTempCustomTo}
        onClose={() => setCustomRangeModalOpen(false)}
        onDayPress={handleDayPress}
        onApply={handleApplyCustomDates}
        getRangeMarkedDates={getRangeMarkedDates}
      />

      {/* Staff Detail & Performance Modal */}
      <StaffDetailModal
        visible={detailModalOpen}
        user={selectedDetailUser}
        onClose={() => setDetailModalOpen(false)}
        onEditProfile={handleOpenEdit}
        onStatusToggle={handleToggleActive}
      />

      {/* Post-Creation Staff Credentials Dialog */}
      <Modal
        visible={createdCredentialsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatedCredentialsModalOpen(false)}
      >
        <View style={styles.credDialogOverlay}>
          <View style={styles.credDialogCard}>
            <View style={styles.credDialogHeader}>
              <View style={styles.credDialogIconBox}>
                <Ionicons name="checkmark-circle" size={32} color={tokens.colors.statusSuccess} />
              </View>
              <Text style={styles.credDialogTitle}>Staff Account Created</Text>
              <Text style={styles.credDialogSub}>
                Share these temporary credentials with the staff member.
              </Text>
            </View>

            {Boolean(createdCredentials) && (
              <View style={styles.credFieldsBox}>
                <View style={styles.credFieldRow}>
                  <Text style={styles.credFieldLabel}>Name</Text>
                  <Text style={styles.credFieldValue}>{createdCredentials?.name}</Text>
                </View>
                <View style={styles.credFieldRow}>
                  <Text style={styles.credFieldLabel}>Email / Login</Text>
                  <Text style={styles.credFieldValue}>{createdCredentials?.email}</Text>
                </View>
                <View style={styles.credFieldRow}>
                  <Text style={styles.credFieldLabel}>Role</Text>
                  <Text style={styles.credFieldValue}>{createdCredentials?.role}</Text>
                </View>
                <View style={styles.credFieldRow}>
                  <Text style={styles.credFieldLabel}>Temp Password</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.credFieldPassword}>
                      {showCreatedPassword ? createdCredentials?.temporaryPassword : '••••••••••'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowCreatedPassword((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showCreatedPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={16}
                        color={tokens.colors.secondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.credNoticeBox}>
              <Ionicons name="shield-checkmark" size={16} color="#B45309" />
              <Text style={styles.credNoticeText}>
                The user will be required to change this temporary password upon their first login.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.credCopyBtn}
              onPress={() => {
                if (createdCredentials) {
                  const payload = `KC Inventory Account Credentials:\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.temporaryPassword}\nRole: ${createdCredentials.role}`
                  copyToClipboard(payload, { label: 'Credentials' })
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="copy" size={16} color={tokens.colors.onPrimary} />
              <Text style={styles.credCopyBtnText}>Copy All Credentials</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.credDoneBtn}
              onPress={() => {
                setCreatedCredentialsModalOpen(false)
                setCreatedCredentials(null)
              }}
            >
              <Text style={styles.credDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

export default AdminUsersScreen
