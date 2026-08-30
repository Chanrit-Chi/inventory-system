import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import api from '@/api/axios'

// Stores
import { usePosStore } from '@/stores/posStore'
import { useQuotationStore } from '@/stores/quotationStore'
import { useToastStore } from '@/stores/toastStore'
import { useToast } from '@/composables/useToast'

// Views & Components
import QuotationsView from '@/views/QuotationsView.vue'
import POSView from '@/views/POSView.vue'
import SettingsView from '@/views/SettingsView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import Toast from '@/components/ui/Toast.vue'
import { CheckCircle2 } from 'lucide-vue-next'

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

describe('Milestone 5: State Polish, Interactive Feedback & Production Verification', () => {
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

    // Default mock behavior
    ;(api.get as any).mockResolvedValue({
      data: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } },
    })
    ;(api.post as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.put as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.patch as any).mockResolvedValue({ data: { data: {}, message: 'Success' } })
    ;(api.delete as any).mockResolvedValue({ data: { message: 'Deleted' } })
  })

  // ============================================================================
  // 1. Toast Notification Composable & Container
  // ============================================================================
  describe('1. Toast Notification System', () => {
    it('dispatches toasts across all four variants (success, error, warning, info)', () => {
      const toast = useToast()
      const toastStore = useToastStore()

      expect(toastStore.toasts).toHaveLength(0)

      toast.success('Order completed successfully!')
      expect(toastStore.toasts).toHaveLength(1)
      expect(toastStore.toasts[0].variant).toBe('success')
      expect(toastStore.toasts[0].message).toBe('Order completed successfully!')

      toast.error('Network timeout during sync')
      expect(toastStore.toasts).toHaveLength(2)
      expect(toastStore.toasts[1].variant).toBe('error')

      toast.warning('Low stock alert on SKU-1002')
      expect(toastStore.toasts).toHaveLength(3)
      expect(toastStore.toasts[2].variant).toBe('warning')

      toast.info('Barcode scanned: 885123456789')
      expect(toastStore.toasts).toHaveLength(4)
      expect(toastStore.toasts[3].variant).toBe('info')
    })

    it('renders Toast container and dismisses toasts manually', async () => {
      const toastStore = useToastStore()
      toastStore.add('Item added', 'success')

      const wrapper = mount(Toast)
      expect(wrapper.text()).toContain('Item added')

      // Dismiss
      const dismissBtn = wrapper.find('button[aria-label="Dismiss"]')
      expect(dismissBtn.exists()).toBe(true)
      await dismissBtn.trigger('click')

      expect(toastStore.toasts).toHaveLength(0)
    })
  })

  // ============================================================================
  // 2. Feedback UI Components: Skeleton & EmptyState
  // ============================================================================
  describe('2. Skeleton & EmptyState Primitives', () => {
    it('Skeleton component renders with pulse animation classes', () => {
      const wrapper = mount(Skeleton, {
        props: { class: 'h-12 w-full custom-skeleton-test' },
      })
      expect(wrapper.classes()).toContain('animate-pulse')
      expect(wrapper.classes()).toContain('custom-skeleton-test')
    })

    it('EmptyState component renders with icon, title, description, and action button slot', () => {
      const wrapper = mount(EmptyState, {
        props: {
          icon: CheckCircle2,
          title: 'No pending orders',
          description: 'All customer orders have been successfully fulfilled.',
        },
        slots: {
          action: '<button id="test-action-btn">Create New</button>',
        },
      })

      expect(wrapper.text()).toContain('No pending orders')
      expect(wrapper.text()).toContain('All customer orders have been successfully fulfilled.')
      expect(wrapper.find('#test-action-btn').exists()).toBe(true)
    })
  })

  // ============================================================================
  // 3. QuotationsView Modal & Radix Dialog Consistency
  // ============================================================================
  describe('3. QuotationsView Radix Dialog Consistency', () => {
    it('opens delete confirmation dialog and executes deletion with toast feedback', async () => {
      const quotationStore = useQuotationStore()
      const mockQuote = {
        id: 'q-100',
        quotation_number: 'QT-2026-001',
        customer_name: 'Acme Corp',
        customer_phone: '+85512345678',
        subtotal: 500,
        discount: 0,
        total_amount: 500,
        status: 'draft',
        created_at: '2026-08-30T10:00:00Z',
        items: [
          { id: 'qi-1', product_name: 'Widget A', sku: 'WGT-A', quantity: 2, unit_price: 250 },
        ],
      }
      quotationStore.quotations = [mockQuote as any]

      const wrapper = mount(QuotationsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.showDeleteDialog).toBe(false)

      // Trigger delete modal
      vm.openDeleteModal(mockQuote)
      expect(vm.showDeleteDialog).toBe(true)
      expect(vm.quotationToDelete?.id).toBe('q-100')

      // Confirm delete
      await vm.confirmDeleteQuotation()
      await flushPromises()

      expect(api.delete).toHaveBeenCalledWith('/quotations/q-100')
      expect(vm.showDeleteDialog).toBe(false)
      expect(vm.quotationToDelete).toBeNull()
    })
  })

  // ============================================================================
  // 4. POSView API Envelope Resilience & Clear Cart Dialog
  // ============================================================================
  describe('4. POSView Envelope Resilience & Clear Cart Dialog', () => {
    it('normalizes staffMembers and catalog arrays regardless of API envelope wrapper', async () => {
      ;(api.get as any).mockImplementation((url: string) => {
        if (url === '/products') {
          return Promise.resolve({ data: { data: [{ id: 'p1', name: 'Coffee', variants: [] }] } })
        }
        if (url === '/products/categories') {
          return Promise.resolve({ data: [{ id: 'c1', name: 'Beverages' }] }) // raw array
        }
        if (url === '/sales-channels') {
          return Promise.resolve({ data: { data: [{ id: 'ch1', name: 'Main POS', is_active: true }] } })
        }
        if (url === '/staff-members') {
          return Promise.resolve({
            data: {
              data: [
                { id: 's1', name: 'John Doe', role: 'Cashier' },
                { id: 's2', name: 'Jane Smith', role: 'Manager' },
              ],
              meta: { total: 2 },
            },
          })
        }
        if (url === '/delivery-companies') {
          return Promise.resolve({ data: { data: [] } })
        }
        if (url === '/delivery-zones') {
          return Promise.resolve({ data: [] })
        }
        return Promise.resolve({ data: { data: [] } })
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
      expect(vm.staffMembers).toHaveLength(2)
      expect(vm.staffMembers[0].name).toBe('John Doe')
      expect(Array.isArray(vm.products)).toBe(true)
      expect(Array.isArray(vm.categories)).toBe(true)
    })

    it('handles clear active cart via confirmation Dialog workflow', async () => {
      const pos = usePosStore()
      pos.addToCart({
        id: 'p1',
        name: 'Arabica Beans',
        sku: 'CF-001',
        selling_price: 15,
      }, undefined, 3)
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
      expect(vm.showClearCartDialog).toBe(false)

      vm.handleClearActiveCart()
      expect(vm.showClearCartDialog).toBe(true)

      vm.confirmClearCart()
      expect(pos.items).toHaveLength(0)
      expect(vm.showClearCartDialog).toBe(false)
    })
  })

  // ============================================================================
  // 5. SettingsView Dialog & Toast Polish
  // ============================================================================
  describe('5. SettingsView Polish & Dialogs', () => {
    it('manages printer deletion via Radix Dialog confirmation', async () => {
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
          id: 'pr-1',
          name: 'Front Counter Printer',
          connectionType: 'wifi',
          ipAddress: '192.168.1.150',
          port: 9100,
          paperWidth: '80mm',
          role: 'receipt',
          isDefault: true,
        },
      ]

      expect(vm.showDeletePrinterDialog).toBe(false)

      vm.deletePrinter('pr-1')
      expect(vm.showDeletePrinterDialog).toBe(true)
      expect(vm.printerToDelete?.name).toBe('Front Counter Printer')

      vm.confirmDeletePrinter()
      expect(vm.printers).toHaveLength(0)
      expect(vm.showDeletePrinterDialog).toBe(false)
    })

    it('triggers test printer call and provides toast response', async () => {
      ;(api.post as any).mockResolvedValue({
        data: { message: 'Raw print job queued successfully' },
      })

      const wrapper = mount(SettingsView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true, teleport: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      const toastStore = useToastStore()

      await vm.testPrinter({
        id: 'pr-2',
        name: 'Kitchen Printer',
        connectionType: 'wifi',
        ipAddress: '192.168.1.151',
        port: 9100,
        paperWidth: '80mm',
        role: 'kitchen',
        isDefault: false,
      })

      expect(api.post).toHaveBeenCalledWith('/printer/raw-print', expect.objectContaining({
        ip: '192.168.1.151',
        port: 9100,
      }))
      expect(toastStore.toasts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            variant: 'success',
            message: 'Raw print job queued successfully',
          }),
        ]),
      )
    })
  })
})
