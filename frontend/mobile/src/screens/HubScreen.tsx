import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useIsFocused } from '@react-navigation/native'
import { tokens } from '../theme/tokens'
import type { TabType, UserAccount, StaffPerformance } from '../types'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { getFeatureNewBadge } from '../utils/featureFlags'
import { fetchMyPerformance } from '../api/endpoints'
import { StaffDetailModal } from '../components/StaffDetailModal'
import { StaffPerformanceCard } from '../components/StaffPerformanceCard'

export interface HubScreenProps {
  currentUser: UserAccount
  onSelectTab: (tab: TabType) => void
  onOpenAuth: () => void
  onOpenStockIn?: () => void
  onOpenStockAdjustment?: () => void
  onOpenPurchaseOrder?: (opts?: { mode?: 'list' | 'create'; supplierId?: string }) => void
  onOpenPurchaseOrders?: () => void
}

interface NavItem {
  tab?: TabType
  action?: 'stock-in' | 'stock-adjust' | 'purchase-orders'
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  badge?: string
  permission?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

export const HubScreen: React.FC<HubScreenProps> = ({
  currentUser,
  onSelectTab,
  onOpenAuth,
  onOpenStockIn,
  onOpenStockAdjustment,
  onOpenPurchaseOrder,
  onOpenPurchaseOrders,
}) => {
  const { logout } = useAuth()
  const isFocused = useIsFocused()
  const { can, canAccessTab } = usePermissions()
  const [loggingOut, setLoggingOut] = useState(false)
  const [myPerfPeriod, setMyPerfPeriod] = useState<'today' | '7d' | 'month'>('today')
  const [myPerfData, setMyPerfData] = useState<StaffPerformance | null>(null)
  const [perfModalVisible, setPerfModalVisible] = useState(false)

  const loadPersonalPerf = useCallback(async (period: 'today' | '7d' | 'month' = myPerfPeriod) => {
    try {
      const res = await fetchMyPerformance({ period })
      if (res && res.data) {
        setMyPerfData(res.data)
      }
    } catch {
      // Graceful fallback
    }
  }, [myPerfPeriod])

  useEffect(() => {
    if (isFocused) {
      loadPersonalPerf(myPerfPeriod)
    }
  }, [isFocused, myPerfPeriod, loadPersonalPerf])

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true)
            try {
              await logout()
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Logout failed'
              Alert.alert('Logout Error', msg)
            } finally {
              setLoggingOut(false)
            }
          },
        },
      ]
    )
  }

  // Feature launch date: 2026-08-23. Badges expire automatically after 7 days (1 week).
  const newBadge = getFeatureNewBadge('2026-08-23', 7)

  const sections: NavSection[] = [
    {
      title: 'Sales & POS',
      items: [
        { tab: 'pos', label: 'Sales Register', icon: 'cart', color: tokens.colors.primaryContainer },
        { tab: 'sales-channels', label: 'Sales Channels', icon: 'share-social', color: '#8B5CF6', badge: newBadge },
        { tab: 'quotations', label: 'Quotations', icon: 'document-text', color: '#0284C7' },
        { tab: 'invoices', label: 'Invoices & Billing', icon: 'receipt', color: '#10B981' },
        { tab: 'transactions', label: 'Order History', icon: 'time', color: '#64748B' },
      ],
    },
    {
      title: 'Inventory & Supplies',
      items: [
        { tab: 'products', label: 'Product Catalog', icon: 'cube', color: '#F59E0B' },
        { action: 'purchase-orders', label: 'Purchase Orders', icon: 'document-attach', color: '#0284C7', permission: 'purchase-orders:create' },
        { action: 'stock-in', label: 'Stock In / Intake', icon: 'arrow-down-circle', color: '#10B981', permission: 'inventory:restock' },
        { action: 'stock-adjust', label: 'Adjust Stock', icon: 'options', color: '#D97706', permission: 'inventory:adjust' },
        { tab: 'categories', label: 'Categories & Attributes', icon: 'pricetags', color: '#EA580C' },
        { tab: 'suppliers', label: 'Suppliers & Vendors', icon: 'briefcase', color: '#84CC16', badge: newBadge },
      ],
    },
    {
      title: 'CRM & Accounting',
      items: [
        { tab: 'customers', label: 'Customer CRM', icon: 'people', color: '#8B5CF6' },
        { tab: 'expenses', label: 'Expense Tracker', icon: 'cash', color: '#EF4444' },
        { tab: 'bank-accounts', label: 'Bank & QR Accounts', icon: 'business', color: '#0D3880', badge: newBadge },
        { tab: 'delivery-companies', label: 'Delivery Companies', icon: 'car', color: '#DC2626', badge: newBadge },
        { tab: 'delivery-zones', label: 'Delivery Zones', icon: 'map', color: '#10B981', badge: newBadge },
        { tab: 'reports', label: 'Reports & Analytics', icon: 'bar-chart', color: '#06B6D4' },
      ],
    },
    {
      title: 'Administration',
      items: [
        { tab: 'admin', label: 'Staff & Permissions', icon: 'shield-checkmark', color: '#6366F1' },
        { tab: 'payroll', label: 'Staff Payroll', icon: 'cash', color: '#10B981', badge: newBadge },
        { tab: 'roles', label: 'Role Permissions', icon: 'key', color: '#8B5CF6', badge: 'Super Admin' },
        { tab: 'settings', label: 'App Settings', icon: 'settings', color: '#475569' },
      ],
    },
  ]

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { bg: '#EDE9FE', text: '#5B21B6' }
      case 'ADMIN':
        return { bg: '#E0F2FE', text: '#0369A1' }
      case 'MANAGER':
        return { bg: '#FEF3C7', text: '#B45309' }
      default:
        return { bg: '#E6F4EA', text: '#15803D' }
    }
  }

  const roleBadge = getRoleBadgeColor(currentUser.role)

  return (
    <View style={styles.container}>
      {/* Top Header Title */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Management Hub</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Account Section */}
        <TouchableOpacity style={styles.userSection} onPress={onOpenAuth} activeOpacity={0.7}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.userInitials}>
                {currentUser.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{currentUser.name}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
                <Ionicons name="shield-checkmark" size={12} color={roleBadge.text} style={styles.roleIcon} />
                <Text style={[styles.roleText, { color: roleBadge.text }]}>
                  {currentUser.role.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={tokens.colors.outline} />
        </TouchableOpacity>

        {/* My Personal Performance & Commissions Card */}
        <TouchableOpacity
          style={styles.myPerfCard}
          activeOpacity={0.88}
          onPress={() => setPerfModalVisible(true)}
        >
          <View style={styles.myPerfHeader}>
            <View style={styles.myPerfTitleRow}>
              <View style={styles.myPerfIconBox}>
                <Ionicons name="stats-chart" size={14} color={tokens.colors.primaryContainer} />
              </View>
              <View>
                <Text style={styles.myPerfTitle}>My Performance & Earnings</Text>
                <Text style={styles.myPerfSubtitle}>
                  {myPerfPeriod === 'today' ? "Today's Shift" : myPerfPeriod === '7d' ? 'Last 7 Days' : 'This Month'} • Sales, Orders & Commission
                </Text>
              </View>
            </View>
            <View style={styles.myPerfActionBtn}>
              <Text style={styles.myPerfActionBtnText}>Full Details</Text>
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

          <View style={styles.myPerfMetricsRow}>
            <View style={styles.myPerfMetricCol}>
              <Text style={styles.myPerfMetricLabel}>SALES REVENUE</Text>
              <Text style={styles.myPerfMetricValue}>
                ${myPerfData ? (myPerfData.summary?.total_revenue ?? myPerfData.total_revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </Text>
            </View>
            <View style={styles.myPerfMetricDivider} />
            <View style={styles.myPerfMetricCol}>
              <Text style={styles.myPerfMetricLabel}>ORDERS</Text>
              <Text style={styles.myPerfMetricValue}>
                {myPerfData ? (myPerfData.summary?.total_orders ?? myPerfData.total_orders ?? 0) : 0}
              </Text>
            </View>
            <View style={styles.myPerfMetricDivider} />
            <View style={styles.myPerfMetricCol}>
              <Text style={styles.myPerfMetricLabel}>COMMISSION</Text>
              <Text style={[styles.myPerfMetricValue, { color: tokens.colors.statusSuccess }]}>
                +${myPerfData ? (myPerfData.summary?.total_incentive ?? myPerfData.total_incentive ?? 0).toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Navigation Sections */}
        {sections.map((section, idx) => {
          const visibleItems = section.items.filter((item) => {
            if (item.action === 'stock-in') return can('inventory:restock')
            if (item.action === 'stock-adjust') return can('inventory:adjust')
            if (item.action === 'purchase-orders') return can('purchase-orders:create') || can('purchase-orders:*') || can('suppliers:view') || can('suppliers:manage')
            if (item.permission) return can(item.permission)
            if (item.tab) return canAccessTab(item.tab)
            return true
          })

          if (visibleItems.length === 0) return null

          return (
            <View key={idx} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.grid}>
                {visibleItems.map((item, itemIdx) => (
                  <TouchableOpacity
                    key={item.tab || item.action || `hub-item-${itemIdx}`}
                    style={styles.gridItem}
                    onPress={() => {
                      if (item.action === 'stock-in') {
                        if (onOpenStockIn) onOpenStockIn()
                      } else if (item.action === 'stock-adjust') {
                        if (onOpenStockAdjustment) onOpenStockAdjustment()
                      } else if (item.action === 'purchase-orders') {
                        if (onOpenPurchaseOrder) {
                          onOpenPurchaseOrder({ mode: 'list' })
                        } else if (onOpenPurchaseOrders) {
                          onOpenPurchaseOrders()
                        }
                      } else if (item.tab) {
                        onSelectTab(item.tab)
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                      <Ionicons name={item.icon} size={28} color={item.color} />
                      {Boolean(item.badge) && (
                        <View style={styles.badgeContainer}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemLabel} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )
        })}

        {/* Session / Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            testID="btn-hub-logout"
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.85}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color={tokens.colors.onPrimary} />
                <Text style={styles.logoutButtonText}>Sign Out / Logout</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom padding to account for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Staff Personal Performance & Incentives Sheet */}
      <StaffDetailModal
        visible={perfModalVisible}
        user={currentUser}
        onClose={() => setPerfModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xs,
    backgroundColor: tokens.colors.background,
  },
  headerTitle: {
    ...tokens.typography.titleLarge,
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.onSurface,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.lg,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
    marginBottom: tokens.spacing.xs,
    ...tokens.shadows.card,
  },
  myPerfCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 14,
    marginTop: 8,
    marginBottom: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  myPerfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  myPerfTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  myPerfIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPerfTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  myPerfSubtitle: {
    fontSize: 10.5,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  myPerfActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  myPerfActionBtnText: {
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
  myPerfMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  myPerfMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  myPerfMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: tokens.colors.secondary,
    marginBottom: 3,
  },
  myPerfMetricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: tokens.colors.onBackground,
  },
  myPerfMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.md,
  },
  userInitials: {
    ...tokens.typography.title,
    color: tokens.colors.onPrimaryContainer,
  },
  userDetails: {
    justifyContent: 'center',
  },
  userName: {
    ...tokens.typography.bodyLarge,
    color: tokens.colors.onSurface,
    marginBottom: 4,
    fontWeight: '600',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleIcon: {
    marginRight: 4,
  },
  roleText: {
    ...tokens.typography.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.surfaceAlt,
    marginVertical: tokens.spacing.sm,
  },
  section: {
    marginBottom: tokens.spacing.lg,
  },
  sectionTitle: {
    ...tokens.typography.labelCaps,
    color: tokens.colors.outline,
    marginBottom: tokens.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -tokens.spacing.xs,
  },
  gridItem: {
    width: '33.33%',
    padding: tokens.spacing.xs,
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: tokens.colors.statusError,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: tokens.colors.background,
  },
  badgeText: {
    color: tokens.colors.textInverse,
    fontSize: 9,
    fontWeight: 'bold',
  },
  itemLabel: {
    ...tokens.typography.caption,
    color: tokens.colors.onSurface,
    textAlign: 'center',
    lineHeight: 16,
  },
  bottomSpacer: {
    height: 80, // Space for BottomTabBar
  },
  logoutSection: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.statusError,
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    gap: 8,
    ...tokens.shadows.card,
  },
  logoutButtonText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
})

export default HubScreen
