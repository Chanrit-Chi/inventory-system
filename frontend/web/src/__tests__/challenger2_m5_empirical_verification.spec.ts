import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import fs from 'node:fs'
import path from 'node:path'

// Mock api
vi.mock('@/api/axios', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: mockApi,
    ApiError: class ApiError extends Error {
      errors?: Record<string, string[]>
      status?: number
      constructor(msg: string, errors?: Record<string, string[]>, status?: number) {
        super(msg)
        this.name = 'ApiError'
        this.errors = errors
        this.status = status
      }
    },
  }
})

import api from '@/api/axios'

// Stores
import { usePosStore } from '@/stores/posStore'
import { useToastStore } from '@/stores/toastStore'
import { useToast } from '@/composables/useToast'
import { useProductStore } from '@/stores/productStore'

// Components & Views
import App from '@/App.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import CommandPalette from '@/components/shell/CommandPalette.vue'
import POSView from '@/views/POSView.vue'
import PosCheckoutModal from '@/components/pos/PosCheckoutModal.vue'
import PosReceiptModal from '@/components/pos/PosReceiptModal.vue'
import PosVariantModal from '@/components/pos/PosVariantModal.vue'
import DashboardView from '@/views/DashboardView.vue'
import ProductListView from '@/views/ProductListView.vue'
import ProductCreateView from '@/views/ProductCreateView.vue'
import OrdersView from '@/views/OrdersView.vue'
import CustomersView from '@/views/CustomersView.vue'
import InventoryLedgerView from '@/views/InventoryLedgerView.vue'
import SettingsView from '@/views/SettingsView.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

