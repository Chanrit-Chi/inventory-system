import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import api from '@/api/axios'

// Stores & Composables
import { usePosStore } from '@/stores/posStore'
import { useToastStore } from '@/stores/toastStore'
import { useToast } from '@/composables/useToast'

// UI Primitives & Views
import Skeleton from '@/components/ui/Skeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import QuotationsView from '@/views/QuotationsView.vue'
import POSView from '@/views/POSView.vue'
import SettingsView from '@/views/SettingsView.vue'
import { PackageX } from 'lucide-vue-next'

// Mock Axios
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

describe('Milestone 5 Empirical Challenger Stress Test Suite', () => {
  let router: any

  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>home</div>' } },
        { path: '/pos', component: POSView },
        { path: '/quotations', component: QuotationsView },
        { path: '/settings', component: SettingsView },
      ],
    })

    localStorage.clear()
    sessionStorage.clear()

    ;(api.get as any).mockResolvedValue({
      data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } },
    })
    ;(api.post as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.put as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.patch as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.delete as any).mockResolvedValue({ data: { message: 'Deleted' } })
  })

  // ============================================================================
  // 1. Toast Timer Stress Testing (Fake Timers & Race Conditions)
  // ============================================================================
  describe('1. Toast Timers & Lifecycle Stress Tests', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('handles multiple staggered auto-dismissals accurately with fake timers', () => {
      const store = useToastStore()
      store.add('Toast 1 (1s)', 'info', 1000)
      const t2 = store.add('Toast 2 (3s)', 'success', 3000)
      const t3 = store.add('Toast 3 (5s)', 'warning', 5000)
      const tPersistent = store.add('Toast Persistent (0s)', 'error', 0)

      expect(store.toasts).toHaveLength(4)

      // Advance by 1000ms -> t1 should be removed
      vi.advanceTimersByTime(1000)
      expect(store.toasts.map(t => t.id)).toEqual([t2, t3, tPersistent])

      // Advance by another 2000ms (total 3000ms) -> t2 should be removed
      vi.advanceTimersByTime(2000)
      expect(store.toasts.map(t => t.id)).toEqual([t3, tPersistent])

      // Advance by another 2000ms (total 5000ms) -> t3 should be removed
      vi.advanceTimersByTime(2000)
      expect(store.toasts.map(t => t.id)).toEqual([tPersistent])

      // Advance by another 10,000ms -> persistent toast remains
      vi.advanceTimersByTime(10000)
      expect(store.toasts.map(t => t.id)).toEqual([tPersistent])
    })

    it('survives manual removal before timer fires without double-removal errors', () => {
      const store = useToastStore()
      const id = store.add('Quick Dismiss', 'info', 4000)
      expect(store.toasts).toHaveLength(1)

      // Manually remove
      store.remove(id)
      expect(store.toasts).toHaveLength(0)

      // Now advance timer past duration — must not throw or alter state
      expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
      expect(store.toasts).toHaveLength(0)
    })

    it('stress tests rapid insertion of 50 toasts', () => {
      const toast = useToast()
      const store = useToastStore()

      for (let i = 0; i < 50; i++) {
        toast.info(`Message ${i}`)
      }
      expect(store.toasts).toHaveLength(50)
      expect(store.toasts[0].message).toBe('Message 0')
      expect(store.toasts[49].message).toBe('Message 49')

      // Advance timers by default duration (4000ms)
      vi.advanceTimersByTime(4000)
      expect(store.toasts).toHaveLength(0)
    })
  })

  // ============================================================================
  // 2. EmptyState & Skeleton Primitives Edge Cases
  // ============================================================================
  describe('2. EmptyState & Skeleton Edge Cases', () => {
    it('EmptyState renders gracefully when no props or slots are provided', () => {
      const wrapper = mount(EmptyState)
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.classes()).toContain('flex')
      expect(wrapper.classes()).toContain('text-center')
    })

    it('EmptyState supports emoji / string icons as well as Lucide icons', () => {
      const stringIconWrapper = mount(EmptyState, {
        props: {
          icon: '📦',
          title: 'No inventory items',
        },
      })
      expect(stringIconWrapper.text()).toContain('📦')
      expect(stringIconWrapper.text()).toContain('No inventory items')

      const componentIconWrapper = mount(EmptyState, {
        props: {
          icon: PackageX,
          title: 'No items',
        },
      })
      expect(componentIconWrapper.findComponent(PackageX).exists()).toBe(true)
    })

    it('EmptyState slots override direct props', () => {
      const wrapper = mount(EmptyState, {
        props: {
          title: 'Prop Title',
          description: 'Prop Description',
        },
        slots: {
          title: '<span>Custom Slot Title</span>',
          description: '<span>Custom Slot Description</span>',
          icon: '<span id="custom-icon">🔥</span>',
          action: '<button id="cta-btn">Re-scan</button>',
        },
      })

      expect(wrapper.text()).toContain('Custom Slot Title')
      expect(wrapper.text()).not.toContain('Prop Title')
      expect(wrapper.text()).toContain('Custom Slot Description')
      expect(wrapper.text()).not.toContain('Prop Description')
      expect(wrapper.find('#custom-icon').exists()).toBe(true)
      expect(wrapper.find('#cta-btn').exists()).toBe(true)
    })

    it('Skeleton handles custom classes and empty props', () => {
      const defaultSkeleton = mount(Skeleton)
      expect(defaultSkeleton.classes()).toContain('animate-pulse')
      expect(defaultSkeleton.classes()).toContain('bg-muted/80')

      const customSkeleton = mount(Skeleton, {
        props: { class: 'w-24 h-24 rounded-full' },
      })
      expect(customSkeleton.classes()).toContain('animate-pulse')
      expect(customSkeleton.classes()).toContain('w-24')
      expect(customSkeleton.classes()).toContain('h-24')
      expect(customSkeleton.classes()).toContain('rounded-full')
    })
  })

  // ============================================================================
  // 3. Dialog Modal Cancelations & Edge Cases in Views
  // ============================================================================
  describe('3. Dialog Modal Workflows & Failures', () => {
    it('QuotationsView: canceling delete modal resets state without API call', async () => {
      const mockQuote = {
        id: 'q-999',
        quotation_number: 'QT-999',
        customer_name: 'Test Corp',
        total_amount: 100,
        status: 'draft',
      }
      ;(api.get as any).mockResolvedValue({
        data: { data: [mockQuote], meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(QuotationsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.openDeleteModal(mockQuote)
      expect(vm.showDeleteDialog).toBe(true)
      expect(vm.quotationToDelete).toEqual(mockQuote)

      // User cancels dialog
      vm.showDeleteDialog = false
      expect(api.delete).not.toHaveBeenCalled()
    })

    it('QuotationsView: delete API error triggers error toast and keeps dialog state responsive', async () => {
      ;(api.delete as any).mockRejectedValueOnce(new Error('Network failure'))
      const toastStore = useToastStore()

      const mockQuote = {
        id: 'q-err',
        quotation_number: 'QT-ERR',
        customer_name: 'Fail Corp',
        total_amount: 100,
        status: 'draft',
      }
      ;(api.get as any).mockResolvedValue({
        data: { data: [mockQuote], meta: { total: 1, current_page: 1, last_page: 1 } },
      })

      const wrapper = mount(QuotationsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.openDeleteModal(mockQuote)
      await vm.confirmDeleteQuotation()
      await flushPromises()

      expect(toastStore.toasts.some(t => t.variant === 'error')).toBe(true)
      expect(vm.submitting).toBe(false)
    })

    it('POSView: canceling clear cart keeps cart items intact', async () => {
      const pos = usePosStore()
      pos.addToCart({
        id: 'item-1',
        name: 'Latte',
        sku: 'LAT-01',
        selling_price: 4.5,
      }, undefined, 2)
      expect(pos.items).toHaveLength(1)

      const wrapper = mount(POSView, {
        global: {
          plugins: [router],
          stubs: {
            RouterLink: true,
            teleport: true,
            PosVariantModal: true,
            PosCheckoutModal: true,
            PosReceiptModal: true,
            PosCustomerModal: true,
            PosHoldOrdersModal: true,
            PosItemNoteModal: true,
            SellerPickerModal: true,
          },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.handleClearActiveCart()
      expect(vm.showClearCartDialog).toBe(true)

      // Cancel dialog
      vm.showClearCartDialog = false
      expect(pos.items).toHaveLength(1)
      expect(pos.items[0].name).toBe('Latte')
    })

    it('SettingsView: canceling printer deletion preserves printer in list', async () => {
      const wrapper = mount(SettingsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.printers = [
        {
          id: 'p-preserve',
          name: 'Main Barcode Printer',
          connectionType: 'usb',
          paperWidth: '58mm',
          role: 'label',
          isDefault: true,
        },
      ]

      vm.deletePrinter('p-preserve')
      expect(vm.showDeletePrinterDialog).toBe(true)
      expect(vm.printerToDelete?.id).toBe('p-preserve')

      // User cancels dialog
      vm.showDeletePrinterDialog = false
      expect(vm.printers).toHaveLength(1)
      expect(vm.printers[0].id).toBe('p-preserve')
    })

    it('SettingsView: test printer API failure triggers error toast', async () => {
      ;(api.post as any).mockRejectedValueOnce(new Error('Connection timed out'))
      const toastStore = useToastStore()

      const wrapper = mount(SettingsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      await vm.testPrinter({
        id: 'p-fail',
        name: 'Offline Printer',
        connectionType: 'wifi',
        ipAddress: '192.168.1.99',
        port: 9100,
        paperWidth: '80mm',
        role: 'receipt',
        isDefault: false,
      })

      expect(toastStore.toasts.some(t => t.variant === 'error')).toBe(true)
    })
  })

  // ============================================================================
  // 4. POS Data Envelope Stress Testing
  // ============================================================================
  describe('4. POS Data Envelope Stress Testing', () => {
    it('handles malformed / null / empty API responses without throwing', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url === '/products') return Promise.resolve({ data: null })
        if (url === '/products/categories') return Promise.resolve({ data: undefined })
        if (url === '/staff-members') return Promise.resolve({ data: { data: null } })
        if (url === '/sales-channels') return Promise.resolve({ data: {} })
        return Promise.resolve({ data: [] })
      })

      const wrapper = mount(POSView, {
        global: {
          plugins: [router],
          stubs: {
            RouterLink: true,
            teleport: true,
            PosVariantModal: true,
            PosCheckoutModal: true,
            PosReceiptModal: true,
            PosCustomerModal: true,
            PosHoldOrdersModal: true,
            PosItemNoteModal: true,
            SellerPickerModal: true,
          },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(Array.isArray(vm.staffMembers)).toBe(true)
      expect(vm.staffMembers).toHaveLength(0)
      expect(Array.isArray(vm.products)).toBe(true)
      expect(vm.products).toHaveLength(0)
      expect(Array.isArray(vm.categories)).toBe(true)
      expect(vm.categories).toHaveLength(0)
    })
  })
})
