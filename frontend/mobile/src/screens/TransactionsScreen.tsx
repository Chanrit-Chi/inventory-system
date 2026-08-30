import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Alert,
} from 'react-native'
import { useDebounce } from '../hooks/useDebounce'
import { useCollapsibleHeader } from '../hooks/useCollapsibleHeader'
import { useOrders } from '../hooks/queries/useOrdersQuery'
import { matchSearch } from '../utils/searchHelper'
import type { Order } from '../types'
import { styles } from './transactions/TransactionsScreen.styles'
import {
  FilterStatus,
  DateRangeMode,
  computeActiveDateBounds,
  isDateWithinBounds,
} from './transactions/transactionUtils'
import { TransactionFilterBar } from './transactions/components/TransactionFilterBar'
import { TransactionDateRangeModal } from './transactions/components/TransactionDateRangeModal'
import { TransactionListFeed } from './transactions/components/TransactionListFeed'

export interface TransactionsScreenProps {
  onSelectOrder?: (order: Order) => void
  onOpenScanner?: () => void
  refreshTrigger?: number
  onUpdateOrderStatus?: (orderId: string, status: string, paymentMethod?: string) => void
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onSelectOrder,
  refreshTrigger,
}) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [dateRange, setDateRange] = useState<DateRangeMode>('all')
  const [singleDate, setSingleDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  )
  const [customTo, setCustomTo] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  // Custom Calendar Modal State
  const [customRangeModalOpen, setCustomRangeModalOpen] = useState(false)
  const [tempMode, setTempMode] = useState<'single' | 'custom'>('custom')
  const [tempSingleDate, setTempSingleDate] = useState(singleDate)
  const [tempCustomFrom, setTempCustomFrom] = useState(customFrom)
  const [tempCustomTo, setTempCustomTo] = useState(customTo)

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore] = useState(false)

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
    return computeActiveDateBounds(dateRange, singleDate, customFrom, customTo)
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
      setFetchError(
        (queryOrdersError as Error).message ||
          'Could not connect to server to load transactions.'
      )
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

  // Filtered orders list (applies status, search, and date bounds)
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusLower = (order.status || '').toLowerCase()

      // Status filter
      if (statusFilter === 'COMPLETED' && statusLower !== 'completed' && statusLower !== 'paid')
        return false
      if (statusFilter === 'PENDING' && statusLower !== 'pending' && statusLower !== 'unpaid')
        return false
      if (statusFilter === 'CANCELLED' && statusLower !== 'cancelled' && statusLower !== 'refunded')
        return false

      // Date range filter
      if (!isDateWithinBounds(order.created_at, activeDateBounds.from, activeDateBounds.to)) {
        return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const itemNames =
          order.items?.map(
            (i) =>
              i.product_name ||
              i.productName ||
              (i.variant as any)?.product?.name ||
              (i.variant as any)?.name ||
              ''
          ) || []
        const itemSkus =
          order.items?.map((i) => i.sku || i.variant?.sku || '') || []
        const match = matchSearch(
          searchQuery,
          order.order_number || order.id,
          order.customer?.name,
          order.customer?.phone,
          order.customer?.email,
          order.note || '',
          order.notes || '',
          order.delivery_address || '',
          order.channel?.name || '',
          order.salesChannel?.name || '',
          order.user?.name || '',
          order.seller?.name || '',
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
      if (st === 'completed' || st === 'paid') completed++
      else if (st === 'pending' || st === 'unpaid') pending++
      else if (st === 'cancelled' || st === 'refunded') cancelled++
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
    const completedOrders = filteredOrders.filter((o) => {
      const st = (o.status || '').toLowerCase()
      return st === 'completed' || st === 'paid'
    })
    const totalSales = completedOrders.reduce((sum, o) => {
      const rawTotal = o.total_amount ?? 0
      const amt =
        typeof rawTotal === 'number'
          ? rawTotal
          : parseFloat(String(rawTotal || '0')) || 0
      return sum + amt
    }, 0)
    const avgBasket =
      completedOrders.length > 0 ? totalSales / completedOrders.length : 0
    return {
      totalSales,
      completedCount: completedOrders.length,
      avgBasket,
    }
  }, [filteredOrders])

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

  return (
    <View style={styles.container}>
      {/* Animated Collapsible Header (Search, Date Pills, Status Chips) */}
      <TransactionFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        dateRange={dateRange}
        setDateRange={setDateRange}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateLabel={getDateLabel()}
        counts={counts}
        headerTranslateY={headerTranslateY}
        headerOpacity={headerOpacity}
        onLayoutHeader={onLayoutHeader}
        onOpenCustomModal={handleOpenCustomModal}
      />

      {/* Main Content Area */}
      <TransactionListFeed
        orders={filteredOrders}
        loading={loading || isQueryOrdersLoading}
        refreshing={refreshing}
        fetchError={fetchError}
        headerHeight={headerHeight}
        searchQuery={searchQuery}
        dateRange={dateRange}
        dateLabel={getDateLabel()}
        summary={summary}
        loadingMore={loadingMore}
        onScroll={onScroll}
        onRefresh={onRefresh}
        onSelectOrder={onSelectOrder}
        onClearDateRange={() => setDateRange('all')}
      />

      {/* Custom Date Range Calendar Modal */}
      <TransactionDateRangeModal
        visible={customRangeModalOpen}
        tempMode={tempMode}
        setTempMode={setTempMode}
        tempSingleDate={tempSingleDate}
        setTempSingleDate={setTempSingleDate}
        tempCustomFrom={tempCustomFrom}
        setTempCustomFrom={setTempCustomFrom}
        tempCustomTo={tempCustomTo}
        setTempCustomTo={setTempCustomTo}
        onClose={() => setCustomRangeModalOpen(false)}
        onApplySingleDate={handleApplySingleDate}
        onApplyCustomRange={handleApplyCustomRange}
      />
    </View>
  )
}

export default TransactionsScreen
