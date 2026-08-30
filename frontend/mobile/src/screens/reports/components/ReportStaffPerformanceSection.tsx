import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ReportsScreen.styles'
import type { StaffPerformanceSummary } from '../../../types'

export interface ReportStaffPerformanceSectionProps {
  staffPeriod: 'today' | 'week' | 'month'
  setStaffPeriod: (period: 'today' | 'week' | 'month') => void
  staffLoading: boolean
  staffData: StaffPerformanceSummary | null
}

export const ReportStaffPerformanceSection: React.FC<ReportStaffPerformanceSectionProps> = ({
  staffPeriod,
  setStaffPeriod,
  staffLoading,
  staffData,
}) => {
  return (
    <View style={styles.staffSection}>
      <View style={styles.staffHeaderRow}>
        <View>
          <Text style={styles.staffSectionTitle}>Staff Leaderboard</Text>
          <Text style={styles.staffSectionSub}>Team member sales performance</Text>
        </View>
        <View style={styles.staffPeriodRow}>
          {(['today', 'week', 'month'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.staffPeriodBtn,
                staffPeriod === p && styles.staffPeriodBtnActive,
              ]}
              onPress={() => setStaffPeriod(p)}
            >
              <Text
                style={[
                  styles.staffPeriodText,
                  staffPeriod === p && styles.staffPeriodTextActive,
                ]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {staffLoading ? (
        <ActivityIndicator
          size="small"
          color={tokens.colors.primaryContainer}
          style={{ marginTop: 16 }}
        />
      ) : !staffData?.leaderboard?.length ? (
        <View style={styles.staffEmpty}>
          <Ionicons
            name="people-outline"
            size={28}
            color={tokens.colors.secondaryFixedDim}
          />
          <Text style={styles.staffEmptyText}>
            No staff sales data for this period
          </Text>
        </View>
      ) : (
        <View>
          {staffData.leaderboard.map((entry) => {
            const isFirst = entry.rank === 1
            return (
              <View
                key={entry.user_id}
                style={[styles.staffCard, isFirst && styles.staffCardTop]}
              >
                <View
                  style={[
                    styles.staffRankBadge,
                    isFirst && styles.staffRankBadgeTop,
                  ]}
                >
                  {isFirst ? (
                    <Ionicons name="trophy" size={14} color="#F59E0B" />
                  ) : (
                    <Text style={styles.staffRankText}>#{entry.rank}</Text>
                  )}
                </View>
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{entry.staff_name}</Text>
                  <Text style={styles.staffRole}>
                    {entry.staff_role.replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.staffStats}>
                  <Text style={styles.staffRevenue}>
                    $
                    {Number(entry.total_revenue || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <Text style={styles.staffMeta}>
                    {entry.orders_count} orders · {entry.units_sold} units
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
