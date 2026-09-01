import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'

export interface PermissionModuleInfo {
  id: string
  name: string
  icon: string
  color: string
}

export const PERMISSION_MODULES: Record<string, PermissionModuleInfo> = {
  products: {
    id: 'products',
    name: 'Products & Catalog',
    icon: 'Package',
    color: '#F59E0B',
  },
  sales: {
    id: 'sales',
    name: 'Sales & POS Register',
    icon: 'ShoppingCart',
    color: '#FF8800',
  },
  quotations: {
    id: 'quotations',
    name: 'Quotations & Estimates',
    icon: 'FileText',
    color: '#8B5CF6',
  },
  invoices: {
    id: 'invoices',
    name: 'Invoices & Billing',
    icon: 'Receipt',
    color: '#10B981',
  },
  suppliers: {
    id: 'suppliers',
    name: 'Suppliers & Vendors',
    icon: 'Truck',
    color: '#06B6D4',
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory & Stock Control',
    icon: 'Boxes',
    color: '#3B82F6',
  },
  customers: {
    id: 'customers',
    name: 'CRM & Customers',
    icon: 'Users',
    color: '#EC4899',
  },
  delivery: {
    id: 'delivery',
    name: 'Logistics & Delivery',
    icon: 'MapPin',
    color: '#14B8A6',
  },
  'payment-methods': {
    id: 'payment-methods',
    name: 'Bank Accounts & Payments',
    icon: 'CreditCard',
    color: '#6366F1',
  },
  channels: {
    id: 'channels',
    name: 'Sales Channels',
    icon: 'Store',
    color: '#F97316',
  },
  expenses: {
    id: 'expenses',
    name: 'Expenses & Finance',
    icon: 'TrendingDown',
    color: '#EF4444',
  },
  payroll: {
    id: 'payroll',
    name: 'Payroll & Staff Benefits',
    icon: 'DollarSign',
    color: '#84CC16',
  },
  reports: {
    id: 'reports',
    name: 'Reports & Analytics',
    icon: 'BarChart2',
    color: '#A855F7',
  },
  users: {
    id: 'users',
    name: 'Users & Access Control',
    icon: 'UserCheck',
    color: '#64748B',
  },
  roles: {
    id: 'roles',
    name: 'Roles & Permissions',
    icon: 'Shield',
    color: '#0EA5E9',
  },
  audit: {
    id: 'audit',
    name: 'Audit Trail & Compliance',
    icon: 'ShieldAlert',
    color: '#F43F5E',
  },
  settings: {
    id: 'settings',
    name: 'System Settings',
    icon: 'Settings',
    color: '#64748B',
  },
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

export function usePermissions() {
  const authStore = useAuthStore()

  const currentUser = computed(() => authStore.user)
  const isSuperAdmin = computed(() => currentUser.value?.role === 'SUPER_ADMIN')
  const isAdmin = computed(() => currentUser.value?.role === 'ADMIN' || currentUser.value?.role === 'SUPER_ADMIN')
  const isManager = computed(() => currentUser.value?.role === 'MANAGER')
  const isSeller = computed(() => currentUser.value?.role === 'SELLER')

  const activeGrants = computed<string[]>(() => {
    if (!currentUser.value) return []
    if (currentUser.value.role === 'SUPER_ADMIN') return ['*']

    if (currentUser.value.permissions && currentUser.value.permissions.length > 0) {
      return currentUser.value.permissions
    }

    return ROLE_DEFAULT_PERMISSIONS[currentUser.value.role] ?? []
  })

  function can(permission: string): boolean {
    if (!currentUser.value) return false
    if (currentUser.value.role === 'SUPER_ADMIN') return true

    // Check user explicit override
    if (currentUser.value.overrides?.[permission] === false) return false
    if (currentUser.value.overrides?.[permission] === true) return true

    return activeGrants.value.some(g => matchPermission(g, permission))
  }

  function hasAny(permissions: string[]): boolean {
    if (!currentUser.value) return false
    if (currentUser.value.role === 'SUPER_ADMIN') return true
    if (!permissions || permissions.length === 0) return false
    return permissions.some(p => can(p))
  }

  function hasAll(permissions: string[]): boolean {
    if (!currentUser.value) return false
    if (currentUser.value.role === 'SUPER_ADMIN') return true
    if (!permissions || permissions.length === 0) return false
    return permissions.every(p => can(p))
  }

  return {
    currentUser,
    isSuperAdmin,
    isAdmin,
    isManager,
    isSeller,
    activeGrants,
    can,
    hasAny,
    hasAll,
  }
}
