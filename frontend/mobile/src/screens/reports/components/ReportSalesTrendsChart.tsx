import React from 'react'
import {
  View,
  Text,
  ScrollView,
} from 'react-native'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ReportsScreen.styles'
import type { AnalyticsReportData } from '../../../api/endpoints'

export interface ReportSalesTrendsChartProps {
  reportData: AnalyticsReportData
  filterDisplayLabel: string
  maxChartVal: number
}

export const ReportSalesTrendsChart: React.FC<ReportSalesTrendsChartProps> = ({
  reportData,
  filterDisplayLabel,
  maxChartVal,
}) => {
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>
        Revenue Trend ({filterDisplayLabel})
      </Text>
      {!reportData.chartBars || reportData.chartBars.length === 0 ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>
            No revenue points recorded for this period
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View
            style={[
              styles.chartBarsContainer,
              { minWidth: reportData.chartBars.length * 53 },
            ]}
          >
            {reportData.chartBars.map((bar, idx) => {
              const heightPercent = Math.max(
                12,
                Math.round(((bar.val || 0) / maxChartVal) * 100)
              )

              return (
                <View key={idx} style={styles.barColumn}>
                  <Text style={styles.barValText} numberOfLines={1}>
                    ${bar.val > 1000 ? `${(bar.val / 1000).toFixed(1)}k` : bar.val.toFixed(0)}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { height: `${heightPercent}%` }]}
                    />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {bar.label}
                  </Text>
                </View>
              )
            })}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
