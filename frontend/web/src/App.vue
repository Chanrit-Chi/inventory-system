<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'

interface NavItem {
  to: string
  label: string
  icon: string
  badge?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

interface SalesChannel {
  id: string
  name: string
  type: string
  is_active?: boolean
}

interface NotificationItem {
  id: string
  title: string
  desc: string
  time: string
  icon: string
  unread: boolean
}

interface SearchItem {
  id: string
  title: string
  desc: string
  category: 'Navigation' | 'Actions' | 'Operations'
  icon: string
  to?: string
  action?: () => void
}

const route = useRoute()
const router = useRouter()

// Collapsible Sidebar State
const isCollapsed = ref<boolean>(localStorage.getItem('omnipos_sidebar_collapsed') === 'true')
function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem('omnipos_sidebar_collapsed', String(isCollapsed.value))
}

// Navigation Structure (Grouped)
const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '📊', badge: 'Live' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { to: '/products', label: 'Products Matrix', icon: '🏷️' },
      { to: '/products/create', label: 'New Product', icon: '✨' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/inventory', label: 'Inventory Ledger', icon: '📦' },
      { to: '/restock', label: 'Restock Intake', icon: '📥' },
      { to: '/orders', label: 'Orders & Sales', icon: '🧾' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { to: '/customers', label: 'Customer Loyalty', icon: '👥' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/expenses', label: 'Expenses & Costs', icon: '💰' },
    ],
  },
]

// Dynamic Page Title & Breadcrumbs
const activeLabel = computed(() => {
  if (route.path.startsWith('/products/create')) return 'New Product Matrix'
  if (route.path.startsWith('/products/') && route.path.endsWith('/edit')) return 'Edit Product'
  if (route.path.startsWith('/products')) return 'Product Catalog & Matrix'
  if (route.path.startsWith('/inventory')) return 'Inventory Ledger'
  if (route.path.startsWith('/restock')) return 'Restock Intake Sessions'
  if (route.path.startsWith('/orders')) return 'Orders & POS Sales'
  if (route.path.startsWith('/customers')) return 'Customers & Loyalty CRM'
  if (route.path.startsWith('/expenses')) return 'Expenses & Costs'
  return 'Executive Dashboard'
})

interface Breadcrumb {
  label: string
  to?: string
}

const breadcrumbs = computed<Breadcrumb[]>(() => {
  const crumbs: Breadcrumb[] = [{ label: branding.value.store_name || 'KC Inventory', to: '/dashboard' }]
  const path = route.path

  if (path === '/dashboard' || path === '/') {
    crumbs.push({ label: 'Dashboard' })
    return crumbs
  }

  if (path.startsWith('/products/create')) {
    crumbs.push({ label: 'Catalog', to: '/products' })
    crumbs.push({ label: 'Products', to: '/products' })
    crumbs.push({ label: 'Create Product' })
  } else if (path.startsWith('/products/') && path.endsWith('/edit')) {
    crumbs.push({ label: 'Catalog', to: '/products' })
    crumbs.push({ label: 'Products', to: '/products' })
    crumbs.push({ label: 'Edit Product' })
  } else if (path.startsWith('/products')) {
    crumbs.push({ label: 'Catalog', to: '/products' })
    crumbs.push({ label: 'Product Matrix' })
  } else if (path.startsWith('/inventory')) {
    crumbs.push({ label: 'Operations', to: '/inventory' })
    crumbs.push({ label: 'Inventory Ledger' })
  } else if (path.startsWith('/restock')) {
    crumbs.push({ label: 'Operations', to: '/inventory' })
    crumbs.push({ label: 'Restock Intake' })
  } else if (path.startsWith('/orders')) {
    crumbs.push({ label: 'Operations', to: '/orders' })
    crumbs.push({ label: 'Orders & Sales' })
  } else if (path.startsWith('/customers')) {
    crumbs.push({ label: 'CRM', to: '/customers' })
    crumbs.push({ label: 'Customer Loyalty' })
  } else if (path.startsWith('/expenses')) {
    crumbs.push({ label: 'Finance', to: '/expenses' })
    crumbs.push({ label: 'Expenses Tracker' })
  } else {
    crumbs.push({ label: activeLabel.value })
  }

  return crumbs
})

// Store Branding State (Synced across devices)
interface StoreBranding {
  store_name: string
  tagline?: string
  logo_url?: string | null
}

const branding = ref<StoreBranding>({
  store_name: localStorage.getItem('omnipos_store_name') || 'KC Inventory',
  tagline: localStorage.getItem('omnipos_tagline') || 'Omnichannel Suite',
  logo_url: localStorage.getItem('omnipos_logo_url') || '/logo.png',
})

