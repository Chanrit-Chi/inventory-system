import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

// Import all 27 views
import AdminUsersView from '@/views/AdminUsersView.vue'
import AttributesView from '@/views/AttributesView.vue'
import AuditLogsView from '@/views/AuditLogsView.vue'
import BankAccountsView from '@/views/BankAccountsView.vue'
import CategoriesView from '@/views/CategoriesView.vue'
import CustomersView from '@/views/CustomersView.vue'
import DashboardView from '@/views/DashboardView.vue'
import DeliverySettingsView from '@/views/DeliverySettingsView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import InventoryLedgerView from '@/views/InventoryLedgerView.vue'
import InvoicesView from '@/views/InvoicesView.vue'
import LoginView from '@/views/LoginView.vue'
import OrdersView from '@/views/OrdersView.vue'
import POSView from '@/views/POSView.vue'
import PayrollView from '@/views/PayrollView.vue'
import PermissionsView from '@/views/PermissionsView.vue'
import ProductCreateView from '@/views/ProductCreateView.vue'
import ProductEditView from '@/views/ProductEditView.vue'
import ProductListView from '@/views/ProductListView.vue'
import QuotationsView from '@/views/QuotationsView.vue'
import ReportsView from '@/views/ReportsView.vue'
import RestockSessionView from '@/views/RestockSessionView.vue'
import RolesView from '@/views/RolesView.vue'
import SalesChannelsView from '@/views/SalesChannelsView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SuppliersView from '@/views/SuppliersView.vue'


import DailySettlementsView from '@/views/DailySettlementsView.vue'
import PurchaseOrdersView from '@/views/PurchaseOrdersView.vue'

// Mock axios methods
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

describe('All Views Render Test Suite (29 Views)', () => {
  let router: any

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/products', component: { template: '<div>Products</div>' } },
        { path: '/daily-settlements', component: { template: '<div>Daily Settlements</div>' } },
        { path: '/purchase-orders', component: { template: '<div>Purchase Orders</div>' } },
      ],
    })
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('omnipos_token', 'test-token')
  })

  const views = [
    { name: 'AdminUsersView', component: AdminUsersView },
    { name: 'AttributesView', component: AttributesView },
    { name: 'AuditLogsView', component: AuditLogsView },
    { name: 'BankAccountsView', component: BankAccountsView },
    { name: 'CategoriesView', component: CategoriesView },
    { name: 'CustomersView', component: CustomersView },
    { name: 'DashboardView', component: DashboardView },
    { name: 'DailySettlementsView', component: DailySettlementsView },
    { name: 'DeliverySettingsView', component: DeliverySettingsView },
    { name: 'ExpensesView', component: ExpensesView },
    { name: 'InventoryLedgerView', component: InventoryLedgerView },
    { name: 'InvoicesView', component: InvoicesView },
    { name: 'LoginView', component: LoginView },
    { name: 'OrdersView', component: OrdersView },
    { name: 'POSView', component: POSView },
    { name: 'PayrollView', component: PayrollView },
    { name: 'PermissionsView', component: PermissionsView },
    { name: 'ProductCreateView', component: ProductCreateView },
    { name: 'ProductEditView', component: ProductEditView },
    { name: 'ProductListView', component: ProductListView },
    { name: 'PurchaseOrdersView', component: PurchaseOrdersView },
    { name: 'QuotationsView', component: QuotationsView },
    { name: 'ReportsView', component: ReportsView },
    { name: 'RestockSessionView', component: RestockSessionView },
    { name: 'RolesView', component: RolesView },
    { name: 'SalesChannelsView', component: SalesChannelsView },
    { name: 'SettingsView', component: SettingsView },
    { name: 'SuppliersView', component: SuppliersView },

  ]

  it('should verify all 28 views are defined and imported correctly', () => {
    expect(views).toHaveLength(28)
    for (const v of views) {
      expect(v.component).toBeDefined()
    }
  })

  for (const v of views) {
    it(`renders ${v.name} without runtime errors or crashes`, async () => {
      let wrapper: any
      expect(() => {
        wrapper = mount(v.component, {
          global: {
            plugins: [router],
            stubs: {
              RouterLink: true,
              RouterView: true,
              teleport: true,
            },
          },
        })
      }).not.toThrow()

      expect(wrapper).toBeDefined()
      expect(wrapper.exists()).toBe(true)
      await wrapper.vm.$nextTick()
    })
  }
})
