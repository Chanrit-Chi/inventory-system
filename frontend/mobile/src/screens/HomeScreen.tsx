import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useIsFocused } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { getOrders, getDashboardSummary, fetchMyPerformance } from '../api/endpoints'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../context/AuthContext'
import { StaffDetailModal } from '../components/StaffDetailModal'
import { SellerDailySummaryModal } from '../components/seller/SellerDailySummaryModal'
import { ServerErrorState } from '../components/ServerErrorState'
import type { Order, TabType, DashboardSummary, StaffPerformance, UserAccount } from '../types'
import { styles } from './home/HomeScreen.styles'
import { HeroFinancialCard } from './home/components/HeroFinancialCard'
import { PersonalShiftCard } from './home/components/PersonalShiftCard'
import { LowStockBanner } from './home/components/LowStockBanner'
import { MetricGlanceRow } from './home/components/MetricGlanceRow'
import { QuickOperationsGrid } from './home/components/QuickOperationsGrid'
import { ManagementModulesGrid, ModuleItem } from './home/components/ManagementModulesGrid'
import { RecentTransactionsFeed } from './home/components/RecentTransactionsFeed'
import { DailyTargetModal } from './home/components/DailyTargetModal'

export interface HomeScreenProps {
  onNavigate: (tab: TabType) => void
  onOpenStockIn?: () => void
  onOpenStockAdjustment?: () => void
  onSelectOrder?: (order: Order) => void
  storeName?: string
  staffName?: string
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenStockIn,
  onOpenStockAdjustment,
  onSelectOrder,
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
  const [dailySettlementModalOpen, setDailySettlementModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const canEditTarget = useMemo(() => {
    return (
      currentUser?.role !== 'SELLER' &&
      (can('reports:view') ||
        can('settings:*') ||
        currentUser?.role === 'ADMIN' ||
        currentUser?.role === 'SUPER_ADMIN' ||
        currentUser?.role === 'MANAGER')
    )
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
  const allModules: ModuleItem[] = [
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not connect to backend to load dashboard summary.'
      setDashboardError(message)
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchDashboardData(), fetchMyPerformanceData(myPerfPeriod), fetchRecentOrders()])
  }, [myPerfPeriod, fetchDashboardData, fetchMyPerformanceData, fetchRecentOrders])

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

      {/* Hero Financial Performance Card */}
      <HeroFinancialCard
        summary={summary}
        dailyTarget={dailyTarget}
        targetProgress={targetProgress}
        canEditTarget={canEditTarget}
        onOpenTargetModal={() => {
          setTargetInput(String(dailyTarget))
          setTargetModalOpen(true)
        }}
      />

      {/* Personal Staff Shift & Earnings Card */}
      <PersonalShiftCard
        currentUser={currentUser}
        myPerformance={myPerformance}
        myPerfPeriod={myPerfPeriod}
        setMyPerfPeriod={setMyPerfPeriod}
        onOpenMyPerfModal={() => setMyPerfModalOpen(true)}
        onOpenDailySettlement={() => setDailySettlementModalOpen(true)}
      />

      {/* Low-Stock Attention Alert Strip */}
      <LowStockBanner
        lowStockSkus={summary?.low_stock_skus ?? 0}
        canRestock={Boolean(can('inventory:restock'))}
        canReadProducts={Boolean(can('products:read'))}
        onPress={handleLowStockPress}
      />

      {/* Redesigned KPI Glanceability Row */}
      <MetricGlanceRow
        summary={summary}
        canRestock={Boolean(can('inventory:restock'))}
        canReadProducts={Boolean(can('products:read'))}
        onLowStockPress={handleLowStockPress}
      />

      {/* Quick Operations Grid */}
      <QuickOperationsGrid
        onNavigate={onNavigate}
        onQuickStockIn={handleQuickStockIn}
        onQuickStockAdj={handleQuickStockAdj}
      />

      {/* Feature Modules Grid */}
      <ManagementModulesGrid
        visibleModules={visibleModules}
        onNavigate={onNavigate}
      />

      {/* Recent Transactions Feed */}
      <RecentTransactionsFeed
        orders={orders}
        filteredOrders={filteredOrders}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        loading={loading}
        refreshing={refreshing}
        onNavigate={onNavigate}
        onSelectOrder={onSelectOrder}
      />

      {/* Daily Target Customizer Modal */}
      <DailyTargetModal
        visible={targetModalOpen}
        dailyTarget={dailyTarget}
        targetInput={targetInput}
        setTargetInput={setTargetInput}
        onClose={() => setTargetModalOpen(false)}
        onSaveTarget={handleSaveTarget}
      />

      {/* Staff Personal Performance & Incentives Sheet */}
      <StaffDetailModal
        visible={myPerfModalOpen}
        user={currentUser || null}
        onClose={() => setMyPerfModalOpen(false)}
      />

      {/* Seller End-of-Day Reconciliation & Settlement Modal */}
      <SellerDailySummaryModal
        visible={dailySettlementModalOpen}
        onClose={() => {
          setDailySettlementModalOpen(false)
          // Refresh performance stats
          fetchMyPerformance({ period: myPerfPeriod })
            .then((res) => {
              if (res?.data) setMyPerformance(res.data)
            })
            .catch(() => null)
        }}
        currentUser={currentUser || null}
      />
    </ScrollView>
  )
}

export default HomeScreen