async function fetchBranding() {
  try {
    const res = await api.get('/settings/branding')
    if (res.data?.data) {
      const data = res.data.data
      branding.value = {
        store_name: data.store_name || 'KC Inventory',
        tagline: data.tagline || 'Omnichannel Suite',
        logo_url: data.logo_url || '/logo.png',
      }
      localStorage.setItem('omnipos_store_name', branding.value.store_name)
      localStorage.setItem('omnipos_tagline', branding.value.tagline || '')
      if (data.logo_url) {
        localStorage.setItem('omnipos_logo_url', data.logo_url)
      }
    }
  } catch {
    // Retain fallback defaults
  }
}

// Sales Channel Selector State
const channels = ref<SalesChannel[]>([
  { id: 'pos-main', name: 'Main Store POS (Register 1)', type: 'pos' },
  { id: 'web-store', name: 'Online Web Store', type: 'web' },
  { id: 'wh-hub', name: 'Central Warehouse Hub', type: 'warehouse' },
])
const activeChannel = ref<SalesChannel>(channels.value[0])
const isChannelMenuOpen = ref(false)

async function fetchSalesChannels() {
  try {
    const res = await api.get('/sales-channels')
    if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
      channels.value = res.data.data
      const savedChannelId = localStorage.getItem('omnipos_active_channel')
      const matched = channels.value.find(c => c.id === savedChannelId)
      activeChannel.value = matched || channels.value[0]
    }
  } catch {
    // Retain fallback defaults
  }
}

function selectChannel(channel: SalesChannel) {
  activeChannel.value = channel
  localStorage.setItem('omnipos_active_channel', channel.id)
  isChannelMenuOpen.value = false
}

// Notifications State
const notifications = ref<NotificationItem[]>([
  {
    id: 'n1',
    title: 'Low Stock Alert',
    desc: 'Wireless Optical Mouse is below reorder threshold (3 units left).',
    time: '5m ago',
    icon: '⚠️',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Restock Session Committed',
    desc: 'Intake batch #RS-9942 was verified and added 120 SKUs to stock.',
    time: '42m ago',
    icon: '📥',
    unread: true,
  },
  {
    id: 'n3',
    title: 'POS Register Sync Complete',
    desc: 'Register #1 synced 14 completed transactions ($1,280.50).',
    time: '2h ago',
    icon: '✅',
    unread: true,
  },
])
const isNotificationOpen = ref(false)

const unreadNotificationsCount = computed(() => {
  return notifications.value.filter(n => n.unread).length
})

function toggleNotifications() {
  isNotificationOpen.value = !isNotificationOpen.value
  if (isChannelMenuOpen.value) isChannelMenuOpen.value = false
}

function markAllNotificationsRead() {
  notifications.value.forEach(n => (n.unread = false))
}

function dismissNotification(id: string) {
  notifications.value = notifications.value.filter(n => n.id !== id)
}

// Global Search (Ctrl+K) Modal State
const isSearchOpen = ref(false)
const searchQuery = ref('')
const selectedSearchIndex = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)

const allSearchItems: SearchItem[] = [
  { id: 's-dash', title: 'Executive Dashboard', desc: 'Overview of sales, inventory alerts, and quick metrics', category: 'Navigation', icon: '📊', to: '/dashboard' },
  { id: 's-prod', title: 'Product Catalog & Matrix', desc: 'Browse products, manage variants, pricing, and barcodes', category: 'Navigation', icon: '🏷️', to: '/products' },
  { id: 's-new-prod', title: 'Create New Product', desc: 'Add master product with SKU matrix and attributes', category: 'Actions', icon: '✨', to: '/products/create' },
  { id: 's-inv', title: 'Inventory Ledger', desc: 'Real-time stock on hand, thresholds, and SKU status', category: 'Navigation', icon: '📦', to: '/inventory' },
  { id: 's-restock', title: 'Restock Intake Session', desc: 'Scan and intake supplier batches into inventory', category: 'Operations', icon: '📥', to: '/restock' },
  { id: 's-orders', title: 'Orders & POS Sales', desc: 'Inspect transaction receipts, delivery status, and payments', category: 'Navigation', icon: '🧾', to: '/orders' },
  { id: 's-cust', title: 'Customers & Loyalty CRM', desc: 'Manage customer tiers, lifetime value, and points', category: 'Navigation', icon: '👥', to: '/customers' },
  { id: 's-exp', title: 'Expense Tracker', desc: 'Log store operational costs, utilities, and invoices', category: 'Navigation', icon: '💰', to: '/expenses' },
]

const filteredSearchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allSearchItems
  return allSearchItems.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.desc.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q)
  )
})

