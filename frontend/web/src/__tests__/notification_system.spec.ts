import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import AppHeader from '@/components/shell/AppHeader.vue'
import api from '@/api/axios'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
    { path: '/inventory', component: { template: '<div>Inventory</div>' } },
    { path: '/restock', component: { template: '<div>Restock</div>' } },
    { path: '/orders', component: { template: '<div>Orders</div>' } },
    { path: '/invoices', component: { template: '<div>Invoices</div>' } },
    { path: '/quotations', component: { template: '<div>Quotations</div>' } },
    { path: '/audit-logs', component: { template: '<div>Audit Logs</div>' } },
    { path: '/products/:id', component: { template: '<div>Product Edit</div>' } },
  ],
})

describe('Dynamic Notification System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Notification Pinia Store', () => {
    it('initializes with default notifications and correct unread counts', () => {
      const store = useNotificationStore()
      expect(store.notifications.length).toBeGreaterThan(0)
      expect(store.unreadCount).toBeGreaterThan(0)
      expect(store.hasUnread).toBe(true)
      expect(store.notificationFilter).toBe('all')
    })

    it('fetches live dynamic notifications from backend API', async () => {
      const mockData = [
        {
          id: 'low_stock_var_123',
          title: 'Low Stock: Mechanical Keyboard',
          desc: 'Stock is down to 1 unit (threshold: 5).',
          time: '2m ago',
          variant: 'warning',
          unread: true,
          to: '/inventory',
          type: 'low_stock',
        },
        {
          id: 'order_ord_999',
          title: 'Order #ORD-999 Completed',
          desc: 'Sale of $250.00 settled.',
          time: '10m ago',
          variant: 'success',
          unread: false,
          to: '/orders',
          type: 'order',
        },
      ]

      vi.spyOn(api, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: mockData,
        },
      })

      const store = useNotificationStore()
      await store.fetchNotifications()

      expect(store.notifications.length).toBe(2)
      expect(store.notifications[0].id).toBe('low_stock_var_123')
      expect(store.notifications[0].title).toContain('Mechanical Keyboard')
      expect(store.unreadCount).toBe(1)
      expect(store.lastFetched).toBeTruthy()
    })

    it('optimistically marks a single notification as read', async () => {
      const patchSpy = vi.spyOn(api, 'patch').mockResolvedValueOnce({
        data: { success: true },
      })

      const store = useNotificationStore()
      const unreadItem = store.notifications.find((n) => n.unread)
      expect(unreadItem).toBeDefined()

      const targetId = unreadItem!.id
      await store.markAsRead(targetId)

      const updated = store.notifications.find((n) => n.id === targetId)
      expect(updated?.unread).toBe(false)
      expect(patchSpy).toHaveBeenCalledWith(`/notifications/${encodeURIComponent(targetId)}/read`)
    })

    it('optimistically marks all notifications as read', async () => {
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: { success: true },
      })

      const store = useNotificationStore()
      expect(store.unreadCount).toBeGreaterThan(0)

      await store.markAllAsRead()

      expect(store.unreadCount).toBe(0)
      expect(store.hasUnread).toBe(false)
      expect(postSpy).toHaveBeenCalledWith('/notifications/mark-all-read')
    })

    it('optimistically dismisses a notification', async () => {
      const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValueOnce({
        data: { success: true },
      })

      const store = useNotificationStore()
      const initialCount = store.notifications.length
      const targetId = store.notifications[0].id

      await store.dismiss(targetId)

      expect(store.notifications.length).toBe(initialCount - 1)
      expect(store.notifications.find((n) => n.id === targetId)).toBeUndefined()
      expect(deleteSpy).toHaveBeenCalledWith(`/notifications/${encodeURIComponent(targetId)}`)
    })

    it('supports pushing custom local notifications', () => {
      const store = useNotificationStore()
      store.pushLocalNotification({
        title: 'Local Sync Event',
        desc: 'Custom offline queue synced.',
        variant: 'info',
        to: '/dashboard',
      })

      expect(store.notifications[0].title).toBe('Local Sync Event')
      expect(store.notifications[0].unread).toBe(true)
      expect(store.notifications[0].to).toBe('/dashboard')
    })

    it('filters notifications by unread tab', () => {
      const store = useNotificationStore()
      store.notifications = [
        { id: '1', title: 'A', desc: '', time: '', variant: 'info', unread: true },
        { id: '2', title: 'B', desc: '', time: '', variant: 'success', unread: false },
      ]

      store.notificationFilter = 'all'
      expect(store.filteredNotifications.length).toBe(2)

      store.notificationFilter = 'unread'
      expect(store.filteredNotifications.length).toBe(1)
      expect(store.filteredNotifications[0].id).toBe('1')
    })

    it('starts and stops polling without errors', () => {
      vi.useFakeTimers()
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
        data: { success: true, data: [] },
      })

      const store = useNotificationStore()
      store.startPolling(5000)
      expect(store.isPolling).toBe(true)
      expect(getSpy).toHaveBeenCalledTimes(1) // Immediate silent fetch

      vi.advanceTimersByTime(5000)
      expect(getSpy).toHaveBeenCalledTimes(2)

      store.stopPolling()
      expect(store.isPolling).toBe(false)

      vi.advanceTimersByTime(10000)
      expect(getSpy).toHaveBeenCalledTimes(2) // No more calls after stop
    })
  })

  describe('AppHeader Notification UI Integration', () => {
    it('renders notification bell with unread badge and handles popover click', async () => {
      const wrapper = mount(AppHeader, {
        props: {
          branding: {
            store_name: 'Test Store',
            tagline: 'POS System',
            logo_url: null,
          },
          sidebarCollapsed: false,
        },
        global: { plugins: [router] },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.isNotificationsOpen).toBe(false)
      expect(vm.unreadCount).toBeGreaterThan(0)

      // Open popover
      const bellBtn = wrapper.find('.header-notifications-wrapper button')
      await bellBtn.trigger('click')
      expect(vm.isNotificationsOpen).toBe(true)

      // Verify unread badge in DOM
      const badge = wrapper.find('.header-bell-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe(String(vm.unreadCount))
    })

    it('handles Mark All Read in header popover', async () => {
      const wrapper = mount(AppHeader, {
        props: {
          branding: {
            store_name: 'Test Store',
          },
        },
        global: { plugins: [router] },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.unreadCount).toBeGreaterThan(0)

      vm.markAllRead()
      await wrapper.vm.$nextTick()

      expect(vm.unreadCount).toBe(0)
    })

    it('navigates when a notification item is clicked', async () => {
      const pushSpy = vi.spyOn(router, 'push')

      const wrapper = mount(AppHeader, {
        props: {
          branding: {
            store_name: 'Test Store',
          },
        },
        global: { plugins: [router] },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      const firstItem = vm.filteredNotifications[0]

      vm.handleNotificationClick(firstItem)

      expect(firstItem.unread).toBe(false)
      expect(vm.isNotificationsOpen).toBe(false)
      if (firstItem.to) {
        expect(pushSpy).toHaveBeenCalledWith(firstItem.to)
      }
    })
  })

  describe('Primary Button Styling', () => {
    it('ensures primary and cta button variants have white text', async () => {
      const { buttonVariants } = await import('@/components/ui/button-variants')
      const primaryClasses = buttonVariants({ variant: 'primary' })
      expect(primaryClasses).toContain('text-white')

      const ctaClasses = buttonVariants({ variant: 'cta' })
      expect(ctaClasses).toContain('text-white')

      const amberClasses = buttonVariants({ variant: 'amber' })
      expect(amberClasses).toContain('text-white')
    })
  })

  describe('Branded Radio and Product Variant Attributes UI', () => {
    it('renders Radio component with proper branding states', async () => {
      const { default: Radio } = await import('@/components/ui/Radio.vue')
      const wrapper = mount(Radio, {
        props: {
          modelValue: 'SIMPLE',
          value: 'SIMPLE',
          label: 'Simple Product',
          description: 'Single SKU item',
        },
      })

      expect(wrapper.text()).toContain('Simple Product')
      expect(wrapper.text()).toContain('Single SKU item')
      expect(wrapper.find('input[type="radio"]').exists()).toBe(true)
      const input = wrapper.find('input[type="radio"]').element as HTMLInputElement
      expect(input.checked).toBe(true)
    })

    it('renders Variant Attributes visible and disables interactions when product is Simple', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } } as any)
      const { default: ProductCreateView } = await import('@/views/ProductCreateView.vue')
      const wrapper = mount(ProductCreateView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.form.product_type).toBe('SIMPLE')

      // Variant Attributes card must be visible in the DOM
      expect(wrapper.text()).toContain('Variant Attributes')
      expect(wrapper.text()).toContain('Disabled (Simple Product)')

      // When switched to VARIABLE, it should become active
      vm.form.product_type = 'VARIABLE'
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).not.toContain('Disabled (Simple Product)')
    })

    it('allows setting and auto-generating barcodes per variant in ProductCreateView', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } } as any)
      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { data: { id: 'p-new' } } } as any)
      const { default: ProductCreateView } = await import('@/views/ProductCreateView.vue')
      const wrapper = mount(ProductCreateView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.form.name = 'Running Shoes'
      vm.form.purchase_price = '40'
      vm.form.selling_price = '90'
      vm.form.product_type = 'VARIABLE'

      // Mock attributes
      vm.attrStore.attributes = [
        { id: 'a-size', name: 'Size', values: [{ id: 'v-42', value_name: '42' }, { id: 'v-43', value_name: '43' }] },
      ]
      vm.toggleValue('a-size', '42')
      vm.toggleValue('a-size', '43')
      await wrapper.vm.$nextTick()

      expect(vm.matrixPreview).toHaveLength(2)

      // Test manual barcode assignment
      vm.setVariantBarcode(vm.matrixPreview[0].sku, '8850001112221')
      expect(vm.getVariantBarcode(vm.matrixPreview[0].sku)).toBe('8850001112221')

      // Test auto-generate barcodes for remaining variants
      vm.autoGenerateBarcodes()
      expect(vm.getVariantBarcode(vm.matrixPreview[1].sku)).toContain('885')

      // Submit variable product
      await vm.submit()
      expect(postSpy).toHaveBeenCalled()
      const payload = postSpy.mock.calls[0][1] as any
      expect(payload.variants).toBeDefined()
      expect(payload.variants[0].barcode).toBe('8850001112221')
      expect(payload.variants[1].barcode).toContain('885')
    })

    it('allows editing barcodes in ProductEditView and saves variants array', async () => {
      const mockProduct = {
        id: 'prod-123',
        name: 'Cotton Polo',
        purchase_price: '15.00',
        selling_price: '35.00',
        default_reorder_level: 5,
        is_active: true,
        variants: [
          { id: 'var-1', sku: 'POLO-RED-S', barcode: '8851111111111', selling_price: '35.00', cost_price: '15.00', quantity_on_hand: 20, reorder_level: 5, is_active: true },
          { id: 'var-2', sku: 'POLO-RED-M', barcode: '', selling_price: '35.00', cost_price: '15.00', quantity_on_hand: 15, reorder_level: 5, is_active: true },
        ],
      }

      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: mockProduct } } as any)
      const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { data: mockProduct } } as any)

      await router.push('/products/prod-123')
      const { default: ProductEditView } = await import('@/views/ProductEditView.vue')
      const wrapper = mount(ProductEditView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.variantRows).toHaveLength(2)
      expect(vm.variantRows[0].barcode).toBe('8851111111111')
      expect(vm.variantRows[1].barcode).toBe('')

      // Edit barcode on var-2
      vm.variantRows[1].barcode = '8852222222222'

      // Save changes
      await vm.save()
      expect(putSpy).toHaveBeenCalledWith('/products/prod-123', expect.objectContaining({
        variants: expect.arrayContaining([
          expect.objectContaining({ id: 'var-1', barcode: '8851111111111' }),
          expect.objectContaining({ id: 'var-2', barcode: '8852222222222' }),
        ]),
      }))
    })

    it('handles rapid scan keyboard navigation and duplicate detection in ProductCreateView', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] } } as any)
      const { default: ProductCreateView } = await import('@/views/ProductCreateView.vue')
      const wrapper = mount(ProductCreateView, {
        global: {
          plugins: [router],
          stubs: { RouterLink: true },
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      vm.form.name = 'Running Shoes'
      vm.form.purchase_price = '40'
      vm.form.selling_price = '90'
      vm.form.product_type = 'VARIABLE'

      vm.attrStore.attributes = [
        { id: 'a-size', name: 'Size', values: [{ id: 'v-41', value_name: '41' }, { id: 'v-42', value_name: '42' }, { id: 'v-43', value_name: '43' }] },
      ]
      vm.toggleValue('a-size', '41')
      vm.toggleValue('a-size', '42')
      vm.toggleValue('a-size', '43')
      await wrapper.vm.$nextTick()

      expect(vm.matrixPreview).toHaveLength(3)

      // Test Enter key auto-advance from index 0 -> index 1
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
      vm.handleBarcodeKeyDown(enterEvent, 0)
      expect(vm.activeScanIndex).toBe(1)

      // Test Shift+Enter key navigation from index 1 -> index 0
      const shiftEnterEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true })
      vm.handleBarcodeKeyDown(shiftEnterEvent, 1)
      expect(vm.activeScanIndex).toBe(0)

      // Test ArrowDown navigation
      const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
      vm.handleBarcodeKeyDown(arrowDownEvent, 0)
      expect(vm.activeScanIndex).toBe(1)

      // Test ArrowUp navigation
      const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true })
      vm.handleBarcodeKeyDown(arrowUpEvent, 1)
      expect(vm.activeScanIndex).toBe(0)

      // Test duplicate barcode detection
      vm.setVariantBarcode(vm.matrixPreview[0].sku, '8859999000111')
      vm.setVariantBarcode(vm.matrixPreview[1].sku, '8859999000111')
      await wrapper.vm.$nextTick()

      expect(vm.duplicateBarcodeSkus.has(vm.matrixPreview[0].sku)).toBe(true)
      expect(vm.duplicateBarcodeSkus.has(vm.matrixPreview[1].sku)).toBe(true)
      expect(wrapper.text()).toContain('Duplicate barcode detected')
    })
  })

  describe('POS Bank Account Payment Methods Integration', () => {
    it('dynamically loads bank accounts and selects payment method in PosCheckoutModal', async () => {
      const mockBankAccounts = [
        {
          id: 'bank-aba',
          bank_name: 'ABA Bank',
          account_name: 'ABA PayWay (Main)',
          account_number: '000 123 456',
          currency: 'USD',
          is_default: false,
          is_active: true,
          qr_image_url: 'https://cdn.test/aba-qr.png',
        },
        {
          id: 'bank-cash',
          bank_name: 'Cash Register',
          account_name: 'Cash Drawer 1',
          account_number: 'POS-01',
          currency: 'USD',
          is_default: true,
          is_active: true,
        },
        {
          id: 'bank-canadia',
          bank_name: 'Canadia Bank',
          account_name: 'Canadia Business',
          account_number: '098 765 432',
          currency: 'USD',
          is_default: false,
          is_active: true,
        },
      ]

      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/bank-accounts') {
          return { data: { data: mockBankAccounts } } as any
        }
        return { data: { data: [] } } as any
      })

      const { default: PosCheckoutModal } = await import('@/components/pos/PosCheckoutModal.vue')
      const wrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          total: 85.00,
          subtotal: 85.00,
          tenderedAmount: 100.00,
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.bankAccounts).toHaveLength(3)

      // Default bank account (Cash Register) should be selected automatically
      expect(vm.selectedBankId).toBe('bank-cash')
      expect(vm.isCashSelected).toBe(true)
      expect(vm.changeDue).toBe(15.00)

      // Select ABA Bank (QR Category)
      vm.selectBankAccount(mockBankAccounts[0])
      await wrapper.vm.$nextTick()

      expect(vm.selectedBankId).toBe('bank-aba')
      expect(vm.isCashSelected).toBe(false)
      expect(wrapper.emitted('update:payment-method')).toBeTruthy()
      expect(wrapper.emitted('update:payment-method')!.slice(-1)[0]).toEqual(['ABA Bank'])
      expect(wrapper.emitted('update:bank-account-id')!.slice(-1)[0]).toEqual(['bank-aba'])

      // Select Canadia Bank
      vm.selectBankAccount(mockBankAccounts[2])
      await wrapper.vm.$nextTick()
      expect(vm.selectedBankId).toBe('bank-canadia')
      expect(wrapper.emitted('update:payment-method')!.slice(-1)[0]).toEqual(['Canadia Bank'])
    })

    it('handles phone-first customer search and auto-populates name and delivery address', async () => {
      const { default: PosCheckoutModal } = await import('@/components/pos/PosCheckoutModal.vue')
      const wrapper = mount(PosCheckoutModal, {
        props: {
          open: true,
          total: 100.00,
          subtotal: 100.00,
          isDelivery: true,
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      const mockCustomer = {
        id: 'cust-99',
        name: 'Johnathan Doe',
        phone: '012999888',
        loyalty_tier: 'Gold',
        total_spent: 1250.00,
        delivery_address: 'No. 128, Street 2004, Phnom Penh',
        region: 'Sen Sok',
      }

      vm.selectCustomerSuggestion(mockCustomer)
      await wrapper.vm.$nextTick()

      expect(vm.customerPhoneInput).toBe('012999888')
      expect(vm.customerNameInput).toBe('Johnathan Doe')
      expect(wrapper.emitted('update:customer-phone')!.slice(-1)[0]).toEqual(['012999888'])
      expect(wrapper.emitted('update:customer-name')!.slice(-1)[0]).toEqual(['Johnathan Doe'])
      expect(wrapper.emitted('update:delivery-address')!.slice(-1)[0]).toEqual(['No. 128, Street 2004, Phnom Penh'])
      expect(wrapper.emitted('update:delivery-region')!.slice(-1)[0]).toEqual(['Sen Sok'])
    })

    it('allows customized negotiated delivery fee in DeliveryZonePickerModal', async () => {
      const { default: DeliveryZonePickerModal } = await import('@/components/pos/DeliveryZonePickerModal.vue')
      const mockZones = [
        { id: 'zone-1', name: 'Downtown Express', cost: 5.00, estimated_days: '1' },
        { id: 'zone-2', name: 'Suburban Area', cost: 8.00, estimated_days: '2' },
      ]

      const wrapper = mount(DeliveryZonePickerModal, {
        props: {
          open: true,
          zones: mockZones,
          selectedId: 'zone-1',
          initialCost: 5.00,
        },
      })
      await flushPromises()

      const vm = wrapper.vm as any
      expect(vm.selectedZoneId).toBe('zone-1')
      expect(vm.customFee).toBe(5.00)

      // Set negotiated rate to $3.50
      vm.setPresetFee(3.50)
      expect(vm.customFee).toBe(3.50)

      vm.handleApply()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0][0]).toEqual(expect.objectContaining({ id: 'zone-1', cost: 3.50 }))
      expect(wrapper.emitted('select')![0][1]).toBe(3.50)
    })
  })
})


