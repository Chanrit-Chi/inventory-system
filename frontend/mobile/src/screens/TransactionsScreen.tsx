import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  Animated,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar } from 'react-native-calendars'
import { tokens } from '../theme/tokens'
import { getOrders } from '../api/endpoints'
import { useDebounce } from '../hooks/useDebounce'
import { useCollapsibleHeader } from '../hooks/useCollapsibleHeader'
import { useOrders } from '../hooks/queries/useOrdersQuery'
import { TransactionCard } from '../components/TransactionCard'
import { ServerErrorState } from '../components/ServerErrorState'
import { SearchBar } from '../components/SearchBar'
import { matchSearch } from '../utils/searchHelper'
import type { Order } from '../types'

export interface TransactionsScreenProps {
  onSelectOrder?: (order: Order) => void
  onOpenScanner?: () => void
  refreshTrigger?: number
  onUpdateOrderStatus?: (orderId: string, status: string, paymentMethod?: string) => void
}

type FilterStatus = 'ALL' | 'COMPLETED' | 'PENDING' | 'CANCELLED'
type DateRangeMode = 'all' | 'today' | '7d' | '30d' | 'year' | 'single' | 'custom'

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onSelectOrder,
  refreshTrigger,
}) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [dateRange, setDateRange] = useState<DateRangeMode>('all')
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  )
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().split('T')[0])

  // Custom Calendar Modal State
  const [customRangeModalOpen, setCustomRangeModalOpen] = useState(false)
  const [tempMode, setTempMode] = useState<'single' | 'custom'>('custom')
  const [tempSingleDate, setTempSingleDate] = useState(singleDate)
  const [tempCustomFrom, setTempCustomFrom] = useState(customFrom)
  const [tempCustomTo, setTempCustomTo] = useState(customTo)

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  
  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  // Collapsible Search, Date & Status Filters on Scroll
  const {
    headerTranslateY,
    headerOpacity,
    onScroll,
    onLayoutHeader,
    headerHeight,
  } = useCollapsibleHeader({ initialHeaderHeight: 145 })

  // Calculate active date bounds for backend and client filtering
  const activeDateBounds = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (dateRange === 'today') {
      return { from: todayStr, to: todayStr }
    }
    if (dateRange === '7d') {
      const fromStr = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
      return { from: fromStr, to: todayStr }
    }
    if (dateRange === '30d') {
      const fromStr = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]
      return { from: fromStr, to: todayStr }
    }
    if (dateRange === 'year') {
      const thisYear = new Date().getFullYear()
      return { from: `${thisYear}-01-01`, to: todayStr }
    }
    if (dateRange === 'single') {
      return { from: singleDate, to: singleDate }
    }
    if (dateRange === 'custom') {
      return { from: customFrom, to: customTo }
    }
    return { from: undefined, to: undefined }
  }, [dateRange, singleDate, customFrom, customTo])

  const {
    data: queryOrders,
    isLoading: isQueryOrdersLoading,
    error: queryOrdersError,
    refetch: refetchOrders,
  } = useOrders({
    page: 1,
    per_page: 50,
    search: debouncedSearchQuery.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter.toLowerCase(),
    date_from: activeDateBounds.from,
    date_to: activeDateBounds.to,
  })

  useEffect(() => {
    if (queryOrders && Array.isArray(queryOrders)) {
      setOrders(queryOrders)
      setLoading(false)
      setFetchError(null)
    }
  }, [queryOrders])

  useEffect(() => {
    if (queryOrdersError) {
      setFetchError((queryOrdersError as Error).message || 'Could not connect to server to load transactions.')
    }
  }, [queryOrdersError])

  useEffect(() => {
    if (refreshTrigger) {
      refetchOrders()
    }
  }, [refreshTrigger, refetchOrders])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetchOrders()
    setRefreshing(false)
  }, [refetchOrders])

  // Client-side date helper
  const isDateWithinBounds = (dateStr?: string, from?: string, to?: string) => {
    if (!from && !to) return true
    if (!dateStr) return true
    const target = dateStr.split('T')[0]
    if (from && target < from) return false
    if (to && target > to) return false
    return true
  }

  // Filtered orders list (applies status, search, and date bounds)
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusLower = (order.status || '').toLowerCase()

      // Status filter
      if (statusFilter === 'COMPLETED' && statusLower !== 'completed') return false
      if (statusFilter === 'PENDING' && statusLower !== 'pending') return false
      if (statusFilter === 'CANCELLED' && statusLower !== 'cancelled') return false

      // Date range filter
      if (!isDateWithinBounds(order.created_at, activeDateBounds.from, activeDateBounds.to)) {
        return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const itemNames = order.items?.map((i) => i.product_name || i.productName || i.variant?.product?.name || i.variant?.name || '') || []
        const itemSkus = order.items?.map((i) => i.sku || i.variant?.sku || '') || []
        const match = matchSearch(
          searchQuery,
          order.order_number,
          order.customer?.name,
          order.customer?.phone,
          order.customer?.email,
          order.note,
          order.notes,
          order.delivery_address,
          order.channel?.name,
          order.salesChannel?.name,
          order.user?.name,
          order.seller?.name,
          itemNames,
          itemSkus
        )
        if (!match) return false
      }

      return true
    })
  }, [orders, statusFilter, searchQuery, activeDateBounds])

  // Counts for filter badges within current date range
  const counts = useMemo(() => {
    let completed = 0
    let pending = 0
    let cancelled = 0
    let totalInRange = 0

    orders.forEach((o) => {
      if (!isDateWithinBounds(o.created_at, activeDateBounds.from, activeDateBounds.to)) return
      totalInRange++
      const st = (o.status || '').toLowerCase()
      if (st === 'completed') completed++
      else if (st === 'pending') pending++
      else if (st === 'cancelled') cancelled++
    })

    return {
      all: totalInRange,
      completed,
      pending,
      cancelled,
    }
  }, [orders, activeDateBounds])

  // Summary Metrics for filtered view
  const summary = useMemo(() => {
    const completedOrders = filteredOrders.filter(
      (o) => (o.status || '').toLowerCase() === 'completed'
    )
    const totalSales = completedOrders.reduce((sum, o) => {
      const amt =
        typeof o.total_amount === 'number'
          ? o.total_amount
          : parseFloat(String(o.total_amount || '0')) || 0
      return sum + amt
    }, 0)
    const avgBasket = completedOrders.length > 0 ? totalSales / completedOrders.length : 0
    return {
      totalSales,
      completedCount: completedOrders.length,
      avgBasket,
    }
  }, [filteredOrders])

  // Helper date offset generator
  const getPastDateStr = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * 86400000)
    return d.toISOString().split('T')[0]
  }

  // Modal Handlers
  const handleOpenCustomModal = () => {
    setTempMode(dateRange === 'single' ? 'single' : 'custom')
    setTempSingleDate(singleDate)
    setTempCustomFrom(customFrom)
    setTempCustomTo(customTo)
    setCustomRangeModalOpen(true)
  }

  const handleApplySingleDate = () => {
    if (!tempSingleDate.trim()) {
      Alert.alert('Required', 'Please select or enter a valid date.')
      return
    }
    setSingleDate(tempSingleDate.trim())
    setDateRange('single')
    setCustomRangeModalOpen(false)
  }

  const handleApplyCustomRange = () => {
    if (!tempCustomFrom.trim() || !tempCustomTo.trim()) {
      Alert.alert('Required', 'Please select both start date and end date.')
      return
    }
    setCustomFrom(tempCustomFrom.trim())
    setCustomTo(tempCustomTo.trim())
    setDateRange('custom')
    setCustomRangeModalOpen(false)
  }

  const handleRangeDayPress = (day: any) => {
    if (!tempCustomFrom || (tempCustomFrom && tempCustomTo)) {
      setTempCustomFrom(day.dateString)
      setTempCustomTo('')
    } else {
      if (day.dateString < tempCustomFrom) {
        setTempCustomTo(tempCustomFrom)
        setTempCustomFrom(day.dateString)
      } else {
        setTempCustomTo(day.dateString)
      }
    }
  }

  const getRangeMarkedDates = () => {
    const marks: any = {}
    if (tempCustomFrom) {
      marks[tempCustomFrom] = {
        startingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: 'white',
        selected: true,
        selectedColor: tokens.colors.primaryContainer,
      }
    }
    if (tempCustomTo) {
      marks[tempCustomTo] = {
        endingDay: true,
        color: tokens.colors.primaryContainer,
        textColor: 'white',
        selected: true,
        selectedColor: tokens.colors.primaryContainer,
      }

      let curr = new Date(tempCustomFrom)
      curr.setDate(curr.getDate() + 1)
      const end = new Date(tempCustomTo)
      while (curr < end) {
        const dateStr = curr.toISOString().split('T')[0]
        marks[dateStr] = {
          color: tokens.colors.primaryContainer + '40',
          textColor: tokens.colors.onBackground,
          selected: true,
          selectedColor: tokens.colors.primaryContainer + '40',
        }
        curr.setDate(curr.getDate() + 1)
      }
    }
    return marks
  }

  const getDateLabel = () => {
    if (dateRange === 'single') return singleDate
    if (dateRange === 'custom') {
      return `${new Date(customFrom).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${new Date(customTo).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`
    }
    if (dateRange === 'today') return 'Today'
    if (dateRange === '7d') return '7 Days'
    if (dateRange === '30d') return '30 Days'
    if (dateRange === 'year') return 'Year'
    return 'All Time'
  }

  return (
    <View style={styles.container}>
      {/* Animated Collapsible Header (Search, Date Pills, Status Chips) */}
      <Animated.View
        onLayout={onLayoutHeader}
        style={[
          styles.collapsibleHeaderWrap,
          {
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
          },
        ]}
      >
        {/* Top Search & Toolbar */}
        <View style={styles.topToolbar}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search order #, customer, phone, products..."
            containerStyle={styles.searchBox}
          />
        </View>

        {/* Date Filter Chips Bar */}
        <View style={styles.dateBarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateBarContent}
          >
            <TouchableOpacity
              style={[styles.dateBtn, dateRange === 'all' && styles.dateBtnActive]}
              onPress={() => setDateRange('all')}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.dateBtnText, dateRange === 'all' && styles.dateBtnTextActive]}
              >
                All Time
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, dateRange === 'today' && styles.dateBtnActive]}
              onPress={() => setDateRange('today')}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.dateBtnText, dateRange === 'today' && styles.dateBtnTextActive]}
              >
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, dateRange === '7d' && styles.dateBtnActive]}
              onPress={() => setDateRange('7d')}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.dateBtnText, dateRange === '7d' && styles.dateBtnTextActive]}
              >
                7 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, dateRange === '30d' && styles.dateBtnActive]}
              onPress={() => setDateRange('30d')}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.dateBtnText, dateRange === '30d' && styles.dateBtnTextActive]}
              >
                30 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateBtn, dateRange === 'year' && styles.dateBtnActive]}
              onPress={() => setDateRange('year')}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.dateBtnText, dateRange === 'year' && styles.dateBtnTextActive]}
              >
                Year
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateBtn,
                (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnActive,
                { flexDirection: 'row', gap: 4 },
              ]}
              onPress={handleOpenCustomModal}
              activeOpacity={0.75}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={
                  dateRange === 'single' || dateRange === 'custom'
                    ? tokens.colors.onPrimary
                    : tokens.colors.secondary
                }
              />
              <Text
                style={[
                  styles.dateBtnText,
                  (dateRange === 'single' || dateRange === 'custom') && styles.dateBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {dateRange === 'single' || dateRange === 'custom' ? getDateLabel() : 'Custom'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Status Filter Chips Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusChipsRow}
          contentContainerStyle={styles.statusChipsContent}
        >
          {[
            { id: 'ALL' as const, label: 'All Statuses', count: counts.all },
            { id: 'COMPLETED' as const, label: 'Paid', count: counts.completed },
            { id: 'PENDING' as const, label: 'Pending', count: counts.pending },
            { id: 'CANCELLED' as const, label: 'Cancelled', count: counts.cancelled },
          ].map((st) => {
            const isSelected = statusFilter === st.id
            return (
              <TouchableOpacity
                key={st.id}
                style={[styles.statusFilterChip, isSelected && styles.statusFilterChipActive]}
                onPress={() => setStatusFilter(st.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.statusFilterChipText,
                    isSelected && styles.statusFilterChipTextActive,
                  ]}
                >
                  {st.label}
                </Text>
                <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                  <Text
                    style={[
                      styles.countBadgeText,
                      isSelected && styles.countBadgeTextActive,
                    ]}
                  >
                    {st.count}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </Animated.View>

      {/* Main Content Area */}
      <Animated.FlatList
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={filteredOrders}
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
                  Period: <Text style={styles.activeFilterHighlight}>{getDateLabel()}</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => setDateRange('all')}
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
                Transactions ({filteredOrders.length})
              </Text>
              <Text style={styles.listSectionSub}>Tap for full receipt & details</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TransactionCard
            order={item}
            onPress={onSelectOrder}
          />
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
                  ? `No orders found for the selected period (${getDateLabel()}).`
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

      {/* ========================================================================= */}
      {/* MODAL: CUSTOM DATE PICKER (SINGLE DATE OR DATE RANGE)                     */}
      {/* ========================================================================= */}
      <Modal visible={customRangeModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date</Text>
              <TouchableOpacity onPress={() => setCustomRangeModalOpen(false)}>
                <Ionicons name="close" size={22} color={tokens.colors.onBackground} />
              </TouchableOpacity>
            </View>

            {/* Segmented Control for Single vs Range */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  tempMode === 'single' && styles.segmentBtnActive,
                ]}
                onPress={() => setTempMode('single')}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    tempMode === 'single' && styles.segmentBtnTextActive,
                  ]}
                >
                  Single Date
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  tempMode === 'custom' && styles.segmentBtnActive,
                ]}
                onPress={() => setTempMode('custom')}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    tempMode === 'custom' && styles.segmentBtnTextActive,
                  ]}
                >
                  Date Range
                </Text>
              </TouchableOpacity>
            </View>

            {tempMode === 'single' ? (
              <View>
                <Text style={styles.modalSubtitle}>Choose a preset or tap a date:</Text>
                <View style={styles.quickPresetsGrid}>
                  <TouchableOpacity
                    style={[
                      styles.presetChip,
                      tempSingleDate === getPastDateStr(0) && styles.presetChipActive,
                    ]}
                    onPress={() => setTempSingleDate(getPastDateStr(0))}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        tempSingleDate === getPastDateStr(0) && styles.presetChipTextActive,
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.presetChip,
                      tempSingleDate === getPastDateStr(1) && styles.presetChipActive,
                    ]}
                    onPress={() => setTempSingleDate(getPastDateStr(1))}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        tempSingleDate === getPastDateStr(1) && styles.presetChipTextActive,
                      ]}
                    >
                      Yesterday
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.presetChip,
                      tempSingleDate === getPastDateStr(2) && styles.presetChipActive,
                    ]}
                    onPress={() => setTempSingleDate(getPastDateStr(2))}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        tempSingleDate === getPastDateStr(2) && styles.presetChipTextActive,
                      ]}
                    >
                      2 Days Ago
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.calendarContainer}>
                  <Calendar
                    current={tempSingleDate}
                    onDayPress={(day: any) => setTempSingleDate(day.dateString)}
                    markedDates={{
                      [tempSingleDate]: {
                        selected: true,
                        disableTouchEvent: true,
                        selectedColor: tokens.colors.primaryContainer,
                      },
                    }}
                    theme={{
                      todayTextColor: tokens.colors.primaryContainer,
                      arrowColor: tokens.colors.primaryContainer,
                      textDayFontSize: 13,
                      textMonthFontSize: 13,
                      textDayHeaderFontSize: 12,
                    }}
                  />
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.modalSubtitle}>Tap start date and end date:</Text>
                <View style={styles.quickPresetsGrid}>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => {
                      setTempCustomFrom(getPastDateStr(6))
                      setTempCustomTo(getPastDateStr(0))
                    }}
                  >
                    <Text style={styles.presetChipText}>Last 7 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => {
                      setTempCustomFrom(getPastDateStr(13))
                      setTempCustomTo(getPastDateStr(0))
                    }}
                  >
                    <Text style={styles.presetChipText}>Last 14 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => {
                      setTempCustomFrom(getPastDateStr(29))
                      setTempCustomTo(getPastDateStr(0))
                    }}
                  >
                    <Text style={styles.presetChipText}>Last 30 Days</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.calendarContainer}>
                  <Calendar
                    current={tempCustomTo || tempCustomFrom || undefined}
                    onDayPress={handleRangeDayPress}
                    markingType={'period'}
                    markedDates={getRangeMarkedDates()}
                    theme={{
                      todayTextColor: tokens.colors.primaryContainer,
                      arrowColor: tokens.colors.primaryContainer,
                      textDayFontSize: 13,
                      textMonthFontSize: 13,
                      textDayHeaderFontSize: 12,
                    }}
                  />
                </View>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCustomRangeModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => {
                  if (tempMode === 'single') handleApplySingleDate()
                  else handleApplyCustomRange()
                }}
              >
                <Text style={styles.modalApplyBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  collapsibleHeaderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: tokens.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  topToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  dateBarContainer: {
    backgroundColor: tokens.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  dateBarContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  dateBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  dateBtnTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  statusChipsRow: {
    maxHeight: 46,
    backgroundColor: tokens.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  statusChipsContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 5,
  },
  statusFilterChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  statusFilterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  statusFilterChipTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  countBadgeTextActive: {
    color: tokens.colors.onPrimary,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  activeFilterBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: tokens.colors.primary,
    fontWeight: '600',
  },
  activeFilterHighlight: {
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl + 40,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listSectionSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  centerLoading: {
    padding: 36,
    alignItems: 'center',
    gap: 8,
  },
  centerLoadingText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 8,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptySub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },

  /* Custom Calendar Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 18,
    width: '100%',
    maxWidth: 380,
    ...tokens.shadows.cardElevated,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  modalSubtitle: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.sm,
    padding: 4,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.sm,
  },
  segmentBtnActive: {
    backgroundColor: tokens.colors.surfaceCard,
    ...tokens.shadows.card,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.secondary,
  },
  segmentBtnTextActive: {
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  quickPresetsGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceMuted,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  presetChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  presetChipTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  calendarContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  modalApplyBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
  },
  modalApplyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  loadingMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: tokens.colors.secondary,
    fontWeight: '600',
  },
})

export default TransactionsScreen

