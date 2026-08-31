import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import ProductListView from '@/views/ProductListView.vue'
import ProductCreateView from '@/views/ProductCreateView.vue'
import ProductEditView from '@/views/ProductEditView.vue'
import InventoryLedgerView from '@/views/InventoryLedgerView.vue'
import RestockSessionView from '@/views/RestockSessionView.vue'
import OrdersView from '@/views/OrdersView.vue'
import CustomersView from '@/views/CustomersView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import QuotationsView from '@/views/QuotationsView.vue'
import SalesChannelsView from '@/views/SalesChannelsView.vue'
import SettingsView from '@/views/SettingsView.vue'
import LoginView from '@/views/LoginView.vue'
import PayrollView from '@/views/PayrollView.vue'
import UsersView from '@/views/UsersView.vue'
import AuditLogsView from '@/views/AuditLogsView.vue'
import ReportsView from '@/views/ReportsView.vue'
import InvoicesView from '@/views/InvoicesView.vue'
import SuppliersView from '@/views/SuppliersView.vue'
import CategoriesView from '@/views/CategoriesView.vue'
import AttributesView from '@/views/AttributesView.vue'
import BankAccountsView from '@/views/BankAccountsView.vue'
import DeliverySettingsView from '@/views/DeliverySettingsView.vue'
import RolesView from '@/views/RolesView.vue'
import PermissionsView from '@/views/PermissionsView.vue'
import DailySettlementsView from '@/views/DailySettlementsView.vue'
import PurchaseOrdersView from '@/views/PurchaseOrdersView.vue'
import { useAuthStore } from '@/stores/authStore'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/products', name: 'products.list', component: ProductListView, meta: { requiresAuth: true } },
    { path: '/products/create', name: 'products.create', component: ProductCreateView, meta: { requiresAuth: true } },
    { path: '/products/:id/edit', name: 'products.edit', component: ProductEditView, meta: { requiresAuth: true } },
    { path: '/inventory', name: 'inventory', component: InventoryLedgerView, meta: { requiresAuth: true } },
    { path: '/purchase-orders', name: 'purchase-orders', component: PurchaseOrdersView, meta: { requiresAuth: true } },
    { path: '/restock', name: 'restock', component: RestockSessionView, meta: { requiresAuth: true } },
    { path: '/daily-settlements', name: 'daily-settlements', component: DailySettlementsView, meta: { requiresAuth: true } },
    { path: '/orders', name: 'orders', component: OrdersView, meta: { requiresAuth: true } },
    { path: '/customers', name: 'customers', component: CustomersView, meta: { requiresAuth: true } },
    { path: '/expenses', name: 'expenses', component: ExpensesView, meta: { requiresAuth: true } },
    { path: '/quotations', name: 'quotations', component: QuotationsView, meta: { requiresAuth: true } },
    { path: '/sales-channels', name: 'sales-channels', component: SalesChannelsView, meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { requiresAuth: true } },
    { path: '/pos', name: 'pos', component: () => import('@/views/POSView.vue'), meta: { requiresAuth: true } },
    { path: '/payroll', name: 'payroll', component: PayrollView, meta: { requiresAuth: true } },
    { path: '/users', name: 'users', component: UsersView, meta: { requiresAuth: true } },
    { path: '/audit-logs', name: 'audit-logs', component: AuditLogsView, meta: { requiresAuth: true } },
    { path: '/reports', name: 'reports', component: ReportsView, meta: { requiresAuth: true } },
    { path: '/invoices', name: 'invoices', component: InvoicesView, meta: { requiresAuth: true } },
    { path: '/suppliers', name: 'suppliers', component: SuppliersView, meta: { requiresAuth: true } },
    { path: '/categories', name: 'categories', component: CategoriesView, meta: { requiresAuth: true } },
    { path: '/attributes', name: 'attributes', component: AttributesView, meta: { requiresAuth: true } },
    { path: '/bank-accounts', name: 'bank-accounts', component: BankAccountsView, meta: { requiresAuth: true } },
    { path: '/delivery-settings', name: 'delivery-settings', component: DeliverySettingsView, meta: { requiresAuth: true } },
    { path: '/roles', name: 'roles', component: RolesView, meta: { requiresAuth: true } },
    { path: '/permissions', name: 'permissions', component: PermissionsView, meta: { requiresAuth: true } },
  ],
})

// Navigation guard to enforce authentication
router.beforeEach((to, _from, next) => {
  // initAuth is cached (no-op after first call), safe to call on every navigation
  const authStore = useAuthStore()
  authStore.initAuth()

  // Routes that don't require auth
  if (!to.meta.requiresAuth || to.name === 'login') {
    // If user is already authenticated and trying to access login, redirect to dashboard
    if (to.name === 'login' && authStore.isAuthenticated) {
      next({ name: 'dashboard' })
    } else {
      next()
    }
    return
  }

  // Protected route - require auth
  if (!authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
