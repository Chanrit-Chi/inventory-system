<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore, type HeaderNotification } from '@/stores/notificationStore'
import { usePermissions } from '@/composables/usePermissions'
import {
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  FileText,
  Shield,
  Loader2,
  X,
  CreditCard,
  LayoutDashboard,
  PanelLeftClose,
  ChevronDown,
  Menu,
} from 'lucide-vue-next'
import ThemeToggle from '@/components/shell/ThemeToggle.vue'

export interface StoreBranding {
  store_name: string
  tagline?: string
  logo_url?: string | null
}

export interface BreadcrumbItem {
  label: string
  to?: string
}

export type { HeaderNotification }

const props = withDefaults(
  defineProps<{
    branding?: StoreBranding
    sidebarCollapsed?: boolean
  }>(),
  {
    branding: () => ({
      store_name: 'KC Shop',
      tagline: 'High-Velocity POS & ERP Platform',
      logo_url: '/logo.png',
    }),
    sidebarCollapsed: false,
  }
)

const emit = defineEmits<{
  (e: 'open-search'): void
  (e: 'toggle-sidebar'): void
  (e: 'logout'): void
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const { can } = usePermissions()

// Dropdown popover open states
const isNotificationsOpen = ref(false)
const isUserMenuOpen = ref(false)

const notificationFilter = computed({
  get: () => notificationStore.notificationFilter,
  set: (val: 'all' | 'unread') => {
    notificationStore.notificationFilter = val
  },
})

// Notifications state synced with store
const notifications = computed(() => notificationStore.notifications)
const unreadCount = computed(() => notificationStore.unreadCount)
const filteredNotifications = computed(() => notificationStore.filteredNotifications)
const isNotificationsLoading = computed(() => notificationStore.isLoading)

function markAllRead() {
  notificationStore.markAllAsRead()
}

function dismissNotification(id: string) {
  notificationStore.dismiss(id)
}

function handleNotificationClick(item: HeaderNotification) {
  notificationStore.markAsRead(item.id)
  isNotificationsOpen.value = false
  if (item.to) {
    router.push(item.to)
  }
}

// Dynamic Route Breadcrumbs Hierarchy
const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const homePath = can('reports:view') ? '/dashboard' : '/pos'
  const root: BreadcrumbItem = {
    label: props.branding.store_name || 'OmniPOS',
    to: homePath,
  }
  const path = route.path

  if (path === '/dashboard' || (path === '/' && can('reports:view'))) {
    return [root, { label: 'Executive Dashboard' }]
  }
  if (path === '/pos' || (path === '/' && !can('reports:view'))) {
    return [root, { label: 'POS Terminal' }]
  }
  if (path === '/products') {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Products Matrix' }]
  }
  if (path === '/products/create') {
    return [
      root,
      { label: 'Catalog', to: '/products' },
      { label: 'Products', to: '/products' },
      { label: 'Create Product' },
    ]
  }
  if (path.startsWith('/products/') && path.endsWith('/edit')) {
    return [
      root,
      { label: 'Catalog', to: '/products' },
      { label: 'Products', to: '/products' },
      { label: 'Edit Product' },
    ]
  }
  if (path === '/categories') {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Categories' }]
  }
  if (path === '/attributes') {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Attributes' }]
  }
  if (path === '/inventory') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Inventory Ledger' }]
  }
  if (path === '/restock') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Restock Intake' }]
  }
  if (path === '/import') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Import Data' }]
  }
  if (path === '/suppliers') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Suppliers & Vendors' }]
  }
  if (path === '/delivery-settings') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Delivery & Shipping' }]
  }
  if (path === '/orders') {
    return [root, { label: 'Sales', to: '/orders' }, { label: 'Orders & POS Sales' }]
  }
  if (path === '/customers') {
    return [root, { label: 'CRM', to: '/customers' }, { label: 'Customer Loyalty' }]
  }
  if (path === '/quotations') {
    return [root, { label: 'Financials', to: '/quotations' }, { label: 'Sales Quotations' }]
  }
  if (path === '/invoices') {
    return [root, { label: 'Financials', to: '/invoices' }, { label: 'Tax Invoices' }]
  }
  if (path === '/expenses') {
    return [root, { label: 'Financials', to: '/expenses' }, { label: 'Expenses & Costs' }]
  }
  if (path === '/bank-accounts') {
    return [root, { label: 'Financials', to: '/bank-accounts' }, { label: 'Bank Accounts' }]
  }
  if (path === '/payroll') {
    return [root, { label: 'Financials', to: '/payroll' }, { label: 'Staff Payroll' }]
  }
  if (path === '/sales-channels') {
    return [root, { label: 'Financials', to: '/sales-channels' }, { label: 'Sales Channels' }]
  }
  if (path === '/reports') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Reports & Analytics' }]
  }
  if (path === '/audit-logs') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Security Audit Logs' }]
  }
  if (path === '/settings') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Store Settings' }]
  }
  if (path === '/users') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Admin Users' }]
  }
  if (path === '/roles') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Roles Management' }]
  }
  if (path === '/permissions') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Permissions Matrix' }]
  }

  // Generic fallback
  const segs = path.split('/').filter(Boolean)
  const formatted = segs.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
  return [root, ...formatted.map((f, idx) => ({ label: f, to: idx === 0 ? `/${segs[0]}` : undefined }))]
})

