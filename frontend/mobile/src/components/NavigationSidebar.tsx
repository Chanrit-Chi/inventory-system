import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import type { TabType, UserAccount } from '../types'
import { getFeatureNewBadge } from '../utils/featureFlags'

export interface NavigationSidebarProps {
  visible: boolean
  activeTab: TabType
  currentUser: UserAccount
  onClose: () => void
  onSelectTab: (tab: TabType) => void
  onOpenAuth: () => void
}

interface NavItem {
  tab: TabType
  label: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  visible,
  activeTab,
  currentUser,
  onClose,
  onSelectTab,
  onOpenAuth,
}) => {
  const { canAccessTab } = usePermissions()
  const { logout } = useAuth()
  const { branding } = useBranding()
  const [loggingOut, setLoggingOut] = useState(false)

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
              onClose()
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
        { tab: 'products', label: 'Product Catalog & POs', icon: 'cube', color: '#F59E0B' },
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop dismiss touchable */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Slide-out Sidebar Drawer */}
        <SafeAreaView style={styles.drawerContainer} edges={['top', 'left']}>
          {/* Drawer Header with Brand & Close Button */}
          <View style={styles.drawerHeader}>
            <View style={styles.brandRow}>
              {branding.logo_url ? (
                <Image
                  source={{ uri: branding.logo_url }}
                  style={styles.brandLogoImg}
                  contentFit="contain"
                />
              ) : (
                <Image
                  source={require('../../assets/KC SHOP-No BG.png')}
                  style={styles.brandLogoImg}
                  contentFit="contain"
                />
              )}
              <View>
                <Text style={styles.brandTitle}>{branding.store_name || 'KC Inventory'}</Text>
                <Text style={styles.brandSubtitle}>{branding.tagline || 'Omnichannel Suite'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* User Account / Profile Card */}
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => {
              onClose()
              onOpenAuth()
            }}
            activeOpacity={0.8}
          >
            <View style={styles.userAvatar}>
              <Ionicons
                name={currentUser.role === 'SUPER_ADMIN' ? 'shield-checkmark' : 'person'}
                size={20}
                color={tokens.colors.primaryContainer}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.userName} numberOfLines={1}>{currentUser.name}</Text>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
                <Text style={[styles.roleBadgeText, { color: roleBadge.text }]}>{currentUser.role}</Text>
              </View>
            </View>
            <Ionicons name="settings-outline" size={18} color={tokens.colors.secondary} />
          </TouchableOpacity>

          {/* Navigation Items grouped by sections */}
          <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
            {/* Dashboard Home Link */}
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'home' && styles.navItemActive]}
              onPress={() => {
                onSelectTab('home')
                onClose()
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.itemIconBox, activeTab === 'home' && styles.itemIconBoxActive]}>
                <Ionicons
                  name="home"
                  size={18}
                  color={activeTab === 'home' ? tokens.colors.onPrimary : tokens.colors.secondary}
                />
              </View>
              <Text style={[styles.itemLabel, activeTab === 'home' && styles.itemLabelActive]}>
                Dashboard Overview
              </Text>
              {activeTab === 'home' && (
                <View style={styles.activeDot} />
              )}
            </TouchableOpacity>

            {sections.map((sec, secIdx) => {
              const visibleItems = sec.items.filter((item) => canAccessTab(item.tab))
              if (visibleItems.length === 0) return null

              return (
                <View key={secIdx} style={styles.sectionBlock}>
                  <Text style={styles.sectionHeader}>{sec.title}</Text>
                  {visibleItems.map((item) => {
                    const isActive = activeTab === item.tab
                    return (
                      <TouchableOpacity
                        key={item.tab}
                        style={[styles.navItem, isActive && styles.navItemActive]}
                        onPress={() => {
                          onSelectTab(item.tab)
                          onClose()
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.itemIconBox, isActive && styles.itemIconBoxActive]}>
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={isActive ? tokens.colors.onPrimary : item.color || tokens.colors.secondary}
                          />
                        </View>
                        <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>
                          {item.label}
                        </Text>
                        {Boolean(isActive) && <View style={styles.activeDot} />}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )
            })}
          </ScrollView>

          {/* Footer with Account Settings, Logout & App Info */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity
              style={styles.accountBtn}
              onPress={() => {
                onClose()
                onOpenAuth()
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" size={16} color={tokens.colors.secondary} />
              <Text style={styles.accountBtnText}>Account & Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-sidebar-logout"
              style={styles.logoutBtn}
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.85}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={16} color={tokens.colors.onPrimary} />
                  <Text style={styles.logoutBtnText}>Sign Out / Logout</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.versionText}>v1.2.0 • Offline Ready</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(29, 27, 22, 0.6)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '82%',
    maxWidth: 320,
    backgroundColor: tokens.colors.background,
    borderTopRightRadius: tokens.borderRadius.card,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoImg: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  closeBtn: {
    padding: 6,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    marginHorizontal: tokens.spacing.md,
    marginVertical: tokens.spacing.sm,
    padding: 10,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tokens.colors.actionPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  navScroll: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },
  sectionBlock: {
    marginTop: tokens.spacing.md,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.pill,
    marginBottom: 3,
  },
  navItemActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  itemIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    marginRight: 10,
  },
  itemIconBoxActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
    flex: 1,
  },
  itemLabelActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '700',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primaryContainer,
  },
  drawerFooter: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.surfaceCard,
    gap: 6,
  },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    gap: 6,
  },
  accountBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.statusError,
    gap: 6,
    ...tokens.shadows.card,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  versionText: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
})

export default NavigationSidebar

