import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { useAuth } from '../context/AuthContext'
import {
  fetchRoles,
  fetchPermissions,
  updateRolePermissions,
} from '../api/endpoints'
import type { RoleItem, PermissionItem, TabType, UserRole } from '../types'

export interface AdminRolesScreenProps {
  onNavigate: (tab: TabType) => void
}

interface PermissionModuleGroup {
  id: string
  name: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  permissions: PermissionItem[]
}

const DEFAULT_ROLES: RoleItem[] = [
  {
    id: 'role-super-admin',
    name: 'Super Admin',
    slug: 'SUPER_ADMIN',
    description: 'Full unrestricted system-wide administrative access',
    permissions: ['*'],
    users_count: 0,
  },
  {
    id: 'role-admin',
    name: 'Admin',
    slug: 'ADMIN',
    description: 'Operations administrator with broad management access',
    permissions: [
      'products:*',
      'categories:manage',
      'attributes:manage',
      'inventory:*',
      'suppliers:*',
      'purchase-orders:*',
      'pos:*',
      'sales:*',
      'invoices:*',
      'quotations:*',
      'customers:*',
      'delivery:*',
      'payment-methods:*',
      'channels:*',
      'expenses:*',
      'payroll:*',
      'reports:view',
      'reports:export',
      'users:manage',
      'roles:manage',
      'audit:view',
      'settings:*',
    ],
    users_count: 0,
  },
  {
    id: 'role-manager',
    name: 'Manager',
    slug: 'MANAGER',
    description: 'Store manager handling inventory, sales, and daily operations',
    permissions: [
      'products:read',
      'categories:manage',
      'attributes:manage',
      'inventory:adjust',
      'inventory:restock',
      'inventory:scan',
      'suppliers:view',
      'purchase-orders:*',
      'pos:*',
      'sales:*',
      'invoices:*',
      'quotations:*',
      'customers:*',
      'delivery:view',
      'payment-methods:view',
      'channels:view',
      'expenses:*',
      'payroll:view',
      'reports:view',
      'reports:export',
    ],
    users_count: 0,
  },
  {
    id: 'role-seller',
    name: 'Seller',
    slug: 'SELLER',
    description: 'Cashier & floor sales associate with POS and catalog access',
    permissions: [
      'pos:checkout',
      'inventory:scan',
      'quotations:create',
      'invoices:view',
      'invoices:record-payment',
      'customers:view',
      'transactions:view',
      'delivery:view',
    ],
    users_count: 0,
  },
]

