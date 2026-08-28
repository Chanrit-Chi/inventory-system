import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
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
  record13thMonthPayout,
} from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import type { Payroll, UserAccount, ThirteenthMonthSummary } from '../types'

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

  // Filters (default to current month and year)
  const [filterMonth, setFilterMonth] = useState<number | 'ALL'>(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState<number | 'ALL'>(new Date().getFullYear())

  const availableYears = useMemo(
    () => Array.from(new Set([new Date().getFullYear(), ...payrolls.map((p) => p.period_year)])).sort((a, b) => b - a),
    [payrolls]
  )

  const filteredPayrolls = useMemo(
    () =>
      payrolls.filter(
        (p) =>
          (filterMonth === 'ALL' || p.period_month === filterMonth) &&
          (filterYear === 'ALL' || p.period_year === filterYear)
      ),
    [payrolls, filterMonth, filterYear]
  )

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

  const eligibleUsers = useMemo(() => {
    return users.filter((u) => !periodExistingUserIds.has(u.id))
  }, [users, periodExistingUserIds])

  // Reset/sync multi selection when opening modal or changing period
  useEffect(() => {
    if (generateVisible) {
      setSelectedStaffIds(new Set(users.filter((u) => !periodExistingUserIds.has(u.id)).map((u) => u.id)))
    }
  }, [generateVisible, selectedMonth, selectedYear, periodExistingUserIds, users])

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

  const loadData = useCallback(async () => {
    try {
      const res = await fetchPayrolls()
      if (res && (res.success || res.data)) {
        const list = res.data ?? (Array.isArray(res) ? res : [])
        setPayrolls(Array.isArray(list) ? list : [])
      }
      const usersData = await fetchUsers()
      if (Array.isArray(usersData)) {
        setUsers(usersData)
        if (usersData.length > 0 && !selectedUser) {
          setSelectedUser(usersData[0].id)
        }
      }
    } catch (err: any) {
      console.warn('Failed to load payroll data:', err)
    }
  }, [selectedUser])

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

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
      let res: any
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

      if (res && (res.success || res.data)) {
        setGenerateVisible(false)
        const msg =
          res.message ||
          (res.data?.generated_count !== undefined
            ? `Generated ${res.data.generated_count} payroll(s).`
            : 'Payroll generated successfully.')
        Alert.alert('Success', msg)
        await loadData()
      } else {
        Alert.alert('Error', res?.message || 'Failed to generate payroll.')
      }
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message || err.message || 'An error occurred while generating payroll.'
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

    setEditingPayroll({
      ...p,
      base_salary: currentBaseSalary,
    })
    setWorkingDays(String(p.working_days ?? 26))
    setPerfBenefit(String(p.performance_benefit ?? 0))
    setDelivBenefit(String(p.delivery_benefit ?? 0))
    setOtDays(String(p.overtime_days ?? 0))
    setUnpaidDays(String(p.unpaid_leave_days ?? 0))
    setCollecBenefit(String(p.collective_benefit ?? 0))
    setOtherBenefit(String(p.other_benefits ?? 0))
    setPayrollStatus(p.status)
    const hasOverride =
      p.incentive_override !== null &&
      p.incentive_override !== undefined &&
      String(p.incentive_override) !== ''
    setIncentiveMode(hasOverride ? 'MANUAL' : 'AUTO')
    setManualIncentive(String(p.incentive_override ?? 0))

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
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save changes.')
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
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status.')
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
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete payroll.')
            }
          },
        },
      ]
    )
  }

  const handleDeleteDraftFromModal = () => {
    if (!editingPayroll) return
    const staffName = getStaffName(editingPayroll)
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
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to mark payrolls as paid.')
    } finally {
      setBulkPaying(false)
    }
  }

  const formatCurrency = (val: number | string | undefined | null) => {
    return '$' + Number(val || 0).toFixed(2)
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  const MONTH_NAMES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  // Lifecycle: only DRAFT rows are editable
  const isEditable = payrollStatus === 'DRAFT'

  // Live summary preview — complete formula with all benefits, 13th month payout, and deductions
  const summary = useMemo(() => {
    const base = Number(editingPayroll?.base_salary || 0)
    const incentive =
      incentiveMode === 'MANUAL'
        ? parseFloat(manualIncentive) || 0
        : Number(editingPayroll?.incentive_amount || 0)
    const thirteenth = round2(base / 12)
    const wd = Math.max(parseInt(workingDays, 10) || 26, 1)
    const dailyRate = base / wd
    const otAmount = round2((parseFloat(otDays) || 0) * dailyRate)
    const unpaidDeduction = round2((parseFloat(unpaidDays) || 0) * dailyRate)
    const perf = parseFloat(perfBenefit) || 0
    const deliv = parseFloat(delivBenefit) || 0
    const collec = parseFloat(collecBenefit) || 0
    const other = parseFloat(otherBenefit) || 0
    const payout = includeThirteenthPayout ? parseFloat(thirteenthPayoutAmount) || 0 : 0

    const totalEarnings = round2(base + incentive + perf + deliv + otAmount + collec + other + payout)
    const net = round2(totalEarnings - unpaidDeduction)

    // Calculate remaining reserve balance after this payout
    const existingPayoutInPayroll = Number(editingPayroll?.thirteenth_month_payout || 0)
    const availableReservePool = round2((reserveSummary?.available_balance ?? 0) + existingPayoutInPayroll)
    const remainingReserve = Math.max(0, round2(availableReservePool - payout))

    return {
      base,
      incentive,
      thirteenth,
      dailyRate,
      otAmount,
      unpaidDeduction,
      perf,
      deliv,
      collec,
      other,
      payout,
      availableReservePool,
      remainingReserve,
      totalEarnings,
      net,
    }
  }, [
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
  ])

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
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update base salary.')
    } finally {
      setSavingSalaryFor(null)
    }
  }

  const handleOpenStandalonePayout = (u: UserAccount) => {
    const available = staffReserves[u.id] ?? 0
    setStandalonePayoutUser(u)
    setStandaloneAmount(String(available > 0 ? available : ''))
    setStandaloneNotes('Khmer New Year / Bi-Annual Seniority Payout')
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
        // Refresh reserves
        await openSalaryManager()
      } else {
        Alert.alert('Error', res?.message || 'Failed to record payout.')
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payout.')
    } finally {
      setSavingStandalone(false)
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'PAID') return tokens.colors.statusSuccess
    if (status === 'FINALIZED') return tokens.colors.statusWarning
    return tokens.colors.secondary
  }

  // Resolve staff name
  const getStaffName = useCallback(
    (p: Pick<Payroll, 'user_id' | 'user'>): string =>
      p.user?.name || users.find((u) => u.id === p.user_id)?.name || 'Unknown Staff',
    [users]
  )

