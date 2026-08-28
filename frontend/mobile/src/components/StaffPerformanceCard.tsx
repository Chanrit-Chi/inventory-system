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
  badgeText = 'My Earnings',
  iconName = 'person',
  containerStyle,
}) => {
  const displayTitle =
    title || (greetingName ? `Hello, ${greetingName.split(' ')[0]} \u{1F44B}` : 'My Performance & Earnings')

  const periodLabel =
    period === 'today' ? "Today's Shift" : period === '7d' ? 'Last 7 Days' : 'This Month'

  const displaySubtitle = subtitle || `${periodLabel} \u2022 Sales, Orders & Commission`

  const salesRevenue = performance
    ? (performance.summary?.total_revenue ?? performance.total_revenue ?? 0)
    : 0

  const ordersCount = performance
    ? (performance.summary?.total_orders ?? performance.total_orders ?? 0)
    : 0

  const incentiveAmount = performance
    ? (performance.summary?.total_incentive ?? performance.total_incentive ?? 0)
    : 0

  return (
    <TouchableOpacity
      style={[styles.card, containerStyle]}
      activeOpacity={0.88}
      onPress={onPressDetails}
      accessibilityRole="button"
      accessibilityLabel={`View ${badgeText}`}
    >
      {/* Top Row: User Greeting / Card Title & My Earnings Badge */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconCircle}>
            <Ionicons name={iconName} size={15} color={tokens.colors.primaryContainer} />
          </View>
          <View style={styles.titleTextContainer}>
            <Text style={styles.greetingText} numberOfLines={1}>
              {displayTitle}
            </Text>
            <Text style={styles.subtitleText} numberOfLines={1}>
              {displaySubtitle}
            </Text>
          </View>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {badgeText}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={tokens.colors.primaryContainer} />
        </View>
      </View>

      {/* Middle Row: Period Filter Pills */}
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

      {/* Bottom Row: 3-Column Metrics (Sales, Orders, Commission) */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel} numberOfLines={1}>
            MY SALES
          </Text>
          <Text
            style={styles.metricValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
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
            minimumFontScale={0.8}
          >
            {ordersCount}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <Text style={styles.metricLabel} numberOfLines={1}>
            COMMISSION
          </Text>
          <Text
            style={[styles.metricValue, styles.commissionValue]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
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
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  periodChip: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
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
    fontSize: 10.5,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  metricValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    textAlign: 'center',
  },
  commissionValue: {
    color: tokens.colors.statusSuccess,
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: tokens.colors.borderSubtle,
    marginHorizontal: 2,
  },
})
