import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar } from 'react-native-calendars'
import { tokens } from '../theme/tokens'
import type { UserAccount, UserRole, PermissionGroup, TabType } from '../types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { adminUserSchema, AdminUserFormValues } from '../utils/validation'
import { ControlledInput } from '../components/ControlledInput'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { usePermissions } from '../hooks/usePermissions'
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

export interface AdminUsersScreenProps {
  onNavigate: (tab: TabType) => void
}

type DateRangeMode = 'all' | 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'
type AuditCategory = 'ALL' | 'SECURITY' | 'INVENTORY' | 'ORDERS' | 'BILLING' | 'STAFF'

export const SAMPLE_AUDIT_LOGS: AuditLogEntry[] = []

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

function getAuditActionMeta(action: string, category?: string) {
  const act = action.toUpperCase()
  if (act.includes('LOGIN') || act.includes('AUTH') || category === 'SECURITY') {
    return {
      icon: 'shield-checkmark' as const,
      color: tokens.colors.primaryContainer,
      bg: tokens.colors.actionPrimaryBg,
      badgeBg: '#EDE9FE',
      badgeText: '#5B21B6',
    }
  }
  if (act.includes('STOCK') || act.includes('ADJUST') || act.includes('RESTOCK') || category === 'INVENTORY') {
    return {
      icon: 'cube' as const,
      color: '#EA580C',
      bg: '#FFF7ED',
      badgeBg: '#FFEDD5',
      badgeText: '#C2410C',
    }
  }
  if (act.includes('ORDER') || act.includes('SALE') || category === 'ORDERS') {
    return {
      icon: 'cart' as const,
      color: '#0284C7',
      bg: '#F0F9FF',
      badgeBg: '#E0F2FE',
      badgeText: '#0369A1',
    }
  }
  if (act.includes('INVOICE') || act.includes('BILL') || act.includes('EXPENSE') || category === 'BILLING') {
    return {
      icon: 'receipt' as const,
      color: '#059669',
      bg: '#ECFDF5',
      badgeBg: '#D1FAE5',
      badgeText: '#047857',
    }
  }
  if (act.includes('USER') || act.includes('ROLE') || act.includes('PERM') || category === 'STAFF') {
    return {
      icon: 'people' as const,
      color: '#7C3AED',
      bg: '#F5F3FF',
      badgeBg: '#EDE9FE',
      badgeText: '#6D28D9',
    }
  }
  return {
    icon: 'time' as const,
    color: tokens.colors.secondary,
    bg: tokens.colors.surfaceMuted,
    badgeBg: tokens.colors.surfaceMuted,
    badgeText: tokens.colors.secondary,
  }
}

interface AuditLogRowItemProps {
  log: AuditLogEntry
}

