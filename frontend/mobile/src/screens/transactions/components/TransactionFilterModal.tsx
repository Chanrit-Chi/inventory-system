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
import type {
  FilterStatus,
  DateRangeMode,
  TransactionSortOption,
  PaymentMethodFilter,
} from '../transactionUtils'
import { getChannelPlatformMeta } from '../transactionUtils'

export interface ChannelOption {
  key: string
  label: string
}

export interface TransactionFilterModalProps {
  visible: boolean
  onClose: () => void
  sortBy: TransactionSortOption
  setSortBy: (v: TransactionSortOption) => void
  statusFilter: FilterStatus
  setStatusFilter: (v: FilterStatus) => void
  dateRange: DateRangeMode
  setDateRange: (v: DateRangeMode) => void
  dateLabel: string
  onOpenCustomDateModal: () => void
  channelFilter: string
  setChannelFilter: (v: string) => void
  availableChannels: ChannelOption[]
  paymentMethodFilter: PaymentMethodFilter
  setPaymentMethodFilter: (v: PaymentMethodFilter) => void
  counts: { all: number; completed: number; pending: number; cancelled: number }
  onResetAll: () => void
  activeFiltersCount: number
}

const SORT_OPTIONS: Array<{
  key: TransactionSortOption
  label: string
  icon: keyof typeof Ionicons.glyphMap
}> = [
  { key: 'DEFAULT', label: 'Newest First', icon: 'time-outline' },
  { key: 'OLDEST', label: 'Oldest First', icon: 'hourglass-outline' },
  { key: 'AMOUNT_DESC', label: 'Amount (High → Low)', icon: 'trending-up-outline' },
  { key: 'AMOUNT_ASC', label: 'Amount (Low → High)', icon: 'trending-down-outline' },
  { key: 'ORDER_NUM_ASC', label: 'Order # (A → Z)', icon: 'text-outline' },
]

const STATUS_OPTIONS: Array<{ key: FilterStatus; label: string }> = [
  { key: 'ALL', label: 'All Statuses' },
  { key: 'COMPLETED', label: 'Paid' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

const DATE_OPTIONS: Array<{
  key: DateRangeMode
  label: string
  icon: keyof typeof Ionicons.glyphMap
}> = [
  { key: 'all', label: 'All Time', icon: 'infinite-outline' },
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: '7d', label: '7 Days', icon: 'calendar-outline' },
  { key: '30d', label: '30 Days', icon: 'calendar-outline' },
  { key: 'year', label: 'This Year', icon: 'calendar-number-outline' },
  { key: 'custom', label: 'Custom Range...', icon: 'calendar-clear-outline' },
]

const PAYMENT_OPTIONS: Array<{
  key: PaymentMethodFilter
  label: string
  icon: keyof typeof Ionicons.glyphMap
}> = [
  { key: 'ALL', label: 'All Methods', icon: 'wallet-outline' },
  { key: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { key: 'ABA', label: 'ABA QR / KHQR', icon: 'qr-code-outline' },
  { key: 'CARD', label: 'Card', icon: 'card-outline' },
  { key: 'BANK', label: 'Bank Transfer', icon: 'business-outline' },
]

export const TransactionFilterModal: React.FC<TransactionFilterModalProps> = ({
  visible,
  onClose,
  sortBy,
  setSortBy,
  statusFilter,
  setStatusFilter,
  dateRange,
  setDateRange,
  dateLabel,
  onOpenCustomDateModal,
  channelFilter,
  setChannelFilter,
  availableChannels,
  paymentMethodFilter,
  setPaymentMethodFilter,
  counts,
  onResetAll,
  activeFiltersCount,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Ionicons name="options" size={18} color={tokens.colors.primaryContainer} />
                <Text style={styles.title}>Filter & Sort</Text>
                {Boolean(activeFiltersCount > 0) && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{activeFiltersCount} active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle}>
                Sort orders, filter by status, date range, channel & payment
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* ── 1. SORT BY ────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SORT ORDER</Text>
              <View style={styles.pillsGrid}>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortBy === opt.key
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setSortBy(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={13}
                        color={isActive ? '#FFFFFF' : tokens.colors.secondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* ── 2. ORDER STATUS ───────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ORDER STATUS</Text>
              <View style={styles.pillsGrid}>
                {STATUS_OPTIONS.map((st) => {
                  const isActive = statusFilter === st.key
                  const count =
                    st.key === 'ALL'
                      ? counts.all
                      : st.key === 'COMPLETED'
                      ? counts.completed
                      : st.key === 'PENDING'
                      ? counts.pending
                      : counts.cancelled

                  return (
                    <TouchableOpacity
                      key={st.key}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setStatusFilter(st.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {st.label}
                      </Text>
                      <View
                        style={[
                          styles.countBadge,
                          isActive && styles.countBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.countBadgeText,
                            isActive && styles.countBadgeTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* ── 3. DATE RANGE ─────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DATE RANGE</Text>
              <View style={styles.pillsGrid}>
                {DATE_OPTIONS.map((dt) => {
                  const isCustomMode = dt.key === 'custom'
                  const isActive =
                    isCustomMode
                      ? dateRange === 'single' || dateRange === 'custom'
                      : dateRange === dt.key

                  const label =
                    isCustomMode && (dateRange === 'single' || dateRange === 'custom')
                      ? dateLabel
                      : dt.label

                  return (
                    <TouchableOpacity
                      key={dt.key}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => {
                        if (isCustomMode) {
                          onOpenCustomDateModal()
                        } else {
                          setDateRange(dt.key)
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={dt.icon}
                        size={13}
                        color={isActive ? '#FFFFFF' : tokens.colors.secondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* ── 4. SALES CHANNEL ──────────────────────────────────── */}
            {availableChannels.length > 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SALES CHANNEL</Text>
                <View style={styles.pillsGrid}>
                  {availableChannels.map((chan) => {
                    const isActive = channelFilter === chan.key
                    const meta = chan.key !== 'ALL' ? getChannelPlatformMeta(null, chan.key) : null
                    const iconName = meta?.icon || (chan.key === 'ALL' ? 'apps-outline' : 'storefront-outline')

                    return (
                      <TouchableOpacity
                        key={chan.key}
                        style={[styles.pill, isActive && styles.pillActive]}
                        onPress={() => setChannelFilter(chan.key)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={iconName as any}
                          size={13}
                          color={isActive ? '#FFFFFF' : meta?.color || tokens.colors.secondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                          {chan.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* ── 5. PAYMENT METHOD ─────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
              <View style={styles.pillsGrid}>
                {PAYMENT_OPTIONS.map((pm) => {
                  const isActive = paymentMethodFilter === pm.key
                  return (
                    <TouchableOpacity
                      key={pm.key}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setPaymentMethodFilter(pm.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={pm.icon}
                        size={13}
                        color={isActive ? '#FFFFFF' : tokens.colors.secondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {pm.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </ScrollView>

          {/* ── Modal Footer with Actions ────────────────────────────── */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={onResetAll} activeOpacity={0.75}>
              <Ionicons name="refresh-outline" size={14} color={tokens.colors.secondary} />
              <Text style={styles.resetBtnText}>Reset All</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.applyBtnText}>
                Apply Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
              </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    ...tokens.shadows.modal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  activeBadge: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  subtitle: {
    fontSize: 11.5,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  pillActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
    marginLeft: 5,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  countBadgeTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
    gap: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
})
