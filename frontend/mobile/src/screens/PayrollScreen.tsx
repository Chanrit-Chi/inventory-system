import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Platform,
  LayoutAnimation,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import {
  fetchPayrolls,
  generatePayroll,
  fetchUsers,
  updatePayroll,
  deletePayroll,
  bulkUpdatePayrollStatus,
  fetchUserSalary,
  setUserSalary,
  fetch13thMonthSavings,
  fetchCompany13thMonthReserves,
  record13thMonthPayout,
  fetchStaffIncentives,
} from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import type {
  Payroll,
  UserAccount,
  ThirteenthMonthSummary,
  CompanyThirteenthMonthReservesData,
  StaffThirteenthMonthReserve,
} from '../types'
import { styles } from './payroll/PayrollScreen.styles'
import {
  formatCurrency,
  getStaffName,
  calculatePayrollSummary,
  MONTH_NAMES,
} from './payroll/payrollUtils'
import { SalaryManagementModal } from './payroll/components/SalaryManagementModal'
import { StandalonePayoutModal } from './payroll/components/StandalonePayoutModal'
import { GeneratePayrollModal } from './payroll/components/GeneratePayrollModal'
import { PayrollDetailModal } from './payroll/components/PayrollDetailModal'
import { PayrollFilterBar } from './payroll/components/PayrollFilterBar'
import { PayrollCardItem } from './payroll/components/PayrollCardItem'
import { ThirteenthMonthReservesTab } from './payroll/components/ThirteenthMonthReservesTab'

