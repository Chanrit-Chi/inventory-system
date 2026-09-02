import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { StaffPerformance } from '../types'

export interface StaffPerformanceCardProps {
  performance: StaffPerformance | null
  period: 'today' | '7d' | 'month'
  onSelectPeriod: (period: 'today' | '7d' | 'month') => void
  onPressDetails: () => void
  greetingName?: string
  title?: string
  subtitle?: string
  badgeText?: string
  salesLabel?: string
  commissionLabel?: string
  iconName?: keyof typeof Ionicons.glyphMap
  containerStyle?: object
}

export const StaffPerformanceCard: React.FC<StaffPerformanceCardProps> = ({
  performance,
  period,
  onSelectPeriod,
  onPressDetails,
  greetingName,
  title,
  subtitle,
  badgeText = 'Full Details',
  salesLabel = 'SALES REVENUE',
  commissionLabel = 'COMMISSION',
  iconName = 'stats-chart',
  containerStyle,
}) => {
  const displayTitle =
    title || (greetingName ? `Hello, ${greetingName.split(' ')[0]} 👋` : 'My Performance & Earnings')

  const periodLabel =
    period === 'today' ? "Today's Shift" : period === '7d' ? 'Last 7 Days' : 'This Month'

  const displaySubtitle = subtitle || `${periodLabel} • Sales, Orders & Commission`

  const salesRevenue = performance
    ? (performance.summary?.total_revenue ?? performance.total_revenue ?? (performance as any)?.total_sales ?? 0)
    : 0

  const ordersCount = performance
    ? (performance.summary?.total_orders ?? performance.total_orders ?? 0)
    : 0

  const incentiveAmount = performance
    ? (performance.summary?.total_incentive ??
        performance.total_incentive ??
        (performance as any)?.total_commission ??
        (performance as any)?.incentive_amount ??
        0)
    : 0

  return (
    <TouchableOpacity
      style={[styles.card, containerStyle]}
      activeOpacity={0.88}
      onPress={onPressDetails}
      accessibilityRole="button"
      accessibilityLabel={`View ${badgeText}`}
    >
      {/* 1. Header Top Line: Icon + Title on left, Action Button on right */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconCircle}>
            <Ionicons name={iconName} size={15} color={tokens.colors.primaryContainer} />
          </View>
          <Text
            style={styles.greetingText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {displayTitle}
          </Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {badgeText}
          </Text>
          <Ionicons name="chevron-forward" size={11} color={tokens.colors.primaryContainer} />
        </View>
      </View>

      {/* 2. Full-Width Subtitle Row (Never cramped by badge, 100% visible) */}
      <View style={styles.subtitleRow}>
        <Ionicons name="time-outline" size={13} color={tokens.colors.secondary} />
        <Text style={styles.subtitleText} numberOfLines={1}>
          {displaySubtitle}
        </Text>
      </View>

      {/* 3. Period Filter Selector Pills */}
      <View style={styles.periodRow}>
        {(
          [
            { key: 'today', label: 'Today' },
            { key: '7d', label: '7 Days' },
            { key: 'month', label: 'This Month' },
          ] as const
        ).map((p) => {
          const isActive = period === p.key
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, isActive && styles.periodChipActive]}
              onPress={(e) => {
                e.stopPropagation?.()
                onSelectPeriod(p.key)
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 4. 3-Column Metrics (Sales, Orders, Commission) */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel} numberOfLines={1}>
            {salesLabel}
          </Text>
          <Text
            style={styles.metricValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            ${salesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <Text style={styles.metricLabel} numberOfLines={1}>
            ORDERS
          </Text>
          <Text
            style={styles.metricValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {ordersCount}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <Text style={styles.metricLabel} numberOfLines={1}>
            {commissionLabel}
          </Text>
          <Text
            style={[styles.metricValue, styles.commissionValue]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            +${incentiveAmount.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 10,
    ...tokens.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    letterSpacing: -0.2,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -2,
    marginBottom: 2,
  },
  subtitleText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: tokens.colors.secondary,
    flex: 1,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  periodChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  periodChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  periodChipTextActive: {
    color: '#FFFFFF',
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 15.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    textAlign: 'center',
  },
  commissionValue: {
    color: tokens.colors.statusSuccess,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: tokens.colors.borderSubtle,
    marginHorizontal: 2,
  },
})
