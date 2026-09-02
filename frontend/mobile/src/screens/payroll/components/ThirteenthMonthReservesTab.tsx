import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { formatCurrency, MONTH_NAMES } from '../payrollUtils'
import type { CompanyThirteenthMonthReservesData, StaffThirteenthMonthReserve } from '../../../types'
import { PeriodFilterModal } from './PeriodFilterModal'

export interface ThirteenthMonthReservesTabProps {
  data: CompanyThirteenthMonthReservesData | null
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  filterYear: number | 'ALL'
  setFilterYear: (y: number | 'ALL') => void
  filterMonth: number | 'ALL'
  setFilterMonth: (m: number | 'ALL') => void
  availableYears: number[]
  onOpenPayout: (staff: StaffThirteenthMonthReserve) => void
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const ThirteenthMonthReservesTab: React.FC<ThirteenthMonthReservesTabProps> = ({
  data,
  loading,
  refreshing,
  onRefresh,
  filterYear,
  setFilterYear,
  filterMonth,
  setFilterMonth,
  availableYears,
  onOpenPayout,
}) => {
  const [search, setSearch] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set())
  const [expandedMonthBreakdownIds, setExpandedMonthBreakdownIds] = useState<Set<string>>(new Set())

  const monthLabel = filterMonth === 'ALL' ? 'Full Year' : MONTH_NAMES[filterMonth - 1] || `Month ${filterMonth}`
  const yearLabel = filterYear === 'ALL' ? 'All Years' : String(filterYear)
  const isFiltered = filterMonth !== 'ALL' || filterYear !== new Date().getFullYear()

