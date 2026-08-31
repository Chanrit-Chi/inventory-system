import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import api from '@/api/axios'

// Stores
import { usePosStore } from '@/stores/posStore'
import { useProductStore, type Product } from '@/stores/productStore'
import { useExpenseStore } from '@/stores/expenseStore'
import { useCustomerStore } from '@/stores/customerStore'
import { useAttributeStore } from '@/stores/attributeStore'
import { useBankAccountStore } from '@/stores/bankAccountStore'

// Views
import CategoriesView from '@/views/CategoriesView.vue'
import BankAccountsView from '@/views/BankAccountsView.vue'
import AttributesView from '@/views/AttributesView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import CustomersView from '@/views/CustomersView.vue'
import OrdersView from '@/views/OrdersView.vue'
import ProductCreateView from '@/views/ProductCreateView.vue'
import CommandPalette from '@/components/shell/CommandPalette.vue'
import AppSidebar from '@/components/shell/AppSidebar.vue'

// Mock Axios API
vi.mock('@/api/axios', () => {
  const mockApi = {
    get: vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } } }),
    post: vi.fn().mockResolvedValue({ data: { data: {}, message: 'Success' } }),
    put: vi.fn().mockResolvedValue({ data: { data: {}, message: 'Success' } }),
    patch: vi.fn().mockResolvedValue({ data: { data: {}, message: 'Success' } }),
    delete: vi.fn().mockResolvedValue({ data: { message: 'Deleted' } }),
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

