import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Platform,
  Modal,
  Alert,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useIsFocused } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { getOrders, getDashboardSummary, fetchMyPerformance } from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../context/AuthContext'
import { TransactionCard } from '../components/TransactionCard'
import { StaffDetailModal } from '../components/StaffDetailModal'
import { StaffPerformanceCard } from '../components/StaffPerformanceCard'
import { ServerErrorState } from '../components/ServerErrorState'
import type { Order, TabType, DashboardSummary, StaffPerformance } from '../types'

export interface HomeScreenProps {
  onNavigate: (tab: TabType) => void
  onOpenStockIn?: () => void
  onOpenStockAdjustment?: () => void
  onSelectOrder?: (order: Order) => void
  storeName?: string
  staffName?: string
}

const SAMPLE_RECENT_ORDERS: Order[] = []


function formatOrderTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return '12:00 PM'
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Today'
  }
}

function getChannelDisplayName(order: Order): string | null {
  if (order.channel?.name) return order.channel.name
  if (!order.channel_id) return null
  const isTechnicalId =
    /^[0-9a-fA-F-]{8,}$/i.test(order.channel_id) ||
    order.channel_id.length > 18 ||
    order.channel_id.startsWith('chan-') ||
    order.channel_id.startsWith('ch-')
  if (isTechnicalId) return null
  return order.channel_id
}

interface SpringScaleCardProps {
  onPress?: () => void
  style?: any
  touchStyle?: any
  children: React.ReactNode
  activeOpacity?: number
  testID?: string
  accessibilityLabel?: string
}

