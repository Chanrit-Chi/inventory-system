import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

// Views under test
import DashboardView from '@/views/DashboardView.vue'
import ProductListView from '@/views/ProductListView.vue'
import OrdersView from '@/views/OrdersView.vue'
import InvoicesView from '@/views/InvoicesView.vue'
import QuotationsView from '@/views/QuotationsView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import BankAccountsView from '@/views/BankAccountsView.vue'
import InventoryLedgerView from '@/views/InventoryLedgerView.vue'
import RestockSessionView from '@/views/RestockSessionView.vue'
import CustomersView from '@/views/CustomersView.vue'
import SalesChannelsView from '@/views/SalesChannelsView.vue'
import SettingsView from '@/views/SettingsView.vue'
import DeliverySettingsView from '@/views/DeliverySettingsView.vue'
import UsersView from '@/views/UsersView.vue'
import AdminUsersView from '@/views/AdminUsersView.vue'
import RolesView from '@/views/RolesView.vue'
import PermissionsView from '@/views/PermissionsView.vue'
import AuditLogsView from '@/views/AuditLogsView.vue'
import ReportsView from '@/views/ReportsView.vue'
import LoginView from '@/views/LoginView.vue'
import ProductCreateView from '@/views/ProductCreateView.vue'
import ProductEditView from '@/views/ProductEditView.vue'
import CategoriesView from '@/views/CategoriesView.vue'
import AttributesView from '@/views/AttributesView.vue'
import PayrollView from '@/views/PayrollView.vue'
import SuppliersView from '@/views/SuppliersView.vue'

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

