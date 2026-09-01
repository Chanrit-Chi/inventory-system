<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import {
  CreditCard,
  Receipt,
  Package,
  Sparkles,
  FolderTree,
  SlidersHorizontal,
  ArrowDownToLine,
  Truck,
  MapPin,
  Users,
  FileText,
  DollarSign,
  Building2,
  Coins,
  Radio,
  TrendingUp,
  ScrollText,
  UserCheck,
  Shield,
  KeyRound,
  Settings,
  LayoutDashboard,
  Boxes,
  FileSpreadsheet,
  LogOut,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-vue-next'

import { usePermissions } from '@/composables/usePermissions'

export interface NavItem {
  to: string
  label: string
  icon: any
  badge?: string
  badgeVariant?: 'primary' | 'orange' | 'success' | 'warning' | 'info'
  highlight?: boolean
  roles?: ('SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER')[]
  permission?: string
}

export interface NavGroup {
  id: string
  title: string
  items: NavItem[]
}

export interface StoreBranding {
  store_name: string
  tagline?: string
  logo_url?: string | null
}

const props = withDefaults(
  defineProps<{
    collapsed: boolean
    branding?: StoreBranding
  }>(),
  {
    collapsed: false,
    branding: () => ({
      store_name: 'KC Shop',
      tagline: 'High-Velocity POS & ERP Platform',
      logo_url: '/logo.png',
    }),
  }
)

const emit = defineEmits<{
  (e: 'logout'): void
  (e: 'close'): void
}>()

function handleNavClick() {
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    emit('close')
  }
}

const route = useRoute()
const authStore = useAuthStore()
const { can } = usePermissions()

// Comprehensive 5 Navigation Groups covering all 26 application routes
const navGroups: NavGroup[] = [
  {
    id: 'pos-sales',
    title: 'POS & Sales',
    items: [
      {
        to: '/pos',
        label: 'POS Terminal',
        icon: CreditCard,
        badge: 'Quick Sale',
        badgeVariant: 'orange',
        highlight: true,
        permission: 'pos:checkout',
      },
      {
        to: '/orders',
        label: 'Orders & POS Sales',
        icon: Receipt,
        badge: 'Live',
        badgeVariant: 'primary',
        permission: 'pos:checkout',
      },
      {
        to: '/daily-settlements',
        label: 'Shift Settlements',
        icon: ShieldCheck,
        badge: 'Reconcile',
        badgeVariant: 'success',
        permission: 'reports:view',
      },
    ],
  },
  {
    id: 'catalog-matrix',
    title: 'Catalog & Matrix',
    items: [
      {
        to: '/products',
        label: 'Products Matrix',
        icon: Package,
        permission: 'products:read',
      },
      {
        to: '/products/create',
        label: 'New Product',
        icon: Sparkles,
        badge: 'New',
        badgeVariant: 'info',
        permission: 'products:create',
      },
      {
        to: '/categories',
        label: 'Categories',
        icon: FolderTree,
        permission: 'categories:manage',
      },
      {
        to: '/attributes',
        label: 'Attributes',
        icon: SlidersHorizontal,
        permission: 'attributes:manage',
      },
    ],
  },
  {
    id: 'operations-stock',
    title: 'Operations & Inventory',
    items: [
      {
        to: '/inventory',
        label: 'Inventory Ledger',
        icon: Boxes,
        badge: 'Stock',
        badgeVariant: 'warning',
        permission: 'inventory:adjust',
      },
      {
        to: '/purchase-orders',
        label: 'Purchase Orders',
        icon: FileText,
        badge: 'PO',
        badgeVariant: 'info',
        permission: 'purchase-orders:create',
      },
      {
        to: '/restock',
        label: 'Restock Intake',
        icon: ArrowDownToLine,
        permission: 'inventory:restock',
      },
      {
        to: '/import',
        label: 'Import Data',
        icon: Upload,
        badge: 'XLSX',
        badgeVariant: 'info',
        permission: 'products:create',
      },
      {
        to: '/suppliers',
        label: 'Suppliers & Vendors',
        icon: Truck,
        permission: 'suppliers:view',
      },
      {
        to: '/delivery-settings',
        label: 'Delivery & Shipping',
        icon: MapPin,
        permission: 'delivery:view',
      },
    ],
  },
  {
    id: 'financials-crm',
    title: 'Financials & CRM',
    items: [
      {
        to: '/customers',
        label: 'Customer Loyalty',
        icon: Users,
        permission: 'customers:view',
      },
      {
        to: '/quotations',
        label: 'Quotations',
        icon: FileText,
        permission: 'quotations:create',
      },
      {
        to: '/invoices',
        label: 'Tax Invoices',
        icon: FileSpreadsheet,
        permission: 'invoices:view',
      },
      {
        to: '/expenses',
        label: 'Expenses & Costs',
        icon: DollarSign,
        permission: 'expenses:*',
      },
      {
        to: '/bank-accounts',
        label: 'Bank Accounts',
        icon: Building2,
        permission: 'payment-methods:view',
      },
      {
        to: '/payroll',
        label: 'Staff Payroll',
        icon: Coins,
        permission: 'payroll:view',
      },
      {
        to: '/sales-channels',
        label: 'Sales Channels',
        icon: Radio,
        permission: 'channels:view',
      },
    ],
  },
  {
    id: 'admin-analytics',
    title: 'Administration & Reports',
    items: [
      {
        to: '/dashboard',
        label: 'Executive Dashboard',
        icon: LayoutDashboard,
        permission: 'reports:view',
      },
      {
        to: '/reports',
        label: 'Reports & Analytics',
        icon: TrendingUp,
        permission: 'reports:view',
      },
      {
        to: '/audit-logs',
        label: 'Security Audit Logs',
        icon: ScrollText,
        permission: 'audit:view',
      },
      {
        to: '/settings',
        label: 'Store Settings',
        icon: Settings,
        permission: 'settings:*',
      },
      {
        to: '/users',
        label: 'Admin Users',
        icon: UserCheck,
        permission: 'users:view',
      },
      {
        to: '/roles',
        label: 'Roles Management',
        icon: Shield,
        permission: 'roles:manage',
      },
      {
        to: '/permissions',
        label: 'Permissions Matrix',
        icon: KeyRound,
        permission: 'roles:manage',
      },
    ],
  },
]