const DEFAULT_PERMISSIONS: PermissionItem[] = [
  // Products & Catalog
  { id: 'p-prod-all', slug: 'products:*', name: 'Full Products Management', module: 'products', description: 'Unrestricted access to view, create, edit, and delete products' },
  { id: 'p-prod-read', slug: 'products:read', name: 'View Product Catalog', module: 'products', description: 'Browse products, categories, variants, and pricing' },
  { id: 'p-prod-create', slug: 'products:create', name: 'Create Products & Variants', module: 'products', description: 'Add new product listings and SKU variations' },
  { id: 'p-prod-update', slug: 'products:update', name: 'Edit Product Details', module: 'products', description: 'Modify prices, barcodes, categories, and inventory thresholds' },
  { id: 'p-prod-delete', slug: 'products:delete', name: 'Delete Products', module: 'products', description: 'Permanently remove products and variants from catalog' },
  { id: 'p-cat-manage', slug: 'categories:manage', name: 'Manage Categories', module: 'products', description: 'Organize product hierarchies, categories, and collections' },
  { id: 'p-attr-manage', slug: 'attributes:manage', name: 'Manage Attributes & Units', module: 'products', description: 'Configure product attributes, variants, and measurement units' },

  // Sales & POS
  { id: 'p-sales-all', slug: 'sales:*', name: 'Full Sales & Orders Access', module: 'sales', description: 'Complete management over orders, invoices, and sales channels' },
  { id: 'p-pos-all', slug: 'pos:*', name: 'Full POS Register', module: 'sales', description: 'Access register, barcode scanner, discounts, and payments' },
  { id: 'p-pos-checkout', slug: 'pos:checkout', name: 'Process Checkout', module: 'sales', description: 'Ring up sales, scan items, and collect cash or digital payments' },
  { id: 'p-quote-all', slug: 'quotations:*', name: 'Full Quotations Access', module: 'quotations', description: 'Create, edit, convert, and manage customer price quotes' },
  { id: 'p-quote-create', slug: 'quotations:create', name: 'Create Quotations', module: 'quotations', description: 'Generate price estimates and draft quotes for clients' },
  { id: 'p-trans-view', slug: 'transactions:view', name: 'View Order History', module: 'sales', description: 'Review receipts, historical orders, and transaction details' },

  // Invoices & Billing
  { id: 'p-invc-all', slug: 'invoices:*', name: 'Full Invoices Access', module: 'invoices', description: 'Full access to invoices, billing statements, and payments' },
  { id: 'p-invc-view', slug: 'invoices:view', name: 'View Invoices', module: 'invoices', description: 'View billing invoices, payment statuses, and balances due' },
  { id: 'p-invc-create', slug: 'invoices:create', name: 'Create Invoices', module: 'invoices', description: 'Generate billing invoices from sales orders or quotes' },
  { id: 'p-invc-pay', slug: 'invoices:record-payment', name: 'Record Invoice Payments', module: 'invoices', description: 'Collect customer installments and record payments' },

  // Suppliers & Vendors
  { id: 'p-sup-all', slug: 'suppliers:*', name: 'Full Suppliers Access', module: 'suppliers', description: 'Full access to vendor directory and supplier management' },
  { id: 'p-sup-view', slug: 'suppliers:view', name: 'View Suppliers', module: 'suppliers', description: 'Browse supplier profiles, catalogs, and vendor contacts' },
  { id: 'p-sup-manage', slug: 'suppliers:manage', name: 'Manage Suppliers', module: 'suppliers', description: 'Create, edit, and delete vendor profiles and terms' },
  { id: 'p-po-all', slug: 'purchase-orders:*', name: 'Full Purchase Orders Access', module: 'suppliers', description: 'Full access to procurement purchase orders' },
  { id: 'p-po-create', slug: 'purchase-orders:create', name: 'Create Purchase Orders', module: 'suppliers', description: 'Draft and issue procurement purchase orders to suppliers' },

  // Inventory & Stock Control
  { id: 'p-inv-all', slug: 'inventory:*', name: 'Full Inventory Control', module: 'inventory', description: 'Full access to stock counts, adjustments, and purchase receiving' },
  { id: 'p-inv-adjust', slug: 'inventory:adjust', name: 'Stock Adjustments', module: 'inventory', description: 'Record shrinkage, damage, and audit count variances' },
  { id: 'p-inv-restock', slug: 'inventory:restock', name: 'Stock Intake & Receiving', module: 'inventory', description: 'Receive vendor shipments and log restock purchase batches' },
  { id: 'p-inv-scan', slug: 'inventory:scan', name: 'Barcode & SKU Scanning', module: 'inventory', description: 'Use camera scanner for fast product lookup and validation' },

  // CRM & Customers
  { id: 'p-cust-all', slug: 'customers:*', name: 'Full Customer CRM', module: 'customers', description: 'Create, view, update, and manage customer profiles' },
  { id: 'p-cust-view', slug: 'customers:view', name: 'View Customer Directory', module: 'customers', description: 'Browse customer list, loyalty tiers, and purchase histories' },
  { id: 'p-cust-manage', slug: 'customers:manage', name: 'Manage Customers', module: 'customers', description: 'Add new customers and update contact or delivery info' },

  // Logistics & Delivery
  { id: 'p-del-all', slug: 'delivery:*', name: 'Full Delivery Management', module: 'delivery', description: 'Full access to delivery companies, shipping zones, and rates' },
  { id: 'p-del-view', slug: 'delivery:view', name: 'View Delivery Options', module: 'delivery', description: 'Browse delivery companies, zones, and dispatch methods' },
  { id: 'p-del-manage', slug: 'delivery:manage', name: 'Manage Delivery Setup', module: 'delivery', description: 'Configure delivery partners, fee structures, and service zones' },

  // Bank Accounts & Payment Methods
  { id: 'p-pay-all', slug: 'payment-methods:*', name: 'Full Payment Methods Access', module: 'finance', description: 'Full access to bank accounts and payment gateway methods' },
  { id: 'p-pay-view', slug: 'payment-methods:view', name: 'View Payment Methods', module: 'finance', description: 'View bank accounts, QR payment configs, and cash drawers' },
  { id: 'p-pay-manage', slug: 'payment-methods:manage', name: 'Manage Payment Methods', module: 'finance', description: 'Configure bank accounts, ABA QR, and payment terminals' },

  // Sales Channels (Omnichannel)
  { id: 'p-chan-all', slug: 'channels:*', name: 'Full Sales Channels Access', module: 'channels', description: 'Full access to manage omnichannel sales integrations' },
  { id: 'p-chan-view', slug: 'channels:view', name: 'View Sales Channels', module: 'channels', description: 'View active sales channels and integration statuses' },
  { id: 'p-chan-manage', slug: 'channels:manage', name: 'Manage Sales Channels', module: 'channels', description: 'Create, configure, and sync sales channel integrations' },

  // Finance & Expenses
  { id: 'p-exp-all', slug: 'expenses:*', name: 'Full Expenses Management', module: 'expenses', description: 'Track business spend, approve receipts, and manage categories' },
  { id: 'p-exp-view', slug: 'expenses:view', name: 'View Expense Ledgers', module: 'expenses', description: 'Review operational costs and daily expense summaries' },
  { id: 'p-exp-manage', slug: 'expenses:manage', name: 'Record & Edit Expenses', module: 'expenses', description: 'Log new company expenses and attach payment details' },

  // Staff Payroll & Compensation
  { id: 'p-payr-all', slug: 'payroll:*', name: 'Full Staff Payroll Access', module: 'payroll', description: 'Full access to view, generate, finalize, and pay staff payroll & reserves' },
  { id: 'p-payr-view', slug: 'payroll:view', name: 'View Staff Payroll', module: 'payroll', description: 'Browse staff salary periods, benefits, deductions, and net pay' },
  { id: 'p-payr-manage', slug: 'payroll:manage', name: 'Generate & Edit Payroll', module: 'payroll', description: 'Generate payroll periods, adjust overtime, leave, benefits, and disburse reserves' },

  // Reports & Analytics
  { id: 'p-rep-view', slug: 'reports:view', name: 'Analytics & Financial Reports', module: 'reports', description: 'Access revenue metrics, sales trends, and profit margins' },
  { id: 'p-rep-export', slug: 'reports:export', name: 'Export Reports Data', module: 'reports', description: 'Export sales, inventory, and expense ledgers to Excel / PDF' },

  // Administration & Staff Management
  { id: 'p-usr-all', slug: 'users:*', name: 'Full Staff & Team Management', module: 'admin', description: 'Full access to staff directory, performance analytics, and salary raises' },
  { id: 'p-usr-view', slug: 'users:view', name: 'View Staff Profiles & Performance', module: 'admin', description: 'View staff profiles, KPIs, commission breakdowns, and raise history' },
  { id: 'p-usr-manage', slug: 'users:manage', name: 'Manage Staff Accounts & Raises', module: 'admin', description: 'Create, edit, deactivate staff accounts and grant salary raises' },
  { id: 'p-roles-manage', slug: 'roles:manage', name: 'Role & Permissions Configuration', module: 'admin', description: 'Configure dynamic access control policies for system roles' },
  { id: 'p-set-all', slug: 'settings:*', name: 'App & Store Settings', module: 'admin', description: 'Manage global store configurations and preferences' },
  { id: 'p-aud-view', slug: 'audit:view', name: 'Security Audit Logs', module: 'admin', description: 'Inspect audit trail of staff actions and system modifications' },
]