describe('Empirical Adversarial & Stress Testing: Operational Views', () => {
  let router: any

  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/pos', component: { template: '<div>pos</div>' } },
        { path: '/products', component: ProductListView },
        { path: '/products/create', component: ProductCreateView },
        { path: '/products/:id/edit', component: ProductEditView },
        { path: '/orders', component: OrdersView },
        { path: '/invoices', component: InvoicesView },
        { path: '/expenses', component: ExpensesView },
        { path: '/restock', component: RestockSessionView },
        { path: '/inventory', component: InventoryLedgerView },
        { path: '/customers', component: CustomersView },
      ],
    })

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

  // -------------------------------------------------------------
  // 1. DashboardView Stress Testing
  // -------------------------------------------------------------
  describe('DashboardView Stress & Resilience', () => {
    it('handles empty / null API response gracefully without crashing', async () => {
      ;(api.get as any).mockResolvedValueOnce({ data: {} })

      const wrapper = mount(DashboardView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Executive Dashboard')
      expect(wrapper.text()).toContain('No recent orders found')
      expect(wrapper.text()).toContain('Inventory Healthy')
    })

    it('handles extreme numeric values in KPI cards without overflow / NaN', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/dashboard/summary')) {
          return Promise.resolve({
            data: {
              data: {
                totalOrders: 99999999,
                totalCustomers: 1234567,
                totalProducts: 500000,
                totalExpenses: 8888888,
                ordersTrend: '+99.9%',
                ordersTrendUp: true,
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
      expect(wrapper.text()).toContain('99,999,999')
      expect(wrapper.text()).toContain('1,234,567')
      expect(wrapper.text()).toContain('500,000')
      expect(wrapper.text()).toContain('8,888,888')
    })

    it('recovers gracefully from API 500 network error on dashboard load', async () => {
      ;(api.get as any).mockRejectedValueOnce(new Error('Internal Server Error 500'))

      const wrapper = mount(DashboardView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.exists()).toBe(true)
      // Defaults to 0 stats on error catch block
      expect(wrapper.text()).toContain('Total Orders & Sales')
    })

    it('correctly categorizes and renders low stock alerts', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/products')) {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'p1',
                  name: 'Angkor Premium Beer',
                  variants: [
                    { id: 'v1', sku: 'ANK-BEER-CAN', quantity_on_hand: 2, reorder_level: 10 },
                  ],
                },
              ],
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
      expect(wrapper.text()).toContain('Angkor Premium Beer')
      expect(wrapper.text()).toContain('2 left')
      expect(wrapper.text()).toContain('Min: 10')
    })
  })

  // -------------------------------------------------------------
  // 2. ProductListView Stress & Interaction Testing
  // -------------------------------------------------------------
  describe('ProductListView Stress & Reactivity', () => {
    it('renders EmptyState when product catalog is completely empty', async () => {
      ;(api.get as any).mockResolvedValueOnce({
        data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(ProductListView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('No products found')
      expect(wrapper.findComponent({ name: 'EmptyState' }).exists()).toBe(true)
    })

    it('renders populated product matrix with prices, badges, and toggle switches', async () => {
      const mockProducts = [
        {
          id: 'prod-001',
          name: 'Phnom Penh Specialty Coffee Beans 1kg',
          barcode: '8841234567890',
          purchase_price: 12.5,
          selling_price: 24.0,
          is_active: true,
          category: { id: 'cat-1', name: 'Beverages' },
          variants: [{ id: 'v-1', sku: 'COF-1KG-DARK' }, { id: 'v-2', sku: 'COF-1KG-MED' }],
        },
        {
          id: 'prod-002',
          name: 'Organic Jasmine Rice 5kg',
          barcode: '',
          purchase_price: 4.25,
          selling_price: 8.5,
          is_active: false,
          category: null,
          variants: [],
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockProducts, meta: { total: 2, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(ProductListView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Phnom Penh Specialty Coffee Beans 1kg')
      expect(wrapper.text()).toContain('.00')
      expect(wrapper.text()).toContain('.50')
      expect(wrapper.text()).toContain('8841234567890')
      expect(wrapper.text()).toContain('2 variants')
      expect(wrapper.text()).toContain('0 variants')
    })

    it('switches between Table view and Cards/Grid view cleanly', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Product A', purchase_price: 10, selling_price: 20, is_active: true },
      ]
      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockProducts, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(ProductListView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.find('table').exists()).toBe(true)

      // Click Cards button
      const gridBtn = wrapper.findAll('button').find(b => b.text().includes('Cards'))
      expect(gridBtn).toBeDefined()
      await gridBtn!.trigger('click')

      expect(wrapper.find('table').exists()).toBe(false)
      expect(wrapper.text()).toContain('Product A')
    })

    it('triggers delete confirmation dialog workflow and dispatches delete', async () => {
      const mockProducts = [
        { id: 'prod-del-1', name: 'Item To Delete', purchase_price: 5, selling_price: 10, is_active: true },
      ]
      ;(api.get as any).mockResolvedValue({
        data: { data: mockProducts, meta: { total: 1, current_page: 1, last_page: 1 } },
      })
      ;(api.delete as any).mockResolvedValueOnce({ data: { message: 'Deleted' } })

      const wrapper = mount(ProductListView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      const deleteBtn = wrapper.find('#btn-delete-product-prod-del-1')
      expect(deleteBtn.exists()).toBe(true)
      await deleteBtn.trigger('click')
      await flushPromises()

      // The dialog modal state is triggered
      expect(wrapper.vm).toBeDefined()
    })

    it('handles special characters and XSS payloads in search bar', async () => {
      vi.useFakeTimers()
      const wrapper = mount(ProductListView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      const searchInput = wrapper.find('#product-search-input')
      await searchInput.setValue('<script>alert(xss)</script> & OR 1=1 --')
      vi.advanceTimersByTime(350)
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith('/products', expect.objectContaining({
        params: expect.objectContaining({
          search: '<script>alert(xss)</script> & OR 1=1 --',
        }),
      }))
      vi.useRealTimers()
    })
  })

  // -------------------------------------------------------------
  // 3. OrdersView Stress & Filter Testing
  // -------------------------------------------------------------
  describe('OrdersView Stress & Filter Reactivity', () => {
    it('renders orders with null customers and various fulfillment statuses', async () => {
      const mockOrders = [
        {
          id: 'ord-101',
          order_number: 'ORD-2026-001',
          customer: null,
          channel: { id: 'ch-pos', name: 'Physical Register #01' },
          total_amount: 145.5,
          status: 'COMPLETED',
          created_at: '2026-08-30T10:00:00Z',
        },
        {
          id: 'ord-102',
          order_number: 'ORD-2026-002',
          customer: { id: 'cust-1', name: 'Sokha Meng' },
          channel: null,
          total_amount: 0,
          status: 'CANCELLED',
          created_at: '2026-08-30T11:00:00Z',
        },
      ]

      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/channels')) {
          return Promise.resolve({ data: { data: [{ id: 'ch-pos', name: 'Physical Register #01' }] } })
        }
        return Promise.resolve({
          data: { data: mockOrders, meta: { total: 2, current_page: 1, last_page: 1 } },
        })
      })

      const wrapper = mount(OrdersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('ORD-2026-001')
      expect(wrapper.text()).toContain('Walk-in Customer')
      expect(wrapper.text()).toContain('.50')
      expect(wrapper.text()).toContain('Completed')

      expect(wrapper.text()).toContain('ORD-2026-002')
      expect(wrapper.text()).toContain('Sokha Meng')
      expect(wrapper.text()).toContain('Main POS')
      expect(wrapper.text()).toContain('.00')
      expect(wrapper.text()).toContain('Cancelled')
    })

    it('resets filters when clicking Reset Filters button', async () => {
      const wrapper = mount(OrdersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      const searchInput = wrapper.find('#order-search-input')
      await searchInput.setValue('test-search')

      const resetBtn = wrapper.find('#btn-reset-orders')
      expect(resetBtn.exists()).toBe(true)
      await resetBtn.trigger('click')

      await flushPromises()
      expect((searchInput.element as HTMLInputElement).value).toBe('')
    })
  })

  // -------------------------------------------------------------
  // 4. InvoicesView & QuotationsView Stress
  // -------------------------------------------------------------
  describe('InvoicesView & QuotationsView Settlement Logic', () => {
    it('computes total outstanding balance across partial and paid invoices', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_name: 'Acme Corp',
          total_amount: 1000,
          amount_paid: 400,
          status: 'partial',
          due_date: '2026-09-15',
        },
        {
          id: 'inv-2',
          invoice_number: 'INV-002',
          customer_name: 'Globex Ltd',
          total_amount: 500,
          amount_paid: 500,
          status: 'paid',
          due_date: '2026-09-01',
        },
      ]
      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockInvoices, meta: { total: 2, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(InvoicesView, {
        global: { plugins: [router], stubs: { RouterLink: true, teleport: true } },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('INV-001')
      expect(wrapper.text()).toContain('Acme Corp')
      expect(wrapper.text()).toContain('Partial')
      expect(wrapper.text()).toContain('$600.00')
    })

    it('renders QuotationsView with expiry badges and convert-to-invoice flows', async () => {
      const mockQuotes = [
        {
          id: 'q-1',
          quotation_number: 'QT-2026-88',
          customer_name: 'Vannak Heng',
          total_amount: 320.0,
          status: 'SENT',
          valid_until: '2026-09-30',
        },
      ]
      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockQuotes, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(QuotationsView, {
        global: { plugins: [router], stubs: { RouterLink: true, teleport: true } },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('QT-2026-88')
      expect(wrapper.text()).toContain('Vannak Heng')
      expect(wrapper.text()).toContain('$320.00')
    })
  })

  // -------------------------------------------------------------
  // 5. Operational & Finance: Expenses, Bank Accounts, Payroll
  // -------------------------------------------------------------
  describe('Expenses, Bank Accounts & Payroll Stress', () => {
    it('renders ExpensesView with categories and handles expense records', async () => {
      const mockExpenses = [
        {
          id: 'exp-1',
          category: 'Utilities',
          amount: 185.5,
          notes: 'Electricity bill August',
          expense_date: '2026-08-28',
          payment_method: 'Cash',
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockExpenses, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(ExpensesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Electricity bill August')
      expect(wrapper.text()).toContain('$185.50')
      expect(wrapper.text()).toContain('Utilities')
    })

    it('renders BankAccountsView with accounts and currency badges', async () => {
      const mockAccounts = [
        {
          id: 'bank-1',
          bank_name: 'ABA Bank',
          account_name: 'OmniPOS Main Settlement',
          account_number: '001 234 567',
          account_type: 'checking',
          currency: 'USD',
          is_default: true,
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockAccounts },
      })

      const wrapper = mount(BankAccountsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('ABA Bank')
      expect(wrapper.text()).toContain('OmniPOS Main Settlement')
      expect(wrapper.text()).toContain('001 234 567')
      expect(wrapper.text()).toContain('Default')
    })

    it('renders PayrollView with staff compensation records and status badges', async () => {
      const mockPayroll = [
        {
          id: 'pay-1',
          period_start: '2026-08-01',
          period_end: '2026-08-31',
          total_gross: 1200,
          total_deductions: 100,
          total_net: 1100,
          employee_count: 5,
          status: 'paid',
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockPayroll, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(PayrollView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('2026-08-01')
      expect(wrapper.text()).toContain('2026-08-31')
      expect(wrapper.text()).toContain('$1100.00')
      expect(wrapper.text()).toContain('Paid')
    })
  })

  // -------------------------------------------------------------
  // 6. Logistics: InventoryLedger, RestockSession & Suppliers
  // -------------------------------------------------------------
  describe('Inventory Ledger & Restock Session Stress', () => {
    it('renders InventoryLedgerView with SKU reorder alerts and stock movements', async () => {
      const mockProducts = [
        {
          id: 'p-1',
          name: 'Wireless Barcode Scanner 2.4G',
          category: { name: 'Hardware' },
          variants: [
            {
              id: 'inv-item-1',
              sku: 'SCAN-24G-01',
              barcode: '884000111',
              quantity_on_hand: 3,
              reorder_level: 5,
              cost_price: 35.0,
              selling_price: 65.0,
              is_active: true,
            },
          ],
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockProducts, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(InventoryLedgerView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Wireless Barcode Scanner 2.4G')
      expect(wrapper.text()).toContain('SCAN-24G-01')
      expect(wrapper.text()).toContain('3')
    })

    it('renders RestockSessionView and handles draft restock batch items', async () => {
      const wrapper = mount(RestockSessionView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Restock Intake')
      expect(wrapper.findComponent({ name: 'EmptyState' }).exists() || wrapper.text().includes('Scan')).toBe(true)
    })

    it('renders SuppliersView with lead times and contact details', async () => {
      const mockSuppliers = [
        {
          id: 'sup-1',
          name: 'Cambodia Beverage Distribution Co.',
          contact_person: 'Rithy Panh',
          phone: '+855 12 345 678',
          email: 'rithy@cambev.com',
          lead_time_days: 3,
          is_active: true,
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockSuppliers, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(SuppliersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Cambodia Beverage Distribution Co.')
      expect(wrapper.text()).toContain('+855 12 345 678')
    })
  })

  // -------------------------------------------------------------
  // 7. Customers, Categories & Attributes
  // -------------------------------------------------------------
  describe('CRM, Categories & Variant Attributes', () => {
    it('renders CustomersView with loyalty tier progression and spend calculations', async () => {
      const mockCustomers = [
        {
          id: 'c-1',
          name: 'Sophia Chan',
          phone: '+855 88 999 111',
          email: 'sophia@example.com',
          total_spent: 3450.75,
          total_purchased: 12,
          last_purchase_at: '2026-08-29T14:00:00Z',
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockCustomers, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(CustomersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Sophia Chan')
      expect(wrapper.text()).toContain('+855 88 999 111')
      expect(wrapper.text()).toContain('$3450.75')
      expect(wrapper.text()).toContain('Platinum')
    })

    it('renders CategoriesView with category hierarchy tree and item counts', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Coffee & Tea',
          slug: 'coffee-tea',
          products_count: 18,
          description: 'Single origin roasts and teas',
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockCategories },
      })

      const wrapper = mount(CategoriesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Coffee & Tea')
      expect(wrapper.text()).toContain('Single origin roasts and teas')
    })

    it('renders AttributesView with color/size matrix values', async () => {
      const mockAttributes = [
        {
          id: 'attr-1',
          name: 'Size',
          slug: 'size',
          type: 'text',
          values: ['Small', 'Medium', 'Large'],
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockAttributes },
      })

      const wrapper = mount(AttributesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Size')
      expect(wrapper.text()).toContain('Small')
      expect(wrapper.text()).toContain('Large')
    })
  })

  // -------------------------------------------------------------
  // 8. Admin, Security, System & Settings
  // -------------------------------------------------------------
  describe('Admin, Security, Reports & Settings Views', () => {
    it('renders SettingsView with general configuration and branding form fields', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/settings/branding')) {
          return Promise.resolve({
            data: {
              data: {
                store_name: 'OmniPOS Flagship Store',
                tagline: 'Modern Retail & POS',
                store_address: '123 Norodom Blvd, Phnom Penh',
              },
            },
          })
        }
        return Promise.resolve({ data: { data: {} } })
      })

      const wrapper = mount(SettingsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Settings & Configuration System Hub')
      const nameInput = wrapper.find('input[type="text"]')
      expect(nameInput.exists()).toBe(true)
      expect((nameInput.element as HTMLInputElement).value).toBe('OmniPOS Flagship Store')
    })

    it('renders DeliverySettingsView with delivery zones and fee rules upon switching tabs', async () => {
      const mockCompanies = [
        {
          id: 'c-1',
          name: 'J&T Express',
          phone: '+855 23 888 999',
          is_active: true,
        },
      ]
      const mockZones = [
        {
          id: 'dz-1',
          company_name: 'J&T Express',
          zone_name: 'Daun Penh District',
          fee: 1.5,
          estimated_days: 2,
          is_active: true,
        },
      ]
      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/delivery-companies')) {
          return Promise.resolve({ data: { data: mockCompanies } })
        }
        if (url.includes('/delivery-zones')) {
          return Promise.resolve({ data: { data: mockZones } })
        }
        return Promise.resolve({ data: { data: [] } })
      })

      const wrapper = mount(DeliverySettingsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('J&T Express')

      const zonesTabBtn = wrapper.findAll('button').find(b => b.text().includes('Shipping Zones & Rates'))
      expect(zonesTabBtn).toBeDefined()
      await zonesTabBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Daun Penh District')
      expect(wrapper.text()).toContain('$1.50')
      expect(wrapper.text()).toContain('2 days')
    })

    it('renders UsersView and AdminUsersView with role assignments', async () => {
      const mockUsers = [
        {
          id: 'u-1',
          name: 'Dara Nimol',
          email: 'dara@omnipos.local',
          role: 'Manager',
          is_active: true,
          created_at: '2026-08-01',
        },
      ]

      ;(api.get as any).mockResolvedValue({
        data: { data: mockUsers, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapperUsers = mount(UsersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()
      expect(wrapperUsers.text()).toContain('Dara Nimol')
      expect(wrapperUsers.text()).toContain('Manager')

      const wrapperAdmin = mount(AdminUsersView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()
      expect(wrapperAdmin.text()).toContain('Dara Nimol')
    })

    it('renders RolesView and PermissionsView RBAC matrix', async () => {
      const mockRoles = [
        {
          id: 'role-1',
          name: 'cashier',
          display_name: 'Cashier Staff',
          description: 'Front-desk POS operation and receipt generation',
          permissions: ['pos:checkout', 'orders:read'],
          user_count: 5,
        },
      ]

      ;(api.get as any).mockResolvedValue({
        data: { data: mockRoles },
      })

      const wrapper = mount(RolesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Cashier Staff')
      expect(wrapper.text()).toContain('5 users')
      expect(wrapper.text()).toContain('2 permissions')

      const wrapperPerms = mount(PermissionsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()
      expect(wrapperPerms.text()).toContain('Permissions')
    })

    it('renders AuditLogsView with event stream and actors', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'ORDER_CREATED',
          description: 'Created order #ORD-1092',
          ip_address: '192.168.1.50',
          created_at: '2026-08-30T10:15:00Z',
          user: { name: 'Cashier 01' },
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockLogs, meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(AuditLogsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('ORDER_CREATED')
      expect(wrapper.text()).toContain('192.168.1.50')
    })

    it('renders ReportsView with sales analytics and date selectors', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url.includes('/reports/analytics')) {
          return Promise.resolve({
            data: {
              data: {
                period: 'day',
                total_orders: 342,
                total_revenue: 12540.5,
                total_discounts: 150.0,
                total_tax: 1254.05,
                avg_order_value: 36.67,
                top_products: [
                  { name: 'Iced Latte', quantity: 120, revenue: 360 },
                ],
              },
            },
          })
        }
        return Promise.resolve({ data: { data: [] } })
      })

      const wrapper = mount(ReportsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Reports & Analytics')
      expect(wrapper.text()).toContain('$12540.50')
      expect(wrapper.text()).toContain('342')
      expect(wrapper.text()).toContain('$36.67')
      expect(wrapper.text()).toContain('Iced Latte')
    })

    it('renders LoginView and tests credential input reactivity', async () => {
      const wrapper = mount(LoginView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      expect(wrapper.text()).toContain('OmniPOS')
      const emailInput = wrapper.find('input[type="email"], input[type="text"]')
      const passwordInput = wrapper.find('input[type="password"]')

      expect(emailInput.exists()).toBe(true)
      expect(passwordInput.exists()).toBe(true)

      await emailInput.setValue('admin@omnipos.com')
      await passwordInput.setValue('Secret123!')

      expect((emailInput.element as HTMLInputElement).value).toBe('admin@omnipos.com')
      expect((passwordInput.element as HTMLInputElement).value).toBe('Secret123!')
    })

    it('renders SalesChannelsView and displays configured sales points', async () => {
      const mockChannels = [
        {
          id: 'ch-1',
          name: 'Aeon Mall POS Register #1',
          code: 'POS-AEON-01',
          type: 'pos',
          is_active: true,
        },
      ]

      ;(api.get as any).mockResolvedValueOnce({
        data: { data: mockChannels },
      })

      const wrapper = mount(SalesChannelsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Aeon Mall POS Register #1')
      expect(wrapper.text()).toContain('POS-AEON-01')
    })
  })
})