// Determine role and capability visibility
const userRole = computed(() => authStore.user?.role ?? 'SELLER')

const visibleNavGroups = computed(() => {
  if (!authStore.user || userRole.value === 'SUPER_ADMIN') {
    return navGroups
  }

  return navGroups
    .map(group => {
      return {
        ...group,
        items: group.items.filter(item => {
          if (item.permission && !can(item.permission)) {
            return false
          }
          if (item.roles && !item.roles.includes(userRole.value as any)) {
            return false
          }
          return true
        }),
      }
    })
    .filter(group => group.items.length > 0)
})

const homeRoute = computed(() => (can('reports:view') ? '/dashboard' : '/pos'))

// Route active matching helper
function isRouteActive(targetPath: string): boolean {
  if (targetPath === '/dashboard') {
    return route.path === '/dashboard' || (route.path === '/' && can('reports:view'))
  }
  if (targetPath === '/products') {
    return route.path === '/products' || (route.path.startsWith('/products/') && !route.path.startsWith('/products/create'))
  }
  if (targetPath === '/pos') {
    return route.path.startsWith('/pos') || (route.path === '/' && !can('reports:view'))
  }
  return route.path === targetPath || route.path.startsWith(`${targetPath}/`)
}

// User Initials
const userInitials = computed(() => {
  if (!authStore.user?.name) return 'OP'
  const parts = authStore.user.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return authStore.user.name.slice(0, 2).toUpperCase()
})

function formatRole(role: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrator',
    MANAGER: 'Manager',
    SELLER: 'Cashier / Seller',
  }
  return map[role] || role
}

