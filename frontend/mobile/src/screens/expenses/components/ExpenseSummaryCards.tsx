import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ExpensesScreen.styles'

export interface ExpenseSummaryCardsProps {
  dateRange: string
  getDateLabel: () => string
  onResetDateRange: () => void
  summary: {
    total: number
    count: number
    avg: number
    topCat: string
  }
  filteredCount: number
}

export const ExpenseSummaryCards: React.FC<ExpenseSummaryCardsProps> = ({
  dateRange,
  getDateLabel,
  onResetDateRange,
  summary,
  filteredCount,
}) => {
  return (
    <>
      {/* Active Date Context Banner */}
      {dateRange !== 'all' && (
        <View style={styles.activeFilterBanner}>
          <Ionicons name="time-outline" size={13} color={tokens.colors.primaryContainer} />
          <Text style={styles.activeFilterBannerText}>
            Period: <Text style={styles.activeFilterHighlight}>{getDateLabel()}</Text>
          </Text>
          <TouchableOpacity onPress={onResetDateRange} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Hero Analytics Card (Reports & Analytics #1E293B Theme) */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroSubtitle}>TOTAL OPERATIONAL EXPENSES</Text>
            <Text style={styles.heroAmount}>
              ${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.heroTrendBadge}>
            <Ionicons name="pie-chart" size={12} color="#F87171" />
            <Text style={styles.heroTrendText}>Active</Text>
          </View>
        </View>

        <View style={styles.heroBreakdownRow}>
          <View style={styles.heroPillItem}>
            <Ionicons name="receipt-outline" size={11} color="#38BDF8" />
            <Text style={styles.heroPillText}>
              {summary.count} {summary.count === 1 ? 'Entry' : 'Entries'}
            </Text>
          </View>
          <View style={styles.heroPillItem}>
            <Ionicons name="analytics-outline" size={11} color="#FB923C" />
            <Text style={styles.heroPillText}>Avg ${summary.avg.toFixed(2)}</Text>
          </View>
          <View style={styles.heroPillItem}>
            <Ionicons name="pricetag-outline" size={11} color="#A78BFA" />
            <Text style={styles.heroPillText}>Top: {summary.topCat}</Text>
          </View>
        </View>
      </View>

      {/* Section Header */}
      <View style={styles.listSectionHeader}>
        <Text style={styles.listSectionTitle}>Expenses ({filteredCount})</Text>
        <Text style={styles.listSectionSub}>Tap card for details & receipt breakdown</Text>
      </View>
    </>
  )
}
