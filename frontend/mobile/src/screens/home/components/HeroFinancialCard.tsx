import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../HomeScreen.styles'
import type { DashboardSummary } from '../../../types'

export interface HeroFinancialCardProps {
  summary: DashboardSummary | null
  dailyTarget: number
  targetProgress: number
  canEditTarget: boolean
  onOpenTargetModal: () => void
}

export const HeroFinancialCard: React.FC<HeroFinancialCardProps> = ({
  summary,
  dailyTarget,
  targetProgress,
  canEditTarget,
  onOpenTargetModal,
}) => {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View>
          <Text style={styles.heroSubtitle}>TODAY'S NET REVENUE</Text>
          <Text style={styles.heroAmount}>
            ${(summary?.net_revenue ?? 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View
          style={[
            styles.heroTrendBadge,
            (summary?.revenue_trend ?? 0) < 0 && { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
          ]}
        >
          <Ionicons
            name={(summary?.revenue_trend ?? 0) >= 0 ? 'trending-up' : 'trending-down'}
            size={13}
            color={(summary?.revenue_trend ?? 0) >= 0 ? '#22C55E' : '#EF4444'}
          />
          <Text
            style={[
              styles.heroTrendText,
              (summary?.revenue_trend ?? 0) < 0 && { color: '#EF4444' },
            ]}
          >
            {(summary?.revenue_trend ?? 0) >= 0 ? '+' : ''}
            {(summary?.revenue_trend ?? 0).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Progress vs Daily Target */}
      <TouchableOpacity
        style={styles.targetSection}
        disabled={!canEditTarget}
        onPress={onOpenTargetModal}
        activeOpacity={canEditTarget ? 0.8 : 1}
      >
        <View style={styles.targetLabelRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.targetLabel}>
              Daily Target (${dailyTarget.toLocaleString('en-US')})
            </Text>
            {Boolean(canEditTarget) && (
              <Ionicons name="pencil-sharp" size={11} color="#94A3B8" />
            )}
          </View>
          <Text style={styles.targetPercent}>
            {targetProgress.toFixed(1)}% Achieved
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(Math.max(targetProgress, 0), 100)}%` },
            ]}
          />
        </View>
      </TouchableOpacity>

      {/* Hero Bottom Breakdown Pills */}
      <View style={styles.heroBreakdownRow}>
        <View style={styles.heroPillItem}>
          <Ionicons name="receipt-outline" size={12} color="#38BDF8" />
          <Text style={styles.heroPillText}>
            {summary?.orders_count ?? 0} {summary?.orders_count === 1 ? 'Order' : 'Orders'} Today
          </Text>
        </View>
        <View style={styles.heroPillItem}>
          <Ionicons name="pricetag-outline" size={12} color="#FB923C" />
          <Text style={styles.heroPillText}>
            ${(summary?.avg_basket_value ?? 0).toFixed(2)} / Sale
          </Text>
        </View>
        <View style={styles.heroPillItem}>
          <Ionicons name="qr-code-outline" size={12} color="#C084FC" />
          <Text style={styles.heroPillText}>
            {Math.round(summary?.digital_payment_percentage ?? 0)}% QR/Digital
          </Text>
        </View>
      </View>
    </View>
  )
}
