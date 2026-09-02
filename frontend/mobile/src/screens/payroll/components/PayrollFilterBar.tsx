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
import { MONTH_NAMES } from '../payrollUtils'
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
}) => {
  const [modalVisible, setModalVisible] = useState(false)

  const monthLabel = filterMonth === 'ALL' ? 'Full Year' : MONTH_NAMES[filterMonth - 1] || `Month ${filterMonth}`
  const yearLabel = filterYear === 'ALL' ? 'All Years' : String(filterYear)
  const isFiltered = filterMonth !== (new Date().getMonth() + 1) || filterYear !== new Date().getFullYear() || filterStatus !== 'ALL'

  return (
    <View style={filterStyles.container}>
      {/* ── ROW 1: ACTIONS ─────────────────────────────────────────────────── */}
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
