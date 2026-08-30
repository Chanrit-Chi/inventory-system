import React from 'react'
import {
  View,
  Text,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../TransactionsScreen.styles'
import { TransactionCard } from '../../../components/TransactionCard'
import { ServerErrorState } from '../../../components/ServerErrorState'
import type { Order } from '../../../types'
import type { DateRangeMode } from '../transactionUtils'

export interface TransactionListFeedProps {
  orders: Order[]
  loading: boolean
  refreshing: boolean
  fetchError: string | null
  headerHeight: number
  searchQuery: string
  dateRange: DateRangeMode
  dateLabel: string
  summary: { totalSales: number; completedCount: number; avgBasket: number }
  loadingMore: boolean
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  onRefresh: () => void
  onSelectOrder?: (order: Order) => void
  onClearDateRange: () => void
}

export const TransactionListFeed: React.FC<TransactionListFeedProps> = ({
  orders,
  loading,
  refreshing,
  fetchError,
  headerHeight,
  searchQuery,
  dateRange,
  dateLabel,
  summary,
  loadingMore,
  onScroll,
  onRefresh,
  onSelectOrder,
  onClearDateRange,
}) => {
  return (
    <Animated.FlatList
      style={styles.scrollArea}
      contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 8 }]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      data={orders}
      keyExtractor={(item) => item.id}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={headerHeight}
          tintColor={tokens.colors.primaryContainer}
          colors={[tokens.colors.primaryContainer]}
        />
      }
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <>
          {/* Active Filter Context Banner */}
          {dateRange !== 'all' && (
            <View style={styles.activeFilterBanner}>
              <Ionicons name="time-outline" size={13} color={tokens.colors.primaryContainer} />
              <Text style={styles.activeFilterBannerText}>
                Period: <Text style={styles.activeFilterHighlight}>{dateLabel}</Text>
              </Text>
              <TouchableOpacity
                onPress={onClearDateRange}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Glanceable Summary Banner */}
          <View style={styles.summaryBanner}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>TOTAL REVENUE</Text>
              <Text style={styles.summaryValue}>${summary.totalSales.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>PAID ORDERS</Text>
              <Text style={styles.summaryValue}>{summary.completedCount}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>AVG BASKET</Text>
              <Text style={styles.summaryValue}>${summary.avgBasket.toFixed(2)}</Text>
            </View>
          </View>

          {/* Section Header */}
          <View style={styles.listSectionHeader}>
            <Text style={styles.listSectionTitle}>
              Transactions ({orders.length})
            </Text>
            <Text style={styles.listSectionSub}>Tap for full receipt & details</Text>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <TransactionCard order={item} onPress={onSelectOrder} />
      )}
      ListEmptyComponent={
        loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            <Text style={styles.centerLoadingText}>Loading transactions...</Text>
          </View>
        ) : fetchError ? (
          <ServerErrorState
            message={fetchError}
            onRetry={onRefresh}
            isRetrying={loading || refreshing}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons
              name="receipt-outline"
              size={44}
              color={tokens.colors.secondaryFixedDim}
            />
            <Text style={styles.emptyTitle}>No matching transactions</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? 'No results for your search. Try different keywords.'
                : dateRange !== 'all'
                ? `No orders found for the selected period (${dateLabel}).`
                : 'No orders in this status category.'}
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.loadingMoreRow}>
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            <Text style={styles.loadingMoreText}>Loading more transactions...</Text>
          </View>
        ) : null
      }
    />
  )
}
