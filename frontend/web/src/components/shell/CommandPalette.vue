<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
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
  BarChart3,
  TrendingUp,
  ScrollText,
  UserCheck,
  Shield,
  KeyRound,
  Settings,
  X,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  Boxes,
  FileSpreadsheet,
  AlertTriangle,
  Sun,
  Moon,
  Laptop,
} from 'lucide-vue-next'
import { usePermissions } from '@/composables/usePermissions'
import { useThemeStore } from '@/stores/themeStore'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    open?: boolean
  }>(),
  {
    modelValue: false,
    open: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:open', value: boolean): void
  (e: 'select', item: CommandItem): void
  (e: 'toggle-sidebar'): void
}>()

const router = useRouter()
const themeStore = useThemeStore()
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const selectedIndex = ref(0)
const resultsContainerRef = ref<HTMLDivElement | null>(null)

export interface CommandItem {
  id: string
  title: string
  desc: string
  category: 'Quick Actions' | 'Navigation' | 'Catalog & Stock' | 'Finance & CRM' | 'System & Admin'
  icon: any
  to?: string
  action?: () => void
  keywords?: string[]
  badge?: string
  shortcut?: string
}

const isOpen = computed({
  get: () => props.modelValue || props.open,
  set: (val: boolean) => {
    emit('update:modelValue', val)
    emit('update:open', val)
  },
})

