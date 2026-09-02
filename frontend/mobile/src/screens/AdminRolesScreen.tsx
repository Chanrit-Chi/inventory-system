import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  fetchRoles,
  fetchPermissions,
  updateRolePermissions,
} from '../api/endpoints'
import { ROLE_DEFAULT_PERMISSIONS } from '../hooks/usePermissions'
import type { RoleItem, PermissionItem, TabType } from '../types'
import { styles } from './admin_roles/AdminRolesScreen.styles'
import {
  DEFAULT_ROLES,
  DEFAULT_PERMISSIONS,
  PermissionModuleGroup,
} from './admin_roles/adminRoleUtils'
import { RoleSelectorTabs } from './admin_roles/components/RoleSelectorTabs'
import { RoleHeaderSummaryCard } from './admin_roles/components/RoleHeaderSummaryCard'
import { PermissionModuleSection } from './admin_roles/components/PermissionModuleSection'

export interface AdminRolesScreenProps {
  onNavigate: (tab: TabType) => void
}

export const AdminRolesScreen: React.FC<AdminRolesScreenProps> = ({ onNavigate }) => {
  const { showToast } = useToast()
  const { currentUser, refreshUser } = useAuth()
  const [roles, setRoles] = useState<RoleItem[]>(DEFAULT_ROLES)
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionItem[]>(DEFAULT_PERMISSIONS)
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string>('ADMIN')
  const [activePermissions, setActivePermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  // Accordion state: which permission module groups are expanded
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
          ? (rolesRes.value as RoleItem[])
          : []
        if (rawRoles.length > 0) {
          setRoles(rawRoles)
        }
      }

      if (permsRes.status === 'fulfilled') {
        const rawPerms: PermissionItem[] = Array.isArray(permsRes.value?.data)
          ? permsRes.value.data
          : Array.isArray(permsRes.value)
          ? (permsRes.value as PermissionItem[])
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
        showToast('Super Admin maintains permanent root access (*).', 'info')
        return
      }

      setSaveSuccessMessage(null)
      const moduleWildcard = `${moduleName}:*`
      const isCurrentlyEnabled = isPermissionEnabled(slug, moduleName)

      setActivePermissions((prev) => {
        let updated = [...prev]

        if (isCurrentlyEnabled) {
          if (updated.includes('*')) {
            updated = permissionsCatalog
              .map((p) => p.slug)
              .filter((s) => s !== slug && s !== '*')
          } else if (updated.includes(moduleWildcard)) {
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
          if (!updated.includes(slug)) {
            updated.push(slug)
          }
        }

        return updated
      })
    },
    [selectedRole, isPermissionEnabled, permissionsCatalog, showToast]
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
          if (!updated.includes(moduleWildcard)) {
            updated.push(moduleWildcard)
          }
          groupSlugs.forEach((s) => {
            if (!updated.includes(s)) updated.push(s)
          })
        } else {
          updated = updated.filter((s) => s !== moduleWildcard && !groupSlugs.includes(s))
          if (updated.includes('*')) {
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

  // Reset to static role template defaults
  const handleResetToRoleDefaults = useCallback(() => {
    if (!selectedRole || selectedRole.slug === 'SUPER_ADMIN') return
    const defaultPerms = ROLE_DEFAULT_PERMISSIONS[selectedRole.slug] || []
    setActivePermissions(defaultPerms)
    setSaveSuccessMessage(null)
    showToast(`Reset permissions for "${selectedRole.name}" to template defaults.`, 'info')
  }, [selectedRole, showToast])

  // Save changes to backend
  const handleSavePermissions = useCallback(async () => {
    if (!selectedRole) return
    if (selectedRole.slug === 'SUPER_ADMIN') {
      showToast('Super Admin permissions are permanent root (*).', 'info')
      return
    }

    setSaving(true)
    setSaveSuccessMessage(null)

    try {
      await updateRolePermissions(selectedRole.id, activePermissions)

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
      showToast(`Permissions for "${selectedRole.name}" updated successfully.`, 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update role permissions'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedRole, activePermissions, refreshUser, showToast])

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
      <RoleSelectorTabs
        roles={roles}
        selectedRoleSlug={selectedRoleSlug}
        onSelectRoleSlug={setSelectedRoleSlug}
        getRoleBadgeStyle={getRoleBadgeStyle}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Selected Role Summary Card */}
        <RoleHeaderSummaryCard
          selectedRole={selectedRole}
          roleStyle={roleStyle}
          isSuperAdminRole={isSuperAdminRole}
          activePermissions={activePermissions}
          isDirty={isDirty}
          saveSuccessMessage={saveSuccessMessage}
          onResetToDefaults={handleResetToRoleDefaults}
        />

        {/* Categorized Permissions Matrix (Accordion) */}
        {moduleGroups.map((group) => (
          <PermissionModuleSection
            key={group.id}
            group={group}
            isExpanded={Boolean(expandedModules[group.id])}
            isSuperAdminRole={isSuperAdminRole}
            selectedRoleSlug={selectedRole.slug}
            saving={saving}
            onToggleExpanded={toggleModuleExpanded}
            onToggleModuleAll={handleToggleModuleAll}
            onTogglePermission={handleTogglePermission}
            isPermissionEnabled={isPermissionEnabled}
          />
        ))}

        {/* Bottom spacer so floating action footer does not overlap content */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Bar when changes exist */}
      {!isSuperAdminRole && isDirty && (
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

export default AdminRolesScreen
