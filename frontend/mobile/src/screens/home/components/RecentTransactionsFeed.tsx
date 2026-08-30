import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../HomeScreen.styles'
import { TransactionCard } from '../../../components/TransactionCard'
import type { Order, TabType } from '../../../types'

export interface RecentTransactionsFeedProps {
  orders: Order[]
  filteredOrders: Order[]
  statusFilter: 'all' | 'completed' | 'pending'
  setStatusFilter: (f: 'all' | 'completed' | 'pending') => void
  loading: boolean
  refreshing: boolean
  onNavigate: (tab: TabType) => void
  onSelectOrder?: (order: Order) => void
}

export const RecentTransactionsFeed: React.FC<RecentTransactionsFeedProps> = ({
  orders,
  filteredOrders,
  statusFilter,
  setStatusFilter,
  loading,
  refreshing,
  onNavigate,
  onSelectOrder,
}) => {
  return (
    <>
      {/* Recent Transactions Feed Header */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.sectionSubtitle}>Live register activity</Text>
        </View>
        <TouchableOpacity
          onPress={() => onNavigate('transactions')}
          activeOpacity={0.7}
          style={styles.viewAllBtn}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={tokens.colors.primaryContainer} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterPillsRow}>
        <TouchableOpacity
          style={[styles.filterPill, statusFilter === 'all' && styles.filterPillActive]}
          onPress={() => setStatusFilter('all')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterPillText,
              statusFilter === 'all' && styles.filterPillTextActive,
            ]}
          >
            All ({orders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, statusFilter === 'completed' && styles.filterPillActive]}
          onPress={() => setStatusFilter('completed')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterPillText,
              statusFilter === 'completed' && styles.filterPillTextActive,
            ]}
          >
            Completed (
            {orders.filter((o) => (o.status || '').toLowerCase() === 'completed').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, statusFilter === 'pending' && styles.filterPillActive]}
          onPress={() => setStatusFilter('pending')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.filterPillText,
              statusFilter === 'pending' && styles.filterPillTextActive,
            ]}
          >
            Pending ({orders.filter((o) => (o.status || '').toLowerCase() === 'pending').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transaction Feed List */}
      {loading && !refreshing ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
          <Text style={styles.stateText}>Loading transactions...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={32} color={tokens.colors.secondaryFixedDim} />
          <Text style={styles.emptyTitle}>No matching transactions</Text>
          <Text style={styles.emptySub}>No orders recorded in this filter</Text>
        </View>
      ) : (
        <View style={styles.transactionsContainer}>
          {filteredOrders.slice(0, 5).map((order) => (
            <TransactionCard
              key={order.id}
              order={order}
              onPress={onSelectOrder}
            />
          ))}
        </View>
      )}
    </>
  )
}
