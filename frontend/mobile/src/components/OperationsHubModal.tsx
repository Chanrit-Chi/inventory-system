import React from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { TabType, UserRole } from '../types'

export interface OperationsHubModalProps {
  visible: boolean
  activeTab: TabType
  currentUserRole: UserRole
  onClose: () => void
  onSelectTab: (tab: TabType) => void
  onOpenAuth: () => void
}

interface HubItem {
  tab: TabType
  title: string
  subtitle: string
  icon: keyof typeof Ionicons.glyphMap
  badge?: string
  minRole?: UserRole
  color?: string
}

export const OperationsHubModal: React.FC<OperationsHubModalProps> = ({
  visible,
  activeTab,
  currentUserRole,
  onClose,
  onSelectTab,
  onOpenAuth,
}) => {
  const hubItems: HubItem[] = [
    {
      tab: 'home',
      title: 'Dashboard Overview',
      subtitle: 'KPIs, live sales channel, and shift stats',
      icon: 'home',
      color: tokens.colors.primaryContainer,
    },
    {
      tab: 'pos',
      title: 'POS Register',
      subtitle: 'Express barcode scanning & multi-pay checkout',
      icon: 'cart',
      color: tokens.colors.primaryContainer,
    },
    {
      tab: 'quotations',
      title: 'Quotations & B2B Estimates',
      subtitle: 'Create quotes and convert to active sales',
      icon: 'document-text',
      color: '#0284C7',
    },
    {
      tab: 'invoices',
      title: 'Invoices & Balances',
      subtitle: 'Track paid/partial status and record payments',
      icon: 'receipt',
      color: '#10B981',
    },
    {
      tab: 'products',
      title: 'Inventory & Products',
      subtitle: 'Catalog, stock movements log, POs & suppliers',
      icon: 'cube',
      color: '#F59E0B',
    },
    {
      tab: 'customers',
      title: 'Customer Directory & CRM',
      subtitle: 'Client profiles, lifetime spending & history',
      icon: 'people',
      color: '#8B5CF6',
    },
    {
      tab: 'expenses',
      title: 'Expense Tracker',
      subtitle: 'Store expenses, utilities, rent & receipts',
      icon: 'cash',
      color: '#EF4444',
    },
    {
      tab: 'reports',
      title: 'Reports & Analytics',
      subtitle: 'Financial profit trends, chart metrics & export',
      icon: 'bar-chart',
      color: '#06B6D4',
    },
    {
      tab: 'admin',
      title: 'Staff & Team Management',
      subtitle: 'Staff profiles, performance KPIs & raises',
      icon: 'shield-checkmark',
      color: '#6366F1',
    },
    {
      tab: 'payroll',
      title: 'Staff Payroll & Compensation',
      subtitle: 'Monthly payroll generator & 13th month bonus',
      icon: 'cash',
      color: '#10B981',
    },
    {
      tab: 'transactions',
      title: 'Order History',
      subtitle: 'Past sales ledger & transaction receipts',
      icon: 'time',
      color: '#64748B',
    },
    {
      tab: 'settings',
      title: 'App Settings & Diagnostics',
      subtitle: 'Hardware tests, API URL & preferences',
      icon: 'settings',
      color: '#475569',
    },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Operations Hub</Text>
              <Text style={styles.headerSubtitle}>Omnichannel POS & Inventory Suite</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color={tokens.colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Role Status Bar */}
          <TouchableOpacity
            style={styles.roleBar}
            onPress={() => {
              onClose()
              onOpenAuth()
            }}
            activeOpacity={0.8}
          >
            <View style={styles.roleBarLeft}>
              <Ionicons name="person-circle" size={24} color={tokens.colors.primaryContainer} />
              <View>
                <Text style={styles.roleBarText}>Active Role: {currentUserRole}</Text>
                <Text style={styles.roleBarSub}>Tap to switch role or edit profile</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tokens.colors.secondary} />
          </TouchableOpacity>

          {/* Hub Grid / List */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.itemsList}>
              {hubItems.map((item) => {
                const isActive = activeTab === item.tab

                return (
                  <TouchableOpacity
                    key={item.tab}
                    style={[styles.hubItem, isActive && styles.hubItemActive]}
                    onPress={() => {
                      onSelectTab(item.tab)
                      onClose()
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, { backgroundColor: item.color || tokens.colors.primaryContainer }]}>
                      <Ionicons name={item.icon} size={20} color={tokens.colors.onPrimary} />
                    </View>
                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                    </View>
                    {isActive ? (
                      <Ionicons name="checkmark-circle" size={20} color={tokens.colors.primaryContainer} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={tokens.colors.secondary} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    maxHeight: '90%',
    paddingBottom: tokens.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  headerTitle: {
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  headerSubtitle: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  roleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.actionPrimaryBg,
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    padding: 10,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  roleBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBarText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  roleBarSub: {
    fontSize: 11,
    color: tokens.colors.secondary,
  },
  content: {
    padding: tokens.spacing.md,
  },
  itemsList: {
    gap: 8,
    paddingBottom: 24,
  },
  hubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  hubItemActive: {
    borderColor: tokens.colors.primaryContainer,
    backgroundColor: tokens.colors.actionPrimaryBg,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  itemSubtitle: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
})

export default OperationsHubModal
