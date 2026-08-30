import React from 'react'
import {
  View,
  Text,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ReportsScreen.styles'
import type { AnalyticsReportData } from '../../../api/endpoints'

export interface ReportRevenueKPICardsProps {
  reportData: AnalyticsReportData
}

export const ReportRevenueKPICards: React.FC<ReportRevenueKPICardsProps> = ({
  reportData,
}) => {
  return (
    <>
      {/* KPI Hero Bento */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroSubtitle}>TOTAL NET REVENUE</Text>
            <Text style={styles.heroAmount}>
              ${Number(reportData.revenue || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
          <View style={styles.heroTrendBadge}>
            <Ionicons name="trending-up" size={13} color="#22C55E" />
            <Text style={styles.heroTrendText}>Live</Text>
          </View>
        </View>

        <View style={styles.heroBreakdownRow}>
          <View style={styles.heroPillItem}>
            <Ionicons name="receipt-outline" size={12} color="#38BDF8" />
            <Text style={styles.heroPillText}>
              {reportData.ordersCount || 0}{' '}
              {(reportData.ordersCount || 0) === 1 ? 'Order' : 'Orders'}
            </Text>
          </View>
          <View style={styles.heroPillItem}>
            <Ionicons name="analytics-outline" size={12} color="#FB923C" />
            <Text style={styles.heroPillText}>
              ${Number(reportData.avgTicket || 0).toFixed(2)} Basket
            </Text>
          </View>
        </View>
      </View>

      {/* 4-Grid Metrics */}
      <View style={styles.grid}>
        <View style={styles.gridCard}>
          <Text style={styles.gridLabel}>Gross Profit</Text>
          <Text style={[styles.gridVal, { color: tokens.colors.statusSuccess }]}>
            ${Number(reportData.profit || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View style={styles.gridCard}>
          <Text style={styles.gridLabel}>Net Profit</Text>
          <Text style={[styles.gridVal, { color: tokens.colors.primaryContainer }]}>
            ${Number(reportData.netProfit || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View style={styles.gridCard}>
          <Text style={styles.gridLabel}>Operational Expenses</Text>
          <Text style={[styles.gridVal, { color: tokens.colors.statusError }]}>
            ${Number(reportData.expenses || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View style={styles.gridCard}>
          <Text style={styles.gridLabel}>Avg Ticket Size</Text>
          <Text style={styles.gridVal}>
            ${Number(reportData.avgTicket || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </>
  )
}
