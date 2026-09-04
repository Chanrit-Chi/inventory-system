import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AuditLogsView from '@/views/AuditLogsView.vue'
import { useAuditLogStore } from '@/stores/auditLogStore'
import api from '@/api/axios'

vi.mock('@/api/axios', () => {
  const mockApi = {
    get: vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: 'log-1',
            action: 'USER_LOGIN',
            category: 'SECURITY',
            target: 'Admin Console',
            actor_name: 'Super Admin',
            actor_role: 'admin',
            details: 'Successful login from IP: 127.0.0.1',
            ip: '127.0.0.1',
            created_at: new Date().toISOString(),
          },
          {
            id: 'log-2',
            action: 'INVENTORY_RESTOCK',
            category: 'INVENTORY',
            target: 'Milk Tea Powders',
            actor_name: 'Warehouse Manager',
            actor_role: 'manager',
            details: 'Restocked 50 units',
            ip: '192.168.1.10',
            created_at: '2026-08-31T10:00:00Z',
          },
        ],
        meta: {
          total: 2,
          current_page: 1,
          last_page: 1,
          per_page: 25,
        },
      },
    }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
  return {
    default: mockApi,
    ApiError: class ApiError extends Error {},
  }
})

describe('AuditLogsView Filter Functionality', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads audit logs on mount with default parameters', async () => {
    const wrapper = mount(AuditLogsView, {
      global: {
        stubs: {
          SelectField: true,
          DatePicker: true,
        },
      },
    })

    await flushPromises()

    expect(api.get).toHaveBeenCalledWith(
      '/audit-logs',
      expect.objectContaining({
        params: expect.objectContaining({
          page: 1,
          per_page: 25,
        }),
      })
    )

    // Verify stats cards rendered
    expect(wrapper.text()).toContain('Security Audit Logs')
    expect(wrapper.text()).toContain('Total Audit Events')
  })

  it('correctly filters by category through the store', async () => {
    const store = useAuditLogStore()

    // Test SECURITY
    await store.fetchLogs({ category: 'SECURITY' })
    expect(api.get).toHaveBeenLastCalledWith(
      '/audit-logs',
      expect.objectContaining({
        params: { category: 'SECURITY' },
      })
    )

    // Test INVENTORY
    await store.fetchLogs({ category: 'INVENTORY' })
    expect(api.get).toHaveBeenLastCalledWith(
      '/audit-logs',
      expect.objectContaining({
        params: { category: 'INVENTORY' },
      })
    )

    // Test ORDERS
    await store.fetchLogs({ category: 'ORDERS' })
    expect(api.get).toHaveBeenLastCalledWith(
      '/audit-logs',
      expect.objectContaining({
        params: { category: 'ORDERS' },
      })
    )
  })

  it('filters by date bounds and search term through the store', async () => {
    const store = useAuditLogStore()

    await store.fetchLogs({
      search: 'login',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
    })

    expect(api.get).toHaveBeenLastCalledWith(
      '/audit-logs',
      expect.objectContaining({
        params: {
          search: 'login',
          date_from: '2026-08-01',
          date_to: '2026-08-31',
        },
      })
    )
  })
})