const AuditLogRowItem: React.FC<AuditLogRowItemProps> = React.memo(({ log }) => {
  const meta = getAuditActionMeta(log.action, log.category)
  return (
    <View style={styles.auditCard}>
      <View style={styles.auditCardTop}>
        <View style={[styles.auditCardIconBox, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <View style={[styles.auditActionBadge, { backgroundColor: meta.badgeBg }]}>
              <Text style={[styles.auditActionBadgeText, { color: meta.badgeText }]}>
                {log.action}
              </Text>
            </View>
            <Text style={styles.auditTimeText}>{log.time}</Text>
          </View>
          <Text style={styles.auditTargetText} numberOfLines={2}>
            {log.target}
          </Text>
        </View>
      </View>

      {Boolean(log.details || log.by) && (
        <>
          <View style={styles.auditCardDivider} />
          <View style={styles.auditCardBottom}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Ionicons name="person-circle-outline" size={14} color={tokens.colors.secondary} />
              <Text style={styles.auditActorText} numberOfLines={1}>
                By: <Text style={{ fontWeight: '700', color: tokens.colors.onBackground }}>{log.by}</Text>
              </Text>
            </View>
            {Boolean(log.details) && (
              <Text style={styles.auditDetailsText} numberOfLines={1}>
                {log.details}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  )
})

export const AdminUsersScreen: React.FC<AdminUsersScreenProps> = ({ onNavigate }) => {
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
  const [saving, setSaving] = useState(false)

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

  // Fetch Audit Logs with Pagination & Infinite Scroll (same architecture as Transactions)
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

        const rawList: AuditLogEntry[] =
          res?.data && Array.isArray(res.data)
            ? res.data
            : (res as any)?.data?.data && Array.isArray((res as any).data.data)
            ? (res as any).data.data
            : []

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
    const marks: any = {}
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

  const getActionMeta = (action: string, category?: string) => {
    const act = action.toUpperCase()
    if (act.includes('LOGIN') || act.includes('AUTH') || category === 'SECURITY') {
      return {
        icon: 'shield-checkmark' as const,
        color: tokens.colors.primaryContainer,
        bg: tokens.colors.actionPrimaryBg,
        badgeBg: '#EDE9FE',
        badgeText: '#5B21B6',
      }
    }
    if (act.includes('STOCK') || act.includes('ADJUST') || act.includes('RESTOCK') || category === 'INVENTORY') {
      return {
        icon: 'cube' as const,
        color: '#EA580C',
        bg: '#FFF7ED',
        badgeBg: '#FFEDD5',
        badgeText: '#C2410C',
      }
    }
    if (act.includes('ORDER') || act.includes('SALE') || category === 'ORDERS') {
      return {
        icon: 'cart' as const,
        color: '#0284C7',
        bg: '#F0F9FF',
        badgeBg: '#E0F2FE',
        badgeText: '#0369A1',
      }
    }
    if (act.includes('INVOICE') || act.includes('BILL') || act.includes('EXPENSE') || category === 'BILLING') {
      return {
        icon: 'receipt' as const,
        color: '#059669',
        bg: '#ECFDF5',
        badgeBg: '#D1FAE5',
        badgeText: '#047857',
      }
    }
    if (act.includes('USER') || act.includes('ROLE') || act.includes('PERM') || category === 'STAFF') {
      return {
        icon: 'people' as const,
        color: '#7C3AED',
        bg: '#F5F3FF',
        badgeBg: '#EDE9FE',
        badgeText: '#6D28D9',
      }
    }
    return {
      icon: 'time' as const,
      color: tokens.colors.secondary,
      bg: tokens.colors.surfaceMuted,
      badgeBg: tokens.colors.surfaceMuted,
      badgeText: tokens.colors.secondary,
    }
  }

  const handleOpenCreate = () => {
    setEditingUser(null)
    reset({
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
          }
        }
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)))
        if (selectedDetailUser?.id === editingUser.id) {
          setSelectedDetailUser(updated)
        }
        Alert.alert('Success', `${data.name} updated.`)
      } else {
        if (!data.password || data.password.length < 8) {
          Alert.alert('Validation Error', 'Password must be at least 8 characters')
          setSaving(false)
          return
        }
        let newU: UserAccount
        try {
          newU = await createUser({
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            password: data.password,
            department: data.department || 'Main Counter',
            hire_date: data.hire_date || new Date().toISOString().split('T')[0],
            notes: data.notes,
            base_salary: parsedSalary,
            salary_reason: data.salary_reason || 'Initial Starting Salary Package',
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
            createdAt: new Date().toISOString(),
          }
        }
        setUsers((prev) => [newU, ...prev])
        Alert.alert('Success', `Staff account for ${data.name} created.`)
      }
      setUserModalOpen(false)
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
            } catch {
              // Ignore fallback
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
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !newActive } : u)))
      Alert.alert('Error', 'Failed to update status. Please try again.')
      return
    }
    Alert.alert('Status Updated', `${user.name} is now ${newActive ? 'Active' : 'Deactivated'}.`)
  }

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { bg: '#EDE9FE', text: '#5B21B6' }
      case 'ADMIN':
        return { bg: '#E0F2FE', text: '#0369A1' }
      case 'MANAGER':
        return { bg: '#FEF3C7', text: '#B45309' }
      case 'SELLER':
        return { bg: '#E6F4EA', text: '#15803D' }
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

      {/* AUDIT LOG TAB: Dedicated FlatList with Infinite Scrolling, Search, Filters, Summary */}
      {activeTab === 'audit' ? (
        <FlatList
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={filteredAuditLogs}
          keyExtractor={(item, idx) => item.id || `audit-item-${idx}`}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={auditRefreshing}
              onRefresh={onAuditRefresh}
              tintColor={tokens.colors.primaryContainer}
              colors={[tokens.colors.primaryContainer]}
            />
          }
          onEndReached={() => {
            if (!auditLoading && !auditLoadingMore && auditHasMore) {
              fetchAuditLogsData(auditPage + 1, true)
            }
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <>
              {/* Search Toolbar */}
              <View style={styles.auditSearchBox}>
                <Ionicons
                  name="search"
                  size={16}
                  color={tokens.colors.secondary}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={styles.auditSearchInput}
                  placeholder="Search actions, targets, staff..."
                  placeholderTextColor={tokens.colors.secondaryFixedDim}
                  value={auditSearchQuery}
                  onChangeText={setAuditSearchQuery}
                  returnKeyType="search"
                />
                {auditSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setAuditSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Date Filter Quick Bar */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dateBarRow}
                contentContainerStyle={styles.dateBarContent}
              >
                <TouchableOpacity
                  style={[styles.dateBtn, auditDateRange === 'all' && styles.dateBtnActive]}
                  onPress={() => setAuditDateRange('all')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dateBtnText, auditDateRange === 'all' && styles.dateBtnTextActive]}>
                    All Time
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateBtn, auditDateRange === 'today' && styles.dateBtnActive]}
                  onPress={() => setAuditDateRange('today')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dateBtnText, auditDateRange === 'today' && styles.dateBtnTextActive]}>
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateBtn, auditDateRange === '7d' && styles.dateBtnActive]}
                  onPress={() => setAuditDateRange('7d')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dateBtnText, auditDateRange === '7d' && styles.dateBtnTextActive]}>
                    7 Days
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateBtn, auditDateRange === '30d' && styles.dateBtnActive]}
                  onPress={() => setAuditDateRange('30d')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dateBtnText, auditDateRange === '30d' && styles.dateBtnTextActive]}>
                    30 Days
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateBtn, auditDateRange === 'year' && styles.dateBtnActive]}
                  onPress={() => setAuditDateRange('year')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dateBtnText, auditDateRange === 'year' && styles.dateBtnTextActive]}>
                    Year
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateBtn,
                    (auditDateRange === 'single' || auditDateRange === 'custom') && styles.dateBtnActive,
                    { flexDirection: 'row', gap: 4 },
                  ]}
                  onPress={handleOpenCustomModal}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={13}
                    color={
                      auditDateRange === 'single' || auditDateRange === 'custom'
                        ? tokens.colors.onPrimary
                        : tokens.colors.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.dateBtnText,
                      (auditDateRange === 'single' || auditDateRange === 'custom') && styles.dateBtnTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {auditDateRange === 'single' || auditDateRange === 'custom' ? getDateLabel() : 'Custom'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Category Filter Chips Bar */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.statusChipsRow}
                contentContainerStyle={styles.statusChipsContent}
              >
                {[
                  { id: 'ALL' as const, label: 'All Events', count: auditCounts.all },
                  { id: 'SECURITY' as const, label: 'Security & Logins', count: auditCounts.security },
                  { id: 'INVENTORY' as const, label: 'Stock & Receiving', count: auditCounts.inventory },
                  { id: 'ORDERS' as const, label: 'Sales & Orders', count: auditCounts.orders },
                  { id: 'BILLING' as const, label: 'Billing & Invoices', count: auditCounts.billing },
                  { id: 'STAFF' as const, label: 'Staff & Roles', count: auditCounts.staff },
                ].map((st) => {
                  const isSelected = auditCategoryFilter === st.id
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.statusFilterChip, isSelected && styles.statusFilterChipActive]}
                      onPress={() => setAuditCategoryFilter(st.id)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.statusFilterChipText,
                          isSelected && styles.statusFilterChipTextActive,
                        ]}
                      >
                        {st.label}
                      </Text>
                      <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                        <Text
                          style={[
                            styles.countBadgeText,
                            isSelected && styles.countBadgeTextActive,
                          ]}
                        >
                          {st.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {/* Active Date Context Banner */}
              {auditDateRange !== 'all' && (
                <View style={styles.activeFilterBanner}>
                  <Ionicons name="time-outline" size={13} color={tokens.colors.primaryContainer} />
                  <Text style={styles.activeFilterBannerText}>
                    Period: <Text style={styles.activeFilterHighlight}>{getDateLabel()}</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setAuditDateRange('all')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Summary Metrics Banner */}
              <View style={styles.summaryBanner}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>TOTAL EVENTS</Text>
                  <Text style={styles.summaryValue}>{auditCounts.all}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>SECURITY LOGINS</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.primaryContainer }]}>
                    {auditCounts.security}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>STOCK MOVES</Text>
                  <Text style={[styles.summaryValue, { color: '#EA580C' }]}>
                    {auditCounts.inventory}
                  </Text>
                </View>
              </View>

              {/* Section Header */}
              <View style={styles.listSectionHeader}>
                <Text style={styles.listSectionTitle}>
                  Security & Audit Logs ({filteredAuditLogs.length})
                </Text>
                <Text style={styles.listSectionSub}>Scroll down for older history</Text>
              </View>
            </>
          }
          renderItem={({ item: log }) => <AuditLogRowItem log={log} />}
          ListEmptyComponent={
            auditLoading && !auditRefreshing ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                <Text style={styles.centerLoadingText}>Loading audit events...</Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="shield-outline"
                  size={44}
                  color={tokens.colors.secondaryFixedDim}
                />
                <Text style={styles.emptyTitle}>No audit records found</Text>
                <Text style={styles.emptySub}>
                  {auditSearchQuery
                    ? 'No events match your search. Try different keywords.'
                    : auditDateRange !== 'all'
                    ? `No events logged for the period (${getDateLabel()}).`
                    : 'No security or audit events found in this category.'}
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            auditLoadingMore ? (
              <View style={styles.loadingMoreRow}>
                <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                <Text style={styles.loadingMoreText}>Loading more audit logs...</Text>
              </View>
            ) : null
          }
        />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* USERS ROSTER */}
          {activeTab === 'users' && (
            <View>
              {usersLoading && users.length === 0 ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                  <Text style={styles.centerLoadingText}>Loading staff accounts...</Text>
                </View>
              ) : (
                users.map((u) => {
                  const badge = getRoleBadge(u.role)
                  const initial = u.name ? u.name.charAt(0).toUpperCase() : '?'

                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.userCard, !u.isActive && styles.userCardInactive]}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedDetailUser(u)
                        setDetailModalOpen(true)
                      }}
                    >
                      {/* Top Identity Block */}
                      <View style={styles.userCardTop}>
                        <View style={[styles.avatarBox, !u.isActive && styles.avatarBoxInactive]}>
                          <Text style={styles.avatarLetter}>{initial}</Text>
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <Text style={styles.userName} numberOfLines={1}>
                              {u.name}
                            </Text>
                            <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.roleBadgeText, { color: badge.text }]}>{u.role}</Text>
                            </View>
                          </View>

                          <Text style={styles.userEmail} numberOfLines={1}>
                            {u.email}
                          </Text>

                          <View style={styles.staffMetaRow}>
                            <View style={styles.deptBadge}>
                              <Ionicons name="business-outline" size={11} color={tokens.colors.secondary} />
                              <Text style={styles.deptBadgeText} numberOfLines={1}>{u.department || 'Main Counter'}</Text>
                            </View>
                            <View
                              style={[
                                styles.statusDotPill,
                                { backgroundColor: u.isActive ? tokens.colors.statusSuccess + '18' : '#FEE2E2' },
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDotSmall,
                                  { backgroundColor: u.isActive ? tokens.colors.statusSuccess : '#DC2626' },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.statusDotText,
                                  { color: u.isActive ? tokens.colors.statusSuccess : '#DC2626' },
                                ]}
                              >
                                {u.isActive ? 'Active' : 'Inactive'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Action Footer Toolbar */}
                      <View style={styles.userCardDivider} />

                      <View style={styles.userCardBottom}>
                        <TouchableOpacity
                          style={styles.statsPreviewBtn}
                          onPress={(e) => {
                            e.stopPropagation?.()
                            setSelectedDetailUser(u)
                            setDetailModalOpen(true)
                          }}
                        >
                          <Ionicons name="bar-chart" size={13} color={tokens.colors.primaryContainer} />
                          <Text style={styles.statsPreviewBtnText}>Performance & Raises</Text>
                          <Ionicons name="chevron-forward" size={12} color={tokens.colors.primaryContainer} />
                        </TouchableOpacity>

                        {Boolean(can('users:manage')) && (
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <TouchableOpacity
                              style={styles.cardActionIconBtn}
                              onPress={(e) => {
                                e.stopPropagation?.()
                                handleOpenEdit(u)
                              }}
                              accessibilityLabel={`Edit ${u.name}`}
                            >
                              <Ionicons name="pencil" size={13} color={tokens.colors.onBackground} />
                            </TouchableOpacity>

                            {u.role !== 'SUPER_ADMIN' && (
                              <TouchableOpacity
                                style={[styles.cardActionIconBtn, !u.isActive && styles.reactivateIconBtn]}
                                onPress={(e) => {
                                  e.stopPropagation?.()
                                  handleToggleActive(u)
                                }}
                                accessibilityLabel={u.isActive ? 'Deactivate user' : 'Reactivate user'}
                              >
                                <Ionicons
                                  name={u.isActive ? 'pause' : 'play'}
                                  size={13}
                                  color={u.isActive ? tokens.colors.statusWarning : tokens.colors.statusSuccess}
                                />
                              </TouchableOpacity>
                            )}

                            {u.role !== 'SUPER_ADMIN' && (
                              <TouchableOpacity
                                testID={`btn-delete-user-${u.id}`}
                                style={[styles.cardActionIconBtn, styles.deleteIconBtn]}
                                onPress={(e) => {
                                  e.stopPropagation?.()
                                  handleDeleteUser(u)
                                }}
                                accessibilityLabel={`Delete ${u.name}`}
                              >
                                <Ionicons name="trash-outline" size={13} color={tokens.colors.statusError} />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })
              )}
            </View>
          )}

          {/* PERMISSION MATRIX */}
          {activeTab === 'permissions' && (
            <View>
              <View style={styles.roleManageBanner}>
                <View style={styles.roleManageBannerContent}>
                  <View style={styles.roleManageIconBox}>
                    <Ionicons name="key" size={20} color={tokens.colors.primaryContainer} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleManageTitle}>Dynamic Role Permissions</Text>
                    <Text style={styles.roleManageSub}>
                      Configure dynamic capabilities, module wildcards, and access policies for system roles.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.configureRolesBtn}
                  onPress={() => onNavigate('roles')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="shield-checkmark" size={16} color={tokens.colors.onPrimary} />
                  <Text style={styles.configureRolesBtnText}>Configure Role Permissions</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionHeader}>Permission Groups & Role Hierarchy</Text>
              {groups.map((grp) => (
                <View key={grp.id} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>{grp.name}</Text>
                    <Text style={styles.groupUsersCount}>{grp.userCount} User(s)</Text>
                  </View>
                  <Text style={styles.groupDesc}>{grp.description}</Text>
                  <View style={styles.permList}>
                    {grp.permissions.map((p, i) => (
                      <View key={i} style={styles.permChip}>
                        <Text style={styles.permChipText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* User Create / Edit Modal */}
      <Modal visible={userModalOpen} transparent animationType="slide" onRequestClose={() => setUserModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>{editingUser ? 'Edit User' : 'Add Staff User'}</Text>
              <TouchableOpacity onPress={() => setUserModalOpen(false)}>
                <Ionicons name="close" size={24} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* SECTION 1: PERSONAL & ACCOUNT IDENTITY */}
              <View style={styles.formSectionHeader}>
                <Ionicons name="person-circle-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.formSectionTitle}>1. ACCOUNT & IDENTITY</Text>
              </View>

              <ControlledInput
                name="name"
                control={control}
                label="Full Name *"
                placeholder="e.g. Jane Doe"
              />

              <ControlledInput
                name="email"
                control={control}
                label="Email Address *"
                placeholder="jane@example.com"
                inputProps={{ keyboardType: 'email-address', autoCapitalize: 'none' }}
              />

              <ControlledInput
                name="phone"
                control={control}
                label="Contact Phone"
                placeholder="+855 12 345 678"
                inputProps={{ keyboardType: 'phone-pad' }}
              />

              {Boolean(!editingUser) && (
                <ControlledInput
                  name="password"
                  control={control}
                  label="Login Password *"
                  placeholder="At least 8 characters"
                  inputProps={{ secureTextEntry: true }}
                />
              )}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>User Account Active</Text>
                <Switch
                  value={formIsActive}
                  onValueChange={(val) => setValue('isActive', val)}
                  trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
                />
              </View>

              {/* SECTION 2: EMPLOYMENT & STORE ASSIGNMENT */}
              <View style={[styles.formSectionHeader, { marginTop: 14 }]}>
                <Ionicons name="business-outline" size={16} color={tokens.colors.primaryContainer} />
                <Text style={styles.formSectionTitle}>2. EMPLOYMENT & STORE ASSIGNMENT</Text>
              </View>

              <ControlledInput
                name="department"
                control={control}
                label="Department / Branch"
                placeholder="e.g. Main Counter / Warehouse"
              />

              <ControlledInput
                name="hire_date"
                control={control}
                label="Hire Date (YYYY-MM-DD)"
                placeholder="2026-08-01"
              />

              <Text style={styles.formLabel}>Assigned Access Role *</Text>
              <View style={styles.rolePickerRow}>
                {(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rolePickBtn, formRole === r && styles.rolePickBtnActive]}
                    onPress={() => setValue('role', r as UserRole)}
                  >
                    <Text style={[styles.rolePickText, formRole === r && styles.rolePickTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ControlledInput
                name="notes"
                control={control}
                label="Internal Employment Notes / Shift Schedule"
                placeholder="e.g. Shift lead, responsible for morning cash drawer"
              />

              {/* SECTION 3: COMPENSATION & BASE SALARY */}
              <View style={[styles.formSectionHeader, { marginTop: 14 }]}>
                <Ionicons name="cash-outline" size={16} color={tokens.colors.statusSuccess} />
                <Text style={[styles.formSectionTitle, { color: tokens.colors.statusSuccess }]}>3. COMPENSATION & SALARY SETUP</Text>
              </View>

              <ControlledInput
                name="base_salary"
                control={control}
                label="Monthly Base Salary ($)"
                placeholder="e.g. 350.00"
                inputProps={{ keyboardType: 'decimal-pad' }}
              />

              <ControlledInput
                name="salary_reason"
                control={control}
                label="Salary Package / Adjustment Note"
                placeholder="e.g. Starting Base Package / Annual Review"
              />

              {/* Live Compensation Accrual Preview Card */}
              <View style={styles.formAccrualPreview}>
                <View style={styles.formAccrualHeader}>
                  <Ionicons name="calculator-outline" size={14} color={tokens.colors.primaryContainer} />
                  <Text style={styles.formAccrualTitle}>Live Compensation Accruals</Text>
                </View>
                <View style={styles.formAccrualRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formAccrualLabel}>CALCULATED DAILY (26d)</Text>
                    <Text style={styles.formAccrualValue}>${formDailyRate} / day</Text>
                  </View>
                  <View style={styles.formAccrualDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formAccrualLabel}>13TH MO. MONTHLY ACCRUAL</Text>
                    <Text style={[styles.formAccrualValue, { color: tokens.colors.statusSuccess }]}>
                      +${formThirteenthMonthAccrual} / mo
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.submitBtnText}>{editingUser ? 'Save All Changes' : 'Create Staff Member'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CUSTOM DATE PICKER (SINGLE DATE OR DATE RANGE)                     */}
      {/* ========================================================================= */}
      <Modal visible={customRangeModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.customDateModalSheet}>
            {/* Modal Header */}
            <View style={styles.modalTopBar}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="calendar" size={20} color={tokens.colors.primaryContainer} />
                <Text style={styles.customDateModalTitle}>Select Audit Date Range</Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setCustomRangeModalOpen(false)}
              >
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, tempMode === 'custom' && styles.modeTabActive]}
                onPress={() => setTempMode('custom')}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    tempMode === 'custom' && styles.modeTabTextActive,
                  ]}
                >
                  Date Range
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, tempMode === 'single' && styles.modeTabActive]}
                onPress={() => setTempMode('single')}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    tempMode === 'single' && styles.modeTabTextActive,
                  ]}
                >
                  Single Day
                </Text>
              </TouchableOpacity>
            </View>

            {/* Selected Range Display Header */}
            <View style={styles.rangeDisplayRow}>
              {tempMode === 'single' ? (
                <View style={styles.rangeBadge}>
                  <Text style={styles.rangeBadgeLabel}>SELECTED DATE:</Text>
                  <Text style={styles.rangeBadgeVal}>{tempSingleDate || 'Select a day'}</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                  <View style={[styles.rangeBadge, { flex: 1 }]}>
                    <Text style={styles.rangeBadgeLabel}>FROM:</Text>
                    <Text style={styles.rangeBadgeVal}>{tempCustomFrom || 'Select start'}</Text>
                  </View>
                  <View style={[styles.rangeBadge, { flex: 1 }]}>
                    <Text style={styles.rangeBadgeLabel}>TO:</Text>
                    <Text style={styles.rangeBadgeVal}>
                      {tempCustomTo || (tempCustomFrom ? 'Select end date' : '---')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Interactive Calendar Component */}
            <Calendar
              current={tempCustomFrom || new Date().toISOString().split('T')[0]}
              onDayPress={handleDayPress}
              markingType={tempMode === 'custom' ? 'period' : 'dot'}
              markedDates={
                tempMode === 'custom'
                  ? getRangeMarkedDates()
                  : {
                      [tempSingleDate]: {
                        selected: true,
                        selectedColor: tokens.colors.primaryContainer,
                      },
                    }
              }
              theme={{
                backgroundColor: tokens.colors.surfaceCard,
                calendarBackground: tokens.colors.surfaceCard,
                textSectionTitleColor: tokens.colors.secondary,
                selectedDayBackgroundColor: tokens.colors.primaryContainer,
                selectedDayTextColor: '#ffffff',
                todayTextColor: tokens.colors.primaryContainer,
                dayTextColor: tokens.colors.onBackground,
                textDisabledColor: tokens.colors.secondaryFixedDim,
                monthTextColor: tokens.colors.onBackground,
                arrowColor: tokens.colors.primaryContainer,
                textMonthFontWeight: '700',
                textDayFontSize: 13,
                textMonthFontSize: 14,
                textDayHeaderFontSize: 11,
              }}
              style={styles.calendarStyle}
            />

            {/* Actions: Reset & Apply Buttons */}
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.resetModalBtn}
                onPress={() => {
                  const todayStr = new Date().toISOString().split('T')[0]
                  setTempSingleDate(todayStr)
                  setTempCustomFrom(
                    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
                  )
                  setTempCustomTo(todayStr)
                }}
              >
                <Text style={styles.resetModalBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.applyModalBtn,
                  tempMode === 'custom' && !tempCustomFrom && styles.applyModalBtnDisabled,
                ]}
                disabled={tempMode === 'custom' && !tempCustomFrom}
                onPress={handleApplyCustomDates}
              >
                <Text style={styles.applyModalBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: STAFF DETAIL & PERFORMANCE SUITE (5-TAB DRILLDOWN)                */}
      {/* ========================================================================= */}
      <StaffDetailModal
        visible={detailModalOpen}
        user={selectedDetailUser}
        onClose={() => setDetailModalOpen(false)}
        onEditProfile={handleOpenEdit}
        onStatusToggle={handleToggleActive}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: tokens.spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  subTabs: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: tokens.spacing.sm,
    gap: 5,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  subTabBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  subTabTextActive: {
    color: tokens.colors.onPrimary,
  },
  addIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },

  /* Audit Log Infinite Scroll & Filter Styles */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl + 40,
  },
  auditSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 8,
  },
  auditSearchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  dateBarRow: {
    maxHeight: 38,
    marginBottom: 6,
  },
  dateBarContent: {
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  dateBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  dateBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  statusChipsRow: {
    maxHeight: 44,
    marginBottom: 8,
  },
  statusChipsContent: {
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 5,
  },
  statusFilterChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  statusFilterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  statusFilterChipTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  countBadgeTextActive: {
    color: tokens.colors.onPrimary,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  activeFilterBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: tokens.colors.primary,
    fontWeight: '600',
  },
  activeFilterHighlight: {
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listSectionSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },

  /* Audit Card Styles */
  auditCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  auditCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  auditCardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  auditActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  auditTimeText: {
    fontSize: 10,
    color: tokens.colors.textMuted,
  },
  auditTargetText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 4,
  },
  auditCardDivider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: 8,
  },
  auditCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  auditActorText: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  auditDetailsText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    maxWidth: 160,
  },

  centerLoading: {
    padding: 36,
    alignItems: 'center',
    gap: 8,
  },
  centerLoadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  loadingMoreRow: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptySub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },

  /* User Card Styles */
  userCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  userCardInactive: {
    opacity: 0.72,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.primaryContainer,
  },
  avatarBoxInactive: {
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: '#FFDAD6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#93000A',
  },
  userEmail: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  deptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  deptBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  statusDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: tokens.borderRadius.pill,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotText: {
    fontSize: 10,
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  userCardDivider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: 10,
  },
  userCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryContainer,
  },
  statsPreviewBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  cardActionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  reactivateIconBtn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  deleteIconBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },

  /* Permissions Tab Styles */
  roleManageBanner: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  roleManageBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  roleManageIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleManageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  roleManageSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
    lineHeight: 15,
  },
  configureRolesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  configureRolesBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 10,
  },
  groupCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  groupUsersCount: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  groupDesc: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 4,
    marginBottom: 8,
  },
  permList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permChip: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  permChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '90%',
    paddingBottom: tokens.spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  formScroll: {
    padding: tokens.spacing.md,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
    marginTop: 8,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rolePickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  rolePickBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  rolePickText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  rolePickTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    marginBottom: 8,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  formAccrualPreview: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  formAccrualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  formAccrualTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  formAccrualRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formAccrualLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  formAccrualValue: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onSurface,
    marginTop: 2,
  },
  formAccrualDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
    marginHorizontal: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  submitBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    ...tokens.shadows.card,
  },
  submitBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },

  /* Calendar Modal Styles */
  customDateModalSheet: {
    backgroundColor: tokens.colors.surfaceCard,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl + 20,
    maxHeight: '92%',
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customDateModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  closeModalBtn: {
    padding: 4,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.pill,
    padding: 3,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadius.pill,
  },
  modeTabActive: {
    backgroundColor: tokens.colors.surfaceCard,
    ...tokens.shadows.card,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  modeTabTextActive: {
    color: tokens.colors.onBackground,
    fontWeight: '700',
  },
  rangeDisplayRow: {
    marginBottom: 12,
  },
  rangeBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  rangeBadgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
  },
  rangeBadgeVal: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
    marginTop: 2,
  },
  calendarStyle: {
    borderRadius: tokens.borderRadius.md,
    marginBottom: 16,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  resetModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  applyModalBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.card,
  },
  applyModalBtnDisabled: {
    opacity: 0.4,
  },
  applyModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },

  /* Unauthorized */
  unauthorizedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  unauthorizedBox: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    ...tokens.shadows.card,
  },
  unauthorizedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 8,
  },
  unauthorizedSub: {
    fontSize: 13,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: tokens.spacing.lg,
  },
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 12,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.pill,
    gap: 8,
    width: '100%',
    ...tokens.shadows.card,
  },
  backHomeBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
})

export default AdminUsersScreen