function openSearch() {
  isSearchOpen.value = true
  searchQuery.value = ''
  selectedSearchIndex.value = 0
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function closeSearch() {
  isSearchOpen.value = false
}

function selectSearchItem(item: SearchItem) {
  closeSearch()
  if (item.to) {
    router.push(item.to)
  } else if (item.action) {
    item.action()
  }
}

function onSearchKeydown(e: KeyboardEvent) {
  if (!isSearchOpen.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (filteredSearchResults.value.length > 0) {
      selectedSearchIndex.value = (selectedSearchIndex.value + 1) % filteredSearchResults.value.length
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (filteredSearchResults.value.length > 0) {
      selectedSearchIndex.value = (selectedSearchIndex.value - 1 + filteredSearchResults.value.length) % filteredSearchResults.value.length
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = filteredSearchResults.value[selectedSearchIndex.value]
    if (item) {
      selectSearchItem(item)
    }
  } else if (e.key === 'Escape') {
    closeSearch()
  }
}

// Global Keyboard Shortcut (Ctrl+K or Cmd+K)
function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (isSearchOpen.value) {
      closeSearch()
    } else {
      openSearch()
    }
  } else if (e.key === 'Escape') {
    if (isSearchOpen.value) closeSearch()
    if (isChannelMenuOpen.value) isChannelMenuOpen.value = false
    if (isNotificationOpen.value) isNotificationOpen.value = false
  }
}

// Close popovers when clicking outside
function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.channel-picker')) {
    isChannelMenuOpen.value = false
  }
  if (!target.closest('.notification-wrapper')) {
    isNotificationOpen.value = false
  }
}

