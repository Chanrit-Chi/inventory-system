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
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Boxes,
  FileSpreadsheet,
  LogOut,
  PanelLeftOpen
} from 'lucide-vue-next'

export interface NavItem {
  to: string
  label: string
  icon: any
  badge?: string
  badgeVariant?: 'primary' | 'orange' | 'success' | 'warning' | 'info'
  highlight?: boolean
  roles?: ('SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER')[]
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
      store_name: 'KC Inventory',
      tagline: 'Omnichannel Retail Suite',
      logo_url: '/logo.png',
    }),
  }
)

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
  (e: 'toggle-collapse'): void
  (e: 'logout'): void
}>()

const route = useRoute()
const authStore = useAuthStore()

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
      },
      {
        to: '/orders',
        label: 'Orders & POS Sales',
        icon: Receipt,
        badge: 'Live',
        badgeVariant: 'primary',
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
      },
      {
        to: '/products/create',
        label: 'New Product',
        icon: Sparkles,
        badge: 'New',
        badgeVariant: 'info',
      },
      {
        to: '/categories',
        label: 'Categories',
        icon: FolderTree,
      },
      {
        to: '/attributes',
        label: 'Attributes',
        icon: SlidersHorizontal,
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
      },
      {
        to: '/restock',
        label: 'Restock Intake',
        icon: ArrowDownToLine,
      },
      {
        to: '/suppliers',
        label: 'Suppliers & Vendors',
        icon: Truck,
      },
      {
        to: '/delivery-settings',
        label: 'Delivery & Shipping',
        icon: MapPin,
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
      },
      {
        to: '/quotations',
        label: 'Quotations',
        icon: FileText,
      },
      {
        to: '/invoices',
        label: 'Tax Invoices',
        icon: FileSpreadsheet,
      },
      {
        to: '/expenses',
        label: 'Expenses & Costs',
        icon: DollarSign,
      },
      {
        to: '/bank-accounts',
        label: 'Bank Accounts',
        icon: Building2,
      },
      {
        to: '/payroll',
        label: 'Staff Payroll',
        icon: Coins,
      },
      {
        to: '/sales-channels',
        label: 'Sales Channels',
        icon: Radio,
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
      },
      {
        to: '/reports',
        label: 'Reports & Analytics',
        icon: TrendingUp,
      },
      {
        to: '/audit-logs',
        label: 'Security Audit Logs',
        icon: ScrollText,
      },
      {
        to: '/settings',
        label: 'Store Settings',
        icon: Settings,
      },
      {
        to: '/users',
        label: 'Admin Users',
        icon: UserCheck,
      },
      {
        to: '/roles',
        label: 'Roles Management',
        icon: Shield,
      },
      {
        to: '/permissions',
        label: 'Permissions Matrix',
        icon: KeyRound,
      },
    ],
  },
]

// Determine role visibility (super-admins and admins see everything; managers and sellers see appropriate sets)
const userRole = computed(() => authStore.user?.role ?? 'SELLER')

const visibleNavGroups = computed(() => {
  if (userRole.value === 'SUPER_ADMIN' || userRole.value === 'ADMIN') {
    return navGroups
  }

  // Filter for Manager / Cashier
  return navGroups.map(group => {
    return {
      ...group,
      items: group.items.filter(item => {
        if (!item.roles) return true
        return item.roles.includes(userRole.value as any)
      }),
    }
  }).filter(group => group.items.length > 0)
})

