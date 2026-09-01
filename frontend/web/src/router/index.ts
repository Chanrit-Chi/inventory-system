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
import UsersView from '@/views/AdminUsersView.vue'
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
import { usePermissions } from '@/composables/usePermissions'

export function getDefaultRouteForUser(): string {
  const { can } = usePermissions()
  if (can('reports:view')) return '/dashboard'
  if (can('pos:checkout')) return '/pos'
  if (can('products:read')) return '/products'
  return '/pos'
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: () => getDefaultRouteForUser() },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true, permission: 'reports:view' } },
    { path: '/products', name: 'products.list', component: ProductListView, meta: { requiresAuth: true, permission: 'products:read' } },
    { path: '/products/create', name: 'products.create', component: ProductCreateView, meta: { requiresAuth: true, permission: 'products:create' } },
    { path: '/products/:id/edit', name: 'products.edit', component: ProductEditView, meta: { requiresAuth: true, permission: 'products:update' } },
    { path: '/inventory', name: 'inventory', component: InventoryLedgerView, meta: { requiresAuth: true, permission: 'inventory:adjust' } },
    { path: '/purchase-orders', name: 'purchase-orders', component: PurchaseOrdersView, meta: { requiresAuth: true, permission: 'purchase-orders:create' } },
    { path: '/restock', name: 'restock', component: RestockSessionView, meta: { requiresAuth: true, permission: 'inventory:restock' } },
    { path: '/daily-settlements', name: 'daily-settlements', component: DailySettlementsView, meta: { requiresAuth: true, permission: 'reports:view' } },
    { path: '/orders', name: 'orders', component: OrdersView, meta: { requiresAuth: true, permission: 'pos:checkout' } },
    { path: '/customers', name: 'customers', component: CustomersView, meta: { requiresAuth: true, permission: 'customers:view' } },
    { path: '/expenses', name: 'expenses', component: ExpensesView, meta: { requiresAuth: true, permission: 'expenses:*' } },
    { path: '/quotations', name: 'quotations', component: QuotationsView, meta: { requiresAuth: true, permission: 'quotations:create' } },
    { path: '/sales-channels', name: 'sales-channels', component: SalesChannelsView, meta: { requiresAuth: true, permission: 'channels:view' } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { requiresAuth: true, permission: 'settings:*' } },
    { path: '/pos', name: 'pos', component: () => import('@/views/POSView.vue'), meta: { requiresAuth: true, permission: 'pos:checkout' } },
    { path: '/payroll', name: 'payroll', component: PayrollView, meta: { requiresAuth: true, permission: 'payroll:view' } },
    { path: '/users', name: 'users', component: UsersView, meta: { requiresAuth: true, permission: 'users:view' } },
    { path: '/audit-logs', name: 'audit-logs', component: AuditLogsView, meta: { requiresAuth: true, permission: 'audit:view' } },
    { path: '/reports', name: 'reports', component: ReportsView, meta: { requiresAuth: true, permission: 'reports:view' } },
    { path: '/invoices', name: 'invoices', component: InvoicesView, meta: { requiresAuth: true, permission: 'invoices:view' } },
    { path: '/suppliers', name: 'suppliers', component: SuppliersView, meta: { requiresAuth: true, permission: 'suppliers:view' } },
    { path: '/categories', name: 'categories', component: CategoriesView, meta: { requiresAuth: true, permission: 'categories:manage' } },
    { path: '/attributes', name: 'attributes', component: AttributesView, meta: { requiresAuth: true, permission: 'attributes:manage' } },
    { path: '/bank-accounts', name: 'bank-accounts', component: BankAccountsView, meta: { requiresAuth: true, permission: 'payment-methods:view' } },
    { path: '/delivery-settings', name: 'delivery-settings', component: DeliverySettingsView, meta: { requiresAuth: true, permission: 'delivery:view' } },
    { path: '/roles', name: 'roles', component: RolesView, meta: { requiresAuth: true, permission: 'roles:manage' } },
    { path: '/permissions', name: 'permissions', component: PermissionsView, meta: { requiresAuth: true, permission: 'roles:manage' } },
    { path: '/import', name: 'import', component: () => import('@/views/ImportView.vue'), meta: { requiresAuth: true, permission: 'products:create' } },
  ],
})

// Navigation guard to enforce authentication and permissions
router.beforeEach((to, _from, next) => {
  // initAuth is cached (no-op after first call), safe to call on every navigation
  const authStore = useAuthStore()
  authStore.initAuth()

  // Routes that don't require auth
  if (!to.meta.requiresAuth || to.name === 'login') {
    // If user is already authenticated and trying to access login, redirect to role-specific default home
    if (to.name === 'login' && authStore.isAuthenticated) {
      next(getDefaultRouteForUser())
    } else {
      next()
    }
    return
  }

  // Protected route - require auth
  if (!authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  // Permission capability check
  const requiredPermission = to.meta.permission as string | undefined
  if (requiredPermission) {
    const { can } = usePermissions()
    if (!can(requiredPermission)) {
      next(getDefaultRouteForUser())
      return
    }
  }

  next()
})

export default router