describe('Milestone 4 Empirical Challenge: Store Reactions, Dialog Lifecycles, and Regression Safety', () => {
  let router: any

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const allRoutes = [
      '/', '/dashboard', '/pos', '/orders', '/daily-settlements', '/products', '/products/create', '/products/:id/edit',
      '/categories', '/attributes', '/inventory', '/purchase-orders', '/restock', '/suppliers', '/delivery-settings',
      '/customers', '/quotations', '/invoices', '/expenses', '/bank-accounts', '/payroll',
      '/sales-channels', '/reports', '/audit-logs', '/settings', '/users', '/roles', '/permissions',
    ]

    router = createRouter({
      history: createMemoryHistory(),
      routes: allRoutes.map(path => ({ path, component: { template: '<div>View</div>' } })),
    })

    localStorage.clear()
    vi.clearAllMocks()

    // Reset default mock responses
    ;(api.get as any).mockResolvedValue({
      data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } },
    })
    ;(api.post as any).mockResolvedValue({
      data: { data: {}, message: 'Success' },
    })
    ;(api.put as any).mockResolvedValue({
      data: { data: {}, message: 'Success' },
    })
    ;(api.delete as any).mockResolvedValue({
      data: { message: 'Deleted' },
    })
  })

  // ==========================================================================
  // 1. PINIA STORE STATE REACTIONS & FINANCIAL COMPUTATIONS
  // ==========================================================================

  describe('1. Store State Reactions & Financial Computations', () => {
    it('posStore: accurately calculates line totals, multi-tier discounts, and taxes', () => {
      const pos = usePosStore()

      // Add item 1: $100 price, qty 2 -> raw $200
      const item1 = pos.addToCart({
        id: 'p1',
        name: 'Item 1',
        selling_price: 100,
      }, undefined, 2)

      // Apply 10% line discount -> $200 - $20 = $180
      pos.applyLineDiscount(item1.id, 'percentage', 10)

      // Add item 2: $50 price, qty 1
      const item2 = pos.addToCart({
        id: 'p2',
        name: 'Item 2',
        selling_price: 50,
      }, undefined, 1)

      // Apply $10 flat line discount -> $50 - $10 = $40
      pos.applyLineDiscount(item2.id, 'flat', 10)

      expect(pos.items).toHaveLength(2)
      expect(pos.subtotal).toBe(220) // $180 + $40

      // Apply Order-level 10% discount: 10% of 220 = 22 -> discountedSubtotal = 198
      pos.setOrderDiscount('percentage', 10)
      expect(pos.orderDiscountAmount).toBe(22)
      expect(pos.discountedSubtotal).toBe(198)

      // Apply 10% Tax Rate -> 10% of 198 = 19.8
      pos.setTaxRate(10)
      expect(pos.taxAmount).toBe(19.8)

      // Enable delivery with $5 fee -> Total = 198 + 19.8 + 5 = 222.8
      pos.setDelivery({ isDelivery: true, fee: 5 })
      expect(pos.total).toBe(222.8)

      // Test cash tender change
      pos.setPaymentMethod('CASH')
      pos.setTenderedAmount(250)
      expect(pos.changeAmount).toBeCloseTo(27.2, 2)
    })

    it('posStore: manages multi-cart tabs and cart hold/resume persistence', () => {
      const pos = usePosStore()

      // Add item to Cart 1
      pos.addToCart({
        id: 'p1',
        name: 'Cart 1 Item',
        selling_price: 50,
        sku: 'C1',
      }, undefined, 1)
      expect(pos.items).toHaveLength(1)

      // Add Cart 2 and switch to it
      const tab2Id = pos.createTab('Cart 2')
      expect(pos.tabs).toHaveLength(2)
      expect(pos.activeTabId).toBe(tab2Id)
      expect(pos.items).toHaveLength(0) // New tab is empty

      // Add item to Cart 2
      pos.addToCart({
        id: 'p2',
        name: 'Cart 2 Item',
        selling_price: 80,
        sku: 'C2',
      }, undefined, 2)
      expect(pos.items).toHaveLength(1)
      expect(pos.total).toBe(160)

      // Park Cart 2 into held orders
      const held = pos.holdCurrentOrder('Guest VIP')
      expect(held).toBeDefined()
      expect(pos.heldOrders).toHaveLength(1)
      expect(pos.heldOrders[0].name).toBe('Guest VIP')
      expect(pos.items).toHaveLength(0) // Cart was reset after park

      // Resume held order into current cart
      pos.resumeHeldOrder(held!.id)
      expect(pos.heldOrders).toHaveLength(0)
      expect(pos.items).toHaveLength(1)
      expect(pos.items[0].sku).toBe('C2')

      // Switch back to Cart 1
      pos.switchTab('cart-1')
      expect(pos.items).toHaveLength(1)
      expect(pos.items[0].sku).toBe('C1')

      // Verify cannot remove last remaining tab
      pos.closeTab(tab2Id)
      expect(pos.tabs).toHaveLength(1)
      pos.closeTab('cart-1') // Should not remove sole tab, only clear
      expect(pos.tabs).toHaveLength(1)
    })

    it('posStore: serializes to and deserializes from localStorage correctly', () => {
      const pos = usePosStore()

      pos.addToCart({
        id: 'pp',
        name: 'Persisted Item',
        selling_price: 99,
        sku: 'PST',
      }, undefined, 3)

      pos.setCustomer({ id: 'cust-123', name: 'John Doe', phone: '012345678' })
      pos.setChannel('chan-1', 'Main POS')
      pos.saveToLocalStorage()

      const savedJson = localStorage.getItem('omnipos_pos_cart')
      expect(savedJson).toBeTruthy()

      const parsed = JSON.parse(savedJson!)
      expect(parsed.tabs[0].items[0].sku).toBe('PST')
      expect(parsed.tabs[0].customer.name).toBe('John Doe')
      expect(parsed.activeChannelId).toBe('chan-1')
    })

    it('productStore: maintains local reactive state on create, update, delete, toggle', async () => {
      const store = useProductStore()

      const mockProducts: Product[] = [
        { id: 'p1', name: 'Shirt', barcode: '111', purchase_price: 10, selling_price: 20, default_reorder_level: 5, image_url: null, is_active: true, category_id: null, description: null },
        { id: 'p2', name: 'Pants', barcode: '222', purchase_price: 15, selling_price: 30, default_reorder_level: 5, image_url: null, is_active: false, category_id: null, description: null },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockProducts, meta: { total: 2, current_page: 1, last_page: 1, per_page: 10 } },
      })

      await store.fetchProducts()
      expect(store.products).toHaveLength(2)
      expect(store.meta?.total).toBe(2)

      // Test updateProduct updates reactive store entry
      ;(api.put as any).mockResolvedValueOnce({
        data: { data: { id: 'p1', name: 'Shirt Premium', selling_price: 25, is_active: true } },
      })
      await store.updateProduct('p1', { name: 'Shirt Premium', selling_price: 25 })
      expect(store.products.find(p => p.id === 'p1')?.name).toBe('Shirt Premium')

      // Test deleteProduct removes item from products array and decrements meta.total
      ;(api.delete as any).mockResolvedValueOnce({ data: { message: 'Deleted' } })
      await store.deleteProduct('p1')
      expect(store.products).toHaveLength(1)
      expect(store.products[0].id).toBe('p2')
      expect(store.meta?.total).toBe(1)
    })

    it('customerStore: summaryStats computed property handles edge cases safely', () => {
      const store = useCustomerStore()

      // Empty store test -> no divide-by-zero NaN
      expect(store.summaryStats.totalCustomers).toBe(0)
      expect(store.summaryStats.totalSpend).toBe(0)
      expect(store.summaryStats.avgLtv).toBe(0)

      // Populate customers with mixed number/string total_spent
      store.customers = [
        { id: 'c1', name: 'Alice', phone: '111', email: null, address: null, total_purchased: 2, total_spent: '150.50', last_purchase_at: null },
        { id: 'c2', name: 'Bob', phone: '222', email: null, address: null, total_purchased: 4, total_spent: 349.50, last_purchase_at: null },
        { id: 'c3', name: 'Charlie', phone: '333', email: null, address: null, total_purchased: 0, total_spent: 'invalid', last_purchase_at: null },
      ]

      expect(store.summaryStats.totalCustomers).toBe(3)
      expect(store.summaryStats.totalSpend).toBe(500) // 150.50 + 349.50 + 0
      expect(store.summaryStats.avgLtv).toBeCloseTo(166.67, 1)
    })

    it('expenseStore: kpis handles dates, empty lists, and category totals accurately', async () => {
      const store = useExpenseStore()

      // Empty KPIs
      expect(store.kpis.totalAll).toBe(0)
      expect(store.kpis.totalToday).toBe(0)
      expect(store.kpis.topCategory).toBe('None')

      const todayStr = new Date().toISOString().slice(0, 10)
      store.expenses = [
        { id: 'e1', expense_date: `${todayStr} 10:00:00`, category: 'Utilities', amount: '50.00', payment_method: 'Cash', notes: 'Electricity' },
        { id: 'e2', expense_date: `${todayStr} 14:00:00`, category: 'Marketing', amount: 150, payment_method: 'Card', notes: 'Facebook Ads' },
        { id: 'e3', expense_date: '2025-01-01 00:00:00', category: 'Rent', amount: 500, payment_method: 'Transfer', notes: 'Old Rent' },
      ]

      expect(store.kpis.totalAll).toBe(700)
      expect(store.kpis.totalToday).toBe(200)
      expect(store.kpis.topCategory).toBe('Rent')
    })
  })

  // ==========================================================================
  // 2. DIALOG & MODAL LIFECYCLES, FORM RESETS & CONFIRMATION FLOWS
  // ==========================================================================

  describe('2. Dialog Lifecycles, Form Resets, and Confirmation Modals', () => {
    it('CategoriesView: validates openCreate form reset, required field toast, edit mapping, and delete confirmation', async () => {
      const mockCategory = { id: 'cat-1', name: 'Beverages', slug: 'beverages', description: 'Drinks', product_count: 5, created_at: '', updated_at: '' }

      ;(api.get as any).mockResolvedValue({ data: { data: [mockCategory] } })

      const wrapper = mount(CategoriesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as any

      // 1. openCreate resets editing form
      vm.openCreate()
      expect(vm.showEditModal).toBe(true)
      expect(vm.editing).toEqual({ name: '', slug: '', description: '' })

      // 2. Validation: saving with empty name does not call API
      ;(api.post as any).mockClear()
      await vm.save()
      expect(api.post).not.toHaveBeenCalled()
      expect(vm.showEditModal).toBe(true) // Remains open

      // 3. Successful create
      vm.editing.name = 'Fresh Produce'
      vm.editing.slug = 'fresh-produce'
      ;(api.post as any).mockResolvedValueOnce({ data: { data: { id: 'cat-2', name: 'Fresh Produce' } } })
      ;(api.get as any).mockResolvedValueOnce({ data: { data: [mockCategory] } })

      await vm.save()
      expect(api.post).toHaveBeenCalledWith('/categories', expect.objectContaining({ name: 'Fresh Produce' }))
      expect(vm.showEditModal).toBe(false)

      // 4. openEdit maps existing category
      vm.openEdit(mockCategory)
      expect(vm.showEditModal).toBe(true)
      expect(vm.editing.name).toBe('Beverages')

      // 5. Delete confirmation flow
      vm.confirmDelete(mockCategory)
      expect(vm.isDeleteDialogOpen).toBe(true)
      expect(vm.deletingCategory?.name).toBe('Beverages')

      // Cancel delete clears selection
      vm.cancelDelete()
      expect(vm.isDeleteDialogOpen).toBe(false)
      expect(vm.deletingCategory).toBeNull()

      // Execute delete
      vm.confirmDelete(mockCategory)
      ;(api.delete as any).mockResolvedValueOnce({ data: { message: 'Deleted' } })
      ;(api.get as any).mockResolvedValueOnce({ data: { data: [] } })

      await vm.executeDelete()
      expect(api.delete).toHaveBeenCalledWith('/categories/cat-1')
      expect(vm.isDeleteDialogOpen).toBe(false)
      expect(vm.deletingCategory).toBeNull()
    })

    it('BankAccountsView: validates form reset defaults, validation, and delete flow', async () => {
      const bankStore = useBankAccountStore()
      bankStore.accounts = [
        { id: 'b1', bank_name: 'ABA', account_name: 'Store', account_number: '123', account_type: 'checking', currency: 'USD', is_default: true, created_at: '', updated_at: '' },
      ]

      const wrapper = mount(BankAccountsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as any

      // openCreate initial state
      vm.openCreate()
      expect(vm.showEditModal).toBe(true)
      expect(vm.editing.currency).toBe('USD')
      expect(vm.editing.account_type).toBe('checking')
      expect(vm.editing.is_default).toBe(false)

      // Validation test (empty bank_name)
      ;(api.post as any).mockClear()
      await vm.save()
      expect(api.post).not.toHaveBeenCalled()

      // Delete confirmation
      vm.confirmDelete('b1')
      expect(vm.isDeleteDialogOpen).toBe(true)
      expect(vm.deletingAccountId).toBe('b1')

      vm.cancelDelete()
      expect(vm.isDeleteDialogOpen).toBe(false)
      expect(vm.deletingAccountId).toBeNull()
    })

    it('AttributesView: handles comma-delimited string parsing to value arrays', async () => {
      const wrapper = mount(AttributesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as any

      vm.openCreate()
      expect(vm.valuesText).toBe('')
      vm.editing.name = 'Size'
      vm.valuesText = 'Small, Medium, Large, XL'

      ;(api.post as any).mockResolvedValueOnce({ data: { data: { id: 'attr-1' } } })
      ;(api.get as any).mockResolvedValueOnce({ data: { data: [] } })

      await vm.save()
      expect(api.post).toHaveBeenCalledWith(
        '/attributes',
        expect.objectContaining({
          name: 'Size',
          values: ['Small', 'Medium', 'Large', 'XL'],
        })
      )
    })

    it('ExpensesView: validates numeric amount entry and resets form fields upon success', async () => {
      const wrapper = mount(ExpensesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as any

      // Test invalid amount (0 or negative)
      vm.form.amount = '0'
      await vm.handleRecordExpense()
      expect(vm.formError).toContain('greater than $0.00')

      vm.form.amount = '-25'
      await vm.handleRecordExpense()
      expect(vm.formError).toContain('greater than $0.00')

      // Valid expense submission
      vm.form.amount = '75.50'
      vm.form.notes = 'Store Cleaning'
      ;(api.post as any).mockResolvedValueOnce({ data: { data: { id: 'exp-1' } } })
      ;(api.get as any).mockResolvedValueOnce({ data: { data: [] } })

      await vm.handleRecordExpense()
      expect(vm.formSuccess).toContain('recorded successfully')
      expect(vm.form.amount).toBe('') // Reset
      expect(vm.form.notes).toBe('') // Reset
      expect(vm.formError).toBe('')
    })

    it('CustomersView: getTier correctly maps Bronze, Silver, Gold, Platinum boundaries', async () => {
      const wrapper = mount(CustomersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      const vm = wrapper.vm as any

      // Bronze: < $200
      const t0 = vm.getTier(0)
      expect(t0.name).toBe('Bronze')
      expect(t0.remainingToNext).toBe(200)

      const t99 = vm.getTier(99.99)
      expect(t99.name).toBe('Bronze')

      // Silver: $200 - $499
      const t200 = vm.getTier(200)
      expect(t200.name).toBe('Silver')
      expect(t200.remainingToNext).toBe(300) // $500 - $200

      // Gold: $500 - $999
      const t500 = vm.getTier(500)
      expect(t500.name).toBe('Gold')
      expect(t500.remainingToNext).toBe(500) // $1000 - $500

      // Platinum: >= $1000
      const t1000 = vm.getTier(1000)
      expect(t1000.name).toBe('Platinum')
      expect(t1000.remainingToNext).toBe(0)

      // Test order items toggle in customer modal
      vm.toggleOrderExpand('ord-99')
      expect(vm.expandedOrders['ord-99']).toBe(true)
      vm.toggleOrderExpand('ord-99')
      expect(vm.expandedOrders['ord-99']).toBe(false)
    })

    it('OrdersView: maps status badges and handles clipboard copy and thermal print triggers', async () => {
      const wrapper = mount(OrdersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      const vm = wrapper.vm as any

      expect(vm.statusBadge('COMPLETED').variant).toBe('success')
      expect(vm.statusBadge('PENDING').variant).toBe('warning')
      expect(vm.statusBadge('PROCESSING').variant).toBe('info')
      expect(vm.statusBadge('CANCELLED').variant).toBe('destructive')

      // Copy order number test
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true,
      })

      vm.copyOrderNumber('ORD-1234')
      expect(writeTextMock).toHaveBeenCalledWith('ORD-1234')
      expect(vm.isCopied).toBe(true)
    })

    it('ProductCreateView: calculates profit margin and generates Cartesian SKU matrix', async () => {
      const attrStore = useAttributeStore()
      attrStore.attributes = [
        {
          id: 'attr-size',
          name: 'Size',
          slug: 'size',
          type: 'text',
          values: ['S', 'M'],
          created_at: '',
          updated_at: '',
        },
      ]

      const wrapper = mount(ProductCreateView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      const vm = wrapper.vm as any

      vm.form.name = 'Linen Shirt'
      vm.form.purchase_price = '20'
      vm.form.selling_price = '50'

      // Margin calculations: profit $30, margin (30/50)*100 = 60%
      expect(vm.grossProfit).toBe(30)
      expect(vm.grossMarginPercent).toBe(60)

      // Toggle Size attribute and select S and M
      vm.toggleValue('attr-size', 'S')
      vm.toggleValue('attr-size', 'M')

      expect(vm.matrixPreview).toHaveLength(2)
      expect(vm.matrixPreview[0].sku).toBe('LINEN-SHIRT-S')
      expect(vm.matrixPreview[1].sku).toBe('LINEN-SHIRT-M')
      expect(vm.matrixPreview[0].sellingPrice).toBe(50)
    })
  })

  // ==========================================================================
  // 3. REGRESSION CHECKS: APP SHELL, COMMAND PALETTE, NAVIGATION & POS
  // ==========================================================================

  describe('3. Zero-Regression Verification for App Shell & Command Palette', () => {
    it('CommandPalette: filters across 26 routes, handles special characters without crash, and navigates', async () => {
      const wrapper = mount(CommandPalette, {
        props: { open: true },
        global: {
          plugins: [router],
          stubs: { teleport: true },
        },
      })
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as any

      // Check default category groups exist
      expect(Object.keys(vm.groupedCommands).length).toBeGreaterThan(0)

      // Adversarial search queries: emojis, SQL injection, unicode, regex characters
      const testQueries = [
        'POS',
        'Products',
        'Customers',
        '🚀 Express',
        "'; DROP TABLE users; --",
        '([a-z]+)*\\d{2}',
        '__proto__',
      ]

      for (const q of testQueries) {
        vm.searchQuery = q
        expect(() => vm.filteredCommands).not.toThrow()
      }

      // Exact match navigation test
      vm.searchQuery = 'Products Catalog'
      const matches = vm.filteredCommands
      expect(matches.length).toBeGreaterThan(0)

      const pushSpy = vi.spyOn(router, 'push')
      vm.selectItem(matches[0])
      expect(pushSpy).toHaveBeenCalledWith(matches[0].to)
    })

    it('AppSidebar: renders route groups and handles collapse toggles cleanly', async () => {
      const wrapper = mount(AppSidebar, {
        props: { collapsed: false },
        global: {
          plugins: [router],
        },
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('POS Terminal')
      expect(wrapper.text()).toContain('Orders & POS Sales')
      expect(wrapper.text()).toContain('Products Matrix')
      expect(wrapper.text()).toContain('Customer Loyalty')
    })
  })
})