// Route active matching helper
function isRouteActive(targetPath: string): boolean {
  if (targetPath === '/dashboard') {
    return route.path === '/dashboard' || route.path === '/'
  }
  if (targetPath === '/products') {
    return route.path === '/products' || (route.path.startsWith('/products/') && !route.path.startsWith('/products/create'))
  }
  if (targetPath === '/pos') {
    return route.path.startsWith('/pos')
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

function toggle() {
  emit('toggle-collapse')
  emit('update:collapsed', !props.collapsed)
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
      <RouterLink to="/dashboard" class="sidebar-brand-link" :title="branding.store_name">
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

      <button
        type="button"
        class="sidebar-toggle-btn"
        :title="collapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'"
        @click="toggle"
      >
        <ChevronRight v-if="collapsed" :size="15" />
        <ChevronLeft v-else :size="15" />
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
        <div class="sidebar-user-avatar" :title="authStore.user?.name || 'Guest User'">
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

      <!-- Quick collapse toggle in footer for collapsed mode ergonomics -->
      <div v-if="collapsed" class="sidebar-footer-toggle-wrap">
        <button
          type="button"
          class="sidebar-footer-toggle-btn"
          title="Expand Sidebar"
          @click="toggle"
        >
          <PanelLeftOpen :size="16" />
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 260px;
  background-color: #FFFFFF;
  border-right: 1px solid #E8E2D9;
  display: flex;
  flex-direction: column;
  position: fixed;
  inset-block: 0;
  left: 0;
  z-index: 40;
  transition: width 220ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 2px 0 12px rgba(26, 28, 24, 0.03);
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
  border-bottom: 1px solid #E8E2D9;
  background: linear-gradient(180deg, #FFFFFF 0%, #FAF7F2 100%);
  flex-shrink: 0;
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
  background: linear-gradient(135deg, #924C00 0%, #FF8800 100%);
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
  font-family: var(--font-display, 'Space Grotesk', sans-serif);
  font-weight: 700;
  font-size: 15.5px;
  letter-spacing: -0.02em;
  color: #1A1C1C;
  line-height: 1.2;
}

.sidebar-brand-tagline {
  font-size: 11px;
  font-weight: 500;
  color: #6B6358;
}

.sidebar-toggle-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid #E8E2D9;
  background: #FAF7F2;
  color: #6B6358;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.sidebar-toggle-btn:hover {
  background: #FFF3E0;
  color: #924C00;
  border-color: #FFDCC4;
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
  color: #8C8275;
  padding: 4px 10px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-group-divider {
  height: 1px;
  background-color: #E8E2D9;
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
  color: #574335;
  text-decoration: none;
  font-weight: 500;
  font-size: 13px;
  transition: all 140ms ease;
  position: relative;
  white-space: nowrap;
}

.sidebar-nav-link:hover {
  background-color: #FAF7F2;
  color: #1A1C1C;
}

.sidebar-nav-link--highlight {
  background-color: #FFF9F2;
  color: #924C00;
  font-weight: 600;
}

.sidebar-nav-link--active {
  background-color: #FFF3E0;
  color: #924C00;
  font-weight: 600;
}

.sidebar-nav-link--active:hover {
  background-color: #FFEADB;
}

.sidebar-active-indicator {
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3.5px;
  border-radius: 0 4px 4px 0;
  background-color: #924C00;
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
  background-color: #FFF3E0;
  color: #924C00;
  border: 1px solid #FFDCC4;
}

.sidebar-nav-badge--orange {
  background-color: #FF8800;
  color: #FFFFFF;
}

.sidebar-nav-badge--warning {
  background-color: #FFFBEB;
  color: #92400E;
  border: 1px solid #FDE68A;
}

.sidebar-nav-badge--info {
  background-color: #E0F2FE;
  color: #0369A1;
  border: 1px solid #BAE6FD;
}

/* Collapsed Tooltip */
.sidebar-collapsed-tooltip {
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  background-color: #1D1B16;
  color: #FFFFFF;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: all 120ms ease;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-collapsed-tooltip .tooltip-title {
  font-weight: 600;
  color: #FFFFFF;
}

.sidebar-collapsed-tooltip .tooltip-group {
  font-size: 10px;
  color: #C7C2B8;
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
  border-top: 1px solid #E8E2D9;
  background: #FAF7F2;
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
  background: #FFFFFF;
  border: 1px solid #E8E2D9;
}

.sidebar-user-card--collapsed {
  justify-content: center;
  padding: 6px;
}

.sidebar-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #FFF3E0;
  color: #924C00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid #FFDCC4;
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
  background-color: #10B981;
  border: 1.5px solid #FFFFFF;
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
  color: #1A1C1C;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-role {
  font-size: 10.5px;
  color: #6B6358;
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
  color: #6B6358;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.sidebar-logout-btn:hover {
  background: #FFDAD6;
  color: #BA1A1A;
  border-color: #FFDAD6;
}

.sidebar-footer-toggle-wrap {
  display: flex;
  justify-content: center;
}

.sidebar-footer-toggle-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #E8E2D9;
  background: #FFFFFF;
  color: #6B6358;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.sidebar-footer-toggle-btn:hover {
  background: #FFF3E0;
  color: #924C00;
}
</style>
