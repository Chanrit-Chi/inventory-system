import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type {
  UserAccount,
  StaffPerformance,
  StaffIncentiveBreakdown,
  SalaryHistoryResponse,
  ThirteenthMonthSummary,
} from '../types'
import {
  fetchUser,
  fetchStaffPerformance,
  fetchStaffIncentives,
  fetchSalaryHistory,
  fetch13thMonthSavings,
  fetchMyPerformance,
  fetchMyIncentives,
  fetchMySalaryHistory,
  fetchMy13thMonthSavings,
  setUserSalary,
  record13thMonthPayout,
} from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../context/ToastContext'

export interface StaffDetailModalProps {
  visible: boolean
  user: UserAccount | null
  onClose: () => void
  onEditProfile?: (user: UserAccount) => void
  onStatusToggle?: (user: UserAccount) => void
}

type TabKey = 'profile' | 'performance' | 'incentives' | 'salary' | 'reserves'

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  visible,
  user,
  onClose,
  onEditProfile,
  onStatusToggle,
}) => {
  const { showToast } = useToast()
  const { currentUser } = useAuth()
  const { can } = usePermissions()
  const isSelf = !!(currentUser && user && currentUser.id === user.id)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
  const isAdmin = currentUser?.role === 'ADMIN'
  const canManageStaff = isSuperAdmin || isAdmin || can('users:manage')
  const canManagePayroll = (isSuperAdmin || isAdmin || can('payroll:manage')) && (!isSelf || isSuperAdmin)

  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const [localUser, setLocalUser] = useState<UserAccount | null>(user)

  useEffect(() => {
    setLocalUser(user)
    if (visible && user?.id) {
      fetchUser(user.id)
        .then((fresh) => {
          if (fresh) {
            setLocalUser((prev) => (prev ? { ...prev, ...fresh } : fresh))
          }
        })
        .catch((err) => {
          console.warn('Failed to load fresh user stats:', err)
        })
    }
  }, [visible, user])

  const activeUser = localUser || user

  // Performance State
  const [perfPeriod, setPerfPeriod] = useState<'today' | '7d' | '30d' | 'month' | 'year'>('30d')
  const [perfData, setPerfData] = useState<StaffPerformance | null>(null)
  const [perfLoading, setPerfLoading] = useState(false)

  // Incentive State
  const [incMonth, setIncMonth] = useState(new Date().getMonth() + 1)
  const [incYear, setIncYear] = useState(new Date().getFullYear())
  const [incData, setIncData] = useState<StaffIncentiveBreakdown | null>(null)
  const [incLoading, setIncLoading] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  // Salary History & Raise State
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryResponse | null>(null)
  const [salaryLoading, setSalaryLoading] = useState(false)
  const [raiseModalVisible, setRaiseModalVisible] = useState(false)
  const [newSalaryAmount, setNewSalaryAmount] = useState('')
  const [raiseReason, setRaiseReason] = useState('Annual Performance Raise')
  const [raiseEffectiveDate, setRaiseEffectiveDate] = useState(new Date().toISOString().split('T')[0])
  const [savingRaise, setSavingRaise] = useState(false)

  // 13th Month / Reserves State
  const [reserveSummary, setReserveSummary] = useState<ThirteenthMonthSummary | null>(null)
  const [reserveLoading, setReserveLoading] = useState(false)
  const [disburseModalVisible, setDisburseModalVisible] = useState(false)
  const [disburseAmount, setDisburseAmount] = useState('')
  const [disburseNotes, setDisburseNotes] = useState('Khmer New Year / Mid-Year Bonus')
  const [savingDisburse, setSavingDisburse] = useState(false)

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val || 0)
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Load Performance Data
  const loadPerformance = useCallback(async () => {
    if (!user) return
    setPerfLoading(true)
    try {
      const res = isSelf
        ? await fetchMyPerformance({ period: perfPeriod })
        : await fetchStaffPerformance(user.id, { period: perfPeriod })
      if (res && res.data) {
        setPerfData(res.data)
      }
    } catch (err) {
      console.warn('Failed to load staff performance:', err)
    } finally {
      setPerfLoading(false)
    }
  }, [user, perfPeriod, isSelf])

  // Load Incentives Data
  const loadIncentives = useCallback(async () => {
    if (!user) return
    setIncLoading(true)
    try {
      const res = isSelf
        ? await fetchMyIncentives({ month: incMonth, year: incYear })
        : await fetchStaffIncentives(user.id, { month: incMonth, year: incYear })
      if (res && res.data) {
        setIncData(res.data)
      }
    } catch (err) {
      console.warn('Failed to load staff incentives:', err)
    } finally {
      setIncLoading(false)
    }
  }, [user, incMonth, incYear, isSelf])

  // Load Salary History
  const loadSalaryHistory = useCallback(async () => {
    if (!user) return
    setSalaryLoading(true)
    try {
      const res = isSelf
        ? await fetchMySalaryHistory()
        : await fetchSalaryHistory(user.id)
      if (res && res.data) {
        setSalaryHistory(res.data)
      }
    } catch (err) {
      console.warn('Failed to load salary history:', err)
    } finally {
      setSalaryLoading(false)
    }
  }, [user, isSelf])

  // Load Reserves
  const loadReserves = useCallback(async () => {
    if (!user) return
    setReserveLoading(true)
    try {
      const res = isSelf
        ? await fetchMy13thMonthSavings()
        : await fetch13thMonthSavings(user.id)
      if (res && res.data) {
        setReserveSummary(res.data)
      }
    } catch (err) {
      console.warn('Failed to load reserves:', err)
    } finally {
      setReserveLoading(false)
    }
  }, [user, isSelf])

  useEffect(() => {
    if (!visible || !user) return

    if (activeTab === 'performance') {
      loadPerformance()
    } else if (activeTab === 'incentives') {
      loadIncentives()
    } else if (activeTab === 'salary') {
      loadSalaryHistory()
    } else if (activeTab === 'reserves') {
      loadReserves()
    }
  }, [visible, user, activeTab, loadPerformance, loadIncentives, loadSalaryHistory, loadReserves])

  const toggleDateExpanded = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const handleGrantRaise = async () => {
    if (!user) return
    const amt = parseFloat(newSalaryAmount)
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Salary', 'Please enter a valid salary amount greater than $0.')
      return
    }

    setSavingRaise(true)
    try {
      await setUserSalary(user.id, {
        base_salary: amt,
        effective_from: raiseEffectiveDate.trim() || undefined,
        reason: raiseReason.trim() || 'Salary Raise',
      })
      showToast('New base salary of ' + formatCurrency(amt) + ' recorded.', 'success')
      setRaiseModalVisible(false)
      setNewSalaryAmount('')
      await loadSalaryHistory()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string }
      showToast(error.response?.data?.message || error.message || 'Failed to update salary.', 'error')
    } finally {
      setSavingRaise(false)
    }
  }

  const handleDisbursePayout = async () => {
    if (!user) return
    const amt = parseFloat(disburseAmount)
    const available = reserveSummary?.available_balance ?? 0

    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payout amount greater than $0.', 'warning')
      return
    }

    if (amt > available) {
      showToast('Payout amount exceeds available reserve (' + formatCurrency(available) + ').', 'warning')
      return
    }

    setSavingDisburse(true)
    try {
      await record13thMonthPayout(user.id, {
        amount: amt,
        notes: disburseNotes.trim(),
      })
      showToast('Successfully disbursed ' + formatCurrency(amt) + ' seniority payout.', 'success')
      setDisburseModalVisible(false)
      setDisburseAmount('')
      await loadReserves()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string }
      showToast(error.response?.data?.message || error.message || 'Failed to disburse payout.', 'error')
    } finally {
      setSavingDisburse(false)
    }
  }

  if (!user || !activeUser) return null

  const initial = activeUser.name.charAt(0).toUpperCase()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.topHeader}>
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.staffName} numberOfLines={1}>
                    {activeUser.name}
                  </Text>
                  <View style={[styles.roleBadge, activeUser.role === 'SUPER_ADMIN' && styles.roleSuperAdmin]}>
                    <Text style={styles.roleBadgeText}>{activeUser.role}</Text>
                  </View>
                </View>
                <Text style={styles.staffEmail} numberOfLines={1}>
                  {activeUser.email} • {activeUser.department || 'General Store'}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
              {(
                [
                  { key: 'profile', label: 'Profile', icon: 'person-outline' },
                  { key: 'performance', label: 'Performance', icon: 'trending-up-outline' },
                  { key: 'incentives', label: 'Incentives', icon: 'gift-outline' },
                  { key: 'salary', label: 'Salary History', icon: 'cash-outline' },
                  { key: 'reserves', label: '13th Mo. Reserves', icon: 'trophy-outline' },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tabItem, isActive && styles.tabItemActive]}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={14}
                      color={isActive ? tokens.colors.primaryContainer : tokens.colors.secondary}
                    />
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {activeTab === 'profile' && (
              <View>
                <View style={styles.profileActionBar}>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: user.isActive ? tokens.colors.statusSuccess + '20' : '#FEE2E2' },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: user.isActive ? tokens.colors.statusSuccess : '#DC2626' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: user.isActive ? tokens.colors.statusSuccess : '#DC2626' },
                      ]}
                    >
                      {user.isActive ? 'Active Staff' : 'Deactivated'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {Boolean(canManageStaff && !isSelf && onEditProfile) && (
                      <TouchableOpacity style={styles.miniActionBtn} onPress={() => onEditProfile?.(user)}>
                        <Ionicons name="pencil-outline" size={13} color={tokens.colors.primaryContainer} />
                        <Text style={styles.miniActionBtnText}>Edit Info</Text>
                      </TouchableOpacity>
                    )}
                    {Boolean(canManageStaff && !isSelf && onStatusToggle && user.role !== 'SUPER_ADMIN') && (
                      <TouchableOpacity
                        style={[styles.miniActionBtn, { borderColor: user.isActive ? '#FECACA' : '#BBF7D0' }]}
                        onPress={() => onStatusToggle?.(user)}
                      >
                        <Ionicons
                          name={user.isActive ? 'pause-outline' : 'play-outline'}
                          size={13}
                          color={user.isActive ? '#DC2626' : tokens.colors.statusSuccess}
                        />
                        <Text
                          style={[
                            styles.miniActionBtnText,
                            { color: user.isActive ? '#DC2626' : tokens.colors.statusSuccess },
                          ]}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.cardSectionTitle}>EMPLOYMENT DETAILS</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Department / Store</Text>
                    <Text style={styles.detailValue}>{activeUser.department || 'Main Counter'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hire Date</Text>
                    <Text style={styles.detailValue}>
                      {activeUser.hire_date ? new Date(activeUser.hire_date).toLocaleDateString() : 'Not Specified'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contact Phone</Text>
                    <Text style={styles.detailValue}>{activeUser.phone || 'No phone recorded'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Permission Group</Text>
                    <Text style={styles.detailValue}>{activeUser.permissionGroup || 'Standard Role'}</Text>
                  </View>
                  {activeUser.notes ? (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: tokens.colors.borderSubtle }}>
                      <Text style={styles.detailLabel}>Notes</Text>
                      <Text style={{ fontSize: 12.5, color: tokens.colors.onSurface, marginTop: 2 }}>{activeUser.notes}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.cardSectionTitle}>LIFETIME METRICS</Text>
                  <View style={styles.twoColGrid}>
                    <View style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>TOTAL ORDERS</Text>
                      <Text style={styles.kpiValue}>
                        {activeUser.stats?.total_orders ?? perfData?.total_orders ?? perfData?.summary?.total_orders ?? 0}
                      </Text>
                    </View>
                    <View style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>TOTAL SALES VOLUME</Text>
                      <Text style={[styles.kpiValue, { color: tokens.colors.primaryContainer }]}>
                        {formatCurrency(activeUser.stats?.total_sales ?? perfData?.total_revenue ?? perfData?.summary?.total_revenue ?? 0)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.twoColGrid, { marginTop: 8 }]}>
                    <View style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>TOTAL NET SALARY PAID</Text>
                      <Text style={[styles.kpiValue, { color: tokens.colors.statusSuccess }]}>
                        {formatCurrency(activeUser.stats?.total_net_paid ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>ACCOUNT CREATED</Text>
                      <Text style={styles.kpiValue}>
                        {activeUser.hire_date
                          ? new Date(activeUser.hire_date).toLocaleDateString()
                          : activeUser.createdAt || activeUser.created_at
                          ? new Date(activeUser.createdAt || activeUser.created_at!).toLocaleDateString()
                          : 'Active Member'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'performance' && (
              <View>
                <View style={styles.filterChipRow}>
                  {(
                    [
                      { key: 'today', label: 'Today' },
                      { key: '7d', label: '7 Days' },
                      { key: '30d', label: '30 Days' },
                      { key: 'month', label: 'This Month' },
                      { key: 'year', label: 'This Year' },
                    ] as const
                  ).map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      style={[styles.periodChip, perfPeriod === p.key && styles.periodChipActive]}
                      onPress={() => setPerfPeriod(p.key)}
                    >
                      <Text
                        style={[styles.periodChipText, perfPeriod === p.key && styles.periodChipTextActive]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {perfLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                    <Text style={styles.loadingText}>Loading performance data...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.twoColGrid}>
                      <View style={styles.kpiCard}>
                        <View style={styles.kpiHeaderRow}>
                          <Ionicons name="cash-outline" size={15} color={tokens.colors.primaryContainer} />
                          <Text style={styles.kpiCardLabel}>SALES REVENUE</Text>
                        </View>
                        <Text style={[styles.kpiCardValue, { color: tokens.colors.primaryContainer }]}>
                          {formatCurrency(perfData?.summary.total_revenue)}
                        </Text>
                      </View>

                      <View style={styles.kpiCard}>
                        <View style={styles.kpiHeaderRow}>
                          <Ionicons name="receipt-outline" size={15} color={tokens.colors.onSurface} />
                          <Text style={styles.kpiCardLabel}>COMPLETED ORDERS</Text>
                        </View>
                        <Text style={styles.kpiCardValue}>{perfData?.summary.total_orders ?? 0}</Text>
                      </View>
                    </View>

                    <View style={[styles.twoColGrid, { marginTop: 8 }]}>
                      <View style={styles.kpiCard}>
                        <View style={styles.kpiHeaderRow}>
                          <Ionicons name="pricetag-outline" size={15} color={tokens.colors.secondary} />
                          <Text style={styles.kpiCardLabel}>AVG TICKET VALUE</Text>
                        </View>
                        <Text style={styles.kpiCardValue}>
                          {formatCurrency(perfData?.summary.avg_order_value)}
                        </Text>
                      </View>

                      <View style={styles.kpiCard}>
                        <View style={styles.kpiHeaderRow}>
                          <Ionicons name="gift-outline" size={15} color={tokens.colors.statusSuccess} />
                          <Text style={styles.kpiCardLabel}>COMMISSION EARNED</Text>
                        </View>
                        <Text style={[styles.kpiCardValue, { color: tokens.colors.statusSuccess }]}>
                          +{formatCurrency(perfData?.summary.total_incentive)}
                        </Text>
                      </View>
                    </View>

                    {perfData?.channel_breakdown && perfData.channel_breakdown.length > 0 && (
                      <View style={[styles.sectionCard, { marginTop: 14 }]}>
                        <Text style={styles.cardSectionTitle}>SALES BY CHANNEL</Text>
                        {perfData.channel_breakdown.map((ch, idx) => (
                          <View key={idx} style={{ marginVertical: 6 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: tokens.colors.onSurface }}>
                                {ch.channel} ({ch.order_count} orders)
                              </Text>
                              <Text style={{ fontSize: 12.5, fontWeight: '800', color: tokens.colors.primaryContainer }}>
                                {formatCurrency(ch.total_revenue)} ({ch.percentage}%)
                              </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View style={[styles.progressBarFill, { width: `${Math.min(ch.percentage, 100)}%` as import('react-native').DimensionValue }]} />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={[styles.sectionCard, { marginTop: 14 }]}>
                      <Text style={styles.cardSectionTitle}>DAILY SALES LOG</Text>
                      {perfData?.daily_trends && perfData.daily_trends.length > 0 ? (
                        perfData.daily_trends.map((day, idx) => (
                          <View key={idx} style={styles.dailyTrendRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onSurface }}>
                                {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </Text>
                              <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                                {day.order_count} order(s) completed
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.colors.onSurface }}>
                                {formatCurrency(day.total_revenue)}
                              </Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.colors.statusSuccess }}>
                                +{formatCurrency(day.total_incentive)} com.
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={{ fontSize: 12.5, color: tokens.colors.secondary, paddingVertical: 8 }}>
                          No sales recorded in this period.
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </View>
            )}

            {activeTab === 'incentives' && (
              <View>
                <View style={styles.periodPickerBar}>
                  <TouchableOpacity
                    style={styles.periodArrowBtn}
                    onPress={() => {
                      if (incMonth === 1) {
                        setIncMonth(12)
                        setIncYear((y) => y - 1)
                      } else {
                        setIncMonth((m) => m - 1)
                      }
                    }}
                  >
                    <Ionicons name="chevron-back" size={16} color={tokens.colors.onSurface} />
                  </TouchableOpacity>
                  <Text style={styles.periodPickerTitle}>
                    Month {incMonth} / {incYear}
                  </Text>
                  <TouchableOpacity
                    style={styles.periodArrowBtn}
                    onPress={() => {
                      if (incMonth === 12) {
                        setIncMonth(1)
                        setIncYear((y) => y + 1)
                      } else {
                        setIncMonth((m) => m + 1)
                      }
                    }}
                  >
                    <Ionicons name="chevron-forward" size={16} color={tokens.colors.onSurface} />
                  </TouchableOpacity>
                </View>

                {incLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                    <Text style={styles.loadingText}>Calculating commissions...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.incentiveSummaryBanner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.incentiveBannerLabel}>TOTAL COMMISSION EARNED</Text>
                        <Text style={styles.incentiveBannerAmount}>
                          +{formatCurrency(incData?.summary.total_incentive)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.colors.onSurface }}>
                          {incData?.summary.total_orders ?? 0} Orders
                        </Text>
                        <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                          Sales: {formatCurrency(incData?.summary.total_sales)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.tierInfoCard}>
                      <Text style={styles.tierInfoTitle}>COMMISSION TIER RATES PER COMPLETED ORDER</Text>
                      <Text style={styles.tierInfoText}>
                        $1–30: $0.25 • $30–50: $0.50 • $50–60: $0.75 • $60–80: $1.00 • &gt;$80: $2.00
                      </Text>
                    </View>

                    <View style={[styles.sectionCard, { marginTop: 14 }]}>
                      <Text style={styles.cardSectionTitle}>DAILY COMMISSION BREAKDOWN</Text>
                      {incData?.daily_breakdown && incData.daily_breakdown.length > 0 ? (
                        incData.daily_breakdown.map((day) => {
                          const isExpanded = expandedDates.has(day.date)
                          return (
                            <View key={day.date} style={styles.dayGroupContainer}>
                              <TouchableOpacity
                                style={styles.dayGroupHeader}
                                onPress={() => toggleDateExpanded(day.date)}
                                activeOpacity={0.7}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Ionicons
                                    name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                                    size={14}
                                    color={tokens.colors.secondary}
                                  />
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onSurface }}>
                                    {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </Text>
                                  <View style={styles.orderCountBadge}>
                                    <Text style={styles.orderCountBadgeText}>{day.order_count} orders</Text>
                                  </View>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.colors.statusSuccess }}>
                                  +{formatCurrency(day.total_incentive)}
                                </Text>
                              </TouchableOpacity>

                              {Boolean(isExpanded) && (
                                <View style={styles.dayOrdersList}>
                                  {day.orders.map((ord) => (
                                    <View key={ord.id} style={styles.orderItemRow}>
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.colors.onSurface }}>
                                          #{ord.order_number} • {ord.customer_name}
                                        </Text>
                                        <Text style={{ fontSize: 10.5, color: tokens.colors.secondary }}>
                                          {ord.channel_name} • Order: {formatCurrency(ord.total_amount)}
                                        </Text>
                                      </View>
                                      <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: tokens.colors.statusSuccess }}>
                                          +{formatCurrency(ord.incentive)}
                                        </Text>
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )
                        })
                      ) : (
                        <Text style={{ fontSize: 12.5, color: tokens.colors.secondary, paddingVertical: 8 }}>
                          No commission earned in this month.
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </View>
            )}

            {activeTab === 'salary' && (
              <View>
                <View style={styles.currentSalaryCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={styles.currentSalaryLabel}>CURRENT EFFECTIVE BASE SALARY</Text>
                      <Text style={styles.currentSalaryAmount}>
                        {formatCurrency(salaryHistory?.current_salary)}
                        <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.colors.secondary }}> / mo</Text>
                      </Text>
                    </View>
                    {Boolean(canManagePayroll) && (
                      <TouchableOpacity
                        style={styles.grantRaiseBtn}
                        onPress={() => {
                          setNewSalaryAmount(String(salaryHistory?.current_salary || ''))
                          setRaiseModalVisible(true)
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trending-up" size={14} color="#FFFFFF" />
                        <Text style={styles.grantRaiseBtnText}>Grant Raise</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {(() => {
                    const base = salaryHistory?.current_salary ?? 0
                    const daily = base > 0 ? (base / 26).toFixed(2) : '0.00'
                    const accrual = base > 0 ? (base / 12).toFixed(2) : '0.00'
                    return (
                      <View style={styles.metricsRowSub}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subMetricLabel}>CALCULATED DAILY (26d)</Text>
                          <Text style={styles.subMetricValue}>${daily} / day</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subMetricLabel}>13TH MO. MONTHLY ACCRUAL</Text>
                          <Text style={[styles.subMetricValue, { color: tokens.colors.statusSuccess }]}>
                            +${accrual} / mo
                          </Text>
                        </View>
                      </View>
                    )
                  })()}
                </View>

                <View style={[styles.sectionCard, { marginTop: 14 }]}>
                  <Text style={styles.cardSectionTitle}>SALARY RAISE HISTORY & TIMELINE</Text>
                  {salaryLoading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                    </View>
                  ) : salaryHistory?.history && salaryHistory.history.length > 0 ? (
                    salaryHistory.history.map((item, idx) => (
                      <View key={item.id || idx} style={styles.timelineItem}>
                        <View style={styles.timelineIconBox}>
                          <Ionicons
                            name={item.diff_amount > 0 ? 'arrow-up-circle' : 'checkmark-circle'}
                            size={18}
                            color={item.diff_amount > 0 ? tokens.colors.statusSuccess : tokens.colors.primaryContainer}
                          />
                          {idx < salaryHistory.history.length - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.timelineSalary}>{formatCurrency(item.base_salary)}</Text>
                            {item.diff_amount > 0 && (
                              <View style={styles.raiseBadge}>
                                <Text style={styles.raiseBadgeText}>
                                  +{formatCurrency(item.diff_amount)} (+{item.diff_percent}%)
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.timelineReason}>{item.reason}</Text>
                          <Text style={styles.timelineMeta}>
                            Effective: {item.effective_from || 'Immediate'} • Recorded by {item.created_by}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 12.5, color: tokens.colors.secondary, paddingVertical: 8 }}>
                      No salary history records found.
                    </Text>
                  )}
                </View>
              </View>
            )}

            {activeTab === 'reserves' && (
              <View>
                <View style={styles.reserveOverviewCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={styles.reserveOverviewLabel}>ACCUMULATED SENIORITY RESERVE</Text>
                      <Text style={styles.reserveOverviewAmount}>
                        {formatCurrency(reserveSummary?.available_balance)}
                      </Text>
                    </View>
                    {Boolean(canManagePayroll) && (
                      <TouchableOpacity
                        style={styles.disburseBtn}
                        onPress={() => {
                          setDisburseAmount(String(reserveSummary?.available_balance ?? ''))
                          setDisburseModalVisible(true)
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="gift" size={14} color="#FFFFFF" />
                        <Text style={styles.disburseBtnText}>Disburse Bonus</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.reserveStatsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subMetricLabel}>TOTAL ACCRUED</Text>
                      <Text style={styles.subMetricValue}>{formatCurrency(reserveSummary?.total_accrued)}</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subMetricLabel}>TOTAL DISBURSED</Text>
                      <Text style={[styles.subMetricValue, { color: tokens.colors.secondary }]}>
                        {formatCurrency(reserveSummary?.total_disbursed)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.sectionCard, { marginTop: 14 }]}>
                  <Text style={styles.cardSectionTitle}>PAYOUT & BONUS DISBURSEMENTS</Text>
                  {reserveLoading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
                    </View>
                  ) : reserveSummary?.payouts && reserveSummary.payouts.length > 0 ? (
                    reserveSummary.payouts.map((p) => (
                      <View key={p.id} style={styles.payoutHistoryRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.colors.onSurface }}>
                            {p.notes || 'Seniority Bonus Payout'}
                          </Text>
                          <Text style={{ fontSize: 11, color: tokens.colors.secondary }}>
                            Disbursed: {new Date(p.payout_date).toLocaleDateString()} • {p.payment_method}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13.5, fontWeight: '900', color: tokens.colors.primaryContainer }}>
                          {formatCurrency(p.amount)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 12.5, color: tokens.colors.secondary, paddingVertical: 8 }}>
                      No bonus payouts have been recorded yet.
                    </Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          <Modal visible={raiseModalVisible} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.innerModalOverlay}>
              <View style={styles.innerModalContent}>
                <Text style={styles.innerModalTitle}>Grant Salary Raise</Text>
                <Text style={{ fontSize: 11.5, color: tokens.colors.secondary, marginTop: -8, marginBottom: 12 }}>
                  Adjust base salary for {user.name}. Active draft payrolls will automatically recalculate.
                </Text>

                <Text style={styles.inputLabel}>New Base Salary ($)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newSalaryAmount}
                  keyboardType="decimal-pad"
                  onChangeText={setNewSalaryAmount}
                  placeholder="0.00"
                />

                <Text style={styles.inputLabel}>Effective Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={raiseEffectiveDate}
                  onChangeText={setRaiseEffectiveDate}
                  placeholder="2026-08-26"
                />

                <Text style={styles.inputLabel}>Reason / Notes</Text>
                <TextInput
                  style={styles.textInput}
                  value={raiseReason}
                  onChangeText={setRaiseReason}
                  placeholder="e.g. Annual Performance Raise"
                />

                <View style={styles.innerModalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setRaiseModalVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleGrantRaise} disabled={savingRaise}>
                    {savingRaise ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Save Raise</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal visible={disburseModalVisible} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.innerModalOverlay}>
              <View style={styles.innerModalContent}>
                <Text style={styles.innerModalTitle}>Disburse 13th Mo. / Bonus</Text>
                <Text style={{ fontSize: 11.5, color: tokens.colors.secondary, marginTop: -8, marginBottom: 12 }}>
                  Staff: {user.name} • Available Reserve: <Text style={{ fontWeight: '800', color: tokens.colors.statusSuccess }}>{formatCurrency(reserveSummary?.available_balance)}</Text>
                </Text>

                <Text style={styles.inputLabel}>Payout Amount ($)</Text>
                <TextInput
                  style={styles.textInput}
                  value={disburseAmount}
                  keyboardType="decimal-pad"
                  onChangeText={setDisburseAmount}
                  placeholder="0.00"
                />

                <Text style={styles.inputLabel}>Notes / Reason</Text>
                <TextInput
                  style={styles.textInput}
                  value={disburseNotes}
                  onChangeText={setDisburseNotes}
                  placeholder="e.g. Khmer New Year 1st Half Bonus"
                />

                <View style={styles.innerModalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setDisburseModalVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleDisbursePayout} disabled={savingDisburse}>
                    {savingDisburse ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Confirm Payout</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '92%',
    minHeight: '80%',
    ...tokens.shadows.card,
  },
  topHeader: {
    backgroundColor: tokens.colors.surfaceCard,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    borderBottomWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colors.primaryContainer,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  roleSuperAdmin: {
    backgroundColor: '#FEF3C7',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: tokens.colors.primary,
    textTransform: 'uppercase',
  },
  staffEmail: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  tabBar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  tabItemActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderWidth: 1,
    borderColor: tokens.colors.primaryContainer,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  tabTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '800',
  },
  bodyScroll: {
    flex: 1,
  },
  profileActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  miniActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  sectionCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  detailLabel: {
    fontSize: 12.5,
    color: tokens.colors.secondary,
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  twoColGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.sm,
    padding: 10,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    color: tokens.colors.onSurface,
    marginTop: 2,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  periodChipActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryContainer,
  },
  periodChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  periodChipTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '800',
  },
  kpiCard: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  kpiCardLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  kpiCardValue: {
    fontSize: 17,
    fontWeight: '900',
    color: tokens.colors.onSurface,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 3,
  },
  dailyTrendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  periodPickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  periodArrowBtn: {
    padding: 6,
  },
  periodPickerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  incentiveSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.statusSuccess + '15',
    padding: 14,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.statusSuccess + '40',
    marginBottom: 10,
  },
  incentiveBannerLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: tokens.colors.statusSuccess,
    textTransform: 'uppercase',
  },
  incentiveBannerAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: tokens.colors.statusSuccess,
    marginTop: 2,
  },
  tierInfoCard: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.sm,
    padding: 10,
    marginBottom: 10,
  },
  tierInfoTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  tierInfoText: {
    fontSize: 11,
    color: tokens.colors.onSurface,
    marginTop: 2,
    fontWeight: '600',
  },
  dayGroupContainer: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingBottom: 4,
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  orderCountBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  dayOrdersList: {
    paddingLeft: 20,
    paddingTop: 4,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  currentSalaryCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  currentSalaryLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  currentSalaryAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
    marginTop: 2,
  },
  grantRaiseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  grantRaiseBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  metricsRowSub: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.sm,
    padding: 8,
    marginTop: 10,
  },
  subMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.secondary,
    textTransform: 'uppercase',
  },
  subMetricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.onSurface,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: tokens.colors.borderSubtle,
    marginHorizontal: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineIconBox: {
    alignItems: 'center',
    width: 24,
    marginRight: 10,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 10,
    borderRadius: tokens.borderRadius.sm,
  },
  timelineSalary: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  raiseBadge: {
    backgroundColor: tokens.colors.statusSuccess + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  raiseBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: tokens.colors.statusSuccess,
  },
  timelineReason: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onSurface,
    marginTop: 2,
  },
  timelineMeta: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    marginTop: 3,
  },
  reserveOverviewCard: {
    backgroundColor: tokens.colors.statusSuccess + '12',
    borderRadius: tokens.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.statusSuccess + '35',
  },
  reserveOverviewLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: tokens.colors.statusSuccess,
    textTransform: 'uppercase',
  },
  reserveOverviewAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: tokens.colors.statusSuccess,
    marginTop: 2,
  },
  disburseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.statusSuccess,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
  },
  disburseBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  reserveStatsRow: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.sm,
    padding: 8,
    marginTop: 10,
  },
  payoutHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  innerModalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'center',
    padding: 20,
  },
  innerModalContent: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.md,
    padding: 18,
    ...tokens.shadows.card,
  },
  innerModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onSurface,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    color: tokens.colors.onSurface,
    backgroundColor: tokens.colors.surface,
  },
  innerModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.pill,
  },
  cancelBtnText: {
    color: tokens.colors.secondary,
    fontWeight: '600',
    fontSize: 13,
  },
  confirmBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
})
