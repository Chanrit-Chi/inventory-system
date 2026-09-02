import React from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { MONTH_NAMES } from '../payrollUtils'

export interface PeriodFilterModalProps {
  visible: boolean
  onClose: () => void
  filterYear: number | 'ALL'
  setFilterYear: (y: number | 'ALL') => void
  filterMonth: number | 'ALL'
  setFilterMonth: (m: number | 'ALL') => void
  availableYears: number[]
  filterStatus?: string
  setFilterStatus?: (s: string) => void
  showStatusFilter?: boolean
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Finalized', value: 'FINALIZED' },
  { label: 'Paid', value: 'PAID' },
]

export const PeriodFilterModal: React.FC<PeriodFilterModalProps> = ({
  visible,
  onClose,
  filterYear,
  setFilterYear,
  filterMonth,
  setFilterMonth,
  availableYears,
  filterStatus,
  setFilterStatus,
  showStatusFilter = false,
}) => {
  const currentMonthName = filterMonth === 'ALL' ? 'Full Year' : MONTH_NAMES[filterMonth - 1] || `Month ${filterMonth}`
  const currentYearStr = filterYear === 'ALL' ? 'All Years' : String(filterYear)

  const handleReset = () => {
    setFilterYear(new Date().getFullYear())
    setFilterMonth(new Date().getMonth() + 1)
    if (setFilterStatus) setFilterStatus('ALL')
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Ionicons name="calendar" size={17} color={tokens.colors.primaryContainer} />
                <Text style={styles.title}>Filter Period</Text>
              </View>
              <Text style={styles.subtitle}>
                Currently: <Text style={styles.subtitleBold}>{currentMonthName} {currentYearStr}</Text>
                {showStatusFilter && filterStatus && filterStatus !== 'ALL' && (
                  <Text style={styles.subtitleBold}> • {filterStatus}</Text>
                )}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* ── STATUS FILTER (if applicable) ───────────────────────── */}
            {Boolean(showStatusFilter && setFilterStatus) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PAYROLL STATUS</Text>
                <View style={styles.pillsGrid}>
                  {STATUS_OPTIONS.map((st) => {
                    const isActive = filterStatus === st.value
                    return (
                      <TouchableOpacity
                        key={st.value}
                        style={[styles.pill, isActive && styles.pillActive]}
                        onPress={() => setFilterStatus?.(st.value)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* ── YEAR SELECTION ─────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT YEAR</Text>
              <View style={styles.pillsGrid}>
                {availableYears.map((yr) => {
                  const isActive = filterYear === yr
                  return (
                    <TouchableOpacity
                      key={yr}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setFilterYear(yr)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
                <TouchableOpacity
                  style={[styles.pill, filterYear === 'ALL' && styles.pillActive]}
                  onPress={() => setFilterYear('ALL')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pillText, filterYear === 'ALL' && styles.pillTextActive]}>
                    All Years
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── MONTH SELECTION ────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT MONTH</Text>
              {/* Full Year Option */}
              <TouchableOpacity
                style={[styles.fullYearBtn, filterMonth === 'ALL' && styles.pillActive]}
                onPress={() => setFilterMonth('ALL')}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={filterMonth === 'ALL' ? '#FFFFFF' : tokens.colors.secondary}
                />
                <Text style={[styles.pillText, filterMonth === 'ALL' && styles.pillTextActive]}>
                  Full Year (Jan - Dec)
                </Text>
              </TouchableOpacity>

              {/* 12-Month Grid */}
              <View style={styles.monthsGrid}>
                {SHORT_MONTHS.map((mName, idx) => {
                  const mNum = idx + 1
                  const isActive = filterMonth === mNum
                  return (
                    <TouchableOpacity
                      key={mName}
                      style={[styles.monthCell, isActive && styles.monthCellActive]}
                      onPress={() => setFilterMonth(mNum)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.monthCellText, isActive && styles.monthCellTextActive]}>
                        {mName}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.resetBtnText}>Reset Defaults</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.lg,
    ...tokens.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  subtitle: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    marginTop: 3,
  },
  subtitleBold: {
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    maxHeight: 380,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  pillActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  pillTextActive: {
    color: tokens.colors.onPrimary,
  },
  fullYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: 10,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthCell: {
    width: '23%',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  monthCellActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  monthCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  monthCellTextActive: {
    color: tokens.colors.onPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    marginTop: 8,
    gap: 10,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.card,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onPrimary,
  },
})
