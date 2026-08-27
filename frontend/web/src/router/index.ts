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

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: DashboardView },
  { path: '/products', name: 'products.list', component: ProductListView },
  { path: '/products/create', name: 'products.create', component: ProductCreateView },
  { path: '/products/:id/edit', name: 'products.edit', component: ProductEditView },
  { path: '/inventory', name: 'inventory', component: InventoryLedgerView },
  { path: '/restock', name: 'restock', component: RestockSessionView },
  { path: '/orders', name: 'orders', component: OrdersView },
  { path: '/customers', name: 'customers', component: CustomersView },
  { path: '/expenses', name: 'expenses', component: ExpensesView },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