function handleLogout() {
  emit('logout')
}
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{ 'app-sidebar--collapsed': collapsed }"
    aria-label="Main Navigation"
  >
    <!-- Brand Header -->
    <div class="sidebar-brand-container">
      <RouterLink :to="homeRoute" class="sidebar-brand-link" :title="branding.store_name" @click="handleNavClick">
        <div class="sidebar-brand-logo-wrap">
          <img
            :src="branding.logo_url || '/logo.png'"
            alt="OmniPOS Logo"
            class="sidebar-brand-logo-img"
            @error="(e: any) => { e.target.style.display = 'none' }"
          />
        </div>
        <div v-if="!collapsed" class="sidebar-brand-text">
          <span class="sidebar-brand-name">{{ branding.store_name || 'OmniPOS' }}</span>
          <span class="sidebar-brand-tagline">{{ branding.tagline || 'Retail Suite' }}</span>
        </div>
      </RouterLink>

      <!-- Dedicated Mobile Close Button -->
      <button
        v-if="!collapsed"
        type="button"
        class="sidebar-mobile-close-btn"
        title="Close Navigation Menu"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </div>

    <!-- Navigation Scroll Container -->
    <nav class="sidebar-nav-scroll">
      <div v-for="group in visibleNavGroups" :key="group.id" class="sidebar-nav-group">
        <!-- Group Header in Expanded Mode -->
        <div v-if="!collapsed" class="sidebar-group-header">
          <span>{{ group.title }}</span>
        </div>
        <!-- Divider in Collapsed Mode -->
        <div v-else class="sidebar-group-divider" :title="group.title"></div>

        <!-- Nav Items -->
        <div class="sidebar-group-items">
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="sidebar-nav-link"
            :class="{
              'sidebar-nav-link--active': isRouteActive(item.to),
              'sidebar-nav-link--highlight': item.highlight && !isRouteActive(item.to),
            }"
            :title="collapsed ? `${item.label} (${group.title})` : undefined"
            @click="handleNavClick"
          >
            <!-- Nav Icon -->
            <span class="sidebar-nav-icon-wrap">
              <component :is="item.icon" :size="17" class="sidebar-nav-icon" />
            </span>

            <!-- Nav Label (Expanded) -->
            <span v-if="!collapsed" class="sidebar-nav-label">{{ item.label }}</span>

            <!-- Nav Badge (Expanded) -->
            <span
              v-if="!collapsed && item.badge"
              class="sidebar-nav-badge"
              :class="`sidebar-nav-badge--${item.badgeVariant || 'primary'}`"
            >
              {{ item.badge }}
            </span>

            <!-- Active Indicator Pill -->
            <span v-if="isRouteActive(item.to)" class="sidebar-active-indicator"></span>

            <!-- Floating Tooltip for Collapsed Mode -->
            <div v-if="collapsed" class="sidebar-collapsed-tooltip">
              <span class="tooltip-title">{{ item.label }}</span>
              <span class="tooltip-group">{{ group.title }}</span>
            </div>
          </RouterLink>
        </div>
      </div>
    </nav>

    <!-- Sidebar Bottom User Profile & Actions -->
    <div class="sidebar-footer">
      <div class="sidebar-user-card" :class="{ 'sidebar-user-card--collapsed': collapsed }">
        <div class="sidebar-user-avatar" :title="`${authStore.user?.name || 'Guest User'} (${formatRole(authStore.user?.role || 'SELLER')})`">
          <span>{{ userInitials }}</span>
          <span class="sidebar-user-status-dot"></span>
        </div>

        <div v-if="!collapsed" class="sidebar-user-info">
          <span class="sidebar-user-name">{{ authStore.user?.name || 'Cashier / Admin' }}</span>
          <span class="sidebar-user-role">{{ formatRole(authStore.user?.role || 'SELLER') }}</span>
        </div>

        <button
          v-if="!collapsed"
          type="button"
          class="sidebar-logout-btn"
          title="Sign out of OmniPOS"
          @click="handleLogout"
        >
          <LogOut :size="15" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 260px;
  background-color: var(--color-card, #FFFFFF);
  border-right: 1px solid var(--color-border, #E8E2D9);
  display: flex;
  flex-direction: column;
  position: fixed;
  inset-block: 0;
  left: 0;
  z-index: 40;
  transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.05);
}

.app-sidebar--collapsed {
  width: 72px;
}

/* Brand Header */
.sidebar-brand-container {
  height: 64px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  background: linear-gradient(180deg, var(--color-card, #FFFFFF) 0%, var(--color-surface-subtle, #FAF7F2) 100%);
  flex-shrink: 0;
}

.app-sidebar--collapsed .sidebar-brand-container {
  padding: 0;
  justify-content: center;
}

.app-sidebar--collapsed .sidebar-brand-link {
  justify-content: center;
  flex: none;
}

.sidebar-brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
  flex: 1;
}

.sidebar-brand-logo-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-primary, #924C00) 0%, var(--color-cta, #FF8800) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(146, 76, 0, 0.25);
  overflow: hidden;
}

.sidebar-brand-logo-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.sidebar-brand-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  white-space: nowrap;
}