export default function PayrollScreen() {
  const { can } = usePermissions()
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Modals state
  const [generateVisible, setGenerateVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)

  // Selection & Mode for Generation
  const [generateMode, setGenerateMode] = useState<'BATCH' | 'MULTI' | 'SINGLE'>('BATCH')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [generating, setGenerating] = useState(false)

  // Detail Edit State
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null)
  const [workingDays, setWorkingDays] = useState('26')
  const [perfBenefit, setPerfBenefit] = useState('0')
  const [delivBenefit, setDelivBenefit] = useState('0')
  const [otDays, setOtDays] = useState('0')
  const [unpaidDays, setUnpaidDays] = useState('0')
  const [collecBenefit, setCollecBenefit] = useState('0')
  const [otherBenefit, setOtherBenefit] = useState('0')
  const [payrollStatus, setPayrollStatus] = useState<'DRAFT' | 'FINALIZED' | 'PAID'>('DRAFT')
  const [savingDetail, setSavingDetail] = useState(false)

  // 13th Month / Seniority Payout State in Detail Modal
  const [reserveSummary, setReserveSummary] = useState<ThirteenthMonthSummary | null>(null)
  const [reserveLoading, setReserveLoading] = useState(false)
  const [includeThirteenthPayout, setIncludeThirteenthPayout] = useState(false)
  const [thirteenthPayoutAmount, setThirteenthPayoutAmount] = useState('0')

  // Incentive mode: AUTO (from completed orders) or MANUAL (fixed input)
  const [incentiveMode, setIncentiveMode] = useState<'AUTO' | 'MANUAL'>('AUTO')
  const [manualIncentive, setManualIncentive] = useState('0')

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPaying, setBulkPaying] = useState(false)

  // Filters (default to all months for full year visibility)
  const [filterMonth, setFilterMonth] = useState<number | 'ALL'>('ALL')
  const [filterYear, setFilterYear] = useState<number | 'ALL'>(new Date().getFullYear())
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [searchMonthly, setSearchMonthly] = useState('')

  // Sub-tab Navigation
  const [activePayrollTab, setActivePayrollTab] = useState<'monthly' | 'thirteenthMonth'>('monthly')
  const [companyReservesData, setCompanyReservesData] = useState<CompanyThirteenthMonthReservesData | null>(null)
  const [companyReservesLoading, setCompanyReservesLoading] = useState(false)
  const [companyReservesRefreshing, setCompanyReservesRefreshing] = useState(false)
  const [reservesYear, setReservesYear] = useState<number | 'ALL'>(new Date().getFullYear())
  const [reservesMonth, setReservesMonth] = useState<number | 'ALL'>('ALL')

  const availableYears = useMemo(() => {
    const curr = new Date().getFullYear()
    const years = new Set<number>([curr + 1, curr, curr - 1, curr - 2, curr - 3])
    for (const p of payrolls) {
      if (p.period_year) years.add(Number(p.period_year))
    }
    const staff = companyReservesData?.staff || []
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
  }, [payrolls, companyReservesData])

  const filteredPayrolls = useMemo(() => {
    const q = searchMonthly.toLowerCase().trim()
    return payrolls.filter((p) => {
      const matchMonth = filterMonth === 'ALL' || p.period_month === filterMonth
      const matchYear = filterYear === 'ALL' || p.period_year === filterYear
      const matchStatus = filterStatus === 'ALL' || p.status === filterStatus
      const staffName = p.user?.name || users.find((u) => u.id === p.user_id)?.name || ''
      const matchSearch = !q || staffName.toLowerCase().includes(q) || (p.user?.role || '').toLowerCase().includes(q)
      return matchMonth && matchYear && matchStatus && matchSearch
    })
  }, [payrolls, filterMonth, filterYear, filterStatus, searchMonthly, users])

  // Map of user_ids that already have a payroll for the selected period
  const periodExistingUserIds = useMemo(() => {
    const m = parseInt(String(selectedMonth), 10)
    const y = parseInt(String(selectedYear), 10)
    const map = new Map<string, Payroll>()
    for (const p of payrolls) {
      if (p.period_month === m && p.period_year === y) {
        map.set(p.user_id, p)
      }
    }
    return map
  }, [selectedMonth, selectedYear, payrolls])

  const operationalUsers = useMemo(() => {
    return users.filter((u) => {
      const roleUpper = String(u.role || '').toUpperCase().replace(/[-\s]/g, '_')
      const isSuperAdmin = roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN'
      const isTest = u.is_test_account === true || u.isTestAccount === true
      const isActive = u.isActive !== false
      return !isSuperAdmin && !isTest && isActive
    })
  }, [users])

  const eligibleUsers = useMemo(() => {
    return operationalUsers.filter((u) => !periodExistingUserIds.has(u.id))
  }, [operationalUsers, periodExistingUserIds])

  // Reset/sync multi selection when opening modal or changing period
  useEffect(() => {
    if (generateVisible) {
      setSelectedStaffIds(new Set(operationalUsers.filter((u) => !periodExistingUserIds.has(u.id)).map((u) => u.id)))
    }
  }, [generateVisible, selectedMonth, selectedYear, periodExistingUserIds, operationalUsers])

  // Check if a payroll already exists for the selected single user
  const existingPayrollForSelection = useMemo(() => {
    if (!selectedUser) return null
    return periodExistingUserIds.get(selectedUser) || null
  }, [selectedUser, periodExistingUserIds])

  // Base Salary & Reserve Management State
  const [salaryVisible, setSalaryVisible] = useState(false)
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({})
  const [staffReserves, setStaffReserves] = useState<Record<string, number>>({})
  const [salaryLoading, setSalaryLoading] = useState(false)
  const [savingSalaryFor, setSavingSalaryFor] = useState<string | null>(null)

  // Standalone Payout Modal
  const [standalonePayoutUser, setStandalonePayoutUser] = useState<UserAccount | null>(null)
  const [standaloneAmount, setStandaloneAmount] = useState('')
  const [standaloneNotes, setStandaloneNotes] = useState('Khmer New Year / Bi-Annual Payout')
  const [savingStandalone, setSavingStandalone] = useState(false)

  const loadCompanyReserves = useCallback(async (isRefresh = false) => {
    if (isRefresh) setCompanyReservesRefreshing(true)
    else setCompanyReservesLoading(true)
    try {
      const res = await fetchCompany13thMonthReserves(reservesYear, reservesMonth)
      if (res && (res.success || res.data)) {
        setCompanyReservesData(res.data || null)
      }
    } catch (err: unknown) {
      console.warn('Failed to load company 13th month reserves:', err)
    } finally {
      setCompanyReservesLoading(false)
      setCompanyReservesRefreshing(false)
    }
  }, [reservesYear, reservesMonth])

  const loadData = useCallback(async () => {
    try {
      const [res, usersData] = await Promise.all([
        fetchPayrolls(),
        fetchUsers(),
      ])
      if (res && (res.success || res.data)) {
        const list = res.data ?? (Array.isArray(res) ? res : [])
        setPayrolls(Array.isArray(list) ? list : [])
      }
      if (Array.isArray(usersData)) {
        setUsers(usersData)
        if (usersData.length > 0 && !selectedUser) {
          setSelectedUser(usersData[0].id)
        }
      }
      // Preload 13th month reserves in background
      loadCompanyReserves(false)
    } catch (err: unknown) {
      console.warn('Failed to load payroll data:', err)
    }
  }, [selectedUser, loadCompanyReserves])

  useEffect(() => {
    if (activePayrollTab === 'thirteenthMonth') {
      loadCompanyReserves()
    }
  }, [activePayrollTab, loadCompanyReserves])

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.allSettled([
      loadData(),
      loadCompanyReserves(true),
    ])
    setRefreshing(false)
  }, [loadData, loadCompanyReserves])

  const handleSelectAllEligible = () => {
    setSelectedStaffIds(new Set(eligibleUsers.map((u) => u.id)))
  }

  const handleDeselectAll = () => {
    setSelectedStaffIds(new Set())
  }

  const handleToggleStaffSelection = (id: string) => {
    if (periodExistingUserIds.has(id)) return
    setSelectedStaffIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleGenerate = async () => {
    const monthNum = parseInt(String(selectedMonth), 10)
    const yearNum = parseInt(String(selectedYear), 10)
    if (!monthNum || monthNum < 1 || monthNum > 12) {
      Alert.alert('Invalid Input', 'Month must be between 1 and 12.')
      return
    }
    if (!yearNum || yearNum < 2000) {
      Alert.alert('Invalid Input', 'Please provide a valid year (e.g. 2026).')
      return
    }

    setGenerating(true)
    try {
      let res: unknown
      if (generateMode === 'BATCH') {
        res = await generatePayroll({
          batch: true,
          all_staff: true,
          month: monthNum,
          year: yearNum,
        })
      } else if (generateMode === 'MULTI') {
        if (selectedStaffIds.size === 0) {
          Alert.alert('Selection Required', 'Please select at least one staff member to generate payroll.')
          setGenerating(false)
          return
        }
        res = await generatePayroll({
          user_ids: Array.from(selectedStaffIds),
          month: monthNum,
          year: yearNum,
        })
      } else {
        if (!selectedUser) {
          Alert.alert('Selection Required', 'Please select a staff member first.')
          setGenerating(false)
          return
        }
        if (existingPayrollForSelection) {
          const staffName = users.find((u) => u.id === selectedUser)?.name || 'Staff'
          Alert.alert(
            'Already Generated',
            `Payroll for ${staffName} for ${monthNum}/${yearNum} has already been generated (Status: ${existingPayrollForSelection.status}). Please view or edit the existing record in the list.`
          )
          setGenerating(false)
          return
        }
        res = await generatePayroll({
          user_id: selectedUser,
          month: monthNum,
          year: yearNum,
        })
      }

      const resAny = res as any
      if (resAny && (resAny.success || resAny.data)) {
        setGenerateVisible(false)
        const msg =
          resAny.message ||
          (resAny.data?.generated_count !== undefined
            ? `Generated ${resAny.data.generated_count} payroll(s).`
            : 'Payroll generated successfully.')
        Alert.alert('Success', msg)
        await loadData()
      } else {
        Alert.alert('Error', resAny?.message || 'Failed to generate payroll.')
      }
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'An error occurred while generating payroll.'
      )
    } finally {
      setGenerating(false)
    }
  }

  const openDetail = async (p: Payroll) => {
    let currentBaseSalary = p.base_salary
    if (!currentBaseSalary || Number(currentBaseSalary) === 0) {
      try {
        const salRes = await fetchUserSalary(p.user_id)
        if (salRes?.data?.base_salary) {
          currentBaseSalary = salRes.data.base_salary
        }
      } catch (err) {
        console.warn('Failed to fetch user base salary for payroll detail:', err)
      }
    }

    const hasOverride =
      p.incentive_override !== null &&
      p.incentive_override !== undefined &&
      String(p.incentive_override) !== ''
    setIncentiveMode(hasOverride ? 'MANUAL' : 'AUTO')
    setManualIncentive(String(p.incentive_override ?? 0))

    let currentIncentiveAmount = p.incentive_amount
    // If draft and AUTO mode, fetch fresh live incentive calculations from completed orders
    if (p.status === 'DRAFT' && !hasOverride) {
      try {
        const incRes = await fetchStaffIncentives(p.user_id, {
          month: p.period_month,
          year: p.period_year,
        })
        if (incRes?.data?.summary?.total_incentive !== undefined) {
          currentIncentiveAmount = incRes.data.summary.total_incentive
        }
      } catch (err) {
        console.warn('Failed to fetch live incentives for payroll detail:', err)
      }
    }

    setEditingPayroll({
      ...p,
      base_salary: currentBaseSalary,
      incentive_amount: currentIncentiveAmount ?? p.incentive_amount ?? 0,
    })
    setWorkingDays(String(p.working_days ?? 26))
    setPerfBenefit(String(p.performance_benefit ?? 0))
    setDelivBenefit(String(p.delivery_benefit ?? 0))
    setOtDays(String(p.overtime_days ?? 0))
    setUnpaidDays(String(p.unpaid_leave_days ?? 0))
    setCollecBenefit(String(p.collective_benefit ?? 0))
    setOtherBenefit(String(p.other_benefits ?? 0))
    setPayrollStatus(p.status)

    const hasPayout = p.thirteenth_month_payout !== undefined && p.thirteenth_month_payout !== null && Number(p.thirteenth_month_payout) > 0
    setIncludeThirteenthPayout(Boolean(hasPayout))
    setThirteenthPayoutAmount(String(p.thirteenth_month_payout ?? 0))

    setDetailVisible(true)
    setReserveLoading(true)
    try {
      const res = await fetch13thMonthSavings(p.user_id)
      if (res && res.data) {
        setReserveSummary(res.data)
      }
    } catch (err) {
      console.warn('Failed to load 13th month reserve:', err)
    } finally {
      setReserveLoading(false)
    }
  }

  // Save changes to payroll detail
  const handleSaveDetail = async (mode: 'draft' | 'finalize') => {
    if (!editingPayroll) return
    const payoutVal = includeThirteenthPayout ? parseFloat(thirteenthPayoutAmount) || 0 : 0

    const summary = calculatePayrollSummary({
      editingPayroll,
      incentiveMode,
      manualIncentive,
      workingDays,
      otDays,
      unpaidDays,
      perfBenefit,
      delivBenefit,
      collecBenefit,
      otherBenefit,
      includeThirteenthPayout,
      thirteenthPayoutAmount,
      reserveSummary,
    })

    // Guard: payout cannot exceed the available 13th month reserve
    if (payoutVal > 0 && payoutVal > summary.availableReservePool + 0.001) {
      Alert.alert(
        'Insufficient Reserve',
        `Payout of ${formatCurrency(payoutVal)} exceeds the available 13th month reserve of ${formatCurrency(summary.availableReservePool)}.`
      )
      return
    }

    setSavingDetail(true)
    try {
      const res = await updatePayroll(editingPayroll.id, {
        working_days: parseInt(workingDays) || 26,
        performance_benefit: parseFloat(perfBenefit) || 0,
        delivery_benefit: parseFloat(delivBenefit) || 0,
        overtime_days: parseFloat(otDays) || 0,
        unpaid_leave_days: parseFloat(unpaidDays) || 0,
        collective_benefit: parseFloat(collecBenefit) || 0,
        other_benefits: parseFloat(otherBenefit) || 0,
        thirteenth_month_payout: payoutVal,
        incentive_override:
          incentiveMode === 'MANUAL' ? parseFloat(manualIncentive) || 0 : null,
        status: mode === 'finalize' ? 'FINALIZED' : 'DRAFT',
      })
      if (res && (res.success || res.data) && res.data) {
        const updated: Payroll = res.data
        setEditingPayroll(updated)
        setPayrolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        setDetailVisible(false)
        Alert.alert(
          mode === 'finalize' ? 'Finalized' : 'Saved',
          mode === 'finalize'
            ? 'Payroll saved and marked as FINALIZED.'
            : 'Payroll draft saved successfully.'
        )
      } else {
        Alert.alert('Error', res?.message || 'Failed to update payroll.')
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save changes.')
    } finally {
      setSavingDetail(false)
    }
  }

  const handleTransition = async (nextStatus: 'DRAFT' | 'PAID') => {
    if (!editingPayroll) return
    setSavingDetail(true)
    try {
      const res = await updatePayroll(editingPayroll.id, { status: nextStatus })
      if (res && (res.success || res.data) && res.data) {
        const updated: Payroll = res.data
        setEditingPayroll(updated)
        setPayrolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        setDetailVisible(false)
        Alert.alert(
          nextStatus === 'PAID' ? 'Marked as Paid' : 'Reopened',
          nextStatus === 'PAID'
            ? 'This payroll is now marked as PAID.'
            : 'Payroll reopened as DRAFT and can be edited again.'
        )
      } else {
        Alert.alert('Error', res?.message || 'Failed to update status.')
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status.')
    } finally {
      setSavingDetail(false)
    }
  }

  // Delete draft helper by ID (used for list and modal)
  const handleDeleteDraftById = (id: string, staffName: string, periodStr: string) => {
    Alert.alert(
      'Delete Draft Payroll',
      `Delete draft payroll for ${staffName} (${periodStr})? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deletePayroll(id)
              if (res && (res.success || res.data !== undefined)) {
                setPayrolls((prev) => prev.filter((p) => p.id !== id))
                if (editingPayroll?.id === id) {
                  setDetailVisible(false)
                  setEditingPayroll(null)
                }
                Alert.alert('Deleted', 'Draft payroll deleted successfully.')
              } else {
                Alert.alert('Error', res?.message || 'Failed to delete payroll.')
              }
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete payroll.')
            }
          },
        },
      ]
    )
  }

  const handleDeleteDraftFromModal = () => {
    if (!editingPayroll) return
    const staffName = getStaffName(editingPayroll, users)
    const periodStr = `${MONTH_NAMES[editingPayroll.period_month - 1] || editingPayroll.period_month} ${editingPayroll.period_year}`
    handleDeleteDraftById(editingPayroll.id, staffName, periodStr)
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  // Only FINALIZED payrolls are eligible for "mark as paid"
  const bulkEligibleCount = useMemo(
    () => payrolls.filter((p) => selectedIds.has(p.id) && p.status === 'FINALIZED').length,
    [payrolls, selectedIds]
  )

  const handleBulkMarkPaid = async () => {
    const targetIds = payrolls
      .filter((p) => selectedIds.has(p.id) && p.status === 'FINALIZED')
      .map((p) => p.id)
    if (targetIds.length === 0) {
      Alert.alert('Nothing To Do', 'Only FINALIZED payrolls can be marked as paid.')
      return
    }

    setBulkPaying(true)
    try {
      const res = await bulkUpdatePayrollStatus({ ids: targetIds, status: 'PAID' })
      const updated = res?.data?.updated ?? 0
      const failed = res?.data?.failed ?? []
      exitSelectionMode()
      await loadData()
      Alert.alert(
        failed.length === 0 ? 'Success' : 'Partial Success',
        `${updated} payroll(s) marked as PAID.` +
          (failed.length > 0 ? ` ${failed.length} failed — ${failed[0].reason}` : '')
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark payrolls as paid.'
      Alert.alert('Error', message)
    } finally {
      setBulkPaying(false)
    }
  }

  const openSalaryManager = useCallback(async () => {
    setSalaryVisible(true)
    setSalaryLoading(true)
    try {
      const results = await Promise.allSettled(
        users.map(async (u) => {
          const salaryRes = await fetchUserSalary(u.id)
          const savingsRes = await fetch13thMonthSavings(u.id)
          const salary = salaryRes?.data
          const savings = savingsRes?.data
          return {
            id: u.id,
            salary: String(salary?.base_salary ?? 0),
            reserve: savings?.available_balance ?? 0,
          }
        })
      )
      const nextDrafts: Record<string, string> = {}
      const nextReserves: Record<string, number> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          nextDrafts[r.value.id] = r.value.salary
          nextReserves[r.value.id] = r.value.reserve
        }
      }
      setSalaryDrafts(nextDrafts)
      setStaffReserves(nextReserves)
    } catch {
      // Keep existing drafts on failure
    } finally {
      setSalaryLoading(false)
    }
  }, [users])

  const handleSaveSalary = async (userId: string) => {
    const raw = salaryDrafts[userId]
    const value = parseFloat(raw || '0')
    if (isNaN(value) || value < 0) {
      Alert.alert('Invalid Input', 'Base salary must be a positive number.')
      return
    }

    setSavingSalaryFor(userId)
    try {
      await setUserSalary(userId, { base_salary: value })
      const savingsRes = await fetch13thMonthSavings(userId)
      const newReserve = savingsRes?.data?.available_balance ?? 0
      setStaffReserves((prev) => ({ ...prev, [userId]: newReserve }))
      setSalaryDrafts((prev) => ({ ...prev, [userId]: String(value) }))
      await loadData()
      Alert.alert('Saved', 'Base salary updated. Payroll calculations and reserves refreshed.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update base salary.'
      Alert.alert('Error', message)
    } finally {
      setSavingSalaryFor(null)
    }
  }

  const handleOpenStandalonePayout = (u: UserAccount | StaffThirteenthMonthReserve) => {
    const userId = 'id' in u ? u.id : u.user_id
    const available = 'available_balance' in u ? u.available_balance : staffReserves[userId] ?? 0
    const existing = users.find((item) => item.id === userId)
    const userObj: UserAccount = existing || {
      id: userId,
      name: u.name,
      email: u.email,
      role: (u.role as any) || 'SELLER',
      isActive: true,
    }
    setStandalonePayoutUser(userObj)
    setStandaloneAmount(String(available > 0 ? available : ''))
    setStandaloneNotes('13th Month / Seniority Payout')
  }

  const handleRecordStandalonePayout = async () => {
    if (!standalonePayoutUser) return
    const amt = parseFloat(standaloneAmount)
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payout amount greater than $0.')
      return
    }

    setSavingStandalone(true)
    try {
      const res = await record13thMonthPayout(standalonePayoutUser.id, {
        amount: amt,
        notes: standaloneNotes.trim(),
      })
      if (res && res.success) {
        Alert.alert('Payout Recorded', `Disbursed ${formatCurrency(amt)} to ${standalonePayoutUser.name}.`)
        setStandalonePayoutUser(null)
        await Promise.allSettled([loadData(), loadCompanyReserves(), openSalaryManager()])
      } else {
        Alert.alert('Error', res?.message || 'Failed to record payout.')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record payout.'
      Alert.alert('Error', message)
    } finally {
      setSavingStandalone(false)
    }
  }

  const renderItem = ({ item }: { item: Payroll }) => {
    const staffName = getStaffName(item, users)
    const isSelected = selectedIds.has(item.id)

    return (
      <PayrollCardItem
        item={item}
        staffName={staffName}
        isSelected={isSelected}
        selectionMode={selectionMode}
        onPress={() => {
          if (selectionMode) {
            if (item.status === 'FINALIZED') toggleSelected(item.id)
          } else {
            openDetail(item)
          }
        }}
        onDeleteDraft={handleDeleteDraftById}
      />
    )
  }

  return (
    <View style={styles.container}>
      {/* Top Sub-Tab Navigation Segment */}
      <View style={styles.subTabSegmentContainer}>
        <TouchableOpacity
          style={[styles.subTabSegmentBtn, activePayrollTab === 'monthly' && styles.subTabSegmentBtnActive]}
          onPress={() => setActivePayrollTab('monthly')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={activePayrollTab === 'monthly' ? tokens.colors.onPrimary : tokens.colors.secondary}
          />
          <Text style={[styles.subTabSegmentText, activePayrollTab === 'monthly' && styles.subTabSegmentTextActive]}>
            Monthly Payroll
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabSegmentBtn, activePayrollTab === 'thirteenthMonth' && styles.subTabSegmentBtnActive]}
          onPress={() => setActivePayrollTab('thirteenthMonth')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="gift-outline"
            size={14}
            color={activePayrollTab === 'thirteenthMonth' ? tokens.colors.onPrimary : tokens.colors.secondary}
          />
          <Text style={[styles.subTabSegmentText, activePayrollTab === 'thirteenthMonth' && styles.subTabSegmentTextActive]}>
            13th Month Reserves
          </Text>
        </TouchableOpacity>
      </View>

      {/* VIEW A: 13TH MONTH RESERVES DASHBOARD TAB */}
      {activePayrollTab === 'thirteenthMonth' ? (
        <ThirteenthMonthReservesTab
          data={companyReservesData}
          loading={companyReservesLoading}
          refreshing={companyReservesRefreshing}
          onRefresh={() => loadCompanyReserves(true)}
          filterYear={reservesYear}
          setFilterYear={setReservesYear}
          filterMonth={reservesMonth}
          setFilterMonth={setReservesMonth}
          availableYears={availableYears}
          onOpenPayout={handleOpenStandalonePayout}
        />
      ) : (
        /* VIEW B: MONTHLY PAYROLL TAB */
        <>
          {/* Spacious Action, Search & Filter Toolbar */}
          {loading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
            </View>
          ) : (
            <FlatList
              data={filteredPayrolls}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListHeaderComponent={
                <PayrollFilterBar
                  search={searchMonthly}
                  setSearch={setSearchMonthly}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterMonth={filterMonth}
                  setFilterMonth={setFilterMonth}
                  filterYear={filterYear}
                  setFilterYear={setFilterYear}
                  availableYears={availableYears}
                  onOpenGenerate={() => setGenerateVisible(true)}
                  onOpenSalary={openSalaryManager}
                  selectionMode={selectionMode}
                  onToggleSelectionMode={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
                  canManage={Boolean(can('payroll:manage'))}
                  payrolls={filteredPayrolls}
                />
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="cash-outline" size={48} color={tokens.colors.outline} />
                  <Text style={styles.emptyText}>
                    {payrolls.length === 0 ? 'No payroll records found.' : 'No payrolls match the selected filters.'}
                  </Text>
                </View>
              }
            />
          )}

          {/* Bulk Mark-as-Paid floating bar */}
          {Boolean(selectionMode && can('payroll:manage')) && (
            <View style={styles.bulkBar}>
              <Text style={styles.bulkHint}>
                {bulkEligibleCount > 0
                  ? `${bulkEligibleCount} finalized payroll(s) selected`
                  : 'Select FINALIZED payrolls to mark as paid'}
              </Text>
              <TouchableOpacity
                style={[styles.bulkPayBtn, bulkEligibleCount === 0 && styles.modalBtnDisabled]}
                onPress={handleBulkMarkPaid}
                disabled={bulkPaying || bulkEligibleCount === 0}
              >
                {bulkPaying ? (
                  <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="cash" size={15} color={tokens.colors.onPrimary} />
                    <Text style={styles.bulkPayText}>Mark Paid</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* BASE SALARY & 13TH MONTH RESERVES MANAGER MODAL */}
      <SalaryManagementModal
        visible={salaryVisible}
        onClose={() => setSalaryVisible(false)}
        users={operationalUsers}
        salaryLoading={salaryLoading}
        salaryDrafts={salaryDrafts}
        staffReserves={staffReserves}
        savingSalaryFor={savingSalaryFor}
        canManage={Boolean(can('payroll:manage'))}
        onSaveSalary={handleSaveSalary}
        onChangeSalaryDraft={(uid, val) => setSalaryDrafts((prev) => ({ ...prev, [uid]: val }))}
        onOpenStandalonePayout={handleOpenStandalonePayout}
      />

      {/* STANDALONE 13TH MONTH PAYOUT MODAL */}
      <StandalonePayoutModal
        visible={!!standalonePayoutUser}
        user={standalonePayoutUser}
        availableReserve={staffReserves[standalonePayoutUser?.id || ''] ?? 0}
        amount={standaloneAmount}
        notes={standaloneNotes}
        saving={savingStandalone}
        onClose={() => setStandalonePayoutUser(null)}
        onChangeAmount={setStandaloneAmount}
        onChangeNotes={setStandaloneNotes}
        onConfirm={handleRecordStandalonePayout}
      />

      {/* GENERATE MODAL WITH BATCH & MULTI-SELECTION OPTIONS */}
      <GeneratePayrollModal
        visible={generateVisible}
        onClose={() => setGenerateVisible(false)}
        generateMode={generateMode}
        setGenerateMode={setGenerateMode}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        users={operationalUsers}
        eligibleUsers={eligibleUsers}
        selectedStaffIds={selectedStaffIds}
        periodExistingUserIds={periodExistingUserIds}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        existingPayrollForSelection={existingPayrollForSelection}
        generating={generating}
        onToggleStaffSelection={handleToggleStaffSelection}
        onSelectAllEligible={handleSelectAllEligible}
        onDeselectAll={handleDeselectAll}
        onGenerate={handleGenerate}
      />

      {/* PAYROLL DETAIL & EDITOR MODAL */}
      <PayrollDetailModal
        visible={detailVisible}
        editingPayroll={editingPayroll}
        users={users}
        workingDays={workingDays}
        setWorkingDays={setWorkingDays}
        perfBenefit={perfBenefit}
        setPerfBenefit={setPerfBenefit}
        delivBenefit={delivBenefit}
        setDelivBenefit={setDelivBenefit}
        otDays={otDays}
        setOtDays={setOtDays}
        unpaidDays={unpaidDays}
        setUnpaidDays={setUnpaidDays}
        collecBenefit={collecBenefit}
        setCollecBenefit={setCollecBenefit}
        otherBenefit={otherBenefit}
        setOtherBenefit={setOtherBenefit}
        payrollStatus={payrollStatus}
        incentiveMode={incentiveMode}
        setIncentiveMode={setIncentiveMode}
        manualIncentive={manualIncentive}
        setManualIncentive={setManualIncentive}
        includeThirteenthPayout={includeThirteenthPayout}
        setIncludeThirteenthPayout={setIncludeThirteenthPayout}
        thirteenthPayoutAmount={thirteenthPayoutAmount}
        setThirteenthPayoutAmount={setThirteenthPayoutAmount}
        reserveSummary={reserveSummary}
        savingDetail={savingDetail}
        onClose={() => setDetailVisible(false)}
        onSaveDetail={handleSaveDetail}
        onTransition={handleTransition}
        onDeleteDraft={handleDeleteDraftFromModal}
      />
    </View>
  )
}