watch(searchQuery, () => {
  selectedSearchIndex.value = 0
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('click', handleGlobalClick)
  fetchSalesChannels()
  fetchBranding()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <div class="layout" :class="{ 'layout--collapsed': isCollapsed }">
    <!-- Collapsible Sidebar Navigation -->
    <aside class="sidebar" :class="{ 'sidebar--collapsed': isCollapsed }">
      <!-- Brand Header -->
      <div class="sidebar-brand">
        <RouterLink to="/dashboard" class="brand-main-link">
          <img :src="branding.logo_url || '/logo.png'" alt="Store Logo" class="brand-logo-img" />
          <div v-if="!isCollapsed" class="brand-text-wrap">
            <span class="brand-name">{{ branding.store_name }}</span>
            <span class="brand-subtitle">{{ branding.tagline || 'Omnichannel Suite' }}</span>
          </div>
        </RouterLink>

        <button
          class="sidebar-collapse-toggle"
          :title="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
          @click="toggleSidebar"
        >
          <span v-if="isCollapsed">▶</span>
          <span v-else>◀</span>
        </button>
      </div>

      <!-- Grouped Navigation List -->
      <nav class="sidebar-nav">
        <div v-for="group in navGroups" :key="group.title" class="sidebar-group">
          <div v-if="!isCollapsed" class="sidebar-group-title">{{ group.title }}</div>
          <div v-else class="sidebar-group-divider"></div>

          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            :class="{
              'nav-link--active': route.path === item.to || (item.to !== '/dashboard' && route.path.startsWith(item.to))
            }"
            :title="isCollapsed ? item.label : undefined"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
            <span v-if="!isCollapsed && item.badge" class="nav-badge">{{ item.badge }}</span>
          </RouterLink>
        </div>
      </nav>

      <!-- Sidebar User Profile Footer -->
      <div class="sidebar-footer">
        <div class="user-profile-widget">
          <div class="user-avatar" title="Alex Mercer (Store Manager)">
            <span>SM</span>
            <span class="user-status-dot"></span>
          </div>
          <div v-if="!isCollapsed" class="user-info">
            <span class="user-name">Alex Mercer</span>
            <span class="user-role">Store Administrator</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Shell -->
    <div class="main-wrapper">
      <!-- Modern Sticky Top Bar -->
      <header class="topbar">
        <div class="topbar-left">
          <!-- Dynamic Breadcrumbs -->
          <nav class="breadcrumbs" aria-label="Breadcrumb">
            <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.label">
              <RouterLink v-if="crumb.to && idx < breadcrumbs.length - 1" :to="crumb.to" class="breadcrumb-item">
                {{ crumb.label }}
              </RouterLink>
              <span v-else class="breadcrumb-current">{{ crumb.label }}</span>
              <span v-if="idx < breadcrumbs.length - 1" class="breadcrumb-sep">/</span>
            </template>
          </nav>
        </div>

        <div class="topbar-right">
          <!-- Global Search Trigger Button (Ctrl+K) -->
          <button class="search-trigger-btn" @click="openSearch">
            <span class="search-trigger-icon">🔍</span>
            <span class="search-trigger-text">Quick search...</span>
            <kbd class="kbd-badge">Ctrl K</kbd>
          </button>

          <!-- Live Channel Selector Dropdown -->
          <div class="channel-picker">
            <button class="channel-btn" @click="isChannelMenuOpen = !isChannelMenuOpen">
              <span class="channel-dot"></span>
              <span>{{ activeChannel.name }}</span>
              <span style="font-size: 10px; color: var(--text-muted);">▼</span>
            </button>

            <div v-if="isChannelMenuOpen" class="channel-menu">
              <div class="channel-menu-header">Active Sales Channel</div>
              <div
                v-for="ch in channels"
                :key="ch.id"
                class="channel-menu-item"
                :class="{ 'channel-menu-item--active': ch.id === activeChannel.id }"
                @click="selectChannel(ch)"
              >
                <div class="flex items-center gap-8">
                  <span class="badge badge--sm" :class="ch.type === 'pos' ? 'badge--green' : ch.type === 'web' ? 'badge--blue' : 'badge--neutral'">
                    {{ ch.type.toUpperCase() }}
                  </span>
                  <span>{{ ch.name }}</span>
                </div>
                <span v-if="ch.id === activeChannel.id" style="color: var(--action-primary); font-weight: 700;">✓</span>
              </div>
            </div>
          </div>

          <!-- Notification Bell Dropdown -->
          <div class="notification-wrapper">
            <button class="notification-btn" title="Notifications" @click="toggleNotifications">
              <span>🔔</span>
              <span v-if="unreadNotificationsCount > 0" class="notification-badge">
                {{ unreadNotificationsCount }}
              </span>
            </button>

            <div v-if="isNotificationOpen" class="notification-popover">
              <div class="notification-header">
                <span class="notification-header-title">System Alerts</span>
                <button
                  v-if="unreadNotificationsCount > 0"
                  class="btn btn--subtle btn--sm"
                  style="font-size: 11px; padding: 3px 8px;"
                  @click="markAllNotificationsRead"
                >
                  Mark all read
                </button>
              </div>

              <div class="notification-list">
                <template v-if="notifications.length > 0">
                  <div
                    v-for="item in notifications"
                    :key="item.id"
                    class="notification-item"
                    :style="item.unread ? 'background-color: var(--surface-hover);' : ''"
                  >
                    <span class="notification-item-icon">{{ item.icon }}</span>
                    <div class="notification-item-content">
                      <div class="flex items-center justify-between">
                        <span class="notification-item-title">{{ item.title }}</span>
                        <button
                          class="btn btn--ghost btn--sm"
                          style="padding: 2px 5px; font-size: 10px; border: none;"
                          title="Dismiss"
                          @click.stop="dismissNotification(item.id)"
                        >
                          ✕
                        </button>
                      </div>
                      <p class="notification-item-desc">{{ item.desc }}</p>
                      <span class="notification-item-time">{{ item.time }}</span>
                    </div>
                  </div>
                </template>
                <div v-else class="notification-empty">
                  No active notifications
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main View Container -->
      <main class="content">
        <RouterView />
      </main>
    </div>

    <!-- Global Search (Ctrl+K) Modal -->
    <div v-if="isSearchOpen" class="search-backdrop" @click.self="closeSearch">
      <div class="search-modal" @keydown="onSearchKeydown">
        <div class="search-header">
          <span class="search-header-icon">🔍</span>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search pages, commands, or quick actions..."
          />
          <kbd class="kbd-badge" style="cursor: pointer;" @click="closeSearch">ESC</kbd>
        </div>

        <div class="search-results">
          <div v-if="filteredSearchResults.length === 0" class="empty-state" style="padding: 32px 16px;">
            <p class="text-muted text-sm">No results found for "{{ searchQuery }}".</p>
          </div>

          <div
            v-for="(item, idx) in filteredSearchResults"
            :key="item.id"
            class="search-item"
            :class="{ 'search-item--active': idx === selectedSearchIndex }"
            @mouseenter="selectedSearchIndex = idx"
            @click="selectSearchItem(item)"
          >
            <div class="search-item-left">
              <span class="search-item-icon">{{ item.icon }}</span>
              <div class="search-item-info">
                <span class="search-item-title">{{ item.title }}</span>
                <span class="search-item-desc">{{ item.desc }}</span>
              </div>
            </div>
            <div class="flex items-center gap-8">
              <span class="badge badge--neutral" style="font-size: 10px;">{{ item.category }}</span>
              <span v-if="idx === selectedSearchIndex" class="kbd-badge">↵</span>
            </div>
          </div>
        </div>

        <div class="search-footer">
          <span>Navigate with <kbd class="kbd-badge">↑</kbd> <kbd class="kbd-badge">↓</kbd></span>
          <div class="search-shortcuts">
            <span>Select <kbd class="kbd-badge">↵</kbd></span>
            <span>Close <kbd class="kbd-badge">ESC</kbd></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