.sidebar-brand-name {
  font-family: var(--font-display, 'Poppins', sans-serif);
  font-weight: 700;
  font-size: 15.5px;
  letter-spacing: -0.02em;
  color: var(--color-foreground, #1A1C1C);
  line-height: 1.2;
}

.sidebar-brand-tagline {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-muted-foreground, #6B6358);
}

/* Nav Scroll Area */
.sidebar-nav-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-group-header {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted-foreground, #8C8275);
  padding: 4px 10px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-group-divider {
  height: 1px;
  background-color: var(--color-border, #E8E2D9);
  margin: 6px 8px;
}

.sidebar-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Nav Link */
.sidebar-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--color-secondary-foreground, #574335);
  text-decoration: none;
  font-weight: 500;
  font-size: 13px;
  transition: all 140ms ease;
  position: relative;
  white-space: nowrap;
}

.sidebar-nav-link:hover {
  background-color: var(--color-muted, #FAF7F2);
  color: var(--color-foreground, #1A1C1C);
}

.sidebar-nav-link--highlight {
  background-color: var(--color-accent, #FFF9F2);
  color: var(--color-primary, #924C00);
  font-weight: 600;
}

.sidebar-nav-link--active {
  background-color: var(--color-cta-muted, #FFF3E0);
  color: var(--color-primary, #924C00);
  font-weight: 600;
}

.sidebar-nav-link--active:hover {
  background-color: var(--color-accent, #FFEADB);
}

.sidebar-active-indicator {
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3.5px;
  border-radius: 0 4px 4px 0;
  background-color: var(--color-cta, #924C00);
}

.sidebar-nav-icon-wrap {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: inherit;
}

.sidebar-nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.sidebar-nav-badge--primary {
  background-color: var(--color-cta-muted, #FFF3E0);
  color: var(--color-primary, #924C00);
  border: 1px solid var(--color-border, #FFDCC4);
}

.sidebar-nav-badge--orange {
  background-color: var(--color-cta, #FF8800);
  color: var(--color-cta-foreground, #FFFFFF);
}

.sidebar-nav-badge--warning {
  background-color: var(--color-warning-bg, #FFFBEB);
  color: var(--color-warning, #92400E);
  border: 1px solid var(--color-warning-border, #FDE68A);
}

.sidebar-nav-badge--info {
  background-color: var(--color-info-bg, #E0F2FE);
  color: var(--color-info-foreground, #0369A1);
  border: 1px solid var(--color-info-border, #BAE6FD);
}

/* Collapsed Tooltip */
.sidebar-collapsed-tooltip {
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  background-color: var(--color-surface-inverse, #1D1B16);
  color: var(--color-surface, #FFFFFF);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: all 120ms ease;
  z-index: 100;
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.2));
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-collapsed-tooltip .tooltip-title {
  font-weight: 600;
  color: inherit;
}

.sidebar-collapsed-tooltip .tooltip-group {
  font-size: 10px;
  color: var(--color-muted-foreground, #C7C2B8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.app-sidebar--collapsed .sidebar-nav-link:hover .sidebar-collapsed-tooltip {
  opacity: 1;
  visibility: visible;
  left: calc(100% + 10px);
}

/* Footer & User Profile */
.sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.sidebar-user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--color-card, #FFFFFF);
  border: 1px solid var(--color-border, #E8E2D9);
}

.sidebar-user-card--collapsed {
  justify-content: center;
  padding: 6px;
}

.sidebar-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-accent, #FFF3E0);
  color: var(--color-primary, #924C00);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--color-border, #FFDCC4);
  position: relative;
  flex-shrink: 0;
}

.sidebar-user-status-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-success, #10B981);
  border: 1.5px solid var(--color-card, #FFFFFF);
}

.sidebar-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.sidebar-user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-role {
  font-size: 10.5px;
  color: var(--color-muted-foreground, #6B6358);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-logout-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-muted-foreground, #6B6358);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.sidebar-logout-btn:hover {
  background: var(--color-error-bg, #FFDAD6);
  color: var(--color-destructive, #BA1A1A);
  border-color: var(--color-error-border, #FFDAD6);
}

.sidebar-mobile-close-btn {
  display: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
  color: var(--color-muted-foreground, #6B6358);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.sidebar-mobile-close-btn:hover {
  background: var(--color-accent, #FFF3E0);
  color: var(--color-primary, #924C00);
  border-color: var(--color-border-strong, #FFDCC4);
}

@media (max-width: 1023px) {
  .sidebar-mobile-close-btn {
    display: flex;
  }
  .app-sidebar {
    transform: translateX(-100%);
    transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
    z-index: 50;
  }
  .app-sidebar:not(.app-sidebar--collapsed) {
    transform: translateX(0);
    width: 260px;
  }
  .app-sidebar--collapsed {
    transform: translateX(-100%);
    width: 260px;
  }
}
</style>
