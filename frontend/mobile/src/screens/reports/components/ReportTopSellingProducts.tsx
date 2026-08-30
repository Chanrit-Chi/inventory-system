import React from 'react'
import {
  View,
  Text,
} from 'react-native'
import { tokens } from '../../../theme/tokens'
import { styles } from '../ReportsScreen.styles'
import type { AnalyticsReportData } from '../../../api/endpoints'

export interface ReportTopSellingProductsProps {
  topProducts: AnalyticsReportData['topProducts']
}

export const ReportTopSellingProducts: React.FC<ReportTopSellingProductsProps> = ({
  topProducts = [],
}) => {
  return (
    <View style={styles.topProductsCard}>
      <Text style={styles.sectionTitle}>Top Performing Products</Text>
      {!topProducts || topProducts.length === 0 ? (
        <View style={{ paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: tokens.colors.secondary }}>
            No product sales recorded in this period
          </Text>
        </View>
      ) : (
        topProducts.map((tp, idx) => (
          <View key={idx} style={styles.productRankRow}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankNum}>#{idx + 1}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.rankName}>{tp.name}</Text>
              <Text style={styles.rankSales}>{tp.sales} units sold</Text>
            </View>
            <Text style={styles.rankRevenue}>
              ${Number(tp.revenue || 0).toFixed(2)}
            </Text>
          </View>
        ))
      )}
    </View>
  )
}
