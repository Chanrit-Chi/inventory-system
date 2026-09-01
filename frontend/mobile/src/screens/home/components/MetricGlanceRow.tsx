import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { styles } from '../HomeScreen.styles'
import type { DashboardSummary, StaffPerformance } from '../../../types'

export interface MetricGlanceRowProps {
  summary: DashboardSummary | null
  canRestock: boolean
  canReadProducts: boolean
  onLowStockPress: () => void
  isSeller?: boolean
  myPerformance?: StaffPerformance | null
}

export const MetricGlanceRow: React.FC<MetricGlanceRowProps> = ({
  summary,
  canRestock,
  canReadProducts,
  onLowStockPress,
  isSeller = false,
  myPerformance = null,
}) => {
  const lowStockCount = summary?.low_stock_skus ?? 0

  const myOrdersCount = myPerformance
    ? (myPerformance.summary?.total_orders ?? myPerformance.total_orders ?? 0)
    : 0

  const myAvgSale = myPerformance
    ? (myPerformance.summary?.avg_order_value ?? myPerformance.avg_order_value ?? 0)
    : 0

  return (
    <View style={styles.metricRow}>
      {/* Card 1: Units Sold (Store) vs My Orders (Seller) */}
      <View style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>{isSeller ? 'MY ORDERS' : 'UNITS SOLD'}</Text>
          <View style={[styles.metricIconCircle, { backgroundColor: '#CCFBF1' }]}>
            <Ionicons name={isSeller ? 'receipt' : 'cube'} size={13} color="#0D9488" />
          </View>
        </View>
        <Text style={styles.metricValue}>
          {isSeller ? myOrdersCount : (summary?.units_sold ?? 0)}
        </Text>
        <Text style={styles.metricMeta}>{isSeller ? 'Orders today' : 'Sold today'}</Text>
      </View>

      {/* Card 2: Low Stock */}
      <TouchableOpacity
        style={[styles.metricCard, lowStockCount > 0 && styles.metricCardWarning]}
        onPress={onLowStockPress}
        activeOpacity={0.8}
      >
        <View style={styles.metricHeader}>
          <Text style={[lowStockCount > 0 ? styles.metricLabelWarning : styles.metricLabel]}>
            LOW STOCK
          </Text>
          <View style={[styles.metricIconCircle, { backgroundColor: '#FFE4E6' }]}>
            <Ionicons name="alert-circle" size={13} color="#E11D48" />
          </View>
        </View>
        <Text style={[lowStockCount > 0 ? styles.metricValueWarning : styles.metricValue]}>
          {`${lowStockCount} SKUs`}
        </Text>
        <View style={styles.metricActionRow}>
          <Text style={styles.metricActionText}>
            {canRestock ? 'Restock' : canReadProducts ? 'View' : 'Details'}
          </Text>
          <Ionicons name="arrow-forward" size={11} color="#E11D48" />
        </View>
      </TouchableOpacity>

      {/* Card 3: Avg / Sale (Store) vs My Avg / Sale (Seller) */}
      <View style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>{isSeller ? 'MY AVG / SALE' : 'AVG / SALE'}</Text>
          <View style={[styles.metricIconCircle, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="card" size={13} color="#7C3AED" />
          </View>
        </View>
        <Text style={styles.metricValue}>
          ${(isSeller ? myAvgSale : (summary?.avg_basket_value ?? 0)).toFixed(2)}
        </Text>
        <Text style={styles.metricMeta}>Per order</Text>
      </View>
    </View>
  )
}