// Comprehensive Command Registry across all 26 application domains + operational quick actions
const allCommandItems: CommandItem[] = [
  // --- Quick Actions ---
  {
    id: 'act-toggle-theme',
    title: 'Toggle Dark / Light Mode',
    desc: 'Switch between warm cream light mode and warm obsidian dark mode',
    category: 'Quick Actions',
    icon: Moon,
    action: () => themeStore.toggleTheme(),
    badge: 'Appearance',
    keywords: ['theme', 'dark', 'light', 'mode', 'color', 'night', 'appearance'],
  },
  {
    id: 'act-theme-dark',
    title: 'Switch to Dark Mode',
    desc: 'Enable high-contrast warm obsidian dark mode palette',
    category: 'Quick Actions',
    icon: Moon,
    action: () => themeStore.setTheme('dark'),
    badge: 'Appearance',
    keywords: ['dark mode', 'night', 'black', 'dark theme'],
  },
  {
    id: 'act-theme-light',
    title: 'Switch to Light Mode',
    desc: 'Enable warm cream and amber retail light mode palette',
    category: 'Quick Actions',
    icon: Sun,
    action: () => themeStore.setTheme('light'),
    badge: 'Appearance',
    keywords: ['light mode', 'day', 'white', 'cream', 'light theme'],
  },
  {
    id: 'act-theme-system',
    title: 'Use System Theme',
    desc: 'Automatically sync color theme with operating system preference',
    category: 'Quick Actions',
    icon: Laptop,
    action: () => themeStore.setTheme('system'),
    badge: 'Appearance',
    keywords: ['system theme', 'auto theme', 'os theme', 'automatic'],
  },
  {
    id: 'act-pos',
    title: 'Launch POS Terminal',
    desc: 'Open the high-speed touch checkout terminal and start a sale',
    category: 'Quick Actions',
    icon: CreditCard,
    to: '/pos',
    badge: 'Terminal',
    keywords: ['pos', 'checkout', 'sale', 'cashier', 'cart', 'register', 'f8'],
    shortcut: 'F8',
  },
  {
    id: 'act-new-product',
    title: 'Create New Product',
    desc: 'Add a new master product, barcode, variants, and pricing matrix',
    category: 'Quick Actions',
    icon: Sparkles,
    to: '/products/create',
    badge: 'Catalog',
    keywords: ['product', 'new', 'add', 'create', 'sku', 'barcode', 'variant'],
  },
  {
    id: 'act-restock',
    title: 'Start Restock Intake',
    desc: 'Intake supplier shipments and verify inbound inventory batches',
    category: 'Quick Actions',
    icon: ArrowDownToLine,
    to: '/restock',
    badge: 'Intake',
    keywords: ['restock', 'intake', 'inbound', 'supplier', 'shipment', 'receive'],
  },
  {
    id: 'act-new-quotation',
    title: 'Create Sales Quotation',
    desc: 'Draft a price quotation and pro-forma invoice for customers',
    category: 'Quick Actions',
    icon: FileText,
    to: '/quotations',
    badge: 'Sales',
    keywords: ['quotation', 'quote', 'estimate', 'proposal', 'sales'],
  },
  {
    id: 'act-add-expense',
    title: 'Record Store Expense',
    desc: 'Log operational expenses, utilities, supplies, and receipts',
    category: 'Quick Actions',
    icon: DollarSign,
    to: '/expenses',
    badge: 'Finance',
    keywords: ['expense', 'cost', 'spend', 'payout', 'receipt', 'bill'],
  },
  {
    id: 'act-check-low-stock',
    title: 'Inspect Low Stock Alerts',
    desc: 'View inventory SKUs currently below their reorder threshold',
    category: 'Quick Actions',
    icon: AlertTriangle,
    to: '/inventory',
    badge: 'Stock Alert',
    keywords: ['low stock', 'out of stock', 'alert', 'reorder', 'threshold', 'inventory'],
  },
  {
    id: 'act-toggle-sidebar',
    title: 'Toggle Sidebar Collapse',
    desc: 'Expand or minimize the primary navigation sidebar width',
    category: 'Quick Actions',
    icon: LayoutDashboard,
    action: () => emit('toggle-sidebar'),
    badge: 'UI',
    keywords: ['sidebar', 'collapse', 'expand', 'toggle', 'menu', 'layout'],
  },

  // --- Navigation: Overview & POS ---
  {
    id: 'nav-dashboard',
    title: 'Executive Dashboard',
    desc: 'High-level store metrics, sales KPIs, and revenue performance',
    category: 'Navigation',
    icon: BarChart3,
    to: '/dashboard',
    keywords: ['dashboard', 'overview', 'kpi', 'metrics', 'sales', 'analytics', 'home'],
  },
  {
    id: 'nav-pos',
    title: 'POS Terminal (Cashier Register)',
    desc: 'Fast retail sales terminal with barcode scanning and quick checkout',
    category: 'Navigation',
    icon: CreditCard,
    to: '/pos',
    badge: 'Live POS',
    keywords: ['pos', 'point of sale', 'register', 'cashier', 'terminal', 'checkout'],
  },
  {
    id: 'nav-orders',
    title: 'Orders & POS Sales',
    desc: 'Browse transaction history, order details, and fulfillment statuses',
    category: 'Navigation',
    icon: Receipt,
    keywords: ['orders', 'sales', 'transactions', 'receipts', 'fulfillment', 'history'],
    to: '/orders',
  },

  // --- Navigation: Catalog & Stock ---
  {
    id: 'nav-products',
    title: 'Products Catalog & Matrix',
    desc: 'Browse all products, manage variants, attributes, and barcodes',
    category: 'Catalog & Stock',
    icon: Package,
    to: '/products',
    keywords: ['products', 'catalog', 'matrix', 'items', 'variants', 'sku', 'barcode'],
  },
  {
    id: 'nav-products-create',
    title: 'Create Product Matrix',
    desc: 'Wizard to register new SKUs, variants, prices, and stock thresholds',
    category: 'Catalog & Stock',
    icon: Sparkles,
    to: '/products/create',
    keywords: ['product', 'create', 'new', 'add', 'item'],
  },
  {
    id: 'nav-categories',
    title: 'Product Categories',
    desc: 'Organize catalog into hierarchical product categories and tags',
    category: 'Catalog & Stock',
    icon: FolderTree,
    to: '/categories',
    keywords: ['categories', 'taxonomy', 'departments', 'groups', 'organize'],
  },
  {
    id: 'nav-attributes',
    title: 'Attributes & Options',
    desc: 'Manage variant attributes (e.g. Size, Color, Material, Weight)',
    category: 'Catalog & Stock',
    icon: SlidersHorizontal,
    to: '/attributes',
    keywords: ['attributes', 'variants', 'options', 'sizes', 'colors', 'specs'],
  },
  {
    id: 'nav-inventory',
    title: 'Inventory Ledger',
    desc: 'Real-time stock on hand, bin locations, reorder points, and adjustments',
    category: 'Catalog & Stock',
    icon: Boxes,
    to: '/inventory',
    keywords: ['inventory', 'stock', 'ledger', 'warehouse', 'quantities', 'count'],
  },
  {
    id: 'nav-restock',
    title: 'Restock Intake Sessions',
    desc: 'Process inbound shipments, supplier purchase orders, and stock updates',
    category: 'Catalog & Stock',
    icon: ArrowDownToLine,
    to: '/restock',
    keywords: ['restock', 'intake', 'inbound', 'receiving', 'shipment'],
  },
  {
    id: 'nav-suppliers',
    title: 'Suppliers & Vendors',
    desc: 'Manage supplier contacts, terms, lead times, and purchase histories',
    category: 'Catalog & Stock',
    icon: Truck,
    to: '/suppliers',
    keywords: ['suppliers', 'vendors', 'manufacturers', 'distributors', 'contacts'],
  },
  {
    id: 'nav-delivery-settings',
    title: 'Delivery & Shipping Settings',
    desc: 'Configure shipping carriers, delivery zones, and courier fees',
    category: 'Catalog & Stock',
    icon: MapPin,
    to: '/delivery-settings',
    keywords: ['delivery', 'shipping', 'carriers', 'zones', 'courier', 'logistics'],
  },

  // --- Navigation: Finance & CRM ---
  {
    id: 'nav-customers',
    title: 'Customer Loyalty & CRM',
    desc: 'Manage customer profiles, purchase history, loyalty tiers, and points',
    category: 'Finance & CRM',
    icon: Users,
    to: '/customers',
    keywords: ['customers', 'crm', 'loyalty', 'members', 'tiers', 'points', 'clients'],
  },
  {
    id: 'nav-quotations',
    title: 'Sales Quotations',
    desc: 'Create, inspect, and convert price quotations into active orders',
    category: 'Finance & CRM',
    icon: FileText,
    to: '/quotations',
    keywords: ['quotations', 'quotes', 'estimates', 'bids', 'proposals'],
  },
  {
    id: 'nav-invoices',
    title: 'Tax Invoices & Billing',
    desc: 'Review issued tax invoices, payment statuses, and overdue accounts',
    category: 'Finance & CRM',
    icon: FileSpreadsheet,
    to: '/invoices',
    keywords: ['invoices', 'billing', 'tax', 'receipts', 'accounts receivable', 'payments'],
  },
  {
    id: 'nav-expenses',
    title: 'Expenses & Overhead Costs',
    desc: 'Track operational expenses, store utilities, and cost categories',
    category: 'Finance & CRM',
    icon: DollarSign,
    to: '/expenses',
    keywords: ['expenses', 'costs', 'spending', 'overheads', 'bills', 'accounting'],
  },
  {
    id: 'nav-bank-accounts',
    title: 'Bank Accounts & Balances',
    desc: 'Configure company bank accounts, payment gateways, and cash registers',
    category: 'Finance & CRM',
    icon: Building2,
    to: '/bank-accounts',
    keywords: ['bank', 'accounts', 'finance', 'cash', 'transfer', 'qr pay'],
  },
  {
    id: 'nav-payroll',
    title: 'Staff Payroll & Salaries',
    desc: 'Calculate staff wages, commissions, overtime, and monthly payouts',
    category: 'Finance & CRM',
    icon: Coins,
    to: '/payroll',
    keywords: ['payroll', 'salaries', 'wages', 'staff', 'commissions', 'payouts'],
  },
  {
    id: 'nav-sales-channels',
    title: 'Sales Channels & Outlets',
    desc: 'Manage retail registers, web shops, and social media channels',
    category: 'Finance & CRM',
    icon: Radio,
    to: '/sales-channels',
    keywords: ['channels', 'sales channels', 'pos', 'web store', 'telegram', 'social'],
  },

  // --- Navigation: System & Admin ---
  {
    id: 'nav-reports',
    title: 'Reports & Analytics',
    desc: 'Generate sales trends, top-selling products, profit, and tax reports',
    category: 'System & Admin',
    icon: TrendingUp,
    to: '/reports',
    keywords: ['reports', 'analytics', 'trends', 'profit', 'sales summary', 'export'],
  },
  {
    id: 'nav-audit-logs',
    title: 'Security Audit Logs',
    desc: 'Inspect user actions, inventory edits, price changes, and system events',
    category: 'System & Admin',
    icon: ScrollText,
    to: '/audit-logs',
    keywords: ['audit', 'logs', 'security', 'history', 'events', 'activity', 'tracking'],
  },
  {
    id: 'nav-settings',
    title: 'Store Settings & Branding',
    desc: 'Store profile, currency, tax rates, receipt formatting, and themes',
    category: 'System & Admin',
    icon: Settings,
    to: '/settings',
    keywords: ['settings', 'store settings', 'branding', 'tax', 'currency', 'receipt'],
  },
  {
    id: 'nav-users',
    title: 'Staff & Admin Users',
    desc: 'Manage employee accounts, roles, access credentials, and status',
    category: 'System & Admin',
    icon: UserCheck,
    to: '/users',
    keywords: ['users', 'staff', 'employees', 'accounts', 'cashiers', 'admins'],
  },
  {
    id: 'nav-roles',
    title: 'Roles Management',
    desc: 'Define custom access roles (Admin, Manager, Cashier, Inventory Staff)',
    category: 'System & Admin',
    icon: Shield,
    to: '/roles',
    keywords: ['roles', 'security', 'access levels', 'groups', 'authorization'],
  },
  {
    id: 'nav-permissions',
    title: 'Permissions Matrix',
    desc: 'Configure granular read/write/delete permissions per resource',
    category: 'System & Admin',
    icon: KeyRound,
    to: '/permissions',
    keywords: ['permissions', 'matrix', 'access control', 'grants', 'security'],
  },
]