  const toggleHistory = (userId: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleMonthBreakdown = (userId: string) => {
    setExpandedMonthBreakdownIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const staffList = data?.staff || []

  const filteredStaff = staffList.filter((s) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q)
    )
  })

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tokens.colors.primaryContainer]} />}
    >
      {/* ── TOOLBAR: SEARCH & CLICK-TO-SELECT PERIOD FILTER BUTTON ───────────── */}
      <View style={styles.toolbarContainer}>
        <View style={styles.searchRow}>
          {/* Search Input */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={15} color={tokens.colors.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search staff name or department..."
              placeholderTextColor={tokens.colors.secondary}
              value={search}
              onChangeText={setSearch}
            />
            {Boolean(search.trim()) && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Click-to-Filter Period Trigger Button */}
          <TouchableOpacity
            style={[styles.filterBtn, isFiltered && styles.filterBtnActive]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.75}
            accessibilityLabel="Filter by Period"
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={isFiltered ? tokens.colors.primaryContainer : tokens.colors.secondary}
            />
            <Text
              style={[styles.filterBtnText, isFiltered && styles.filterBtnTextActive]}
              numberOfLines={1}
            >
              {monthLabel} {yearLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={isFiltered ? tokens.colors.primaryContainer : tokens.colors.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Period Filter Modal */}
      <PeriodFilterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        filterYear={filterYear}
        setFilterYear={setFilterYear}
        filterMonth={filterMonth}
        setFilterMonth={setFilterMonth}
        availableYears={availableYears}
        showStatusFilter={false}
      />

      {/* ── STAFF 13TH-MONTH CARDS FEED ──────────────────────────────────────── */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
          <Text style={styles.loadingText}>Loading 13th month reserves...</Text>
        </View>
      ) : filteredStaff.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="gift-outline" size={48} color={tokens.colors.borderSubtle} />
          <Text style={styles.emptyTitle}>No Staff Reserves Found</Text>
          <Text style={styles.emptySub}>
            {search ? `No staff matching "${search}"` : 'No active operational personnel found.'}
          </Text>
        </View>
      ) : (
        <View style={styles.cardsList}>
          {filteredStaff.map((staff) => {
            const isHistoryOpen = expandedHistoryIds.has(staff.user_id)
            const isBreakdownOpen = expandedMonthBreakdownIds.has(staff.user_id)
            const progressPct = Math.min(100, Math.round((staff.months_accrued / 12) * 100))
            const isEligibleForPayout = staff.available_balance > 0
            const accruedSet = new Set(staff.accrued_months || [])

            return (
              <View key={staff.user_id} style={styles.staffCard}>
                {/* Staff Card Header */}
                <View style={styles.staffCardHeader}>
                  <View style={styles.staffAvatar}>
                    <Text style={styles.staffAvatarText}>
                      {(staff.name || 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 10, marginRight: 6 }}>
                    <Text style={styles.staffName} numberOfLines={1}>
                      {staff.name}
                    </Text>
                    <View style={styles.staffMetaRow}>
                      <View style={styles.deptBadge}>
                        <Ionicons name="business-outline" size={9.5} color={tokens.colors.secondary} />
                        <Text style={styles.deptBadgeText} numberOfLines={1}>{staff.department || 'General'}</Text>
                      </View>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText} numberOfLines={1}>{staff.role}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Available Balance Badge */}
                  <View style={styles.balanceBadge}>
                    <Text style={styles.balanceBadgeLabel}>AVAILABLE</Text>
                    <Text
                      style={styles.balanceBadgeValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {formatCurrency(staff.available_balance)}
                    </Text>
                  </View>
                </View>

                {/* Salary & Accrual Rate info */}
                <View style={styles.accrualRateRow}>
                  <Text style={styles.accrualRateText}>
                    Base: <Text style={{ fontWeight: '700', color: tokens.colors.onSurface }}>{formatCurrency(staff.base_salary)}</Text>
                    {' • '}
                    Rate: <Text style={{ fontWeight: '700', color: tokens.colors.statusSuccess }}>+{formatCurrency(staff.monthly_accrual)}/mo</Text>
                  </Text>
                  <Text style={styles.accrualMonthsText}>
                    {staff.months_accrued}/12 mos ({progressPct}%)
                  </Text>
                </View>

                {/* Visual Accrual Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.max(4, progressPct)}%`,
                        backgroundColor: progressPct >= 100 ? tokens.colors.statusSuccess : tokens.colors.primaryContainer,
                      },
                    ]}
                  />
                </View>

                {/* 12-Month Accumulation Matrix (Shows Jan to Dec Status) */}
                <View style={styles.monthMatrixContainer}>
                  <Text style={styles.monthMatrixLabel}>12-MONTH SCHEDULE:</Text>
                  <View style={styles.monthMatrixGrid}>
                    {SHORT_MONTHS.map((mName, idx) => {
                      const mNum = idx + 1
                      const isAccrued = accruedSet.has(mNum)
                      return (
                        <View
                          key={mName}
                          style={[
                            styles.matrixChip,
                            isAccrued ? styles.matrixChipAccrued : styles.matrixChipPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.matrixChipText,
                              isAccrued ? styles.matrixChipTextAccrued : styles.matrixChipTextPending,
                            ]}
                          >
                            {isAccrued ? `✓${mName}` : mName}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>

                {/* Metrics Breakdown Grid */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel} numberOfLines={1}>Total Accrued</Text>
                    <Text
                      style={[styles.metricVal, { color: tokens.colors.statusSuccess }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      +{formatCurrency(staff.total_accrued)}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel} numberOfLines={1}>Disbursed</Text>
                    <Text
                      style={[styles.metricVal, { color: '#D97706' }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      -{formatCurrency(staff.total_disbursed)}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel} numberOfLines={1}>Net Reserve</Text>
                    <Text
                      style={[styles.metricVal, { color: tokens.colors.primaryContainer, fontWeight: '800' }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {formatCurrency(staff.available_balance)}
                    </Text>
                  </View>
                </View>

                {/* Actions Toolbar */}
                <View style={styles.cardActionsRow}>
                  {/* Disburse Payout CTA Button */}
                  <TouchableOpacity
                    style={[
                      styles.disburseBtn,
                      !isEligibleForPayout && styles.disburseBtnDisabled,
                    ]}
                    onPress={() => onOpenPayout(staff)}
                    disabled={!isEligibleForPayout}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={13}
                      color={isEligibleForPayout ? '#FFFFFF' : tokens.colors.textDisabled}
                    />
                    <Text
                      style={[
                        styles.disburseBtnText,
                        !isEligibleForPayout && styles.disburseBtnTextDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      Disburse Payout
                    </Text>
                  </TouchableOpacity>

                  {/* Monthly Breakdown Accordion Toggle */}
                  <TouchableOpacity
                    style={styles.subActionToggleBtn}
                    onPress={() => toggleMonthBreakdown(staff.user_id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color={tokens.colors.primaryContainer}
                    />
                    <Text style={styles.subActionToggleText}>
                      Months ({staff.accrued_months?.length || 0})
                    </Text>
                    <Ionicons
                      name={isBreakdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={tokens.colors.secondary}
                    />
                  </TouchableOpacity>

                  {/* History Accordion Toggle */}
                  <TouchableOpacity
                    style={styles.subActionToggleBtn}
                    onPress={() => toggleHistory(staff.user_id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={tokens.colors.secondary}
                    />
                    <Text style={styles.subActionToggleText}>
                      History ({staff.payouts?.length || 0})
                    </Text>
                    <Ionicons
                      name={isHistoryOpen ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={tokens.colors.secondary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Collapsible Monthly Breakdown Ledger */}
                {Boolean(isBreakdownOpen) && (
                  <View style={styles.collapsibleContainer}>
                    <View style={styles.collapsibleHeader}>
                      <Text style={styles.collapsibleHeaderText}>MONTH-BY-MONTH ACCRUAL LEDGER</Text>
                    </View>
                    {staff.monthly_breakdown && staff.monthly_breakdown.length > 0 ? (
                      staff.monthly_breakdown.map((item) => (
                        <View key={item.payroll_id || `${item.year}-${item.month}`} style={styles.ledgerRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ledgerTitle}>
                              {MONTH_NAMES[item.month - 1]} {item.year}
                            </Text>
                            <Text style={styles.ledgerSub}>
                              Status: {item.status}
                            </Text>
                          </View>
                          <Text style={styles.ledgerAmountPositive}>
                            +{formatCurrency(item.amount)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noDataText}>No monthly payrolls accrued for this period yet.</Text>
                    )}
                  </View>
                )}

                {/* Collapsible Payout History Ledger */}
                {Boolean(isHistoryOpen) && (
                  <View style={styles.collapsibleContainer}>
                    <View style={styles.collapsibleHeader}>
                      <Text style={styles.collapsibleHeaderText}>PAST DISBURSEMENTS</Text>
                    </View>
                    {staff.payouts && staff.payouts.length > 0 ? (
                      staff.payouts.map((payout) => (
                        <View key={payout.id} style={styles.ledgerRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ledgerTitle}>
                              {payout.payout_date ? new Date(payout.payout_date).toLocaleDateString() : 'N/A'} • {payout.payment_method || 'Cash'}
                            </Text>
                            <Text style={styles.ledgerSub} numberOfLines={1}>
                              {payout.notes || '13th Month / Seniority Payout'}
                            </Text>
                          </View>
                          <Text style={styles.ledgerAmountNegative}>
                            -{formatCurrency(payout.amount)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noDataText}>No past payouts recorded yet.</Text>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  contentContainer: {
    padding: tokens.spacing.md,
    paddingBottom: 40,
  },
  /* Toolbar */
  toolbarContainer: {
    marginBottom: tokens.spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.onSurface,
    padding: 0,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 160,
  },
  filterBtnActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryFixedDim,
  },
  filterBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  filterBtnTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '800',
  },
  /* Staff Cards Feed */
  cardsList: {
    gap: 12,
  },
  staffCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 13,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  staffCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  staffAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  staffName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  deptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: 95,
  },
  deptBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  roleBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#5B21B6',
  },
  balanceBadge: {
    alignItems: 'flex-end',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    maxWidth: 100,
  },
  balanceBadgeLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    letterSpacing: 0.5,
  },
  balanceBadgeValue: {
    fontSize: 13,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
  },
  accrualRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  accrualRateText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
  },
  accrualMonthsText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  monthMatrixContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthMatrixLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  monthMatrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  matrixChip: {
    paddingHorizontal: 4.5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  matrixChipAccrued: {
    backgroundColor: '#DCFCE7',
    borderWidth: 0.5,
    borderColor: '#86EFAC',
  },
  matrixChipPending: {
    backgroundColor: '#F1F5F9',
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  matrixChipText: {
    fontSize: 8.5,
    fontWeight: '700',
  },
  matrixChipTextAccrued: {
    color: '#15803D',
  },
  matrixChipTextPending: {
    color: '#94A3B8',
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: tokens.colors.secondary,
    marginBottom: 1,
  },
  metricVal: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  disburseBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
  },
  disburseBtnDisabled: {
    backgroundColor: tokens.colors.surfaceMuted,
  },
  disburseBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disburseBtnTextDisabled: {
    color: tokens.colors.textDisabled,
  },
  subActionToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  subActionToggleText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  collapsibleContainer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  collapsibleHeader: {
    marginBottom: 4,
  },
  collapsibleHeaderText: {
    fontSize: 9,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  ledgerTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: tokens.colors.onSurface,
  },
  ledgerSub: {
    fontSize: 9.5,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  ledgerAmountPositive: {
    fontSize: 11.5,
    fontWeight: '800',
    color: tokens.colors.statusSuccess,
  },
  ledgerAmountNegative: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#D97706',
  },
  noDataText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    fontStyle: 'italic',
    paddingVertical: 3,
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 5,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onSurface,
  },
  emptySub: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
})