// User initials
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

// Close dropdowns on outside click
function onWindowClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.header-notifications-wrapper')) {
    isNotificationsOpen.value = false
  }
  if (!target.closest('.header-user-wrapper')) {
    isUserMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', onWindowClick)
  notificationStore.startPolling(30000)
})

onUnmounted(() => {
  window.removeEventListener('click', onWindowClick)
  notificationStore.stopPolling()
})
</script>

<template>
  <header class="app-header" :class="{ 'app-header--pos-mode': route.path === '/pos' }">
    <!-- Left Zone: Universal Sidebar Toggle & Dynamic Breadcrumbs -->
    <div class="header-left">
      <!-- Universal Sidebar Toggle (Desktop & Mobile) -->
      <button
        type="button"
        class="header-sidebar-toggle-btn"
        :title="sidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'"
        :aria-label="sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
        @click="emit('toggle-sidebar')"
      >
        <Menu v-if="sidebarCollapsed" :size="18" />
        <PanelLeftClose v-else :size="18" />
      </button>

      <nav class="header-breadcrumbs" aria-label="Breadcrumb navigation">
        <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.label + idx">
          <RouterLink
            v-if="crumb.to && idx < breadcrumbs.length - 1"
            :to="crumb.to"
            class="header-breadcrumb-link"
            :class="{ 'header-breadcrumb-root': idx === 0, 'header-breadcrumb-mid': idx > 0 }"
          >
            {{ crumb.label }}
          </RouterLink>
          <span v-else class="header-breadcrumb-current">{{ crumb.label }}</span>
          <span v-if="idx < breadcrumbs.length - 1" class="header-breadcrumb-sep" :class="{ 'header-breadcrumb-sep-root': idx === 0 }">/</span>
        </template>
      </nav>

      <!-- Active POS Mode Pill -->
      <div v-if="route.path === '/pos'" class="header-pos-indicator">
        <CreditCard :size="13" />
        <span>Live POS Terminal</span>
      </div>
    </div>

    <!-- Right Zone: Search, Channel Selector, Notifications, User Menu -->
    <div class="header-right">
      <!-- Search Palette Trigger Button -->
      <button
        type="button"
        class="header-search-btn"
        title="Open Command Palette (Ctrl+K or /)"
        @click="emit('open-search')"
      >
        <Search :size="14" class="header-search-icon" />
        <span class="header-search-placeholder">Quick search or commands...</span>
        <kbd class="header-search-kbd">⌘K</kbd>
      </button>

      <!-- Theme Switcher Dropdown -->
      <ThemeToggle />

      <!-- Notifications Bell Dropdown -->
      <div class="header-notifications-wrapper">
        <button
          type="button"
          class="header-icon-btn"
          :class="{ 'header-icon-btn--active': isNotificationsOpen }"
          title="Notifications"
          @click="isNotificationsOpen = !isNotificationsOpen"
        >
          <Bell :size="16" />
          <span v-if="unreadCount > 0" class="header-bell-badge">
            {{ unreadCount }}
          </span>
        </button>

        <Transition name="dropdown-pop">
          <div v-if="isNotificationsOpen" class="header-notifications-popover">
            <div class="header-notifications-header">
              <div class="header-notifications-title-row">
                <span class="header-notifications-title">Notifications</span>
                <Loader2 v-if="isNotificationsLoading" :size="12" class="animate-spin text-[#8C8275] ml-1.5" />
                <span v-if="unreadCount > 0" class="header-unread-count-pill">
                  {{ unreadCount }} unread
                </span>
              </div>
              <button
                v-if="unreadCount > 0"
                type="button"
                class="header-mark-all-btn"
                @click="markAllRead"
              >
                Mark all read
              </button>
            </div>

            <!-- Tab Switcher -->
            <div class="header-notifications-tabs">
              <button
                type="button"
                class="header-notif-tab"
                :class="{ 'header-notif-tab--active': notificationFilter === 'all' }"
                @click="notificationFilter = 'all'"
              >
                All ({{ notifications.length }})
              </button>
              <button
                type="button"
                class="header-notif-tab"
                :class="{ 'header-notif-tab--active': notificationFilter === 'unread' }"
                @click="notificationFilter = 'unread'"
              >
                Unread ({{ unreadCount }})
              </button>
            </div>

            <!-- Notifications List -->
            <div class="header-notifications-list">
              <template v-if="filteredNotifications.length > 0">
                <div
                  v-for="item in filteredNotifications"
                  :key="item.id"
                  class="header-notification-item"
                  :class="{ 'header-notification-item--unread': item.unread }"
                  @click="handleNotificationClick(item)"
                >
                  <div
                    class="header-notif-icon-wrap"
                    :class="`header-notif-icon-wrap--${item.variant}`"
                  >
                    <AlertCircle v-if="item.variant === 'danger'" :size="14" />
                    <AlertTriangle v-else-if="item.variant === 'warning'" :size="14" />
                    <FileText v-else-if="item.type === 'invoice' || item.type === 'quotation'" :size="14" />
                    <Shield v-else-if="item.type === 'audit'" :size="14" />
                    <ArrowDownToLine v-else-if="item.type === 'restock' || item.variant === 'info'" :size="14" />
                    <CheckCircle2 v-else :size="14" />
                  </div>

                  <div class="header-notif-content">
                    <span class="header-notif-title">{{ item.title }}</span>
                    <p class="header-notif-desc">{{ item.desc }}</p>
                    <span class="header-notif-time">{{ item.time }}</span>
                  </div>

                  <button
                    type="button"
                    class="header-notif-dismiss"
                    title="Dismiss"
                    @click.stop="dismissNotification(item.id)"
                  >
                    <X :size="12" />
                  </button>
                </div>
              </template>
              <div v-else class="header-notif-empty">
                <CheckCircle2 :size="28" class="header-notif-empty-icon" />
                <span class="header-notif-empty-title">All caught up!</span>
                <span class="header-notif-empty-desc">No notifications to display.</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- User Profile Dropdown Menu -->
      <div class="header-user-wrapper">
        <button
          type="button"
          class="header-user-btn"
          :class="{ 'header-user-btn--open': isUserMenuOpen }"
          @click="isUserMenuOpen = !isUserMenuOpen"
        >
          <div class="header-user-avatar">
            <span>{{ userInitials }}</span>
            <span class="header-user-online-dot"></span>
          </div>
          <div class="header-user-meta">
            <span class="header-user-name">{{ authStore.user?.name || 'Cashier' }}</span>
            <span class="header-user-role">{{ formatRole(authStore.user?.role || 'SELLER') }}</span>
          </div>
          <ChevronDown :size="13" class="header-chevron" />
        </button>

        <Transition name="dropdown-pop">
          <div v-if="isUserMenuOpen" class="header-user-dropdown">
            <div class="header-user-dropdown-header">
              <div class="header-user-dropdown-avatar">{{ userInitials }}</div>
              <div class="header-user-dropdown-details">
                <span class="header-user-dropdown-name">{{ authStore.user?.name || 'Guest User' }}</span>
                <span class="header-user-dropdown-email">{{ authStore.user?.email || 'admin@omnipos.local' }}</span>
                <span class="header-user-role-badge">{{ formatRole(authStore.user?.role || 'SELLER') }}</span>
              </div>
            </div>

            <div class="header-user-dropdown-links">
              <RouterLink v-if="can('reports:view')" to="/dashboard" class="header-user-link" @click="isUserMenuOpen = false">
                <LayoutDashboard :size="15" />
                <span>Dashboard Overview</span>
              </RouterLink>
              <RouterLink v-if="can('pos:checkout')" to="/pos" class="header-user-link" @click="isUserMenuOpen = false">
                <CreditCard :size="15" />
                <span>POS Register</span>
              </RouterLink>
              <RouterLink v-if="can('settings:*')" to="/settings" class="header-user-link" @click="isUserMenuOpen = false">
                <Settings :size="15" />
                <span>Store Settings</span>
              </RouterLink>
              <RouterLink v-if="can('users:view')" to="/users" class="header-user-link" @click="isUserMenuOpen = false">
                <User :size="15" />
                <span>Staff & Accounts</span>
              </RouterLink>
            </div>

            <div class="header-user-dropdown-footer">
              <button
                type="button"
                class="header-user-logout-btn"
                @click="emit('logout')"
              >
                <LogOut :size="15" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 64px;
  background: var(--color-card, #FFFFFF);
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.app-header--pos-mode {
  border-bottom-color: var(--color-border, #FFDCC4);
  background: linear-gradient(180deg, var(--color-card, #FFFFFF) 0%, var(--color-surface-subtle, #FFFDF8) 100%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-sidebar-toggle-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
  color: var(--color-muted-foreground, #6B6358);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.header-sidebar-toggle-btn:hover {
  background: var(--color-accent, #FFF3E0);
  color: var(--color-primary, #924C00);
  border-color: var(--color-border-strong, #FFDCC4);
}

.header-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-muted-foreground, #6B6358);
  white-space: nowrap;
}

.header-breadcrumb-link {
  color: var(--color-muted-foreground, #6B6358);
  text-decoration: none;
  transition: color 140ms ease;
}

.header-breadcrumb-link:hover {
  color: var(--color-primary, #924C00);
  text-decoration: underline;
}

.header-breadcrumb-current {
  color: var(--color-foreground, #1A1C1C);
  font-weight: 600;
}

.header-breadcrumb-sep {
  color: var(--color-muted-foreground, #C7C2B8);
  font-size: 11px;
}

.header-pos-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  background: var(--color-cta, #FF8800);
  color: var(--color-cta-foreground, #FFFFFF);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  box-shadow: 0 1px 4px rgba(255, 136, 0, 0.25);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Search Trigger Button */
.header-search-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--color-surface-subtle, #FAF7F2);
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: 10px;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--color-muted-foreground, #6B6358);
  cursor: pointer;
  transition: all 150ms ease;
}

.header-search-btn:hover {
  background-color: var(--color-card, #FFFFFF);
  border-color: var(--color-border-strong, #FFDCC4);
  color: var(--color-foreground, #1A1C1C);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.header-search-icon {
  color: var(--color-primary, #924C00);
}

.header-search-placeholder {
  font-weight: 400;
}

.header-search-kbd {
  font-family: var(--font-mono, monospace);
  font-size: 10.5px;
  font-weight: 700;
  background-color: var(--color-card, #FFFFFF);
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--color-muted-foreground, #6B6358);
}

/* Sales Channel Selector */
.header-channel-wrapper {
  position: relative;
}

.header-channel-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
  cursor: pointer;
  transition: all 150ms ease;
}

.header-channel-btn:hover,
.header-channel-btn--open {
  background: var(--color-card, #FFFFFF);
  border-color: var(--color-border-strong, #FFDCC4);
}

.header-channel-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--color-success, #10B981);
}

.header-chevron {
  color: var(--color-muted-foreground, #8C8275);
  transition: transform 150ms ease;
}

.header-channel-btn--open .header-chevron {
  transform: rotate(180deg);
}

.header-channel-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 260px;
  background: var(--color-card, #FFFFFF);
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: 14px;
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.12));
  z-index: 60;
  overflow: hidden;
}

.header-dropdown-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted-foreground, #6B6358);
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
}

.header-dropdown-list {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 140ms ease;
}

.header-dropdown-item:hover {
  background-color: var(--color-muted, #FAF7F2);
}

.header-dropdown-item--active {
  background-color: var(--color-cta-muted, #FFF3E0);
  border-color: var(--color-border, #FFDCC4);
}

.header-channel-item-info {
  display: flex;
  flex-direction: column;
}

.header-channel-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
}

.header-channel-item-type {
  font-size: 11px;
  color: var(--color-muted-foreground, #8C8275);
  text-transform: uppercase;
}

.header-channel-check {
  color: var(--color-primary, #924C00);
}

/* Notifications Popover */
.header-notifications-wrapper {
  position: relative;
}

.header-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
  color: var(--color-secondary-foreground, #574335);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  position: relative;
}

.header-icon-btn:hover,
.header-icon-btn--active {
  background: var(--color-card, #FFFFFF);
  border-color: var(--color-border-strong, #FFDCC4);
  color: var(--color-primary, #924C00);
}

.header-bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9999px;
  background-color: var(--color-cta, #FF8800);
  color: var(--color-cta-foreground, #FFFFFF);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-card, #FFFFFF);
}

.header-notifications-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  background: var(--color-card, #FFFFFF);
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: 16px;
  box-shadow: var(--shadow-lg, 0 16px 40px rgba(0, 0, 0, 0.14));
  z-index: 60;
  overflow: hidden;
}

.header-notifications-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
}

.header-notifications-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-notifications-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-foreground, #1A1C1C);
}

.header-unread-count-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  background: var(--color-cta-muted, #FFE4CC);
  color: var(--color-primary, #924C00);
}

.header-mark-all-btn {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-primary, #924C00);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.header-mark-all-btn:hover {
  background: var(--color-accent, #FFF3E0);
}

.header-notifications-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-card, #FFFFFF);
}

.header-notif-tab {
  flex: 1;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted-foreground, #6B6358);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 140ms ease;
}

.header-notif-tab--active {
  color: var(--color-primary, #924C00);
  border-bottom-color: var(--color-primary, #924C00);
  background: var(--color-surface-subtle, #FFFDF8);
}

.header-notifications-list {
  max-height: 320px;
  overflow-y: auto;
}

.header-notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  cursor: pointer;
  transition: background-color 140ms ease;
  position: relative;
}

.header-notification-item:hover {
  background-color: var(--color-surface-subtle, #FAF7F2);
}

.header-notification-item--unread {
  background-color: var(--color-surface-subtle, #FFFBF5);
}

.header-notif-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-notif-icon-wrap--warning {
  background: var(--color-warning-bg, #FFFBEB);
  color: var(--color-warning, #D97706);
  border: 1px solid var(--color-warning-border, #FDE68A);
}

.header-notif-icon-wrap--info {
  background: var(--color-info-bg, #E0F2FE);
  color: var(--color-info-foreground, #0369A1);
  border: 1px solid var(--color-info-border, #BAE6FD);
}

.header-notif-icon-wrap--success {
  background: var(--color-success-bg, #ECFDF5);
  color: var(--color-success, #10B981);
  border: 1px solid var(--color-success-border, #A7F3D0);
}

.header-notif-icon-wrap--danger {
  background: var(--color-error-bg, #FEF2F2);
  color: var(--color-destructive, #EF4444);
  border: 1px solid var(--color-error-border, #FECACA);
}

.header-notif-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.header-notif-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
}

.header-notif-desc {
  font-size: 11.5px;
  color: var(--color-muted-foreground, #6B6358);
  line-height: 1.35;
}

.header-notif-time {
  font-size: 10.5px;
  color: var(--color-muted-foreground, #8C8275);
  margin-top: 2px;
}

.header-notif-dismiss {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--color-muted-foreground, #8C8275);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 140ms ease;
}

.header-notif-dismiss:hover {
  opacity: 1;
  background: var(--color-muted, #F0EAE1);
}

.header-notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  gap: 4px;
}

.header-notif-empty-icon {
  color: var(--color-success, #10B981);
  margin-bottom: 4px;
}

.header-notif-empty-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
}

.header-notif-empty-desc {
  font-size: 12px;
  color: var(--color-muted-foreground, #6B6358);
}

/* User Profile Menu */
.header-user-wrapper {
  position: relative;
}

.header-user-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 12px;
  border: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
  cursor: pointer;
  transition: all 150ms ease;
}

.header-user-btn:hover,
.header-user-btn--open {
  background: var(--color-card, #FFFFFF);
  border-color: var(--color-border-strong, #FFDCC4);
}

.header-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-accent, #FFF3E0);
  color: var(--color-primary, #924C00);
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #FFDCC4);
  position: relative;
}

.header-user-online-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-success, #10B981);
  border: 1.5px solid var(--color-card, #FFFFFF);
}

.header-user-meta {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.header-user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
  line-height: 1.2;
}

.header-user-role {
  font-size: 10.5px;
  color: var(--color-muted-foreground, #6B6358);
}

.header-user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: var(--color-card, #FFFFFF);
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: 16px;
  box-shadow: var(--shadow-lg, 0 16px 40px rgba(0, 0, 0, 0.14));
  z-index: 60;
  overflow: hidden;
}

.header-user-dropdown-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: var(--color-surface-subtle, #FAF7F2);
  border-bottom: 1px solid var(--color-border, #E8E2D9);
}

.header-user-dropdown-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary, #924C00);
  color: var(--color-primary-foreground, #FFFFFF);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.header-user-dropdown-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.header-user-dropdown-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-foreground, #1A1C1C);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-user-dropdown-email {
  font-size: 11px;
  color: var(--color-muted-foreground, #6B6358);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-user-role-badge {
  display: inline-block;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  background: var(--color-cta-muted, #FFE4CC);
  color: var(--color-primary, #924C00);
  width: fit-content;
}

.header-user-dropdown-links {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-user-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--color-secondary-foreground, #574335);
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 500;
  transition: all 140ms ease;
}

.header-user-link:hover {
  background-color: var(--color-surface-subtle, #FAF7F2);
  color: var(--color-primary, #924C00);
}

.header-user-dropdown-footer {
  padding: 6px;
  border-top: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
}

.header-user-logout-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--color-destructive, #BA1A1A);
  background: transparent;
  border: none;
  width: 100%;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 140ms ease;
}

.header-user-logout-btn:hover {
  background: var(--color-error-bg, #FFDAD6);
}

/* Animations */
.dropdown-pop-enter-active,
.dropdown-pop-leave-active {
  transition: all 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-pop-enter-from,
.dropdown-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

/* ==========================================================================
   Responsive Breakpoints & Media Queries
   ========================================================================== */

@media (max-width: 1023px) {
  .app-header {
    padding: 0 16px;
  }
}

@media (max-width: 768px) {
  .header-user-meta {
    display: none;
  }
  .header-user-btn .header-chevron {
    display: none;
  }
  .header-search-placeholder,
  .header-search-kbd {
    display: none;
  }
  .header-search-btn {
    padding: 7px;
    width: 34px;
    height: 34px;
    justify-content: center;
    border-radius: 8px;
  }
  .header-channel-name {
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-notifications-popover {
    width: calc(100vw - 32px);
    max-width: 380px;
    right: -50px;
  }
}

@media (max-width: 639px) {
  .app-header {
    padding: 0 10px;
    height: 56px;
  }
  .header-breadcrumbs {
    font-size: 12px;
  }
  .header-breadcrumb-root,
  .header-breadcrumb-mid,
  .header-breadcrumb-sep {
    display: none;
  }
  .header-breadcrumb-current {
    font-size: 13px;
    font-weight: 700;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-channel-name {
    display: none;
  }
  .header-channel-btn {
    padding: 6px 8px;
    gap: 4px;
  }
  .header-pos-indicator span {
    display: none;
  }
  .header-pos-indicator {
    padding: 4px 6px;
  }
  .header-notifications-popover {
    width: calc(100vw - 20px);
    right: -80px;
  }
  .header-user-dropdown {
    width: calc(100vw - 20px);
    max-width: 280px;
    right: 0;
  }
}
</style>