const { can } = usePermissions()

// Filter commands based on current user permissions
const availableCommands = computed(() => {
  return allCommandItems.filter(item => {
    if (item.to === '/dashboard') return can('reports:view')
    if (item.to === '/reports') return can('reports:view')
    if (item.to === '/daily-settlements') return can('reports:view')
    if (item.to === '/payroll') return can('payroll:view')
    if (item.to === '/users' || item.to === '/roles' || item.to === '/permissions') return can('roles:manage') || can('users:view')
    if (item.to === '/audit-logs') return can('audit:view')
    if (item.to === '/settings') return can('settings:*')
    if (item.to === '/expenses') return can('expenses:*')
    if (item.to === '/suppliers') return can('suppliers:view')
    if (item.to === '/delivery-settings') return can('delivery:view')
    if (item.to === '/bank-accounts') return can('payment-methods:view')
    if (item.to === '/categories' || item.to === '/attributes') return can('categories:manage')
    if (item.to === '/purchase-orders') return can('purchase-orders:create')
    if (item.to === '/restock') return can('inventory:restock')
    if (item.to === '/import') return can('products:create')
    return true
  })
})

// Filtered commands based on active search query
const filteredCommands = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return availableCommands.value

  return availableCommands.value.filter(item => {
    if (item.title.toLowerCase().includes(q)) return true
    if (item.desc.toLowerCase().includes(q)) return true
    if (item.category.toLowerCase().includes(q)) return true
    if (item.to && item.to.toLowerCase().includes(q)) return true
    if (item.keywords?.some(k => k.toLowerCase().includes(q))) return true
    return false
  })
})