interface FilterItem<T> {
  label: string
  value: T
}

function FilterChipBar<T extends string | number>({
  items,
  current,
  onSelect,
}: {
  items: FilterItem<T>[]
  current: T
  onSelect: (v: T) => void
}) {
  const listRef = React.useRef<FlatList>(null)

  const scrollToActive = useCallback(
    (index: number, animated = true) => {
      if (index >= 0) {
        try {
          listRef.current?.scrollToIndex({
            index,
            animated,
            viewPosition: 0.5,
          })
        } catch {
          // Handled by onScrollToIndexFailed
        }
      }
    },
    []
  )

  useEffect(() => {
    const idx = items.findIndex((it) => it.value === current)
    if (idx >= 0) {
      const timer = setTimeout(() => scrollToActive(idx, true), 120)
      return () => clearTimeout(timer)
    }
  }, [current, items, scrollToActive])

  return (
    <FlatList
      ref={listRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={items}
      keyExtractor={(it) => String(it.value)}
      contentContainerStyle={styles.filterRow}
      initialNumToRender={15}
      onScrollToIndexFailed={(info) => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: info.index,
            animated: false,
            viewPosition: 0.5,
          })
        }, 120)
      }}
      renderItem={({ item }) => {
        const active = current === item.value
        return (
          <TouchableOpacity
            key={String(item.value)}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onSelect(item.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )
      }}
    />
  )
}

  const renderItem = ({ item }: { item: Payroll }) => {
    const staffName = getStaffName(item)
    const initial = staffName.charAt(0).toUpperCase()
    const otAmount = Number(item.overtime_amount || 0)
    const deduction = Number(item.unpaid_leave_deduction || 0)
    const isSelected = selectedIds.has(item.id)
    const bulkEligible = item.status === 'FINALIZED'
    const isDraft = item.status === 'DRAFT'
    const selectDisabled = selectionMode && !bulkEligible

    const periodStr = `${MONTH_NAMES[item.period_month - 1] || item.period_month} ${item.period_year}`

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected, selectDisabled && styles.cardDisabled]}
        activeOpacity={0.7}
        onPress={() => {
          if (selectionMode) {
            if (bulkEligible) toggleSelected(item.id)
          } else {
            openDetail(item)
          }
        }}
        disabled={selectDisabled}
        accessibilityRole="button"
        accessibilityLabel={`Payroll for ${staffName}, ${periodStr}, net pay ${formatCurrency(item.total_net_pay)}`}
      >
        {/* Identity Row */}
        <View style={styles.cardIdentity}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.cardIdText}>
            <Text style={styles.userName} numberOfLines={1}>
              {staffName}
            </Text>
            <Text style={styles.periodText}>
              {periodStr} • {item.working_days ?? 26} work days
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
          </View>

          {/* Quick Draft Delete Action directly from card */}
          {Boolean(isDraft && !selectionMode) && (
            <TouchableOpacity
              style={styles.cardDeleteBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                handleDeleteDraftById(item.id, staffName, periodStr)
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Delete draft payroll for ${staffName}`}
            >
              <Ionicons name="trash-outline" size={16} color={tokens.colors.actionDestructive} />
            </TouchableOpacity>
          )}

          {Boolean(selectionMode) && (
            <View
              style={[
                styles.selectCircle,
                isSelected && styles.selectCircleOn,
                selectDisabled && styles.selectCircleDisabled,
              ]}
            >
              {Boolean(isSelected) && <Ionicons name="checkmark" size={13} color={tokens.colors.onPrimary} />}
            </View>
          )}
        </View>

        {/* Key Figures Grid */}
        <View style={styles.figuresRow}>
          <View style={styles.figureBox}>
            <Text style={styles.figureLabel}>Base Salary</Text>
            <Text style={styles.figureValue} numberOfLines={1}>
              {formatCurrency(item.base_salary)}
            </Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureLabel}>Incentive</Text>
            <Text style={[styles.figureValue, { color: tokens.colors.statusSuccess }]} numberOfLines={1}>
              +{formatCurrency(item.incentive_amount)}
            </Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureLabel}>OT / Leave</Text>
            <Text style={styles.figureValue} numberOfLines={1}>
              +{formatCurrency(otAmount)} / -{formatCurrency(deduction)}
            </Text>
          </View>
        </View>

        {/* Net Pay Footer */}
        <View style={styles.netRow}>
          <View>
            <Text style={styles.netLabel}>Net Pay</Text>
            {item.thirteenth_month_payout !== undefined && Number(item.thirteenth_month_payout) > 0 && (
              <Text style={{ fontSize: 10, color: tokens.colors.statusSuccess, fontWeight: '700' }}>
                Incl. 13th Payout +{formatCurrency(item.thirteenth_month_payout)}
              </Text>
            )}
          </View>
          <Text style={styles.netValue}>{formatCurrency(item.total_net_pay)}</Text>
          <Ionicons name="chevron-forward" size={16} color={tokens.colors.secondary} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.header}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarScrollContent}
        >
          {payrolls.length > 0 && (
            <TouchableOpacity
              style={[styles.salaryBtn, selectionMode && styles.salaryBtnActive]}
              onPress={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
              activeOpacity={0.75}
            >
              <Ionicons
                name={selectionMode ? 'close-circle' : 'checkbox-outline'}
                size={15}
                color={selectionMode ? tokens.colors.onPrimary : tokens.colors.primaryContainer}
              />
              <Text style={[styles.salaryBtnText, selectionMode && styles.salaryBtnTextActive]}>
                {selectionMode ? 'Cancel' : 'Select'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.salaryBtn} onPress={openSalaryManager} activeOpacity={0.75}>
            <Ionicons name="wallet-outline" size={15} color={tokens.colors.primaryContainer} />
            <Text style={styles.salaryBtnText}>Salaries & Reserves</Text>
          </TouchableOpacity>
          {Boolean(can('payroll:manage')) && (
            <TouchableOpacity style={styles.generateBtn} onPress={() => setGenerateVisible(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color={tokens.colors.onPrimary} />
              <Text style={styles.generateBtnText}>Generate</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Filters */}
      {payrolls.length > 0 && (
        <View style={styles.filterSection}>
          <FilterChipBar
            items={[
              { label: 'All Months', value: 'ALL' },
              ...MONTH_NAMES.map((m, i) => ({ label: m, value: (i + 1) as number | 'ALL' })),
            ]}
            current={filterMonth}
            onSelect={setFilterMonth}
          />
          <FilterChipBar
            items={[
              { label: 'All Years', value: 'ALL' },
              ...availableYears.map((y) => ({ label: String(y), value: y as number | 'ALL' })),
            ]}
            current={filterYear}
            onSelect={setFilterYear}
          />
        </View>
      )}

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

      {/* BASE SALARY & 13TH MONTH RESERVES MANAGER MODAL */}
      <Modal visible={salaryVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%', padding: 0 }]}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: tokens.colors.borderSubtle }}>
              <Text style={styles.modalTitle}>Staff Salaries & 13th Month Reserves</Text>
              <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginTop: -8 }}>
                Manage base salary and monitor available 13th month / seniority reserve funds.
              </Text>
            </View>

            {salaryLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
              </View>
            ) : (
              <ScrollView style={{ padding: 16 }}>
                {users.length === 0 ? (
                  <Text style={{ color: tokens.colors.secondary, fontSize: 13 }}>No staff members loaded yet.</Text>
                ) : (
                  users.map((u) => {
                    const isSaving = savingSalaryFor === u.id
                    const reserveAmt = staffReserves[u.id] ?? 0
                    return (
                      <View key={u.id} style={styles.salaryCardItem}>
                        <View style={styles.salaryCardTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens.colors.onSurface }} numberOfLines={1}>
                              {u.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>{u.role}</Text>
                          </View>
                          <View style={styles.salaryInputGroup}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.colors.secondary }}>Base: $</Text>
                            <TextInput
                              style={[styles.input, styles.salaryInput]}
                              value={salaryDrafts[u.id] ?? '0'}
                              keyboardType="decimal-pad"
                              onChangeText={(t) => setSalaryDrafts((prev) => ({ ...prev, [u.id]: t }))}
                              placeholder="0.00"
                            />
                            <TouchableOpacity
                              style={styles.salarySaveBtn}
                              onPress={() => handleSaveSalary(u.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
                              ) : (
                                <Ionicons name="checkmark" size={16} color={tokens.colors.onPrimary} />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Live Calculated Daily Rate & 13th Month Accrual Row */}
                        {(() => {
                          const baseVal = parseFloat(salaryDrafts[u.id] ?? '0') || 0
                          const calculatedDaily = baseVal > 0 ? (baseVal / 26).toFixed(2) : '0.00'
                          const monthlyAccrual = baseVal > 0 ? (baseVal / 12).toFixed(2) : '0.00'

                          return (
                            <View style={styles.salaryMetricsRow}>
                              <View style={styles.salaryMetricCol}>
                                <Text style={styles.salaryMetricLabel}>CALCULATED DAILY (26d)</Text>
                                <Text style={styles.salaryMetricValue}>${calculatedDaily} / day</Text>
                              </View>
                              <View style={styles.salaryMetricDivider} />
                              <View style={styles.salaryMetricCol}>
                                <Text style={styles.salaryMetricLabel}>13TH MO. ACCRUAL</Text>
                                <Text style={[styles.salaryMetricValue, { color: tokens.colors.statusSuccess }]}>
                                  +${monthlyAccrual} / mo
                                </Text>
                              </View>
                            </View>
                          )
                        })()}

                        {/* Reserve Pool Sub-row with Standalone Payout Action */}
                        <View style={styles.reserveSubRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="wallet-outline" size={13} color={tokens.colors.statusSuccess} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.secondary }}>
                              Available Reserve: <Text style={{ color: tokens.colors.statusSuccess, fontWeight: '800' }}>{formatCurrency(reserveAmt)}</Text>
                            </Text>
                          </View>
                          {Boolean(can('payroll:manage')) && (
                            <TouchableOpacity
                              style={styles.disburseMiniBtn}
                              onPress={() => handleOpenStandalonePayout(u)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="gift-outline" size={11} color={tokens.colors.primaryContainer} />
                              <Text style={styles.disburseMiniBtnText}>Disburse Payout</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}

            <View style={[styles.modalActions, { padding: 16, borderTopWidth: 1, borderColor: tokens.colors.borderSubtle, marginTop: 0 }]}>
              <TouchableOpacity style={styles.modalBtnAction} onPress={() => setSalaryVisible(false)}>
                <Text style={styles.modalBtnActionText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* STANDALONE 13TH MONTH PAYOUT MODAL */}
      <Modal visible={!!standalonePayoutUser} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Disburse 13th Month / Bonus</Text>
            <Text style={{ fontSize: 12, color: tokens.colors.secondary, marginTop: -10, marginBottom: 12 }}>
              Staff: <Text style={{ fontWeight: '700', color: tokens.colors.onSurface }}>{standalonePayoutUser?.name}</Text> • Available: <Text style={{ fontWeight: '800', color: tokens.colors.statusSuccess }}>{formatCurrency(staffReserves[standalonePayoutUser?.id || ''] ?? 0)}</Text>
            </Text>

            <Text style={styles.modalLabel}>Payout Amount ($)</Text>
            <TextInput
              style={styles.input}
              value={standaloneAmount}
              keyboardType="decimal-pad"
              onChangeText={setStandaloneAmount}
              placeholder="0.00"
            />

            <Text style={styles.modalLabel}>Disbursement Notes / Reason</Text>
            <TextInput
              style={styles.input}
              value={standaloneNotes}
              onChangeText={setStandaloneNotes}
              placeholder="e.g. Khmer New Year 1st Half Bonus"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setStandalonePayoutUser(null)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnAction}
                onPress={handleRecordStandalonePayout}
                disabled={savingStandalone}
              >
                {savingStandalone ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnActionText}>Confirm Payout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* GENERATE MODAL WITH BATCH & MULTI-SELECTION OPTIONS */}
      <Modal visible={generateVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '88%', padding: 0 }]}>
            {/* Modal Header */}
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: tokens.colors.borderSubtle }}>
              <Text style={styles.modalTitle}>Generate Payroll</Text>
              <Text style={{ fontSize: 11, color: tokens.colors.secondary, marginTop: -8 }}>
                Generate draft payroll calculations for single staff, multi-select, or entire team in batch.
              </Text>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {/* Generation Mode Selector */}
              <View style={styles.genTabContainer}>
                <TouchableOpacity
                  style={[styles.genTabBtn, generateMode === 'BATCH' && styles.genTabBtnActive]}
                  onPress={() => setGenerateMode('BATCH')}
                >
                  <Text style={[styles.genTabText, generateMode === 'BATCH' && styles.genTabTextActive]}>
                    ⚡ Batch (All)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genTabBtn, generateMode === 'MULTI' && styles.genTabBtnActive]}
                  onPress={() => setGenerateMode('MULTI')}
                >
                  <Text style={[styles.genTabText, generateMode === 'MULTI' && styles.genTabTextActive]}>
                    ☑ Multi-Select
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genTabBtn, generateMode === 'SINGLE' && styles.genTabBtnActive]}
                  onPress={() => setGenerateMode('SINGLE')}
                >
                  <Text style={[styles.genTabText, generateMode === 'SINGLE' && styles.genTabTextActive]}>
                    👤 Single Staff
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Period Inputs (Month & Year) */}
              <View style={styles.twoColGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Month (1 - 12)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(selectedMonth)}
                    keyboardType="numeric"
                    onChangeText={(t) => setSelectedMonth(Number(t))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Year</Text>
                  <TextInput
                    style={styles.input}
                    value={String(selectedYear)}
                    keyboardType="numeric"
                    onChangeText={(t) => setSelectedYear(Number(t))}
                  />
                </View>
              </View>

              {/* Period Quick Month Indicator */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
                <Ionicons name="calendar-outline" size={13} color={tokens.colors.secondary} />
                <Text style={{ fontSize: 11.5, color: tokens.colors.secondary, fontWeight: '600' }}>
                  Target Period: <Text style={{ color: tokens.colors.primaryContainer, fontWeight: '800' }}>{MONTH_NAMES[selectedMonth - 1] || `Month ${selectedMonth}`} {selectedYear}</Text>
                </Text>
              </View>

              {/* MODE 1: BATCH GENERATE (ALL STAFF) */}
              {generateMode === 'BATCH' && (
                <View style={{ marginTop: 4 }}>
                  <View style={styles.batchStatsCard}>
                    <View style={styles.batchStatsRow}>
                      <View style={styles.batchStatCol}>
                        <Text style={styles.batchStatNum}>{users.length}</Text>
                        <Text style={styles.batchStatLabel}>Total Staff</Text>
                      </View>
                      <View style={styles.batchStatDivider} />
                      <View style={styles.batchStatCol}>
                        <Text style={[styles.batchStatNum, { color: tokens.colors.statusWarning }]}>
                          {periodExistingUserIds.size}
                        </Text>
                        <Text style={styles.batchStatLabel}>Already Created</Text>
                      </View>
                      <View style={styles.batchStatDivider} />
                      <View style={styles.batchStatCol}>
                        <Text style={[styles.batchStatNum, { color: tokens.colors.statusSuccess }]}>
                          {eligibleUsers.length}
                        </Text>
                        <Text style={styles.batchStatLabel}>Ready to Gen</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={{ fontSize: 11.5, color: tokens.colors.secondary, lineHeight: 16, marginBottom: 10 }}>
                    Batch generation will automatically calculate incentives from completed sales orders, apply configured base salaries, and create draft records for all {eligibleUsers.length} pending staff members.
                  </Text>
                </View>
              )}

              {/* MODE 2: MULTI-STAFF SELECTION */}
              {generateMode === 'MULTI' && (
                <View style={{ marginTop: 4 }}>
                  <View style={styles.multiToolbar}>
                    <Text style={styles.multiToolbarText}>
                      Selected: <Text style={{ color: tokens.colors.primaryContainer, fontWeight: '900' }}>{selectedStaffIds.size}</Text> / {eligibleUsers.length} Eligible
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity onPress={handleSelectAllEligible}>
                        <Text style={styles.quickActionText}>Select All</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleDeselectAll}>
                        <Text style={[styles.quickActionText, { color: tokens.colors.secondary }]}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView style={styles.multiStaffList} nestedScrollEnabled>
                    {users.map((u) => {
                      const isAlreadyGen = periodExistingUserIds.has(u.id)
                      const existingRecord = periodExistingUserIds.get(u.id)
                      const isChecked = selectedStaffIds.has(u.id)

                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[
                            styles.multiStaffRow,
                            isChecked && styles.multiStaffRowChecked,
                            isAlreadyGen && styles.multiStaffRowDisabled,
                          ]}
                          onPress={() => handleToggleStaffSelection(u.id)}
                          disabled={isAlreadyGen}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                            <View
                              style={[
                                styles.checkboxSquare,
                                isChecked && styles.checkboxSquareChecked,
                                isAlreadyGen && styles.checkboxSquareDisabled,
                              ]}
                            >
                              {Boolean(isChecked) && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onSurface }} numberOfLines={1}>
                                {u.name}
                              </Text>
                              <Text style={{ fontSize: 10.5, color: tokens.colors.secondary }}>{u.role}</Text>
                            </View>
                          </View>

                          {isAlreadyGen ? (
                            <View style={[styles.liveBadge, { backgroundColor: tokens.colors.statusWarning + '20' }]}>
                              <Text style={[styles.liveBadgeText, { color: tokens.colors.statusWarning }]}>
                                {existingRecord?.status || 'Created'}
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.secondary }}>
                              Ready
                            </Text>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>
                </View>
              )}

              {/* MODE 3: SINGLE STAFF SELECTION */}
              {generateMode === 'SINGLE' && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.modalLabel}>Staff Member</Text>
                  <View style={styles.pickerRow}>
                    {users.length === 0 ? (
                      <Text style={{ color: tokens.colors.secondary, fontSize: 13, paddingVertical: 4 }}>
                        No staff members loaded yet.
                      </Text>
                    ) : (
                      users.map((u) => (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.chip, selectedUser === u.id && styles.chipActive]}
                          onPress={() => setSelectedUser(u.id)}
                        >
                          <Text style={[styles.chipText, selectedUser === u.id && styles.chipTextActive]}>
                            {u.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  {existingPayrollForSelection ? (
                    <View style={styles.alreadyGeneratedWarning}>
                      <Ionicons name="information-circle" size={16} color={tokens.colors.statusWarning} />
                      <Text style={styles.alreadyGeneratedText}>
                        Payroll for this period already exists (Status: {existingPayrollForSelection.status}).
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View
              style={[
                styles.modalActions,
                { padding: 16, borderTopWidth: 1, borderColor: tokens.colors.borderSubtle, marginTop: 0 },
              ]}
            >
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setGenerateVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnAction,
                  ((generating) ||
                    (generateMode === 'BATCH' && eligibleUsers.length === 0) ||
                    (generateMode === 'MULTI' && selectedStaffIds.size === 0) ||
                    (generateMode === 'SINGLE' && (!selectedUser || !!existingPayrollForSelection))) &&
                    styles.modalBtnDisabled,
                ]}
                onPress={handleGenerate}
                disabled={
                  generating ||
                  (generateMode === 'BATCH' && eligibleUsers.length === 0) ||
                  (generateMode === 'MULTI' && selectedStaffIds.size === 0) ||
                  (generateMode === 'SINGLE' && (!selectedUser || !!existingPayrollForSelection))
                }
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnActionText}>
                    {generateMode === 'BATCH'
                      ? `Generate All (${eligibleUsers.length})`
                      : generateMode === 'MULTI'
                      ? `Generate Selected (${selectedStaffIds.size})`
                      : existingPayrollForSelection
                      ? 'Already Generated'
                      : 'Generate'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* IMPROVED PAYROLL DETAIL & EDITOR MODAL */}
      <Modal visible={detailVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%', padding: 0 }]}>
            {/* Modal Header */}
            <View style={styles.detailHeader}>
              <View style={styles.headerStaffIdentity}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {editingPayroll ? getStaffName(editingPayroll).charAt(0).toUpperCase() : 'S'}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modalStaffName} numberOfLines={1}>
                    {editingPayroll ? getStaffName(editingPayroll) : 'Staff Payroll'}
                  </Text>
                  <View style={styles.headerSubRow}>
                    <Text style={styles.modalPeriodPill}>
                      {editingPayroll
                        ? `${MONTH_NAMES[editingPayroll.period_month - 1] || editingPayroll.period_month} ${editingPayroll.period_year}`
                        : ''}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(payrollStatus) + '20' },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: getStatusColor(payrollStatus) }]}>
                        {payrollStatus}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setDetailVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {/* Status Banner */}
              <View style={[styles.statusBanner, { backgroundColor: getStatusColor(payrollStatus) + '18' }]}>
                <Ionicons
                  name={
                    payrollStatus === 'PAID'
                      ? 'checkmark-done-circle'
                      : payrollStatus === 'FINALIZED'
                      ? 'lock-closed'
                      : 'create-outline'
                  }
                  size={16}
                  color={getStatusColor(payrollStatus)}
                />
                <Text style={[styles.statusBannerText, { color: getStatusColor(payrollStatus) }]}>
                  {payrollStatus === 'DRAFT'
                    ? 'Draft Mode: All fields are editable. Review live calculation below.'
                    : payrollStatus === 'FINALIZED'
                    ? 'Finalized: Calculations are locked. Reopen as draft to modify.'
                    : 'Paid: Record has been settled and locked.'}
                </Text>
              </View>

              {/* CARD 1: Basic Earnings & Working Days */}
              <View style={styles.formSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="calendar-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.sectionTitle}>Working Days & Daily Rate</Text>
                </View>

                <View style={styles.infoRowGrid}>
                  <View style={styles.infoColBox}>
                    <Text style={styles.infoColLabel}>BASE SALARY</Text>
                    <Text style={styles.infoColValue}>{formatCurrency(summary.base)}</Text>
                  </View>
                  <View style={styles.infoColBox}>
                    <Text style={styles.infoColLabel}>CALCULATED DAILY RATE</Text>
                    <Text style={[styles.infoColValue, { color: tokens.colors.primaryContainer }]}>
                      {formatCurrency(summary.dailyRate)} / day
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalLabel}>Standard Working Days in Month</Text>
                <TextInput
                  style={[styles.input, !isEditable && styles.inputDisabled]}
                  value={workingDays}
                  keyboardType="numeric"
                  onChangeText={setWorkingDays}
                  editable={isEditable}
                  placeholder="26"
                />
              </View>

              {/* CARD 2: Overtime & Unpaid Leave */}
              <View style={styles.formSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="time-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.sectionTitle}>Attendance, OT & Leave</Text>
                </View>

                <View style={styles.twoColGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Overtime (Days)</Text>
                    <TextInput
                      style={[styles.input, !isEditable && styles.inputDisabled]}
                      value={otDays}
                      keyboardType="decimal-pad"
                      onChangeText={setOtDays}
                      editable={isEditable}
                      placeholder="0"
                    />
                    <Text style={styles.inputSubHint}>
                      +{formatCurrency(summary.otAmount)} ({otDays || 0} days @ {formatCurrency(summary.dailyRate)})
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Unpaid Leave (Days)</Text>
                    <TextInput
                      style={[styles.input, !isEditable && styles.inputDisabled]}
                      value={unpaidDays}
                      keyboardType="decimal-pad"
                      onChangeText={setUnpaidDays}
                      editable={isEditable}
                      placeholder="0"
                    />
                    <Text style={[styles.inputSubHint, { color: tokens.colors.statusError }]}>
                      -{formatCurrency(summary.unpaidDeduction)} ({unpaidDays || 0} days @ {formatCurrency(summary.dailyRate)})
                    </Text>
                  </View>
                </View>
              </View>

              {/* CARD 3: Sales Order Incentive Mode */}
              <View style={styles.formSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="trending-up-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.sectionTitle}>Sales Commission / Order Incentive</Text>
                </View>

                <View style={styles.pickerRow}>
                  {(['AUTO', 'MANUAL'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, incentiveMode === m && styles.chipActive]}
                      onPress={() => setIncentiveMode(m)}
                      disabled={!isEditable}
                    >
                      <Ionicons
                        name={m === 'AUTO' ? 'flash-outline' : 'create-outline'}
                        size={13}
                        color={incentiveMode === m ? tokens.colors.primaryContainer : tokens.colors.secondary}
                      />
                      <Text style={[styles.chipText, incentiveMode === m && styles.chipTextActive]}>
                        {m === 'AUTO' ? 'Auto from Orders' : 'Manual Override'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {incentiveMode === 'AUTO' ? (
                  <View style={styles.incentiveAutoInfoBox}>
                    <Text style={styles.incentiveAutoValueText}>
                      Auto Calculated: <Text style={{ fontWeight: '800' }}>+{formatCurrency(summary.incentive)}</Text>
                    </Text>
                    <Text style={styles.incentiveTierExplanation}>
                      Based on completed orders: $1–30: $0.25 • $30–50: $0.50 • $50–60: $0.75 • $60–80: $1.00 • &gt;$80: $2.00
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.modalLabel}>Manual Incentive Amount ($)</Text>
                    <TextInput
                      style={[styles.input, !isEditable && styles.inputDisabled]}
                      value={manualIncentive}
                      keyboardType="decimal-pad"
                      onChangeText={setManualIncentive}
                      editable={isEditable}
                      placeholder="0.00"
                    />
                  </View>
                )}
              </View>

              {/* CARD 4: Allowances & Performance Benefits */}
              <View style={styles.formSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="gift-outline" size={16} color={tokens.colors.primaryContainer} />
                  <Text style={styles.sectionTitle}>Benefits & Allowances</Text>
                </View>

                <View style={styles.benefitsGrid}>
                  <View style={styles.benefitInputCol}>
                    <View style={styles.benefitLabelRow}>
                      <Ionicons name="trophy-outline" size={12} color={tokens.colors.primaryContainer} />
                      <Text style={styles.benefitLabelText} numberOfLines={1}>Performance</Text>
                    </View>
                    <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                      <Text style={styles.currencyPrefix}>$</Text>
                      <TextInput
                        style={styles.benefitTextInput}
                        value={perfBenefit}
                        keyboardType="decimal-pad"
                        onChangeText={setPerfBenefit}
                        editable={isEditable}
                        placeholder="0.00"
                        placeholderTextColor={tokens.colors.textDisabled}
                      />
                    </View>
                  </View>

                  <View style={styles.benefitInputCol}>
                    <View style={styles.benefitLabelRow}>
                      <Ionicons name="bicycle-outline" size={12} color={tokens.colors.primaryContainer} />
                      <Text style={styles.benefitLabelText} numberOfLines={1}>Delivery</Text>
                    </View>
                    <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                      <Text style={styles.currencyPrefix}>$</Text>
                      <TextInput
                        style={styles.benefitTextInput}
                        value={delivBenefit}
                        keyboardType="decimal-pad"
                        onChangeText={setDelivBenefit}
                        editable={isEditable}
                        placeholder="0.00"
                        placeholderTextColor={tokens.colors.textDisabled}
                      />
                    </View>
                  </View>
                </View>

                <View style={[styles.benefitsGrid, { marginTop: 10 }]}>
                  <View style={styles.benefitInputCol}>
                    <View style={styles.benefitLabelRow}>
                      <Ionicons name="people-outline" size={12} color={tokens.colors.primaryContainer} />
                      <Text style={styles.benefitLabelText} numberOfLines={1}>Collective</Text>
                    </View>
                    <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                      <Text style={styles.currencyPrefix}>$</Text>
                      <TextInput
                        style={styles.benefitTextInput}
                        value={collecBenefit}
                        keyboardType="decimal-pad"
                        onChangeText={setCollecBenefit}
                        editable={isEditable}
                        placeholder="0.00"
                        placeholderTextColor={tokens.colors.textDisabled}
                      />
                    </View>
                  </View>

                  <View style={styles.benefitInputCol}>
                    <View style={styles.benefitLabelRow}>
                      <Ionicons name="add-circle-outline" size={12} color={tokens.colors.primaryContainer} />
                      <Text style={styles.benefitLabelText} numberOfLines={1}>Other Benefits</Text>
                    </View>
                    <View style={[styles.currencyInputBox, !isEditable && styles.inputDisabled]}>
                      <Text style={styles.currencyPrefix}>$</Text>
                      <TextInput
                        style={styles.benefitTextInput}
                        value={otherBenefit}
                        keyboardType="decimal-pad"
                        onChangeText={setOtherBenefit}
                        editable={isEditable}
                        placeholder="0.00"
                        placeholderTextColor={tokens.colors.textDisabled}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* CARD 5: 13TH MONTH / SENIORITY PAYOUT OPTION */}
              <View style={styles.formSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="trophy-outline" size={16} color={tokens.colors.statusSuccess} />
                  <Text style={styles.sectionTitle}>13th Month / Seniority Reserve Payout</Text>
                </View>

                <View style={styles.reserveInfoBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reserveBannerLabel}>ACCUMULATED RESERVE AVAILABLE</Text>
                    <Text style={styles.reserveBannerAmount}>{formatCurrency(summary.availableReservePool)}</Text>
                  </View>
                  <View style={styles.reserveAccruingBadge}>
                    <Text style={styles.reserveAccruingText}>+{formatCurrency(summary.thirteenth)}/mo accrued</Text>
                  </View>
                </View>

                {/* Toggle Payout for this Payroll */}
                <View style={styles.payoutToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payoutToggleTitle}>Include Payout in this Payroll</Text>
                    <Text style={styles.payoutToggleSub}>
                      E.g. Bi-annual Khmer New Year or Year-end disbursement
                    </Text>
                  </View>
                  <Switch
                    value={includeThirteenthPayout}
                    onValueChange={(val) => {
                      setIncludeThirteenthPayout(val)
                      if (val && (!thirteenthPayoutAmount || thirteenthPayoutAmount === '0')) {
                        setThirteenthPayoutAmount(String(summary.availableReservePool))
                      }
                    }}
                    disabled={!isEditable}
                    trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.statusSuccess + '80' }}
                    thumbColor={includeThirteenthPayout ? tokens.colors.statusSuccess : '#FFFFFF'}
                  />
                </View>

                {Boolean(includeThirteenthPayout) && (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.modalLabel}>Disbursement Amount ($)</Text>
                      {summary.availableReservePool > 0 && isEditable && (
                        <TouchableOpacity
                          onPress={() => setThirteenthPayoutAmount(String(summary.availableReservePool))}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.primaryContainer }}>
                            Pay Full ({formatCurrency(summary.availableReservePool)})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={[styles.input, !isEditable && styles.inputDisabled]}
                      value={thirteenthPayoutAmount}
                      keyboardType="decimal-pad"
                      onChangeText={setThirteenthPayoutAmount}
                      editable={isEditable}
                      placeholder="0.00"
                    />
                    <Text style={{ fontSize: 10, color: tokens.colors.secondary, marginTop: 4 }}>
                      Remaining reserve balance for next cycle: <Text style={{ fontWeight: '700', color: tokens.colors.onSurface }}>{formatCurrency(summary.remainingReserve)}</Text>
                    </Text>
                  </View>
                )}
              </View>

              {/* CARD 6: Complete Live Payslip Breakdown */}
              <View style={styles.payslipBreakdownCard}>
                <View style={styles.summaryHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="receipt-outline" size={16} color={tokens.colors.primaryContainer} />
                    <Text style={styles.summaryTitle}>Live Payslip Breakdown</Text>
                  </View>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>Live Math</Text>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Base Monthly Salary</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(summary.base)}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Order Incentive {incentiveMode === 'MANUAL' ? '(Manual)' : '(Auto)'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                    +{formatCurrency(summary.incentive)}
                  </Text>
                </View>

                {summary.perf > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Performance Benefit</Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                      +{formatCurrency(summary.perf)}
                    </Text>
                  </View>
                )}

                {summary.deliv > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery Benefit</Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                      +{formatCurrency(summary.deliv)}
                    </Text>
                  </View>
                )}

                {summary.otAmount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Overtime ({otDays} days)</Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                      +{formatCurrency(summary.otAmount)}
                    </Text>
                  </View>
                )}

                {summary.collec > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Collective Benefit</Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                      +{formatCurrency(summary.collec)}
                    </Text>
                  </View>
                )}

                {summary.other > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Other Benefits</Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess }]}>
                      +{formatCurrency(summary.other)}
                    </Text>
                  </View>
                )}

                {summary.payout > 0 && (
                  <View style={[styles.summaryRow, { backgroundColor: tokens.colors.statusSuccess + '12', paddingHorizontal: 6, borderRadius: 4 }]}>
                    <Text style={[styles.summaryLabel, { color: tokens.colors.statusSuccess, fontWeight: '700' }]}>
                      🎁 13th Month / Seniority Payout
                    </Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.statusSuccess, fontWeight: '800' }]}>
                      +{formatCurrency(summary.payout)}
                    </Text>
                  </View>
                )}

                {summary.unpaidDeduction > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Unpaid Leave ({unpaidDays} days)</Text>
                    <Text style={[styles.summaryValue, { color: tokens.colors.statusError }]}>
                      -{formatCurrency(summary.unpaidDeduction)}
                    </Text>
                  </View>
                )}

                <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: tokens.colors.borderSubtle }]}>
                  <Text style={[styles.summaryLabel, { fontStyle: 'italic' }]}>Monthly Accrual into Reserve Fund</Text>
                  <Text style={[styles.summaryValue, { color: tokens.colors.secondary }]}>
                    +{formatCurrency(summary.thirteenth)}/mo
                  </Text>
                </View>

                {/* Grand Total Net Pay Highlight */}
                <View style={styles.netHighlightBox}>
                  <View>
                    <Text style={styles.netHighlightLabel}>TOTAL NET PAY</Text>
                    <Text style={styles.netHighlightSub}>
                      Base + Benefits + OT {summary.payout > 0 ? '+ 13th Payout ' : ''}- Leave Deductions
                    </Text>
                  </View>
                  <Text style={styles.netHighlightAmount}>{formatCurrency(summary.net)}</Text>
                </View>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Lifecycle-aware Action Bar with prominent Delete for Drafts */}
            <View style={styles.detailActionBar}>
              {payrollStatus === 'DRAFT' && (
                <>
                  <TouchableOpacity
                    style={styles.modalBtnDestructive}
                    onPress={handleDeleteDraftFromModal}
                    disabled={savingDetail}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.modalBtnDestructiveText}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtnSecondary, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                    onPress={() => handleSaveDetail('draft')}
                    disabled={savingDetail}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Save Draft</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtnAction, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                    onPress={() => handleSaveDetail('finalize')}
                    disabled={savingDetail}
                    activeOpacity={0.85}
                  >
                    {savingDetail ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="lock-closed" size={14} color="#fff" />
                        <Text style={styles.modalBtnActionText}>Finalize</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {payrollStatus === 'FINALIZED' && (
                <>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setDetailVisible(false)}>
                    <Text style={styles.modalBtnCancelText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtnSecondary, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                    onPress={() => handleTransition('DRAFT')}
                    disabled={savingDetail}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={14} color={tokens.colors.primaryContainer} />
                    <Text style={styles.modalBtnSecondaryText}>Reopen Draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtnPaid, styles.modalBtnFlex, savingDetail && styles.modalBtnDisabled]}
                    onPress={() => handleTransition('PAID')}
                    disabled={savingDetail}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cash" size={15} color="#FFFFFF" />
                    <Text style={styles.modalBtnPaidText}>Mark as Paid</Text>
                  </TouchableOpacity>
                </>
              )}

              {payrollStatus === 'PAID' && (
                <TouchableOpacity
                  style={[styles.modalBtnAction, { width: '100%' }]}
                  onPress={() => setDetailVisible(false)}
                >
                  <Text style={styles.modalBtnActionText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  toolbarScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    gap: 8,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  generateBtnText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  salaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  salaryBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  salaryBtnText: {
    color: tokens.colors.primaryContainer,
    fontWeight: '600',
    fontSize: 13,
  },
  salaryBtnTextActive: {
    color: tokens.colors.onPrimary,
  },
  salaryCardItem: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.sm,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  salaryCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  salaryInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  salaryInput: {
    width: 80,
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 6,
    height: 34,
  },
  salarySaveBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  disburseMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.primaryContainer + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
  },
  disburseMiniBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  listContent: {
    padding: tokens.spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: tokens.colors.secondary,
    marginTop: 12,
  },
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  cardIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIdText: {
    flex: 1,
    minWidth: 0,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.primaryContainer + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  cardDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  figuresRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  figureBox: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 0,
  },
  figureLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: tokens.colors.textMuted,
  },
  figureValue: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onSurface,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  netLabel: {
    color: tokens.colors.onSurface,
    fontWeight: '700',
    fontSize: 13,
  },
  netValue: {
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
    color: tokens.colors.primaryContainer,
    fontWeight: '800',
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  periodText: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
  },
  modalTitle: {
    ...tokens.typography.title,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    marginTop: 6,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
    borderTopLeftRadius: tokens.borderRadius.lg,
    borderTopRightRadius: tokens.borderRadius.lg,
  },
  headerStaffIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalStaffName: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  modalPeriodPill: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  modalCloseIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  formSectionCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  infoRowGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  infoColBox: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 8,
    borderRadius: tokens.borderRadius.sm,
  },
  infoColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  infoColValue: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onSurface,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  twoColGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inputSubHint: {
    fontSize: 10,
    color: tokens.colors.statusSuccess,
    fontWeight: '600',
    marginTop: 3,
  },
  incentiveAutoInfoBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 10,
    borderRadius: tokens.borderRadius.sm,
    marginTop: 8,
  },
  incentiveAutoValueText: {
    fontSize: 12,
    color: tokens.colors.onSurface,
  },
  incentiveTierExplanation: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 3,
    lineHeight: 14,
  },
  reserveInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 10,
    borderRadius: tokens.borderRadius.sm,
    marginBottom: 10,
  },
  reserveBannerLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  reserveBannerAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: tokens.colors.statusSuccess,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  reserveAccruingBadge: {
    backgroundColor: tokens.colors.statusSuccess + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reserveAccruingText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.statusSuccess,
  },
  payoutToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  payoutToggleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  payoutToggleSub: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  payslipBreakdownCard: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 14,
    borderRadius: tokens.borderRadius.md,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  liveBadge: {
    backgroundColor: tokens.colors.statusSuccess + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: tokens.colors.statusSuccess,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3.5,
  },
  summaryLabel: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  netHighlightBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
    padding: 10,
    borderRadius: tokens.borderRadius.sm,
  },
  netHighlightLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  netHighlightSub: {
    fontSize: 9.5,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  netHighlightAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
    fontVariant: ['tabular-nums'],
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    color: tokens.colors.onSurface,
    backgroundColor: tokens.colors.surface,
  },
  inputDisabled: {
    backgroundColor: tokens.colors.surfaceMuted,
    color: tokens.colors.secondary,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: tokens.colors.primaryContainer + '18',
    borderColor: tokens.colors.primaryContainer,
  },
  chipText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  chipTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '700',
  },
  detailActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
    borderBottomLeftRadius: tokens.borderRadius.lg,
    borderBottomRightRadius: tokens.borderRadius.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tokens.borderRadius.pill,
  },
  modalBtnCancelText: {
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
  modalBtnDestructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.pill,
    minWidth: 80,
  },
  modalBtnDestructiveText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12.5,
  },
  modalBtnSecondary: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  modalBtnSecondaryText: {
    color: tokens.colors.primaryContainer,
    fontWeight: '700',
    fontSize: 12.5,
  },
  modalBtnAction: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tokens.borderRadius.pill,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  modalBtnActionText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 12.5,
  },
  modalBtnPaid: {
    backgroundColor: tokens.colors.statusSuccess,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  modalBtnPaidText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
  },
  modalBtnFlex: {
    flex: 1,
    minWidth: 0,
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  filterSection: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    gap: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: tokens.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryContainer,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  filterChipTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '700',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: tokens.borderRadius.sm,
    marginBottom: 12,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
  },
  cardSelected: {
    borderColor: tokens.colors.primaryContainer,
    borderWidth: 2,
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.colors.outline,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleOn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  selectCircleDisabled: {
    opacity: 0.35,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  bulkBar: {
    position: 'absolute',
    bottom: 16,
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    ...tokens.shadows.card,
  },
  bulkHint: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.onSurface,
    marginRight: 8,
  },
  bulkPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.statusSuccess,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: tokens.borderRadius.pill,
  },
  bulkPayText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  alreadyGeneratedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.statusWarning + '18',
    padding: 10,
    borderRadius: tokens.borderRadius.sm,
    marginTop: 12,
  },
  alreadyGeneratedText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.statusWarning,
  },
  // Benefits & Allowances 2x2 Grid Styles
  benefitsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  benefitInputCol: {
    flex: 1,
  },
  benefitLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 22,
    marginBottom: 4,
  },
  benefitLabelText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 10,
    height: 42,
  },
  currencyPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginRight: 4,
  },
  benefitTextInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: tokens.colors.onSurface,
    padding: 0,
  },
  // Staff Salary Live Metrics Styles
  salaryMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  salaryMetricCol: {
    flex: 1,
  },
  salaryMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
    marginHorizontal: 8,
  },
  salaryMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  salaryMetricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.onSurface,
    marginTop: 1,
  },
  // Batch & Multi-Select Generation Styles
  genTabContainer: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.pill,
    padding: 3,
    marginBottom: 14,
  },
  genTabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genTabBtnActive: {
    backgroundColor: tokens.colors.surfaceCard,
    ...tokens.shadows.card,
  },
  genTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  genTabTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '800',
  },
  batchStatsCard: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  batchStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  batchStatCol: {
    alignItems: 'center',
  },
  batchStatNum: {
    fontSize: 18,
    fontWeight: '900',
    color: tokens.colors.onSurface,
  },
  batchStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  batchStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: tokens.colors.borderSubtle,
  },
  multiStaffList: {
    maxHeight: 220,
    marginBottom: 12,
  },
  multiStaffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: tokens.borderRadius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
    marginBottom: 6,
  },
  multiStaffRowChecked: {
    borderColor: tokens.colors.primaryContainer,
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  multiStaffRowDisabled: {
    opacity: 0.55,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: tokens.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxSquareChecked: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  checkboxSquareDisabled: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.outline,
  },
  multiToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  multiToolbarText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  quickActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
})
