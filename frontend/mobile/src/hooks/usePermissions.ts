import React, { useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import type { TabType } from '../types'

export const TAB_PERMISSION: Partial<Record<TabType, string>> = {
  pos: 'pos:checkout',
  transactions: 'transactions:view',
  quotations: 'quotations:create',
  invoices: 'invoices:view',
  products: 'products:read',
  'purchase-orders': 'purchase-orders:create',
  categories: 'categories:manage',
  inventory: 'inventory:adjust',
  customers: 'customers:view',
  suppliers: 'suppliers:view',
  expenses: 'expenses:view',
  reports: 'reports:view',
  admin: 'users:manage',
  roles: 'roles:manage',
  'sales-channels': 'channels:view',
  'bank-accounts': 'payment-methods:view',
  'delivery-companies': 'delivery:view',
  'delivery-zones': 'delivery:view',
  settings: 'settings:*',
  payroll: 'payroll:view',
  'daily-settlements': 'reports:view',
}

/**
 * Checks if a granted permission pattern satisfies the requested permission.
 * Supports:
 * - Full root wildcard: '*' matches any capability.
 * - Exact match: 'products:read' matches 'products:read'.
 * - Module wildcard: 'products:*' matches 'products:read', 'products:create', etc.
 */
export function matchPermission(granted: string, requested: string): boolean {
  if (!granted || !requested) return false
  if (granted === '*') return true
  if (granted === requested) return true

  const colonIdx = granted.indexOf(':')
  if (colonIdx !== -1 && granted.slice(colonIdx + 1) === '*') {
    const grantedModule = granted.slice(0, colonIdx)
    const reqColonIdx = requested.indexOf(':')
    const requestedModule = reqColonIdx !== -1 ? requested.slice(0, reqColonIdx) : requested
    return grantedModule === requestedModule
  }

  return false
}

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
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
    'users:*',
    'users:view',
    'users:manage',
    'roles:manage',
    'audit:view',
    'settings:*',
  ],
  MANAGER: [
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
    'users:view',
    'reports:view',
    'reports:export',
  ],
  SELLER: [
    'pos:checkout',
    'inventory:scan',
    'quotations:create',
    'invoices:view',
    'invoices:record-payment',
    'customers:view',
    'transactions:view',
    'delivery:view',
  ],
}

export function usePermissions() {
  const { currentUser } = useAuth()

  const can = useCallback((permission: string): boolean => {
    if (!currentUser) return false
    if (currentUser.role === 'SUPER_ADMIN') return true

    if (currentUser.overrides?.[permission] === false) return false
    if (currentUser.overrides?.[permission] === true) return true

    const grants: string[] =
      currentUser.permissions && currentUser.permissions.length > 0
        ? currentUser.permissions
        : ROLE_DEFAULT_PERMISSIONS[currentUser.role] ?? []
    return grants.some((g) => matchPermission(g, permission))
  }, [currentUser])

  const hasAny = useCallback((permissions: string[]): boolean => {
    if (!currentUser) return false
    if (currentUser.role === 'SUPER_ADMIN') return true
    if (!permissions || permissions.length === 0) return false
    return permissions.some((p) => can(p))
  }, [currentUser, can])

  const hasAll = useCallback((permissions: string[]): boolean => {
    if (!currentUser) return false
    if (currentUser.role === 'SUPER_ADMIN') return true
    if (!permissions || permissions.length === 0) return true
    return permissions.every((p) => can(p))
  }, [currentUser, can])

  const canAccessTab = useCallback((tab: TabType): boolean => {
    if (!currentUser) return false
    if (currentUser.role === 'SUPER_ADMIN') return true

    const required = TAB_PERMISSION[tab]
    if (!required) return true
    return can(required)
  }, [currentUser, can])

  const canPerformAction = useCallback((action: string, module?: string): boolean => {
    if (!currentUser) return false
    if (currentUser.role === 'SUPER_ADMIN') return true

    const permissionKey = module ? (action.includes(':') ? action : `${module}:${action}`) : action
    return can(permissionKey)
  }, [currentUser, can])

  return useMemo(
    () => ({
      can,
      hasAny,
      hasAll,
      canAccessTab,
      canPerformAction,
      permissions: currentUser?.permissions ?? [],
      isSuperAdmin: currentUser?.role === 'SUPER_ADMIN',
    }),
    [can, hasAny, hasAll, canAccessTab, canPerformAction, currentUser]
  )
}

