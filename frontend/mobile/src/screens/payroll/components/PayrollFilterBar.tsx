import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { formatCurrency, MONTH_NAMES } from '../payrollUtils'
import type { Payroll } from '../../../types'
import { PeriodFilterModal } from './PeriodFilterModal'

export interface PayrollFilterBarProps {
  search: string
  setSearch: (s: string) => void
  filterStatus: string
  setFilterStatus: (s: string) => void
  filterMonth: number | 'ALL'
  setFilterMonth: (m: number | 'ALL') => void
  filterYear: number | 'ALL'
  setFilterYear: (y: number | 'ALL') => void
  availableYears: number[]
  onOpenGenerate: () => void
  onOpenSalary: () => void
  selectionMode: boolean
  onToggleSelectionMode: () => void
  canManage: boolean
  payrolls?: Payroll[]
}

export const PayrollFilterBar: React.FC<PayrollFilterBarProps> = ({
  search,
  setSearch,
  filterStatus,
  setFilterStatus,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  availableYears,
  onOpenGenerate,
  onOpenSalary,
  selectionMode,
  onToggleSelectionMode,
  canManage,
  payrolls = [],
}) => {
  const [modalVisible, setModalVisible] = useState(false)

  const monthLabel = filterMonth === 'ALL' ? 'Full Year' : MONTH_NAMES[filterMonth - 1] || `Month ${filterMonth}`
  const yearLabel = filterYear === 'ALL' ? 'All Years' : String(filterYear)
  const isFiltered = filterMonth !== 'ALL' || filterYear !== new Date().getFullYear() || filterStatus !== 'ALL'

  // Monthly KPI calculations
  const totalNet = payrolls.reduce((sum, p) => sum + (Number(p.total_net_pay) || 0), 0)
  const totalBase = payrolls.reduce((sum, p) => sum + (Number(p.base_salary) || 0), 0)
  const totalAdditions = payrolls.reduce(
    (sum, p) =>
      sum +
      (Number(p.overtime_amount) || 0) +
      (Number(p.performance_benefit) || 0) +
      (Number(p.delivery_benefit) || 0) +
      (Number(p.collective_benefit) || 0) +
      (Number(p.other_benefits) || 0) +
      (Number(p.incentive_override ?? p.incentive_amount) || 0),
    0
  )
  const total13th = payrolls.reduce(
    (sum, p) =>
      sum +
      (Number(p.thirteenth_month_contribution) ||
        (Number(p.base_salary) || 0) / 12),
    0
  )
  const staffCount = payrolls.length

  return (
    <View style={filterStyles.container}>
      {/* ── MONTHLY SUMMARY KPI CARD (Scrolls naturally with list) ─────────── */}
      <View style={filterStyles.kpiCard}>
        <View style={filterStyles.kpiHeaderRow}>
          <View style={filterStyles.kpiHeaderTitleRow}>
            <Ionicons name="briefcase" size={15} color={tokens.colors.primaryContainer} />
            <Text style={filterStyles.kpiHeaderTitle}>TOTAL MONTHLY NET PAYROLL</Text>
          </View>
          <View style={filterStyles.kpiPeriodBadge}>
            <Text style={filterStyles.kpiPeriodBadgeText}>
              {monthLabel} {yearLabel}
            </Text>
          </View>
        </View>

        {/* Hero Net Amount */}
        <View style={filterStyles.kpiHeroSection}>
          <Text style={filterStyles.kpiHeroLabel}>DISBURSED / NET PAYROLL</Text>
          <Text
            style={filterStyles.kpiHeroValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatCurrency(totalNet)}
          </Text>
        </View>

        {/* 3-Column Metrics Breakdown */}
        <View style={filterStyles.kpiMetricsRow}>
          <View style={filterStyles.kpiMetricCol}>
            <Text style={filterStyles.kpiMetricSubLabel}>Gross Base</Text>
            <Text style={[filterStyles.kpiMetricSubValue, { color: tokens.colors.onSurface }]}>
              {formatCurrency(totalBase)}
            </Text>
          </View>
          <View style={filterStyles.kpiMetricColDivider} />
          <View style={filterStyles.kpiMetricCol}>
            <Text style={filterStyles.kpiMetricSubLabel}>Incentives & OT</Text>
            <Text style={[filterStyles.kpiMetricSubValue, { color: tokens.colors.statusSuccess }]}>
              +{formatCurrency(totalAdditions)}
            </Text>
          </View>
          <View style={filterStyles.kpiMetricColDivider} />
          <View style={filterStyles.kpiMetricCol}>
            <Text style={filterStyles.kpiMetricSubLabel}>13th Accrual</Text>
            <Text style={[filterStyles.kpiMetricSubValue, { color: tokens.colors.primaryContainer }]}>
              +{formatCurrency(total13th)}
            </Text>
          </View>
          <View style={filterStyles.kpiMetricColDivider} />
          <View style={filterStyles.kpiMetricCol}>
            <Text style={filterStyles.kpiMetricSubLabel}>Staff</Text>
            <Text style={[filterStyles.kpiMetricSubValue, { color: '#7C3AED' }]}>
              {staffCount}
            </Text>
          </View>
        </View>
      </View>

      {/* ── ROW 1: QUICK ACTIONS ───────────────────────────────────────────── */}
      <View style={filterStyles.actionsRow}>
        {Boolean(canManage) && (
          <TouchableOpacity
            style={filterStyles.generateBtn}
            onPress={onOpenGenerate}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={filterStyles.generateBtnText}>Generate</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={filterStyles.actionOutlineBtn}
          onPress={onOpenSalary}
          activeOpacity={0.75}
        >
          <Ionicons name="wallet-outline" size={15} color={tokens.colors.primaryContainer} />
          <Text style={filterStyles.actionOutlineBtnText}>Salaries & Reserves</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[filterStyles.actionOutlineBtn, selectionMode && filterStyles.actionOutlineBtnActive]}
          onPress={onToggleSelectionMode}
          activeOpacity={0.75}
        >
          <Ionicons
            name={selectionMode ? 'close-circle' : 'checkbox-outline'}
            size={15}
            color={selectionMode ? tokens.colors.onPrimary : tokens.colors.primaryContainer}
          />
          <Text style={[filterStyles.actionOutlineBtnText, selectionMode && filterStyles.actionOutlineBtnTextActive]}>
            {selectionMode ? 'Cancel' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── ROW 2: SEARCH & CLICK-TO-FILTER PERIOD BUTTON ───────────────────── */}
      <View style={filterStyles.searchRow}>
        {/* Search Input */}
        <View style={filterStyles.searchBox}>
          <Ionicons name="search-outline" size={15} color={tokens.colors.secondary} />
          <TextInput
            style={filterStyles.searchInput}
            placeholder="Search employee name or role..."
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
          style={[filterStyles.filterBtn, isFiltered && filterStyles.filterBtnActive]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.75}
          accessibilityLabel="Filter by Period and Status"
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={isFiltered ? tokens.colors.primaryContainer : tokens.colors.secondary}
          />
          <Text
            style={[filterStyles.filterBtnText, isFiltered && filterStyles.filterBtnTextActive]}
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

      {/* Period Filter Modal */}
      <PeriodFilterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        filterYear={filterYear}
        setFilterYear={setFilterYear}
        filterMonth={filterMonth}
        setFilterMonth={setFilterMonth}
        availableYears={availableYears}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        showStatusFilter={true}
      />
    </View>
  )
}

const filterStyles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.sm,
    backgroundColor: tokens.colors.background,
    gap: 8,
  },
  /* Summary KPI Card */
  kpiCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 4,
    ...tokens.shadows.card,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kpiHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
    letterSpacing: 0.5,
  },
  kpiPeriodBadge: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: tokens.colors.primaryFixedDim,
  },
  kpiPeriodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  kpiHeroSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiHeroLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  kpiHeroValue: {
    fontSize: 22,
    fontWeight: '900',
    color: tokens.colors.primaryContainer,
  },
  kpiMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiMetricCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  kpiMetricColDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
  },
  kpiMetricSubLabel: {
    fontSize: 8.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
    marginBottom: 1,
  },
  kpiMetricSubValue: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    ...tokens.shadows.card,
  },
  generateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
  },
  actionOutlineBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  actionOutlineBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  actionOutlineBtnTextActive: {
    color: tokens.colors.onPrimary,
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
})