export const AdminRolesScreen: React.FC<AdminRolesScreenProps> = ({ onNavigate }) => {
  const { currentUser, refreshUser } = useAuth()
  const [roles, setRoles] = useState<RoleItem[]>(DEFAULT_ROLES)
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionItem[]>(DEFAULT_PERMISSIONS)
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string>('ADMIN')
  const [activePermissions, setActivePermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  // Accordion state: which permission module groups are expanded (all collapsed by default)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})

  const toggleModuleExpanded = useCallback((groupId: string) => {
    setExpandedModules((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }, [])

  // Find currently selected role object
  const selectedRole = useMemo(() => {
    return roles.find((r) => r.slug === selectedRoleSlug) || roles[0]
  }, [roles, selectedRoleSlug])

  // Load roles & permissions from API
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, permsRes] = await Promise.allSettled([
        fetchRoles(),
        fetchPermissions(),
      ])

      if (rolesRes.status === 'fulfilled') {
        const rawRoles: RoleItem[] = Array.isArray(rolesRes.value?.data)
          ? rolesRes.value.data
          : Array.isArray(rolesRes.value)
          ? (rolesRes.value as any)
          : []
        if (rawRoles.length > 0) {
          setRoles(rawRoles)
        }
      }

      if (permsRes.status === 'fulfilled') {
        const rawPerms: PermissionItem[] = Array.isArray(permsRes.value?.data)
          ? permsRes.value.data
          : Array.isArray(permsRes.value)
          ? (permsRes.value as any)
          : []
        if (rawPerms.length > 0) {
          setPermissionsCatalog(rawPerms)
        }
      }
    } catch {
      // Retain default roles & catalog on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sync activePermissions state whenever selectedRole changes
  useEffect(() => {
    if (selectedRole) {
      const currentPerms = Array.isArray(selectedRole.permissions)
        ? selectedRole.permissions.map((p) => (typeof p === 'string' ? p : (p as PermissionItem).slug))
        : []
      setActivePermissions(currentPerms)
      setSaveSuccessMessage(null)
    }
  }, [selectedRole])

  // Determine if there are unstaged / dirty changes
  const isDirty = useMemo(() => {
    if (!selectedRole) return false
    const originalPerms = Array.isArray(selectedRole.permissions)
      ? selectedRole.permissions.map((p) => (typeof p === 'string' ? p : (p as PermissionItem).slug))
      : []
    const setA = new Set(originalPerms)
    const setB = new Set(activePermissions)
    if (setA.size !== setB.size) return true
    for (const item of setA) {
      if (!setB.has(item)) return true
    }
    return false
  }, [selectedRole, activePermissions])

  // Group permissions catalog by module
  const moduleGroups = useMemo<PermissionModuleGroup[]>(() => {
    const groups: Record<string, PermissionModuleGroup> = {
      products: {
        id: 'products',
        name: 'Products & Catalog',
        icon: 'cube',
        color: '#F59E0B',
        permissions: [],
      },
      sales: {
        id: 'sales',
        name: 'Sales & POS Register',
        icon: 'cart',
        color: '#FF8800',
        permissions: [],
      },
      quotations: {
        id: 'quotations',
        name: 'Quotations & Estimates',
        icon: 'document-text',
        color: '#EA580C',
        permissions: [],
      },
      invoices: {
        id: 'invoices',
        name: 'Invoices & Billing',
        icon: 'receipt',
        color: '#10B981',
        permissions: [],
      },
      suppliers: {
        id: 'suppliers',
        name: 'Suppliers & Vendors',
        icon: 'briefcase',
        color: '#D97706',
        permissions: [],
      },
      inventory: {
        id: 'inventory',
        name: 'Inventory & Stock Control',
        icon: 'file-tray-stacked',
        color: '#059669',
        permissions: [],
      },
      customers: {
        id: 'customers',
        name: 'Customer Relationship',
        icon: 'people',
        color: '#8B5CF6',
        permissions: [],
      },
      delivery: {
        id: 'delivery',
        name: 'Logistics & Delivery',
        icon: 'car',
        color: '#DC2626',
        permissions: [],
      },
      finance: {
        id: 'finance',
        name: 'Bank & Payment Accounts',
        icon: 'business',
        color: '#0D3880',
        permissions: [],
      },
      channels: {
        id: 'channels',
        name: 'Sales Channels',
        icon: 'share-social',
        color: '#7C3AED',
        permissions: [],
      },
      expenses: {
        id: 'expenses',
        name: 'Finance & Expenses',
        icon: 'cash',
        color: '#EF4444',
        permissions: [],
      },
      payroll: {
        id: 'payroll',
        name: 'Staff Payroll',
        icon: 'wallet',
        color: '#D97706',
        permissions: [],
      },
      reports: {
        id: 'reports',
        name: 'Reports & Analytics',
        icon: 'bar-chart',
        color: '#06B6D4',
        permissions: [],
      },
      admin: {
        id: 'admin',
        name: 'Administration & Security',
        icon: 'shield-checkmark',
        color: '#6366F1',
        permissions: [],
      },
    }

    permissionsCatalog.forEach((p) => {
      let mod = p.module?.toLowerCase() || 'admin'
      if (p.slug.startsWith('suppliers:') || p.slug.startsWith('purchase-orders:')) {
        mod = 'suppliers'
      } else if (p.slug.startsWith('quotations:')) {
        mod = 'quotations'
      } else if (p.slug.startsWith('pos:') || p.slug.startsWith('transactions:')) {
        mod = 'sales'
      } else if (p.slug.startsWith('payment-methods:')) {
        mod = 'finance'
      }

      if (groups[mod]) {
        groups[mod].permissions.push(p)
      } else {
        // Fallback group
        if (!groups.admin.permissions.some((ap) => ap.slug === p.slug)) {
          groups.admin.permissions.push(p)
        }
      }
    })

    return Object.values(groups).filter((g) => g.permissions.length > 0)
  }, [permissionsCatalog])

  // Check if a permission slug is currently enabled for this role
  const isPermissionEnabled = useCallback(
    (slug: string, moduleName?: string): boolean => {
      if (selectedRole?.slug === 'SUPER_ADMIN') return true
      if (activePermissions.includes('*')) return true
      if (activePermissions.includes(slug)) return true

      if (moduleName && activePermissions.includes(`${moduleName}:*`)) {
        return true
      }
      return false
    },
    [selectedRole, activePermissions]
  )

  // Toggle individual permission
  const handleTogglePermission = useCallback(
    (slug: string, moduleName: string) => {
      if (selectedRole?.slug === 'SUPER_ADMIN') {
        Alert.alert('Root Access Protected', 'Super Admin maintains permanent root access (*).')
        return
      }

      setSaveSuccessMessage(null)
      const moduleWildcard = `${moduleName}:*`
      const isCurrentlyEnabled = isPermissionEnabled(slug, moduleName)

      setActivePermissions((prev) => {
        let updated = [...prev]

        if (isCurrentlyEnabled) {
          // Disabling permission
          // If global wildcard '*' is present, expand to all catalog permissions except this one
          if (updated.includes('*')) {
            updated = permissionsCatalog
              .map((p) => p.slug)
              .filter((s) => s !== slug && s !== '*')
          } else if (updated.includes(moduleWildcard)) {
            // If module wildcard is present, expand to other permissions in this module
            const modulePerms = permissionsCatalog
              .filter((p) => p.module === moduleName && p.slug !== moduleWildcard && p.slug !== slug)
              .map((p) => p.slug)
            updated = updated.filter((s) => s !== moduleWildcard)
            modulePerms.forEach((mp) => {
              if (!updated.includes(mp)) updated.push(mp)
            })
          } else {
            updated = updated.filter((s) => s !== slug)
          }
        } else {
          // Enabling permission
          if (!updated.includes(slug)) {
            updated.push(slug)
          }
        }

        return updated
      })
    },
    [selectedRole, isPermissionEnabled, permissionsCatalog]
  )

  // Bulk toggle for a module
  const handleToggleModuleAll = useCallback(
    (group: PermissionModuleGroup, enable: boolean) => {
      if (selectedRole?.slug === 'SUPER_ADMIN') return

      setSaveSuccessMessage(null)
      const groupSlugs = group.permissions.map((p) => p.slug)
      const moduleWildcard = `${group.id}:*`

      setActivePermissions((prev) => {
        let updated = [...prev]

        if (enable) {
          // Add module wildcard or all module slugs
          if (!updated.includes(moduleWildcard)) {
            updated.push(moduleWildcard)
          }
          groupSlugs.forEach((s) => {
            if (!updated.includes(s)) updated.push(s)
          })
        } else {
          // Remove module wildcard and all individual slugs
          updated = updated.filter((s) => s !== moduleWildcard && !groupSlugs.includes(s))
          if (updated.includes('*')) {
            // Expand other modules
            updated = permissionsCatalog
              .map((p) => p.slug)
              .filter((s) => !groupSlugs.includes(s) && s !== moduleWildcard && s !== '*')
          }
        }

        return updated
      })
    },
    [selectedRole, permissionsCatalog]
  )

  // Reset changes to original state
  const handleResetChanges = useCallback(() => {
    if (!selectedRole) return
    const originalPerms = Array.isArray(selectedRole.permissions)
      ? selectedRole.permissions.map((p) => (typeof p === 'string' ? p : (p as PermissionItem).slug))
      : []
    setActivePermissions(originalPerms)
    setSaveSuccessMessage(null)
  }, [selectedRole])

  // Save changes to backend
  const handleSavePermissions = useCallback(async () => {
    if (!selectedRole) return
    if (selectedRole.slug === 'SUPER_ADMIN') {
      Alert.alert('Notice', 'Super Admin permissions are permanent root (*).')
      return
    }

    setSaving(true)
    setSaveSuccessMessage(null)

    try {
      const response = await updateRolePermissions(selectedRole.id, activePermissions)
      const updatedRoleData = response.data || response

      // Update local roles list
      setRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRole.id || r.slug === selectedRole.slug
            ? { ...r, permissions: activePermissions }
            : r
        )
      )

      if (refreshUser) {
        await refreshUser().catch(() => null)
      }

      setSaveSuccessMessage(`Successfully updated permissions for ${selectedRole.name}.`)
      Alert.alert(
        'Permissions Saved',
        `Role permissions for "${selectedRole.name}" have been updated successfully and take effect immediately.`,
        [{ text: 'OK' }]
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update role permissions'
      Alert.alert('Update Error', msg)
    } finally {
      setSaving(false)
    }
  }, [selectedRole, activePermissions])

  const getRoleBadgeStyle = (slug: string) => {
    switch (slug) {
      case 'SUPER_ADMIN':
        return { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD' }
      case 'ADMIN':
        return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' }
      case 'MANAGER':
        return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' }
      case 'SELLER':
        return { bg: '#E6F4EA', text: '#15803D', border: '#BBF7D0' }
      default:
        return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
    }
  }

  // Access Guard: strictly restricted to SUPER_ADMIN
  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    return (
      <View style={[styles.container, styles.unauthorizedContainer]}>
        <View style={styles.unauthorizedBox}>
          <View style={styles.unauthorizedIconCircle}>
            <Ionicons name="shield-outline" size={36} color={tokens.colors.statusError} />
          </View>
          <Text style={styles.unauthorizedTitle}>Super Admin Required</Text>
          <Text style={styles.unauthorizedSub}>
            Dynamic Role & Permission configuration is strictly restricted to Super Administrators.
          </Text>
          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={() => onNavigate('home')}
            activeOpacity={0.85}
          >
            <Ionicons name="home" size={16} color={tokens.colors.onPrimary} />
            <Text style={styles.backHomeBtnText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const roleStyle = getRoleBadgeStyle(selectedRole.slug)
  const isSuperAdminRole = selectedRole.slug === 'SUPER_ADMIN'

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Role & Permissions</Text>
          <Text style={styles.subtitle}>Configure dynamic access control policies</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadData}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
          ) : (
            <Ionicons name="refresh" size={18} color={tokens.colors.primaryContainer} />
          )}
        </TouchableOpacity>
      </View>

      {/* Role Selection Tabs Strip */}
      <View style={styles.roleTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleTabsContent}>
          {roles.map((r) => {
            const isSelected = r.slug === selectedRoleSlug
            const badge = getRoleBadgeStyle(r.slug)
            return (
              <TouchableOpacity
                key={r.id || r.slug}
                style={[
                  styles.roleTabBtn,
                  isSelected && styles.roleTabBtnActive,
                  isSelected && { borderColor: tokens.colors.primaryContainer },
                ]}
                onPress={() => setSelectedRoleSlug(r.slug)}
                activeOpacity={0.8}
              >
                <View style={[styles.roleTabIndicator, { backgroundColor: badge.text }]} />
                <Text
                  style={[
                    styles.roleTabText,
                    isSelected && styles.roleTabTextActive,
                  ]}
                >
                  {r.name}
                </Text>
                {r.users_count !== undefined && (
                  <View style={[styles.roleCountBadge, isSelected && styles.roleCountBadgeActive]}>
                    <Text style={[styles.roleCountText, isSelected && styles.roleCountTextActive]}>
                      {r.users_count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Selected Role Summary Card */}
        <View style={styles.roleSummaryCard}>
          <View style={styles.roleSummaryTop}>
            <View style={styles.roleSummaryInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.roleSummaryName}>{selectedRole.name}</Text>
                <View style={[styles.roleSlugBadge, { backgroundColor: roleStyle.bg }]}>
                  <Text style={[styles.roleSlugText, { color: roleStyle.text }]}>{selectedRole.slug}</Text>
                </View>
              </View>
              <Text style={styles.roleSummaryDesc}>{selectedRole.description}</Text>
            </View>
            {Boolean(isSuperAdminRole) && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={16} color="#5B21B6" />
                <Text style={styles.lockBadgeText}>Root Lock</Text>
              </View>
            )}
          </View>

          {isSuperAdminRole ? (
            <View style={styles.superAdminNotice}>
              <Ionicons name="shield-checkmark" size={18} color="#5B21B6" />
              <Text style={styles.superAdminNoticeText}>
                Super Admin holds permanent wildcard root access (*). All system capabilities are always granted.
              </Text>
            </View>
          ) : (
            <View style={styles.permissionsStatsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Active Grants</Text>
                <Text style={styles.statValue}>
                  {activePermissions.includes('*')
                    ? 'All (*)'
                    : `${activePermissions.length} rule(s)`}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={[styles.statValue, { color: isDirty ? tokens.colors.statusWarning : tokens.colors.statusSuccess }]}>
                  {isDirty ? 'Unsaved Changes' : 'Synced'}
                </Text>
              </View>
            </View>
          )}

          {Boolean(saveSuccessMessage) && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={16} color={tokens.colors.statusSuccess} />
              <Text style={styles.successBannerText}>{saveSuccessMessage}</Text>
            </View>
          )}
        </View>

        {/* Categorized Permissions Matrix (Accordion) */}
        {moduleGroups.map((group) => {
          const allEnabled = group.permissions.every((p) => isPermissionEnabled(p.slug, group.id))
          const someEnabled = group.permissions.some((p) => isPermissionEnabled(p.slug, group.id))
          const isExpanded = !!expandedModules[group.id]
          const activeCount = group.permissions.filter((p) =>
            isPermissionEnabled(p.slug, group.id)
          ).length

          return (
            <View key={group.id} style={styles.moduleGroupCard}>
              {/* Accordion Module Header (tap to expand / collapse) */}
              <TouchableOpacity
                style={styles.moduleHeader}
                onPress={() => toggleModuleExpanded(group.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={styles.moduleHeaderLeft}>
                  <View style={[styles.moduleIconBox, { backgroundColor: `${group.color}15` }]}>
                    <Ionicons name={group.icon} size={18} color={group.color} />
                  </View>
                  <View>
                    <Text style={styles.moduleTitle}>{group.name}</Text>
                    <Text style={styles.moduleCount}>
                      {activeCount} of {group.permissions.length} capabilities active
                    </Text>
                  </View>
                </View>

                {Boolean(!isSuperAdminRole) && (
                  <TouchableOpacity
                    style={styles.bulkToggleBtn}
                    onPress={() => handleToggleModuleAll(group, !allEnabled)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.bulkToggleText}>
                      {allEnabled ? 'Disable All' : 'Enable All'}
                    </Text>
                  </TouchableOpacity>
                )}

                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={tokens.colors.secondary}
                  style={styles.accordionChevron}
                />
              </TouchableOpacity>

              {/* Permission Items in this Module (only when expanded) */}
              {Boolean(isExpanded) && (
                <>
                  <View style={styles.moduleDivider} />
                  <View style={styles.permissionsList}>
                    {group.permissions.map((perm) => {
                      const enabled = isPermissionEnabled(perm.slug, group.id)

                      return (
                        <View key={perm.slug} style={styles.permissionRow}>
                          <View style={styles.permissionInfo}>
                            <View style={styles.permissionTitleRow}>
                              <Text style={styles.permissionName}>{perm.name}</Text>
                              <View style={styles.slugCodeChip}>
                                <Text style={styles.slugCodeText}>{perm.slug}</Text>
                              </View>
                            </View>
                            {Boolean(perm.description) && (
                              <Text style={styles.permissionDesc}>{perm.description}</Text>
                            )}
                          </View>

                          <Switch
                            value={enabled}
                            onValueChange={() => handleTogglePermission(perm.slug, group.id)}
                            disabled={isSuperAdminRole || saving}
                            trackColor={{
                              false: tokens.colors.surfaceMuted,
                              true: tokens.colors.primaryContainer,
                            }}
                            thumbColor={Platform.OS === 'android' ? (enabled ? tokens.colors.onPrimary : '#f4f3f4') : undefined}
                          />
                        </View>
                      )
                    })}
                  </View>
                </>
              )}
            </View>
          )
        })}

        {/* Bottom spacer so floating action footer does not overlap content */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Bar when changes exist */}
      {Boolean(!isSuperAdminRole && isDirty) && (
        <View style={styles.floatingActionBar}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetChanges}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color={tokens.colors.onBackground} />
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSavePermissions}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color={tokens.colors.onPrimary} />
                <Text style={styles.saveBtnText}>Save Permissions</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xs,
    backgroundColor: tokens.colors.background,
  },
  title: {
    fontSize: tokens.typography.headlineLargeMobile.fontSize,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  subtitle: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.secondary,
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  roleTabsContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
    backgroundColor: tokens.colors.background,
  },
  roleTabsContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: 8,
    flexDirection: 'row',
  },
  roleTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    gap: 6,
  },
  roleTabBtnActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryContainer,
  },
  roleTabIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.onBackground,
  },
  roleTabTextActive: {
    color: tokens.colors.primaryContainer,
    fontWeight: '700',
  },
  roleCountBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  roleCountBadgeActive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  roleCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.secondary,
  },
  roleCountTextActive: {
    color: tokens.colors.onPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  roleSummaryCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  roleSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roleSummaryInfo: {
    flex: 1,
  },
  roleSummaryName: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  roleSlugBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleSlugText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleSummaryDesc: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 4,
    lineHeight: 16,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5B21B6',
  },
  superAdminNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    padding: 10,
    borderRadius: tokens.borderRadius.md,
    marginTop: 12,
  },
  superAdminNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#5B21B6',
    fontWeight: '600',
    lineHeight: 15,
  },
  permissionsStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: tokens.colors.borderSubtle,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F4EA',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  successBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.statusSuccess,
  },
  moduleGroupCard: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  moduleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  moduleCount: {
    fontSize: 10,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  bulkToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
  },
  bulkToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  accordionChevron: {
    marginLeft: 4,
  },
  moduleDivider: {
    height: 1,
    backgroundColor: tokens.colors.borderSubtle,
    marginVertical: 12,
  },
  permissionsList: {
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionName: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  slugCodeChip: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slugCodeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: tokens.colors.secondary,
  },
  permissionDesc: {
    fontSize: 11,
    color: tokens.colors.secondary,
    marginTop: 2,
    lineHeight: 15,
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: 20,
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.colors.surfaceCard,
    padding: 10,
    borderRadius: tokens.borderRadius.card,
    borderWidth: 1,
    borderColor: tokens.colors.primaryContainer,
    ...tokens.shadows.card,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    gap: 6,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    gap: 8,
    ...tokens.shadows.card,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.onPrimary,
  },
  unauthorizedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  unauthorizedBox: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    ...tokens.shadows.card,
  },
  unauthorizedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 8,
  },
  unauthorizedSub: {
    fontSize: 13,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: tokens.spacing.lg,
  },
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: 12,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.pill,
    gap: 8,
    width: '100%',
    ...tokens.shadows.card,
  },
  backHomeBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
})

export default AdminRolesScreen