// Group filtered commands by category for clear visual presentation
const groupedCommands = computed(() => {
  const groups: { category: string; items: CommandItem[] }[] = []
  const order: CommandItem['category'][] = [
    'Quick Actions',
    'Navigation',
    'Catalog & Stock',
    'Finance & CRM',
    'System & Admin',
  ]

  for (const cat of order) {
    const items = filteredCommands.value.filter(i => i.category === cat)
    if (items.length > 0) {
      groups.push({ category: cat, items })
    }
  }

  return groups
})

// Flattened list for index-based keyboard navigation
const flatFilteredList = computed(() => {
  return groupedCommands.value.flatMap(g => g.items)
})

function close() {
  isOpen.value = false
  searchQuery.value = ''
  selectedIndex.value = 0
}

function selectItem(item: CommandItem) {
  emit('select', item)
  close()
  if (item.to) {
    router.push(item.to)
  } else if (item.action) {
    item.action()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (flatFilteredList.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % flatFilteredList.value.length
      scrollToSelected()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (flatFilteredList.value.length > 0) {
      selectedIndex.value =
        (selectedIndex.value - 1 + flatFilteredList.value.length) % flatFilteredList.value.length
      scrollToSelected()
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatFilteredList.value[selectedIndex.value]
    if (item) {
      selectItem(item)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

function scrollToSelected() {
  nextTick(() => {
    const el = resultsContainerRef.value?.querySelector('.command-palette-item--selected')
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

// Global hotkey listener: Ctrl+K / Cmd+K / Slash key
function handleGlobalKeydown(e: KeyboardEvent) {
  const isInputActive =
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement ||
    document.activeElement instanceof HTMLSelectElement ||
    (document.activeElement as HTMLElement)?.isContentEditable

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    isOpen.value = !isOpen.value
  } else if (e.key === '/' && !isInputActive && !isOpen.value) {
    e.preventDefault()
    isOpen.value = true
  }
}

watch(isOpen, val => {
  if (val) {
    searchQuery.value = ''
    selectedIndex.value = 0
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

watch(searchQuery, () => {
  selectedIndex.value = 0
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="command-fade">
      <div
        v-if="isOpen"
        class="command-palette-backdrop"
        @click.self="close"
        @keydown="handleKeydown"
      >
        <div class="command-palette-dialog" role="dialog" aria-modal="true" aria-label="Command Palette">
          <!-- Top Search Header -->
          <div class="command-palette-header">
            <Search :size="18" class="command-palette-search-icon" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              class="command-palette-input"
              placeholder="Type a command, route, product or keyword (e.g. POS, Stock, New, Expenses)..."
              autocomplete="off"
              spellcheck="false"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="command-palette-clear-btn"
              title="Clear search"
              @click="searchQuery = ''"
            >
              <X :size="14" />
            </button>
            <kbd class="command-palette-esc-badge" @click="close">ESC</kbd>
          </div>

          <!-- Results Scroll Area -->
          <div ref="resultsContainerRef" class="command-palette-body">
            <template v-if="groupedCommands.length > 0">
              <div
                v-for="group in groupedCommands"
                :key="group.category"
                class="command-palette-group"
              >
                <div class="command-palette-group-header">
                  <span>{{ group.category }}</span>
                  <span class="command-palette-group-count">{{ group.items.length }}</span>
                </div>

                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="command-palette-item"
                  :class="{
                    'command-palette-item--selected':
                      flatFilteredList[selectedIndex]?.id === item.id,
                  }"
                  @mouseenter="selectedIndex = flatFilteredList.findIndex(i => i.id === item.id)"
                  @click="selectItem(item)"
                >
                  <div class="command-palette-item-icon-wrap">
                    <component :is="item.icon" :size="16" class="command-palette-item-icon" />
                  </div>

                  <div class="command-palette-item-content">
                    <div class="command-palette-item-title-row">
                      <span class="command-palette-item-title">{{ item.title }}</span>
                      <span v-if="item.badge" class="command-palette-item-badge">
                        {{ item.badge }}
                      </span>
                    </div>
                    <span class="command-palette-item-desc">{{ item.desc }}</span>
                  </div>

                  <div class="command-palette-item-meta">
                    <kbd v-if="item.shortcut" class="command-palette-shortcut-badge">
                      {{ item.shortcut }}
                    </kbd>
                    <span v-else-if="item.to" class="command-palette-route-path">
                      {{ item.to }}
                    </span>
                    <span
                      v-if="flatFilteredList[selectedIndex]?.id === item.id"
                      class="command-palette-enter-indicator"
                      title="Press Enter to execute"
                    >
                      <CornerDownLeft :size="12" />
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Empty Results State -->
            <div v-else class="command-palette-empty">
              <div class="command-palette-empty-icon-wrap">
                <Search :size="24" />
              </div>
              <p class="command-palette-empty-title">No matching commands found</p>
              <p class="command-palette-empty-desc">
                No results for <strong class="text-foreground">"{{ searchQuery }}"</strong>. Try searching for "POS", "Products", "Quotations", or "Settings".
              </p>
            </div>
          </div>

          <!-- Tactile Shortcut Footer -->
          <div class="command-palette-footer">
            <div class="command-palette-footer-left">
              <span class="command-palette-footer-hint">
                <kbd class="command-palette-kbd"><ArrowUp :size="10" /></kbd>
                <kbd class="command-palette-kbd"><ArrowDown :size="10" /></kbd>
                <span>Navigate</span>
              </span>
              <span class="command-palette-footer-hint">
                <kbd class="command-palette-kbd"><CornerDownLeft :size="10" /></kbd>
                <span>Select</span>
              </span>
              <span class="command-palette-footer-hint">
                <kbd class="command-palette-kbd">ESC</kbd>
                <span>Close</span>
              </span>
            </div>
            <div class="command-palette-footer-right">
              <span>OmniPOS Suite • 26 Modules</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.command-palette-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 32px;
  z-index: 150;
}

.command-palette-dialog {
  width: 100%;
  max-width: 640px;
  max-height: min(80vh, 580px);
  background-color: var(--color-card, #FFFFFF);
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: 20px;
  box-shadow: var(--shadow-xl, 0 24px 64px rgba(0, 0, 0, 0.25));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: commandDialogPop 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes commandDialogPop {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.command-palette-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  background: linear-gradient(180deg, var(--color-card, #FFFFFF) 0%, var(--color-surface-subtle, #FAF7F2) 100%);
}

.command-palette-search-icon {
  color: var(--color-primary, #924C00);
  flex-shrink: 0;
}

.command-palette-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 15px;
  color: var(--color-foreground, #1A1C1C);
  font-family: var(--font-sans, system-ui);
  padding: 0;
}

.command-palette-input::placeholder {
  color: var(--color-muted-foreground, #8C8275);
  opacity: 0.85;
}

.command-palette-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-muted, #F0EAE1);
  color: var(--color-muted-foreground, #6B6358);
  cursor: pointer;
  transition: all 150ms ease;
}

.command-palette-clear-btn:hover {
  background: var(--color-surface-subtle, #E5DDD1);
  color: var(--color-foreground, #1A1C1C);
}

.command-palette-esc-badge {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--color-muted, #F0EAE1);
  color: var(--color-muted-foreground, #6B6358);
  border: 1px solid var(--color-border, #E8E2D9);
  cursor: pointer;
  user-select: none;
  transition: all 150ms ease;
}

.command-palette-esc-badge:hover {
  background: var(--color-surface-subtle, #E5DDD1);
  color: var(--color-foreground, #1A1C1C);
}

.command-palette-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
}

.command-palette-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.command-palette-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted-foreground, #8C8275);
}

.command-palette-group-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 9999px;
  background: var(--color-muted, #F0EAE1);
  color: var(--color-muted-foreground, #6B6358);
}

.command-palette-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 150ms ease, transform 150ms ease;
  border: 1px solid transparent;
}

.command-palette-item:hover,
.command-palette-item--selected {
  background-color: var(--color-cta-muted, #FFF3E0);
  border-color: var(--color-border, #FFDCC4);
}

.command-palette-item-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-surface-subtle, #FAF7F2);
  border: 1px solid var(--color-border, #E8E2D9);
  color: var(--color-primary, #924C00);
  flex-shrink: 0;
  transition: all 150ms ease;
}

.command-palette-item--selected .command-palette-item-icon-wrap {
  background: var(--color-primary, #924C00);
  color: var(--color-primary-foreground, #FFFFFF);
  border-color: var(--color-primary, #924C00);
}

.command-palette-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.command-palette-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.command-palette-item-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-palette-item--selected .command-palette-item-title {
  color: var(--color-primary, #924C00);
}

.command-palette-item-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  background: var(--color-cta-muted, #FFE4CC);
  color: var(--color-primary, #924C00);
  border: 1px solid var(--color-border, #FFDCC4);
}

.command-palette-item-desc {
  font-size: 11.5px;
  color: var(--color-muted-foreground, #6B6358);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-palette-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.command-palette-shortcut-badge {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-muted, #F0EAE1);
  color: var(--color-muted-foreground, #6B6358);
  border: 1px solid var(--color-border, #E8E2D9);
}

.command-palette-route-path {
  font-family: var(--font-mono, monospace);
  font-size: 10.5px;
  color: var(--color-muted-foreground, #8C8275);
}

.command-palette-enter-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--color-cta, #924C00);
  color: var(--color-cta-foreground, #FFFFFF);
}

.command-palette-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 8px;
}

.command-palette-empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-surface-subtle, #FAF7F2);
  border: 1px solid var(--color-border, #E8E2D9);
  color: var(--color-muted-foreground, #8C8275);
  margin-bottom: 4px;
}

.command-palette-empty-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-foreground, #1A1C1C);
}

.command-palette-empty-desc {
  font-size: 12.5px;
  color: var(--color-muted-foreground, #6B6358);
  max-width: 360px;
  line-height: 1.4;
}

.command-palette-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-top: 1px solid var(--color-border, #E8E2D9);
  background-color: var(--color-surface-subtle, #FAF7F2);
  font-size: 11.5px;
  color: var(--color-muted-foreground, #6B6358);
}

.command-palette-footer-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.command-palette-footer-hint {
  display: flex;
  align-items: center;
  gap: 5px;
}

.command-palette-kbd {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--color-card, #FFFFFF);
  color: var(--color-foreground, #1A1C1C);
  border: 1px solid var(--color-border, #E8E2D9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.command-palette-footer-right {
  font-weight: 500;
  color: var(--color-muted-foreground, #8C8275);
}

/* Transitions */
.command-fade-enter-active,
.command-fade-leave-active {
  transition: opacity 160ms ease;
}

.command-fade-enter-from,
.command-fade-leave-to {
  opacity: 0;
}
</style>
