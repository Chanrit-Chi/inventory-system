import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { matchPermission, usePermissions, getPermissionOriginStatus } from '@/composables/usePermissions'
import { useAuthStore } from '@/stores/authStore'
import { usePermissionStore } from '@/stores/permissionStore'
import { useRoleStore } from '@/stores/roleStore'
import api from '@/api/axios'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/permissions', component: { template: '<div>Permissions</div>' } },
    { path: '/roles', component: { template: '<div>Roles</div>' } },
    { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
    { path: '/pos', component: { template: '<div>POS</div>' } },
    { path: '/products', component: { template: '<div>Products</div>' } },
  ],
})

vi.mock('@/api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(msg: string) {
      super(msg)
      this.name = 'ApiError'
    }
  },
}))

describe('System Permissions & RBAC Module', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Permission Matching Engine (matchPermission)', () => {
    it('handles root wildcard * matching any permission', () => {
      expect(matchPermission('*', 'products:read')).toBe(true)
      expect(matchPermission('*', 'pos:checkout')).toBe(true)
      expect(matchPermission('*', 'users:manage')).toBe(true)
      expect(matchPermission('*', 'custom:action')).toBe(true)
    })

    it('handles exact slug matching', () => {
      expect(matchPermission('products:read', 'products:read')).toBe(true)
      expect(matchPermission('products:read', 'products:create')).toBe(false)
      expect(matchPermission('pos:checkout', 'pos:checkout')).toBe(true)
    })

    it('handles module wildcards e.g. products:*', () => {
      expect(matchPermission('products:*', 'products:read')).toBe(true)
      expect(matchPermission('products:*', 'products:create')).toBe(true)
      expect(matchPermission('products:*', 'products:delete')).toBe(true)
      expect(matchPermission('products:*', 'pos:checkout')).toBe(false)
      expect(matchPermission('inventory:*', 'inventory:adjust')).toBe(true)
      expect(matchPermission('inventory:*', 'suppliers:view')).toBe(false)
    })

    it('handles empty or null parameters gracefully', () => {
      expect(matchPermission('', 'products:read')).toBe(false)
      expect(matchPermission('products:read', '')).toBe(false)
    })
  })

  describe('usePermissions Composable', () => {
    it('evaluates permissions for Super Admin with permanent wildcard', () => {
      const auth = useAuthStore()
      auth.user = {
        id: 'u-super',
        name: 'Root Admin',
        email: 'super@test.com',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      }

      const { can, hasAny, hasAll, isSuperAdmin, isAdmin } = usePermissions()
      expect(isSuperAdmin.value).toBe(true)
      expect(isAdmin.value).toBe(true)
      expect(can('products:read')).toBe(true)
      expect(can('anything:custom:action')).toBe(true)
      expect(hasAny(['unknown:perm', 'pos:checkout'])).toBe(true)
      expect(hasAll(['perm1', 'perm2'])).toBe(true)
    })

    it('evaluates role default permissions when user has no explicit permissions array', () => {
      const auth = useAuthStore()
      auth.user = {
        id: 'u-seller',
        name: 'Floor Cashier',
        email: 'seller@test.com',
        role: 'SELLER',
      }

      const { can, hasAny, isSeller } = usePermissions()
      expect(isSeller.value).toBe(true)
      expect(can('pos:checkout')).toBe(true)
      expect(can('inventory:scan')).toBe(true)
      expect(can('users:manage')).toBe(false)
      expect(can('payroll:view')).toBe(false)
      expect(hasAny(['payroll:view', 'pos:checkout'])).toBe(true)
      expect(hasAny(['payroll:view', 'roles:manage'])).toBe(false)
    })

    it('respects user overrides over role grants', () => {
      const auth = useAuthStore()
      auth.user = {
        id: 'u-seller-custom',
        name: 'Senior Cashier',
        email: 'senior@test.com',
        role: 'SELLER',
        permissions: ['pos:checkout', 'inventory:scan'],
        overrides: {
          'inventory:adjust': true,
          'pos:checkout': false,
        },
      }

      const { can } = usePermissions()
      // Explicit override false overrides grant
      expect(can('pos:checkout')).toBe(false)
      // Explicit override true grants capability
      expect(can('inventory:adjust')).toBe(true)
      // Normal grant
      expect(can('inventory:scan')).toBe(true)
    })
  })

  describe('Permission Store & API Sync', () => {
    it('fetches permissions from API and normalizes module grouping', async () => {
      const mockApiPermissions = [
        { id: 'p-1', name: 'View Products', slug: 'products:read', module: 'products', description: 'Browse items' },
        { id: 'p-2', name: 'Create Products', slug: 'products:create', module: 'products', description: 'Add items' },
        { id: 'p-3', name: 'Checkout POS', slug: 'pos:checkout', module: 'sales', description: 'Ring up orders' },
      ]

      vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { data: mockApiPermissions } } as any)

      const store = usePermissionStore()
      await store.fetchPermissions()

      expect(store.permissions).toHaveLength(3)
      expect(store.permissions[0].slug).toBe('products:read')
      expect(store.permissions[0].name).toBe('View Products')
      expect(store.permissions[0].module).toBe('products')

      const byModule = store.permissionsByModule
      expect(byModule['products']).toHaveLength(2)
      expect(byModule['sales']).toHaveLength(1)
    })
  })

  describe('Role Store & Permissions Update', () => {
    it('fetches and updates role permissions via PUT /roles/:id/permissions', async () => {
      const mockRoles = [
        {
          id: 'role-mgr',
          name: 'Manager',
          slug: 'MANAGER',
          description: 'Store manager',
          permissions: ['products:read', 'inventory:adjust'],
          user_count: 3,
        },
      ]

      vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { data: mockRoles } } as any)
      const roleStore = useRoleStore()
      await roleStore.fetchRoles()

      expect(roleStore.roles).toHaveLength(1)
      expect(roleStore.roles[0].permissions).toEqual(['products:read', 'inventory:adjust'])

      // Update role permissions
      const updatedMock = {
        id: 'role-mgr',
        name: 'Manager',
        slug: 'MANAGER',
        description: 'Store manager',
        permissions: ['products:read', 'inventory:adjust', 'pos:checkout'],
        user_count: 3,
      }
      vi.spyOn(api, 'put').mockResolvedValueOnce({ data: { data: updatedMock } } as any)

      await roleStore.updateRolePermissions('role-mgr', ['products:read', 'inventory:adjust', 'pos:checkout'])
      expect(api.put).toHaveBeenCalledWith('/roles/role-mgr/permissions', {
        permissions: ['products:read', 'inventory:adjust', 'pos:checkout'],
      })
      expect(roleStore.roles[0].permissions).toContain('pos:checkout')
    })
  })

  describe('PermissionsView.vue Component', () => {
    it('renders grouped permissions with capability names and slugs', async () => {
      const mockPermissions = [
        { id: 'p-1', name: 'View Catalog', slug: 'products:read', module: 'products', description: 'Browse items' },
        { id: 'p-2', name: 'Scan Barcodes', slug: 'inventory:scan', module: 'inventory', description: 'Barcode lookup' },
      ]
      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: mockPermissions } } as any)

      const { default: PermissionsView } = await import('@/views/PermissionsView.vue')
      const wrapper = mount(PermissionsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('System Permissions')
      expect(wrapper.text()).toContain('View Catalog')
      expect(wrapper.text()).toContain('products:read')
      expect(wrapper.text()).toContain('Scan Barcodes')
      expect(wrapper.text()).toContain('inventory:scan')
    })
  })

  describe('RolesView.vue Component', () => {
    it('renders role tabs, allows toggling capabilities, and tracks dirty state', async () => {
      const mockRoles = [
        {
          id: 'role-admin',
          name: 'Admin',
          slug: 'ADMIN',
          description: 'Operations admin',
          permissions: ['products:read'],
          user_count: 2,
        },
        {
          id: 'role-seller',
          name: 'Seller',
          slug: 'SELLER',
          description: 'Cashier',
          permissions: ['pos:checkout'],
          user_count: 5,
        },
      ]
      const mockPermissions = [
        { id: 'p-1', name: 'View Catalog', slug: 'products:read', module: 'products', description: 'Browse items' },
        { id: 'p-2', name: 'Create Items', slug: 'products:create', module: 'products', description: 'Add items' },
        { id: 'p-3', name: 'POS Checkout', slug: 'pos:checkout', module: 'sales', description: 'Ring sales' },
      ]

      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/roles') return { data: { data: mockRoles } } as any
        if (url === '/permissions') return { data: { data: mockPermissions } } as any
        return { data: { data: [] } } as any
      })

      const { default: RolesView } = await import('@/views/RolesView.vue')
      const wrapper = mount(RolesView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(wrapper.text()).toContain('Roles & Permissions')
      expect(vm.roles).toHaveLength(2)

      // Initially not dirty
      expect(vm.isDirty).toBe(false)

      // Toggle 'products:create'
      vm.togglePermission('products:create')
      await wrapper.vm.$nextTick()

      // Now dirty
      expect(vm.isDirty).toBe(true)
      expect(vm.activePermissions.has('products:create')).toBe(true)

      // Discard changes
      vm.discardChanges()
      await wrapper.vm.$nextTick()
      expect(vm.isDirty).toBe(false)
      expect(vm.activePermissions.has('products:create')).toBe(false)
    })
  })

  describe('Role-Based Landing & Route Access Protection (getDefaultRouteForUser)', () => {
    it('routes SUPER_ADMIN and ADMIN to /dashboard by default', async () => {
      const { getDefaultRouteForUser } = await import('@/router')
      const auth = useAuthStore()

      auth.user = {
        id: '1',
        name: 'Super Admin',
        email: 'admin@omnipos.local',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      }
      expect(getDefaultRouteForUser()).toBe('/dashboard')

      auth.user.role = 'ADMIN'
      auth.user.permissions = ['reports:view', 'pos:checkout']
      expect(getDefaultRouteForUser()).toBe('/dashboard')
    })

    it('routes MANAGER with reports:view to /dashboard', async () => {
      const { getDefaultRouteForUser } = await import('@/router')
      const auth = useAuthStore()

      auth.user = {
        id: '2',
        name: 'Store Manager',
        email: 'manager@omnipos.local',
        role: 'MANAGER',
        permissions: ['reports:view', 'pos:checkout', 'inventory:adjust'],
      }
      expect(getDefaultRouteForUser()).toBe('/dashboard')
    })

    it('routes SELLER / Cashier to /pos (POS Terminal) and blocks /dashboard', async () => {
      const { getDefaultRouteForUser } = await import('@/router')
      const auth = useAuthStore()
      const { can } = usePermissions()

      auth.user = {
        id: '3',
        name: 'Jane Cashier',
        email: 'seller@omnipos.local',
        role: 'SELLER',
        permissions: ['pos:checkout', 'inventory:scan', 'customers:view'],
      }

      // Seller cannot view reports / executive dashboard
      expect(can('reports:view')).toBe(false)
      expect(can('pos:checkout')).toBe(true)

      // Default landing is POS Terminal
      expect(getDefaultRouteForUser()).toBe('/pos')
    })

    it('routes catalog staff to /products if pos:checkout is absent', async () => {
      const { getDefaultRouteForUser } = await import('@/router')
      const auth = useAuthStore()

      auth.user = {
        id: '4',
        name: 'Inventory Associate',
        email: 'stock@omnipos.local',
        role: 'SELLER',
        permissions: ['products:read', 'inventory:adjust'],
      }
      expect(getDefaultRouteForUser()).toBe('/products')
    })

    it('renders Seller Register Hub and hides Executive Revenue Target when SELLER views DashboardView', async () => {
      const { default: DashboardView } = await import('@/views/DashboardView.vue')
      const auth = useAuthStore()

      auth.user = {
        id: '5',
        name: 'John Cashier',
        email: 'cashier@omnipos.local',
        role: 'SELLER',
        permissions: ['pos:checkout', 'inventory:scan'],
      }

      const wrapper = mount(DashboardView, {
        global: {
          stubs: {
            RouterLink: { template: '<a><slot /></a>' },
          },
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Seller Register Hub')
      expect(wrapper.text()).toContain('Today\'s Shift Sales')
      expect(wrapper.text()).toContain('Open POS Terminal')

      // Hidden from seller
      expect(wrapper.text()).not.toContain('Daily Revenue Target')
      expect(wrapper.text()).not.toContain('Executive Dashboard')
    })

    it('renders Executive Dashboard with Daily Revenue Target when ADMIN views DashboardView', async () => {
      const { default: DashboardView } = await import('@/views/DashboardView.vue')
      const auth = useAuthStore()

      auth.user = {
        id: '6',
        name: 'Store Owner',
        email: 'owner@omnipos.local',
        role: 'ADMIN',
        permissions: ['reports:view', 'pos:checkout'],
      }

      const wrapper = mount(DashboardView, {
        global: {
          stubs: {
            RouterLink: { template: '<a><slot /></a>' },
          },
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Executive Dashboard')
      expect(wrapper.text()).toContain('Daily Revenue Target')
    })
  })

  describe('Permission Origin & Visual Distinction (getPermissionOriginStatus)', () => {
    it('identifies ROLE_DEFAULT for baseline permissions', () => {
      const sellerStatus = getPermissionOriginStatus('pos:checkout', 'SELLER', true)
      expect(sellerStatus.type).toBe('ROLE_DEFAULT')
      expect(sellerStatus.label).toBe('Role Default')
      expect(sellerStatus.isDefault).toBe(true)
      expect(sellerStatus.isCustom).toBe(false)
      expect(sellerStatus.isRevoked).toBe(false)
    })

    it('identifies CUSTOM_ADDED when a non-baseline permission is granted', () => {
      const customStatus = getPermissionOriginStatus('products:create', 'SELLER', true)
      expect(customStatus.type).toBe('CUSTOM_ADDED')
      expect(customStatus.label).toBe('+ Custom Added')
      expect(customStatus.isCustom).toBe(true)
      expect(customStatus.isDefault).toBe(false)
    })

    it('identifies BASELINE_REMOVED when a baseline permission is ungranted', () => {
      const removedStatus = getPermissionOriginStatus('pos:checkout', 'SELLER', false)
      expect(removedStatus.type).toBe('BASELINE_REMOVED')
      expect(removedStatus.label).toBe('- Baseline Removed')
      expect(removedStatus.isRevoked).toBe(true)
      expect(removedStatus.isDefault).toBe(false)
    })

    it('identifies SUPER_ADMIN_LOCKED for Super Admin role', () => {
      const lockedStatus = getPermissionOriginStatus('products:create', 'SUPER_ADMIN', true)
      expect(lockedStatus.type).toBe('SUPER_ADMIN_LOCKED')
      expect(lockedStatus.isLocked).toBe(true)
    })
  })
})