const SpringScaleCard: React.FC<SpringScaleCardProps> = ({
  onPress,
  style,
  touchStyle,
  children,
  activeOpacity = 0.88,
  testID,
  accessibilityLabel,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={activeOpacity}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={touchStyle || { flex: 1 }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  )
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenStockIn,
  onOpenStockAdjustment,
  onSelectOrder,
  storeName = 'KC Flagship',
  staffName = 'Alex M.',
}) => {
  const { can, canAccessTab } = usePermissions()
  const { currentUser } = useAuth()
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all')
  const [orders, setOrders] = useState<Order[]>([])
  const isFocused = useIsFocused()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [myPerformance, setMyPerformance] = useState<StaffPerformance | null>(null)
  const [myPerfPeriod, setMyPerfPeriod] = useState<'today' | '7d' | 'month'>('today')
  const [myPerfModalOpen, setMyPerfModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const canEditTarget = useMemo(() => {
    return currentUser?.role !== 'SELLER' && (can('reports:view') || can('settings:*') || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'MANAGER')
  }, [currentUser?.role, can])

  const handleQuickStockIn = useCallback(() => {
    if (can('inventory:restock')) {
      onOpenStockIn?.()
    } else {
      Alert.alert('Access Restricted', 'Stock In intake requires inventory restocking permissions.')
    }
  }, [can, onOpenStockIn])

  const handleQuickStockAdj = useCallback(() => {
    if (can('inventory:adjust')) {
      onOpenStockAdjustment?.()
    } else {
      Alert.alert('Access Restricted', 'Stock Adjustment requires inventory management permissions.')
    }
  }, [can, onOpenStockAdjustment])

  // Customizable Daily Target
  const [dailyTarget, setDailyTarget] = useState<number>(2500)
  const [targetModalOpen, setTargetModalOpen] = useState(false)
  const [targetInput, setTargetInput] = useState('2500')

  useEffect(() => {
    AsyncStorage.getItem('@kc_daily_target_amount')
      .then((val) => {
        if (val) {
          const num = parseFloat(val)
          if (!isNaN(num) && num > 0) {
            setDailyTarget(num)
            setTargetInput(String(num))
          }
        }
      })
      .catch((err) => console.warn('Failed to load daily target from storage:', err))
  }, [])

  const handleSaveTarget = async (newVal: number) => {
    const valid = Math.max(100, newVal)
    setDailyTarget(valid)
    setTargetInput(String(valid))
    setTargetModalOpen(false)
    try {
      await AsyncStorage.setItem('@kc_daily_target_amount', String(valid))
    } catch (err) {
      console.warn('Failed to save daily target to storage:', err)
    }
  }

  // Calculate dynamic target progress
  const targetProgress = useMemo(() => {
    if (!dailyTarget || dailyTarget <= 0) return 0
    return ((summary?.net_revenue ?? 0) / dailyTarget) * 100
  }, [summary?.net_revenue, dailyTarget])

  // Module items with permission gating
  const allModules: { tab: TabType; title: string; sub: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] = [
    { tab: 'quotations', title: 'Quotations', sub: 'Estimates & Quotes', icon: 'document-text', color: '#0284C7', bg: '#E0F2FE' },
    { tab: 'invoices', title: 'Invoices', sub: 'Payments & Due', icon: 'receipt', color: '#15803D', bg: '#E6F4EA' },
    { tab: 'products', title: 'Products', sub: 'Catalog & POs', icon: 'cube', color: '#B45309', bg: '#FEF3C7' },
    { tab: 'suppliers', title: 'Suppliers', sub: 'Vendors & Restock', icon: 'briefcase', color: '#65A30D', bg: '#ECFCCB' },
    { tab: 'categories', title: 'Categories', sub: 'Attributes & Tax', icon: 'pricetags', color: '#EA580C', bg: '#FFEDD5' },
    { tab: 'customers', title: 'Customers', sub: 'CRM & Profiles', icon: 'people', color: '#5B21B6', bg: '#EDE9FE' },
    { tab: 'expenses', title: 'Expenses', sub: 'Costs & Utilities', icon: 'cash', color: '#93000A', bg: '#FFDAD6' },
    { tab: 'reports', title: 'Reports', sub: 'Financial KPIs', icon: 'bar-chart', color: '#0D9488', bg: '#CCFBF1' },
    { tab: 'admin', title: 'Admin', sub: 'Staff & Matrix', icon: 'shield-checkmark', color: '#4F46E5', bg: '#EEF2FF' },
  ]

  const visibleModules = allModules.filter((m) => canAccessTab(m.tab))

  // Fetch dashboard summary KPIs from backend
  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await getDashboardSummary()
      if (res && res.data) {
        setSummary(res.data)
        setDashboardError(null)
      }
    } catch (err: any) {
      setDashboardError(err?.message || 'Could not connect to backend to load dashboard summary.')
    }
  }, [])

  // Fetch logged in staff personal shift & performance KPIs
  const fetchMyPerformanceData = useCallback(async (period: 'today' | '7d' | 'month' = 'today') => {
    try {
      const res = await fetchMyPerformance({ period })
      if (res && res.data) {
        setMyPerformance(res.data)
      }
    } catch {
      // Retain previous gracefully
    }
  }, [])

  // Fetch recent orders from backend
  const fetchRecentOrders = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getOrders({ page: 1 })
      if (res && res.data && res.data.length > 0) {
        setOrders(res.data)
      } else {
        setOrders([])
      }
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (isFocused) {
      fetchDashboardData()
      fetchMyPerformanceData(myPerfPeriod)
      fetchRecentOrders()
    }
  }, [isFocused, myPerfPeriod, fetchDashboardData, fetchMyPerformanceData, fetchRecentOrders])

  const handleLowStockPress = useCallback(() => {
    if (can('products:read')) {
      onNavigate('products')
    } else if (can('inventory:restock')) {
      onOpenStockIn?.()
    } else if (can('inventory:adjust')) {
      onOpenStockAdjustment?.()
    } else {
      Alert.alert(
        'Access Restricted',
        'Viewing low-stock inventory details or restocking requires inventory permissions.'
      )
    }
  }, [can, onNavigate, onOpenStockIn, onOpenStockAdjustment])

  const handleQuickAction = useCallback((tab: TabType) => {
    if (tab === 'products' && onOpenStockIn && can('inventory:restock')) {
      onOpenStockIn()
      return
    }
    if (tab === 'products' && onOpenStockAdjustment && can('inventory:adjust')) {
      onOpenStockAdjustment()
      return
    }
    if (canAccessTab(tab)) {
      onNavigate(tab)
    } else {
      Alert.alert('Permission Denied', `You do not have permission to access the ${tab} module.`)
    }
  }, [can, onNavigate, onOpenStockIn, onOpenStockAdjustment])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchDashboardData(), fetchMyPerformanceData(myPerfPeriod), fetchRecentOrders()])
  }, [myPerfPeriod, fetchDashboardData, fetchMyPerformanceData, fetchRecentOrders])

  // Filter orders by status chip
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders
    return orders.filter((o) => (o.status || '').toLowerCase() === statusFilter)
  }, [orders, statusFilter])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={tokens.colors.primaryContainer}
          colors={[tokens.colors.primaryContainer]}
        />
      }
    >
      {Boolean(dashboardError && !summary) && (
        <ServerErrorState
          compact
          message={dashboardError}
          onRetry={onRefresh}
          isRetrying={refreshing}
        />
      )}

      {/* 2. Hero Financial Performance Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroSubtitle}>TODAY'S NET REVENUE</Text>
            <Text style={styles.heroAmount}>
              ${(summary?.net_revenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

        {/* Progress vs Daily Target (Customizable for Managers/Admins, View-only for Sellers) */}
        <TouchableOpacity
          style={styles.targetSection}
          disabled={!canEditTarget}
          onPress={() => {
            if (!canEditTarget) return
            setTargetInput(String(dailyTarget))
            setTargetModalOpen(true)
          }}
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

      {/* 2.5. Personal Staff Shift & Earnings Card */}
      {currentUser ? (
        <TouchableOpacity
          style={styles.myShiftCard}
          activeOpacity={0.88}
          onPress={() => setMyPerfModalOpen(true)}
        >
          <View style={styles.myShiftHeader}>
            <View style={styles.myShiftTitleRow}>
              <View style={styles.myShiftIconBox}>
                <Ionicons name="person" size={14} color={tokens.colors.primaryContainer} />
              </View>
              <View>
                <Text style={styles.myShiftGreeting}>
                  Hello, {currentUser.name ? currentUser.name.split(' ')[0] : 'Staff'} 👋
                </Text>
                <Text style={styles.myShiftSubtitle}>
                  {myPerfPeriod === 'today' ? "Today's Shift" : myPerfPeriod === '7d' ? 'Last 7 Days' : 'This Month'} • Sales, Orders & Commission
                </Text>
              </View>
            </View>
            <View style={styles.myShiftBadge}>
              <Text style={styles.myShiftBadgeText}>My Earnings</Text>
              <Ionicons name="chevron-forward" size={12} color={tokens.colors.primaryContainer} />
            </View>
          </View>

          {/* Quick Period Selector */}
          <View style={styles.perfPeriodRow}>
            {(
              [
                { key: 'today', label: 'Today' },
                { key: '7d', label: '7 Days' },
                { key: 'month', label: 'This Month' },
              ] as const
            ).map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.perfPeriodChip, myPerfPeriod === p.key && styles.perfPeriodChipActive]}
                onPress={(e) => {
                  e.stopPropagation?.()
                  setMyPerfPeriod(p.key)
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.perfPeriodChipText,
                    myPerfPeriod === p.key && styles.perfPeriodChipTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.myShiftMetricsRow}>
            <View style={styles.myShiftMetricCol}>
              <Text style={styles.myShiftMetricLabel}>MY SALES</Text>
              <Text style={styles.myShiftMetricValue}>
                ${myPerformance ? (myPerformance.summary?.total_revenue ?? myPerformance.total_revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </Text>
            </View>
            <View style={styles.myShiftMetricDivider} />
            <View style={styles.myShiftMetricCol}>
              <Text style={styles.myShiftMetricLabel}>ORDERS</Text>
              <Text style={styles.myShiftMetricValue}>
                {myPerformance ? (myPerformance.summary?.total_orders ?? myPerformance.total_orders ?? 0) : 0}
              </Text>
            </View>
            <View style={styles.myShiftMetricDivider} />
            <View style={styles.myShiftMetricCol}>
              <Text style={styles.myShiftMetricLabel}>MY COMMISSION</Text>
              <Text style={[styles.myShiftMetricValue, { color: tokens.colors.statusSuccess }]}>
                +${myPerformance ? (myPerformance.summary?.total_incentive ?? myPerformance.total_incentive ?? 0).toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Low-Stock Attention Alert Strip (if any SKUs are low) */}
      {Boolean((summary?.low_stock_skus ?? 0) > 0) && (
        <TouchableOpacity
          style={styles.lowStockBanner}
          onPress={handleLowStockPress}
          activeOpacity={0.85}
        >
          <View style={styles.lowStockBannerLeft}>
            <View style={styles.lowStockBannerIconCircle}>
              <Ionicons name="warning" size={14} color="#E11D48" />
            </View>
            <Text style={styles.lowStockBannerText}>
              <Text style={{ fontWeight: '800', color: '#9F1239' }}>
                {`${summary?.low_stock_skus ?? 0} ${summary?.low_stock_skus === 1 ? 'item is' : 'items are'}`}
              </Text>
              {' low on stock'}
            </Text>
          </View>
          <View style={styles.lowStockBannerBtn}>
            <Text style={styles.lowStockBannerBtnText}>
              {can('inventory:restock') ? 'Restock' : can('products:read') ? 'View' : 'Details'}
            </Text>
            <Ionicons name="arrow-forward" size={12} color="#E11D48" />
          </View>
        </TouchableOpacity>
      )}

      {/* 3. Redesigned KPI Glanceability Row */}
      <View style={styles.metricRow}>
        {/* Card 1: Units Sold */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel}>UNITS SOLD</Text>
            <View style={[styles.metricIconCircle, { backgroundColor: '#CCFBF1' }]}>
              <Ionicons name="cube" size={13} color="#0D9488" />
            </View>
          </View>
          <Text style={styles.metricValue}>{summary?.units_sold ?? 0}</Text>
          <Text style={styles.metricMeta}>Sold today</Text>
        </View>

        {/* Card 2: Low Stock */}
        <TouchableOpacity
          style={[styles.metricCard, (summary?.low_stock_skus ?? 0) > 0 && styles.metricCardWarning]}
          onPress={handleLowStockPress}
          activeOpacity={0.8}
        >
          <View style={styles.metricHeader}>
            <Text style={[(summary?.low_stock_skus ?? 0) > 0 ? styles.metricLabelWarning : styles.metricLabel]}>
              LOW STOCK
            </Text>
            <View style={[styles.metricIconCircle, { backgroundColor: '#FFE4E6' }]}>
              <Ionicons name="alert-circle" size={13} color="#E11D48" />
            </View>
          </View>
          <Text style={[(summary?.low_stock_skus ?? 0) > 0 ? styles.metricValueWarning : styles.metricValue]}>
            {`${summary?.low_stock_skus ?? 0} SKUs`}
          </Text>
          <View style={styles.metricActionRow}>
            <Text style={styles.metricActionText}>
              {can('inventory:restock') ? 'Restock' : can('products:read') ? 'View' : 'Details'}
            </Text>
            <Ionicons name="arrow-forward" size={11} color="#E11D48" />
          </View>
        </TouchableOpacity>

        {/* Card 3: Avg / Sale */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel}>AVG / SALE</Text>
            <View style={[styles.metricIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="card" size={13} color="#7C3AED" />
            </View>
          </View>
          <Text style={styles.metricValue}>
            ${(summary?.avg_basket_value ?? 0).toFixed(2)}
          </Text>
          <Text style={styles.metricMeta}>Per order</Text>
        </View>
      </View>

      {/* 5. Quick Operations Grid */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Quick Operations</Text>
          <Text style={styles.sectionSubtitle}>Fast register & warehouse actions</Text>
        </View>
      </View>

      <View style={styles.actionGridContainer}>
        {/* Primary Hero Action Card: New Sale */}
        <SpringScaleCard
          testID="btn-quick-new-sale"
          style={styles.actionCardPrimaryHero}
          touchStyle={styles.actionCardPrimaryHeroTouch}
          onPress={() => onNavigate('pos')}
          activeOpacity={0.92}
          accessibilityLabel="New Sale POS Terminal"
        >
          <View style={styles.actionCardPrimaryTop}>
            <View style={styles.actionIconWrapPrimary}>
              <Ionicons name="cart" size={22} color={tokens.colors.onPrimary} />
            </View>
            <View style={styles.actionPrimaryLiveBadge}>
              <View style={styles.actionPrimaryLiveDot} />
              <Text style={styles.actionPrimaryLiveText}>READY</Text>
            </View>
          </View>
          <View style={styles.actionCardPrimaryBottom}>
            <Text style={styles.actionTitlePrimary}>New Sale</Text>
            <Text style={styles.actionSubPrimary}>Open POS register</Text>
          </View>
          <View style={styles.actionPrimaryArrowCircle}>
            <Ionicons name="arrow-forward" size={13} color={tokens.colors.primaryContainer} />
          </View>
        </SpringScaleCard>

        {/* Secondary Column: Stock In & Stock Adjustment */}
        <View style={styles.actionSecondaryColumn}>
          {/* Stock In */}
          <SpringScaleCard
            testID="btn-quick-stock-in"
            style={styles.actionCardSecondary}
            touchStyle={styles.actionCardSecondaryTouch}
            onPress={handleQuickStockIn}
            activeOpacity={0.88}
            accessibilityLabel="Stock In Receive Goods"
          >
            <View style={[styles.actionIconWrapSecondary, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="download-outline" size={18} color="#B45309" />
            </View>
            <View style={styles.actionSecondaryInfo}>
              <Text style={styles.actionTitleSecondary}>Stock In</Text>
              <Text style={styles.actionSubSecondary} numberOfLines={1}>Receive goods & POs</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondaryFixedDim} />
          </SpringScaleCard>

          {/* Stock Adjustment */}
          <SpringScaleCard
            testID="btn-quick-stock-adj"
            style={styles.actionCardSecondary}
            touchStyle={styles.actionCardSecondaryTouch}
            onPress={handleQuickStockAdj}
            activeOpacity={0.88}
            accessibilityLabel="Adjust Stock Audit Counts"
          >
            <View style={[styles.actionIconWrapSecondary, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="options-outline" size={18} color="#0284C7" />
            </View>
            <View style={styles.actionSecondaryInfo}>
              <Text style={styles.actionTitleSecondary}>Adjust Stock</Text>
              <Text style={styles.actionSubSecondary} numberOfLines={1}>Audit counts & damage</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={tokens.colors.secondaryFixedDim} />
          </SpringScaleCard>
        </View>
      </View>

      {/* 6. Feature Modules Grid */}
      {visibleModules.length > 0 && (
        <>
          <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>Management Modules</Text>
          </View>

          <View style={styles.modulesGrid}>
            {visibleModules.map((m) => (
              <TouchableOpacity
                key={m.tab}
                style={styles.moduleCard}
                onPress={() => onNavigate(m.tab)}
                activeOpacity={0.8}
              >
                <View style={[styles.moduleIcon, { backgroundColor: m.bg }]}>
                  <Ionicons name={m.icon} size={18} color={m.color} />
                </View>
                <Text style={styles.moduleTitle}>{m.title}</Text>
                <Text style={styles.moduleSub}>{m.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* 7. Recent Transactions Feed */}
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
            Completed ({orders.filter((o) => (o.status || '').toLowerCase() === 'completed').length})
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

      {/* Transaction Feed */}
      {loading && !refreshing ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
          <Text style={styles.stateText}>Loading transactions...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={32} color={tokens.colors.secondaryFixedDim} />
          <Text style={styles.emptyTitle}>No matching transactions</Text>
          <Text style={styles.emptySub}>
            No orders recorded in this filter
          </Text>
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

      {/* Daily Target Customizer Modal */}
      <Modal
        visible={targetModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTargetModalOpen(false)}
      >
        <View style={styles.targetModalOverlay}>
          <View style={styles.targetModalContent}>
            <View style={styles.targetModalHeader}>
              <View>
                <Text style={styles.targetModalTitle}>Customize Daily Target</Text>
                <Text style={styles.targetModalSub}>Set store revenue goal for today</Text>
              </View>
              <TouchableOpacity onPress={() => setTargetModalOpen(false)}>
                <Ionicons name="close" size={22} color={tokens.colors.secondary} />
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <Text style={styles.targetPresetLabel}>QUICK PRESETS</Text>
            <View style={styles.targetPresetsRow}>
              {[1000, 2500, 5000, 10000].map((amt) => {
                const isSelected = dailyTarget === amt
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.targetPresetChip, isSelected && styles.targetPresetChipActive]}
                    onPress={() => {
                      setTargetInput(String(amt))
                      handleSaveTarget(amt)
                    }}
                  >
                    <Text style={[styles.targetPresetText, isSelected && styles.targetPresetTextActive]}>
                      ${amt.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Custom Input */}
            <Text style={[styles.targetPresetLabel, { marginTop: 12 }]}>CUSTOM TARGET AMOUNT ($)</Text>
            <View style={styles.targetInputRow}>
              <Text style={styles.targetDollarSign}>$</Text>
              <TextInput
                style={styles.targetInputField}
                keyboardType="numeric"
                value={targetInput}
                onChangeText={setTargetInput}
                placeholder="e.g. 3500"
                placeholderTextColor={tokens.colors.secondary}
                selectTextOnFocus
              />
            </View>

            <TouchableOpacity
              style={styles.targetSaveBtn}
              onPress={() => {
                const parsed = parseFloat(targetInput)
                if (!isNaN(parsed) && parsed > 0) {
                  handleSaveTarget(parsed)
                }
              }}
            >
              <Text style={styles.targetSaveBtnText}>Save Target</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Staff Personal Performance & Incentives Sheet */}
      <StaffDetailModal
        visible={myPerfModalOpen}
        user={currentUser || null}
        onClose={() => setMyPerfModalOpen(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  myShiftCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  myShiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  myShiftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  myShiftIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myShiftGreeting: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  myShiftSubtitle: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  myShiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  myShiftBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: tokens.colors.primaryContainer,
  },
  perfPeriodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  perfPeriodChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  perfPeriodChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  perfPeriodChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  perfPeriodChipTextActive: {
    color: '#FFFFFF',
  },
  myShiftMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  myShiftMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  myShiftMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginBottom: 3,
  },
  myShiftMetricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  myShiftMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
  },
  fullTouchWrap: {
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  contentContainer: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 40,
  },
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: tokens.borderRadius.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  lowStockBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lowStockBannerIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowStockBannerText: {
    fontSize: 12,
    color: '#881337',
    flex: 1,
  },
  lowStockBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  lowStockBannerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E11D48',
  },
  targetModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  targetModalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.cardElevated,
  },
  targetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  targetModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  targetModalSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  targetPresetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  targetPresetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  targetPresetChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  targetPresetChipActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  targetPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  targetPresetTextActive: {
    color: tokens.colors.onPrimary,
  },
  targetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  targetDollarSign: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginRight: 6,
  },
  targetInputField: {
    flex: 1,
    height: 42,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  targetSaveBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    alignItems: 'center',
  },
  targetSaveBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  // Hero Financial Performance Card (Matching TransactionsScreen theme)
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.8,
  },
  heroTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 3,
  },
  heroTrendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22C55E',
  },
  targetSection: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  targetLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  targetLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  targetPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FB923C',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 3,
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  heroPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  // Metric Row
  metricRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  metricCardWarning: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFD1D1',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.secondary,
    letterSpacing: 0.5,
  },
  metricLabelWarning: {
    fontSize: 9,
    fontWeight: '700',
    color: '#BA1A1A',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  metricValueWarning: {
    fontSize: 16,
    fontWeight: '800',
    color: '#BA1A1A',
  },
  metricMeta: {
    fontSize: 9,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  metricActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  metricActionText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#BA1A1A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  actionGridContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    height: 128,
  },
  actionCardPrimaryHero: {
    flex: 1.15,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 20,
    height: 128,
    overflow: 'hidden',
    ...tokens.shadows.cardElevated,
  },
  actionCardPrimaryHeroTouch: {
    flex: 1,
    padding: 13,
    justifyContent: 'space-between',
  },
  actionCardPrimaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionIconWrapPrimary: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.pill,
    gap: 4,
  },
  actionPrimaryLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#86EFAC',
  },
  actionPrimaryLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  actionCardPrimaryBottom: {
    marginTop: 6,
  },
  actionTitlePrimary: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onPrimary,
    letterSpacing: -0.2,
  },
  actionSubPrimary: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 1,
    fontWeight: '500',
  },
  actionPrimaryArrowCircle: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.card,
  },
  actionSecondaryColumn: {
    flex: 1.35,
    height: 128,
    justifyContent: 'space-between',
    gap: 8,
  },
  actionCardSecondary: {
    height: 60,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    overflow: 'hidden',
    ...tokens.shadows.card,
  },
  actionCardSecondaryTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  actionIconWrapSecondary: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondaryInfo: {
    flex: 1,
  },
  actionTitleSecondary: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  actionSubSecondary: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  moduleCard: {
    width: '23%',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  moduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  moduleTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    textAlign: 'center',
  },
  moduleSub: {
    fontSize: 8,
    color: tokens.colors.secondary,
    textAlign: 'center',
    marginTop: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  filterPillActive: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primaryContainer,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  filterPillTextActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  transactionsContainer: {
    marginTop: 2,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  orderCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  orderCardCancelled: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    opacity: 0.85,
  },
  payIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  orderMiddle: {
    flex: 1,
    paddingRight: 8,
  },
  orderTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  statusTextSuccess: {
    color: '#16A34A',
  },
  statusTextPending: {
    color: '#B45309',
  },
  statusTextCancelled: {
    color: '#DC2626',
  },
  customerName: {
    fontSize: 11,
    color: tokens.colors.onBackground,
    fontWeight: '600',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 10,
    color: tokens.colors.secondary,
  },
  channelText: {
    fontSize: 10,
    color: tokens.colors.textMuted,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  payMethodBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  payMethodBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  stateContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  stateText: {
    fontSize: 12,
    color: tokens.colors.secondary,
  },
  emptyContainer: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  emptySub: {
    fontSize: 11,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
})

export default HomeScreen