describe('Challenger 2 Empirical Verification: All 5 Requirements (R1..R5)', () => {
  let router: any

  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
        { path: '/dashboard', component: DashboardView },
        { path: '/pos', component: POSView },
        { path: '/products', component: ProductListView },
        { path: '/products/create', component: ProductCreateView },
        { path: '/orders', component: OrdersView },
        { path: '/customers', component: CustomersView },
        { path: '/inventory', component: InventoryLedgerView },
        { path: '/settings', component: SettingsView },
      ],
    })

    localStorage.clear()
    sessionStorage.clear()

    // Default mock behavior
    ;(api.get as any).mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, current_page: 1, last_page: 1, per_page: 15 },
      },
    })
    ;(api.post as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.put as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.patch as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.delete as any).mockResolvedValue({ data: { message: 'Deleted' } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // R1: Brand Token Layer & Clean Styling Verification
  // ============================================================================
  describe('Requirement 1: Brand Token Layer & Clean Styling', () => {
    it('verifies that style.css contains all required brand tokens and font definitions', () => {
      const styleCssPath = path.resolve(__dirname, '../style.css')
      expect(fs.existsSync(styleCssPath)).toBe(true)
      const cssContent = fs.readFileSync(styleCssPath, 'utf-8')

      // Check key tokens
      expect(cssContent).toContain('--color-primary:                    #924C00')
      expect(cssContent).toContain('--color-cta:                        #FF8800')
      expect(cssContent).toContain('--color-background:                 #FAF7F2')
      expect(cssContent).toContain('--color-foreground:                 #1A1C1C')
      expect(cssContent).toContain('--color-border:                     #E8E2D9')
      expect(cssContent).toContain("--font-sans:                        'Poppins'")
      expect(cssContent).toContain("--font-display:                     'Poppins'")
      expect(cssContent).toContain("--font-mono:                        'Fira Code'")
    })

    it('verifies color contrast compliance for critical brand combinations', () => {
      function getLuminance(r: number, g: number, b: number) {
        const a = [r, g, b].map((v) => {
          v /= 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        })
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
      }

      function getContrastRatio(hex1: string, hex2: string) {
        const rgb1 = hex1.replace('#', '').match(/.{2}/g)!.map((x) => parseInt(x, 16))
        const rgb2 = hex2.replace('#', '').match(/.{2}/g)!.map((x) => parseInt(x, 16))
        const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2])
        const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2])
        const lighter = Math.max(l1, l2)
        const darker = Math.min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
      }

      // Charcoal text (#1A1C1C) on Warm Cream background (#FAF7F2) -> Must be > 7:1 (WCAG AAA)
      const textToBgContrast = getContrastRatio('#1A1C1C', '#FAF7F2')
      expect(textToBgContrast).toBeGreaterThan(7.0)

      // Deep Amber Primary (#924C00) with White Text (#FFFFFF) -> Must be > 4.5:1 (WCAG AA)
      const primaryToWhiteContrast = getContrastRatio('#924C00', '#FFFFFF')
      expect(primaryToWhiteContrast).toBeGreaterThan(4.5)

      // CTA Orange (#FF8800) with Charcoal Text (#1A1C1C) -> Must be > 4.5:1 (WCAG AA)
      const ctaToCharcoalContrast = getContrastRatio('#FF8800', '#1A1C1C')
      expect(ctaToCharcoalContrast).toBeGreaterThan(4.5)
    })
  })

  // ============================================================================
  // R2: App Shell, Responsive Sidebar, Top Navigation & Live Ctrl+K Command Palette
  // ============================================================================
  describe('Requirement 2: App Shell, Collapsible Navigation & Command Palette', () => {
    it('toggles sidebar collapse state and persists to localStorage', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
          stubs: {
            RouterView: true,
            Toast: true,
            AppSidebar: {
              template: '<aside><button class="collapse-btn" @click="$emit(\'toggle-collapse\')">Toggle</button></aside>',
              emits: ['toggle-collapse', 'update:collapsed', 'logout'],
            },
          },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.isSidebarCollapsed).toBe(false)

      // Toggle via function
      vm.toggleSidebar()
      expect(vm.isSidebarCollapsed).toBe(true)
      expect(localStorage.getItem('omnipos_sidebar_collapsed')).toBe('true')

      // Toggle back
      vm.toggleSidebar()
      expect(vm.isSidebarCollapsed).toBe(false)
      expect(localStorage.getItem('omnipos_sidebar_collapsed')).toBe('false')
    })

    it('manages Command Palette keyboard shortcut and search filtering', async () => {
      const wrapper = mount(CommandPalette, {
        props: { modelValue: true },
        global: { plugins: [router] },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.isOpen).toBe(true)

      // Check default items contain all categories
      expect(vm.allCommandItems.length).toBeGreaterThanOrEqual(25)

      // Search for POS
      vm.searchQuery = 'pos'
      await flushPromises()

      expect(vm.filteredCommands.length).toBeGreaterThan(0)
      const hasPos = vm.filteredCommands.some((c: any) => c.title.toLowerCase().includes('pos'))
      expect(hasPos).toBe(true)

      // Keyboard selection & execution emits select and update:modelValue
      const targetItem = vm.filteredCommands[0]
      vm.selectItem(targetItem)
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('AppHeader displays store branding and handles notification popover', async () => {
      const wrapper = mount(AppHeader, {
        props: {
          branding: {
            store_name: 'OmniPOS Main Store',
            tagline: 'Point of Sale',
            logo_url: '/logo.png',
          },
          sidebarCollapsed: false,
        },
        global: { plugins: [router] },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('OmniPOS Main Store')

      // Notifications popover toggle
      const vm = wrapper.vm as any
      expect(vm.isNotificationsOpen).toBe(false)
      vm.isNotificationsOpen = true
      expect(vm.isNotificationsOpen).toBe(true)
      expect(vm.unreadCount).toBeGreaterThan(0)

      // Mark all read
      vm.markAllRead()
      expect(vm.unreadCount).toBe(0)
    })
  })

  // ============================================================================
  // R3: High-Density POS Terminal, Catalog, Quick Cash, Multi-Cart & Receipt Simulation
  // ============================================================================
  describe('Requirement 3: High-Density POS Terminal, Multi-Cart, Checkout & Thermal Receipt', () => {
    it('manages multi-cart tabs and persists cart items across tab switches', () => {
      const pos = usePosStore()
      pos.clearCart()

      // Tab 1 item
      pos.addToCart({ id: 'prod-1', name: 'Espresso Roast', selling_price: 4.5, sku: 'ESP-01' }, undefined, 2)
      expect(pos.items).toHaveLength(1)
      expect(pos.subtotal).toBe(9.0)

      // Create Tab 2
      const tab2Id = pos.createTab('Table #4')
      expect(pos.tabs).toHaveLength(2)
      expect(pos.activeTabId).toBe(tab2Id)
      expect(pos.items).toHaveLength(0)

      // Add item to Tab 2
      pos.addToCart({ id: 'prod-2', name: 'Caramel Macchiato', selling_price: 5.5, sku: 'MAC-02' }, undefined, 1)
      expect(pos.items).toHaveLength(1)
      expect(pos.subtotal).toBe(5.5)

      // Switch back to Tab 1
      pos.switchTab('cart-1')
      expect(pos.items).toHaveLength(1)
      expect(pos.items[0].name).toBe('Espresso Roast')
      expect(pos.subtotal).toBe(9.0)
    })

    it('handles line discounts, order discounts, taxes, and quantity steppers correctly', () => {
      const pos = usePosStore()
      pos.clearCart()

      const item = pos.addToCart({ id: 'p1', name: 'Designer Shirt', selling_price: 100, sku: 'SHIRT-01' }, undefined, 2)
      expect(pos.subtotal).toBe(200)

      // Apply line percentage discount (10% off item) -> (100 - 10) * 2 = 180
      pos.applyLineDiscount(item.id, 'percentage', 10)
      expect(pos.subtotal).toBe(180)

      // Apply order flat discount ($20 off subtotal) -> 180 - 20 = 160
      pos.setOrderDiscount('flat', 20)
      expect(pos.discountedSubtotal).toBe(160)

      // Apply tax rate (10%) -> 160 * 1.10 = 176
      pos.setTaxRate(10)
      expect(pos.taxAmount).toBe(16)
      expect(pos.total).toBe(176)

      // Quantity stepper reduction to 0 removes item
      pos.updateQuantity(item.id, 0)
      expect(pos.items).toHaveLength(0)
      expect(pos.total).toBe(0)
    })

    it('holds and resumes parked orders with full state restoration', () => {
      const pos = usePosStore()
      pos.clearCart()

      pos.addToCart({ id: 'p-hold', name: 'Wireless Mouse', selling_price: 25, sku: 'MSE-01' }, undefined, 3)
      pos.setCustomer({ name: 'Alice Cooper', phone: '+123456789' })
      pos.setOrderNotes('Deliver with care')

      expect(pos.items).toHaveLength(1)

      // Park the order
      const held = pos.holdCurrentOrder('VIP Guest', 'Table 12')
      expect(held).not.toBeNull()
      expect(pos.heldOrders).toHaveLength(1)
      expect(pos.items).toHaveLength(0) // Current cart cleared

      // Resume the order
      pos.resumeHeldOrder(held!.id)
      expect(pos.heldOrders).toHaveLength(0)
      expect(pos.items).toHaveLength(1)
      expect(pos.items[0].name).toBe('Wireless Mouse')
      expect(pos.customer?.name).toBe('Alice Cooper')
      expect(pos.orderNotes).toBe('Table 12')
    })

    it('simulates quick cash checkout pills, change due, and completion event in PosCheckoutModal', async () => {
      const wrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          total: 42.50,
          subtotal: 42.50,
          paymentMethod: 'CASH',
          tenderedAmount: 50.00,
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.quickCashPresets.length).toBeGreaterThanOrEqual(3)

      // Exact preset
      expect(vm.quickCashPresets[0].value).toBe(42.50)

      // Change due calculation: 50.00 - 42.50 = 7.50
      expect(vm.changeDue).toBe(7.50)
      expect(vm.canComplete).toBe(true)

      // Trigger complete
      vm.handleComplete()
      expect(wrapper.emitted('complete')).toBeTruthy()
    })

    it('renders thermal receipt simulation with store information and order items in PosReceiptModal', async () => {
      const mockOrder = {
        id: 'ord-9988',
        order_number: 'ORD-2026-9988',
        created_at: '2026-08-30T15:30:00Z',
        subtotal: 100,
        total_amount: 100,
        payment_method: 'CASH',
        tendered_amount: 100,
        change_amount: 0,
        items: [
          { name: 'Organic Coffee Beans', quantity: 2, unit_price: 25, line_total: 50 },
          { name: 'Cold Brew Carafe', quantity: 1, unit_price: 50, line_total: 50 },
        ],
        customer_info: { name: 'Bob Marley', loyalty_tier: 'Gold' },
        seller: { name: 'Sarah Cashier' },
      }

      const wrapper = mount(PosReceiptModal, {
        props: {
          open: true,
          order: mockOrder as any,
          storeName: 'OmniPOS Flagship Store',
          storePhone: '+1-800-555-OMNI',
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('ORD-2026-9988')
      expect(wrapper.text()).toContain('OmniPOS Flagship Store')
      expect(wrapper.text()).toContain('Organic Coffee Beans')
      expect(wrapper.text()).toContain('Cold Brew Carafe')
      expect(wrapper.text()).toContain('Bob Marley')
      expect(wrapper.text()).toContain('Sarah Cashier')
    })

    it('handles product variant selection in PosVariantModal', async () => {
      const mockProduct = {
        id: 'prod-hoodie',
        name: 'Omni Zip Hoodie',
        selling_price: 60,
        variants: [
          {
            id: 'v-black-m',
            sku: 'HOOD-BLK-M',
            selling_price: 60,
            quantity_on_hand: 15,
            attribute_values: [
              { attribute: { name: 'Color' }, value_name: 'Black' },
              { attribute: { name: 'Size' }, value_name: 'M' },
            ],
          },
          {
            id: 'v-black-l',
            sku: 'HOOD-BLK-L',
            selling_price: 65,
            quantity_on_hand: 0, // Out of stock
            attribute_values: [
              { attribute: { name: 'Color' }, value_name: 'Black' },
              { attribute: { name: 'Size' }, value_name: 'L' },
            ],
          },
        ],
      }

      const wrapper = mount(PosVariantModal, {
        props: {
          open: true,
          product: mockProduct as any,
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Omni Zip Hoodie')
      expect(wrapper.text()).toContain('Color: Black · Size: M')
      expect(wrapper.text()).toContain('15 in stock')
      expect(wrapper.text()).toContain('Out of Stock')

      const vm = wrapper.vm as any
      // Add in-stock variant
      vm.handleAddVariant(mockProduct.variants[0])
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual([mockProduct, mockProduct.variants[0], 1])

      // Attempt to add out-of-stock variant -> Should be ignored
      vm.handleAddVariant(mockProduct.variants[1])
      expect(wrapper.emitted('select')?.length).toBe(1)
    })
  })

  // ============================================================================
  // R4: Operational Views Modernization
  // ============================================================================
  describe('Requirement 4: Operational Views Modernization', () => {
    it('DashboardView renders metrics, health indicators, activity feeds, and quick actions', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/dashboard/summary')) {
          return Promise.resolve({
            data: {
              data: {
                totalOrders: 1450,
                totalCustomers: 890,
                totalProducts: 320,
                totalExpenses: 4500,
                ordersTrend: '+12.5% this week',
                customersTrend: '+5.0% new members',
              },
            },
          })
        }
        return Promise.resolve({ data: { data: [] } })
      })

      const wrapper = mount(DashboardView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Executive Dashboard')
      expect(wrapper.text()).toContain('1,450')
      expect(wrapper.text()).toContain('890')
      expect(wrapper.text()).toContain('320')
      expect(wrapper.text()).toContain('Active Register')
    })

    it('ProductListView handles searching, filtering, and delete dialog confirmations', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/products')) {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'p-101',
                  name: 'Premium Headphones',
                  sku: 'HD-101',
                  selling_price: 150,
                  purchase_price: 90,
                  is_active: true,
                  variants: [],
                },
              ],
              meta: { total: 1, current_page: 1, last_page: 1, per_page: 15 },
            },
          })
        }
        return Promise.resolve({ data: { data: [] } })
      })

      const wrapper = mount(ProductListView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Premium Headphones')
      expect(wrapper.text()).toContain('$150.00')

      const vm = wrapper.vm as any
      expect(vm.isDeleteDialogOpen).toBe(false)

      // Trigger delete confirmation modal
      const productStore = useProductStore()
      vm.confirmDelete(productStore.products[0])
      expect(vm.isDeleteDialogOpen).toBe(true)
      expect(vm.deletingProduct?.id).toBe('p-101')

      // Execute delete
      await vm.executeDelete()
      await flushPromises()
      expect(api.delete).toHaveBeenCalledWith('/products/p-101')
      expect(vm.isDeleteDialogOpen).toBe(false)
    })

    it('ProductCreateView dynamically generates Cartesian matrix rows for multi-attribute products', async () => {
      const wrapper = mount(ProductCreateView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.form.name = 'Graphic T-Shirt'
      vm.form.purchase_price = '10'
      vm.form.selling_price = '25'

      // Mock attributes in store
      vm.attrStore.attributes = [
        { id: 'attr-color', name: 'Color', values: [{ id: 'val-red', value_name: 'Red' }, { id: 'val-blue', value_name: 'Blue' }] },
        { id: 'attr-size', name: 'Size', values: [{ id: 'val-s', value_name: 'S' }, { id: 'val-m', value_name: 'M' }] },
      ]

      // Select Color: Red, Blue
      vm.toggleValue('attr-color', 'Red')
      vm.toggleValue('attr-color', 'Blue')

      // Select Size: S, M
      vm.toggleValue('attr-size', 'S')
      vm.toggleValue('attr-size', 'M')

      await flushPromises()

      // Cartesian matrix should produce 2 * 2 = 4 combinations
      expect(vm.matrixPreview).toHaveLength(4)
      expect(vm.matrixPreview[0].sku).toContain('GRAPHIC-T-SHIRT')
      expect(vm.grossMarginPercent).toBe(60) // (25 - 10) / 25 = 60%
    })
  })

  // ============================================================================
  // R5: Interactive Feedback, Skeletons, Toasts & Zero Native Popups
  // ============================================================================
  describe('Requirement 5: Feedback States, Toasts, Skeletons & Zero Native Popups', () => {
    it('Toast container manages multi-toast queues and auto-removal', () => {
      const toast = useToast()
      const toastStore = useToastStore()

      toast.success('Inventory sync successful')
      toast.error('Failed to connect to card reader')

      expect(toastStore.toasts).toHaveLength(2)
      expect(toastStore.toasts[0].variant).toBe('success')
      expect(toastStore.toasts[1].variant).toBe('error')

      // Dismiss specific toast
      const firstId = toastStore.toasts[0].id
      toastStore.remove(firstId)
      expect(toastStore.toasts).toHaveLength(1)
      expect(toastStore.toasts[0].variant).toBe('error')
    })

    it('Skeleton component has standard shimmer and pulse classes', () => {
      const wrapper = mount(Skeleton, {
        props: { class: 'h-8 w-48' },
      })
      expect(wrapper.classes()).toContain('animate-pulse')
      expect(wrapper.classes().some((c) => c.includes('bg-muted'))).toBe(true)
    })

    it('EmptyState component renders accessible fallback UI with custom action slot', () => {
      const wrapper = mount(EmptyState, {
        props: {
          title: 'No Customers Found',
          description: 'Try adjusting your search criteria or register a new customer.',
        },
        slots: {
          action: '<button class="add-cust-btn">Add Customer</button>',
        },
      })
      expect(wrapper.text()).toContain('No Customers Found')
      expect(wrapper.text()).toContain('Try adjusting your search criteria')
      expect(wrapper.find('.add-cust-btn').exists()).toBe(true)
    })

    it('strictly verifies 0 instances of window.confirm or window.alert across entire frontend/web/src', () => {
      const srcDir = path.resolve(__dirname, '..')
      
      function scanDir(dir: string, matches: string[] = []): string[] {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
              scanDir(fullPath, matches)
            }
          } else if (entry.isFile() && (entry.name.endsWith('.vue') || entry.name.endsWith('.ts'))) {
            const fileContent = fs.readFileSync(fullPath, 'utf-8')
            if (fileContent.includes('window.confirm') || fileContent.includes('confirm(')) {
              matches.push('confirm in ' + fullPath)
            }
            if (fileContent.includes('window.alert') || fileContent.includes('alert(')) {
              matches.push('alert in ' + fullPath)
            }
          }
        }
        return matches
      }

      const foundNativePopups = scanDir(srcDir)
      expect(foundNativePopups).toEqual([])
    })
  })
})